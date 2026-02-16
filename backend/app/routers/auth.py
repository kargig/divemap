from datetime import timedelta, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from slowapi.util import get_remote_address
from slowapi import Limiter
from pydantic import BaseModel
import os
import logging
import secrets

from app.database import get_db
from app.models import User, EmailVerificationToken, PasswordResetToken, RefreshToken, AuthAuditLog
from app.schemas import (
    UserCreate, Token, LoginRequest, UserResponse, RegistrationResponse, 
    ResendVerificationRequest, PasswordResetRequest, PasswordResetConfirm
)
from app.auth import (
    authenticate_user,
    get_password_hash,
    get_current_active_user,
    validate_password_strength
)
from app.token_service import token_service
from app.google_auth import authenticate_google_user, verify_google_token, get_or_create_google_user
from app.limiter import limiter, skip_rate_limit_for_admin
from app.turnstile_service import TurnstileService
from app.services.email_verification_service import email_verification_service
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService
from app.utils import get_client_ip

# Constants
RESEND_VERIFICATION_RATE_LIMIT = 3  # requests per day
EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = 24
TOAST_DURATION_MS = 6000  # milliseconds

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize Turnstile service
turnstile_service = TurnstileService()

class GoogleLoginRequest(BaseModel):
    token: str

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
@skip_rate_limit_for_admin("10/minute")  # Allow admins higher rate limit
async def register(
    request: Request,
    response: Response,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    # Verify Turnstile if enabled (token verification handled by frontend widget)
    if turnstile_service.is_enabled():
        # Note: Turnstile verification is handled by the frontend widget
        # We only store the verification timestamp for audit purposes
        pass
    
    # Validate password strength
    if not validate_password_strength(user_data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character"
        )

    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )

    # Create new user (enabled by default, email not verified)
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        enabled=True,
        email_verified=False,  # Email verification required
        is_admin=False,
        is_moderator=False
    )
    
    # Store Turnstile verification timestamp if enabled
    if turnstile_service.is_enabled():
        db_user.turnstile_verified_at = datetime.now(timezone.utc)

    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )

    # Create default notification preferences for new user
    try:
        from app.utils import create_default_notification_preferences
        create_default_notification_preferences(db_user.id, db)
    except Exception as e:
        # Log error but don't fail registration if preference creation fails
        logger.warning(f"Failed to create default notification preferences for user {db_user.id}: {e}")

    # Generate verification token and send verification email
    try:
        verification_token_obj = email_verification_service.create_verification_token(db_user.id, db)
        email_service = EmailService()
        email_service.send_verification_email(db_user.email, verification_token_obj.token)
    except Exception as e:
        # Log error but don't fail registration if email sending fails
        logger.error(f"Failed to send verification email for user {db_user.id}: {e}")

    # Note: Admin notifications for regular registrations are sent AFTER email verification
    # See /verify-email endpoint for admin notification after verification

    # Check if email verification is required before login
    email_verification_required = os.getenv("EMAIL_VERIFICATION_REQUIRED", "true").lower() == "true"
    
    if not email_verification_required:
        # Create token pair if verification not required
        token_data = token_service.create_token_pair(db_user, request, db)
        
        # Set refresh token as HTTP-only cookie
        response.set_cookie(
            "refresh_token",
            token_data["refresh_token"],
            max_age=int(token_service.refresh_token_expire.total_seconds()),
            httponly=True,
            secure=os.getenv("REFRESH_TOKEN_COOKIE_SECURE", "false").lower() == "true",
            samesite=os.getenv("REFRESH_TOKEN_COOKIE_SAMESITE", "strict")
        )
        
        return {
            "access_token": token_data["access_token"],
            "token_type": "bearer",
            "expires_in": token_data["expires_in"],
            "message": "Registration successful. Please check your email to verify your account."
        }
    else:
        # Don't create tokens - user must verify email first
        return {
            "access_token": None,
            "token_type": "bearer",
            "expires_in": 0,
            "message": "Registration successful. Please check your email to verify your account before logging in."
        }

@router.post("/login", response_model=Token)
@skip_rate_limit_for_admin("30/minute")
async def login(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    # Authenticate user first
    user = authenticate_user(db, login_data.username, login_data.password)
    
    # Update Turnstile verification timestamp if enabled
    if turnstile_service.is_enabled() and user:
        # Note: Turnstile verification is handled by the frontend widget
        # We only store the verification timestamp for audit purposes
        turnstile_verified_at = datetime.now(timezone.utc)
        
        # Try to update the database, but don't fail if it doesn't work
        try:
            user.turnstile_verified_at = turnstile_verified_at
            # Update last_accessed_at
            user.last_accessed_at = func.now()
            db.commit()
        except Exception as e:
            # Log the error but don't fail the login
            print(f"Failed to update Turnstile verification timestamp: {e}")
            # Rollback and continue without Turnstile persistence
            db.rollback()
            # Don't refresh the user object - just continue with login
    elif user:
        # Update last_accessed_at even if Turnstile is disabled
        try:
            user.last_accessed_at = func.now()
            db.commit()
        except Exception as e:
            db.rollback()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if email verification is required
    email_verification_required = os.getenv("EMAIL_VERIFICATION_REQUIRED", "true").lower() == "true"
    if email_verification_required and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. Check your email for the verification link."
        )

    # Create token pair
    try:
        token_data = token_service.create_token_pair(user, request, db)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create authentication tokens"
        )

    # Set refresh token as HTTP-only cookie
    if token_data and 'refresh_token' in token_data:
        response.set_cookie(
            "refresh_token",
            token_data["refresh_token"],
            max_age=int(token_service.refresh_token_expire.total_seconds()),
            httponly=True,
            secure=os.getenv("REFRESH_TOKEN_COOKIE_SECURE", "false").lower() == "true",
            samesite=os.getenv("REFRESH_TOKEN_COOKIE_SAMESITE", "strict")
        )

    return {
        "access_token": token_data["access_token"],
        "token_type": "bearer",
        "expires_in": token_data["expires_in"]
    }

@router.post("/google-login", response_model=Token)
@skip_rate_limit_for_admin("30/minute")
async def google_login(
    request: Request,
    response: Response,
    google_data: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Google OAuth login endpoint

    Args:
        google_data: Contains the Google ID token from frontend
        db: Database session

    Returns:
        JWT access token for authenticated user
    """
    try:
        # Verify Google token
        google_user_info = verify_google_token(google_data.token)
        
        # Get or create user
        user = get_or_create_google_user(db, google_user_info)
        
        if user:
            # Update last_accessed_at
            try:
                user.last_accessed_at = func.now()
                db.commit()
            except Exception:
                db.rollback()

            # Notify admins about new user registration
            # The notification service will check if notifications were already sent to prevent duplicates
            try:
                notification_service = NotificationService()
                await notification_service.notify_admins_for_user_registration(user.id, db)
            except Exception as e:
                # Log error but don't fail login if notification fails
                logger.warning(f"Failed to send admin notifications for Google user {user.id}: {e}")
            
            # Create token pair
            token_data = token_service.create_token_pair(user, request, db)
            
            # Set refresh token as HTTP-only cookie
            response.set_cookie(
                "refresh_token",
                token_data["refresh_token"],
                max_age=int(token_service.refresh_token_expire.total_seconds()),
                httponly=True,
                secure=os.getenv("REFRESH_TOKEN_COOKIE_SECURE", "false").lower() == "true",
                samesite=os.getenv("REFRESH_TOKEN_COOKIE_SAMESITE", "strict")
            )
            
            return {
                "access_token": token_data["access_token"],
                "token_type": "bearer",
                "expires_in": token_data["expires_in"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google authentication failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        # Log the actual error for debugging
        logger.error(f"Google login error: {str(e)}", exc_info=True)
        
        # Return 400 for client errors (invalid token format, etc.)
        # Return 500 for server errors (database issues, etc.)
        if "Invalid token format" in str(e) or "Token is required" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid token: {str(e)}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google authentication failed"
            )

@router.get("/verify-email")
async def verify_email(
    token: str = Query(..., description="Email verification token from email link"),
    format: Optional[str] = Query(None, description="Response format: 'json' for API calls, 'redirect' for direct browser access (default)"),
    db: Session = Depends(get_db)
):
    """
    Verify email address using verification token.
    
    This endpoint processes email verification tokens sent to users via email.
    It can return either a JSON response (for API calls) or redirect to the frontend
    (for direct browser access from email links).
    
    Args:
        token: Verification token from email link
        format: Response format - 'json' for API calls, 'redirect' for direct browser access
        db: Database session
        
    Returns:
        - If format='json': JSON response with success/error status
        - Otherwise: Redirect to frontend with success/error query parameters
        
    Example:
        ```
        GET /api/v1/auth/verify-email?token=abc123...
        GET /api/v1/auth/verify-email?token=abc123...&format=json
        ```
        
    Response (JSON format):
        ```json
        {
            "success": true,
            "message": "Email verified successfully"
        }
        ```
        
    Response (Redirect format):
        Redirects to: `{FRONTEND_URL}/verify-email?success=true`
        or: `{FRONTEND_URL}/verify-email?error=invalid_or_expired`
    """
    from fastapi.responses import RedirectResponse
    
    # Get frontend URL for redirects - default to localhost if not set
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost").rstrip("/")
    
    # Verify token
    user = email_verification_service.verify_token(token, db)
    
    # If email was successfully verified, notify admins about new user registration
    # The notification service will check if notifications were already sent to prevent duplicates
    if user and user.email_verified:
        try:
            notification_service = NotificationService()
            await notification_service.notify_admins_for_user_registration(user.id, db)
        except Exception as e:
            # Log error but don't fail verification if notification fails
            logger.warning(f"Failed to send admin notifications for verified user {user.id}: {e}")
    
    if format == "json":
        # Return JSON response for API calls
        if user:
            return {"success": True, "message": "Email verified successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
    else:
        # Redirect for direct browser access (email links)
        if user:
            success_url = f"{frontend_url}/verify-email?success=true"
            return RedirectResponse(url=success_url, status_code=302)
        else:
            error_url = f"{frontend_url}/verify-email?error=invalid_or_expired"
            return RedirectResponse(url=error_url, status_code=302)

@router.post("/resend-verification")
@limiter.limit("3/day")
async def resend_verification(
    request: Request,
    email_data: ResendVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Resend verification email.
    
    Does NOT require authentication (user can't log in without verification).
    Rate limited to 3 requests per day per IP address.
    
    Args:
        request: FastAPI request object
        email_data: Request body with email field
        db: Database session
        
    Returns:
        Success message (always returns success to prevent email enumeration)
    """
    from app.models import EmailVerificationToken
    
    email = email_data.email.strip().lower()
    
    # Find user by email
    user = db.query(User).filter(User.email == email).first()
    
    # Always return success message (prevent email enumeration)
    success_message = "If the email exists and is not verified, a new verification email has been sent."
    
    if not user:
        # User doesn't exist - return success anyway
        return {"message": success_message}
    
    if user.email_verified:
        # Email already verified - return success anyway
        return {"message": success_message}
    
    # Check rate limit by email address (check recent tokens for this user)
    # Use a single query with aggregation to avoid N+1
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)
    recent_tokens_count = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.created_at >= one_day_ago
    ).count()
    
    if recent_tokens_count >= RESEND_VERIFICATION_RATE_LIMIT:
        # Rate limit exceeded - return success anyway (don't reveal limit)
        return {"message": success_message}
    
    # Generate new token and send email
    try:
        verification_token_obj = email_verification_service.resend_verification_email(user.id, db)
        if verification_token_obj:
            logger.info(f"Resending verification email to {email} (user_id: {user.id})")
            email_service = EmailService()
            email_sent = email_service.send_verification_email(user.email, verification_token_obj.token)
            if email_sent:
                logger.info(f"Verification email sent successfully to {email}")
            else:
                logger.error(f"Failed to send verification email to {email} - send_verification_email returned False")
        else:
            logger.warning(f"resend_verification_email returned None for user {user.id} (email: {email})")
    except Exception as e:
        # Log error but return success (don't reveal failure)
        logger.error(f"Failed to resend verification email for {email}: {e}", exc_info=True)
    
    return {"message": success_message}

@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    # Get refresh token from cookies
    refresh_token = request.cookies.get("refresh_token")
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookies"
        )

    try:
        # Validate and rotate refresh token (this returns both access and refresh tokens)
        token_data = token_service.rotate_refresh_token(refresh_token, request, db)
        
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Set new refresh token as cookie
        response.set_cookie(
            "refresh_token",
            token_data["refresh_token"],
            max_age=int(token_service.refresh_token_expire.total_seconds()),
            httponly=True,
            secure=os.getenv("REFRESH_TOKEN_COOKIE_SECURE", "false").lower() == "true",
            samesite=os.getenv("REFRESH_TOKEN_COOKIE_SAMESITE", "strict")
        )
        
        return {
            "access_token": token_data["access_token"],
            "token_type": "bearer",
            "expires_in": token_data["expires_in"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Logout and revoke refresh token"""
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        # Revoke refresh token
        token_service.revoke_refresh_token(refresh_token, db)
    
    # Clear refresh token cookie
    response.delete_cookie("refresh_token", httponly=True, secure=False, samesite="strict")
    
    return {"message": "Logged out successfully"}

@router.get("/tokens")
async def list_active_tokens(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List user's active refresh tokens"""
    from app.models import RefreshToken
    
    tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).all()
    
    return [
        {
            "id": token.id,
            "created_at": token.created_at,
            "last_used_at": token.last_used_at,
            "expires_at": token.expires_at,
            "device_info": token.device_info,
            "ip_address": token.ip_address
        }
        for token in tokens
    ]

@router.delete("/tokens/{token_id}")
async def revoke_token(
    token_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific refresh token"""
    from app.models import RefreshToken
    
    token = db.query(RefreshToken).filter(
        RefreshToken.id == token_id,
        RefreshToken.user_id == current_user.id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    token.is_revoked = True
    db.commit()
    
    return {"message": "Token revoked successfully"}

# Password Reset Endpoints

@router.post("/forgot-password")
@limiter.limit("5/day")
async def request_password_reset(
    request: Request,
    reset_data: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """
    Request a password reset email.
    Rate limited to 5 requests per day per IP.
    """
    import hashlib
    
    email_or_username = reset_data.email_or_username.strip()
    
    # Audit log entry preparation (will commit later)
    ip_address = get_client_ip(request)
    
    # Find user by email or username
    user = db.query(User).filter(
        or_(
            User.email == email_or_username,
            User.username == email_or_username
        )
    ).first()
    
    # Generic success message to prevent enumeration
    success_message = "If an account exists with these details, a password reset link has been sent to your email."
    
    if not user:
        # Log invalid attempt but return success
        # Note: We rely on slowapi for rate limiting invalid requests too
        return {"message": success_message}
    
    # Check if user uses Google auth
    if user.google_id:
        # Log that google user attempted reset
        logger.info(f"Password reset requested for Google user {user.id}")
        
        # Log attempt
        audit_log = AuthAuditLog(
            user_id=user.id,
            action="password_reset_request_google",
            ip_address=ip_address,
            user_agent=request.headers.get("user-agent"),
            success=False,
            details="Blocked: Google account"
        )
        db.add(audit_log)
        db.commit()
        
        return {"message": success_message}
    
    if not user.enabled:
        return {"message": success_message}

    # Generate token
    # Use secrets for high entropy
    reset_token = secrets.token_urlsafe(32)
    # Use SHA256 for deterministic hashing (fast lookups)
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    
    # Expiry: 30 minutes
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    # Store token hash
    db_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        ip_address=ip_address
    )
    
    db.add(db_token)
    
    # Log request
    audit_log = AuthAuditLog(
        user_id=user.id,
        action="password_reset_request",
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent"),
        success=True
    )
    db.add(audit_log)
    
    db.commit()
    
    # Send email with RAW token
    try:
        email_service = EmailService()
        email_service.send_password_reset_email(user.email, reset_token)
    except Exception as e:
        logger.error(f"Failed to send password reset email to {user.email}: {e}")
        # Still return success to user
        
    return {"message": success_message}

@router.get("/verify-reset-token")
async def verify_reset_token(
    token: str = Query(..., description="Password reset token"),
    db: Session = Depends(get_db)
):
    """
    Verify if a password reset token is valid.
    """
    import hashlib
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    db_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at == None,
        PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token"
        )
        
    return {"valid": True}

@router.post("/reset-password")
async def reset_password(
    request: Request,
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Reset password using a valid token.
    """
    import hashlib
    
    token_hash = hashlib.sha256(reset_data.token.encode()).hexdigest()
    
    db_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at == None,
        PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token"
        )
    
    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Validate new password
    if not validate_password_strength(reset_data.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character"
        )
        
    # Update password
    user.password_hash = get_password_hash(reset_data.new_password)
    
    # Mark token used
    db_token.used_at = datetime.now(timezone.utc)
    
    # Revoke all refresh tokens
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"is_revoked": True})
    
    # Audit log
    audit_log = AuthAuditLog(
        user_id=user.id,
        action="password_reset_success",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        success=True
    )
    db.add(audit_log)
    
    db.commit()
    
    # Send confirmation email
    try:
        email_service = EmailService()
        email_service.send_password_changed_email(user.email)
    except Exception as e:
        logger.error(f"Failed to send password changed email to {user.email}: {e}")
        
    return {"message": "Password has been reset successfully. Please login with your new password."}
