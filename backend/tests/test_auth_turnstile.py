import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models import User
from app.auth import get_password_hash


class TestAuthTurnstileIntegration:
    """Test authentication endpoints with Turnstile integration"""

    def test_register_without_turnstile_when_disabled(self, client):
        """Test registration works without Turnstile when service is disabled"""
        # Mock the turnstile_service instance directly
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/register", json={
                "username": "newuser1",
                "email": "newuser1@example.com",
                "password": "NewPassword123!"
            })
            
            assert response.status_code == 201
            mock_service.verify_token.assert_not_called()

    def test_register_with_turnstile_when_enabled(self, client):
        """Test registration requires Turnstile token when service is enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/register", json={
                "username": "newuser2",
                "email": "newuser2@example.com",
                "password": "NewPassword123!"
                # No turnstile_token provided
            })
            
            assert response.status_code == 400
            assert "Turnstile verification is required" in response.json()["detail"]
            mock_service.verify_token.assert_not_called()

    def test_register_with_valid_turnstile_token(self, client):
        """Test registration succeeds with valid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/register", json={
                "username": "newuser3",
                "email": "newuser3@example.com",
                "password": "NewPassword123!",
                "turnstile_token": "valid_turnstile_token"
            })
            
            assert response.status_code == 201
            # The test client sets X-Forwarded-For: 127.0.0.1, so that's what we expect
            mock_service.verify_token.assert_called_once_with("valid_turnstile_token", "127.0.0.1")

    def test_register_with_invalid_turnstile_token(self, client):
        """Test registration fails with invalid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(side_effect=HTTPException(status_code=400, detail="Invalid token"))
            
            response = client.post("/api/v1/auth/register", json={
                "username": "newuser4",
                "email": "newuser4@example.com",
                "password": "NewPassword123!",
                "turnstile_token": "invalid_turnstile_token"
            })
            
            assert response.status_code == 400
            assert "Invalid token" in response.json()["detail"]
            mock_service.verify_token.assert_called_once_with("invalid_turnstile_token", "127.0.0.1")

    def test_login_without_turnstile_when_disabled(self, client, test_user):
        """Test login works without Turnstile when service is disabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!"
            })
            
            assert response.status_code == 200
            mock_service.verify_token.assert_not_called()

    def test_login_with_turnstile_when_enabled(self, client, test_user):
        """Test login requires Turnstile token when service is enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!"
                # No turnstile_token provided
            })
            
            assert response.status_code == 400
            assert "Turnstile verification is required" in response.json()["detail"]
            mock_service.verify_token.assert_not_called()

    def test_login_with_valid_turnstile_token(self, client, test_user):
        """Test login succeeds with valid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!",
                "turnstile_token": "valid_turnstile_token"
            })
            
            assert response.status_code == 200
            mock_service.verify_token.assert_called_once_with("valid_turnstile_token", "127.0.0.1")

    def test_login_with_invalid_turnstile_token(self, client, test_user):
        """Test login fails with invalid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(side_effect=HTTPException(status_code=400, detail="Invalid token"))
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!",
                "turnstile_token": "invalid_turnstile_token"
            })
            
            assert response.status_code == 400
            assert "Invalid token" in response.json()["detail"]
            mock_service.verify_token.assert_called_once_with("invalid_turnstile_token", "127.0.0.1")

    def test_turnstile_verification_called_with_correct_ip(self, client, test_user):
        """Test that Turnstile verification is called with the correct client IP"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!",
                "turnstile_token": "test_token"
            })
            
            # Should succeed with valid credentials and Turnstile token
            assert response.status_code == 200
            mock_service.verify_token.assert_called_once_with("test_token", "127.0.0.1")

    def test_turnstile_service_initialization(self):
        """Test that Turnstile service is properly initialized"""
        from app.turnstile_service import TurnstileService
        
        # Test that the service can be instantiated
        service = TurnstileService()
        assert service is not None
        assert hasattr(service, 'is_enabled')
        assert hasattr(service, 'verify_token')
