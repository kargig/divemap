"""
Tests for email verification functionality.
"""

import pytest
from fastapi import status
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from app.models import User, EmailVerificationToken
from app.services.email_verification_service import email_verification_service


class TestEmailVerificationService:
    """Test email verification service functions."""

    def test_generate_verification_token(self):
        """Test token generation creates unique tokens."""
        token1 = email_verification_service.generate_verification_token()
        token2 = email_verification_service.generate_verification_token()
        
        assert token1 != token2
        assert len(token1) > 32  # URL-safe base64 encoding
        assert isinstance(token1, str)

    def test_create_verification_token(self, db_session, test_user):
        """Test creating a verification token."""
        token_obj = email_verification_service.create_verification_token(test_user.id, db_session)
        
        assert token_obj is not None
        assert token_obj.user_id == test_user.id
        assert token_obj.token is not None
        # Check expiration is in the future (handle timezone-aware/naive)
        expires_at = token_obj.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        assert expires_at > datetime.now(timezone.utc)
        assert token_obj.used_at is None

    def test_create_verification_token_revokes_old_tokens(self, db_session, test_user):
        """Test that creating a new token revokes old unused tokens."""
        # Create first token
        token1 = email_verification_service.create_verification_token(test_user.id, db_session)
        db_session.refresh(token1)
        
        # Create second token
        token2 = email_verification_service.create_verification_token(test_user.id, db_session)
        
        # First token should be marked as used
        db_session.refresh(token1)
        assert token1.used_at is not None
        
        # Second token should be active
        assert token2.used_at is None

    def test_verify_token_success(self, db_session, test_user):
        """Test successful token verification."""
        # Create token
        token_obj = email_verification_service.create_verification_token(test_user.id, db_session)
        
        # Verify token
        user = email_verification_service.verify_token(token_obj.token, db_session)
        
        assert user is not None
        assert user.id == test_user.id
        assert user.email_verified is True
        assert user.email_verified_at is not None
        
        # Token should be marked as used
        db_session.refresh(token_obj)
        assert token_obj.used_at is not None

    def test_verify_token_expired(self, db_session, test_user):
        """Test verification fails for expired token."""
        # Create token and manually expire it
        token_obj = EmailVerificationToken(
            user_id=test_user.id,
            token=email_verification_service.generate_verification_token(),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)  # Expired 1 hour ago
        )
        db_session.add(token_obj)
        db_session.commit()
        
        # Verification should fail
        user = email_verification_service.verify_token(token_obj.token, db_session)
        assert user is None

    def test_verify_token_already_used(self, db_session, test_user):
        """Test verification fails for already used token."""
        # Create and use a token
        token_obj = email_verification_service.create_verification_token(test_user.id, db_session)
        email_verification_service.verify_token(token_obj.token, db_session)
        
        # Try to use it again
        user = email_verification_service.verify_token(token_obj.token, db_session)
        assert user is None

    def test_verify_token_invalid(self, db_session):
        """Test verification fails for invalid token."""
        user = email_verification_service.verify_token("invalid_token_12345", db_session)
        assert user is None

    def test_is_token_valid(self, db_session, test_user):
        """Test token validity check."""
        # Create valid token
        token_obj = email_verification_service.create_verification_token(test_user.id, db_session)
        assert email_verification_service.is_token_valid(token_obj.token, db_session) is True
        
        # Expired token
        token_obj.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db_session.commit()
        assert email_verification_service.is_token_valid(token_obj.token, db_session) is False

    def test_resend_verification_email(self, db_session, test_user):
        """Test resending verification email."""
        # User should not be verified
        test_user.email_verified = False
        db_session.commit()
        
        token_obj = email_verification_service.resend_verification_email(test_user.id, db_session)
        assert token_obj is not None
        assert token_obj.user_id == test_user.id

    def test_resend_verification_email_already_verified(self, db_session, test_user):
        """Test resend returns None for already verified user."""
        test_user.email_verified = True
        db_session.commit()
        
        token_obj = email_verification_service.resend_verification_email(test_user.id, db_session)
        assert token_obj is None

    def test_resend_verification_email_nonexistent_user(self, db_session):
        """Test resend returns None for nonexistent user."""
        token_obj = email_verification_service.resend_verification_email(99999, db_session)
        assert token_obj is None


