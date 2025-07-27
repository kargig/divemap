from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from slowapi.util import get_remote_address
from slowapi import Limiter

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, Token, LoginRequest, UserResponse, RegistrationResponse
from app.auth import (
    authenticate_user, 
    create_access_token, 
    get_password_hash,
    get_current_active_user,
    validate_password_strength,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.limiter import limiter

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.post("/register", response_model=RegistrationResponse)
@limiter.limit("5/minute")
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
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Create access token (user can login but will be blocked by enabled check)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "message": "Registration successful. Your account is pending admin approval."
    }

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
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
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google-login", response_model=Token)
async def google_login(db: Session = Depends(get_db)):
    """Google OAuth login endpoint (to be implemented)"""
    # TODO: Implement Google OAuth integration
    # This would involve:
    # 1. Receiving Google ID token from frontend
    # 2. Verifying the token with Google
    # 3. Creating or updating user in database
    # 4. Returning JWT token
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google OAuth login not yet implemented"
    ) 