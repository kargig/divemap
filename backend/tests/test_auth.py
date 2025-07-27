import pytest
from fastapi import status
from app.models import User

class TestAuth:
    """Test authentication endpoints."""
    
    def test_register_success(self, client):
        """Test successful user registration with enabled=False by default."""
        response = client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "Password123!"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "message" in data
        assert "pending admin approval" in data["message"]
    
    def test_register_duplicate_username(self, client, test_user):
        """Test registration with duplicate username."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",  # Already exists
            "email": "different@example.com",
            "password": "Password123!"
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username or email already registered" in response.json()["detail"]
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registration with duplicate email."""
        response = client.post("/api/v1/auth/register", json={
            "username": "differentuser",
            "email": "test@example.com",  # Already exists
            "password": "Password123!"
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username or email already registered" in response.json()["detail"]
    
    def test_register_invalid_data(self, client):
        """Test registration with invalid data."""
        # Missing required fields
        response = client.post("/api/v1/auth/register", json={
            "username": "newuser"
            # Missing email and password
        })
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_register_short_password(self, client):
        """Test registration with short password."""
        response = client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "123"  # Too short
        })
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_google_oauth_endpoint(self, client):
        """Test Google OAuth endpoint (stub implementation)."""
        response = client.post("/api/v1/auth/google-login", json={})
        
        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
        assert "Google OAuth login not yet implemented" in response.json()["detail"]
    
    def test_login_success(self, client, test_user):
        """Test successful login."""
        response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "password"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_disabled_user(self, client, db_session):
        """Test login with disabled user."""
        # Create a disabled user
        from app.auth import get_password_hash
        disabled_user = User(
            username="disableduser",
            email="disabled@example.com",
            password_hash=get_password_hash("password"),
            enabled=False
        )
        db_session.add(disabled_user)
        db_session.commit()
        
        response = client.post("/api/v1/auth/login", json={
            "username": "disableduser",
            "password": "password"
        })
        
        assert response.status_code == status.HTTP_200_OK  # Login succeeds
        # But accessing protected endpoints should fail
        token = response.json()["access_token"]
        me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_response.status_code == status.HTTP_403_FORBIDDEN
        assert "User account is disabled" in me_response.json()["detail"]
    
    def test_login_invalid_username(self, client):
        """Test login with invalid username."""
        response = client.post("/api/v1/auth/login", json={
            "username": "nonexistent",
            "password": "password"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect username or password" in response.json()["detail"]
    
    def test_login_invalid_password(self, client, test_user):
        """Test login with invalid password."""
        response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "wrongpassword"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect username or password" in response.json()["detail"]
    
    def test_login_missing_data(self, client):
        """Test login with missing data."""
        response = client.post("/api/v1/auth/login", json={
            "username": "testuser"
            # Missing password
        })
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_get_current_user_success(self, client, auth_headers, test_user):
        """Test getting current user with valid token."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["is_admin"] == test_user.is_admin
        assert "enabled" in data  # New field should be present
    
    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token."""
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token"})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_current_user_no_token(self, client):
        """Test getting current user without token."""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN 