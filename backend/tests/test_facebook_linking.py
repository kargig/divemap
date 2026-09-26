from datetime import timedelta
import pytest
from unittest.mock import patch
from app.models import User
from app.schemas import AvatarType
from app.auth import create_access_token

@patch('app.routers.users.verify_facebook_token')
def test_link_and_unlink_facebook(mock_verify, client, db_session, monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "mock_fb_id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "mock_fb_secret")
    mock_verify.return_value = {
        "id": "fb_link_123",
        "name": "Link User",
        "picture_url": "https://avatar.link/pic.jpg"
    }
    user = User(
        username="localuser",
        email="local@example.com",
        password_hash="somehash",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    # Link Facebook
    res = client.post("/api/v1/users/me/facebook/link", json={"token": "valid_token"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["facebook_avatar_url"] == "https://avatar.link/pic.jpg"
    assert res.json()["facebook_id"] == "fb_link_123"

    db_session.refresh(user)
    assert user.facebook_id == "fb_link_123"
    assert user.facebook_avatar_url == "https://avatar.link/pic.jpg"

    # Unlink Facebook (allowed: real email)
    res = client.delete("/api/v1/users/me/facebook/unlink", headers=headers)
    assert res.status_code == 200
    assert res.json()["facebook_avatar_url"] is None
    assert res.json()["facebook_id"] is None

    db_session.refresh(user)
    assert user.facebook_id is None
    assert user.facebook_avatar_url is None

def test_unlink_facebook_blocked_for_facebook_only_user(client, db_session):
    user = User(
        username="fbonly",
        email="fbonly@facebook.divemap.invalid",
        password_hash="random_unused_hash",
        facebook_id="fb_only_1",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    res = client.delete("/api/v1/users/me/facebook/unlink", headers=headers)
    assert res.status_code == 400
    assert "no other login method" in res.json()["detail"].lower()

    db_session.refresh(user)
    assert user.facebook_id == "fb_only_1"

def test_link_facebook_disabled_when_app_id_not_set(client, db_session, monkeypatch):
    monkeypatch.delenv("FACEBOOK_APP_ID", raising=False)
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    user = User(
        username="localuser2",
        email="local2@example.com",
        password_hash="somehash",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/users/me/facebook/link", json={"token": "valid_token"}, headers=headers)
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()

def test_upgrade_synthetic_email(client, db_session):
    user = User(
        username="fb_email_upgrade",
        email="fb_email_upgrade@facebook.divemap.invalid",
        password_hash="somehash",
        facebook_id="fb_email_1",
        email_notifications_opted_out=True,
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    with patch('app.services.email_service.EmailService.send_verification_email', return_value=True):
        res = client.put(
            "/api/v1/users/me",
            json={"email": "real@example.com"},
            headers=headers,
        )
    assert res.status_code == 200
    assert res.json()["email"] == "real@example.com"
    assert res.json()["email_verified"] is False
    assert res.json()["facebook_id"] == "fb_email_1"

    db_session.refresh(user)
    assert user.email == "real@example.com"
    assert user.email_notifications_opted_out is False

def test_cannot_change_non_synthetic_email(client, db_session):
    user = User(
        username="local_email_lock",
        email="locked@example.com",
        password_hash="somehash",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    res = client.put(
        "/api/v1/users/me",
        json={"email": "new@example.com", "name": "Still Locked"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["email"] == "locked@example.com"
    assert res.json()["name"] == "Still Locked"

def test_remove_avatar_resets_to_facebook_photo(client, db_session):
    user = User(
        username="fb_avatar_user",
        email="fb_avatar@example.com",
        password_hash="somehash",
        avatar_url="https://custom.avatar/pic.webp",
        avatar_type="custom",
        facebook_avatar_url="https://fb.avatar/pic.jpg",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    res = client.delete("/api/v1/users/me/avatar", headers=headers)
    assert res.status_code == 200
    db_session.refresh(user)
    assert user.avatar_url == "https://fb.avatar/pic.jpg"
    assert user.avatar_type == AvatarType.facebook
