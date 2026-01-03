"""
Notifications Router

API endpoints for notification management, preferences, and email configuration.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from datetime import datetime
from fastapi.responses import JSONResponse
import os
import logging

from app.database import get_db
from app.models import User, Notification, NotificationPreference, EmailConfig
from app.auth import get_current_active_user, get_current_admin_user
from app.utils import utcnow
from fastapi.security import APIKeyHeader
from app.schemas import (
    NotificationResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceCreate,
    NotificationPreferenceUpdate,
    EmailConfigResponse,
    EmailConfigCreate,
    EmailConfigUpdate
)
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter()


def _serialize_datetime_utc(dt: Optional[datetime]) -> Optional[str]:
    """
    Serialize datetime to ISO string, ensuring it's in UTC.
    
    Args:
        dt: Datetime object (may be naive or timezone-aware)
    
    Returns:
        ISO format string with UTC timezone, or None if dt is None
    """
    if dt is None:
        return None
    
    from datetime import timezone
    
    # If naive datetime, assume it's UTC (from database with timezone=True)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Convert to UTC if not already
    elif dt.tzinfo != timezone.utc:
        dt = dt.astimezone(timezone.utc)
    
    return dt.isoformat()

# API Key authentication for internal service calls (Lambda)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
LAMBDA_API_KEY = os.getenv("LAMBDA_API_KEY", "")  # Legacy: fallback to env var if no DB keys


def verify_api_key(api_key: str = Depends(api_key_header), db: Session = Depends(get_db)) -> bool:
    """
    Verify API key for internal service calls (Lambda, etc.).
    Checks database first, falls back to LAMBDA_API_KEY env var for backward compatibility.
    Returns True if valid, raises HTTPException if invalid.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )
    
    # Try database API keys first
    try:
        from app.models import ApiKey
        from app.auth import verify_password
        from datetime import datetime
        
        # Get all active API keys
        active_keys = db.query(ApiKey).filter(
            ApiKey.is_active == True
        ).all()
        
        # Check expiration
        now = utcnow()
        for key_record in active_keys:
            # Check if expired
            if key_record.expires_at and key_record.expires_at < now:
                continue
            
            # Verify key hash matches
            # API keys are stored as: "dm_" + base64(32 random bytes)
            # We hash them with bcrypt for storage
            try:
                if verify_password(api_key, key_record.key_hash):
                    # Update last_used_at
                    key_record.last_used_at = now
                    db.commit()
                    logger.info(f"API key authenticated: {key_record.name} (ID: {key_record.id})")
                    return True
            except Exception as e:
                logger.debug(f"Key verification failed for key {key_record.id}: {e}")
                continue
        
        # Fallback to legacy environment variable for backward compatibility
        if LAMBDA_API_KEY and api_key == LAMBDA_API_KEY:
            logger.warning("Using legacy LAMBDA_API_KEY environment variable - consider migrating to database API keys")
            return True
        
        # No valid key found
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
        
    except ImportError:
        # Database models not available, fall back to env var
        logger.warning("ApiKey model not available, using environment variable")
        if not LAMBDA_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="API key authentication not configured"
            )
        if api_key != LAMBDA_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
        return True
    except Exception as e:
        logger.error(f"Error verifying API key: {e}")
        # Fallback to env var on error
        if LAMBDA_API_KEY and api_key == LAMBDA_API_KEY:
            return True
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )


# Legacy function name for backward compatibility
verify_lambda_api_key = verify_api_key


