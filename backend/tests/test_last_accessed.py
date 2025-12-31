import pytest
from fastapi import status
from datetime import datetime, timedelta
import time
from unittest.mock import patch

class TestLastAccessedAt:
    """Test user last_accessed_at tracking."""

    def test_login_updates_last_accessed_at(self, client, test_user, db_session):
        """Test that login updates the last_accessed_at timestamp."""
        # Ensure last_accessed_at is initially None
        test_user.last_accessed_at = None
        db_session.commit()
        db_session.refresh(test_user)
        assert test_user.last_accessed_at is None

        # Mock Turnstile service to be disabled
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            # Login
            response = client.post("/api/v1/auth/login", json={
                "username": test_user.username,
                "password": "TestPass123!"  # Password from conftest.py
            })

        assert response.status_code == status.HTTP_200_OK

        # Verify last_accessed_at was updated
        db_session.refresh(test_user)
        assert test_user.last_accessed_at is not None
        # Should be very recent
        assert (datetime.utcnow() - test_user.last_accessed_at.replace(tzinfo=None)).total_seconds() < 10

    def test_token_refresh_updates_last_accessed_at(self, client, test_user, db_session):
        """Test that token refresh updates the last_accessed_at timestamp."""
        # Set last_accessed_at to something in the past
        past_time = datetime.utcnow() - timedelta(hours=1)
        test_user.last_accessed_at = past_time
        db_session.commit()
        
        # Login to get refresh token
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            login_response = client.post("/api/v1/auth/login", json={
                "username": test_user.username,
                "password": "TestPass123!"
            })
            
        refresh_token = login_response.cookies.get("refresh_token")
        
        # Wait a small amount to ensure timestamp difference is measurable if needed
        # but db update will be now() so it will definitely be > past_time
        
        # Refresh token
        response = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})
        assert response.status_code == status.HTTP_200_OK
        
        # Verify last_accessed_at was updated
        db_session.refresh(test_user)
        assert test_user.last_accessed_at is not None
        assert test_user.last_accessed_at.replace(tzinfo=None) > past_time

    def test_admin_list_includes_last_accessed_at(self, client, test_admin_user, test_user, db_session, admin_headers):
        """Test that admin user list includes last_accessed_at field."""
        # Update test_user's last_accessed_at
        now = datetime.utcnow()
        test_user.last_accessed_at = now
        db_session.commit()
        
        response = client.get("/api/v1/users/admin/users", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        
        users = response.json()
        target_user = next((u for u in users if u["id"] == test_user.id), None)
        assert target_user is not None
        assert target_user["last_accessed_at"] is not None
        
        # Check sorting
        response_sorted = client.get("/api/v1/users/admin/users?sort_by=last_accessed_at&sort_order=desc", headers=admin_headers)
        assert response_sorted.status_code == status.HTTP_200_OK

    def test_google_login_updates_last_accessed_at(self, client, db_session):
        """Test that Google login updates last_accessed_at."""
        from app.models import User
        
        # Create user via Google login flow logic
        with patch('app.routers.auth.verify_google_token') as mock_verify, \
             patch('app.routers.auth.get_or_create_google_user') as mock_get_or_create:
            
            mock_verify.return_value = {
                'sub': 'google_123',
                'email': 'google@example.com',
                'name': 'Google User',
                'picture': 'http://example.com/pic.jpg'
            }
            
            # Create a mock user
            user = User(
                username="googleuser",
                email="google@example.com",
                password_hash="hash",
                enabled=True,
                last_accessed_at=None
            )
            db_session.add(user)
            db_session.commit()
            
            mock_get_or_create.return_value = user
            
            response = client.post("/api/v1/auth/google-login", json={"token": "fake-token"})
            assert response.status_code == status.HTTP_200_OK
            
            db_session.refresh(user)
            assert user.last_accessed_at is not None
