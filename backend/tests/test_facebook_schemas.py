from datetime import datetime, timezone
import pytest
from app.schemas import AvatarType, UserResponse

def test_avatar_type_has_facebook():
    assert AvatarType.facebook == "facebook"
    assert "facebook" in [e.value for e in AvatarType]

def test_user_response_accepts_facebook_avatar():
    now = datetime.now(timezone.utc)
    data = {
        "id": 1,
        "username": "testuser",
        "email": "test@facebook.divemap.invalid",
        "enabled": True,
        "is_admin": False,
        "is_moderator": False,
        "created_at": now,
        "updated_at": now,
        "facebook_avatar_url": "https://graph.facebook.com/picture.jpg"
    }
    user = UserResponse(**data)
    assert user.facebook_avatar_url == "https://graph.facebook.com/picture.jpg"
