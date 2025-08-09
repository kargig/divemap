from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, date
import re
import xml.etree.ElementTree as ET
from io import BytesIO
from difflib import SequenceMatcher

from app.database import get_db
from app.models import Dive, DiveMedia, DiveTag, DiveSite, AvailableTag, User, DivingCenter
from app.schemas import (
    DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse,
    DiveTagCreate, DiveTagResponse, DiveSearchParams
)
from app.auth import get_current_user, get_current_user_optional

router = APIRouter()


def generate_dive_name(dive_site_name: str, dive_date: date) -> str:
    """Generate automatic dive name from dive site and date"""
    return f"{dive_site_name} - {dive_date.strftime('%Y/%m/%d')}"


# Admin endpoints for dive management - must be defined before regular routes
@router.get("/admin/dives/count")
def get_all_dives_count_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    difficulty_level: Optional[str] = Query(None, regex=r"^(beginner|intermediate|advanced|expert)$"),
    suit_type: Optional[str] = Query(None, regex=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[int] = Query(None, ge=1, le=10),
    max_rating: Optional[int] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
):
    """Get total count of dives with admin privileges."""
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
    query = db.query(Dive).join(User, Dive.user_id == User.id)

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
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))

    if difficulty_level:
        query = query.filter(Dive.difficulty_level == difficulty_level)

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

    # Apply tag filtering
    if tag_ids:
        try:
            tag_id_list = [int(tid.strip()) for tid in tag_ids.split(",") if tid.strip()]
            if tag_id_list:
                # Join with DiveTag and AvailableTag tables
                query = query.join(DiveTag, Dive.id == DiveTag.dive_id)
                query = query.join(AvailableTag, DiveTag.tag_id == AvailableTag.id)
                query = query.filter(AvailableTag.id.in_(tag_id_list))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tag_ids format. Use comma-separated integers"
            )

    # Get total count
    total_count = query.count()

    return {"total": total_count}

@router.get("/admin/dives", response_model=List[DiveResponse])
def get_all_dives_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    difficulty_level: Optional[str] = Query(None, regex=r"^(beginner|intermediate|advanced|expert)$"),
    suit_type: Optional[str] = Query(None, regex=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[int] = Query(None, ge=1, le=10),
    max_rating: Optional[int] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
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
    query = db.query(Dive).join(User, Dive.user_id == User.id)

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
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))

    if difficulty_level:
        query = query.filter(Dive.difficulty_level == difficulty_level)

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

    # Order by dive date (newest first)
    query = query.order_by(Dive.dive_date.desc(), Dive.dive_time.desc())

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
                    "address": dive_site.address,
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
            "difficulty_level": dive.difficulty_level.value if dive.difficulty_level else None,
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
            "tags": [],
            "user_username": dive.user.username
        }
        dive_list.append(dive_dict)

    return dive_list


@router.put("/admin/dives/{dive_id}", response_model=DiveResponse)
def update_dive_admin(
    dive_id: int,
    dive_update: DiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
        if field not in ['dive_date', 'dive_time', 'name']:
            setattr(dive, field, value)

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
                "address": dive_site.address,
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
        "difficulty_level": dive.difficulty_level.value if dive.difficulty_level else None,
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
        "tags": [],
        "user_username": dive.user.username
    }

    return dive_dict


