from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc, asc, text, Integer
from datetime import datetime, timedelta, timezone
import psutil
import os
import logging
import bisect

from app.database import get_db
from app.models import (
    User, DiveSite, DivingCenter, Dive, SiteRating, CenterRating,
    SiteComment, CenterComment, SiteMedia, DiveMedia, AvailableTag,
    DivingOrganization, UserCertification, ParsedDiveTrip, Newsletter,
    Notification, NotificationPreference, DiveRoute, RouteAnalytics
)
from app.auth import get_current_admin_user
from app.schemas import (
    SystemHealthResponse, PlatformStatsResponse,
    NotificationAnalyticsResponse, GrowthResponse
)
from app.utils import get_client_ip, format_ip_for_logging
from app.monitoring import get_turnstile_stats
from app.services.r2_storage_service import r2_storage

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get("/metrics", response_model=SystemHealthResponse)
async def get_system_metrics(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get system-oriented metrics: health, storage, usage, and alerts"""
    
    # Get system health (reuse existing endpoint logic)
    return await get_system_health(current_user, db)

@router.get("/statistics")
async def get_general_statistics(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get general statistics: platform stats, geographic distribution, and notification analytics"""
    
    # Calculate date ranges
    now = datetime.now(timezone.utc)
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
    
    # Calculate user growth rate
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
    total_dive_routes = db.query(func.count(DiveRoute.id)).filter(
        DiveRoute.deleted_at.is_(None)
    ).scalar()
    total_dive_trips = db.query(func.count(ParsedDiveTrip.id)).scalar()
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
    
    # Diving Centers by Country
    diving_centers_by_country = db.query(
        DivingCenter.country,
        func.count(DivingCenter.id).label('count')
    ).filter(
        DivingCenter.country.isnot(None)
    ).group_by(DivingCenter.country).order_by(desc('count')).limit(10).all()
    
    # User Certifications Statistics
    total_user_certifications = db.query(func.count(UserCertification.id)).scalar()
    certifications_by_org = db.query(
        DivingOrganization.name,
        DivingOrganization.acronym,
        func.count(UserCertification.id).label('count')
    ).join(
        UserCertification, DivingOrganization.id == UserCertification.diving_organization_id
    ).group_by(DivingOrganization.id, DivingOrganization.name, DivingOrganization.acronym).order_by(desc('count')).all()
    
    # Active Users (Last 7 days) - Users who performed any action
    active_user_ids_7d = set()
    # Users who created/updated dives
    active_user_ids_7d.update([
        user_id for user_id, in db.query(Dive.user_id).filter(
            Dive.created_at >= seven_days_ago
        ).distinct().all()
    ])
    active_user_ids_7d.update([
        user_id for user_id, in db.query(Dive.user_id).filter(
            Dive.updated_at >= seven_days_ago
        ).distinct().all()
    ])
    # Users who created comments
    active_user_ids_7d.update([
        user_id for user_id, in db.query(SiteComment.user_id).filter(
            SiteComment.created_at >= seven_days_ago
        ).distinct().all()
    ])
    active_user_ids_7d.update([
        user_id for user_id, in db.query(CenterComment.user_id).filter(
            CenterComment.created_at >= seven_days_ago
        ).distinct().all()
    ])
    # Users who created ratings
    active_user_ids_7d.update([
        user_id for user_id, in db.query(SiteRating.user_id).filter(
            SiteRating.created_at >= seven_days_ago
        ).distinct().all()
    ])
    active_user_ids_7d.update([
        user_id for user_id, in db.query(CenterRating.user_id).filter(
            CenterRating.created_at >= seven_days_ago
        ).distinct().all()
    ])
    # Users who viewed routes (RouteAnalytics)
    active_user_ids_7d.update([
        user_id for user_id, in db.query(RouteAnalytics.user_id).filter(
            and_(
                RouteAnalytics.created_at >= seven_days_ago,
                RouteAnalytics.user_id.isnot(None)
            )
        ).distinct().all()
    ])
    # Users who updated their profile
    active_user_ids_7d.update([
        user_id for user_id, in db.query(User.id).filter(
            User.updated_at >= seven_days_ago
        ).distinct().all()
    ])
    active_users_7d = len(active_user_ids_7d)
    
    # Email Verified Users
    email_verified_count = db.query(func.count(User.id)).filter(
        User.email_verified == True
    ).scalar()
    email_verified_percentage = (email_verified_count / total_users * 100) if total_users > 0 else 0
    
    # Users with Opted-Out Email Notifications
    opted_out_count = db.query(func.count(User.id)).filter(
        User.email_notifications_opted_out == True
    ).scalar()
    
    # Total Tags
    total_tags = db.query(func.count(AvailableTag.id)).scalar()
    
    # Diving Organizations
    total_diving_organizations = db.query(func.count(DivingOrganization.id)).scalar()
    
    # Newsletters
    total_newsletters = db.query(func.count(Newsletter.id)).scalar()
    
    # New Content (Last 7/30 days)
    new_dive_sites_7d = db.query(func.count(DiveSite.id)).filter(
        DiveSite.created_at >= seven_days_ago
    ).scalar()
    new_dive_sites_30d = db.query(func.count(DiveSite.id)).filter(
        DiveSite.created_at >= thirty_days_ago
    ).scalar()
    
    new_diving_centers_7d = db.query(func.count(DivingCenter.id)).filter(
        DivingCenter.created_at >= seven_days_ago
    ).scalar()
    new_diving_centers_30d = db.query(func.count(DivingCenter.id)).filter(
        DivingCenter.created_at >= thirty_days_ago
    ).scalar()
    
    new_dives_7d = db.query(func.count(Dive.id)).filter(
        Dive.created_at >= seven_days_ago
    ).scalar()
    new_dives_30d = db.query(func.count(Dive.id)).filter(
        Dive.created_at >= thirty_days_ago
    ).scalar()
    
    new_routes_7d = db.query(func.count(DiveRoute.id)).filter(
        and_(
            DiveRoute.created_at >= seven_days_ago,
            DiveRoute.deleted_at.is_(None)
        )
    ).scalar()
    new_routes_30d = db.query(func.count(DiveRoute.id)).filter(
        and_(
            DiveRoute.created_at >= thirty_days_ago,
            DiveRoute.deleted_at.is_(None)
        )
    ).scalar()
    
    new_trips_7d = db.query(func.count(ParsedDiveTrip.id)).filter(
        ParsedDiveTrip.created_at >= seven_days_ago
    ).scalar()
    new_trips_30d = db.query(func.count(ParsedDiveTrip.id)).filter(
        ParsedDiveTrip.created_at >= thirty_days_ago
    ).scalar()
    
    # System Usage (simplified - in production this would come from logs/analytics)
    api_calls_today = 0  # This would be tracked in production
    peak_usage_time = "14:00-16:00"  # Placeholder
    most_accessed_endpoint = "/api/v1/dive-sites"  # Placeholder
    
    # Notification Analytics (inline to avoid circular import)
    force_direct_email = os.getenv("FORCE_DIRECT_EMAIL", "false").lower() == "true"
    
    # In-App Notification Statistics
    total_notifications = db.query(func.count(Notification.id)).scalar()
    read_notifications = db.query(func.count(Notification.id)).filter(
        Notification.is_read == True
    ).scalar()
    unread_notifications = total_notifications - read_notifications
    read_rate = (read_notifications / total_notifications * 100) if total_notifications > 0 else 0
    
    # In-app notifications by category
    in_app_by_category = {}
    category_stats = db.query(
        Notification.category,
        func.count(Notification.id).label('total'),
        func.sum(func.cast(Notification.is_read, Integer)).label('read')
    ).group_by(Notification.category).all()
    
    for category, total, read_count in category_stats:
        in_app_by_category[category] = {
            "total": total,
            "read": read_count or 0,
            "unread": total - (read_count or 0)
        }
    
    # Email Delivery Statistics
    total_email_sent = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True
    ).scalar()
    
    queued_to_sqs = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == False,
        Notification.created_at <= now
    ).scalar()
    
    if force_direct_email:
        sent_directly_to_ses = total_email_sent
    else:
        five_minutes_ago = now - timedelta(minutes=5)
        sent_directly_to_ses = db.query(func.count(Notification.id)).filter(
            Notification.email_sent == True,
            Notification.email_sent_at.isnot(None),
            Notification.created_at >= five_minutes_ago,
            Notification.email_sent_at <= Notification.created_at + timedelta(minutes=5)
        ).scalar()
    
    total_eligible_for_email = db.query(func.count(Notification.id)).filter(
        Notification.category != 'admin_alerts'
    ).scalar()
    delivery_rate = (total_email_sent / total_eligible_for_email * 100) if total_eligible_for_email > 0 else 0
    
    avg_delivery_time = None
    sent_notifications = db.query(Notification).filter(
        Notification.email_sent == True,
        Notification.email_sent_at.isnot(None)
    ).limit(1000).all()  # Limit for performance
    
    if sent_notifications:
        delivery_times = []
        for notif in sent_notifications:
            if notif.created_at and notif.email_sent_at:
                created_at = notif.created_at
                sent_at = notif.email_sent_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if sent_at.tzinfo is None:
                    sent_at = sent_at.replace(tzinfo=timezone.utc)
                delta = (sent_at - created_at).total_seconds()
                if delta >= 0:
                    delivery_times.append(delta)
        
        if delivery_times:
            avg_delivery_time = sum(delivery_times) / len(delivery_times)
    
    email_by_category = db.query(
        Notification.category,
        func.count(Notification.id).label('total'),
        func.sum(func.cast(Notification.email_sent, Integer)).label('sent')
    ).group_by(Notification.category).all()
    
    category_stats_list = []
    for category, total, sent_count in email_by_category:
        sent = sent_count or 0
        delivery_rate_cat = (sent / total * 100) if total > 0 else 0
        category_stats_list.append({
            "category": category,
            "total_notifications": total,
            "in_app_sent": total,
            "email_sent": sent,
            "email_delivery_rate": round(delivery_rate_cat, 2)
        })
    
    notifications_24h = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= one_day_ago
    ).scalar()
    notifications_7d = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= seven_days_ago
    ).scalar()
    notifications_30d = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= thirty_days_ago
    ).scalar()
    
    emails_sent_24h = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True,
        Notification.created_at >= one_day_ago
    ).scalar()
    emails_sent_7d = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True,
        Notification.created_at >= seven_days_ago
    ).scalar()
    emails_sent_30d = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True,
        Notification.created_at >= thirty_days_ago
    ).scalar()
    
    notification_analytics = {
        "in_app": {
            "total": total_notifications,
            "read": read_notifications,
            "unread": unread_notifications,
            "read_rate": round(read_rate, 2),
            "by_category": in_app_by_category
        },
        "email_delivery": {
            "total_sent": total_email_sent,
            "sent_directly_to_ses": sent_directly_to_ses,
            "queued_to_sqs": queued_to_sqs + (total_email_sent - sent_directly_to_ses if not force_direct_email else 0),
            "delivery_rate": round(delivery_rate, 2),
            "avg_delivery_time_seconds": round(avg_delivery_time, 2) if avg_delivery_time else None
        },
        "by_category": category_stats_list,
        "time_stats": {
            "last_24h": {
                "notifications": notifications_24h,
                "emails_sent": emails_sent_24h
            },
            "last_7d": {
                "notifications": notifications_7d,
                "emails_sent": emails_sent_7d
            },
            "last_30d": {
                "notifications": notifications_30d,
                "emails_sent": emails_sent_30d
            }
        },
        "timestamp": now.isoformat()
    }
    
    return {
        "platform_stats": {
            "users": {
                "total": total_users,
                "active_30d": active_users_30d,
                "active_7d": active_users_7d,
                "new_7d": new_users_7d,
                "new_30d": new_users_30d,
                "growth_rate": round(growth_rate, 2),
                "email_verified": {
                    "count": email_verified_count,
                    "percentage": round(email_verified_percentage, 2)
                },
                "email_opted_out": opted_out_count,
                "certifications": {
                    "total": total_user_certifications,
                    "by_organization": [
                        {
                            "name": name,
                            "acronym": acronym,
                            "count": count
                        }
                        for name, acronym, count in certifications_by_org
                    ]
                }
            },
            "content": {
                "dive_sites": total_dive_sites,
                "diving_centers": total_diving_centers,
                "dives": total_dives,
                "dive_routes": total_dive_routes,
                "dive_trips": total_dive_trips,
                "comments": total_comments,
                "ratings": total_ratings,
                "media_uploads": total_media,
                "tags": total_tags,
                "diving_organizations": total_diving_organizations,
                "newsletters": total_newsletters,
                "new_content_7d": {
                    "dive_sites": new_dive_sites_7d,
                    "diving_centers": new_diving_centers_7d,
                    "dives": new_dives_7d,
                    "routes": new_routes_7d,
                    "trips": new_trips_7d
                },
                "new_content_30d": {
                    "dive_sites": new_dive_sites_30d,
                    "diving_centers": new_diving_centers_30d,
                    "dives": new_dives_30d,
                    "routes": new_routes_30d,
                    "trips": new_trips_30d
                }
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
                ],
                "diving_centers_by_country": [
                    {"country": country, "count": count}
                    for country, count in diving_centers_by_country
                ]
            },
            "system_usage": {
                "api_calls_today": api_calls_today,
                "peak_usage_time": peak_usage_time,
                "most_accessed_endpoint": most_accessed_endpoint
            }
        },
        "notification_analytics": notification_analytics,
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

