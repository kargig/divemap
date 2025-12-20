"""
Email Verification Token Cleanup Service

Periodic cleanup job to remove expired and used email verification tokens
to prevent database bloat.
"""

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.models import EmailVerificationToken
from app.database import get_db

logger = logging.getLogger(__name__)


def cleanup_expired_tokens(db: Session, days_old: int = 7) -> int:
    """
    Delete expired and used email verification tokens older than specified days.
    
    This function removes tokens that are:
    1. Expired (expires_at < now)
    2. Used (used_at is not None)
    3. Older than the specified number of days
    
    Args:
        db: Database session
        days_old: Delete tokens older than this many days (default: 7)
        
    Returns:
        Number of tokens deleted
    """
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        # Delete expired tokens older than cutoff
        expired_count = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.expires_at < cutoff_date
        ).delete(synchronize_session=False)
        
        # Delete used tokens older than cutoff
        used_count = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.used_at.isnot(None),
            EmailVerificationToken.used_at < cutoff_date
        ).delete(synchronize_session=False)
        
        total_deleted = expired_count + used_count
        
        if total_deleted > 0:
            db.commit()
            logger.info(f"Cleaned up {total_deleted} email verification tokens (expired: {expired_count}, used: {used_count})")
        else:
            db.commit()
            logger.debug("No email verification tokens to clean up")
        
        return total_deleted
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to cleanup email verification tokens: {e}", exc_info=True)
        raise


def cleanup_all_expired_tokens(db: Session) -> int:
    """
    Delete all expired tokens regardless of age.
    
    This is more aggressive cleanup for tokens that are definitely expired.
    
    Args:
        db: Database session
        
    Returns:
        Number of tokens deleted
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Delete all expired tokens
        expired_count = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.expires_at < now
        ).delete(synchronize_session=False)
        
        if expired_count > 0:
            db.commit()
            logger.info(f"Cleaned up {expired_count} expired email verification tokens")
        else:
            db.commit()
            logger.debug("No expired email verification tokens to clean up")
        
        return expired_count
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to cleanup expired email verification tokens: {e}", exc_info=True)
        raise

