from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from ..dives_shared import router, get_db, get_current_user, User, Dive
from app.schemas import GarminFITResponse
from app.models import DiveSite, DivingCenter
from .suunto_parser import parse_suunto_json_file
from .common import (
    find_existing_dive, 
    find_sites_by_coords
)

@router.post("/import/suunto-json", response_model=GarminFITResponse)
async def import_suunto_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import dives from Suunto JSON file.
    """
    if not file.filename.lower().endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a JSON file"
        )

    try:
        content = await file.read()
        
        # Pre-fetch data for performance
        all_centers = db.query(DivingCenter).all()
        user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
        all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()
        
        # Parse Suunto file
        dive_data = parse_suunto_json_file(content)
        
        if not dive_data or not dive_data.get("dive_date"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid dive data found in JSON file"
            )

        parsed_dives = [dive_data]

        # Process GPS and check duplicates
        for dive in parsed_dives:
            # Match coordinates if present
            lat = dive.get("latitude")
            lng = dive.get("longitude")
            
            if lat is not None and lng is not None:
                sites = find_sites_by_coords(db, lat, lng)
                if sites:
                    best_match = sites[0]
                    dive["dive_site_id"] = best_match.id
                    if best_match.distance > 10:
                        dive["proposed_sites"] = [{"id": s.id, "name": s.name, "distance": s.distance} for s in sites]
                else:
                    dive["unmatched_dive_site"] = {"name": "Unknown Site (GPS)", "latitude": lat, "longitude": lng}
                    
            # Duplicate detection
            if dive.get("dive_date"):
                existing = find_existing_dive(
                    db, current_user.id, 
                    dive["dive_date"], 
                    dive.get("dive_time"), 
                    dive.get("duration"), 
                    dive.get("max_depth"),
                    user_dives=user_dives
                )
                if existing:
                    dive["existing_dive_id"] = existing.id
                    dive["skip"] = True

        # Use pre-fetched data for manual selection in frontend review
        dive_sites_for_selection = [
            {
                "id": site.id,
                "name": site.name,
                "country": site.country,
                "region": site.region
            }
            for site in all_sites
        ]

        diving_centers_for_selection = [
            {"id": dc.id, "name": dc.name, "country": dc.country}
            for dc in all_centers
        ]

        return {
            "message": f"Successfully parsed {len(parsed_dives)} dives from Suunto JSON",
            "dives": parsed_dives,
            "available_dive_sites": dive_sites_for_selection,
            "available_diving_centers": diving_centers_for_selection
        }

    except HTTPException:
        raise
    except Exception:
        import logging
        logging.exception("Error processing Suunto JSON file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error processing Suunto JSON file"
        )
