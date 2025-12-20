"""
Unsubscribe Token Service

Handles unsubscribe token generation, validation, and management.
One token per user, reusable across all emails and categories.
"""

import os
import secrets
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models import User, UnsubscribeToken

logger = logging.getLogger(__name__)


class UnsubscribeTokenService:
    """Service for managing unsubscribe tokens."""
    
    def __init__(self):
        """Initialize unsubscribe token service."""
        self.token_expiry_days = int(os.getenv("UNSUBSCRIBE_TOKEN_EXPIRY_DAYS", "30"))
    
    def generate_unsubscribe_token(self) -> str:
        """
        Generate a cryptographically secure unsubscribe token.
        
        Returns:
            URL-safe token string
        """
        return secrets.token_urlsafe(32)
    
    def get_or_create_unsubscribe_token(self, user_id: int, db: Session) -> UnsubscribeToken:
        """
        Get existing valid token or create new one for a user.
        
        Args:
            user_id: User ID to get/create token for
            db: Database session
            
        Returns:
            UnsubscribeToken object
        """
        # Check if user has existing token
        existing_token = db.query(UnsubscribeToken).filter(
            UnsubscribeToken.user_id == user_id
        ).first()
        
        # If token exists and is not expired, return it
        if existing_token:
            now = datetime.now(timezone.utc)
            # Ensure expires_at is timezone-aware (database may return naive datetime)
            expires_at = existing_token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > now:
                logger.debug(f"Returning existing valid unsubscribe token for user {user_id}")
                return existing_token
            else:
                # Token expired, delete it and create new one
                logger.info(f"Unsubscribe token expired for user {user_id}, creating new token")
                db.delete(existing_token)
                db.commit()
        
        # Generate new token
        token = self.generate_unsubscribe_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=self.token_expiry_days)
        
        # Create token record
        unsubscribe_token = UnsubscribeToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        
        db.add(unsubscribe_token)
        db.commit()
        db.refresh(unsubscribe_token)
        
        logger.info(f"Created unsubscribe token for user {user_id}")
        return unsubscribe_token
    
    def validate_token(self, token: str, db: Session) -> Optional[UnsubscribeToken]:
        """
        Validate an unsubscribe token.
        
        Args:
            token: Unsubscribe token to validate
            db: Database session
            
        Returns:
            UnsubscribeToken object if valid, None otherwise
        """
        # Find token
        unsubscribe_token = db.query(UnsubscribeToken).filter(
            UnsubscribeToken.token == token
        ).first()
        
        if not unsubscribe_token:
            logger.warning(f"Unsubscribe token not found: {token[:10]}...")
            return None
        
        # Check if token is expired
        now = datetime.now(timezone.utc)
        # Ensure expires_at is timezone-aware (database may return naive datetime)
        expires_at = unsubscribe_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at <= now:
            logger.warning(f"Unsubscribe token expired: {token[:10]}...")
            return None  # Do NOT auto-refresh, user must request new token
        
        return unsubscribe_token
    
    def update_token_usage(self, token_obj: UnsubscribeToken, db: Session) -> None:
        """
        Update token's last_used_at timestamp (token is reusable).
        
        Args:
            token_obj: UnsubscribeToken object
            db: Database session
        """
        token_obj.last_used_at = datetime.now(timezone.utc)
        db.commit()
        logger.debug(f"Updated last_used_at for unsubscribe token {token_obj.id}")
    
    def store_previous_preferences(self, token_obj: UnsubscribeToken, preferences_dict: Dict[str, Any], db: Session) -> None:
        """
        Store previous preferences before unsubscribe (for restoration).
        
        Args:
            token_obj: UnsubscribeToken object
            preferences_dict: Dictionary containing previous preference state
            db: Database session
        """
        token_obj.previous_preferences = preferences_dict
        db.commit()
        logger.debug(f"Stored previous preferences for unsubscribe token {token_obj.id}")
    
    def get_previous_preferences(self, token_obj: UnsubscribeToken) -> Optional[Dict[str, Any]]:
        """
        Retrieve stored previous preferences for restoration.
        
        Args:
            token_obj: UnsubscribeToken object
            
        Returns:
            Dictionary containing previous preferences, or None if not stored
        """
        return token_obj.previous_preferences
    
    def refresh_token(self, user_id: int, db: Session) -> UnsubscribeToken:
        """
        Generate new token for user (revokes old one).
        
        Args:
            user_id: User ID
            db: Database session
            
        Returns:
            New UnsubscribeToken object
        """
        # Delete existing token if any
        existing_token = db.query(UnsubscribeToken).filter(
            UnsubscribeToken.user_id == user_id
        ).first()
        
        if existing_token:
            db.delete(existing_token)
            db.commit()
        
        # Create new token
        return self.get_or_create_unsubscribe_token(user_id, db)
    
    def cleanup_expired_tokens(self, db: Session, days_old: int = 30) -> int:
        """
        Cleanup expired unsubscribe tokens older than specified days.
        
        Args:
            db: Database session
            days_old: Delete tokens older than this many days (from their expiration)
            
        Returns:
            Number of deleted tokens
        """
        threshold_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        # Delete tokens that have expired and are older than the threshold
        deleted_count = db.query(UnsubscribeToken).filter(
            UnsubscribeToken.expires_at < threshold_date
        ).delete(synchronize_session=False)
        
        db.commit()
        logger.info(f"Cleaned up {deleted_count} expired unsubscribe tokens.")
        return deleted_count
    
    def log_unsubscribe_event(self, user_id: int, category: Optional[str], token: str, db: Session) -> None:
        """
        Log unsubscribe event for audit purposes.
        
        Args:
            user_id: User ID who unsubscribed
            category: Category unsubscribed from (None for global)
            token: Token used for unsubscribe
            db: Database session
        """
        category_str = category if category else "all"
        logger.info(
            f"Unsubscribe event - User ID: {user_id}, Category: {category_str}, "
            f"Token: {token[:10]}..., Timestamp: {datetime.now(timezone.utc).isoformat()}"
        )


# Global instance
unsubscribe_token_service = UnsubscribeTokenService()