@router.get("", include_in_schema=False)
@router.get("/")
def get_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    since: Optional[str] = Query(None, description="ISO datetime - only notifications created after this time"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, 100)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get user's notifications with pagination and filtering.
    """
    # Validate page_size
    if page_size not in [25, 50, 100]:
        page_size = 25
    
    # Build query
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    # Apply filters
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    
    if category:
        query = query.filter(Notification.category == category)
    
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
            query = query.filter(Notification.created_at >= since_dt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid datetime format for 'since' parameter"
            )
    
    # Get total count
    total_count = query.count()
    
    # Calculate pagination
    total_pages = (total_count + page_size - 1) // page_size
    offset = (page - 1) * page_size
    
    # Get notifications
    notifications = query.order_by(desc(Notification.created_at)).offset(offset).limit(page_size).all()
    
    # Build response
    notification_list = [
        NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            category=n.category,
            title=n.title,
            message=n.message,
            link_url=n.link_url,
            entity_type=n.entity_type,
            entity_id=n.entity_id,
            is_read=n.is_read,
            read_at=n.read_at,
            email_sent=n.email_sent,
            email_sent_at=n.email_sent_at,
            created_at=n.created_at
        )
        for n in notifications
    ]
    
    # Return with pagination headers
    # Convert Pydantic models to dict (handle both v1 and v2)
    # Handle None datetime values properly
    content = []
    for n in notification_list:
        try:
            if hasattr(n, 'model_dump'):
                item = n.model_dump()
            else:
                item = n.model_dump()
            # Ensure datetime fields are serializable with timezone info (UTC)
            for key, value in item.items():
                if isinstance(value, datetime):
                    # Ensure timezone-aware datetimes - if naive, assume UTC
                    if value.tzinfo is None:
                        # If naive datetime (shouldn't happen with timezone=True, but handle gracefully)
                        from datetime import timezone
                        value = value.replace(tzinfo=timezone.utc)
                    # Convert to UTC if not already (normalize to UTC)
                    if value.tzinfo != timezone.utc:
                        value = value.astimezone(timezone.utc)
                    # Serialize as ISO string with UTC timezone indicator
                    item[key] = value.isoformat()
            content.append(item)
        except Exception as e:
            logger.error(f"Error serializing notification: {e}")
            # Fallback: convert manually
            item = {
                "id": n.id,
                "user_id": n.user_id,
                "category": n.category,
                "title": n.title,
                "message": n.message,
                "link_url": n.link_url,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "is_read": n.is_read,
                "read_at": _serialize_datetime_utc(n.read_at),
                "email_sent": n.email_sent,
                "email_sent_at": _serialize_datetime_utc(n.email_sent_at),
                "created_at": _serialize_datetime_utc(n.created_at)
            }
            content.append(item)
    
    response = JSONResponse(content=content)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Has-Next-Page"] = str(page < total_pages).lower()
    response.headers["X-Has-Prev-Page"] = str(page > 1).lower()
    
    return response


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get count of unread notifications for current user."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {"unread_count": count}


@router.get("/new-since-last-check", response_model=List[NotificationResponse])
def get_new_since_last_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get notifications created since user's last_notification_check timestamp.
    Used on login to show new notifications.
    """
    if not current_user.last_notification_check:
        # If never checked, return all unread notifications
        notifications = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ).order_by(desc(Notification.created_at)).limit(50).all()
    else:
        notifications = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.created_at > current_user.last_notification_check
        ).order_by(desc(Notification.created_at)).limit(50).all()
    
    return [
        NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            category=n.category,
            title=n.title,
            message=n.message,
            link_url=n.link_url,
            entity_type=n.entity_type,
            entity_id=n.entity_id,
            is_read=n.is_read,
            read_at=n.read_at,
            email_sent=n.email_sent,
            email_sent_at=n.email_sent_at,
            created_at=n.created_at
        )
        for n in notifications
    ]


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = utcnow()
        db.commit()
        db.refresh(notification)
    
    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        category=notification.category,
        title=notification.title,
        message=notification.message,
        link_url=notification.link_url,
        entity_type=notification.entity_type,
        entity_id=notification.entity_id,
        is_read=notification.is_read,
        read_at=notification.read_at,
        email_sent=notification.email_sent,
        email_sent_at=notification.email_sent_at,
        created_at=notification.created_at
    )


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mark all notifications as read and update last_notification_check timestamp.
    """
    # Mark all as read
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        'is_read': True,
        'read_at': utcnow()
    })
    
    # Update last_notification_check
    current_user.last_notification_check = utcnow()
    db.commit()
    
    return {"message": f"Marked {updated} notifications as read", "updated_count": updated}


@router.put("/update-last-check")
def update_last_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update user's last_notification_check timestamp."""
    current_user.last_notification_check = utcnow()
    db.commit()
    
    return {"message": "Last notification check updated", "timestamp": current_user.last_notification_check.isoformat()}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a notification."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}


# Preference Endpoints
@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user's notification preferences."""
    preferences = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).all()
    
    return [
        NotificationPreferenceResponse(
            id=p.id,
            user_id=p.user_id,
            category=p.category,
            enable_website=p.enable_website,
            enable_email=p.enable_email,
            frequency=p.frequency,
            area_filter=p.area_filter,
            created_at=p.created_at,
            updated_at=p.updated_at
        )
        for p in preferences
    ]


@router.post("/preferences", response_model=NotificationPreferenceResponse)
def create_notification_preference(
    preference: NotificationPreferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new notification preference."""
    # Check if preference already exists
    existing = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id,
        NotificationPreference.category == preference.category
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Preference for category '{preference.category}' already exists"
        )
    
    # Check global opt-out before enabling email notifications
    if preference.enable_email and current_user.email_notifications_opted_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enable email notifications: you have globally opted out of all email notifications. Please clear your global opt-out first."
        )
    
    # Create new preference
    new_preference = NotificationPreference(
        user_id=current_user.id,
        category=preference.category,
        enable_website=preference.enable_website,
        enable_email=preference.enable_email,
        frequency=preference.frequency,
        area_filter=preference.area_filter
    )
    
    db.add(new_preference)
    db.commit()
    db.refresh(new_preference)
    
    return NotificationPreferenceResponse(
        id=new_preference.id,
        user_id=new_preference.user_id,
        category=new_preference.category,
        enable_website=new_preference.enable_website,
        enable_email=new_preference.enable_email,
        frequency=new_preference.frequency,
        area_filter=new_preference.area_filter,
        created_at=new_preference.created_at,
        updated_at=new_preference.updated_at
    )


@router.put("/preferences/{category}", response_model=NotificationPreferenceResponse)
def update_notification_preference(
    category: str,
    preference_update: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a notification preference."""
    preference = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id,
        NotificationPreference.category == category
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preference for category '{category}' not found"
        )
    
    # Check global opt-out before enabling email notifications
    if preference_update.enable_email is not None and preference_update.enable_email:
        if current_user.email_notifications_opted_out:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot enable email notifications: you have globally opted out of all email notifications. Please clear your global opt-out first."
            )
    
    # Update fields
    if preference_update.enable_website is not None:
        preference.enable_website = preference_update.enable_website
    if preference_update.enable_email is not None:
        preference.enable_email = preference_update.enable_email
    if preference_update.frequency is not None:
        preference.frequency = preference_update.frequency
    if preference_update.area_filter is not None:
        preference.area_filter = preference_update.area_filter
    
    db.commit()
    db.refresh(preference)
    
    return NotificationPreferenceResponse(
        id=preference.id,
        user_id=preference.user_id,
        category=preference.category,
        enable_website=preference.enable_website,
        enable_email=preference.enable_email,
        frequency=preference.frequency,
        area_filter=preference.area_filter,
        created_at=preference.created_at,
        updated_at=preference.updated_at
    )


@router.delete("/preferences/{category}")
def delete_notification_preference(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a notification preference."""
    preference = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id,
        NotificationPreference.category == category
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preference for category '{category}' not found"
        )
    
    db.delete(preference)
    db.commit()
    
    return {"message": f"Preference for category '{category}' deleted"}


# Admin Endpoints
@router.get("/admin/stats")
def get_notification_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get notification statistics (admin only)."""
    total_notifications = db.query(Notification).count()
    unread_notifications = db.query(Notification).filter(Notification.is_read == False).count()
    email_sent_count = db.query(Notification).filter(Notification.email_sent == True).count()
    
    # Count by category
    category_counts = db.query(
        Notification.category,
        func.count(Notification.id).label('count')
    ).group_by(Notification.category).all()
    
    return {
        "total_notifications": total_notifications,
        "unread_notifications": unread_notifications,
        "email_sent_count": email_sent_count,
        "category_counts": {cat: count for cat, count in category_counts}
    }


@router.post("/admin/test-email")
def test_email_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Test email configuration by sending a test email via AWS SES (admin only)."""
    import os
    
    email_service = EmailService()
    
    # Use environment variables for SES (AWS_SES_FROM_EMAIL, AWS_SES_FROM_NAME)
    # These are set in backend .env file and match terraform.tfvars values
    from_email = os.getenv('AWS_SES_FROM_EMAIL')
    from_name = os.getenv('AWS_SES_FROM_NAME', 'Divemap')
    
    if not from_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AWS_SES_FROM_EMAIL environment variable not set. Please configure it in backend .env file."
        )
    
    # Send test email to admin
    test_notification = {
        'title': 'Test Email',
        'message': 'This is a test email from Divemap notification system.',
        'link_url': None
    }
    
    success = email_service.send_notification_email(
        user_email=current_user.email,
        notification=test_notification,
        template_name='test_email',
        from_email=from_email,
        from_name=from_name,
        user_id=current_user.id,
        db=db
    )
    
    if success:
        return {"message": "Test email sent successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test email. Check backend logs and AWS SES configuration."
        )


@router.post("/admin/test-email-queue")
def test_email_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Test the full SQS -> Lambda -> SES email flow (admin only).
    
    Creates a notification record, queues it to SQS, and Lambda will process it.
    This tests the complete asynchronous email notification pipeline.
    """
    notification_service = NotificationService()
    
    # Create a test notification for the admin user
    notification = notification_service.create_notification(
        user_id=current_user.id,
        category='admin_alerts',
        title='Test Email via SQS/Lambda',
        message='This is a test email sent through the SQS queue and processed by Lambda. If you receive this, the full notification pipeline is working correctly.',
        link_url=None,
        entity_type=None,
        entity_id=None,
        db=db
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create test notification"
        )
    
    # Queue the email notification to SQS
    user = db.query(User).filter(User.id == current_user.id).first()
    queued = notification_service._queue_email_notification(
        notification=notification,
        user=user,
        template_name='admin_alert',
        db=db
    )
    
    if not queued:
        # Notification was created but queuing failed
        # Clean up the notification
        db.delete(notification)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue email to SQS. Check AWS SQS configuration and backend logs."
        )
    
    return {
        "message": "Test notification queued successfully. Lambda will process it and send the email.",
        "notification_id": notification.id,
        "user_email": current_user.email,
        "category": notification.category,
        "queued_to_sqs": True
    }


@router.get("/admin/email-config", response_model=EmailConfigResponse)
def get_email_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get email configuration (admin only)."""
    config = db.query(EmailConfig).filter(EmailConfig.is_active == True).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active email configuration found"
        )
    
    return EmailConfigResponse(
        id=config.id,
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        use_starttls=config.use_starttls,
        from_email=config.from_email,
        from_name=config.from_name,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.put("/admin/email-config", response_model=EmailConfigResponse)
def update_email_config(
    config_update: EmailConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update email configuration (admin only)."""
    config = db.query(EmailConfig).filter(EmailConfig.is_active == True).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active email configuration found"
        )
    
    # Update fields
    if config_update.smtp_host is not None:
        config.smtp_host = config_update.smtp_host
    if config_update.smtp_port is not None:
        config.smtp_port = config_update.smtp_port
    if config_update.use_starttls is not None:
        config.use_starttls = config_update.use_starttls
    if config_update.smtp_username is not None:
        config.smtp_username = config_update.smtp_username
    if config_update.smtp_password is not None:
        config.smtp_password = config_update.smtp_password
    if config_update.from_email is not None:
        config.from_email = config_update.from_email
    if config_update.from_name is not None:
        config.from_name = config_update.from_name
    if config_update.is_active is not None:
        config.is_active = config_update.is_active
    
    db.commit()
    db.refresh(config)
    
    return EmailConfigResponse(
        id=config.id,
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        use_starttls=config.use_starttls,
        from_email=config.from_email,
        from_name=config.from_name,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.get("/internal/{notification_id}")
def get_notification_for_lambda(
    notification_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_lambda_api_key)
):
    """
    Internal endpoint for Lambda to fetch notification details.
    Requires X-API-Key header with LAMBDA_API_KEY value.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found"
        )
    
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "category": notification.category,
        "title": notification.title,
        "message": notification.message,
        "link_url": notification.link_url,
        "entity_type": notification.entity_type,
        "entity_id": notification.entity_id,
        "email_sent": notification.email_sent,
        "email_sent_at": _serialize_datetime_utc(notification.email_sent_at),
        "created_at": _serialize_datetime_utc(notification.created_at)
    }


@router.put("/internal/{notification_id}/mark-email-sent")
def mark_email_sent(
    notification_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_api_key)
):
    """
    Internal endpoint for Lambda to mark notification email as sent.
    Requires X-API-Key header with LAMBDA_API_KEY value.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found"
        )
    
    if notification.email_sent:
        logger.info(f"Email already marked as sent for notification {notification_id}")
        return {"status": "already_sent", "notification_id": notification_id}
    
    notification.email_sent = True
    notification.email_sent_at = utcnow()
    db.commit()
    db.refresh(notification)
    
    logger.info(f"Marked email as sent for notification {notification_id}")
    return {
        "status": "success",
        "notification_id": notification_id,
        "email_sent_at": _serialize_datetime_utc(notification.email_sent_at)
    }


