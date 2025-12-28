"""
Admin operations for dives.

This module contains administrative functions for dive management:
- get_all_dives_count_admin: Get total count of all dives (admin only)
- get_all_dives_admin: Get all dives with admin privileges
- update_dive_admin: Update any dive with admin privileges
- delete_dive_admin: Delete any dive with admin privileges
- get_dive_admin: Get dive details with admin privileges

All functions in this module require admin authentication and provide
full access to all dives regardless of ownership.
"""

from fastapi import Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import date, time, datetime
import json
import os
import tempfile
import uuid

from .dives_shared import router, get_db, get_current_user, get_current_admin_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage
from app.schemas import DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse, DiveTagResponse
from app.models import DiveSite, DiveSiteAlias, DivingCenter, DifficultyLevel, get_difficulty_id_by_code
from app.services.dive_profile_parser import DiveProfileParser
from .dives_validation import raise_validation_error
from .dives_logging import log_dive_operation, log_error


@router.get("/admin/dives/count")
def get_all_dives_count_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    search: Optional[str] = Query(None, description="Unified search across dive name, user username, dive site name, and dive information"),
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    exclude_unspecified_difficulty: bool = Query(False, description="Exclude dives with unspecified difficulty"),
    suit_type: Optional[str] = Query(None, pattern=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[float] = Query(None, ge=1, le=10),
    max_rating: Optional[float] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
):
    """Get total count of dives with admin privileges."""
    # Build query - admin can see all dives
    # Eager load difficulty relationship for efficient access
    query = db.query(Dive).options(joinedload(Dive.difficulty)).join(User, Dive.user_id == User.id)

    # Filter by user if specified
    if user_id:
        query = query.filter(Dive.user_id == user_id)

    # Apply filters
    if dive_site_id:
        query = query.filter(Dive.dive_site_id == dive_site_id)

    if dive_site_name:
        # Join with DiveSite table to filter by dive site name
        query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        # Use ILIKE for case-insensitive partial matching
        sanitized_name = dive_site_name.strip()
        # Search in both dive site names and aliases
        query = query.filter(
            or_(
                DiveSite.name.ilike(f"%{sanitized_name}%"),
                DiveSite.id.in_(
                    db.query(DiveSiteAlias.dive_site_id).filter(
                        DiveSiteAlias.alias.ilike(f"%{sanitized_name}%")
                    )
                )
            )
        )

    # Apply unified search across multiple fields (case-insensitive)
    if search:
        # Sanitize search input to prevent injection
        sanitized_search = search.strip()[:200]
        
        # Ensure DiveSite is joined (it might already be joined if dive_site_name filter is used)
        dive_site_joined = dive_site_name is not None
        if not dive_site_joined:
            query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        
        # Search across dive name, user username, dive site name, and dive information
        query = query.filter(
            or_(
                Dive.name.ilike(f"%{sanitized_search}%"),
                User.username.ilike(f"%{sanitized_search}%"),
                DiveSite.name.ilike(f"%{sanitized_search}%"),
                Dive.dive_information.ilike(f"%{sanitized_search}%")
            )
        )

    if difficulty_code:
        difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
        if difficulty_id:
            query = query.filter(Dive.difficulty_id == difficulty_id)
        elif exclude_unspecified_difficulty:
            query = query.filter(False)
    elif exclude_unspecified_difficulty:
        query = query.filter(Dive.difficulty_id.isnot(None))

    if suit_type:
        query = query.filter(Dive.suit_type == suit_type)

    if min_depth is not None:
        query = query.filter(Dive.max_depth >= min_depth)

    if max_depth is not None:
        query = query.filter(Dive.max_depth <= max_depth)

    if min_visibility is not None:
        query = query.filter(Dive.visibility_rating >= min_visibility)

    if max_visibility is not None:
        query = query.filter(Dive.visibility_rating <= max_visibility)

    if min_rating is not None:
        query = query.filter(Dive.user_rating >= min_rating)

    if max_rating is not None:
        query = query.filter(Dive.user_rating <= max_rating)

    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Dive.dive_date >= start_date_obj)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format. Use YYYY-MM-DD"
            )

    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Dive.dive_date <= end_date_obj)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format. Use YYYY-MM-DD"
            )

    if tag_ids:
        # Parse comma-separated tag IDs
        tag_id_list = [int(tid.strip()) for tid in tag_ids.split(',') if tid.strip().isdigit()]
        if tag_id_list:
            # Join with DiveTag table to filter by tags
            query = query.join(DiveTag, Dive.id == DiveTag.dive_id)
            query = query.filter(DiveTag.tag_id.in_(tag_id_list))

    # Get total count
    total_count = query.count()

    return {"total": total_count}


@router.get("/admin/dives", response_model=List[DiveResponse])
def get_all_dives_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    search: Optional[str] = Query(None, description="Unified search across dive name, user username, dive site name, and dive information"),
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    exclude_unspecified_difficulty: bool = Query(False, description="Exclude dives with unspecified difficulty"),
    suit_type: Optional[str] = Query(None, pattern=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[float] = Query(None, ge=1, le=10),
    max_rating: Optional[float] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
    sort_by: Optional[str] = Query(None, description="Sort field (id, dive_date, max_depth, duration, user_rating, visibility_rating, view_count, created_at, updated_at)"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc/desc)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get all dives with admin privileges. Can view all dives regardless of privacy settings."""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    # Build query - admin can see all dives
    # Eager load difficulty relationship for efficient access
    query = db.query(Dive).options(joinedload(Dive.difficulty)).join(User, Dive.user_id == User.id)

    # Filter by user if specified
    if user_id:
        query = query.filter(Dive.user_id == user_id)

    # Apply filters
    if dive_site_id:
        query = query.filter(Dive.dive_site_id == dive_site_id)

    if dive_site_name:
        # Join with DiveSite table to filter by dive site name
        query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        # Use ILIKE for case-insensitive partial matching
        sanitized_name = dive_site_name.strip()
        # Search in both dive site names and aliases
        query = query.filter(
            or_(
                DiveSite.name.ilike(f"%{sanitized_name}%"),
                DiveSite.id.in_(
                    db.query(DiveSiteAlias.dive_site_id).filter(
                        DiveSiteAlias.alias.ilike(f"%{sanitized_name}%")
                    )
                )
            )
        )

    # Apply unified search across multiple fields (case-insensitive)
    if search:
        # Sanitize search input to prevent injection
        sanitized_search = search.strip()[:200]
        
        # Ensure DiveSite is joined (it might already be joined if dive_site_name filter is used)
        # Check if DiveSite is already joined by checking if dive_site_name filter was used
        dive_site_joined = dive_site_name is not None
        if not dive_site_joined:
            query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        
        # Search across dive name, user username, dive site name, and dive information
        query = query.filter(
            or_(
                Dive.name.ilike(f"%{sanitized_search}%"),
                User.username.ilike(f"%{sanitized_search}%"),
                DiveSite.name.ilike(f"%{sanitized_search}%"),
                Dive.dive_information.ilike(f"%{sanitized_search}%")
            )
        )

    if difficulty_code:
        difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
        if difficulty_id:
            query = query.filter(Dive.difficulty_id == difficulty_id)
        elif exclude_unspecified_difficulty:
            query = query.filter(False)
    elif exclude_unspecified_difficulty:
        query = query.filter(Dive.difficulty_id.isnot(None))

    if suit_type:
        query = query.filter(Dive.suit_type == suit_type)

    if min_depth is not None:
        query = query.filter(Dive.max_depth >= min_depth)

    if max_depth is not None:
        query = query.filter(Dive.max_depth <= max_depth)

    if min_visibility is not None:
        query = query.filter(Dive.visibility_rating >= min_visibility)

    if max_visibility is not None:
        query = query.filter(Dive.visibility_rating <= max_visibility)

    if min_rating is not None:
        query = query.filter(Dive.user_rating >= min_rating)

    if max_rating is not None:
        query = query.filter(Dive.user_rating <= max_rating)

    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Dive.dive_date >= start_date_obj)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format"
            )

    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Dive.dive_date <= end_date_obj)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format"
            )

    if tag_ids:
        try:
            tag_id_list = [int(tid.strip()) for tid in tag_ids.split(",")]
            # Filter dives that have any of the specified tags
            query = query.join(DiveTag).filter(DiveTag.tag_id.in_(tag_id_list))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tag_ids format"
            )

    # Apply sorting
    if sort_by:
        valid_sort_fields = {
            'id', 'dive_date', 'max_depth', 'duration', 'user_rating',
            'visibility_rating', 'view_count', 'created_at', 'updated_at'
        }
        if sort_by not in valid_sort_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by field. Must be one of: {', '.join(valid_sort_fields)}"
            )

        if sort_order not in ['asc', 'desc']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sort_order must be 'asc' or 'desc'"
            )

        # Map sort fields to database columns
        if sort_by == 'id':
            sort_field = Dive.id
        elif sort_by == 'dive_date':
            sort_field = Dive.dive_date
        elif sort_by == 'max_depth':
            sort_field = Dive.max_depth
        elif sort_by == 'duration':
            sort_field = Dive.duration
        elif sort_by == 'user_rating':
            sort_field = Dive.user_rating
        elif sort_by == 'visibility_rating':
            sort_field = Dive.visibility_rating
        elif sort_by == 'view_count':
            sort_field = Dive.view_count
        elif sort_by == 'created_at':
            sort_field = Dive.created_at
        elif sort_by == 'updated_at':
            sort_field = Dive.updated_at

        if sort_order == 'desc':
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    else:
        # Default sorting by dive date (newest first)
        query = query.order_by(Dive.dive_date.desc(), Dive.dive_time.desc())

    # Get total count before pagination
    total_count = query.count()

    # Apply pagination
    dives = query.offset(offset).limit(limit).all()

    # Convert SQLAlchemy objects to dictionaries to avoid serialization issues
    dive_list = []
    for dive in dives:
        # Get dive site information if available
        dive_site_info = None
        if dive.dive_site_id:
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if dive_site:
                dive_site_info = {
                    "id": dive_site.id,
                    "name": dive_site.name,
                    "description": dive_site.description,
                    "latitude": float(dive_site.latitude) if dive_site.latitude else None,
                    "longitude": float(dive_site.longitude) if dive_site.longitude else None,
                    "country": dive_site.country,
                    "region": dive_site.region
                }

        # Get diving center information if available
        diving_center_info = None
        if dive.diving_center_id:
            diving_center = db.query(DivingCenter).filter(DivingCenter.id == dive.diving_center_id).first()
            if diving_center:
                diving_center_info = {
                    "id": diving_center.id,
                    "name": diving_center.name,
                    "description": diving_center.description,
                    "email": diving_center.email,
                    "phone": diving_center.phone,
                    "website": diving_center.website,
                    "latitude": float(diving_center.latitude) if diving_center.latitude else None,
                    "longitude": float(diving_center.longitude) if diving_center.longitude else None
                }

        # Get tags for this dive
        dive_tags = db.query(AvailableTag).join(DiveTag).filter(DiveTag.dive_id == dive.id).order_by(AvailableTag.name.asc()).all()
        tags_list = [{"id": tag.id, "name": tag.name} for tag in dive_tags]

        dive_dict = {
            "id": dive.id,
            "user_id": dive.user_id,
            "dive_site_id": dive.dive_site_id,
            "diving_center_id": dive.diving_center_id,
            "name": dive.name,
            "is_private": dive.is_private,
            "dive_information": dive.dive_information,
            "max_depth": float(dive.max_depth) if dive.max_depth else None,
            "average_depth": float(dive.average_depth) if dive.average_depth else None,
            "gas_bottles_used": dive.gas_bottles_used,
            "suit_type": dive.suit_type.value if dive.suit_type else None,
            "difficulty_code": dive.difficulty.code if dive.difficulty else None,
            "difficulty_label": dive.difficulty.label if dive.difficulty else None,
            "visibility_rating": dive.visibility_rating,
            "user_rating": dive.user_rating,
            "dive_date": dive.dive_date.strftime("%Y-%m-%d"),
            "dive_time": dive.dive_time.strftime("%H:%M:%S") if dive.dive_time else None,
            "duration": dive.duration,
            "view_count": dive.view_count,
            "created_at": dive.created_at.isoformat() if dive.created_at else None,
            "updated_at": dive.updated_at.isoformat() if dive.updated_at else None,
            "dive_site": dive_site_info,
            "diving_center": diving_center_info,
            "media": [],
            "tags": tags_list,
            "user_username": dive.user.username
        }
        dive_list.append(dive_dict)

    # Calculate pagination info
    total_pages = (total_count + limit - 1) // limit
    has_next_page = offset + limit < total_count
    has_prev_page = offset > 0

    # Return response with pagination headers
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=dive_list)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str((offset // limit) + 1)
    response.headers["X-Page-Size"] = str(limit)
    response.headers["X-Has-Next-Page"] = str(has_next_page).lower()
    response.headers["X-Has-Prev-Page"] = str(has_prev_page).lower()

    return response


@router.put("/admin/dives/{dive_id}", response_model=DiveResponse)
def update_dive_admin(
    dive_id: int,
    dive_update: DiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update any dive with admin privileges"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    dive = db.query(Dive).filter(Dive.id == dive_id).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Validate dive site if provided
    if dive_update.dive_site_id:
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_update.dive_site_id).first()
        if not dive_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dive site not found"
            )

    # Validate diving center if provided
    if dive_update.diving_center_id:
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == dive_update.diving_center_id).first()
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )

    # Parse date and time if provided
    if dive_update.dive_date:
        try:
            dive_date = datetime.strptime(dive_update.dive_date, "%Y-%m-%d").date()
            dive.dive_date = dive_date
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD"
            )

    if dive_update.dive_time:
        try:
            dive_time = datetime.strptime(dive_update.dive_time, "%H:%M:%S").time()
            dive.dive_time = dive_time
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time format. Use HH:MM:SS"
            )

    # Update name if provided, or regenerate if dive site changed
    if dive_update.name is not None and dive_update.name.strip():
        dive.name = dive_update.name
    elif dive_update.dive_site_id and dive_update.dive_site_id != dive.dive_site_id:
        # Regenerate name if dive site changed
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_update.dive_site_id).first()
        if dive_site:
            dive.name = generate_dive_name(dive_site.name, dive.dive_date)
    elif dive_update.name is not None and not dive_update.name.strip():
        # If name is explicitly set to empty/whitespace, regenerate it
        if dive.dive_site_id:
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if dive_site:
                dive.name = generate_dive_name(dive_site.name, dive.dive_date)

    # Update other fields
    for field, value in dive_update.dict(exclude_unset=True).items():
        if field not in ['dive_date', 'dive_time', 'name', 'tags']:
            setattr(dive, field, value)

    # Handle tag updates if provided
    if dive_update.tags is not None:
        # Get current tags for this dive
        current_tags = db.query(DiveTag).filter(DiveTag.dive_id == dive_id).all()
        current_tag_ids = [tag.tag_id for tag in current_tags]
        
        # Add new tags
        for tag_id in dive_update.tags:
            if tag_id not in current_tag_ids:
                # Verify tag exists
                available_tag = db.query(AvailableTag).filter(AvailableTag.id == tag_id).first()
                if not available_tag:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Tag with ID {tag_id} not found"
                    )
                
                # Create new dive tag
                new_dive_tag = DiveTag(dive_id=dive_id, tag_id=tag_id)
                db.add(new_dive_tag)
        
        # Remove tags that are no longer selected
        for current_tag in current_tags:
            if current_tag.tag_id not in dive_update.tags:
                db.delete(current_tag)

    dive.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dive)

    # Get dive site information if available
    dive_site_info = None
    if dive.dive_site_id:
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
        if dive_site:
            dive_site_info = {
                "id": dive_site.id,
                "name": dive_site.name,
                "description": dive_site.description,
                "latitude": float(dive_site.latitude) if dive_site.latitude else None,
                "longitude": float(dive_site.longitude) if dive_site.longitude else None,
                "country": dive_site.country,
                "region": dive_site.region
            }

    # Get diving center information if available
    diving_center_info = None
    if dive.diving_center_id:
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == dive.diving_center_id).first()
        if diving_center:
            diving_center_info = {
                "id": diving_center.id,
                "name": diving_center.name,
                "description": diving_center.description,
                "email": diving_center.email,
                "phone": diving_center.phone,
                "website": diving_center.website,
                "latitude": float(diving_center.latitude) if diving_center.latitude else None,
                "longitude": float(diving_center.longitude) if diving_center.longitude else None
            }

    # Get tags for this dive
    dive_tags = db.query(AvailableTag).join(DiveTag).filter(DiveTag.dive_id == dive.id).order_by(AvailableTag.name.asc()).all()
    tags_dict = [
        {
            "id": tag.id,
            "name": tag.name,
            "description": tag.description,
            "created_by": tag.created_by,
            "created_at": tag.created_at.isoformat() if tag.created_at else None
        }
        for tag in dive_tags
    ]

    # Convert SQLAlchemy object to dictionary to avoid serialization issues
    dive_dict = {
        "id": dive.id,
        "user_id": dive.user_id,
        "dive_site_id": dive.dive_site_id,
        "diving_center_id": dive.diving_center_id,
        "name": dive.name,
        "is_private": dive.is_private,
        "dive_information": dive.dive_information,
        "max_depth": float(dive.max_depth) if dive.max_depth else None,
        "average_depth": float(dive.average_depth) if dive.average_depth else None,
        "gas_bottles_used": dive.gas_bottles_used,
        "suit_type": dive.suit_type.value if dive.suit_type else None,
        "difficulty_code": dive.difficulty.code if dive.difficulty else None,
        "difficulty_label": dive.difficulty.label if dive.difficulty else None,
        "visibility_rating": dive.visibility_rating,
        "user_rating": dive.user_rating,
        "dive_date": dive.dive_date.strftime("%Y-%m-%d"),
        "dive_time": dive.dive_time.strftime("%H:%M:%S") if dive.dive_time else None,
        "duration": dive.duration,
        "view_count": dive.view_count,
        "created_at": dive.created_at,
        "updated_at": dive.updated_at,
        "dive_site": dive_site_info,
        "diving_center": diving_center_info,
        "media": [],
        "tags": tags_dict,
        "user_username": dive.user.username
    }

    return dive_dict


@router.delete("/admin/dives/{dive_id}")
def delete_dive_admin(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete any dive with admin privileges"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    dive = db.query(Dive).filter(Dive.id == dive_id).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    db.delete(dive)
    db.commit()

    return {"message": "Dive deleted successfully"}
