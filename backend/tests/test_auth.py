import pytest
from fastapi import status
from app.models import User

class TestAuth:
    """Test authentication endpoints."""
    
    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "password123"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["username"] == "newuser"
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["is_admin"] is False
    
    def test_register_duplicate_username(self, client, test_user):
        """Test registration with duplicate username."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",  # Already exists
            "email": "different@example.com",
            "password": "password123"
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "username already registered" in response.json()["detail"]
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registration with duplicate email."""
        response = client.post("/api/v1/auth/register", json={
            "username": "differentuser",
            "email": "test@example.com",  # Already exists
            "password": "password123"
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email already registered" in response.json()["detail"]
    
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
        assert "user" in data
        assert data["user"]["username"] == "testuser"
        assert data["user"]["email"] == "test@example.com"
    
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
    
    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token."""
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token"})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_current_user_no_token(self, client):
        """Test getting current user without token."""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_current_user_expired_token(self, client, test_user):
        """Test getting current user with expired token."""
        # Create a token that expires immediately
        from app.auth import create_access_token
        expired_token = create_access_token(data={"sub": test_user.username}, expires_delta=0)
        
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED 