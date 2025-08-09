import os
from typing import Optional, Dict, Any
from google.auth.transport import requests
from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models import User
from app.auth import create_access_token, get_password_hash
from datetime import timedelta
from app.auth import ACCESS_TOKEN_EXPIRE_MINUTES

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

class GoogleAuthError(Exception):
    """Custom exception for Google authentication errors"""
    pass

def verify_google_token(token: str) -> Dict[str, Any]:
    """
    Verify Google ID token and return user information

    Args:
        token: Google ID token from frontend

    Returns:
        Dict containing user information from Google

    Raises:
        GoogleAuthError: If token verification fails
    """
    try:
        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

        # Check if the token is still valid
        if idinfo['aud'] != GOOGLE_CLIENT_ID:
            raise GoogleAuthError("Wrong audience.")

        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise GoogleAuthError("Wrong issuer.")

        return idinfo

    except GoogleAuthError as e:
        raise GoogleAuthError(f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise GoogleAuthError(f"Token verification failed: {str(e)}")

def get_or_create_google_user(db: Session, google_user_info: Dict[str, Any]) -> User:
    """
    Get existing user or create new user from Google OAuth data

    Args:
        db: Database session
        google_user_info: User information from Google

    Returns:
        User object (existing or newly created)
    """
    email = google_user_info.get('email')
    google_id = google_user_info.get('sub')  # Google's unique user ID

    if not email:
        raise GoogleAuthError("Email not provided by Google")

    # Check if user exists by email
    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        # Update user's Google ID if not set
        if not existing_user.google_id:
            existing_user.google_id = google_id
            db.commit()
        return existing_user

    # Create new user
    username = google_user_info.get('name', email.split('@')[0])
    # Ensure username is unique
    base_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    new_user = User(
        username=username,
        email=email,
        google_id=google_id,
        enabled=True,  # Google users are enabled by default
        is_admin=False,
        is_moderator=False,
        # Generate a random password hash for Google users
        password_hash=get_password_hash(os.urandom(32).hex())
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def authenticate_google_user(token: str, db: Session) -> str:
    """
    Authenticate user with Google OAuth and return JWT token

    Args:
        token: Google ID token
        db: Database session

    Returns:
        JWT access token
    """
    try:
        # Verify Google token
        google_user_info = verify_google_token(token)

        # Get or create user
        user = get_or_create_google_user(db, google_user_info)

        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=access_token_expires
        )

        return access_token

    except GoogleAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )