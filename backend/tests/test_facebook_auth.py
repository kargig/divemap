import pytest
from unittest.mock import patch, MagicMock
from app.facebook_auth import (
    verify_facebook_token,
    get_or_create_facebook_user,
    is_facebook_auth_configured,
    get_facebook_app_id,
    FacebookAuthError
)
from app.models import User, NotificationPreference

def test_is_facebook_auth_configured(monkeypatch):
    monkeypatch.delenv("FACEBOOK_APP_ID", raising=False)
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    assert is_facebook_auth_configured() is False

    monkeypatch.setenv("FACEBOOK_APP_ID", "123456789")
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    assert is_facebook_auth_configured() is False

    monkeypatch.setenv("FACEBOOK_APP_ID", "123456789")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "")
    assert is_facebook_auth_configured() is False

    monkeypatch.setenv("FACEBOOK_APP_ID", "123456789")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "   ")
    assert is_facebook_auth_configured() is False

    monkeypatch.setenv("FACEBOOK_APP_ID", "123456789")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "secret_value")
    assert is_facebook_auth_configured() is True

def test_get_facebook_app_id(monkeypatch):
    monkeypatch.delenv("FACEBOOK_APP_ID", raising=False)
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    assert get_facebook_app_id() is None

    monkeypatch.setenv("FACEBOOK_APP_ID", "123456789")
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    assert get_facebook_app_id() is None

    monkeypatch.setenv("FACEBOOK_APP_ID", "123456789")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "secret_value")
    assert get_facebook_app_id() == "123456789"

def test_verify_facebook_token_not_configured(monkeypatch):
    monkeypatch.delenv("FACEBOOK_APP_ID", raising=False)
    monkeypatch.delenv("FACEBOOK_APP_SECRET", raising=False)
    with pytest.raises(FacebookAuthError) as exc_info:
        verify_facebook_token("valid_token")
    assert "not configured" in str(exc_info.value).lower()

def test_verify_facebook_token_empty_app_id(monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "secret")
    with pytest.raises(FacebookAuthError) as exc_info:
        verify_facebook_token("valid_token")
    assert "not configured" in str(exc_info.value).lower()

def test_verify_facebook_token_success(monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test_app_id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test_secret")
    with patch('app.facebook_auth.requests.get') as mock_get:
        debug_response = MagicMock()
        debug_response.status_code = 200
        debug_response.json.return_value = {
            "data": {
                "app_id": "test_app_id",
                "is_valid": True,
                "user_id": "fb_123456",
            }
        }
        me_response = MagicMock()
        me_response.status_code = 200
        me_response.json.return_value = {
            "id": "fb_123456",
            "name": "Jane Doe",
            "picture": {"data": {"url": "https://cdn.facebook.com/avatar.jpg"}}
        }
        mock_get.side_effect = [debug_response, me_response]

        info = verify_facebook_token("valid_token")
        assert info["id"] == "fb_123456"
        assert info["name"] == "Jane Doe"
        assert info["picture_url"] == "https://cdn.facebook.com/avatar.jpg"
        assert mock_get.call_count == 2
        me_params = mock_get.call_args_list[1].kwargs["params"]
        assert "appsecret_proof" in me_params

def test_verify_facebook_token_wrong_app(monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test_app_id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test_secret")
    with patch('app.facebook_auth.requests.get') as mock_get:
        debug_response = MagicMock()
        debug_response.status_code = 200
        debug_response.json.return_value = {
            "data": {
                "app_id": "other_app_id",
                "is_valid": True,
                "user_id": "fb_123456",
            }
        }
        mock_get.return_value = debug_response

        with pytest.raises(FacebookAuthError) as exc_info:
            verify_facebook_token("foreign_token")
        assert "not valid for this application" in str(exc_info.value).lower()

def test_verify_facebook_token_failure(monkeypatch):
    monkeypatch.setenv("FACEBOOK_APP_ID", "test_app_id")
    monkeypatch.setenv("FACEBOOK_APP_SECRET", "test_secret")
    with patch('app.facebook_auth.requests.get') as mock_get:
        debug_response = MagicMock()
        debug_response.status_code = 400
        debug_response.json.return_value = {"error": {"message": "Invalid token"}}
        mock_get.return_value = debug_response

        with pytest.raises(FacebookAuthError):
            verify_facebook_token("bad_token")

def test_get_or_create_facebook_user_new(db_session):
    fb_info = {
        "id": "fb_999888",
        "name": "Scuba Diver",
        "picture_url": "https://cdn.facebook.com/scuba.jpg"
    }
    user = get_or_create_facebook_user(db_session, fb_info)
    assert user.facebook_id == "fb_999888"
    assert user.email == f"{user.username}@facebook.divemap.invalid"
    assert user.email_notifications_opted_out is True
    assert user.facebook_avatar_url == "https://cdn.facebook.com/scuba.jpg"
    assert user.avatar_type == "facebook"
