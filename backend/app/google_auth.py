import os
from typing import Optional, Dict, Any
from google.auth.transport import requests
from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError as GoogleAuthLibraryError
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models import User
from app.auth import create_access_token, get_password_hash
from datetime import timedelta
from app.auth import ACCESS_TOKEN_EXPIRE_MINUTES
import re
from sqlalchemy.exc import IntegrityError
import time
import logging

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Set up logging
logger = logging.getLogger(__name__)

# Validate Google OAuth configuration (only when actually using Google OAuth)
def validate_google_config():
    """Validate that Google OAuth configuration is available"""
    if not GOOGLE_CLIENT_ID:
        logger.error("GOOGLE_CLIENT_ID environment variable is not set")
        raise ValueError("GOOGLE_CLIENT_ID environment variable is required for Google OAuth")

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
        # Validate Google OAuth configuration
        validate_google_config()
        
        # Basic token format validation
        if not token or not isinstance(token, str):
            raise GoogleAuthError("Token is required and must be a string")
        
        # Check if token has the basic JWT structure (3 parts separated by dots)
        token_parts = token.split('.')
        if len(token_parts) != 3:
            raise GoogleAuthError("Invalid token format: JWT token must have 3 parts separated by dots")
        
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

    except GoogleAuthLibraryError as e:
        logger.error(f"Google library error during token verification: {str(e)}")
        raise GoogleAuthError(f"Invalid Google token: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
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
        # Update name if not set and we have one from Google
        if not existing_user.name and google_user_info.get('name'):
            existing_user.name = google_user_info.get('name')
        db.commit()
        return existing_user

    # Check if user exists by Google ID
    existing_user = db.query(User).filter(User.google_id == google_id).first()
    if existing_user:
        return existing_user

    # Create new user
    # Generate username from first part of email
    username = _generate_valid_username(db, email)
    
    # Get profile picture URL and name if available
    picture_url = google_user_info.get('picture')
    full_name = google_user_info.get('name', '')
    
    # Create new user
    # Generate a random password hash for Google users (they won't use password login)
    random_password = f"google_oauth_{google_id}_{int(time.time())}"
    password_hash = get_password_hash(random_password)
    
    new_user = User(
        username=username,
        name=full_name,  # Store the full name from Google
        email=email,
        password_hash=password_hash,  # Required field - random password for Google users
        google_id=google_id,
        avatar_url=picture_url,
        enabled=True,  # Google users are enabled by default
        is_admin=False,
        is_moderator=False
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except IntegrityError as e:
        db.rollback()
        raise GoogleAuthError(f"Failed to create user: {str(e)}")


def _generate_valid_username(db: Session, email: str) -> str:
    """
    Generate a valid username from the first part of the email address.
    If the username already exists, append a random numeric suffix.
    
    Args:
        db: Database session
        email: User's email address
        
    Returns:
        Valid username string
    """
    # Extract first part of email (before @)
    email_prefix = email.split('@')[0].lower()
    
    # Extract only the first part before the first dot (if any)
    username = email_prefix.split('.')[0]
    
    # Remove any special characters that don't match the pattern ^[a-zA-Z0-9_]+$
    username = re.sub(r'[^a-zA-Z0-9_]', '', username)
    
    # Ensure username is not empty
    if not username:
        username = "user"
    
    # Check if username already exists, if so, append a random numeric suffix
    base_username = username
    import random
    
    while db.query(User).filter(User.username == username).first():
        # Generate a random 3-digit number
        suffix = random.randint(100, 999)
        username = f"{base_username}{suffix}"
        
        # Prevent infinite loop (very unlikely but safe)
        if len(username) > 50:  # Max username length is 50
            username = f"{base_username}_{int(time.time())}"
            break
    
    return username


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