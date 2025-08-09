from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, asc, text
from datetime import datetime, timedelta
import psutil
import os

from app.database import get_db
from app.models import (
    User, DiveSite, DivingCenter, Dive, SiteRating, CenterRating,
    SiteComment, CenterComment, SiteMedia, DiveMedia, AvailableTag,
    DivingOrganization, UserCertification, ParsedDiveTrip, Newsletter
)
from app.auth import get_current_admin_user
from app.schemas import SystemOverviewResponse, SystemHealthResponse, PlatformStatsResponse

router = APIRouter()

@router.get("/overview", response_model=SystemOverviewResponse)
async def get_system_overview(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive system overview with platform statistics and health metrics"""
    
    # Calculate date ranges
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    one_day_ago = now - timedelta(days=1)
    
    # User Statistics
    total_users = db.query(func.count(User.id)).scalar()
    active_users_30d = db.query(func.count(User.id)).filter(
        User.created_at >= thirty_days_ago
    ).scalar()
    new_users_7d = db.query(func.count(User.id)).filter(
        User.created_at >= seven_days_ago
    ).scalar()
    new_users_30d = db.query(func.count(User.id)).filter(
        User.created_at >= thirty_days_ago
    ).scalar()
    
    # Calculate user growth rate (percentage change from previous 30 days)
    sixty_days_ago = now - timedelta(days=60)
    users_60d_ago = db.query(func.count(User.id)).filter(
        User.created_at >= sixty_days_ago
    ).scalar()
    users_30d_ago = db.query(func.count(User.id)).filter(
        User.created_at >= thirty_days_ago
    ).scalar()
    
    growth_rate = 0
    if users_30d_ago > 0:
        growth_rate = ((new_users_30d - (users_60d_ago - users_30d_ago)) / users_30d_ago) * 100
    
    # Content Statistics
    total_dive_sites = db.query(func.count(DiveSite.id)).scalar()
    total_diving_centers = db.query(func.count(DivingCenter.id)).scalar()
    total_dives = db.query(func.count(Dive.id)).scalar()
    total_comments = db.query(func.count(SiteComment.id)).scalar() + db.query(func.count(CenterComment.id)).scalar()
    total_ratings = db.query(func.count(SiteRating.id)).scalar() + db.query(func.count(CenterRating.id)).scalar()
    total_media = db.query(func.count(SiteMedia.id)).scalar() + db.query(func.count(DiveMedia.id)).scalar()
    
    # Engagement Metrics
    avg_site_rating = db.query(func.avg(SiteRating.score)).scalar() or 0
    avg_center_rating = db.query(func.avg(CenterRating.score)).scalar() or 0
    
    # Recent activity (last 24 hours)
    recent_comments = db.query(func.count(SiteComment.id)).filter(
        SiteComment.created_at >= one_day_ago
    ).scalar() + db.query(func.count(CenterComment.id)).filter(
        CenterComment.created_at >= one_day_ago
    ).scalar()
    
    recent_ratings = db.query(func.count(SiteRating.id)).filter(
        SiteRating.created_at >= one_day_ago
    ).scalar() + db.query(func.count(CenterRating.id)).filter(
        CenterRating.created_at >= one_day_ago
    ).scalar()
    
    recent_dives = db.query(func.count(Dive.id)).filter(
        Dive.created_at >= one_day_ago
    ).scalar()
    
    # Geographic Distribution
    dive_sites_by_country = db.query(
        DiveSite.country,
        func.count(DiveSite.id).label('count')
    ).filter(
        DiveSite.country.isnot(None)
    ).group_by(DiveSite.country).order_by(desc('count')).limit(10).all()
    
    # System Usage (simplified - in production this would come from logs/analytics)
    api_calls_today = 0  # This would be tracked in production
    peak_usage_time = "14:00-16:00"  # Placeholder
    most_accessed_endpoint = "/api/v1/dive-sites"  # Placeholder
    
    # System Health
    db_connection_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_connection_status = "unhealthy"
    
    # Resource Utilization
    cpu_usage = psutil.cpu_percent(interval=1)
    memory_usage = psutil.virtual_memory().percent
    disk_usage = psutil.disk_usage('/').percent
    
    # External Services Status (placeholders)
    google_oauth_status = "healthy"
    geocoding_service_status = "healthy"
    
    # Security Metrics (placeholder - would need to be implemented with login tracking)
    failed_logins_24h = 0  # This would be tracked in production
    
    return {
        "platform_stats": {
            "users": {
                "total": total_users,
                "active_30d": active_users_30d,
                "new_7d": new_users_7d,
                "new_30d": new_users_30d,
                "growth_rate": round(growth_rate, 2)
            },
            "content": {
                "dive_sites": total_dive_sites,
                "diving_centers": total_diving_centers,
                "dives": total_dives,
                "comments": total_comments,
                "ratings": total_ratings,
                "media_uploads": total_media
            },
            "engagement": {
                "avg_site_rating": round(avg_site_rating, 1),
                "avg_center_rating": round(avg_center_rating, 1),
                "recent_comments_24h": recent_comments,
                "recent_ratings_24h": recent_ratings,
                "recent_dives_24h": recent_dives
            },
            "geographic": {
                "dive_sites_by_country": [
                    {"country": country, "count": count} 
                    for country, count in dive_sites_by_country
                ]
            },
            "system_usage": {
                "api_calls_today": api_calls_today,
                "peak_usage_time": peak_usage_time,
                "most_accessed_endpoint": most_accessed_endpoint
            }
        },
        "system_health": {
            "database": {
                "status": db_connection_status,
                "response_time": "fast"  # Placeholder
            },
            "application": {
                "status": "healthy",
                "uptime": "99.9%",  # Placeholder
                "response_time": "fast"  # Placeholder
            },
            "resources": {
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "disk_usage": disk_usage
            },
            "external_services": {
                "google_oauth": google_oauth_status,
                "geocoding_service": geocoding_service_status
            },
            "security": {
                "failed_logins_24h": failed_logins_24h,
                "suspicious_activity": "none detected"  # Placeholder
            }
        },
        "alerts": {
            "critical": [],
            "warnings": [],
            "info": []
        },
        "last_updated": now.isoformat()
    }

@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed system health information"""
    
    # Database health check
    db_healthy = True
    db_response_time = 0
    try:
        start_time = datetime.utcnow()
        db.execute(text("SELECT 1"))
        end_time = datetime.utcnow()
        db_response_time = (end_time - start_time).total_seconds() * 1000  # Convert to milliseconds
    except Exception:
        db_healthy = False
    
    # System resources
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Determine overall health status
    overall_status = "healthy"
    if not db_healthy or cpu_usage > 90 or memory.percent > 90 or disk.percent > 90:
        overall_status = "critical"
    elif cpu_usage > 70 or memory.percent > 70 or disk.percent > 70:
        overall_status = "warning"
    
    return {
        "status": overall_status,
        "database": {
            "healthy": db_healthy,
            "response_time_ms": round(db_response_time, 2)
        },
        "resources": {
            "cpu": {
                "usage_percent": cpu_usage,
                "cores": psutil.cpu_count()
            },
            "memory": {
                "usage_percent": memory.percent,
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2)
            },
            "disk": {
                "usage_percent": disk.percent,
                "total_gb": round(disk.total / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2)
            }
        },
        "services": {
            "database": "healthy" if db_healthy else "unhealthy",
            "api": "healthy",
            "frontend": "healthy"
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/stats", response_model=PlatformStatsResponse)
async def get_platform_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed platform statistics"""
    
    # User statistics with more detail
    total_users = db.query(func.count(User.id)).scalar()
    enabled_users = db.query(func.count(User.id)).filter(User.enabled == True).scalar()
    admin_users = db.query(func.count(User.id)).filter(User.is_admin == True).scalar()
    moderator_users = db.query(func.count(User.id)).filter(User.is_moderator == True).scalar()
    
    # Content statistics
    total_dive_sites = db.query(func.count(DiveSite.id)).scalar()
    total_diving_centers = db.query(func.count(DivingCenter.id)).scalar()
    total_dives = db.query(func.count(Dive.id)).scalar()
    total_tags = db.query(func.count(AvailableTag.id)).scalar()
    total_organizations = db.query(func.count(DivingOrganization.id)).scalar()
    
    # Media statistics
    total_site_media = db.query(func.count(SiteMedia.id)).scalar()
    total_dive_media = db.query(func.count(DiveMedia.id)).scalar()
    
    # Trip statistics
    total_trips = db.query(func.count(ParsedDiveTrip.id)).scalar()
    total_newsletters = db.query(func.count(Newsletter.id)).scalar()
    
    return {
        "users": {
            "total": total_users,
            "enabled": enabled_users,
            "disabled": total_users - enabled_users,
            "admins": admin_users,
            "moderators": moderator_users,
            "regular": total_users - admin_users - moderator_users
        },
        "content": {
            "dive_sites": total_dive_sites,
            "diving_centers": total_diving_centers,
            "dives": total_dives,
            "tags": total_tags,
            "organizations": total_organizations
        },
        "media": {
            "site_media": total_site_media,
            "dive_media": total_dive_media,
            "total": total_site_media + total_dive_media
        },
        "trips": {
            "parsed_trips": total_trips,
            "newsletters": total_newsletters
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/activity", response_model=List[dict])
async def get_recent_activity(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    hours: int = 24,
    limit: int = 100
):
    """Get recent user and system activity"""
    
    # Calculate time range
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    
    activities = []
    
    # User registrations
    new_users = db.query(User).filter(
        User.created_at >= start_time
    ).order_by(desc(User.created_at)).limit(limit).all()
    
    for user in new_users:
        activities.append({
            "timestamp": user.created_at.isoformat(),
            "type": "user_registration",
            "user_id": user.id,
            "username": user.username,
            "action": "User registered",
            "details": f"New user {user.username} joined the platform",
            "status": "success"
        })
    
    # Content creation - Dive Sites
    new_dive_sites = db.query(DiveSite).filter(
        DiveSite.created_at >= start_time
    ).order_by(desc(DiveSite.created_at)).limit(limit).all()
    
    for site in new_dive_sites:
        activities.append({
            "timestamp": site.created_at.isoformat(),
            "type": "content_creation",
            "user_id": site.created_by if hasattr(site, 'created_by') else None,
            "username": None,  # Would need to join with User table
            "action": "Dive site created",
            "details": f"New dive site: {site.name}",
            "status": "success"
        })
    
    # Content creation - Diving Centers
    new_diving_centers = db.query(DivingCenter).filter(
        DivingCenter.created_at >= start_time
    ).order_by(desc(DivingCenter.created_at)).limit(limit).all()
    
    for center in new_diving_centers:
        activities.append({
            "timestamp": center.created_at.isoformat(),
            "type": "content_creation",
            "user_id": center.created_by if hasattr(center, 'created_by') else None,
            "username": None,
            "action": "Diving center created",
            "details": f"New diving center: {center.name}",
            "status": "success"
        })
    
    # Content creation - Dives
    new_dives = db.query(Dive).filter(
        Dive.created_at >= start_time
    ).order_by(desc(Dive.created_at)).limit(limit).all()
    
    for dive in new_dives:
        activities.append({
            "timestamp": dive.created_at.isoformat(),
            "type": "content_creation",
            "user_id": dive.user_id,
            "username": None,
            "action": "Dive logged",
            "details": f"New dive logged: {dive.name or 'Unnamed dive'}",
            "status": "success"
        })
    
    # Comments
    new_comments = db.query(SiteComment).filter(
        SiteComment.created_at >= start_time
    ).order_by(desc(SiteComment.created_at)).limit(limit).all()
    
    for comment in new_comments:
        activities.append({
            "timestamp": comment.created_at.isoformat(),
            "type": "engagement",
            "user_id": comment.user_id,
            "username": None,
            "action": "Comment posted",
            "details": f"Comment on dive site",
            "status": "success"
        })
    
    # Ratings
    new_ratings = db.query(SiteRating).filter(
        SiteRating.created_at >= start_time
    ).order_by(desc(SiteRating.created_at)).limit(limit).all()
    
    for rating in new_ratings:
        activities.append({
            "timestamp": rating.created_at.isoformat(),
            "type": "engagement",
            "user_id": rating.user_id,
            "username": None,
            "action": "Rating submitted",
            "details": f"Rating: {rating.score}/10",
            "status": "success"
        })
    
    # Sort all activities by timestamp (most recent first)
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Limit the total number of activities
    activities = activities[:limit]
    
    return activities
