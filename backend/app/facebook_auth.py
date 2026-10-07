import os
import re
import hmac
import hashlib
import secrets
import logging
import requests
from typing import Dict, Any, Optional
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
    """Check if Facebook OAuth is enabled with App ID and App Secret."""
    app_id = os.getenv("FACEBOOK_APP_ID")
    app_secret = os.getenv("FACEBOOK_APP_SECRET")
    return bool(
        app_id and app_id.strip()
        and app_secret and app_secret.strip()
    )

def get_facebook_app_id() -> Optional[str]:
    """Get Facebook App ID if Facebook auth is fully configured."""
    if is_facebook_auth_configured():
        return os.getenv("FACEBOOK_APP_ID", "").strip()
    return None

def _compute_appsecret_proof(token: str, app_secret: str) -> str:
    """HMAC-SHA256 of the access token using the app secret (Meta appsecret_proof)."""
    return hmac.new(
        app_secret.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

def verify_facebook_token(token: str) -> Dict[str, Any]:
    """Verify Facebook user access token is valid and issued for this app."""
    if not is_facebook_auth_configured():
        raise FacebookAuthError("Facebook OAuth is not configured on this server.")

    if not token or not token.strip():
        raise FacebookAuthError("Token is missing or empty.")

    app_id = os.getenv("FACEBOOK_APP_ID").strip()
    app_secret = os.getenv("FACEBOOK_APP_SECRET").strip()
    app_access_token = f"{app_id}|{app_secret}"

    try:
        # Bind token to this app (Meta Login Security guidance)
        debug_response = requests.get(
            "https://graph.facebook.com/debug_token",
            params={
                "input_token": token,
                "access_token": app_access_token,
            },
            timeout=10,
        )
        debug_payload = debug_response.json()
        debug_data = debug_payload.get("data") or {}

        if debug_response.status_code != 200 or "error" in debug_payload:
            error_msg = (
                (debug_payload.get("error") or {}).get("message")
                or "Facebook token validation failed."
            )
            logger.warning(f"Facebook debug_token error: {error_msg}")
            raise FacebookAuthError(error_msg)

        if not debug_data.get("is_valid"):
            raise FacebookAuthError("Facebook token is invalid or expired.")

        token_app_id = str(debug_data.get("app_id") or "")
        if token_app_id != str(app_id):
            logger.warning(
                f"Facebook token app_id mismatch: expected {app_id}, got {token_app_id}"
            )
            raise FacebookAuthError("Facebook token is not valid for this application.")

        appsecret_proof = _compute_appsecret_proof(token, app_secret)
        response = requests.get(
            "https://graph.facebook.com/v18.0/me",
            params={
                "fields": "id,name,picture.type(large)",
                "access_token": token,
                "appsecret_proof": appsecret_proof,
            },
            timeout=10,
        )
        data = response.json()

        if response.status_code != 200 or "error" in data:
            error_msg = data.get("error", {}).get("message", "Facebook token validation failed.")
            logger.warning(f"Facebook Graph API validation error: {error_msg}")
            raise FacebookAuthError(error_msg)

        fb_id = data.get("id")
        if not fb_id:
            raise FacebookAuthError("Facebook token validation failed: missing user id.")

        picture_url = None
        if "picture" in data and "data" in data["picture"] and "url" in data["picture"]["data"]:
            picture_url = data["picture"]["data"]["url"]

        return {
            "id": str(fb_id),
            "name": data.get("name", ""),
            "picture_url": picture_url
        }
    except FacebookAuthError:
        raise
    except requests.RequestException as e:
        logger.error(f"Network error calling Facebook Graph API: {e}")
        raise FacebookAuthError("Unable to contact Facebook service.")
    except (ValueError, TypeError, KeyError) as e:
        logger.error(f"Unexpected Facebook token response: {e}")
        raise FacebookAuthError("Facebook token validation failed.")

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