@router.delete("/admin/dives/{dive_id}")
def delete_dive_admin(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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


# Regular dive endpoints
@router.post("/", response_model=DiveResponse)
def create_dive(
    dive: DiveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new dive log entry"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Validate dive site if provided
    dive_site = None
    if dive.dive_site_id:
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
        if not dive_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dive site not found"
            )

    # Validate diving center if provided
    diving_center = None
    if dive.diving_center_id:
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == dive.diving_center_id).first()
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )

    # Parse date and time
    try:
        dive_date = datetime.strptime(dive.dive_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD"
        )

    dive_time = None
    if dive.dive_time:
        try:
            dive_time = datetime.strptime(dive.dive_time, "%H:%M:%S").time()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time format. Use HH:MM:SS"
            )

    # Generate automatic name if not provided
    dive_name = dive.name
    if not dive_name:
        if dive_site:
            dive_name = generate_dive_name(dive_site.name, dive_date)
        else:
            # Generate a generic name if no dive site is provided
            dive_name = f"Dive - {dive_date.strftime('%Y/%m/%d')}"

    # Create dive object
    print(f"DEBUG: Creating dive with diving_center_id: {dive.diving_center_id}")
    db_dive = Dive(
        user_id=current_user.id,
        dive_site_id=dive.dive_site_id,
        diving_center_id=dive.diving_center_id,
        name=dive_name,
        is_private=dive.is_private,
        dive_information=dive.dive_information,
        max_depth=dive.max_depth,
        average_depth=dive.average_depth,
        gas_bottles_used=dive.gas_bottles_used,
        suit_type=dive.suit_type,
        difficulty_level=dive.difficulty_level,
        visibility_rating=dive.visibility_rating,
        user_rating=dive.user_rating,
        dive_date=dive_date,
        dive_time=dive_time,
        duration=dive.duration
    )

    db.add(db_dive)
    db.commit()
    db.refresh(db_dive)

    # Get dive site information if available
    dive_site_info = None
    if db_dive.dive_site_id:
        dive_site = db.query(DiveSite).filter(DiveSite.id == db_dive.dive_site_id).first()
        if dive_site:
            dive_site_info = {
                "id": dive_site.id,
                "name": dive_site.name,
                "description": dive_site.description,
                "latitude": float(dive_site.latitude) if dive_site.latitude else None,
                "longitude": float(dive_site.longitude) if dive_site.longitude else None,
                "address": dive_site.address,
                "country": dive_site.country,
                "region": dive_site.region
            }

    # Get diving center information if available
    diving_center_info = None
    if db_dive.diving_center_id:
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == db_dive.diving_center_id).first()
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

    # Convert to dict to avoid SQLAlchemy relationship serialization issues
    dive_dict = {
        "id": db_dive.id,
        "user_id": db_dive.user_id,
        "dive_site_id": db_dive.dive_site_id,
        "diving_center_id": db_dive.diving_center_id,
        "name": db_dive.name,
        "is_private": db_dive.is_private,
        "dive_information": db_dive.dive_information,
        "max_depth": float(db_dive.max_depth) if db_dive.max_depth else None,
        "average_depth": float(db_dive.average_depth) if db_dive.average_depth else None,
        "gas_bottles_used": db_dive.gas_bottles_used,
        "suit_type": db_dive.suit_type.value if db_dive.suit_type else None,
        "difficulty_level": db_dive.difficulty_level.value if db_dive.difficulty_level else None,
        "visibility_rating": db_dive.visibility_rating,
        "user_rating": db_dive.user_rating,
        "dive_date": db_dive.dive_date.strftime("%Y-%m-%d"),
        "dive_time": db_dive.dive_time.strftime("%H:%M:%S") if db_dive.dive_time else None,
        "duration": db_dive.duration,
        "view_count": db_dive.view_count,
        "created_at": db_dive.created_at,
        "updated_at": db_dive.updated_at,
        "dive_site": dive_site_info,
        "diving_center": diving_center_info,
        "media": [],
        "tags": [],
        "user_username": current_user.username
    }

    return dive_dict


@router.get("/count")
def get_dives_count(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    difficulty_level: Optional[str] = Query(None, regex=r"^(beginner|intermediate|advanced|expert)$"),
    suit_type: Optional[str] = Query(None, regex=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[int] = Query(None, ge=1, le=10),
    max_rating: Optional[int] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
):
    """Get total count of dives matching the filters."""
    query = db.query(Dive).join(User, Dive.user_id == User.id)

    # Filter by user if specified
    if user_id:
        query = query.filter(Dive.user_id == user_id)
    elif not current_user or not current_user.is_admin:
        # Non-admin users can only see their own dives and public dives
        query = query.filter(
            or_(
                Dive.user_id == current_user.id if current_user else False,
                Dive.is_private == False
            )
        )

    # Apply filters
    if dive_site_id:
        query = query.filter(Dive.dive_site_id == dive_site_id)

    if dive_site_name:
        # Join with DiveSite table to filter by dive site name
        query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        # Use ILIKE for case-insensitive partial matching
        sanitized_name = dive_site_name.strip()
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))

    if difficulty_level:
        query = query.filter(Dive.difficulty_level == difficulty_level)

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

    # Apply tag filtering
    if tag_ids:
        try:
            tag_id_list = [int(tid.strip()) for tid in tag_ids.split(",") if tid.strip()]
            if tag_id_list:
                # Join with DiveTag and AvailableTag tables
                query = query.join(DiveTag, Dive.id == DiveTag.dive_id)
                query = query.join(AvailableTag, DiveTag.tag_id == AvailableTag.id)
                query = query.filter(AvailableTag.id.in_(tag_id_list))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tag_ids format. Use comma-separated integers"
            )

    # Get total count
    total_count = query.count()

    return {"total": total_count}

