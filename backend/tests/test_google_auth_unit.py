import os
import types
import pytest
from fastapi import HTTPException

from app.google_auth import (
    validate_google_config,
    verify_google_token,
    get_or_create_google_user,
    authenticate_google_user,
    GoogleAuthError,
)
from app.models import User


def test_validate_google_config_missing(monkeypatch):
    import app.google_auth as gauth
    # Ensure module-level constant reflects missing env
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.setattr(gauth, "GOOGLE_CLIENT_ID", None, raising=False)
    with pytest.raises(ValueError):
        gauth.validate_google_config()


def test_verify_google_token_invalid_format(monkeypatch):
    import app.google_auth as gauth
    # Ensure module-level constant matches
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "dummy-client-id")
    monkeypatch.setattr(gauth, "GOOGLE_CLIENT_ID", "dummy-client-id", raising=False)
    with pytest.raises(GoogleAuthError):
        verify_google_token("not-a-jwt")


def test_verify_google_token_success(monkeypatch):
    import app.google_auth as gauth
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "dummy-client-id")
    monkeypatch.setattr(gauth, "GOOGLE_CLIENT_ID", "dummy-client-id", raising=False)

    class DummyIdToken:
        @staticmethod
        def verify_oauth2_token(token, request, client_id):
            return {
                "aud": "dummy-client-id",
                "iss": "accounts.google.com",
                "email": "user@example.com",
                "sub": "google-sub-123",
            }

    # Patch module reference
    monkeypatch.setattr(gauth, "id_token", DummyIdToken)
    # requests.Request() is used only for type; leave as-is

    info = gauth.verify_google_token("header.payload.sig")
    assert info["email"] == "user@example.com"
    assert info["sub"] == "google-sub-123"


def test_get_or_create_google_user_existing_updates(db_session):
    # Create existing user without google_id or name
    user = User(username="existing", email="user@example.com", password_hash="x", enabled=True)
    db_session.add(user)
    db_session.commit()

    info = {"email": "user@example.com", "sub": "sub-1", "name": "Full Name"}
    u = get_or_create_google_user(db_session, info)
    assert u.id == user.id
    assert u.google_id == "sub-1"
    assert u.name == "Full Name"


def test_authenticate_google_user_unauthorized(monkeypatch, db_session):
    import app.google_auth as gauth

    def fake_verify(_token):
        raise gauth.GoogleAuthError("bad token")

    monkeypatch.setattr(gauth, "verify_google_token", fake_verify)
    with pytest.raises(HTTPException) as ei:
        authenticate_google_user("token", db_session)
    assert ei.value.status_code == 401


