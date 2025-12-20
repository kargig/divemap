"""
Email Verification Service

Handles email verification token generation, validation, and management.
"""

import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models import User, EmailVerificationToken

logger = logging.getLogger(__name__)


class EmailVerificationService:
    """Service for managing email verification tokens."""
    
    def __init__(self):
        """Initialize email verification service."""
        self.token_expiry_hours = int(os.getenv("EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS", "24"))
    
    def generate_verification_token(self) -> str:
        """
        Generate a cryptographically secure verification token.
        
        Returns:
            URL-safe token string
        """
        return secrets.token_urlsafe(32)
    
    def create_verification_token(self, user_id: int, db: Session) -> EmailVerificationToken:
        """
        Create and store a verification token for a user.
        
        Args:
            user_id: User ID to create token for
            db: Database session
            
        Returns:
            EmailVerificationToken object
        """
        # Revoke any existing unused tokens for this user
        self._revoke_existing_tokens(user_id, db)
        
        # Generate new token
        token = self.generate_verification_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=self.token_expiry_hours)
        
        # Create token record
        verification_token = EmailVerificationToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        
        db.add(verification_token)
        db.commit()
        db.refresh(verification_token)
        
        logger.info(f"Created verification token for user {user_id}")
        return verification_token
    
    def verify_token(self, token: str, db: Session) -> Optional[User]:
        """
        Verify a token and mark email as verified.
        
        This method uses a transaction to ensure atomicity: if verification fails,
        the operation is rolled back. The token is marked as used and the user's
        email is marked as verified in a single atomic operation.
        
        Args:
            token: Verification token
            db: Database session
            
        Returns:
            User object if token is valid, None otherwise
        """
        # Find token
        verification_token = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == token,
            EmailVerificationToken.used_at.is_(None)
        ).first()
        
        if not verification_token:
            logger.warning(f"Verification token not found or already used: {token[:10]}...")
            return None
        
        # Check if token is expired
        # Ensure both datetimes are timezone-aware for comparison
        expires_at = verification_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if expires_at < now:
            logger.warning(f"Verification token expired: {token[:10]}...")
            return None
        
        # Get user
        user = db.query(User).filter(User.id == verification_token.user_id).first()
        if not user:
            logger.error(f"User not found for verification token: {token[:10]}...")
            return None
        
        # Use transaction to ensure atomicity
        try:
            # Check if email already verified
            if user.email_verified:
                logger.info(f"Email already verified for user {user.id}")
                # Mark token as used anyway
                verification_token.used_at = datetime.now(timezone.utc)
                db.commit()
                return user
            
            # Mark token as used
            verification_token.used_at = datetime.now(timezone.utc)
            
            # Mark email as verified
            user.email_verified = True
            user.email_verified_at = datetime.now(timezone.utc)
            
            db.commit()
            db.refresh(user)
            
            logger.info(f"Email verified for user {user.id}")
            return user
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to verify token for user {user.id}: {e}", exc_info=True)
            return None
    
    def is_token_valid(self, token: str, db: Session) -> bool:
        """
        Check if a token is valid (exists, not expired, not used).
        
        Args:
            token: Verification token
            db: Database session
            
        Returns:
            True if token is valid, False otherwise
        """
        verification_token = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == token,
            EmailVerificationToken.used_at.is_(None)
        ).first()
        
        if not verification_token:
            return False
        
        # Ensure both datetimes are timezone-aware for comparison
        expires_at = verification_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        # Token is expired if expires_at is less than or equal to now
        # (tokens that expire exactly at "now" are considered expired)
        if expires_at <= datetime.now(timezone.utc):
            return False
        
        return True
    
    def resend_verification_email(self, user_id: int, db: Session) -> Optional[EmailVerificationToken]:
        """
        Generate a new verification token and return it for sending.
        
        This method checks if the user exists and is not already verified before
        creating a new token. The token creation itself is handled by
        create_verification_token which uses transactions.
        
        Args:
            user_id: User ID to resend verification for
            db: Database session
            
        Returns:
            EmailVerificationToken object, or None if user doesn't exist or already verified
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        
        if user.email_verified:
            logger.info(f"User {user_id} email already verified, skipping resend")
            return None
        
        return self.create_verification_token(user_id, db)
    
    def _revoke_existing_tokens(self, user_id: int, db: Session):
        """
        Revoke (mark as used) any existing unused tokens for a user.
        
        Args:
            user_id: User ID
            db: Database session
        """
        existing_tokens = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used_at.is_(None)
        ).all()
        
        for token in existing_tokens:
            token.used_at = datetime.now(timezone.utc)
        
        if existing_tokens:
            db.commit()
            logger.info(f"Revoked {len(existing_tokens)} existing tokens for user {user_id}")


# Global instance
email_verification_service = EmailVerificationService()

