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

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


def generate_dive_name(dive_site_name: str, dive_date: date) -> str:
    """Generate automatic dive name from dive site and date"""
    return f"{dive_site_name} - {dive_date.strftime('%Y/%m/%d')}"

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

def find_dive_site_by_import_id(import_site_id, db, dive_site_name=None):
    """Find dive site by import ID with improved similarity matching"""
    try:
        # First, try to get all dive sites to search through aliases
        sites = db.query(DiveSite).all()

        # Check if any site has this import ID as an alias
        for site in sites:
            if hasattr(site, 'aliases') and site.aliases:
                for alias in site.aliases:
                    if alias.alias == import_site_id:
                        return {"id": site.id, "match_type": "exact_alias"}

        # If no exact alias match, check site names with exact match
        for site in sites:
            if site.name == import_site_id:
                return {"id": site.id, "match_type": "exact_name"}

        # If we have a dive site name, try matching by name first
        if dive_site_name:
            # Check exact name match
            for site in sites:
                if site.name == dive_site_name:
                    return {"id": site.id, "match_type": "exact_name"}

            # Try similarity matching with the dive site name
            best_match = None
            best_similarity = 0.0
            similarity_threshold = 0.8  # 80% similarity threshold

            for site in sites:
                similarity = calculate_similarity(dive_site_name, site.name)
                if similarity >= similarity_threshold and similarity > best_similarity:
                    best_match = site
                    best_similarity = similarity

            if best_match:
                print(f"Found similar dive site: '{dive_site_name}' matches '{best_match.name}' with {best_similarity:.2f} similarity")
                return {
                    "id": best_match.id,
                    "match_type": "similarity",
                    "similarity": best_similarity,
                    "proposed_sites": [{"id": best_match.id, "name": best_match.name, "similarity": best_similarity, "original_name": dive_site_name}]
                }

        # If no match found with dive site name, try similarity matching with import ID
        best_match = None
        best_similarity = 0.0
        similarity_threshold = 0.8  # 80% similarity threshold

        for site in sites:
            similarity = calculate_similarity(import_site_id, site.name)
            if similarity >= similarity_threshold and similarity > best_similarity:
                best_match = site
                best_similarity = similarity

        if best_match:
            print(f"Found similar dive site: '{import_site_id}' matches '{best_match.name}' with {best_similarity:.2f} similarity")
            return {
                "id": best_match.id,
                "match_type": "similarity",
                "similarity": best_similarity,
                "proposed_sites": [{"id": best_match.id, "name": best_match.name, "similarity": best_similarity, "original_name": import_site_id}]
            }

        return None

    except Exception as e:
        print(f"Error finding dive site: {e}")
        return None

@router.get("/storage/health")
def storage_health_check():
    """Check storage service health (R2 and local fallback)"""
    try:
        health_status = r2_storage.health_check()
        return health_status
    except Exception as e:
        return {
            "error": str(e),
            "r2_available": False,
            "local_storage_available": False,
            "bucket_accessible": False,
            "credentials_present": False,
            "boto3_available": False,
            "local_storage_writable": False
        }
