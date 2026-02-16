import pytest
from fastapi import status
from app.models import User, PasswordResetToken, RefreshToken
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
import hashlib

class TestPasswordReset:
    """Test password reset functionality."""

    def test_request_password_reset_success(self, client, test_user, db_session):
        """Test successful password reset request."""
        with patch('app.services.email_service.EmailService.send_password_reset_email') as mock_send:
            mock_send.return_value = True
            
            response = client.post("/api/v1/auth/forgot-password", json={
                "email_or_username": test_user.email
            })
            
            assert response.status_code == status.HTTP_200_OK
            assert "reset link has been sent" in response.json()["message"]
            
            # Verify token created
            token = db_session.query(PasswordResetToken).filter(PasswordResetToken.user_id == test_user.id).first()
            assert token is not None
            assert token.used_at is None
            
            # Verify email sent
            mock_send.assert_called_once()

    def test_request_password_reset_invalid_email(self, client):
        """Test password reset request with invalid email (Anti-Enumeration)."""
        response = client.post("/api/v1/auth/forgot-password", json={
            "email_or_username": "nonexistent@example.com"
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert "reset link has been sent" in response.json()["message"]

    def test_request_password_reset_google_user(self, client, db_session):
        """Test password reset request for Google user (Anti-Enumeration)."""
        # Create Google user
        google_user = User(
            username="googleuser_reset",
            email="google_reset@example.com",
            password_hash="dummy",
            google_id="google_123",
            enabled=True
        )
        db_session.add(google_user)
        db_session.commit()
        
        response = client.post("/api/v1/auth/forgot-password", json={
            "email_or_username": "google_reset@example.com"
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert "reset link has been sent" in response.json()["message"]
        
        # Verify NO token created
        token = db_session.query(PasswordResetToken).filter(PasswordResetToken.user_id == google_user.id).first()
        assert token is None

    def test_verify_reset_token_success(self, client, test_user, db_session):
        """Test verifying a valid reset token."""
        # Create token
        raw_token = "valid_token_123"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        db_token = PasswordResetToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=expires
        )
        db_session.add(db_token)
        db_session.commit()
        
        response = client.get(f"/api/v1/auth/verify-reset-token?token={raw_token}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["valid"] is True

    def test_verify_reset_token_invalid(self, client):
        """Test verifying an invalid reset token."""
        response = client.get("/api/v1/auth/verify-reset-token?token=invalid_token")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_reset_token_expired(self, client, test_user, db_session):
        """Test verifying an expired reset token."""
        raw_token = "expired_token"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = datetime.now(timezone.utc) - timedelta(minutes=1)
        
        db_token = PasswordResetToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=expires
        )
        db_session.add(db_token)
        db_session.commit()
        
        response = client.get(f"/api/v1/auth/verify-reset-token?token={raw_token}")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_expired_token(self, client, test_user, db_session):
        """Test resetting password with an expired token."""
        raw_token = "expired_reset_token"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = datetime.now(timezone.utc) - timedelta(minutes=1)
        
        db_token = PasswordResetToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=expires
        )
        db_session.add(db_token)
        db_session.commit()
        
        response = client.post("/api/v1/auth/reset-password", json={
            "token": raw_token,
            "new_password": "NewPassword123!"
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_reset_token_used(self, client, test_user, db_session):
        """Test verifying a token that has already been used."""
        raw_token = "used_token"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        db_token = PasswordResetToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=expires,
            used_at=datetime.now(timezone.utc)
        )
        db_session.add(db_token)
        db_session.commit()
        
        response = client.get(f"/api/v1/auth/verify-reset-token?token={raw_token}")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_forgot_password_rate_limiting(self, client, test_user):
        """Test that the forgot-password endpoint is rate limited (5/day)."""
        # Create a test client that simulates external IP to bypass localhost exemption
        # Note: We patch app.utils.get_client_ip because it's used in the router
        # AND we patch app.limiter.get_client_ip because it's used by slowapi
        with patch('app.routers.auth.get_client_ip', return_value="192.168.2.100"), \
             patch('app.limiter.get_client_ip', return_value="192.168.2.100"):
            
            responses = []
            for i in range(7):  # More than the rate limit (5/day)
                response = client.post("/api/v1/auth/forgot-password", json={
                    "email_or_username": test_user.email
                })
                responses.append(response.status_code)

            # Should have at least one rate limited response (429)
            assert 429 in responses, "Forgot-password endpoint is not rate limited as expected"
            
            # Verify the first 5 were successful (200)
            assert responses[:5] == [200] * 5
            
            # Verify the 6th was rate limited
            assert responses[5] == 429

    def test_reset_password_success(self, client, test_user, db_session):
        """Test successful password reset."""
        raw_token = "reset_token_123"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        db_token = PasswordResetToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=expires
        )
        db_session.add(db_token)
        
        # Create a refresh token to verify revocation
        refresh = RefreshToken(
            id="refresh_123",
            user_id=test_user.id,
            token_hash="hash",
            expires_at=expires,
            is_revoked=False
        )
        db_session.add(refresh)
        db_session.commit()
        
        with patch('app.services.email_service.EmailService.send_password_changed_email') as mock_send:
            mock_send.return_value = True
            
            response = client.post("/api/v1/auth/reset-password", json={
                "token": raw_token,
                "new_password": "NewPassword123!"
            })
            
            assert response.status_code == status.HTTP_200_OK
            
            # Verify token used
            db_session.refresh(db_token)
            assert db_token.used_at is not None
            
            # Verify refresh token revoked
            db_session.refresh(refresh)
            assert refresh.is_revoked is True
            
            # Verify user password changed (login should work)
            login_response = client.post("/api/v1/auth/login", json={
                "username": test_user.username,
                "password": "NewPassword123!"
            })
            assert login_response.status_code == status.HTTP_200_OK

    def test_reset_password_weak_password(self, client, test_user, db_session):
        """Test reset password with weak password (fails complexity check)."""
        raw_token = "valid_token"
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        
        db_token = PasswordResetToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=expires
        )
        db_session.add(db_token)
        db_session.commit()
        
        # Password is long enough (>8) but lacks complexity (no special char/uppercase)
        # This passes Pydantic validation (422) but hits our custom check (400)
        response = client.post("/api/v1/auth/reset-password", json={
            "token": raw_token,
            "new_password": "password123" 
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
