"""
Admin operations for dives.

This module contains admin-only operations for dives:
- get_all_dives_admin
- get_all_dives_count_admin
- update_dive_admin
- delete_dive_admin
"""

from fastapi import Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from .dives_shared import router, get_db, get_current_admin_user, User, Dive, DiveSite
from .dives_db_utils import get_dive_by_id, get_dive_with_relations
from .dives_errors import raise_dive_not_found, raise_validation_error
from .dives_logging import log_admin_operation, log_error
from ..schemas import DiveResponse, DiveUpdate


@router.get("/admin/dives/count")
def get_all_dives_count_admin(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
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
    is_private: Optional[bool] = Query(None)
):
    """Get count of all dives (admin only) with optional filtering"""
    try:
        query = db.query(Dive)
        
        # Apply filters
        if user_id:
            query = query.filter(Dive.user_id == user_id)
        
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
            from app.models import DiveTag
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
        
        if is_private is not None:
            query = query.filter(Dive.is_private == is_private)
        
        count = query.count()
        
        log_admin_operation("get_dives_count", admin_user.id, count)
        
        return {"count": count}
        
    except Exception as e:
        log_error("get_all_dives_count_admin", e, admin_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dive count"
        )


@router.get("/admin/dives", response_model=List[DiveResponse])
def get_all_dives_admin(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
    user_id: Optional[int] = Query(None, description="Filter by specific user ID"),
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
    is_private: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("dive_date", description="Sort by field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)")
):
    """Get list of all dives (admin only) with optional filtering and pagination"""
    try:
        query = db.query(Dive)
        
        # Apply filters (same as get_all_dives_count_admin)
        if user_id:
            query = query.filter(Dive.user_id == user_id)
        
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
            from app.models import DiveTag
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
        
        if is_private is not None:
            query = query.filter(Dive.is_private == is_private)
        
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
        
        log_admin_operation("get_dives", admin_user.id, len(dives))
        
        return dives
        
    except Exception as e:
        log_error("get_all_dives_admin", e, admin_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dives"
        )


@router.put("/admin/dives/{dive_id}", response_model=DiveResponse)
def update_dive_admin(
    dive_id: int,
    dive_update: DiveUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """Update any dive (admin only)"""
    try:
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        # Update dive fields
        update_data = dive_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(dive, field, value)
        
        # Generate dive name if dive site or date changed
        if "dive_site_id" in update_data or "dive_date" in update_data:
            from .dives_crud import generate_dive_name
            from .dives_db_utils import get_dive_site_by_id
            dive_site = get_dive_site_by_id(db, dive.dive_site_id)
            if dive_site:
                dive.name = generate_dive_name(dive_site.name, dive.dive_date)
        
        db.commit()
        db.refresh(dive)
        
        log_admin_operation("update_dive", admin_user.id, dive_id)
        
        return dive
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("update_dive_admin", e, admin_user.id, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update dive"
        )


@router.delete("/admin/dives/{dive_id}")
def delete_dive_admin(
    dive_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """Delete any dive (admin only)"""
    try:
        dive = get_dive_by_id(db, dive_id)
        if not dive:
            raise_dive_not_found(dive_id)
        
        db.delete(dive)
        db.commit()
        
        log_admin_operation("delete_dive", admin_user.id, dive_id)
        
        return {"message": "Dive deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error("delete_dive_admin", e, admin_user.id, dive_id=dive_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete dive"
        )
