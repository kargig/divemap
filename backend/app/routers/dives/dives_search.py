"""
Search operations for dives.

This module contains search functionality for dives:
- search_dives_with_fuzzy: Advanced fuzzy search with typo tolerance
- search_dives: Basic search with filtering capabilities

The search functionality includes:
- Fuzzy matching with typo tolerance
- Phrase-aware scoring
- Match type classification
- Unified search across multiple fields
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, time, datetime
import json
import os
import tempfile
import uuid

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage, UNIFIED_TYPO_TOLERANCE, calculate_unified_phrase_aware_score, classify_match_type
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


def search_dives_with_fuzzy(query: str, exact_results: List[Dive], db: Session, similarity_threshold: float = UNIFIED_TYPO_TOLERANCE['overall_threshold'], max_fuzzy_results: int = 10, sort_by: str = None, sort_order: str = 'asc'):
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
        
        score = calculate_unified_phrase_aware_score(
            query_lower, 
            dive_site.name, 
            dive_site.description, 
            dive_site.country, 
            dive_site.region, 
            None,  # DiveSite doesn't have city attribute
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
            None,  # DiveSite doesn't have city attribute
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
