from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date, time, datetime

from ..dives_shared import router, get_db, get_current_user, User, Dive, DiveTag
from app.schemas import DiveCreate
from app.models import DiveSite
from .common import convert_difficulty_to_code, save_dive_profile_data
from ..dives_utils import (
    has_deco_profile,
    generate_dive_name,
    get_or_create_deco_tag
)

@router.post("/import/confirm")
async def confirm_import_dives(
    dives_data: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Confirm and import the selected dives after user review.
    """
    if not dives_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No dives to import"
        )

    imported_dives = []
    errors = []

    for i, dive_data in enumerate(dives_data):
        try:
            # Validate required fields
            if not dive_data.get('dive_date'):
                errors.append(f"Dive {i+1}: Missing dive date")
                continue

            # Check if this is an update of an existing dive
            existing_id = dive_data.get('id') or dive_data.get('existing_dive_id')
            existing_dive = None
            if existing_id:
                existing_dive = db.query(Dive).filter(Dive.id == existing_id, Dive.user_id == current_user.id).first()

            # Create/Update data
            dive_create = DiveCreate(
                dive_site_id=dive_data.get('dive_site_id'),
                diving_center_id=dive_data.get('diving_center_id'),
                name=dive_data.get('name'),
                is_private=dive_data.get('is_private', False),
                dive_information=dive_data.get('dive_information'),
                max_depth=dive_data.get('max_depth'),
                average_depth=dive_data.get('average_depth'),
                gas_bottles_used=dive_data.get('gas_bottles_used'),
                suit_type=dive_data.get('suit_type'),
                difficulty_code=convert_difficulty_to_code(dive_data.get('difficulty_level', 'intermediate')),
                visibility_rating=dive_data.get('visibility_rating'),
                user_rating=dive_data.get('user_rating'),
                dive_date=dive_data['dive_date'],
                dive_time=dive_data.get('dive_time'),
                duration=dive_data.get('duration')
            )

            # Parse date and time for SQLite compatibility (accept both str and date/time objects)
            raw_dive_date = dive_data['dive_date']
            if isinstance(raw_dive_date, date):
                dive_date = raw_dive_date
            else:
                dive_date = datetime.strptime(raw_dive_date, "%Y-%m-%d").date()

            dive_time = None
            raw_dive_time = dive_data.get('dive_time')
            if raw_dive_time is not None:
                if isinstance(raw_dive_time, time):
                    dive_time = raw_dive_time
                else:
                    dive_time = datetime.strptime(raw_dive_time, "%H:%M:%S").time()

            # Create/Update the dive
            dive_data_dict = dive_create.model_dump(exclude_unset=True)
            dive_data_dict['dive_date'] = dive_date  # Use parsed date object
            dive_data_dict['dive_time'] = dive_time  # Use parsed time object
            
            # Convert difficulty_code to difficulty_id if present
            difficulty_code = dive_data_dict.pop('difficulty_code', None)
            if difficulty_code:
                from app.models import get_difficulty_id_by_code
                difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
                if difficulty_id:
                    dive_data_dict['difficulty_id'] = difficulty_id
            
            if existing_dive:
                # Update existing dive
                for key, value in dive_data_dict.items():
                    setattr(existing_dive, key, value)
                dive = existing_dive
            else:
                # Create new dive
                dive = Dive(
                    user_id=current_user.id,
                    **dive_data_dict
                )
                db.add(dive)

            # Generate name using format: "divesite - date - original dive name from XML"
            if not existing_dive or not existing_dive.name:
                original_dive_name = dive.name
                
                if dive.dive_site_id:
                    dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                    if dive_site:
                        if isinstance(dive.dive_date, date):
                            dive_date_obj = dive.dive_date
                        else:
                            dive_date_obj = datetime.strptime(dive.dive_date, '%Y-%m-%d').date()
                        dive.name = generate_dive_name(dive_site.name, dive_date_obj, original_dive_name)
                else:
                    if original_dive_name:
                        dive.name = f"Dive - {dive.dive_date} - {original_dive_name}"
                    else:
                        dive.name = f"Dive - {dive.dive_date}"

            db.add(dive)
            db.flush()

            # Check if dive has decompression profile and add deco tag
            if 'profile_data' in dive_data and dive_data['profile_data']:
                if has_deco_profile(dive_data['profile_data']):
                    try:
                        deco_tag = get_or_create_deco_tag(db)
                        if deco_tag.id not in [t.tag_id for t in dive.tags]:
                            dive_tag = DiveTag(dive_id=dive.id, tag_id=deco_tag.id)
                            db.add(dive_tag)
                    except Exception:
                        pass

            # Import tags from dive_data
            if 'tags' in dive_data and dive_data['tags']:
                import_tags = dive_data['tags']
                if isinstance(import_tags, str):
                    import_tags = [t.strip() for t in import_tags.split(',') if t.strip()]
                
                for tag_name in import_tags:
                    try:
                        # Find or create tag
                        tag = db.query(AvailableTag).filter(AvailableTag.name == tag_name).first()
                        if not tag:
                            tag = AvailableTag(name=tag_name, created_by=current_user.id if current_user else None)
                            db.add(tag)
                            db.flush()
                        
                        # Add tag to dive if not already present
                        if tag.id not in [t.tag_id for t in dive.tags]:
                            dive_tag = DiveTag(dive_id=dive.id, tag_id=tag.id)
                            db.add(dive_tag)
                    except Exception as e:
                        print(f"Error importing tag '{tag_name}': {e}")

            # Save dive profile data if available
            if 'profile_data' in dive_data and dive_data['profile_data']:
                try:
                    profile_data = dive_data['profile_data']
                    if 'samples' in profile_data and profile_data['samples']:
                        samples = profile_data['samples']
                        depths = [s.get('depth') for s in samples if s.get('depth') is not None]
                        temps = [s.get('temperature') for s in samples if s.get('temperature') is not None]
                        
                        profile_data['calculated_max_depth'] = max(depths) if depths else 0
                        profile_data['calculated_avg_depth'] = round(sum(depths) / len(depths), 2) if depths else 0
                        profile_data['calculated_duration_minutes'] = dive.duration or profile_data.get('calculated_duration_minutes', 0)
                        profile_data['sample_count'] = len(samples)
                        profile_data['temperature_range'] = {
                            "min": min(temps) if temps else None,
                            "max": max(temps) if temps else None
                        }
                        if 'events' not in profile_data:
                            profile_data['events'] = []
                    
                    save_dive_profile_data(dive, profile_data, db)
                except Exception:
                    pass

            dive_site_name = None
            if dive.dive_site_id:
                dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                if dive_site:
                    dive_site_name = dive_site.name
            
            imported_dives.append({
                "id": dive.id,
                "name": dive.name,
                "dive_date": dive.dive_date.isoformat() if dive.dive_date else None,
                "dive_site_id": dive.dive_site_id,
                "dive_site_name": dive_site_name
            })

        except Exception:
            import logging
            logging.exception(f"Error importing dive {i+1} in confirm_import_dives")
            errors.append(f"Dive {i+1}: Internal processing error")

    db.commit()

    return {
        "message": f"Successfully imported {len(imported_dives)} dives",
        "imported_dives": imported_dives,
        "errors": errors,
        "total_imported": len(imported_dives),
        "total_errors": len(errors)
    }
