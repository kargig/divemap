import os
import re
import secrets
import logging
import requests
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models import User
from app.schemas import AvatarType
from app.auth import get_password_hash
from app.utils import create_default_notification_preferences

logger = logging.getLogger(__name__)

class FacebookAuthError(Exception):
    """Exception raised for Facebook authentication errors."""
    pass

def is_facebook_auth_configured() -> bool:
    """Check if Facebook OAuth is enabled and configured with an App ID."""
    app_id = os.getenv("FACEBOOK_APP_ID")
    return bool(app_id and app_id.strip())

def verify_facebook_token(token: str) -> Dict[str, Any]:
    """Verify Facebook user access token with Meta Graph API."""
    if not is_facebook_auth_configured():
        raise FacebookAuthError("Facebook OAuth is not configured on this server.")

    if not token or not token.strip():
        raise FacebookAuthError("Token is missing or empty.")

    try:
        url = "https://graph.facebook.com/v18.0/me"
        params = {
            "fields": "id,name,picture.type(large)",
            "access_token": token
        }
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if response.status_code != 200 or "error" in data:
            error_msg = data.get("error", {}).get("message", "Facebook token validation failed.")
            logger.warning(f"Facebook Graph API validation error: {error_msg}")
            raise FacebookAuthError(error_msg)
            
        picture_url = None
        if "picture" in data and "data" in data["picture"] and "url" in data["picture"]["data"]:
            picture_url = data["picture"]["data"]["url"]
            
        return {
            "id": str(data.get("id")),
            "name": data.get("name", ""),
            "picture_url": picture_url
        }
    except requests.RequestException as e:
        logger.error(f"Network error calling Facebook Graph API: {e}")
        raise FacebookAuthError("Unable to contact Facebook service.")

def _generate_valid_username(db: Session, base_name: str, fb_id: str) -> str:
    """Generate a sanitized, unique username."""
    clean = re.sub(r'[^a-zA-Z0-9_]', '', (base_name or "").lower().replace(' ', '_'))
    if len(clean) < 3:
        clean = f"fb_user_{fb_id[:6]}"
    clean = clean[:40]

    candidate = clean
    counter = 1
    while db.query(User).filter(User.username == candidate).first() is not None:
        suffix = f"_{counter}"
        candidate = f"{clean[:50-len(suffix)]}{suffix}"
        counter += 1
    return candidate

def get_or_create_facebook_user(db: Session, fb_info: Dict[str, Any]) -> User:
    """Find existing Facebook user or register a new one with a synthetic email."""
    fb_id = fb_info["id"]
    picture_url = fb_info.get("picture_url")
    full_name = fb_info.get("name")

    user = db.query(User).filter(User.facebook_id == fb_id).first()
    if user:
        if picture_url:
            user.facebook_avatar_url = picture_url
            if user.avatar_type == AvatarType.facebook or not user.avatar_url:
                user.avatar_url = picture_url
                user.avatar_type = AvatarType.facebook
        db.commit()
        db.refresh(user)
        return user

    username = _generate_valid_username(db, full_name, fb_id)
    synthetic_email = f"{username}@facebook.divemap.invalid"
    random_password = secrets.token_urlsafe(32)

    new_user = User(
        username=username,
        name=full_name,
        email=synthetic_email,
        password_hash=get_password_hash(random_password),
        facebook_id=fb_id,
        avatar_url=picture_url,
        avatar_type=AvatarType.facebook if picture_url else None,
        facebook_avatar_url=picture_url,
        enabled=True,
        email_verified=False,
        email_notifications_opted_out=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    create_default_notification_preferences(new_user.id, db)
    return new_user