@router.get("/", response_model=List[DiveResponse])
def get_dives(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    difficulty_level: Optional[str] = Query(None, regex=r"^(beginner|intermediate|advanced|expert)$"),
    suit_type: Optional[str] = Query(None, regex=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[int] = Query(None, ge=1, le=10),
    max_rating: Optional[int] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, or 100)")
):
    """Get dives with filtering options. Can view own dives and public dives from other users. Unauthenticated users can view public dives."""
    # Validate page_size
    if page_size not in [25, 50, 100]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be one of: 25, 50, 100"
        )

    # Check if user is authenticated and enabled
    if current_user and not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Build query - user can see their own dives and public dives from others
    query = db.query(Dive).join(User, Dive.user_id == User.id)

    # Filter by user if specified, otherwise show own dives and public dives from others
    if user_id:
        if current_user and user_id == current_user.id:
            # Authenticated user viewing their own dives
            query = query.filter(Dive.user_id == user_id)
        else:
            # Unauthenticated user or viewing other user's dives - only show public ones
            query = query.filter(
                and_(
                    Dive.user_id == user_id,
                    Dive.is_private == False
                )
            )
    else:
        if current_user:
            # Authenticated user - show own dives and public dives from others
            query = query.filter(
                or_(
                    Dive.user_id == current_user.id,
                    and_(Dive.user_id != current_user.id, Dive.is_private == False)
                )
            )
        else:
            # Unauthenticated user - only show public dives
            query = query.filter(Dive.is_private == False)

    # Apply filters
    if dive_site_id:
        query = query.filter(Dive.dive_site_id == dive_site_id)

    # Filter by dive site name (partial match)
    if dive_site_name:
        # Join with DiveSite table to filter by dive site name
        query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        # Use ILIKE for case-insensitive partial matching
        sanitized_name = dive_site_name.strip()
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))

    if difficulty_level:
        query = query.filter(Dive.difficulty_level == difficulty_level)

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

    # Get total count for pagination headers
    total_count = query.count()

    # Apply alphabetical sorting by dive name (case-insensitive)
    query = query.order_by(func.lower(Dive.name).asc())

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size
    has_next_page = page < total_pages
    has_prev_page = page > 1

    # Apply pagination
    dives = query.offset(offset).limit(page_size).all()

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
                    "address": dive_site.address,
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
            "difficulty_level": dive.difficulty_level.value if dive.difficulty_level else None,
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

    # Return response with pagination headers
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=dive_list)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Has-Next-Page"] = str(has_next_page).lower()
    response.headers["X-Has-Prev-Page"] = str(has_prev_page).lower()

    return response