class TestEmailVerificationEndpoints:
    """Test email verification API endpoints."""

    def test_register_creates_unverified_user(self, client, db_session):
        """Test registration creates user with email_verified=False."""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
                mock_send.return_value = True
                
                response = client.post("/api/v1/auth/register", json={
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "Password123!"
                })
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check user was created with email_verified=False
        user = db_session.query(User).filter(User.username == "newuser").first()
        assert user is not None
        assert user.email_verified is False
        assert user.email_verified_at is None
        
        # Check verification token was created
        token = db_session.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id
        ).first()
        assert token is not None

    def test_register_sends_verification_email(self, client):
        """Test registration sends verification email."""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
                mock_send.return_value = True
                
                response = client.post("/api/v1/auth/register", json={
                    "username": "newuser2",
                    "email": "newuser2@example.com",
                    "password": "Password123!"
                })
        
        assert response.status_code == status.HTTP_201_CREATED
        mock_send.assert_called_once()

    @pytest.mark.parametrize("email_verification_required", [True, False])
    def test_register_with_verification_setting(self, client, db_session, email_verification_required, monkeypatch):
        """Test registration behavior with EMAIL_VERIFICATION_REQUIRED setting."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", str(email_verification_required).lower())
        
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
                mock_send.return_value = True
                
                response = client.post("/api/v1/auth/register", json={
                    "username": f"user_{email_verification_required}",
                    "email": f"user_{email_verification_required}@example.com",
                    "password": "Password123!"
                })
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        
        if email_verification_required:
            assert data["access_token"] is None
            assert "verify" in data["message"].lower() or "email" in data["message"].lower()
        else:
            assert data["access_token"] is not None

    def test_verify_email_success(self, client, db_session, test_user):
        """Test successful email verification."""
        # Create verification token
        token_obj = email_verification_service.create_verification_token(test_user.id, db_session)
        test_user.email_verified = False
        db_session.commit()
        
        # Verify email with JSON format
        response = client.get(f"/api/v1/auth/verify-email?token={token_obj.token}&format=json")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Check user is now verified
        db_session.refresh(test_user)
        assert test_user.email_verified is True
        assert test_user.email_verified_at is not None

    def test_verify_email_invalid_token(self, client):
        """Test verification with invalid token."""
        response = client.get("/api/v1/auth/verify-email?token=invalid_token&format=json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_email_expired_token(self, client, db_session, test_user):
        """Test verification with expired token."""
        # Create expired token
        token_obj = EmailVerificationToken(
            user_id=test_user.id,
            token=email_verification_service.generate_verification_token(),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db_session.add(token_obj)
        db_session.commit()
        
        response = client.get(f"/api/v1/auth/verify-email?token={token_obj.token}&format=json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_resend_verification_success(self, client, db_session, test_user):
        """Test resending verification email."""
        test_user.email_verified = False
        db_session.commit()
        
        with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
            mock_send.return_value = True
            
            response = client.post("/api/v1/auth/resend-verification", json={
                "email": test_user.email
            })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        mock_send.assert_called_once()

    def test_resend_verification_nonexistent_email(self, client):
        """Test resend with nonexistent email (should still return success to prevent enumeration)."""
        with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
            response = client.post("/api/v1/auth/resend-verification", json={
                "email": "nonexistent@example.com"
            })
        
        assert response.status_code == status.HTTP_200_OK
        # Should not call send_email for nonexistent user
        mock_send.assert_not_called()

    def test_resend_verification_already_verified(self, client, db_session, test_user):
        """Test resend for already verified email (should still return success)."""
        test_user.email_verified = True
        db_session.commit()
        
        with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
            response = client.post("/api/v1/auth/resend-verification", json={
                "email": test_user.email
            })
        
        assert response.status_code == status.HTTP_200_OK
        # Should not send email for already verified user
        mock_send.assert_not_called()

    def test_resend_verification_rate_limit(self, client, db_session, test_user):
        """Test rate limiting on resend verification."""
        test_user.email_verified = False
        db_session.commit()
        
        # Create 3 recent tokens (rate limit is 3 per day)
        for i in range(3):
            token = EmailVerificationToken(
                user_id=test_user.id,
                token=email_verification_service.generate_verification_token(),
                expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
                created_at=datetime.now(timezone.utc) - timedelta(hours=12)  # Created 12 hours ago
            )
            db_session.add(token)
        db_session.commit()
        
        with patch('app.services.email_service.EmailService.send_verification_email') as mock_send:
            response = client.post("/api/v1/auth/resend-verification", json={
                "email": test_user.email
            })
        
        assert response.status_code == status.HTTP_200_OK
        # Should not send email due to rate limit
        mock_send.assert_not_called()

    def test_login_blocked_unverified_email(self, client, db_session, monkeypatch):
        """Test login is blocked for unverified email when verification is required."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
        
        # Create unverified user
        from app.auth import get_password_hash
        user = User(
            username="unverified",
            email="unverified@example.com",
            password_hash=get_password_hash("Password123!"),
            email_verified=False,
            enabled=True
        )
        db_session.add(user)
        db_session.commit()
        
        response = client.post("/api/v1/auth/login", json={
            "username": "unverified",
            "password": "Password123!"
        })
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "verify your email" in response.json()["detail"].lower()

    def test_login_allowed_verified_email(self, client, db_session, monkeypatch):
        """Test login is allowed for verified email."""
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "true")
        
        # Create verified user
        from app.auth import get_password_hash
        user = User(
            username="verified",
            email="verified@example.com",
            password_hash=get_password_hash("Password123!"),
            email_verified=True,
            email_verified_at=datetime.now(timezone.utc),
            enabled=True
        )
        db_session.add(user)
        db_session.commit()
        
        response = client.post("/api/v1/auth/login", json={
            "username": "verified",
            "password": "Password123!"
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.json()

    def test_google_oauth_user_auto_verified(self, client, db_session):
        """Test Google OAuth users are automatically verified."""
        # Mock the entire google_auth module functions
        with patch('app.routers.auth.verify_google_token') as mock_verify, \
             patch('app.routers.auth.get_or_create_google_user') as mock_get_or_create:
            
            # Create a mock user that will be returned
            from app.auth import get_password_hash
            mock_user = User(
                username="googleuser",
                email="google@example.com",
                password_hash=get_password_hash("dummy"),
                google_id="google123",
                email_verified=True,
                email_verified_at=datetime.now(timezone.utc),
                enabled=True
            )
            db_session.add(mock_user)
            db_session.commit()
            
            mock_verify.return_value = {
                'sub': 'google123',
                'email': 'google@example.com',
                'name': 'Google User',
                'picture': 'https://example.com/pic.jpg'
            }
            mock_get_or_create.return_value = mock_user
            
            response = client.post("/api/v1/auth/google-login", json={
                "token": "fake_google_token"
            })
        
        assert response.status_code == status.HTTP_200_OK
        
        # Check user was created with email_verified=True
        user = db_session.query(User).filter(User.email == "google@example.com").first()
        assert user is not None
        assert user.email_verified is True
        assert user.email_verified_at is not None

    def test_enabled_field_independent_of_email_verified(self, client, db_session):
        """Test that enabled and email_verified fields are independent."""
        # Create user that is enabled but not verified
        from app.auth import get_password_hash
        user = User(
            username="enabled_unverified",
            email="enabled_unverified@example.com",
            password_hash=get_password_hash("Password123!"),
            enabled=True,
            email_verified=False
        )
        db_session.add(user)
        db_session.commit()
        
        # User should exist and be enabled but not verified
        assert user.enabled is True
        assert user.email_verified is False
        
        # Admin can disable user even if verified
        user.email_verified = True
        user.enabled = False  # Admin disables
        db_session.commit()
        
        assert user.email_verified is True
        assert user.enabled is False

