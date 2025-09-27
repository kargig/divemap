"""
Core CRUD operations for dives.

This module contains the main CRUD operations for dives:
- create_dive
- get_dives
- get_dive
- update_dive
- delete_dive
- get_dive_details
- get_dives_count
"""

from fastapi import Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from .dives_shared import router, get_db, get_current_user, get_current_user_optional, User, Dive, DiveSite
from .dives_db_utils import get_dive_site_by_id, get_dive_by_id, get_dive_with_relations
from .dives_validation import validate_dive_date, validate_dive_time, validate_depth, validate_duration, validate_rating, validate_visibility, validate_temperature
from .dives_errors import raise_dive_not_found, raise_dive_site_not_found, raise_validation_error
from .dives_logging import log_dive_operation, log_error
from app.schemas import DiveCreate, DiveUpdate, DiveResponse


def generate_dive_name(dive_site_name: str, dive_date: date) -> str:
    """Generate automatic dive name from dive site and date"""
    return f"{dive_site_name} - {dive_date.strftime('%Y/%m/%d')}"


@router.post("/", response_model=DiveResponse)
def create_dive(
    dive: DiveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new dive log entry"""
    try:
        # Validate dive site exists
        dive_site = get_dive_site_by_id(db, dive.dive_site_id)
        if not dive_site:
            raise_dive_site_not_found(dive.dive_site_id)
        
        # Validate dive data
        if not validate_dive_date(dive.dive_date):
            raise_validation_error("Dive date cannot be in the future")
        
        if not validate_dive_time(dive.dive_time):
            raise_validation_error("Invalid dive time")
        
        if not validate_depth(dive.depth):
            raise_validation_error("Invalid dive depth")
        
        if not validate_duration(dive.duration):
            raise_validation_error("Invalid dive duration")
        
        if not validate_rating(dive.rating):
            raise_validation_error("Invalid dive rating")
        
        if not validate_visibility(dive.visibility):
            raise_validation_error("Invalid visibility")
        
        if not validate_temperature(dive.temperature):
            raise_validation_error("Invalid temperature")
        
        # Create dive
        db_dive = Dive(
            user_id=current_user.id,
            dive_site_id=dive.dive_site_id,
            dive_date=dive.dive_date,
            dive_time=dive.dive_time,
            depth=dive.depth,
            duration=dive.duration,
            rating=dive.rating,
            visibility=dive.visibility,
            temperature=dive.temperature,
            notes=dive.notes,
            buddy=dive.buddy,
            suit_type=dive.suit_type,
            weight=dive.weight,
            is_private=dive.is_private
        )
        
        # Generate dive name if not provided
        if not dive.name:
            db_dive.name = generate_dive_name(dive_site.name, dive.dive_date)
        else:
            db_dive.name = dive.name
        
        db.add(db_dive)
        db.commit()
        db.refresh(db_dive)
        
        log_dive_operation("create", db_dive.id, current_user.id)
        
        return db_dive
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("create_dive", e, current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create dive"
        )


@router.get("/count")
def get_dives_count(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    my_dives: Optional[bool] = Query(None, description="Filter to show only current user's dives"),
    dive_site_id: Optional[int] = Query(None),
    min_depth: Optional[float] = Query(None),
    max_depth: Optional[float] = Query(None),
    min_rating: Optional[int] = Query(None),
    max_rating: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    tag_ids: Optional[List[int]] = Query(None),
    difficulty_level: Optional[int] = Query(None),
    suit_type: Optional[str] = Query(None),
    min_visibility: Optional[float] = Query(None),
    max_visibility: Optional[float] = Query(None)
):
    """Get count of dives with optional filtering"""
    try:
        query = db.query(Dive)
        
        # Apply filters
        if user_id:
            query = query.filter(Dive.user_id == user_id)
        elif my_dives and current_user:
            query = query.filter(Dive.user_id == current_user.id)
        elif not current_user:
            query = query.filter(Dive.is_private == False)
        
        if dive_site_id:
            query = query.filter(Dive.dive_site_id == dive_site_id)
        
        if min_depth is not None:
            query = query.filter(Dive.depth >= min_depth)
        if max_depth is not None:
            query = query.filter(Dive.depth <= max_depth)
        
        if min_rating is not None:
            query = query.filter(Dive.rating >= min_rating)
        if max_rating is not None:
            query = query.filter(Dive.rating <= max_rating)
        
        if start_date:
            query = query.filter(Dive.dive_date >= start_date)
        if end_date:
            query = query.filter(Dive.dive_date <= end_date)
        
        if search:
            query = query.join(DiveSite).filter(
                DiveSite.name.ilike(f"%{search}%")
            )
        
        if tag_ids:
            query = query.join(Dive.tags).filter(
                DiveTag.tag_id.in_(tag_ids)
            )
        
        if difficulty_level:
            query = query.join(DiveSite).filter(
                DiveSite.difficulty_level == difficulty_level
            )
        
        if suit_type:
            query = query.filter(Dive.suit_type == suit_type)
        
        if min_visibility is not None:
            query = query.filter(Dive.visibility >= min_visibility)
        if max_visibility is not None:
            query = query.filter(Dive.visibility <= max_visibility)
        
        count = query.count()
        return {"count": count}
        
    except Exception as e:
        log_error("get_dives_count", e, current_user.id if current_user else None)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dive count"
        )


@router.get("/", response_model=List[DiveResponse])
def get_dives(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    my_dives: Optional[bool] = Query(None, description="Filter to show only current user's dives"),
    dive_site_id: Optional[int] = Query(None),
    min_depth: Optional[float] = Query(None),
    max_depth: Optional[float] = Query(None),
    min_rating: Optional[int] = Query(None),
    max_rating: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    tag_ids: Optional[List[int]] = Query(None),
    difficulty_level: Optional[int] = Query(None),
    suit_type: Optional[str] = Query(None),
    min_visibility: Optional[float] = Query(None),
    max_visibility: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("dive_date", description="Sort by field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)")
):
    """Get list of dives with optional filtering and pagination"""
    try:
        query = db.query(Dive)
        
        # Apply filters (same as get_dives_count)
        if user_id:
            query = query.filter(Dive.user_id == user_id)
        elif my_dives and current_user:
            query = query.filter(Dive.user_id == current_user.id)
        elif not current_user:
            query = query.filter(Dive.is_private == False)
        
        if dive_site_id:
            query = query.filter(Dive.dive_site_id == dive_site_id)
        
        if min_depth is not None:
            query = query.filter(Dive.depth >= min_depth)
        if max_depth is not None:
            query = query.filter(Dive.depth <= max_depth)
        
        if min_rating is not None:
            query = query.filter(Dive.rating >= min_rating)
        if max_rating is not None:
            query = query.filter(Dive.rating <= max_rating)
        
        if start_date:
            query = query.filter(Dive.dive_date >= start_date)
        if end_date:
            query = query.filter(Dive.dive_date <= end_date)
        
        if search:
            query = query.join(DiveSite).filter(
                DiveSite.name.ilike(f"%{search}%")
            )
        
        if tag_ids:
            query = query.join(Dive.tags).filter(
                DiveTag.tag_id.in_(tag_ids)
            )
        
        if difficulty_level:
            query = query.join(DiveSite).filter(
                DiveSite.difficulty_level == difficulty_level
            )
        
        if suit_type:
            query = query.filter(Dive.suit_type == suit_type)
        
        if min_visibility is not None:
            query = query.filter(Dive.visibility >= min_visibility)
        if max_visibility is not None:
            query = query.filter(Dive.visibility <= max_visibility)
        
        # Apply sorting
        if sort_by == "dive_date":
            if sort_order == "asc":
                query = query.order_by(Dive.dive_date.asc())
            else:
                query = query.order_by(Dive.dive_date.desc())
        elif sort_by == "depth":
            if sort_order == "asc":
                query = query.order_by(Dive.depth.asc())
            else:
                query = query.order_by(Dive.depth.desc())
        elif sort_by == "rating":
            if sort_order == "asc":
                query = query.order_by(Dive.rating.asc())
            else:
                query = query.order_by(Dive.rating.desc())
        else:
            query = query.order_by(Dive.dive_date.desc())
        
        # Apply pagination
        offset = (page - 1) * page_size
        dives = query.offset(offset).limit(page_size).all()
        
        return dives
        
    except Exception as e:
        log_error("get_dives", e, current_user.id if current_user else None)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dives"
        )


@router.get("/{dive_id}", response_model=DiveResponse)
def get_dive(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a specific dive by ID"""
    try:
        dive = get_dive_with_relations(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        # Check if user can access this dive
        if dive.is_private and (not current_user or dive.user_id != current_user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dive not found"
            )
        
        return dive
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("get_dive", e, current_user.id if current_user else None, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dive"
        )


@router.get("/{dive_id}/details", response_model=dict)
def get_dive_details(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get detailed information about a dive including related data"""
    try:
        dive = get_dive_with_relations(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        # Check if user can access this dive
        if dive.is_private and (not current_user or dive.user_id != current_user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dive not found"
            )
        
        # Build detailed response
        details = {
            "dive": dive,
            "dive_site": dive.dive_site,
            "tags": [tag for tag in dive.tags] if dive.tags else [],
            "media": [media for media in dive.media] if dive.media else [],
            "user": {
                "id": dive.user_id,
                "username": current_user.username if current_user and dive.user_id == current_user.id else None
            }
        }
        
        return details
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("get_dive_details", e, current_user.id if current_user else None, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dive details"
        )


@router.put("/{dive_id}", response_model=DiveResponse)
def update_dive(
    dive_id: int,
    dive_update: DiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a dive log entry"""
    try:
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        # Check if user can update this dive
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this dive"
            )
        
        # Update dive fields
        update_data = dive_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(dive, field, value)
        
        # Generate dive name if dive site or date changed
        if "dive_site_id" in update_data or "dive_date" in update_data:
            dive_site = get_dive_site_by_id(db, dive.dive_site_id)
            if dive_site:
                dive.name = generate_dive_name(dive_site.name, dive.dive_date)
        
        db.commit()
        db.refresh(dive)
        
        log_dive_operation("update", dive_id, current_user.id)
        
        return dive
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("update_dive", e, current_user.id, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update dive"
        )


@router.delete("/{dive_id}")
def delete_dive(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a dive log entry"""
    try:
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        # Check if user can delete this dive
        if dive.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this dive"
            )
        
        db.delete(dive)
        db.commit()
        
        log_dive_operation("delete", dive_id, current_user.id)
        
        return {"message": "Dive deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("delete_dive", e, current_user.id, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete dive"
        )
