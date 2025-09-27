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
from ..schemas import DiveResponse


def calculate_similarity(str1: str, str2: str) -> float:
    """Calculate similarity between two strings using SequenceMatcher"""
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def search_dives_with_fuzzy(
    query: str,
    exact_results: List[Dive],
    db: Session,
    similarity_threshold: float = UNIFIED_TYPO_TOLERANCE['overall_threshold'],
    max_fuzzy_results: int = 10,
    sort_by: str = None,
    sort_order: str = 'asc'
) -> List[Dive]:
    """Search dives with fuzzy matching"""
    try:
        if not query or len(query.strip()) < 2:
            return exact_results
        
        # Get all dives for fuzzy search
        all_dives = db.query(Dive).join(DiveSite).all()
        
        # Calculate similarity scores
        dive_scores = []
        for dive in all_dives:
            # Skip if already in exact results
            if dive in exact_results:
                continue
            
            # Calculate similarity with dive site name
            site_similarity = calculate_similarity(query, dive.dive_site.name)
            
            # Calculate similarity with dive name
            name_similarity = calculate_similarity(query, dive.name or "")
            
            # Calculate similarity with notes
            notes_similarity = calculate_similarity(query, dive.notes or "")
            
            # Calculate similarity with buddy
            buddy_similarity = calculate_similarity(query, dive.buddy or "")
            
            # Use the highest similarity score
            max_similarity = max(site_similarity, name_similarity, notes_similarity, buddy_similarity)
            
            if max_similarity >= similarity_threshold:
                dive_scores.append((dive, max_similarity))
        
        # Sort by similarity score
        dive_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Get top results
        fuzzy_results = [dive for dive, score in dive_scores[:max_fuzzy_results]]
        
        # Combine exact and fuzzy results
        all_results = exact_results + fuzzy_results
        
        # Apply sorting if specified
        if sort_by:
            if sort_by == "dive_date":
                if sort_order == "asc":
                    all_results.sort(key=lambda x: x.dive_date)
                else:
                    all_results.sort(key=lambda x: x.dive_date, reverse=True)
            elif sort_by == "depth":
                if sort_order == "asc":
                    all_results.sort(key=lambda x: x.depth or 0)
                else:
                    all_results.sort(key=lambda x: x.depth or 0, reverse=True)
            elif sort_by == "rating":
                if sort_order == "asc":
                    all_results.sort(key=lambda x: x.rating or 0)
                else:
                    all_results.sort(key=lambda x: x.rating or 0, reverse=True)
        
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
