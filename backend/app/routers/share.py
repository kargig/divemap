"""
Share API Router

Handles sharing functionality for dives, dive sites, and dive routes.
Provides shareable URLs and platform-specific share links.
"""

from typing import Dict, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import Dive, DiveSite, DiveRoute, User
from app.auth import get_current_active_user, get_current_user_optional
from app.limiter import limiter, skip_rate_limit_for_admin
from app.services.share_service import ShareService
from app.services.route_analytics_service import RouteAnalyticsService

router = APIRouter()

# Rate limiting for share endpoints
SHARE_RATE_LIMIT = "30/minute"


@router.post("/dives/{dive_id}", response_model=Dict)
@skip_rate_limit_for_admin(SHARE_RATE_LIMIT)
@limiter.limit(SHARE_RATE_LIMIT)
async def share_dive(
    request: Request,
    dive_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Generate shareable content for a dive.
    
    Returns share URL, formatted content, and platform-specific share links.
    """
    share_service = ShareService(db)
    
    try:
        # Get entity data
        entity_data = share_service.get_entity_data("dive", dive_id, current_user)
        
        # Generate share URL
        share_url = share_service.generate_share_url("dive", dive_id, request)
        
        # Format share content
        share_content = share_service.format_share_content("dive", entity_data)
        
        # Get platform share URLs
        platform_urls = share_service.get_platform_share_urls(
            share_url,
            share_content["title"],
            share_content["description"],
            "dive"
        )
        
        return {
            "share_url": share_url,
            "title": share_content["title"],
            "description": share_content["description"],
            "share_platforms": platform_urls,
            "metadata": {
                "entity_type": "dive",
                "entity_id": dive_id,
                "shared_at": datetime.utcnow().isoformat(),
                "shared_by": current_user.id if current_user else None
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/dives/{dive_id}/preview", response_model=Dict)
@skip_rate_limit_for_admin(SHARE_RATE_LIMIT)
@limiter.limit(SHARE_RATE_LIMIT)
async def get_dive_share_preview(
    request: Request,
    dive_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get preview data for sharing a dive (without generating share links).
    Useful for displaying share preview before actual share action.
    """
    share_service = ShareService(db)
    
    try:
        entity_data = share_service.get_entity_data("dive", dive_id, current_user)
        share_content = share_service.format_share_content("dive", entity_data)
        
        return {
            "title": share_content["title"],
            "description": share_content["description"],
            "entity_data": entity_data
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/dive-sites/{dive_site_id}", response_model=Dict)
@skip_rate_limit_for_admin(SHARE_RATE_LIMIT)
@limiter.limit(SHARE_RATE_LIMIT)
async def share_dive_site(
    request: Request,
    dive_site_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Generate shareable content for a dive site.
    
    Returns share URL, formatted content, and platform-specific share links.
    """
    share_service = ShareService(db)
    
    try:
        # Get entity data
        entity_data = share_service.get_entity_data("dive-site", dive_site_id, current_user)
        
        # Generate share URL
        share_url = share_service.generate_share_url("dive-site", dive_site_id, request)
        
        # Format share content
        share_content = share_service.format_share_content("dive-site", entity_data)
        
        # Get platform share URLs
        platform_urls = share_service.get_platform_share_urls(
            share_url,
            share_content["title"],
            share_content["description"],
            "dive-site"
        )
        
        return {
            "share_url": share_url,
            "title": share_content["title"],
            "description": share_content["description"],
            "share_platforms": platform_urls,
            "metadata": {
                "entity_type": "dive-site",
                "entity_id": dive_site_id,
                "shared_at": datetime.utcnow().isoformat(),
                "shared_by": current_user.id if current_user else None
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/dive-sites/{dive_site_id}/preview", response_model=Dict)
@skip_rate_limit_for_admin(SHARE_RATE_LIMIT)
@limiter.limit(SHARE_RATE_LIMIT)
async def get_dive_site_share_preview(
    request: Request,
    dive_site_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get preview data for sharing a dive site."""
    share_service = ShareService(db)
    
    try:
        entity_data = share_service.get_entity_data("dive-site", dive_site_id, current_user)
        share_content = share_service.format_share_content("dive-site", entity_data)
        
        return {
            "title": share_content["title"],
            "description": share_content["description"],
            "entity_data": entity_data
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/dive-routes/{route_id}", response_model=Dict)
@skip_rate_limit_for_admin(SHARE_RATE_LIMIT)
@limiter.limit(SHARE_RATE_LIMIT)
async def share_dive_route(
    request: Request,
    route_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Generate shareable content for a dive route.
    
    Returns share URL, formatted content, and platform-specific share links.
    Also tracks share interaction for analytics.
    """
    share_service = ShareService(db)
    
    try:
        # Get entity data
        entity_data = share_service.get_entity_data("route", route_id, current_user)
        
        # Generate share URL
        share_url = share_service.generate_share_url("route", route_id, request)
        
        # Format share content
        share_content = share_service.format_share_content("route", entity_data)
        
        # Get platform share URLs
        platform_urls = share_service.get_platform_share_urls(
            share_url,
            share_content["title"],
            share_content["description"],
            "route"
        )
        
        # Track share interaction for analytics (if user is authenticated)
        if current_user:
            try:
                analytics_service = RouteAnalyticsService(db)
                analytics_service.track_interaction(
                    route_id=route_id,
                    interaction_type="share",
                    user_id=current_user.id,
                    ip_address=get_remote_address(request),
                    user_agent=request.headers.get("user-agent"),
                    referrer=request.headers.get("referer"),
                    extra_data={
                        "share_url": share_url,
                        "endpoint": str(request.url),
                        "method": request.method
                    }
                )
            except Exception as e:
                # Analytics tracking failure shouldn't break the share
                print(f"Analytics tracking failed for route share: {e}")
        
        return {
            "share_url": share_url,
            "title": share_content["title"],
            "description": share_content["description"],
            "share_platforms": platform_urls,
            "metadata": {
                "entity_type": "route",
                "entity_id": route_id,
                "shared_at": datetime.utcnow().isoformat(),
                "shared_by": current_user.id if current_user else None
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/dive-routes/{route_id}/preview", response_model=Dict)
@skip_rate_limit_for_admin(SHARE_RATE_LIMIT)
@limiter.limit(SHARE_RATE_LIMIT)
async def get_dive_route_share_preview(
    request: Request,
    route_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get preview data for sharing a dive route."""
    share_service = ShareService(db)
    
    try:
        entity_data = share_service.get_entity_data("route", route_id, current_user)
        share_content = share_service.format_share_content("route", entity_data)
        
        return {
            "title": share_content["title"],
            "description": share_content["description"],
            "entity_data": entity_data
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