@router.get("/client-ip")
async def get_client_ip_info(request: Request):
    """
    Debug endpoint to show client IP detection information.
    This endpoint is useful for testing and debugging client IP detection
    in various proxy and load balancer configurations.
    """
    # Get the real client IP using our utility function
    real_client_ip = get_client_ip(request)
    
    # Get all relevant headers for debugging
    headers_info = {}
    for header_name in [
        'Fly-Client-IP', 'X-Real-IP', 'X-Forwarded-For', 
        'X-Forwarded-Host', 'X-Forwarded-Proto', 'CF-Connecting-IP',
        'True-Client-IP', 'X-Client-IP', 'X-Originating-IP'
    ]:
        if header_name in request.headers:
            headers_info[header_name] = request.headers[header_name]
    
    # Get connection information
    connection_info = {
        "client_host": getattr(request.client, 'host', None) if request.client else None,
        "client_port": getattr(request.client, 'port', None) if request.client else None,
        "remote_addr": getattr(request, 'remote_addr', None),
        "url": str(request.url),
        "method": request.method,
        "user_agent": request.headers.get("User-Agent", "Unknown")
    }
    
    return {
        "detected_client_ip": real_client_ip,
        "formatted_ip": format_ip_for_logging(real_client_ip),
        "is_localhost": real_client_ip in ["127.0.0.1", "::1", "localhost"],
        "headers": headers_info,
        "connection": connection_info,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/turnstile-stats")
async def get_turnstile_statistics(
    current_user: User = Depends(get_current_admin_user),
    time_window: Optional[int] = Query(24, description="Time window in hours")
):
    """Get Turnstile verification statistics for admin monitoring"""
    
    try:
        # Convert hours to timedelta if specified
        if time_window and time_window > 0:
            window = timedelta(hours=time_window)
        else:
            window = None
        
        # Get Turnstile statistics
        stats = get_turnstile_stats(window)
        
        # Add additional context
        stats["timestamp"] = datetime.utcnow().isoformat()
        stats["time_window_hours"] = time_window if time_window else None
        stats["monitoring_active"] = True
        
        return stats
        
    except Exception as e:
        logger.error(f"Error retrieving Turnstile statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve Turnstile statistics"
        )

@router.get("/storage/health")
def storage_health_check():
    """Check storage service health (R2 and local fallback)"""
    try:
        health_status = r2_storage.health_check()
        return health_status
    except Exception as e:
        return {
            "error": str(e),
            "r2_available": False,
            "local_storage_available": False,
            "bucket_accessible": False,
            "credentials_present": False,
            "boto3_available": False,
            "local_storage_writable": False
        }

# Constants for growth data periods
PERIOD_DAYS = {
    "week": 7,
    "month": 30,
    "3months": 90,
    "6months": 180,
    "year": 365
}

def date_to_datetime(date_obj):
    """Convert date object to timezone-aware datetime at start of day"""
    return datetime.combine(date_obj, datetime.min.time()).replace(tzinfo=timezone.utc)

def calculate_growth_rate(start, end):
    """Calculate percentage growth rate between two values"""
    if start > 0:
        return round(((end - start) / start * 100), 2)
    return 0.0

@router.get("/growth", response_model=GrowthResponse)
async def get_growth_data(
    period: str = Query("3months", pattern="^(week|month|3months|6months|year)$"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get growth data over time for dive sites, diving centers, dives, routes, and trips"""
    
    try:
        now = datetime.now(timezone.utc)
        
        # Calculate date range based on period
        days_back = PERIOD_DAYS.get(period, 30)
        start_date = now - timedelta(days=days_back)
        
        # Generate date points (daily for week/month, weekly for longer periods)
        date_points = []
        if period in ("year", "6months", "3months"):
            # Weekly intervals for longer periods
            current = start_date
            while current <= now:
                date_points.append(current.date())
                current += timedelta(days=7)
        else:
            # Daily intervals for week/month
            current = start_date
            while current <= now:
                date_points.append(current.date())
                current += timedelta(days=1)
        
        # Validate date points
        if not date_points:
            return {
                "period": period,
                "growth_data": {
                    "dive_sites": [],
                    "diving_centers": [],
                    "dives": [],
                    "dive_routes": [],
                    "dive_trips": []
                },
                "growth_rates": {
                    "dive_sites": 0.0,
                    "diving_centers": 0.0,
                    "dives": 0.0,
                    "dive_routes": 0.0,
                    "dive_trips": 0.0
                },
                "start_date": start_date.date().isoformat(),
                "end_date": now.date().isoformat()
            }
        
        # OPTIMIZATION: Query all items once instead of per date point (5 queries total vs 5*N queries)
        # Get all created_at dates for each entity type and sort them for efficient counting
        dive_sites_dates = sorted([
            item[0].date() for item in db.query(DiveSite.created_at).all()
            if item[0] and item[0].date()
        ])
        diving_centers_dates = sorted([
            item[0].date() for item in db.query(DivingCenter.created_at).all()
            if item[0] and item[0].date()
        ])
        dives_dates = sorted([
            item[0].date() for item in db.query(Dive.created_at).all()
            if item[0] and item[0].date()
        ])
        dive_routes_dates = sorted([
            item[0].date() for item in db.query(DiveRoute.created_at).filter(
                DiveRoute.deleted_at.is_(None)
            ).all()
            if item[0] and item[0].date()
        ])
        dive_trips_dates = sorted([
            item[0].date() for item in db.query(ParsedDiveTrip.created_at).all()
            if item[0] and item[0].date()
        ])
        
        # Helper function to count items <= date using binary search
        def count_up_to_date(sorted_dates, target_date):
            """Count how many dates are <= target_date using binary search"""
            # Find insertion point (all items before this index are <= target_date)
            return bisect.bisect_right(sorted_dates, target_date)
        
        # Calculate cumulative counts for each date point
        growth_data = {
            "dive_sites": [],
            "diving_centers": [],
            "dives": [],
            "dive_routes": [],
            "dive_trips": []
        }
        
        for date_point in date_points:
            # Count items created on or before this date using binary search
            dive_sites_count = count_up_to_date(dive_sites_dates, date_point)
            diving_centers_count = count_up_to_date(diving_centers_dates, date_point)
            dives_count = count_up_to_date(dives_dates, date_point)
            dive_routes_count = count_up_to_date(dive_routes_dates, date_point)
            dive_trips_count = count_up_to_date(dive_trips_dates, date_point)
            
            growth_data["dive_sites"].append({
                "date": date_point.isoformat(),
                "count": dive_sites_count
            })
            growth_data["diving_centers"].append({
                "date": date_point.isoformat(),
                "count": diving_centers_count
            })
            growth_data["dives"].append({
                "date": date_point.isoformat(),
                "count": dives_count
            })
            growth_data["dive_routes"].append({
                "date": date_point.isoformat(),
                "count": dive_routes_count
            })
            growth_data["dive_trips"].append({
                "date": date_point.isoformat(),
                "count": dive_trips_count
            })
        
        # Calculate growth rates using data already collected (no duplicate queries)
        if len(date_points) >= 2:
            dive_sites_start = growth_data["dive_sites"][0]["count"]
            dive_sites_end = growth_data["dive_sites"][-1]["count"]
            
            diving_centers_start = growth_data["diving_centers"][0]["count"]
            diving_centers_end = growth_data["diving_centers"][-1]["count"]
            
            dives_start = growth_data["dives"][0]["count"]
            dives_end = growth_data["dives"][-1]["count"]
            
            dive_routes_start = growth_data["dive_routes"][0]["count"]
            dive_routes_end = growth_data["dive_routes"][-1]["count"]
            
            dive_trips_start = growth_data["dive_trips"][0]["count"]
            dive_trips_end = growth_data["dive_trips"][-1]["count"]
            
            growth_rates = {
                "dive_sites": calculate_growth_rate(dive_sites_start, dive_sites_end),
                "diving_centers": calculate_growth_rate(diving_centers_start, diving_centers_end),
                "dives": calculate_growth_rate(dives_start, dives_end),
                "dive_routes": calculate_growth_rate(dive_routes_start, dive_routes_end),
                "dive_trips": calculate_growth_rate(dive_trips_start, dive_trips_end)
            }
        else:
            growth_rates = {
                "dive_sites": 0.0,
                "diving_centers": 0.0,
                "dives": 0.0,
                "dive_routes": 0.0,
                "dive_trips": 0.0
            }
        
        return {
            "period": period,
            "growth_data": growth_data,
            "growth_rates": growth_rates,
            "start_date": start_date.date().isoformat(),
            "end_date": now.date().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error fetching growth data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch growth data"
        )

@router.get("/notifications/analytics", response_model=NotificationAnalyticsResponse)
async def get_notification_analytics(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get notification analytics including in-app and email delivery statistics"""
    
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    
    # Check if FORCE_DIRECT_EMAIL is enabled (affects delivery method tracking)
    force_direct_email = os.getenv("FORCE_DIRECT_EMAIL", "false").lower() == "true"
    
    # In-App Notification Statistics
    total_notifications = db.query(func.count(Notification.id)).scalar()
    read_notifications = db.query(func.count(Notification.id)).filter(
        Notification.is_read == True
    ).scalar()
    unread_notifications = total_notifications - read_notifications
    read_rate = (read_notifications / total_notifications * 100) if total_notifications > 0 else 0
    
    # In-app notifications by category
    in_app_by_category = {}
    category_stats = db.query(
        Notification.category,
        func.count(Notification.id).label('total'),
        func.sum(func.cast(Notification.is_read, Integer)).label('read')
    ).group_by(Notification.category).all()
    
    for category, total, read_count in category_stats:
        in_app_by_category[category] = {
            "total": total,
            "read": read_count or 0,
            "unread": total - (read_count or 0)
        }
    
    # Email Delivery Statistics
    total_email_sent = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True
    ).scalar()
    
    # Estimate: emails with email_sent=False are queued to SQS (not yet sent)
    queued_to_sqs = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == False,
        Notification.created_at <= now  # Only count existing notifications
    ).scalar()
    
    # Estimate direct SES sends: if FORCE_DIRECT_EMAIL is enabled, count recent sent emails as direct
    # Otherwise, assume most sent emails went through SQS/Lambda
    # For accuracy, we'll track: emails sent in last hour with FORCE_DIRECT_EMAIL = direct
    one_hour_ago = now - timedelta(hours=1)
    if force_direct_email:
        # In direct mode, all sent emails are direct
        sent_directly_to_ses = total_email_sent
    else:
        # Estimate: check if email was sent very quickly (likely direct fallback)
        # Emails sent within 5 minutes of creation are likely direct
        five_minutes_ago = now - timedelta(minutes=5)
        sent_directly_to_ses = db.query(func.count(Notification.id)).filter(
            Notification.email_sent == True,
            Notification.email_sent_at.isnot(None),
            Notification.created_at >= five_minutes_ago,
            Notification.email_sent_at <= Notification.created_at + timedelta(minutes=5)
        ).scalar()
        # Remaining sent emails are assumed to be via SQS/Lambda
        sent_via_sqs_lambda = total_email_sent - sent_directly_to_ses
    
    # Calculate delivery rate (emails sent / total notifications eligible for email)
    total_eligible_for_email = db.query(func.count(Notification.id)).filter(
        Notification.category != 'admin_alerts'  # Admin alerts may not always have email
    ).scalar()
    delivery_rate = (total_email_sent / total_eligible_for_email * 100) if total_eligible_for_email > 0 else 0
    
    # Calculate average delivery time (for emails that were sent)
    avg_delivery_time = None
    sent_notifications = db.query(Notification).filter(
        Notification.email_sent == True,
        Notification.email_sent_at.isnot(None)
    ).all()
    
    if sent_notifications:
        delivery_times = []
        for notif in sent_notifications:
            if notif.created_at and notif.email_sent_at:
                # Ensure timezone-aware
                created_at = notif.created_at
                sent_at = notif.email_sent_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if sent_at.tzinfo is None:
                    sent_at = sent_at.replace(tzinfo=timezone.utc)
                delta = (sent_at - created_at).total_seconds()
                if delta >= 0:  # Only count positive deltas
                    delivery_times.append(delta)
        
        if delivery_times:
            avg_delivery_time = sum(delivery_times) / len(delivery_times)
    
    # Email delivery by category
    email_by_category = db.query(
        Notification.category,
        func.count(Notification.id).label('total'),
        func.sum(func.cast(Notification.email_sent, Integer)).label('sent')
    ).group_by(Notification.category).all()
    
    category_stats_list = []
    for category, total, sent_count in email_by_category:
        sent = sent_count or 0
        delivery_rate_cat = (sent / total * 100) if total > 0 else 0
        category_stats_list.append({
            "category": category,
            "total_notifications": total,
            "in_app_sent": total,  # All notifications are in-app
            "email_sent": sent,
            "email_delivery_rate": round(delivery_rate_cat, 2)
        })
    
    # Time-based statistics
    notifications_24h = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= one_day_ago
    ).scalar()
    notifications_7d = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= seven_days_ago
    ).scalar()
    notifications_30d = db.query(func.count(Notification.id)).filter(
        Notification.created_at >= thirty_days_ago
    ).scalar()
    
    emails_sent_24h = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True,
        Notification.created_at >= one_day_ago
    ).scalar()
    emails_sent_7d = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True,
        Notification.created_at >= seven_days_ago
    ).scalar()
    emails_sent_30d = db.query(func.count(Notification.id)).filter(
        Notification.email_sent == True,
        Notification.created_at >= thirty_days_ago
    ).scalar()
    
    return {
        "in_app": {
            "total": total_notifications,
            "read": read_notifications,
            "unread": unread_notifications,
            "read_rate": round(read_rate, 2),
            "by_category": in_app_by_category
        },
        "email_delivery": {
            "total_sent": total_email_sent,
            "sent_directly_to_ses": sent_directly_to_ses,
            "queued_to_sqs": queued_to_sqs + (total_email_sent - sent_directly_to_ses if not force_direct_email else 0),
            "delivery_rate": round(delivery_rate, 2),
            "avg_delivery_time_seconds": round(avg_delivery_time, 2) if avg_delivery_time else None
        },
        "by_category": category_stats_list,
        "time_stats": {
            "last_24h": {
                "notifications": notifications_24h,
                "emails_sent": emails_sent_24h
            },
            "last_7d": {
                "notifications": notifications_7d,
                "emails_sent": emails_sent_7d
            },
            "last_30d": {
                "notifications": notifications_30d,
                "emails_sent": emails_sent_30d
            }
        },
        "timestamp": now.isoformat()
    }
