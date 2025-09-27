"""
Utility functions for dives.

This module contains utility functions for dives:
- storage_health_check
- generate_dive_name
- has_deco_profile
- calculate_similarity
- find_dive_site_by_import_id
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from difflib import SequenceMatcher

from .dives_shared import router, get_db, r2_storage
from .dives_logging import log_error


def storage_health_check():
    """Check storage health status"""
    try:
        # Check R2 storage connectivity
        health_status = r2_storage.health_check()
        
        return {
            "status": "healthy" if health_status else "unhealthy",
            "storage": "r2",
            "details": {
                "r2_connected": health_status,
                "timestamp": "2025-01-27T15:37:57Z"  # This would be actual timestamp
            }
        }
        
    except Exception as e:
        log_error("storage_health_check", e)
        return {
            "status": "unhealthy",
            "storage": "r2",
            "error": str(e),
            "details": {
                "r2_connected": False,
                "timestamp": "2025-01-27T15:37:57Z"
            }
        }


def generate_dive_name(dive_site_name: str, dive_date) -> str:
    """Generate automatic dive name from dive site and date"""
    from datetime import date
    if isinstance(dive_date, date):
        return f"{dive_site_name} - {dive_date.strftime('%Y/%m/%d')}"
    else:
        return f"{dive_site_name} - {dive_date}"


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
    from .dives_shared import DiveSite, DiveSiteAlias
    
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
def get_storage_health():
    """Get storage health status"""
    return storage_health_check()
