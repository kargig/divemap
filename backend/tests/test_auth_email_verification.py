"""
Additional tests for email verification in authentication flow.

These tests specifically validate the interaction between email verification
and login functionality.
"""

import pytest
from fastapi import status
from datetime import datetime, timezone
from unittest.mock import patch
from app.models import User
from app.auth import get_password_hash


class TestAuthEmailVerification:
    """Test email verification requirements in authentication."""

    def test_login_unverified_user_blocked(self, client, db_session, monkeypatch):
        """Test that unverified users cannot login when verification is required."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
        
        # Create unverified user
        user = User(
            username="unverified_user",
            email="unverified_user@example.com",
            password_hash=get_password_hash("Password123!"),
            enabled=True,
            email_verified=False  # Not verified
        )
        db_session.add(user)
        db_session.commit()
        
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "unverified_user",
                "password": "Password123!"
            })
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "verify your email" in response.json()["detail"].lower()

    def test_login_verified_user_allowed(self, client, db_session, monkeypatch):
        """Test that verified users can login when verification is required."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
        
        # Create verified user
        user = User(
            username="verified_user",
            email="verified_user@example.com",
            password_hash=get_password_hash("Password123!"),
            enabled=True,
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc)
        )
        db_session.add(user)
        db_session.commit()
        
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "verified_user",
                "password": "Password123!"
            })
        
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.json()

    def test_login_unverified_user_allowed_when_verification_disabled(self, client, db_session, monkeypatch):
        """Test that unverified users can login when verification requirement is disabled."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "false")
        
        # Create unverified user
        user = User(
            username="unverified_allowed",
            email="unverified_allowed@example.com",
            password_hash=get_password_hash("Password123!"),
            enabled=True,
            email_verified=False  # Not verified, but should still be able to login
        )
        db_session.add(user)
        db_session.commit()
        
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "unverified_allowed",
                "password": "Password123!"
            })
        
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.json()

    def test_login_unverified_disabled_user_still_blocked(self, client, db_session, monkeypatch):
        """Test that unverified AND disabled users are blocked (both checks apply)."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
        
        # Create unverified and disabled user
        user = User(
            username="unverified_disabled",
            email="unverified_disabled@example.com",
            password_hash=get_password_hash("Password123!"),
            enabled=False,  # Disabled
            email_verified=False  # Not verified
        )
        db_session.add(user)
        db_session.commit()
        
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "unverified_disabled",
                "password": "Password123!"
            })
        
        # Should be blocked (either by email verification or enabled check)
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED]

    def test_login_verified_disabled_user_blocked_by_enabled(self, client, db_session, monkeypatch):
        """Test that verified but disabled users are still blocked by enabled check."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
        
        # Create verified but disabled user
        user = User(
            username="verified_disabled",
            email="verified_disabled@example.com",
            password_hash=get_password_hash("Password123!"),
            enabled=False,  # Disabled
            email_verified=True,  # Verified
            email_verified_at=datetime.now(timezone.utc)
        )
        db_session.add(user)
        db_session.commit()
        
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "verified_disabled",
                "password": "Password123!"
            })
        
        # Login should succeed (enabled check happens after login in get_current_active_user)
        # But accessing protected endpoints should fail
        assert response.status_code == status.HTTP_200_OK
        token = response.json()["access_token"]
        
        # Accessing protected endpoint should fail
        me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_response.status_code == status.HTTP_403_FORBIDDEN
        assert "disabled" in me_response.json()["detail"].lower()

