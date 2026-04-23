"""
Utility functions for dives.

This module contains utility functions for dive operations:
- find_dive_site_by_import_id: Find dive site by import ID
- get_dive_site_by_name: Get dive site by name
- get_dive_site_by_alias: Get dive site by alias
- create_dive_site_from_import: Create dive site from import data
- get_dive_site_by_coordinates: Find dive site by coordinates

The utility functions include:
- Dive site lookup and creation
- Import data processing
- Coordinate-based matching
- Alias and name resolution
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, time, datetime
import json
import os
import tempfile
import uuid
from difflib import SequenceMatcher

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


def generate_dive_name(dive_site_name: str, dive_date: date, original_dive_name: Optional[str] = None) -> str:
    """Generate automatic dive name from dive site, date, and optional original dive name"""
    date_str = dive_date.strftime('%Y/%m/%d')
    if original_dive_name:
        return f"{dive_site_name} - {date_str} - {original_dive_name}"
    return f"{dive_site_name} - {date_str}"

def get_or_create_deco_tag(db: Session) -> AvailableTag:
    """Get or create the 'deco' tag for decompression dives."""
    deco_tag = db.query(AvailableTag).filter(AvailableTag.name == "deco").first()
    if not deco_tag:
        deco_tag = AvailableTag(
            name="deco",
            description="Decompression dive - requires decompression stops"
        )
        db.add(deco_tag)
        db.commit()
        db.refresh(deco_tag)
    return deco_tag

def has_deco_profile(profile_data: dict) -> bool:
    """Check if dive profile contains any samples with in_deco=True."""
    if not profile_data or 'samples' not in profile_data:
        return False
    
    for sample in profile_data['samples']:
        if sample.get('in_deco') is True:
            return True
    return False

def calculate_similarity(str1: str, str2: str) -> float:
    """Calculate string similarity using multiple algorithms"""
    str1_lower = str1.lower().strip()
    str2_lower = str2.lower().strip()

    if str1_lower == str2_lower:
        return 1.0

    # Method 1: Sequence matcher (good for typos and minor differences)
    sequence_similarity = SequenceMatcher(None, str1_lower, str2_lower).ratio()

    # Method 2: Word-based similarity
    import re
    common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'dive', 'site', 'reef', 'rock', 'point', 'bay', 'beach'}
    str1_words = set(re.findall(r'\b\w+\b', str1_lower)) - common_words
    str2_words = set(re.findall(r'\b\w+\b', str2_lower)) - common_words

    if not str1_words and not str2_words:
        word_similarity = 0.0
    else:
        intersection = str1_words.intersection(str2_words)
        union = str1_words.union(str2_words)
        word_similarity = len(intersection) / len(union) if union else 0.0

    # Method 3: Substring matching
    substring_similarity = 0.0
    if len(str1_lower) > 3 and len(str2_lower) > 3:
        if str1_lower in str2_lower or str2_lower in str1_lower:
            substring_similarity = 0.9

    # Return the highest similarity score
    return max(sequence_similarity, word_similarity, substring_similarity)

def find_potential_matches(search_term, data_list, threshold=0.6):
    """Generic fuzzy matcher for a list of objects with a 'name' attribute"""
    matches = []
    for item in data_list:
        similarity = calculate_similarity(search_term, item.name)
        if similarity >= threshold:
            matches.append({
                "id": item.id,
                "name": item.name,
                "similarity": similarity,
                "original_name": search_term
            })
    
    # Sort by similarity desc
    matches.sort(key=lambda x: x['similarity'], reverse=True)
    return matches

def find_dive_site_by_import_id(import_site_id, db, dive_site_name=None, sites=None):
    """
    Find dive site by import ID or Name.
    If 'sites' list is provided, performs memory-only matching.
    Otherwise, performs database lookups.
    """
    try:
        search_name = dive_site_name or import_site_id
        if not search_name:
            return None

        # If sites are pre-fetched, do a fast memory search
        if sites:
            # 1. Exact Match
            for site in sites:
                if site.name == search_name:
                    return {"id": site.id, "name": site.name, "match_type": "exact_name"}
            
            # 2. Fuzzy Match against all sites
            matches = find_potential_matches(search_name, sites, threshold=0.6)
            if matches:
                best_match = matches[0]
                return {
                    "id": best_match['id'],
                    "name": best_match['name'],
                    "match_type": "similarity",
                    "similarity": best_match['similarity'],
                    "proposed_sites": matches[:5]
                }
            return None

        # Fallback to targeted DB queries if no pre-fetched sites provided
        # 1. Exact Name Match
        site = db.query(DiveSite).filter(DiveSite.name == search_name).first()
        if site:
            return {"id": site.id, "name": site.name, "match_type": "exact_name"}

        # 2. Alias Match
        alias = db.query(DiveSiteAlias).filter(DiveSiteAlias.alias == search_name).first()
        if alias:
            site = db.query(DiveSite).filter(DiveSite.id == alias.dive_site_id).first()
            if site:
                return {"id": site.id, "name": site.name, "match_type": "exact_alias"}

        # 3. Targeted Fuzzy
        first_word = search_name.split()[0] if ' ' in search_name else search_name
        candidates = db.query(DiveSite).filter(
            (DiveSite.name.like(f"{search_name[:3]}%")) |
            (DiveSite.name.like(f"%{first_word}%"))
        ).limit(100).all()

        if candidates:
            matches = find_potential_matches(search_name, candidates, threshold=0.6)
            if matches:
                best_match = matches[0]
                return {
                    "id": best_match['id'],
                    "name": best_match['name'],
                    "match_type": "similarity",
                    "similarity": best_match['similarity'],
                    "proposed_sites": matches[:5]
                }

        return None

    except Exception as e:
        print(f"Error finding dive site: {e}")
        return None
