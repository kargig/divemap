from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from app.database import get_db
from app.auth import get_current_active_user
from app.models import (
    User, Dive, DiveMedia, DiveTag, SiteRating, SiteComment, 
    CenterRating, CenterComment, UserCertification, DivingCenter,
    DiveSite, AvailableTag, DivingOrganization
)
from app.schemas import UserResponse

router = APIRouter()

# Privacy data export schemas
from pydantic import BaseModel

class UserDataExport(BaseModel):
    """Complete user data export schema"""
    user_profile: Dict[str, Any]
    dives: List[Dict[str, Any]]
    ratings: Dict[str, List[Dict[str, Any]]]
    comments: Dict[str, List[Dict[str, Any]]]
    certifications: List[Dict[str, Any]]
    owned_diving_centers: List[Dict[str, Any]]
    export_timestamp: str
    total_records: int

class AuditLogEntry(BaseModel):
    """Audit log entry schema"""
    timestamp: datetime
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    details: Dict[str, Any]
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogResponse(BaseModel):
    """Audit log response schema"""
    entries: List[AuditLogEntry]
    total_entries: int
    period_start: datetime
    period_end: datetime
    export_timestamp: str

@router.get("/data-export", response_model=UserDataExport)
async def export_user_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> UserDataExport:
    """
    Export all personal data for the authenticated user.
    
    This endpoint provides complete data portability in compliance with GDPR
    and privacy regulations. Users can only export their own data.
    
    Security: Only the authenticated user can access their own data.
    """
    
    # Export user profile data
    user_profile = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat(),
        "updated_at": current_user.updated_at.isoformat(),
        "is_admin": current_user.is_admin,
        "is_moderator": current_user.is_moderator,
        "enabled": current_user.enabled,
        "number_of_dives": current_user.number_of_dives,
        "avatar_url": current_user.avatar_url,
        "google_id": current_user.google_id if current_user.google_id else None
    }
    
    # Export user's dives with all related data
    from sqlalchemy.orm import joinedload
    dives_query = db.query(Dive).options(joinedload(Dive.difficulty)).filter(Dive.user_id == current_user.id).all()
    dives = []
    for dive in dives_query:
        # Get dive site info if linked
        dive_site_info = None
        if dive.dive_site_id:
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if dive_site:
                dive_site_info = {
                    "id": dive_site.id,
                    "name": dive_site.name,
                    "latitude": float(dive_site.latitude) if dive_site.latitude else None,
                    "longitude": float(dive_site.longitude) if dive_site.longitude else None
                }
        
        # Get diving center info if linked
        diving_center_info = None
        if dive.diving_center_id:
            diving_center = db.query(DivingCenter).filter(DivingCenter.id == dive.diving_center_id).first()
            if diving_center:
                diving_center_info = {
                    "id": diving_center.id,
                    "name": diving_center.name
                }
        
        # Get dive media
        media_query = db.query(DiveMedia).filter(DiveMedia.dive_id == dive.id).all()
        media = [{
            "id": m.id,
            "media_type": m.media_type.value,
            "url": m.url,
            "description": m.description,
            "title": m.title,
            "thumbnail_url": m.thumbnail_url,
            "created_at": m.created_at.isoformat()
        } for m in media_query]
        
        # Get dive tags
        tags_query = db.query(DiveTag).join(AvailableTag).filter(DiveTag.dive_id == dive.id).all()
        tags = [{
            "id": dt.tag_id,
            "name": dt.tag.name,
            "description": dt.tag.description
        } for dt in tags_query]
        
        dive_data = {
            "id": dive.id,
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
            "dive_date": dive.dive_date.isoformat(),
            "dive_time": dive.dive_time.isoformat() if dive.dive_time else None,
            "duration": dive.duration,
            "view_count": dive.view_count,
            "created_at": dive.created_at.isoformat(),
            "updated_at": dive.updated_at.isoformat(),
            "dive_site": dive_site_info,
            "diving_center": diving_center_info,
            "media": media,
            "tags": tags
        }
        dives.append(dive_data)
    
    # Export user's ratings
    site_ratings_query = db.query(SiteRating).join(DiveSite).filter(SiteRating.user_id == current_user.id).all()
    site_ratings = [{
        "id": sr.id,
        "dive_site_id": sr.dive_site_id,
        "dive_site_name": sr.dive_site.name,
        "score": sr.score,
        "created_at": sr.created_at.isoformat()
    } for sr in site_ratings_query]
    
    center_ratings_query = db.query(CenterRating).join(DivingCenter).filter(CenterRating.user_id == current_user.id).all()
    center_ratings = [{
        "id": cr.id,
        "diving_center_id": cr.diving_center_id,
        "diving_center_name": cr.diving_center.name,
        "score": cr.score,
        "created_at": cr.created_at.isoformat()
    } for cr in center_ratings_query]
    
    ratings = {
        "dive_sites": site_ratings,
        "diving_centers": center_ratings
    }
    
    # Export user's comments
    site_comments_query = db.query(SiteComment).join(DiveSite).filter(SiteComment.user_id == current_user.id).all()
    site_comments = [{
        "id": sc.id,
        "dive_site_id": sc.dive_site_id,
        "dive_site_name": sc.dive_site.name,
        "comment_text": sc.comment_text,
        "created_at": sc.created_at.isoformat(),
        "updated_at": sc.updated_at.isoformat()
    } for sc in site_comments_query]
    
    center_comments_query = db.query(CenterComment).join(DivingCenter).filter(CenterComment.user_id == current_user.id).all()
    center_comments = [{
        "id": cc.id,
        "diving_center_id": cc.diving_center_id,
        "diving_center_name": cc.diving_center.name,
        "comment_text": cc.comment_text,
        "created_at": cc.created_at.isoformat(),
        "updated_at": cc.updated_at.isoformat()
    } for cc in center_comments_query]
    
    comments = {
        "dive_sites": site_comments,
        "diving_centers": center_comments
    }
    
    # Export user's certifications
    certifications_query = db.query(UserCertification).join(DivingOrganization).filter(
        UserCertification.user_id == current_user.id
    ).all()
    certifications = [{
        "id": uc.id,
        "diving_organization_id": uc.diving_organization_id,
        "organization_name": uc.diving_organization.name,
        "organization_acronym": uc.diving_organization.acronym,
        "certification_level": uc.certification_level,
        "is_active": uc.is_active,
        "created_at": uc.created_at.isoformat(),
        "updated_at": uc.updated_at.isoformat()
    } for uc in certifications_query]
    
    # Export user's owned diving centers
    owned_centers_query = db.query(DivingCenter).filter(DivingCenter.owner_id == current_user.id).all()
    owned_diving_centers = [{
        "id": dc.id,
        "name": dc.name,
        "description": dc.description,
        "email": dc.email,
        "phone": dc.phone,
        "website": dc.website,
        "latitude": float(dc.latitude) if dc.latitude else None,
        "longitude": float(dc.longitude) if dc.longitude else None,
        "ownership_status": dc.ownership_status.value,
        "created_at": dc.created_at.isoformat(),
        "updated_at": dc.updated_at.isoformat()
    } for dc in owned_centers_query]
    
    # Calculate total records
    total_records = (
        1 +  # user profile
        len(dives) +
        len(site_ratings) + len(center_ratings) +
        len(site_comments) + len(center_comments) +
        len(certifications) +
        len(owned_diving_centers)
    )
    
    return UserDataExport(
        user_profile=user_profile,
        dives=dives,
        ratings=ratings,
        comments=comments,
        certifications=certifications,
        owned_diving_centers=owned_diving_centers,
        export_timestamp=datetime.utcnow().isoformat(),
        total_records=total_records
    )

