import os
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from fastapi import Request
from sqlalchemy.orm import Session

from app.models import User, RefreshToken, AuthAuditLog
from app.database import get_db


class TokenService:
    """Enhanced token service for managing access and refresh tokens"""
    
    def __init__(self):
        self.secret_key = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
        self.algorithm = os.getenv("ALGORITHM", "HS256")
        self.access_token_expire = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")))
        self.refresh_token_expire = timedelta(days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30")))
        self.enable_token_rotation = os.getenv("ENABLE_TOKEN_ROTATION", "true").lower() == "true"
        self.enable_audit_logging = os.getenv("ENABLE_AUDIT_LOGGING", "true").lower() == "true"
        self.max_active_sessions = int(os.getenv("MAX_ACTIVE_SESSIONS_PER_USER", "5"))
    
    def create_token_pair(self, user: User, request: Request, db: Session) -> Dict[str, Any]:
        """Create both access and refresh tokens"""
        # Clean up old expired tokens
        self._cleanup_expired_tokens(user.id, db)
        
        # Check if user has too many active sessions
        if self._has_too_many_sessions(user.id, db):
            self._revoke_oldest_session(user.id, db)
        
        access_token = self.create_access_token({"sub": user.username})
        refresh_token = self.create_refresh_token(user, request, db)
        
        # Log successful token creation
        if self.enable_audit_logging:
            self._log_auth_action(db, user.id, "token_created", request, True, 
                                f"Created token pair for user {user.username}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(self.access_token_expire.total_seconds())
        }
    
    def create_access_token(self, data: Dict[str, Any]) -> str:
        """Create short-lived access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + self.access_token_expire
        to_encode.update({
            "exp": expire, 
            "iat": datetime.utcnow(),
            "type": "access"
        })
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user: User, request: Request, db: Session) -> str:
        """Create long-lived refresh token"""
        # Clean up old expired tokens
        self._cleanup_expired_tokens(user.id, db)
        
        # Check if user has too many active sessions
        if self._has_too_many_sessions(user.id, db):
            self._revoke_oldest_session(user.id, db)
        
        token_id = str(uuid.uuid4())
        token_data = f"{user.username}:{token_id}:{datetime.utcnow().timestamp()}"
        
        # Hash the token for storage
        token_hash = hashlib.sha256(token_data.encode()).hexdigest()
        
        # Store in database
        refresh_token = RefreshToken(
            id=token_id,
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + self.refresh_token_expire,
            device_info=request.headers.get("User-Agent", ""),
            ip_address=request.client.host if request.client else None
        )
        
        db.add(refresh_token)
        db.commit()
        
        return token_data
    
    def refresh_access_token(self, refresh_token: str, request: Request, db: Session) -> Optional[str]:
        """Renew access token using refresh token"""
        try:
            # Parse refresh token
            parts = refresh_token.split(":")
            if len(parts) != 3:
                return None
            
            username, token_id, timestamp = parts
            token_timestamp = float(timestamp)
            
            # Check if token is too old (prevent replay attacks)
            current_time = datetime.utcnow().timestamp()
            time_diff = current_time - token_timestamp
            # Allow refresh tokens up to 1 week old (604800 seconds) to prevent replay attacks
            # This provides good user experience while maintaining security
            if time_diff > 604800:  # 1 week (7 days)
                return None
            
            # Find token in database
            db_token = db.query(RefreshToken).filter(
                RefreshToken.id == token_id,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            ).first()
            
            if not db_token:
                return None
            
            # Verify user
            user = db.query(User).filter(User.username == username).first()
            if not user or user.id != db_token.user_id:
                return None
            
            # Update last used timestamp
            db_token.last_used_at = datetime.utcnow()
            db.commit()
            
            # Log successful token refresh
            if self.enable_audit_logging:
                self._log_auth_action(db, user.id, "token_refresh", request, True, 
                                    f"Refreshed access token for user {username}")
            
            # Create new access token
            return self.create_access_token({"sub": username})
            
        except Exception as e:
            # Log failed token refresh
            if self.enable_audit_logging:
                self._log_auth_action(db, None, "token_refresh_failed", request, False, 
                                    f"Token refresh failed: {str(e)}")
            return None
    
    def rotate_refresh_token(self, old_refresh_token: str, request: Request, db: Session) -> Optional[Dict[str, Any]]:
        """Rotate refresh token for security"""
        try:
            # Validate old token
            new_access_token = self.refresh_access_token(old_refresh_token, request, db)
            if not new_access_token:
                return None
            
            # Parse old token to get user info
            parts = old_refresh_token.split(":")
            if len(parts) != 3:
                return None
            
            username = parts[0]
            user = db.query(User).filter(User.username == username).first()
            if not user:
                return None
            
            # Revoke old refresh token
            token_id = parts[1]
            db_token = db.query(RefreshToken).filter(RefreshToken.id == token_id).first()
            if db_token:
                db_token.is_revoked = True
                db.commit()
            
            # Create new refresh token
            new_refresh_token = self.create_refresh_token(user, request, db)
            
            # Log token rotation
            if self.enable_audit_logging:
                self._log_auth_action(db, user.id, "token_rotated", request, True, 
                                    f"Rotated refresh token for user {username}")
            
            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": int(self.access_token_expire.total_seconds())
            }
        except Exception as e:
            if self.enable_audit_logging:
                self._log_auth_action(db, None, "token_rotation_failed", request, False, 
                                    f"Token rotation failed: {str(e)}")
            return None
    
    def revoke_refresh_token(self, refresh_token: str, db: Session) -> bool:
        """Revoke a specific refresh token"""
        try:
            parts = refresh_token.split(":")
            if len(parts) != 3:
                return False
            
            token_id = parts[1]
            db_token = db.query(RefreshToken).filter(RefreshToken.id == token_id).first()
            
            if db_token:
                db_token.is_revoked = True
                db.commit()
                return True
            
            return False
        except Exception:
            return False
    
    def revoke_all_user_tokens(self, user_id: int, db: Session) -> bool:
        """Revoke all refresh tokens for a user"""
        try:
            db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False
            ).update({"is_revoked": True})
            db.commit()
            return True
        except Exception:
            return False
    
    def _cleanup_expired_tokens(self, user_id: int, db: Session):
        """Remove expired tokens for a user"""
        try:
            db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at < datetime.utcnow()
            ).delete()
            db.commit()
        except Exception:
            pass
    
    def _has_too_many_sessions(self, user_id: int, db: Session) -> bool:
        """Check if user has too many active sessions"""
        try:
            active_count = db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            ).count()
            return active_count >= self.max_active_sessions
        except Exception:
            return False
    
    def _revoke_oldest_session(self, user_id: int, db: Session):
        """Revoke the oldest active session for a user"""
        try:
            oldest_token = db.query(RefreshToken).filter(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            ).order_by(RefreshToken.created_at.asc()).first()
            
            if oldest_token:
                oldest_token.is_revoked = True
                db.commit()
        except Exception:
            pass
    
    def _log_auth_action(self, db: Session, user_id: Optional[int], action: str, 
                         request: Request, success: bool, details: str):
        """Log authentication actions for audit purposes"""
        try:
            log_entry = AuthAuditLog(
                user_id=user_id,
                action=action,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
                timestamp=datetime.utcnow(),
                success=success,
                details=details
            )
            db.add(log_entry)
            db.commit()
        except Exception:
            # Don't fail if logging fails
            pass


# Global instance
token_service = TokenService()
