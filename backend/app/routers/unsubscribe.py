"""
Unsubscribe Router

Handles email unsubscribe functionality with token-based one-click unsubscribe.
Users can unsubscribe from specific categories or all emails without requiring login.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, NotificationPreference
from app.services.unsubscribe_token_service import unsubscribe_token_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Get frontend URL for redirects
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost")


def _store_previous_preferences(user_id: int, category: Optional[str], db: Session) -> dict:
    """
    Store previous preference state before unsubscribe (for restoration).
    
    Args:
        user_id: User ID
        category: Category to unsubscribe from (None for global)
        db: Database session
        
    Returns:
        Dictionary containing previous preferences
    """
    preferences_dict = {}
    
    if category:
        # Store preference for specific category
        preference = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.category == category
        ).first()
        
        if preference:
            preferences_dict[category] = {
                'enable_email': preference.enable_email,
                'enable_website': preference.enable_website,
                'frequency': preference.frequency
            }
    else:
        # Store all email preferences for global opt-out
        preferences = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.enable_email == True
        ).all()
        
        for pref in preferences:
            preferences_dict[pref.category] = {
                'enable_email': pref.enable_email,
                'enable_website': pref.enable_website,
                'frequency': pref.frequency
            }
    
    return preferences_dict


@router.get("/unsubscribe")
async def unsubscribe(
    token: str = Query(..., description="Unsubscribe token from email link"),
    category: Optional[str] = Query(None, description="Category to unsubscribe from (optional, for category-specific unsubscribe)"),
    format: Optional[str] = Query(None, description="Response format: 'json' for API calls, 'redirect' for direct browser access (default)"),
    db: Session = Depends(get_db)
):
    """
    Unsubscribe from email notifications using token.
    
    Can unsubscribe from a specific category or all emails.
    Stores previous preferences for restoration on re-subscribe.
    
    Args:
        token: Unsubscribe token from email link
        category: Optional category to unsubscribe from (if not provided, unsubscribes from all)
        format: Response format - 'json' for API calls, 'redirect' for direct browser access
        db: Database session
        
    Returns:
        - If format='json': JSON response with success/error status
        - Otherwise: Redirect to frontend with success/error query parameters
    """
    # Validate token
    token_obj = unsubscribe_token_service.validate_token(token, db)
    
    if not token_obj:
        error_msg = "Invalid or expired unsubscribe link"
        if format == "json":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
        else:
            error_url = f"{FRONTEND_URL}/unsubscribe?error=invalid_or_expired"
            return RedirectResponse(url=error_url, status_code=302)
    
    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        error_msg = "User not found"
        if format == "json":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        else:
            error_url = f"{FRONTEND_URL}/unsubscribe?error=user_not_found"
            return RedirectResponse(url=error_url, status_code=302)
    
    try:
        # Store previous preferences before unsubscribing
        previous_preferences = _store_previous_preferences(user.id, category, db)
        unsubscribe_token_service.store_previous_preferences(token_obj, previous_preferences, db)
        
        if category:
            # Unsubscribe from specific category
            preference = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == category
            ).first()
            
            if preference:
                preference.enable_email = False
                db.commit()
                logger.info(f"User {user.id} unsubscribed from category '{category}'")
            else:
                # Create preference with email disabled if it doesn't exist
                new_preference = NotificationPreference(
                    user_id=user.id,
                    category=category,
                    enable_website=True,
                    enable_email=False,
                    frequency='immediate'
                )
                db.add(new_preference)
                db.commit()
                logger.info(f"Created preference with email disabled for user {user.id}, category '{category}'")
        else:
            # Global unsubscribe - opt out of all emails
            user.email_notifications_opted_out = True
            user.email_opt_out_at = datetime.now(timezone.utc)
            
            # Disable email for all preferences
            preferences = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id
            ).all()
            
            for pref in preferences:
                pref.enable_email = False
            
            db.commit()
            logger.info(f"User {user.id} globally opted out of all email notifications")
        
        # Update token usage
        unsubscribe_token_service.update_token_usage(token_obj, db)
        
        # Log unsubscribe event for audit
        unsubscribe_token_service.log_unsubscribe_event(user.id, category, token_obj.token, db)
        
        # Redirect or return JSON
        if format == "json":
            return {
                "success": True,
                "message": f"Successfully unsubscribed from {'all emails' if not category else f'{category} emails'}"
            }
        else:
            success_url = f"{FRONTEND_URL}/unsubscribe?success=true&category={category or 'all'}"
            return RedirectResponse(url=success_url, status_code=302)
            
    except Exception as e:
        db.rollback()
        logger.error(f"Error unsubscribing user {user.id}: {e}", exc_info=True)
        error_msg = "Failed to process unsubscribe request"
        
        if format == "json":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )
        else:
            error_url = f"{FRONTEND_URL}/unsubscribe?error=processing_failed"
            return RedirectResponse(url=error_url, status_code=302)


@router.get("/unsubscribe/all")
async def unsubscribe_all(
    token: str = Query(..., description="Unsubscribe token from email link"),
    format: Optional[str] = Query(None, description="Response format: 'json' for API calls, 'redirect' for direct browser access (default)"),
    db: Session = Depends(get_db)
):
    """
    Unsubscribe from all email notifications (global opt-out).
    
    This is a convenience endpoint that calls the main unsubscribe endpoint
    without a category parameter.
    """
    return await unsubscribe(token=token, category=None, format=format, db=db)


@router.get("/unsubscribe/confirm")
async def unsubscribe_confirm(
    token: str = Query(..., description="Unsubscribe token from email link"),
    db: Session = Depends(get_db)
):
    """
    Get confirmation page data (JSON).
    
    Returns unsubscribe status, category info, and re-subscribe token.
    """
    # Validate token
    token_obj = unsubscribe_token_service.validate_token(token, db)
    
    if not token_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired unsubscribe link"
        )
    
    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "success": True,
        "user_email": user.email,
        "email_opted_out": user.email_notifications_opted_out,
        "token": token_obj.token,
        "previous_preferences": unsubscribe_token_service.get_previous_preferences(token_obj)
    }


@router.post("/unsubscribe/resubscribe")
async def resubscribe(
    token: str = Query(..., description="Unsubscribe token (same token used for unsubscribe)"),
    category: Optional[str] = Query(None, description="Category to re-subscribe to (optional, re-subscribes to all if not provided)"),
    db: Session = Depends(get_db)
):
    """
    Re-subscribe to email notifications.
    
    Restores previous preferences that were stored before unsubscribe.
    If no previous preferences exist, enables email notifications with default settings.
    
    Args:
        token: Unsubscribe token (same token used for unsubscribe)
        category: Optional category to re-subscribe to (if not provided, re-subscribes to all)
        db: Database session
        
    Returns:
        JSON response with success status and restored preferences
    """
    # Validate token
    token_obj = unsubscribe_token_service.validate_token(token, db)
    
    if not token_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired unsubscribe link"
        )
    
    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Get previous preferences
        previous_preferences = unsubscribe_token_service.get_previous_preferences(token_obj)
        
        if category:
            # Re-subscribe to specific category
            preference = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == category
            ).first()
            
            if preference:
                # Restore previous preference if available
                if previous_preferences and category in previous_preferences:
                    pref_data = previous_preferences[category]
                    preference.enable_email = pref_data.get('enable_email', True)
                    preference.frequency = pref_data.get('frequency', 'immediate')
                else:
                    # Default: enable email
                    preference.enable_email = True
                db.commit()
                logger.info(f"User {user.id} re-subscribed to category '{category}'")
            else:
                # Create new preference with email enabled
                new_preference = NotificationPreference(
                    user_id=user.id,
                    category=category,
                    enable_website=True,
                    enable_email=True,
                    frequency='immediate'
                )
                db.add(new_preference)
                db.commit()
                logger.info(f"Created preference with email enabled for user {user.id}, category '{category}'")
        else:
            # Re-subscribe to all emails (restore all previous preferences)
            user.email_notifications_opted_out = False
            user.email_opt_out_at = None
            
            if previous_preferences:
                # Restore previous preferences
                for cat, pref_data in previous_preferences.items():
                    preference = db.query(NotificationPreference).filter(
                        NotificationPreference.user_id == user.id,
                        NotificationPreference.category == cat
                    ).first()
                    
                    if preference:
                        preference.enable_email = pref_data.get('enable_email', True)
                        preference.frequency = pref_data.get('frequency', 'immediate')
                    else:
                        # Create new preference
                        new_preference = NotificationPreference(
                            user_id=user.id,
                            category=cat,
                            enable_website=pref_data.get('enable_website', True),
                            enable_email=pref_data.get('enable_email', True),
                            frequency=pref_data.get('frequency', 'immediate')
                        )
                        db.add(new_preference)
            else:
                # No previous preferences - enable email for all existing preferences
                preferences = db.query(NotificationPreference).filter(
                    NotificationPreference.user_id == user.id
                ).all()
                
                for pref in preferences:
                    pref.enable_email = True
            
            db.commit()
            logger.info(f"User {user.id} re-subscribed to all email notifications")
        
        # Update token usage
        unsubscribe_token_service.update_token_usage(token_obj, db)
        
        # Log re-subscribe event for audit
        logger.info(
            f"Re-subscribe event - User ID: {user.id}, Category: {category or 'all'}, "
            f"Token: {token_obj.token[:10]}..., Timestamp: {datetime.now(timezone.utc).isoformat()}"
        )
        
        return {
            "success": True,
            "message": f"Successfully re-subscribed to {'all emails' if not category else f'{category} emails'}",
            "restored_preferences": previous_preferences if previous_preferences else {}
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error re-subscribing user {user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process re-subscribe request"
        )

