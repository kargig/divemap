from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from slowapi.util import get_remote_address
from slowapi import Limiter
from pydantic import BaseModel

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, Token, LoginRequest, UserResponse, RegistrationResponse
from app.auth import (
    authenticate_user,
    get_password_hash,
    get_current_active_user,
    validate_password_strength
)
from app.token_service import token_service
from app.google_auth import authenticate_google_user
from app.limiter import limiter, skip_rate_limit_for_admin

router = APIRouter()

class GoogleLoginRequest(BaseModel):
    token: str

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.post("/register", response_model=RegistrationResponse)
@skip_rate_limit_for_admin("5/minute")
async def register(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):

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

    # Create new user (disabled by default, needs admin approval)
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        enabled=False,  # New users are disabled by default
        is_admin=False,
        is_moderator=False
    )

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

    # Create token pair (user can login but will be blocked by enabled check)
    token_data = token_service.create_token_pair(db_user, request, db)

    return {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "token_type": "bearer",
        "expires_in": token_data["expires_in"],
        "message": "Registration successful. Your account is pending admin approval."
    }

@router.post("/login", response_model=Token)
@skip_rate_limit_for_admin("20/minute")
async def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):

    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create token pair
    token_data = token_service.create_token_pair(user, request, db)

    return {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "token_type": "bearer",
        "expires_in": token_data["expires_in"]
    }

@router.post("/google-login", response_model=Token)
@skip_rate_limit_for_admin("20/minute")
async def google_login(
    request: Request,
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
        user = authenticate_google_user(google_data.token, db)
        if user:
            # Create token pair
            token_data = token_service.create_token_pair(user, request, db)
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication failed"
        )

@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")  # Prevent abuse
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    new_access_token = token_service.refresh_access_token(refresh_token, request, db)
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": int(token_service.access_token_expire.total_seconds())
    }

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
    response.delete_cookie("refresh_token", httponly=True, secure=True, samesite="strict")
    
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