@router.get("/{dive_id}", response_model=DiveResponse)
def get_dive(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a specific dive by ID. Can view own dives and public dives from other users. Unauthenticated users can view public dives."""
    # Check if user is authenticated and enabled
    if current_user and not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Query dive with user information
    dive = db.query(Dive).join(User, Dive.user_id == User.id).filter(Dive.id == dive_id).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Check access permissions
    if current_user:
        # Authenticated user - can see own dives and public dives from others
        if dive.user_id != current_user.id and dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )
    else:
        # Unauthenticated user - can only see public dives
        if dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )

    # Increment view count (only for public dives or when viewing own dives)
    if not dive.is_private or (current_user and dive.user_id == current_user.id):
        dive.view_count += 1
        db.commit()

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
                "address": dive_site.address,
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
        "difficulty_level": dive.difficulty_level.value if dive.difficulty_level else None,
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
        "tags": [],
        "user_username": dive.user.username
    }

    return dive_dict


@router.get("/{dive_id}/details", response_model=dict)
def get_dive_details(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get detailed dive information including location and minimap data. Unauthenticated users can view public dives."""
    # Check if user is authenticated and enabled
    if current_user and not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Query dive with user and dive site information
    dive = db.query(Dive).join(User, Dive.user_id == User.id).join(
        DiveSite, Dive.dive_site_id == DiveSite.id, isouter=True
    ).filter(Dive.id == dive_id).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Check access permissions
    if current_user:
        # Authenticated user - can see own dives and public dives from others
        if dive.user_id != current_user.id and dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )
    else:
        # Unauthenticated user - can only see public dives
        if dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )

    # Increment view count (only for public dives or when viewing own dives)
    if not dive.is_private or (current_user and dive.user_id == current_user.id):
        dive.view_count += 1
        db.commit()

    # Get dive site information if available
    dive_site_info = None
    if dive.dive_site:
        dive_site_info = {
            "id": dive.dive_site.id,
            "name": dive.dive_site.name,
            "description": dive.dive_site.description,
            "latitude": float(dive.dive_site.latitude) if dive.dive_site.latitude else None,
            "longitude": float(dive.dive_site.longitude) if dive.dive_site.longitude else None,
            "address": dive.dive_site.address,
            "country": dive.dive_site.country,
            "region": dive.dive_site.region,
            "difficulty_level": dive.dive_site.difficulty_level.value if dive.dive_site.difficulty_level else None,
            "max_depth": float(dive.dive_site.max_depth) if dive.dive_site.max_depth else None,
            "marine_life": dive.dive_site.marine_life,
            "safety_information": dive.dive_site.safety_information,
            "access_instructions": dive.dive_site.access_instructions
        }

    # Get dive media
    media = db.query(DiveMedia).filter(DiveMedia.dive_id == dive_id).all()
    media_list = []
    for m in media:
        media_list.append({
            "id": m.id,
            "media_type": m.media_type.value,
            "url": m.url,
            "description": m.description,
            "title": m.title,
            "thumbnail_url": m.thumbnail_url,
            "created_at": m.created_at
        })

    # Get dive tags
    tags = db.query(AvailableTag).join(DiveTag, AvailableTag.id == DiveTag.tag_id).filter(
        DiveTag.dive_id == dive_id
    ).order_by(AvailableTag.name.asc()).all()
    tags_list = []
    for t in tags:
        tags_list.append({
            "id": t.id,
            "name": t.name,
            "description": t.description
        })

    # Build response
    dive_details = {
        "id": dive.id,
        "user_id": dive.user_id,
        "user_username": dive.user.username,
        "dive_site_id": dive.dive_site_id,
        "name": dive.name,
        "is_private": dive.is_private,
        "dive_information": dive.dive_information,
        "max_depth": float(dive.max_depth) if dive.max_depth else None,
        "average_depth": float(dive.average_depth) if dive.average_depth else None,
        "gas_bottles_used": dive.gas_bottles_used,
        "suit_type": dive.suit_type.value if dive.suit_type else None,
        "difficulty_level": dive.difficulty_level.value if dive.difficulty_level else None,
        "visibility_rating": dive.visibility_rating,
        "user_rating": dive.user_rating,
        "dive_date": dive.dive_date.strftime("%Y-%m-%d"),
        "dive_time": dive.dive_time.strftime("%H:%M:%S") if dive.dive_time else None,
        "duration": dive.duration,
        "view_count": dive.view_count,
        "created_at": dive.created_at,
        "updated_at": dive.updated_at,
        "dive_site": dive_site_info,
        "media": media_list,
        "tags": tags_list
    }

    return dive_details


@router.put("/{dive_id}", response_model=DiveResponse)
def update_dive(
    dive_id: int,
    dive_update: DiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a dive log entry"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

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
        if field not in ['dive_date', 'dive_time', 'name']:
            setattr(dive, field, value)

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
                "address": dive_site.address,
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
        "difficulty_level": dive.difficulty_level.value if dive.difficulty_level else None,
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
        "tags": [],
        "user_username": current_user.username
    }

    return dive_dict


@router.delete("/{dive_id}")
def delete_dive(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a dive log entry"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    db.delete(dive)
    db.commit()

    return {"message": "Dive deleted successfully"}





# Dive Media endpoints
@router.post("/{dive_id}/media", response_model=DiveMediaResponse)
def add_dive_media(
    dive_id: int,
    media: DiveMediaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add media to a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    db_media = DiveMedia(
        dive_id=dive_id,
        media_type=media.media_type,
        url=media.url,
        description=media.description,
        title=media.title,
        thumbnail_url=media.thumbnail_url
    )

    db.add(db_media)
    db.commit()
    db.refresh(db_media)

    return db_media


@router.get("/{dive_id}/media", response_model=List[DiveMediaResponse])
def get_dive_media(
    dive_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get all media for a dive. Unauthenticated users can view media for public dives."""
    # Check if user is authenticated and enabled
    if current_user and not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and check access permissions
    dive = db.query(Dive).filter(Dive.id == dive_id).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Check access permissions
    if current_user:
        # Authenticated user - can see own dives and public dives from others
        if dive.user_id != current_user.id and dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )
    else:
        # Unauthenticated user - can only see public dives
        if dive.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This dive is private"
            )

    media = db.query(DiveMedia).filter(DiveMedia.dive_id == dive_id).all()
    return media


@router.delete("/{dive_id}/media/{media_id}")
def delete_dive_media(
    dive_id: int,
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete media from a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Verify media exists and belongs to the dive
    media = db.query(DiveMedia).filter(
        DiveMedia.id == media_id,
        DiveMedia.dive_id == dive_id
    ).first()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )

    db.delete(media)
    db.commit()

    return {"message": "Media deleted successfully"}


# Dive Tags endpoints
@router.post("/{dive_id}/tags", response_model=DiveTagResponse)
def add_dive_tag(
    dive_id: int,
    tag: DiveTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a tag to a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Verify tag exists
    available_tag = db.query(AvailableTag).filter(AvailableTag.id == tag.tag_id).first()
    if not available_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    # Check if tag is already added to this dive
    existing_tag = db.query(DiveTag).filter(
        DiveTag.dive_id == dive_id,
        DiveTag.tag_id == tag.tag_id
    ).first()

    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag already added to this dive"
        )

    db_tag = DiveTag(
        dive_id=dive_id,
        tag_id=tag.tag_id
    )

    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)

    return db_tag


@router.delete("/{dive_id}/tags/{tag_id}")
def remove_dive_tag(
    dive_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a tag from a dive"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Verify dive exists and belongs to user
    dive = db.query(Dive).filter(
        Dive.id == dive_id,
        Dive.user_id == current_user.id
    ).first()

    if not dive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive not found"
        )

    # Find and delete the tag association
    dive_tag = db.query(DiveTag).filter(
        DiveTag.dive_id == dive_id,
        DiveTag.tag_id == tag_id
    ).first()

    if not dive_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found on this dive"
        )

    db.delete(dive_tag)
    db.commit()

    return {"message": "Tag removed from dive successfully"}


@router.post("/import/subsurface-xml")
async def import_subsurface_xml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import dives from Subsurface XML file.
    Returns parsed dive data for user review before import.
    """
    if not file.filename.lower().endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an XML file"
        )
    
    try:
        # Read and parse XML file
        content = await file.read()
        root = ET.fromstring(content.decode('utf-8'))
        
        # Extract dive sites
        dive_sites = {}
        for site_elem in root.findall('.//divesites/site'):
            site_id = site_elem.get('uuid')
            site_name = site_elem.get('name')
            gps = site_elem.get('gps')
            
            if site_id and site_name:
                dive_sites[site_id] = {
                    'name': site_name,
                    'gps': gps
                }
        
        # Extract dives
        parsed_dives = []
        for dive_elem in root.findall('.//dives/dive'):
            dive_data = parse_dive_element(dive_elem, dive_sites, db)
            if dive_data:
                parsed_dives.append(dive_data)
        
        if not parsed_dives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid dives found in XML file"
            )
        
        # Get all available dive sites for selection
        available_dive_sites = db.query(DiveSite).all()
        dive_sites_for_selection = [
            {
                "id": site.id,
                "name": site.name,
                "country": site.country,
                "region": site.region
            }
            for site in available_dive_sites
        ]
        
        return {
            "message": f"Successfully parsed {len(parsed_dives)} dives",
            "dives": parsed_dives,
            "total_count": len(parsed_dives),
            "available_dive_sites": dive_sites_for_selection
        }
        
    except ET.ParseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid XML format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing XML file: {str(e)}"
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
            
            # Create dive
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
                difficulty_level=dive_data.get('difficulty_level', 'intermediate'),
                visibility_rating=dive_data.get('visibility_rating'),
                user_rating=dive_data.get('user_rating'),
                dive_date=dive_data['dive_date'],
                dive_time=dive_data.get('dive_time'),
                duration=dive_data.get('duration')
            )
            
            # Create the dive
            dive = Dive(
                user_id=current_user.id,
                **dive_create.dict(exclude_unset=True)
            )
            
            # Generate name if not provided
            if not dive.name:
                if dive.dive_site_id:
                    dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                    if dive_site:
                        # Convert string date to date object for generate_dive_name
                        dive_date_obj = datetime.strptime(dive.dive_date, '%Y-%m-%d').date()
                        dive.name = generate_dive_name(dive_site.name, dive_date_obj)
                else:
                    dive.name = f"Dive - {dive.dive_date}"
            
            db.add(dive)
            db.flush()  # Get the dive ID
            
            # Get dive site name for response
            dive_site_name = None
            if dive.dive_site_id:
                dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
                if dive_site:
                    dive_site_name = dive_site.name
            
            imported_dives.append({
                "id": dive.id,
                "name": dive.name,
                "dive_date": dive.dive_date,
                "dive_site_name": dive_site_name
            })
            
        except Exception as e:
            errors.append(f"Dive {i+1}: {str(e)}")
    
    if errors:
        # Rollback any successful imports if there are errors
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import failed: {'; '.join(errors)}"
        )
    
    # Commit all imports
    db.commit()
    
    return {
        "message": f"Successfully imported {len(imported_dives)} dives",
        "imported_dives": imported_dives
    }


def parse_dive_element(dive_elem, dive_sites, db):
    """Parse individual dive element from XML"""
    try:
        # Extract basic dive information
        dive_number = dive_elem.get('number')
        rating = dive_elem.get('rating')
        visibility = dive_elem.get('visibility')
        sac = dive_elem.get('sac')
        otu = dive_elem.get('otu')
        cns = dive_elem.get('cns')
        tags = dive_elem.get('tags')
        divesiteid = dive_elem.get('divesiteid')
        dive_date = dive_elem.get('date')
        dive_time = dive_elem.get('time')
        duration = dive_elem.get('duration')
        
        # Parse buddy information
        buddy_elem = dive_elem.find('buddy')
        buddy = buddy_elem.text if buddy_elem is not None else None
        
        # Parse suit information
        suit_elem = dive_elem.find('suit')
        suit = suit_elem.text if suit_elem is not None else None
        
        # Parse cylinders
        cylinders = []
        for cylinder_elem in dive_elem.findall('cylinder'):
            cylinder_data = parse_cylinder(cylinder_elem)
            cylinders.append(cylinder_data)
        
        # Parse weight systems
        weights = []
        for weights_elem in dive_elem.findall('weightsystem'):
            weights_data = parse_weightsystem(weights_elem)
            weights.append(weights_data)
        
        # Parse dive computer
        computer_data = None
        computer_elem = dive_elem.find('divecomputer')
        if computer_elem is not None:
            computer_data = parse_divecomputer(computer_elem)
        
        # Convert to Divemap format
        divemap_dive = convert_to_divemap_format(
            dive_number, rating, visibility, sac, otu, cns, tags,
            divesiteid, dive_date, dive_time, duration,
            buddy, suit, cylinders, weights, computer_data,
            dive_sites, db
        )
        
        return divemap_dive
        
    except Exception as e:
        print(f"Error parsing dive element: {e}")
        return None


def parse_cylinder(cylinder_elem):
    """Parse cylinder information from XML element"""
    cylinder_data = {}
    
    # Extract cylinder attributes
    cylinder_data['size'] = cylinder_elem.get('size')
    cylinder_data['workpressure'] = cylinder_elem.get('workpressure')
    cylinder_data['description'] = cylinder_elem.get('description')
    cylinder_data['o2'] = cylinder_elem.get('o2')
    cylinder_data['start'] = cylinder_elem.get('start')
    cylinder_data['end'] = cylinder_elem.get('end')
    cylinder_data['depth'] = cylinder_elem.get('depth')
    
    return cylinder_data


def parse_weightsystem(weights_elem):
    """Parse weight system information from XML element"""
    weights_data = {}
    
    # Extract weight system attributes
    weights_data['weight'] = weights_elem.get('weight')
    weights_data['description'] = weights_elem.get('description')
    
    return weights_data


def parse_divecomputer(computer_elem):
    """Parse dive computer information from XML element"""
    computer_data = {}
    
    # Extract basic computer info
    computer_data['model'] = computer_elem.get('model')
    computer_data['deviceid'] = computer_elem.get('deviceid')
    computer_data['diveid'] = computer_elem.get('diveid')
    
    # Parse depth information
    depth_elem = computer_elem.find('depth')
    if depth_elem is not None:
        computer_data['max_depth'] = depth_elem.get('max')
        computer_data['mean_depth'] = depth_elem.get('mean')
    
    # Parse temperature information
    temp_elem = computer_elem.find('temperature')
    if temp_elem is not None:
        computer_data['water_temp'] = temp_elem.get('water')
    
    # Parse surface pressure
    surface_pressure_elem = computer_elem.find('surface pressure')
    if surface_pressure_elem is not None:
        computer_data['surface_pressure'] = surface_pressure_elem.get('surface pressure')
    
    # Parse water salinity
    salinity_elem = computer_elem.find('water salinity')
    if salinity_elem is not None:
        computer_data['water_salinity'] = salinity_elem.get('water salinity')
    
    # Parse extradata - only keep "Deco model"
    extradata_list = []
    for extradata_elem in computer_elem.findall('extradata'):
        key = extradata_elem.get('key')
        value = extradata_elem.get('value')
        if key == 'Deco model':
            extradata_list.append({'key': key, 'value': value})
    
    computer_data['extradata'] = extradata_list
    
    return computer_data


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


def parse_duration(duration_str):
    """Convert Subsurface duration format to minutes"""
    try:
        # Remove "min" and trim
        duration_str = duration_str.replace("min", "").strip()

        if ":" in duration_str:
            # Format: "42:30" (minutes:seconds)
            parts = duration_str.split(":")
            if len(parts) == 2:
                minutes = int(parts[0])
                seconds = int(parts[1])
                # Convert to total minutes (rounding up for partial minutes)
                total_minutes = minutes + (seconds / 60)
                return int(total_minutes)
            else:
                print(f"Invalid duration format: {duration_str}")
                return None
        else:
            # Format: "45" (just minutes)
            return int(duration_str)

    except (ValueError, AttributeError) as e:
        print(f"Error parsing duration '{duration_str}': {e}")
        return None


def parse_rating(rating):
    """Convert Subsurface rating (1-5) to Divemap rating (1-10)"""
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        print(f"Invalid rating value: {rating}, defaulting to 5")
        rating = 5
    
    # Convert 1-5 scale to 1-10 scale
    return rating * 2


def parse_suit_type(suit_str):
    """Parse suit type from Subsurface format"""
    if not suit_str:
        return None
        
    suit_mapping = {
        "wet": "wet_suit",
        "dry": "dry_suit",
        "shortie": "shortie",
        "aqualung": "wet_suit",
        "drysuit": "dry_suit",
        "shorty": "shortie",
        "wetsuit": "wet_suit",
        "wet suit": "wet_suit",
        "rofos": "dry_suit"
    }
    
    suit_lower = suit_str.lower()
    
    # Check for exact matches first
    for key, value in suit_mapping.items():
        if key in suit_lower:
            return value
    
    # If no match found, return None
    print(f"Unknown suit type: {suit_str}")
    return None


def convert_to_divemap_format(dive_number, rating, visibility, sac, otu, cns, tags,
                             divesiteid, dive_date, dive_time, duration,
                             buddy, suit, cylinders, weights, computer_data,
                             dive_sites, db):
    """Convert Subsurface dive data to Divemap format"""
    
    # Parse date and time
    parsed_date = None
    parsed_time = None
    
    if dive_date:
        try:
            parsed_date = datetime.strptime(dive_date, '%Y-%m-%d').date()
        except ValueError:
            print(f"Invalid date format: {dive_date}")
    
    if dive_time:
        try:
            parsed_time = datetime.strptime(dive_time, '%H:%M:%S').time()
        except ValueError:
            print(f"Invalid time format: {dive_time}")
    
    # Parse duration
    parsed_duration = None
    if duration:
        parsed_duration = parse_duration(duration)
    
    # Parse suit type
    parsed_suit_type = None
    if suit:
        parsed_suit_type = parse_suit_type(suit)
    
    # Parse ratings
    parsed_rating = None
    if rating:
        try:
            parsed_rating = parse_rating(int(rating))
        except ValueError:
            print(f"Invalid rating: {rating}")
    
    parsed_visibility = None
    if visibility:
        try:
            parsed_visibility = parse_rating(int(visibility))
        except ValueError:
            print(f"Invalid visibility rating: {visibility}")
    
    # Build dive information text
    dive_info_parts = []
    
    if buddy:
        dive_info_parts.append(f"Buddy: {buddy}")
    
    if sac:
        dive_info_parts.append(f"SAC: {sac}")
    
    if otu:
        dive_info_parts.append(f"OTU: {otu}")
    
    if cns:
        dive_info_parts.append(f"CNS: {cns}")
    
    if computer_data:
        if computer_data.get('max_depth'):
            dive_info_parts.append(f"Max Depth: {computer_data['max_depth']}")
        if computer_data.get('mean_depth'):
            dive_info_parts.append(f"Avg Depth: {computer_data['mean_depth']}")
        if computer_data.get('water_temp'):
            dive_info_parts.append(f"Water Temp: {computer_data['water_temp']}")
        if computer_data.get('surface_pressure'):
            dive_info_parts.append(f"Surface Pressure: {computer_data['surface_pressure']}")
        if computer_data.get('water_salinity'):
            dive_info_parts.append(f"Salinity: {computer_data['water_salinity']}")
        
        # Add deco model from extradata
        for extradata in computer_data.get('extradata', []):
            if extradata['key'] == 'Deco model':
                dive_info_parts.append(f"Deco Model: {extradata['value']}")
    
    # Add weight system information
    for weight in weights:
        weight_info = []
        if weight.get('weight'):
            weight_info.append(weight['weight'])
        if weight.get('description'):
            weight_info.append(weight['description'])
        if weight_info:
            dive_info_parts.append(f"Weights: {' '.join(weight_info)}")
    
    dive_information = "\n".join(dive_info_parts) if dive_info_parts else None
    
    # Build gas bottles information
    gas_bottles_parts = []
    for cylinder in cylinders:
        cylinder_info = []
        
        # Format: size + workpressure (e.g., "15.0l 232 bar")
        size = cylinder.get('size', '').replace(' l', 'l')  # Remove space before 'l'
        workpressure = cylinder.get('workpressure', '')
        
        if size and workpressure:
            # Extract numeric value from workpressure (e.g., "232.0 bar" -> "232")
            wp_value = workpressure.replace(' bar', '').strip()
            try:
                wp_float = float(wp_value)
                if wp_float.is_integer():
                    wp_value = str(int(wp_float))
                else:
                    wp_value = str(wp_float)
            except ValueError:
                wp_value = workpressure
            
            cylinder_info.append(f"{size} {wp_value} bar")
        elif size:
            cylinder_info.append(size)
        
        # Add O2 percentage
        if cylinder.get('o2'):
            cylinder_info.append(f"O2: {cylinder['o2']}")
        
        # Add pressure range
        if cylinder.get('start') and cylinder.get('end'):
            start_pressure = cylinder['start'].replace(' bar', '').strip()
            end_pressure = cylinder['end'].replace(' bar', '').strip()
            cylinder_info.append(f"{start_pressure} bar→{end_pressure} bar")
        
        if cylinder_info:
            gas_bottles_parts.append(" | ".join(cylinder_info))
    
    gas_bottles_used = "\n".join(gas_bottles_parts) if gas_bottles_parts else None
    
    # Find dive site
    dive_site_id = None
    unmatched_dive_site = None
    proposed_dive_sites = None
    if divesiteid and divesiteid in dive_sites:
        site_data = dive_sites[divesiteid]
        match_result = find_dive_site_by_import_id(divesiteid, db, site_data['name'])
        if match_result:
            if isinstance(match_result, dict):
                dive_site_id = match_result['id']
                if match_result['match_type'] == 'similarity':
                    proposed_dive_sites = match_result['proposed_sites']
            else:
                # Backward compatibility for old format
                dive_site_id = match_result
        else:
            # Store information about unmatched dive site
            unmatched_dive_site = {
                'import_id': divesiteid,
                'name': site_data['name'],
                'gps': site_data.get('gps')
            }
            print(f"Dive site not found: {site_data['name']} (ID: {divesiteid})")
    
    # Build Divemap dive data
    divemap_dive = {
        'dive_site_id': dive_site_id,
        'name': f"Dive #{dive_number}" if dive_number else None,
        'is_private': False,
        'dive_information': dive_information,
        'max_depth': None,  # Will be set from computer data if available
        'average_depth': None,  # Will be set from computer data if available
        'gas_bottles_used': gas_bottles_used,
        'suit_type': parsed_suit_type,
        'difficulty_level': 'intermediate',  # Default
        'visibility_rating': parsed_visibility,
        'user_rating': parsed_rating,
        'dive_date': parsed_date.strftime('%Y-%m-%d') if parsed_date else None,
        'dive_time': parsed_time.strftime('%H:%M:%S') if parsed_time else None,
        'duration': parsed_duration,
        'unmatched_dive_site': unmatched_dive_site,
        'proposed_dive_sites': proposed_dive_sites
    }
    
    # Set depths from computer data
    if computer_data:
        if computer_data.get('max_depth'):
            try:
                # Extract numeric value from "28.7 m"
                max_depth_str = computer_data['max_depth'].replace(' m', '')
                divemap_dive['max_depth'] = float(max_depth_str)
            except ValueError:
                print(f"Invalid max depth: {computer_data['max_depth']}")
        
        if computer_data.get('mean_depth'):
            try:
                # Extract numeric value from "16.849 m"
                mean_depth_str = computer_data['mean_depth'].replace(' m', '')
                divemap_dive['average_depth'] = float(mean_depth_str)
            except ValueError:
                print(f"Invalid mean depth: {computer_data['mean_depth']}")
    
    return divemap_dive