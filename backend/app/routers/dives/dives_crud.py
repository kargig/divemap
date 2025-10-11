"""
CRUD operations for dives.

This module contains core CRUD operations for dives:
- create_dive
- get_dives_count
- get_dives
- get_dive
- get_dive_details
- update_dive
- delete_dive
"""

from fastapi import Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc, asc
from typing import List, Optional
from datetime import datetime
import json

from .dives_shared import router, get_db, get_current_user, get_current_user_optional, User, Dive, DiveMedia, DiveTag, AvailableTag, r2_storage, UNIFIED_TYPO_TOLERANCE
from app.schemas import DiveCreate, DiveUpdate, DiveResponse
from app.models import DiveSite, DivingCenter, DiveSiteAlias, get_difficulty_label
from .dives_utils import generate_dive_name
from .dives_import import parse_dive_information_text
from .dives_search import search_dives_with_fuzzy
from app.utils import get_unified_fuzzy_trigger_conditions


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

    # Validate selected route if provided
    selected_route = None
    if dive.selected_route_id:
        from app.models import DiveRoute
        selected_route = db.query(DiveRoute).filter(DiveRoute.id == dive.selected_route_id).first()
        if not selected_route:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected route not found"
            )
        # Ensure the route belongs to the same dive site if dive site is specified
        if dive.dive_site_id and selected_route.dive_site_id != dive.dive_site_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected route must belong to the same dive site"
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
    db_dive = Dive(
        user_id=current_user.id,
        dive_site_id=dive.dive_site_id,
        diving_center_id=dive.diving_center_id,
        selected_route_id=dive.selected_route_id,
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

    # Get selected route information if available
    selected_route_info = None
    if db_dive.selected_route_id:
        from app.models import DiveRoute
        selected_route = db.query(DiveRoute).options(joinedload(DiveRoute.creator)).filter(DiveRoute.id == db_dive.selected_route_id).first()
        if selected_route:
            selected_route_info = {
                "id": selected_route.id,
                "name": selected_route.name,
                "description": selected_route.description,
                "route_type": selected_route.route_type,
                "route_data": selected_route.route_data,
                "created_by": selected_route.created_by,
                "creator_username": selected_route.creator.username,
                "created_at": selected_route.created_at
            }

    # Convert to dict to avoid SQLAlchemy relationship serialization issues
    dive_dict = {
        "id": db_dive.id,
        "user_id": db_dive.user_id,
        "dive_site_id": db_dive.dive_site_id,
        "diving_center_id": db_dive.diving_center_id,
        "selected_route_id": db_dive.selected_route_id,
        "name": db_dive.name,
        "is_private": db_dive.is_private,
        "dive_information": db_dive.dive_information,
        "max_depth": float(db_dive.max_depth) if db_dive.max_depth else None,
        "average_depth": float(db_dive.average_depth) if db_dive.average_depth else None,
        "gas_bottles_used": db_dive.gas_bottles_used,
        "suit_type": db_dive.suit_type.value if db_dive.suit_type else None,
        "difficulty_level": get_difficulty_label(dive.difficulty_level) if db_dive.difficulty_level else None,
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
        "selected_route": selected_route_info,
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
    my_dives: Optional[bool] = Query(None, description="Filter to show only current user's dives"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    difficulty_level: Optional[int] = Query(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert"),
    suit_type: Optional[str] = Query(None, pattern=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[int] = Query(None, ge=1, le=10),
    max_rating: Optional[int] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
):
    """Get total count of dives matching the filters."""
    query = db.query(Dive).join(User, Dive.user_id == User.id)

    # Filter by user if specified
    if user_id:
        query = query.filter(Dive.user_id == user_id)
    elif my_dives:
        # Filter to show only current user's dives
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to filter by my_dives"
            )
        query = query.filter(Dive.user_id == current_user.id)
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
    my_dives: Optional[bool] = Query(None, description="Filter to show only current user's dives"),
    dive_site_id: Optional[int] = Query(None),
    dive_site_name: Optional[str] = Query(None, description="Filter by dive site name (partial match)"),
    search: Optional[str] = Query(None, description="Unified search across dive site name, description, notes"),
    difficulty_level: Optional[int] = Query(None, ge=1, le=4, description="1=beginner, 2=intermediate, 3=advanced, 4=expert"),
    suit_type: Optional[str] = Query(None, pattern=r"^(wet_suit|dry_suit|shortie)$"),
    min_depth: Optional[float] = Query(None, ge=0, le=1000),
    max_depth: Optional[float] = Query(None, ge=0, le=1000),
    min_visibility: Optional[int] = Query(None, ge=1, le=10),
    max_visibility: Optional[int] = Query(None, ge=1, le=10),
    min_rating: Optional[int] = Query(None, ge=1, le=10),
    max_rating: Optional[int] = Query(None, ge=1, le=10),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tag_ids: Optional[str] = Query(None),  # Comma-separated tag IDs
    sort_by: Optional[str] = Query(None, description="Sort field (dive_date, max_depth, duration, difficulty_level, visibility_rating, user_rating, created_at, updated_at). Admin users can also sort by view_count."),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, 100, or 1000)")
):
    """Get dives with filtering options. Can view own dives and public dives from other users. Unauthenticated users can view public dives."""
    # Validate page_size
    if page_size not in [1, 5, 25, 50, 100, 1000]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be one of: 25, 50, 100, 1000"
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
    elif my_dives:
        # Filter to show only current user's dives
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to filter by my_dives"
            )
        query = query.filter(Dive.user_id == current_user.id)
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
        search_query_for_fuzzy = sanitized_search
        
        # Always join with DiveSite for search to ensure we have access to dive site fields
        query = query.join(DiveSite, Dive.dive_site_id == DiveSite.id)
        
        # Search across dive site name, dive site description, and dive information
        query = query.filter(
            or_(
                DiveSite.name.ilike(f"%{sanitized_search}%"),
                DiveSite.description.ilike(f"%{sanitized_search}%"),
                Dive.dive_information.ilike(f"%{sanitized_search}%")
            )
        )

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

    # Apply dynamic sorting based on parameters
    if sort_by:
        # All valid sort fields (including admin-only ones)
        valid_sort_fields = {
            'dive_date', 'max_depth', 'duration', 'difficulty_level', 
            'visibility_rating', 'user_rating', 'view_count', 'created_at', 'updated_at'
        }
        
        if sort_by not in valid_sort_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by field. Must be one of: {', '.join(valid_sort_fields)}"
            )
        
        # Validate sort_order parameter
        if sort_order not in ['asc', 'desc']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sort_order must be 'asc' or 'desc'"
            )
        
        # Apply sorting based on field
        if sort_by == 'dive_date':
            sort_field = Dive.dive_date
        elif sort_by == 'max_depth':
            sort_field = Dive.max_depth
        elif sort_by == 'duration':
            sort_field = Dive.duration
        elif sort_by == 'difficulty_level':
            # Sort by difficulty level (1=beginner, 2=intermediate, 3=advanced, 4=expert)
            sort_field = Dive.difficulty_level
        elif sort_by == 'visibility_rating':
            sort_field = Dive.visibility_rating
        elif sort_by == 'user_rating':
            sort_field = Dive.user_rating
        elif sort_by == 'view_count':
            # Only admin users can sort by view_count
            if not current_user or not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Sorting by view_count is only available for admin users"
                )
            sort_field = Dive.view_count
        elif sort_by == 'created_at':
            sort_field = Dive.created_at
        elif sort_by == 'updated_at':
            sort_field = Dive.updated_at
        
        # Apply the sorting
        if sort_order == 'desc':
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    else:
        # Default sorting by dive date (newest first)
        query = query.order_by(Dive.dive_date.desc(), Dive.dive_time.desc())

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size
    has_next_page = page < total_pages
    has_prev_page = page > 1

    # Apply pagination
    dives = query.offset(offset).limit(page_size).all()
    
    # Apply fuzzy search if we have a search query and should use fuzzy search
    match_types = {}
    if search:
        # Check if we should use fuzzy search based on unified conditions
        should_use_fuzzy = get_unified_fuzzy_trigger_conditions(search, len(dives))
        
        if should_use_fuzzy:
            # Get the search query for fuzzy search
            search_query_for_fuzzy = search.strip()[:200]
            
            # Perform fuzzy search to enhance results
            enhanced_results = search_dives_with_fuzzy(
                search_query_for_fuzzy, 
                dives, 
                db, 
                similarity_threshold=UNIFIED_TYPO_TOLERANCE['overall_threshold'], 
                max_fuzzy_results=10
            )
            
            # Update dives with enhanced results
            dives = [result['dive'] for result in enhanced_results]
            
            # Create match types mapping for frontend
            for result in enhanced_results:
                match_types[result['dive'].id] = {
                    'type': result['match_type'],
                    'score': result['score']
                }

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

        # Parse dive information to extract individual fields
        parsed_info = parse_dive_information_text(dive.dive_information)

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
            "difficulty_level": get_difficulty_label(dive.difficulty_level) if dive.difficulty_level else None,
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
            "user_username": dive.user.username,
            # Add parsed fields from dive_information
            "buddy": parsed_info.get('buddy'),
            "sac": parsed_info.get('sac'),
            "otu": parsed_info.get('otu'),
            "cns": parsed_info.get('cns'),
            "water_temperature": parsed_info.get('water_temperature'),
            "deco_model": parsed_info.get('deco_model'),
            "weights": parsed_info.get('weights')
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
    
    # Add match types header if available
    if match_types:
        # Optimize match_types to prevent extremely large headers
        # Only include essential match information and limit size
        optimized_match_types = {}
        for dive_id, match_info in match_types.items():
            # Include only essential fields to reduce header size
            optimized_match_types[dive_id] = {
                'type': match_info.get('type', 'unknown'),
                'score': round(match_info.get('score', 0), 2) if match_info.get('score') else 0
            }
        
        # Convert to JSON and check size
        match_types_json = json.dumps(optimized_match_types)
        
        # If header is still too large, truncate or omit it
        if len(match_types_json) > 8000:  # 8KB limit for headers
            # Log warning about large header
            logger = logging.getLogger(__name__)
            logger.warning(f"X-Match-Types header too large ({len(match_types_json)} chars), omitting to prevent nginx errors")
        else:
            response.headers["X-Match-Types"] = match_types_json

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

    # Parse dive information to extract individual fields
    parsed_info = parse_dive_information_text(dive.dive_information)

    # Get selected route information if available
    selected_route_info = None
    if dive.selected_route_id:
        from app.models import DiveRoute
        selected_route = db.query(DiveRoute).options(joinedload(DiveRoute.creator)).filter(DiveRoute.id == dive.selected_route_id).first()
        if selected_route:
            selected_route_info = {
                "id": selected_route.id,
                "name": selected_route.name,
                "description": selected_route.description,
                "route_type": selected_route.route_type,
                "route_data": selected_route.route_data,
                "created_by": selected_route.created_by,
                "creator_username": selected_route.creator.username,
                "created_at": selected_route.created_at
            }

    # Convert SQLAlchemy object to dictionary to avoid serialization issues
    dive_dict = {
        "id": dive.id,
        "user_id": dive.user_id,
        "dive_site_id": dive.dive_site_id,
        "diving_center_id": dive.diving_center_id,
        "selected_route_id": dive.selected_route_id,
        "name": dive.name,
        "is_private": dive.is_private,
        "dive_information": dive.dive_information,
        "max_depth": float(dive.max_depth) if dive.max_depth else None,
        "average_depth": float(dive.average_depth) if dive.average_depth else None,
        "gas_bottles_used": dive.gas_bottles_used,
        "suit_type": dive.suit_type.value if dive.suit_type else None,
        "difficulty_level": get_difficulty_label(dive.difficulty_level) if dive.difficulty_level else None,
        "visibility_rating": dive.visibility_rating,
        "user_rating": dive.user_rating,
        "dive_date": dive.dive_date.strftime("%Y-%m-%d"),
        "dive_time": dive.dive_time.strftime("%H:%M:%S") if dive.dive_time else None,
        "duration": dive.duration,
        "view_count": dive.view_count,
        "profile_xml_path": dive.profile_xml_path,
        "profile_sample_count": dive.profile_sample_count,
        "profile_max_depth": float(dive.profile_max_depth) if dive.profile_max_depth else None,
        "profile_duration_minutes": dive.profile_duration_minutes,
        "created_at": dive.created_at,
        "updated_at": dive.updated_at,
        "dive_site": dive_site_info,
        "diving_center": diving_center_info,
        "selected_route": selected_route_info,
        "media": [],
        "tags": tags_dict,
        "user_username": dive.user.username,
        # Add parsed fields from dive_information
        "buddy": parsed_info.get('buddy'),
        "sac": parsed_info.get('sac'),
        "otu": parsed_info.get('otu'),
        "cns": parsed_info.get('cns'),
        "water_temperature": parsed_info.get('water_temperature'),
        "deco_model": parsed_info.get('deco_model'),
        "weights": parsed_info.get('weights')
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
            "difficulty_level": get_difficulty_label(dive.dive_site.difficulty_level) if dive.dive_site.difficulty_level else None,
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
        "difficulty_level": get_difficulty_label(dive.difficulty_level) if dive.difficulty_level else None,
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

    # Check if user is admin or owns the dive
    if current_user.is_admin:
        # Admins can edit any dive
        dive = db.query(Dive).filter(Dive.id == dive_id).first()
    else:
        # Regular users can only edit their own dives
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

    # Validate selected route if provided
    if dive_update.selected_route_id:
        from app.models import DiveRoute
        selected_route = db.query(DiveRoute).filter(DiveRoute.id == dive_update.selected_route_id).first()
        if not selected_route:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected route not found"
            )
        # Ensure the route belongs to the same dive site if dive site is specified
        dive_site_id = dive_update.dive_site_id if dive_update.dive_site_id is not None else dive.dive_site_id
        if dive_site_id and selected_route.dive_site_id != dive_site_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected route must belong to the same dive site"
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

    # Get selected route information if available
    selected_route_info = None
    if dive.selected_route_id:
        from app.models import DiveRoute
        selected_route = db.query(DiveRoute).options(joinedload(DiveRoute.creator)).filter(DiveRoute.id == dive.selected_route_id).first()
        if selected_route:
            selected_route_info = {
                "id": selected_route.id,
                "name": selected_route.name,
                "description": selected_route.description,
                "route_type": selected_route.route_type,
                "route_data": selected_route.route_data,
                "created_by": selected_route.created_by,
                "creator_username": selected_route.creator.username,
                "created_at": selected_route.created_at
            }

    # Convert SQLAlchemy object to dictionary to avoid serialization issues
    dive_dict = {
        "id": dive.id,
        "user_id": dive.user_id,
        "dive_site_id": dive.dive_site_id,
        "diving_center_id": dive.diving_center_id,
        "selected_route_id": dive.selected_route_id,
        "name": dive.name,
        "is_private": dive.is_private,
        "dive_information": dive.dive_information,
        "max_depth": float(dive.max_depth) if dive.max_depth else None,
        "average_depth": float(dive.average_depth) if dive.average_depth else None,
        "gas_bottles_used": dive.gas_bottles_used,
        "suit_type": dive.suit_type.value if dive.suit_type else None,
        "difficulty_level": get_difficulty_label(dive.difficulty_level) if dive.difficulty_level else None,
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
        "selected_route": selected_route_info,
        "media": [],
        "tags": tags_dict,
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
