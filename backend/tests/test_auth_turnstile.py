import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import get_db
from app.models import Base, User
from app.auth import get_password_hash
import os


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Setup test database before each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def test_user(setup_database):
    """Create a test user for authentication tests"""
    db = TestingSessionLocal()
    
    # Create test user
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("TestPassword123!"),
        enabled=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    
    return user


class TestAuthTurnstileIntegration:
    """Test authentication endpoints with Turnstile integration"""

    def test_register_without_turnstile_when_disabled(self, setup_database):
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

    def test_register_with_turnstile_when_enabled(self, setup_database):
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

    def test_register_with_valid_turnstile_token(self, setup_database):
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
            mock_service.verify_token.assert_called_once_with(
                "valid_turnstile_token", 
                "testclient"
            )

    def test_register_with_invalid_turnstile_token(self, setup_database):
        """Test registration fails with invalid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(side_effect=HTTPException(
                status_code=400, 
                detail="Turnstile verification failed: invalid-input-response"
            ))
            
            response = client.post("/api/v1/auth/register", json={
                "username": "newuser4",
                "email": "newuser4@example.com",
                "password": "NewPassword123!",
                "turnstile_token": "invalid_turnstile_token"
            })
            
            assert response.status_code == 400
            assert "Turnstile verification failed" in response.json()["detail"]

    def test_login_without_turnstile_when_disabled(self, setup_database, test_user):
        """Test login works without Turnstile when service is disabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPassword123!"
            })
            
            assert response.status_code == 200
            assert "access_token" in response.json()
            mock_service.verify_token.assert_not_called()

    def test_login_with_turnstile_when_enabled(self, setup_database, test_user):
        """Test login requires Turnstile token when service is enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPassword123!"
                # No turnstile_token provided
            })
            
            assert response.status_code == 400
            assert "Turnstile verification is required" in response.json()["detail"]
            mock_service.verify_token.assert_not_called()

    def test_login_with_valid_turnstile_token(self, setup_database, test_user):
        """Test login succeeds with valid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPassword123!",
                "turnstile_token": "valid_turnstile_token"
            })
            
            assert response.status_code == 200
            assert "access_token" in response.json()
            mock_service.verify_token.assert_called_once_with(
                "valid_turnstile_token", 
                "testclient"
            )

    def test_login_with_invalid_turnstile_token(self, setup_database, test_user):
        """Test login fails with invalid Turnstile token when enabled"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(side_effect=HTTPException(
                status_code=400, 
                detail="Turnstile verification failed: invalid-input-response"
            ))
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPassword123!",
                "turnstile_token": "invalid_turnstile_token"
            })
            
            assert response.status_code == 400
            assert "Turnstile verification failed" in response.json()["detail"]

    def test_turnstile_verification_called_with_correct_ip(self, setup_database, test_user):
        """Test that Turnstile verification is called with the correct client IP"""
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock()
            
            # Test with custom headers to simulate different IP
            response = client.post("/api/v1/auth/login", 
                json={
                    "username": "testuser",
                    "password": "TestPassword123!",
                    "turnstile_token": "valid_turnstile_token"
                },
                headers={"X-Forwarded-For": "192.168.1.100"}
            )
            
            assert response.status_code == 200
            # Note: TestClient uses "testclient" as default IP
            mock_service.verify_token.assert_called_once_with(
                "valid_turnstile_token", 
                "testclient"
            )

    def test_turnstile_service_initialization(self):
        """Test that Turnstile service is properly initialized"""
        from app.routers.auth import turnstile_service
        
        # The service should be imported and available
        assert turnstile_service is not None
        assert hasattr(turnstile_service, 'is_enabled')
        assert hasattr(turnstile_service, 'verify_token')