@router.post("/admin/email-config", response_model=EmailConfigResponse)
def create_email_config(
    config_create: EmailConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create new email configuration (admin only)."""
    # Deactivate existing configs
    db.query(EmailConfig).update({'is_active': False})
    
    # Create new config
    new_config = EmailConfig(
        smtp_host=config_create.smtp_host,
        smtp_port=config_create.smtp_port,
        use_starttls=config_create.use_starttls,
        smtp_username=config_create.smtp_username,
        smtp_password=config_create.smtp_password,
        from_email=config_create.from_email,
        from_name=config_create.from_name,
        is_active=True
    )
    
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    
    return EmailConfigResponse(
        id=new_config.id,
        smtp_host=new_config.smtp_host,
        smtp_port=new_config.smtp_port,
        use_starttls=new_config.use_starttls,
        from_email=new_config.from_email,
        from_name=new_config.from_name,
        is_active=new_config.is_active,
        created_at=new_config.created_at,
        updated_at=new_config.updated_at
    )


# Admin User Notification Preferences Endpoints
@router.get("/admin/users/{user_id}/preferences", response_model=List[NotificationPreferenceResponse])
def get_user_notification_preferences(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get notification preferences for a specific user (admin only)."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    preferences = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id
    ).all()
    
    return [
        NotificationPreferenceResponse(
            id=p.id,
            user_id=p.user_id,
            category=p.category,
            enable_website=p.enable_website,
            enable_email=p.enable_email,
            frequency=p.frequency,
            area_filter=p.area_filter,
            created_at=p.created_at,
            updated_at=p.updated_at
        )
        for p in preferences
    ]


@router.post("/admin/users/{user_id}/preferences", response_model=NotificationPreferenceResponse)
def create_user_notification_preference(
    user_id: int,
    preference: NotificationPreferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create notification preference for a specific user (admin only)."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    # Check if preference already exists
    existing = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.category == preference.category
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Preference for category '{preference.category}' already exists for user {user_id}"
        )
    
    # Create new preference
    new_preference = NotificationPreference(
        user_id=user_id,
        category=preference.category,
        enable_website=preference.enable_website,
        enable_email=preference.enable_email,
        frequency=preference.frequency,
        area_filter=preference.area_filter
    )
    
    db.add(new_preference)
    db.commit()
    db.refresh(new_preference)
    
    logger.info(f"Admin {current_user.id} created notification preference for user {user_id}, category: {preference.category}")
    
    return NotificationPreferenceResponse(
        id=new_preference.id,
        user_id=new_preference.user_id,
        category=new_preference.category,
        enable_website=new_preference.enable_website,
        enable_email=new_preference.enable_email,
        frequency=new_preference.frequency,
        area_filter=new_preference.area_filter,
        created_at=new_preference.created_at,
        updated_at=new_preference.updated_at
    )


@router.put("/admin/users/{user_id}/preferences/{category}", response_model=NotificationPreferenceResponse)
def update_user_notification_preference(
    user_id: int,
    category: str,
    preference_update: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update notification preference for a specific user (admin only)."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    preference = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.category == category
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preference for category '{category}' not found for user {user_id}"
        )
    
    # Update fields
    if preference_update.enable_website is not None:
        preference.enable_website = preference_update.enable_website
    if preference_update.enable_email is not None:
        preference.enable_email = preference_update.enable_email
    if preference_update.frequency is not None:
        preference.frequency = preference_update.frequency
    if preference_update.area_filter is not None:
        preference.area_filter = preference_update.area_filter
    
    db.commit()
    db.refresh(preference)
    
    logger.info(f"Admin {current_user.id} updated notification preference for user {user_id}, category: {category}")
    
    return NotificationPreferenceResponse(
        id=preference.id,
        user_id=preference.user_id,
        category=preference.category,
        enable_website=preference.enable_website,
        enable_email=preference.enable_email,
        frequency=preference.frequency,
        area_filter=preference.area_filter,
        created_at=preference.created_at,
        updated_at=preference.updated_at
    )


@router.delete("/admin/users/{user_id}/preferences/{category}")
def delete_user_notification_preference(
    user_id: int,
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete notification preference for a specific user (admin only)."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found"
        )
    
    preference = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.category == category
    ).first()
    
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preference for category '{category}' not found for user {user_id}"
        )
    
    db.delete(preference)
    db.commit()
    
    logger.info(f"Admin {current_user.id} deleted notification preference for user {user_id}, category: {category}")
    
    return {"message": f"Preference for category '{category}' deleted for user {user_id}"}
