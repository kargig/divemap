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
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional
from datetime import date, time, datetime
import json
import os
import tempfile
import uuid
import traceback

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, DiveBuddy, r2_storage, UNIFIED_TYPO_TOLERANCE, calculate_unified_phrase_aware_score, classify_match_type
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveListResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


def search_dives_with_fuzzy(query: str, exact_results: List[Dive], db: Session, similarity_threshold: float = UNIFIED_TYPO_TOLERANCE['overall_threshold'], max_fuzzy_results: int = 10, sort_by: str = None, sort_order: str = 'asc', exclude_unspecified_difficulty: bool = False):
    """
    Enhance search results with fuzzy matching when exact results are insufficient.
    """
    print(f"🔍 DEBUG: Starting search_dives_with_fuzzy with query: '{query}'")
    try:
        query_lower = query.lower()
        
        # First, score the exact results
        if exact_results:
            print(f"🔍 DEBUG: Processing {len(exact_results)} exact results")
            exact_ids = [dive.id for dive in exact_results]
            exact_results = db.query(Dive).options(
                joinedload(Dive.difficulty),
                joinedload(Dive.user),
                joinedload(Dive.dive_site),
                joinedload(Dive.diving_center),
                selectinload(Dive.buddies),
                selectinload(Dive.tags).joinedload(DiveTag.tag)
            ).join(User, Dive.user_id == User.id) \
             .join(DiveSite, Dive.dive_site_id == DiveSite.id) \
             .filter(Dive.id.in_(exact_ids)).all()
            print(f"🔍 DEBUG: Re-fetched {len(exact_results)} exact results with eager loading")

        exact_results_with_scores = []
        for dive in exact_results:
            dive_site = dive.dive_site
            if not dive_site:
                continue
                
            dive_tags = [t.tag.name for t in dive.tags if t.tag]
            
            score = calculate_unified_phrase_aware_score(
                query_lower, 
                dive_site.name, 
                dive_site.description, 
                dive_site.country, 
                dive_site.region, 
                None, # DiveSite doesn't have city attribute
                dive_tags
            )
            exact_results_with_scores.append({
                'dive': dive,
                'match_type': 'exact' if score >= 0.9 else 'exact_words' if score >= 0.7 else 'partial_words',
                'score': score,
                'name_contains': query_lower in dive_site.name.lower(),
                'description_contains': dive_site.description and query_lower in dive_site.description.lower(),
            })
        
        if len(exact_results) >= 10:
            print("🔍 DEBUG: Found enough exact results, returning early")
            return exact_results_with_scores
        
        print("🔍 DEBUG: Fetching all dives for fuzzy matching")
        all_dives_query = db.query(Dive).options(
            joinedload(Dive.difficulty),
            joinedload(Dive.user),
            joinedload(Dive.dive_site),
            joinedload(Dive.diving_center),
            selectinload(Dive.buddies),
            selectinload(Dive.tags).joinedload(DiveTag.tag)
        ).join(DiveSite, Dive.dive_site_id == DiveSite.id)
        
        if exclude_unspecified_difficulty:
            all_dives_query = all_dives_query.filter(Dive.difficulty_id.isnot(None))
        
        all_dives = all_dives_query.all()
        print(f"🔍 DEBUG: Found {len(all_dives)} total dives for fuzzy matching")
        
        exact_ids = {dive.id for dive in exact_results}
        fuzzy_matches = []
        for dive in all_dives:
            if dive.id in exact_ids:
                continue
                
            dive_site = dive.dive_site
            if not dive_site:
                continue
                
            dive_tags = [t.tag.name for t in dive.tags if t.tag]
            
            weighted_score = calculate_unified_phrase_aware_score(
                query_lower, 
                dive_site.name, 
                dive_site.description, 
                dive_site.country, 
                dive_site.region, 
                None, # DiveSite doesn't have city attribute
                dive_tags
            )
            
            name_contains = query_lower in dive_site.name.lower()
            description_contains = dive_site.description and query_lower in dive_site.description.lower()
            
            if weighted_score > similarity_threshold:
                match_type = classify_match_type(weighted_score)
                fuzzy_matches.append({
                    'dive': dive,
                    'match_type': match_type,
                    'score': weighted_score,
                    'name_contains': name_contains,
                    'description_contains': description_contains,
                })
        
        print(f"🔍 DEBUG: Found {len(fuzzy_matches)} fuzzy matches above threshold")
        fuzzy_matches.sort(key=lambda x: x['score'], reverse=True)
        fuzzy_matches = fuzzy_matches[:max_fuzzy_results]
        all_results = exact_results_with_scores + fuzzy_matches
        all_results.sort(key=lambda x: x['score'], reverse=True)
        
        print(f"🔍 DEBUG: Returning {len(all_results)} total results")
        return all_results
    except Exception as e:
        import traceback
        error_msg = f"❌ Error in search_dives_with_fuzzy: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
