"""
Dive Routes API Router

Handles CRUD operations for dive routes with proper authentication,
validation, and soft delete support.
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Response
from sqlalchemy.orm import Session, joinedload
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
from app.services.route_analytics_service import RouteAnalyticsService
from app.services.route_export_service import RouteExportService

router = APIRouter()


# Route Export Endpoints (must be before parameterized routes)

@router.get("/export-formats", response_model=List[dict])
async def get_export_formats():
    """Get list of available export formats"""
    export_service = RouteExportService()
    return export_service.get_export_formats()


@router.get("/popular", response_model=DiveRouteListResponse)
async def get_popular_routes(
    limit: int = Query(10, ge=1, le=50, description="Number of popular routes to return"),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get most popular routes based on usage"""
    # Count dives per route
    route_usage = db.query(
        Dive.selected_route_id,
        func.count(Dive.id).label('dive_count')
    ).filter(
        Dive.selected_route_id.isnot(None)
    ).group_by(Dive.selected_route_id).subquery()
    
    # Get routes with usage counts
    routes_query = db.query(DiveRoute).options(
        joinedload(DiveRoute.creator)
    ).join(
        route_usage, DiveRoute.id == route_usage.c.selected_route_id
    ).filter(
        DiveRoute.deleted_at.is_(None)
    ).order_by(
        desc(route_usage.c.dive_count)
    ).limit(limit)
    
    routes = routes_query.all()
    
    return DiveRouteListResponse(
        routes=routes,
        total=len(routes),
        page=1,
        page_size=limit,
        total_pages=1
    )


@router.get("/{route_id}/export/{format}", response_class=Response)
@limiter.limit("30/minute")
async def export_route(
    request: Request,
    route_id: int,
    format: str,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Export route to specified format (GPX, KML)"""
    
    # Get route with dive site
    route = db.query(DiveRoute).options(
        joinedload(DiveRoute.dive_site)
    ).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Validate format
    valid_formats = ["gpx", "kml"]
    if format.lower() not in valid_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid format. Must be one of: {', '.join(valid_formats)}"
        )
    
    # Track export interaction
    analytics_service = RouteAnalyticsService(db)
    try:
        analytics_service.track_interaction(
            route_id=route_id,
            interaction_type="export",
            user_id=current_user.id if current_user else None,
            ip_address=get_remote_address(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            extra_data={
                "export_format": format.lower(),
                "endpoint": str(request.url),
                "method": request.method
            }
        )
    except Exception:
        # Don't fail export if analytics tracking fails
        pass
    
    # Export route
    export_service = RouteExportService()
    
    try:
        if format.lower() == "gpx":
            content = export_service.export_to_gpx(route, route.dive_site)
            media_type = "application/gpx+xml"
            filename = f"{route.name.replace(' ', '_')}.gpx"
        elif format.lower() == "kml":
            content = export_service.export_to_kml(route, route.dive_site)
            media_type = "application/vnd.google-earth.kml+xml"
            filename = f"{route.name.replace(' ', '_')}.kml"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported export format"
            )
        
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\"",
                "Content-Type": f"{media_type}; charset=utf-8"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )


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
    query = db.query(DiveRoute).options(
        joinedload(DiveRoute.creator)
    ).filter(DiveRoute.deleted_at.is_(None))
    
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
    
    routes = db.query(DiveRoute).options(
        joinedload(DiveRoute.creator)
    ).filter(
        and_(
            DiveRoute.dive_site_id == dive_site_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).order_by(desc(DiveRoute.created_at)).all()
    
    return routes


# Route Export Endpoints

@router.get("/export-formats", response_model=List[dict])
async def get_export_formats():
    """Get list of available export formats"""
    export_service = RouteExportService()
    return export_service.get_export_formats()


@router.get("/{route_id}/export/{format}", response_class=Response)
@limiter.limit("30/minute")
async def export_route(
    request: Request,
    route_id: int,
    format: str,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Export route to specified format (GPX, KML)"""
    
    # Get route with dive site
    route = db.query(DiveRoute).options(
        joinedload(DiveRoute.dive_site)
    ).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Validate format
    valid_formats = ["gpx", "kml"]
    if format.lower() not in valid_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid format. Must be one of: {', '.join(valid_formats)}"
        )
    
    # Track export interaction
    analytics_service = RouteAnalyticsService(db)
    try:
        analytics_service.track_interaction(
            route_id=route_id,
            interaction_type="export",
            user_id=current_user.id if current_user else None,
            ip_address=get_remote_address(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            extra_data={
                "export_format": format.lower(),
                "endpoint": str(request.url),
                "method": request.method
            }
        )
    except Exception:
        # Don't fail export if analytics tracking fails
        pass
    
    # Export route
    export_service = RouteExportService()
    
    try:
        if format.lower() == "gpx":
            content = export_service.export_to_gpx(route, route.dive_site)
            media_type = "application/gpx+xml"
            filename = f"{route.name.replace(' ', '_')}.gpx"
        elif format.lower() == "kml":
            content = export_service.export_to_kml(route, route.dive_site)
            media_type = "application/vnd.google-earth.kml+xml"
            filename = f"{route.name.replace(' ', '_')}.kml"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported export format"
            )
        
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\"",
                "Content-Type": f"{media_type}; charset=utf-8"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )




@router.post("/{route_id}/share", response_model=dict)
@limiter.limit("10/minute")
async def share_route(
    request: Request,
    route_id: int,
    share_type: str = Query("public", description="Type of sharing: public, private, community"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate a shareable link for a route"""
    route = db.query(DiveRoute).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
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
            detail="You can only share your own routes"
        )
    
    # Generate shareable link
    base_url = request.base_url
    share_url = f"{base_url}dive-sites/{route.dive_site_id}/route/{route_id}"
    
    # In a real implementation, you might want to:
    # - Generate a unique share token
    # - Track sharing analytics
    # - Set expiration dates
    # - Control access permissions
    
    return {
        "route_id": route_id,
        "share_url": share_url,
        "share_type": share_type,
        "shared_by": current_user.id,
        "shared_at": func.now(),
        "expires_at": None,  # No expiration for now
        "access_count": 0,   # Would be tracked in a real implementation
        "message": f"Route '{route.name}' shared successfully"
    }




@router.post("/{route_id}/interaction", response_model=dict)
@limiter.limit("100/minute")
async def track_route_interaction(
    request: Request,
    route_id: int,
    interaction_type: str = Query(..., description="Type of interaction: view, copy, share, download, export"),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Track user interactions with routes for analytics"""
    route = db.query(DiveRoute).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Validate interaction type
    valid_interactions = ["view", "copy", "share", "download", "export", "like", "bookmark"]
    if interaction_type not in valid_interactions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid interaction type. Must be one of: {', '.join(valid_interactions)}"
        )
    
    # Use analytics service to track interaction
    analytics_service = RouteAnalyticsService(db)
    
    try:
        analytics = analytics_service.track_interaction(
            route_id=route_id,
            interaction_type=interaction_type,
            user_id=current_user.id if current_user else None,
            ip_address=get_remote_address(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            session_id=request.headers.get("x-session-id"),  # If you implement session tracking
            extra_data={
                "endpoint": str(request.url),
                "method": request.method
            }
        )
        
        return {
            "route_id": route_id,
            "interaction_type": interaction_type,
            "user_id": current_user.id if current_user else None,
            "analytics_id": analytics.id,
            "timestamp": analytics.created_at.isoformat(),
            "message": f"Interaction '{interaction_type}' tracked successfully"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{route_id}/community-stats", response_model=dict)
async def get_route_community_stats(
    route_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get community statistics for a route (public endpoint)"""
    route = db.query(DiveRoute).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Count dives using this route
    dive_count = db.query(Dive).filter(Dive.selected_route_id == route_id).count()
    
    # Count unique users who have used this route
    unique_users = db.query(Dive.user_id).filter(
        Dive.selected_route_id == route_id
    ).distinct().count()
    
    # Get recent usage (last 7 days)
    from datetime import datetime, timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_dives = db.query(Dive).filter(
        and_(
            Dive.selected_route_id == route_id,
            Dive.created_at >= seven_days_ago
        )
    ).count()
    
    # Calculate route complexity metrics
    waypoint_count = 0
    estimated_length = 0
    
    if route.route_data:
        if route.route_data.get("type") == "Feature":
            coords = route.route_data.get("geometry", {}).get("coordinates", [])
            waypoint_count = len(coords)
            estimated_length = waypoint_count * 0.1
        elif route.route_data.get("type") == "FeatureCollection":
            features = route.route_data.get("features", [])
            for feature in features:
                coords = feature.get("geometry", {}).get("coordinates", [])
                waypoint_count += len(coords)
            estimated_length = waypoint_count * 0.1
    
    return {
        "route_id": route_id,
        "route_name": route.name,
        "community_stats": {
            "total_dives_using_route": dive_count,
            "unique_users_used_route": unique_users,
            "recent_dives_7_days": recent_dives,
            "waypoint_count": waypoint_count,
            "estimated_length_km": round(estimated_length, 2),
            "route_type": route.route_type,
            "has_description": bool(route.description),
            "created_at": route.created_at,
            "creator_username": route.creator.username if route.creator else "Unknown",
        },
        "generated_at": datetime.utcnow().isoformat()
    }




    return migration_routes


# Enhanced Route Interaction Endpoints

@router.post("/{route_id}/view", response_model=dict)
@limiter.limit("200/minute")
async def track_route_view(
    request: Request,
    route_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Track route view interaction"""
    route = db.query(DiveRoute).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Track view interaction
    analytics_service = RouteAnalyticsService(db)
    try:
        analytics = analytics_service.track_interaction(
            route_id=route_id,
            interaction_type="view",
            user_id=current_user.id if current_user else None,
            ip_address=get_remote_address(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            extra_data={
                "endpoint": str(request.url),
                "method": request.method,
                "view_timestamp": datetime.utcnow().isoformat()
            }
        )
        
        return {
            "route_id": route_id,
            "interaction_type": "view",
            "user_id": current_user.id if current_user else None,
            "analytics_id": analytics.id,
            "timestamp": analytics.created_at.isoformat(),
            "message": "Route view tracked successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track view: {str(e)}"
        )


@router.post("/{route_id}/copy", response_model=dict)
@limiter.limit("50/minute")
async def copy_route(
    request: Request,
    route_id: int,
    new_name: str = Query(..., description="Name for the copied route"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Copy an existing route to create a new one"""
    # Get original route
    original_route = db.query(DiveRoute).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not original_route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Create new route based on original
    new_route = DiveRoute(
        name=new_name,
        description=f"Copied from: {original_route.name}",
        route_data=original_route.route_data,
        route_type=original_route.route_type,
        dive_site_id=original_route.dive_site_id,
        created_by=current_user.id
    )
    
    db.add(new_route)
    db.commit()
    db.refresh(new_route)
    
    # Track copy interaction
    analytics_service = RouteAnalyticsService(db)
    try:
        analytics_service.track_interaction(
            route_id=route_id,
            interaction_type="copy",
            user_id=current_user.id,
            ip_address=get_remote_address(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            extra_data={
                "copied_route_id": new_route.id,
                "original_route_name": original_route.name,
                "new_route_name": new_name,
                "endpoint": str(request.url),
                "method": request.method
            }
        )
    except Exception:
        # Don't fail copy if analytics tracking fails
        pass
    
    return {
        "original_route_id": route_id,
        "new_route_id": new_route.id,
        "new_route_name": new_name,
        "message": "Route copied successfully"
    }


@router.post("/{route_id}/share", response_model=dict)
@limiter.limit("30/minute")
async def share_route(
    request: Request,
    route_id: int,
    share_method: str = Query(..., description="Share method: link, email, social"),
    share_data: dict = None,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Share a route via various methods"""
    route = db.query(DiveRoute).options(
        joinedload(DiveRoute.dive_site),
        joinedload(DiveRoute.creator)
    ).filter(
        and_(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).first()
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )
    
    # Validate share method
    valid_methods = ["link", "email", "social"]
    if share_method not in valid_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid share method. Must be one of: {', '.join(valid_methods)}"
        )
    
    # Generate share data based on method
    share_result = {
        "route_id": route_id,
        "route_name": route.name,
        "share_method": share_method,
        "share_url": f"http://localhost/dive-sites/{route.dive_site_id}/route/{route_id}",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if share_method == "link":
        share_result["share_link"] = f"http://localhost/dive-sites/{route.dive_site_id}/route/{route_id}"
        share_result["message"] = "Route link generated successfully"
    
    elif share_method == "email":
        # In a real implementation, you would send an email here
        share_result["email_sent"] = False
        share_result["message"] = "Email sharing not implemented yet"
    
    elif share_method == "social":
        # In a real implementation, you would integrate with social media APIs
        share_result["social_posted"] = False
        share_result["message"] = "Social sharing not implemented yet"
    
    # Track share interaction
    analytics_service = RouteAnalyticsService(db)
    try:
        analytics_service.track_interaction(
            route_id=route_id,
            interaction_type="share",
            user_id=current_user.id if current_user else None,
            ip_address=get_remote_address(request),
            user_agent=request.headers.get("user-agent"),
            referrer=request.headers.get("referer"),
            extra_data={
                "share_method": share_method,
                "share_data": share_data or {},
                "endpoint": str(request.url),
                "method": request.method
            }
        )
    except Exception:
        # Don't fail share if analytics tracking fails
        pass
    
    return share_result
