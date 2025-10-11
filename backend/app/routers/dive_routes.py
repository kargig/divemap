"""
Dive Routes API Router

Handles CRUD operations for dive routes with proper authentication,
validation, and soft delete support.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc, func
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import DiveRoute, DiveSite, User, Dive
from app.schemas import (
    DiveRouteCreate, DiveRouteUpdate, DiveRouteResponse, DiveRouteWithDetails,
    DiveRouteListResponse, RouteDeletionCheck, RouteDeletionRequest
)
from app.auth import get_current_active_user, get_current_user_optional
from app.limiter import limiter
from app.services.route_deletion_service import RouteDeletionService

router = APIRouter()


@router.post("/", response_model=DiveRouteResponse)
@limiter.limit("10/minute")
async def create_route(
    request: Request,
    route_data: DiveRouteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new dive route"""
    # Verify dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == route_data.dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )
    
    # Create route
    db_route = DiveRoute(
        dive_site_id=route_data.dive_site_id,
        created_by=current_user.id,
        name=route_data.name,
        description=route_data.description,
        route_data=route_data.route_data,
        route_type=route_data.route_type
    )
    
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    
    return db_route


@router.get("/{route_id}", response_model=DiveRouteWithDetails)
async def get_route(
    route_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get a specific dive route by ID"""
    route = db.query(DiveRoute).filter(
        and_(DiveRoute.id == route_id, DiveRoute.deleted_at.is_(None))
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Add related data
    route_dict = route.__dict__.copy()
    route_dict['dive_site'] = {
        'id': route.dive_site.id,
        'name': route.dive_site.name,
        'country': route.dive_site.country,
        'region': route.dive_site.region
    } if route.dive_site else None
    
    route_dict['creator'] = {
        'id': route.creator.id,
        'username': route.creator.username,
        'name': route.creator.name
    } if route.creator else None
    
    return route_dict


@router.put("/{route_id}", response_model=DiveRouteResponse)
@limiter.limit("20/minute")
async def update_route(
    request: Request,
    route_id: int,
    route_data: DiveRouteUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a dive route (creator only)"""
    route = db.query(DiveRoute).filter(
        and_(DiveRoute.id == route_id, DiveRoute.deleted_at.is_(None))
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Check permissions
    if route.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this route"
        )
    
    # Update fields
    update_data = route_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(route, field, value)
    
    db.commit()
    db.refresh(route)
    
    return route


@router.post("/{route_id}/hide")
@limiter.limit("10/minute")
async def hide_route(
    request: Request,
    route_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Hide a route (soft delete) - can be done even if other users' dives use it"""
    deletion_service = RouteDeletionService(db)
    
    # Check if soft delete is allowed
    deletion_check = deletion_service.can_delete_route(route_id, current_user, soft_delete=True)
    if not deletion_check.can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=deletion_check.reason
        )
    
    # Perform soft delete
    success = deletion_service.soft_delete_route(route_id, current_user)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to hide route"
        )
    
    return {"message": "Route hidden successfully"}


@router.delete("/{route_id}")
@limiter.limit("5/minute")
async def delete_route(
    request: Request,
    route_id: int,
    migration_route_id: Optional[int] = Query(None, description="Route ID to migrate dives to"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Permanently delete a dive route - only if no other users' dives use it"""
    deletion_service = RouteDeletionService(db)
    
    # Check if hard delete is allowed
    deletion_check = deletion_service.can_delete_route(route_id, current_user, soft_delete=False)
    if not deletion_check.can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=deletion_check.reason
        )
    
    # Perform hard delete
    success = deletion_service.hard_delete_route(route_id, current_user, migration_route_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete route"
        )
    
    return {"message": "Route deleted successfully"}


@router.post("/{route_id}/restore", response_model=DiveRouteResponse)
@limiter.limit("5/minute")
async def restore_route(
    request: Request,
    route_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Restore a soft-deleted route (creator or admin only)"""
    deletion_service = RouteDeletionService(db)
    
    success = deletion_service.restore_route(route_id, current_user)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to restore route or insufficient permissions"
        )
    
    # Return the restored route
    route = db.query(DiveRoute).filter(DiveRoute.id == route_id).first()
    return route


@router.get("/{route_id}/deletion-check", response_model=RouteDeletionCheck)
async def check_route_deletion(
    route_id: int,
    soft_delete: bool = Query(False, description="Check for soft delete permission"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if a route can be deleted (soft or hard) and get migration options"""
    deletion_service = RouteDeletionService(db)
    return deletion_service.can_delete_route(route_id, current_user, soft_delete=soft_delete)


@router.get("/", response_model=DiveRouteListResponse)
async def list_routes(
    dive_site_id: Optional[int] = Query(None, description="Filter by dive site ID"),
    created_by: Optional[int] = Query(None, description="Filter by creator ID"),
    route_type: Optional[str] = Query(None, description="Filter by route type"),
    search: Optional[str] = Query(None, description="Search in route names and descriptions"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """List dive routes with filtering and pagination"""
    # Build query
    query = db.query(DiveRoute).filter(DiveRoute.deleted_at.is_(None))
    
    # Apply filters
    if dive_site_id:
        query = query.filter(DiveRoute.dive_site_id == dive_site_id)
    
    if created_by:
        query = query.filter(DiveRoute.created_by == created_by)
    
    if route_type:
        query = query.filter(DiveRoute.route_type == route_type)
    
    if search:
        search_filter = or_(
            DiveRoute.name.ilike(f"%{search}%"),
            DiveRoute.description.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    # Apply sorting
    if sort_by == "name":
        sort_column = DiveRoute.name
    elif sort_by == "created_at":
        sort_column = DiveRoute.created_at
    elif sort_by == "updated_at":
        sort_column = DiveRoute.updated_at
    else:
        sort_column = DiveRoute.created_at
    
    if sort_order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    routes = query.offset(offset).limit(page_size).all()
    
    # Calculate pagination info
    total_pages = (total + page_size - 1) // page_size
    
    return DiveRouteListResponse(
        routes=routes,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/dive-sites/{dive_site_id}/routes", response_model=List[DiveRouteResponse])
async def get_routes_by_dive_site(
    dive_site_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get all routes for a specific dive site"""
    # Verify dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )
    
    routes = db.query(DiveRoute).filter(
        and_(
            DiveRoute.dive_site_id == dive_site_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).order_by(desc(DiveRoute.created_at)).all()
    
    return routes


@router.get("/dive-sites/{dive_site_id}/routes/for-migration", response_model=List[DiveRouteResponse])
async def get_routes_for_migration(
    dive_site_id: int,
    exclude_route_id: int = Query(..., description="Route ID to exclude from results"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get routes for migration (excludes the route being deleted)"""
    deletion_service = RouteDeletionService(db)
    routes = deletion_service.get_routes_for_deletion_check(dive_site_id)
    
    # Filter out the route being deleted
    migration_routes = [route for route in routes if route.id != exclude_route_id]
    
    return migration_routes
