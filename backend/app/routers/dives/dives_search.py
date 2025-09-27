"""
Search functionality for dives.

This module contains search operations for dives:
- search_dives_with_fuzzy
"""

from fastapi import Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from difflib import SequenceMatcher

from .dives_shared import router, get_db, get_current_user_optional, User, Dive, DiveSite, UNIFIED_TYPO_TOLERANCE
from .dives_logging import log_error
from .dives_utils import calculate_similarity
from app.schemas import DiveResponse


# calculate_similarity moved to dives_utils.py


def search_dives_with_fuzzy(
    query: str,
    exact_results: List[Dive],
    db: Session,
    similarity_threshold: float = UNIFIED_TYPO_TOLERANCE['overall_threshold'],
    max_fuzzy_results: int = 10,
    sort_by: str = None,
    sort_order: str = 'asc'
) -> List[Dive]:
    """
    Enhance search results with fuzzy matching when exact results are insufficient.
    
    Args:
        query: The search query string
        exact_results: List of dives from exact search
        db: Database session
        similarity_threshold: Minimum similarity score (0.0 to 1.0)
        max_fuzzy_results: Maximum number of fuzzy results to return
        sort_by: Sort field
        sort_order: Sort order (asc/desc)
    
    Returns:
        List of dives with enhanced scoring and match type classification
    """
    try:
        query_lower = query.lower()
        
        # First, score the exact results
        exact_results_with_scores = []
        for dive in exact_results:
            # Get dive site information for scoring
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if not dive_site:
                continue
                
            # Get tags for this dive for scoring
            dive_tags = []
            if hasattr(dive, 'tags') and dive.tags:
                dive_tags = [tag.name if hasattr(tag, 'name') else str(tag) for tag in dive.tags]
            
            from .dives_shared import calculate_unified_phrase_aware_score, classify_match_type
            score = calculate_unified_phrase_aware_score(
                query_lower, 
                dive_site.name, 
                dive_site.description, 
                dive_site.country, 
                dive_site.region, 
                dive_site.city, 
                dive_tags
            )
            exact_results_with_scores.append({
                'dive': dive,
                'match_type': 'exact' if score >= 0.9 else 'exact_words' if score >= 0.7 else 'partial_words',
                'score': score,
                'name_contains': query_lower in dive_site.name.lower(),
                'description_contains': dive_site.description and query_lower in dive_site.description.lower(),
            })
        
        # If we have enough exact results and no fuzzy search needed, return them
        if len(exact_results) >= 10:
            return exact_results_with_scores
        
        # Get all dives for fuzzy matching (with dive site info)
        all_dives = db.query(Dive).join(DiveSite, Dive.dive_site_id == DiveSite.id).all()
        
        # Create a set of exact result IDs to avoid duplicates
        exact_ids = {dive.id for dive in exact_results}
        
        # Perform fuzzy matching on remaining dives
        fuzzy_matches = []
        for dive in all_dives:
            if dive.id in exact_ids:
                continue
                
            # Get dive site information for scoring
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if not dive_site:
                continue
                
            # Get tags for this dive for scoring
            dive_tags = []
            if hasattr(dive, 'tags') and dive.tags:
                dive_tags = [tag.name if hasattr(tag, 'name') else str(tag) for tag in dive.tags]
            
            weighted_score = calculate_unified_phrase_aware_score(
                query_lower, 
                dive_site.name, 
                dive_site.description, 
                dive_site.country, 
                dive_site.region, 
                dive_site.city, 
                dive_tags
            )
            
            # Check for partial matches (substring matches) for match type classification
            name_contains = query_lower in dive_site.name.lower()
            description_contains = dive_site.description and query_lower in dive_site.description.lower()
            
            # Include if similarity above threshold
            if weighted_score > similarity_threshold:
                # Determine match type using unified classification
                match_type = classify_match_type(weighted_score)
                
                fuzzy_matches.append({
                    'dive': dive,
                    'match_type': match_type,
                    'score': weighted_score,
                    'name_contains': name_contains,
                    'description_contains': description_contains,
                })
        
        # Sort fuzzy matches by score (descending)
        fuzzy_matches.sort(key=lambda x: x['score'], reverse=True)
        
        # Limit fuzzy results
        fuzzy_matches = fuzzy_matches[:max_fuzzy_results]
        
        # Combine exact and fuzzy results
        all_results = exact_results_with_scores + fuzzy_matches
        
        # Sort all results by score (descending)
        all_results.sort(key=lambda x: x['score'], reverse=True)
        
        return all_results
        
    except Exception as e:
        log_error("search_dives_with_fuzzy", e, query=query)
        return exact_results


@router.get("/search", response_model=List[DiveResponse])
def search_dives(
    q: str = Query(..., description="Search query"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    similarity_threshold: float = Query(UNIFIED_TYPO_TOLERANCE['overall_threshold'], description="Similarity threshold for fuzzy search"),
    max_fuzzy_results: int = Query(10, description="Maximum number of fuzzy results"),
    sort_by: str = Query("dive_date", description="Sort by field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Search dives with fuzzy matching"""
    try:
        # First get exact matches
        exact_query = db.query(Dive).join(DiveSite).filter(
            DiveSite.name.ilike(f"%{q}%")
        )
        
        # Apply privacy filter
        if not current_user:
            exact_query = exact_query.filter(Dive.is_private == False)
        elif current_user:
            # User can see their own private dives and all public dives
            exact_query = exact_query.filter(
                (Dive.is_private == False) | (Dive.user_id == current_user.id)
            )
        
        exact_results = exact_query.all()
        
        # Get fuzzy results
        fuzzy_results = search_dives_with_fuzzy(
            q, exact_results, db, similarity_threshold, max_fuzzy_results, sort_by, sort_order
        )
        
        # Apply pagination
        offset = (page - 1) * page_size
        paginated_results = fuzzy_results[offset:offset + page_size]
        
        return paginated_results
        
    except Exception as e:
        log_error("search_dives", e, current_user.id if current_user else None, query=q)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search dives"
        )