@router.get("/audit-log", response_model=AuditLogResponse)
async def get_user_audit_log(
    days: int = 30,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> AuditLogResponse:
    """
    Get audit trail of user's data access and modifications.
    
    This endpoint provides transparency about what data has been accessed
    and modified for the authenticated user in compliance with GDPR
    right to information.
    
    Args:
        days: Number of days to look back (default: 30, max: 365)
        limit: Maximum number of entries to return (default: 100, max: 1000)
        offset: Number of entries to skip for pagination (default: 0)
    
    Security: Only the authenticated user can access their own audit trail.
    """
    
    # Validate parameters
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Days parameter must be between 1 and 365"
        )
    
    if limit < 1 or limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit parameter must be between 1 and 1000"
        )
    
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset parameter must be non-negative"
        )
    
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Build audit log entries from various user activities
    # Since we don't have a dedicated audit table, we'll construct the audit trail
    # from the data we have about user activities
    
    audit_entries = []
    
    # Recent dive creations/updates
    recent_dives = db.query(Dive).filter(
        Dive.user_id == current_user.id,
        Dive.created_at >= start_date,
        Dive.created_at <= end_date
    ).order_by(desc(Dive.created_at)).all()
    
    for dive in recent_dives:
        audit_entries.append(AuditLogEntry(
            timestamp=dive.created_at,
            action="CREATE" if dive.created_at == dive.updated_at else "UPDATE",
            resource_type="dive",
            resource_id=dive.id,
            details={
                "dive_name": dive.name,
                "dive_site_id": dive.dive_site_id,
                "is_private": dive.is_private,
                "dive_date": dive.dive_date.isoformat()
            }
        ))
    
    # Recent ratings given
    recent_site_ratings = db.query(SiteRating).join(DiveSite).filter(
        SiteRating.user_id == current_user.id,
        SiteRating.created_at >= start_date,
        SiteRating.created_at <= end_date
    ).order_by(desc(SiteRating.created_at)).all()
    
    for rating in recent_site_ratings:
        audit_entries.append(AuditLogEntry(
            timestamp=rating.created_at,
            action="CREATE",
            resource_type="site_rating",
            resource_id=rating.id,
            details={
                "dive_site_name": rating.dive_site.name,
                "score": rating.score
            }
        ))
    
    recent_center_ratings = db.query(CenterRating).join(DivingCenter).filter(
        CenterRating.user_id == current_user.id,
        CenterRating.created_at >= start_date,
        CenterRating.created_at <= end_date
    ).order_by(desc(CenterRating.created_at)).all()
    
    for rating in recent_center_ratings:
        audit_entries.append(AuditLogEntry(
            timestamp=rating.created_at,
            action="CREATE",
            resource_type="center_rating",
            resource_id=rating.id,
            details={
                "diving_center_name": rating.diving_center.name,
                "score": rating.score
            }
        ))
    
    # Recent comments posted
    recent_site_comments = db.query(SiteComment).join(DiveSite).filter(
        SiteComment.user_id == current_user.id,
        SiteComment.created_at >= start_date,
        SiteComment.created_at <= end_date
    ).order_by(desc(SiteComment.created_at)).all()
    
    for comment in recent_site_comments:
        action = "CREATE" if comment.created_at == comment.updated_at else "UPDATE"
        audit_entries.append(AuditLogEntry(
            timestamp=comment.updated_at if action == "UPDATE" else comment.created_at,
            action=action,
            resource_type="site_comment",
            resource_id=comment.id,
            details={
                "dive_site_name": comment.dive_site.name,
                "comment_length": len(comment.comment_text)
            }
        ))
    
    recent_center_comments = db.query(CenterComment).join(DivingCenter).filter(
        CenterComment.user_id == current_user.id,
        CenterComment.created_at >= start_date,
        CenterComment.created_at <= end_date
    ).order_by(desc(CenterComment.created_at)).all()
    
    for comment in recent_center_comments:
        action = "CREATE" if comment.created_at == comment.updated_at else "UPDATE"
        audit_entries.append(AuditLogEntry(
            timestamp=comment.updated_at if action == "UPDATE" else comment.created_at,
            action=action,
            resource_type="center_comment",
            resource_id=comment.id,
            details={
                "diving_center_name": comment.diving_center.name,
                "comment_length": len(comment.comment_text)
            }
        ))
    
    # Recent certification updates
    recent_certifications = db.query(UserCertification).join(DivingOrganization).filter(
        UserCertification.user_id == current_user.id,
        UserCertification.created_at >= start_date,
        UserCertification.created_at <= end_date
    ).order_by(desc(UserCertification.created_at)).all()
    
    for cert in recent_certifications:
        action = "CREATE" if cert.created_at == cert.updated_at else "UPDATE"
        audit_entries.append(AuditLogEntry(
            timestamp=cert.updated_at if action == "UPDATE" else cert.created_at,
            action=action,
            resource_type="certification",
            resource_id=cert.id,
            details={
                "organization": cert.diving_organization.name,
                "level": cert.certification_level,
                "is_active": cert.is_active
            }
        ))
    
    # Account access events (profile updates)
    # Note: We check if user was updated in the time period
    if current_user.updated_at >= start_date and current_user.updated_at <= end_date:
        if current_user.created_at != current_user.updated_at:
            audit_entries.append(AuditLogEntry(
                timestamp=current_user.updated_at,
                action="UPDATE",
                resource_type="user_profile",
                resource_id=current_user.id,
                details={
                    "updated_fields": "profile_information"
                }
            ))
    
    # Add account creation if within period
    if current_user.created_at >= start_date and current_user.created_at <= end_date:
        audit_entries.append(AuditLogEntry(
            timestamp=current_user.created_at,
            action="CREATE",
            resource_type="user_account",
            resource_id=current_user.id,
            details={
                "account_created": True,
                "registration_method": "google_oauth" if current_user.google_id else "email_password"
            }
        ))
    
    # Sort all entries by timestamp (most recent first)
    audit_entries.sort(key=lambda x: x.timestamp, reverse=True)
    
    # Apply pagination
    total_entries = len(audit_entries)
    paginated_entries = audit_entries[offset:offset + limit]
    
    return AuditLogResponse(
        entries=paginated_entries,
        total_entries=total_entries,
        period_start=start_date,
        period_end=end_date,
        export_timestamp=datetime.utcnow().isoformat()
    )
