from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, date
import re

from app.database import get_db
from app.models import Dive, DiveMedia, DiveTag, DiveSite, AvailableTag, User, DivingCenter
from app.schemas import (
    DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse,
    DiveTagCreate, DiveTagResponse, DiveSearchParams
)
from app.auth import get_current_user, get_current_user_optional

router = APIRouter(tags=["dives"])


def generate_dive_name(dive_site_name: str, dive_date: date) -> str:
    """Generate automatic dive name from dive site and date"""
    return f"{dive_site_name} - {dive_date.strftime('%Y/%m/%d')}"


# Admin endpoints for dive management - must be defined before regular routes
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
    if dive_update.name is not None:
        dive.name = dive_update.name
    elif dive_update.dive_site_id and dive_update.dive_site_id != dive.dive_site_id:
        # Regenerate name if dive site changed
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_update.dive_site_id).first()
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
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get dives with filtering options. Can view own dives and public dives from other users. Unauthenticated users can view public dives."""
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
        
        # Get tags for this dive
        dive_tags = db.query(AvailableTag).join(DiveTag).filter(DiveTag.dive_id == dive.id).all()
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
            "created_at": dive.created_at,
            "updated_at": dive.updated_at,
            "dive_site": dive_site_info,
            "diving_center": diving_center_info,
            "media": [],
            "tags": tags_list,
            "user_username": dive.user.username
        }
        dive_list.append(dive_dict)
    
    return dive_list


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
    ).all()
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
    if dive_update.name is not None:
        dive.name = dive_update.name
    elif dive_update.dive_site_id and dive_update.dive_site_id != dive.dive_site_id:
        # Regenerate name if dive site changed
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_update.dive_site_id).first()
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