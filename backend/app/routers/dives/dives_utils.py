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
    """Calculate similarity between two strings using SequenceMatcher"""
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def find_dive_site_by_import_id(import_id: str, db: Session):
    """Find dive site by import ID"""
    from .dives_shared import DiveSite, DiveSiteAlias
    
    if not import_id:
        return None
    
    # First try to find by exact import_id match
    dive_site = db.query(DiveSite).filter(DiveSite.import_id == import_id).first()
    if dive_site:
        return dive_site
    
    # Then try to find by alias
    alias = db.query(DiveSiteAlias).filter(DiveSiteAlias.alias == import_id).first()
    if alias:
        return alias.dive_site
    
    return None


@router.get("/storage/health")
def get_storage_health():
    """Get storage health status"""
    return storage_health_check()
