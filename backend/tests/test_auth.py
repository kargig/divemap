import pytest
from fastapi import status
from app.models import User
from unittest.mock import patch, MagicMock

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
        """Test Google OAuth endpoint."""
        # Test with missing token (should return 422 validation error)
        response = client.post("/api/v1/auth/google-login", json={})

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Test with invalid token (should return 401)
        response = client.post("/api/v1/auth/google-login", json={"token": "invalid_token"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # @patch('app.google_auth.verify_google_token')
    # @patch('app.google_auth.get_or_create_google_user')
    # def test_google_login_new_user_automatically_enabled(self, mock_get_or_create_user, mock_verify_token, client, db_session):
    #     """Test that new Google users are automatically enabled."""
    #     # Mock Google token verification
    #     mock_verify_token.return_value = {
    #         'sub': 'google_user_123',
    #         'email': 'googleuser@example.com',
    #         'name': 'Google User',
    #         'picture': 'https://example.com/avatar.jpg'
    #     }
    
    #     # Mock user creation - this should return a user with enabled=True
    #     mock_user = User(
    #         username="googleuser",
    #         email="googleuser@example.com",
    #         google_id="google_user_123",
    #         name="Google User",
    #         avatar_url="https://example.com/avatar.jpg",
    #         enabled=True,  # Google users should be enabled by default
    #         is_admin=False,
    #         is_moderator=False
    #     )
    #     mock_get_or_create_user.return_value = mock_user
    
    #     # Test Google login
    #     response = client.post("/api/v1/auth/google-login", json={
    #         "token": "valid_google_token"
    #     })
    
    #     assert response.status_code == status.HTTP_200_OK
    #     data = response.json()
    #     assert "access_token" in data
    #     assert data["token_type"] == "bearer"
    
    #     # Verify that the user was created with enabled=True
    #     mock_get_or_create_user.assert_called_once()
    #     created_user = mock_get_or_create_user.call_args[0][1]  # Second argument is google_user_info
    #     assert created_user['email'] == 'googleuser@example.com'

    # @patch('app.google_auth.verify_google_token')
    # @patch('app.google_auth.get_or_create_google_user')
    # def test_google_login_existing_user_remains_enabled(self, mock_get_or_create_user, mock_verify_token, client, db_session):
    #     """Test that existing Google users remain enabled."""
    #     # Mock Google token verification
    #     mock_verify_token.return_value = {
    #         'sub': 'google_user_123',
    #         'email': 'existing@example.com',
    #         'name': 'Existing User',
    #         'picture': 'https://example.com/avatar.jpg'
    #     }
    
    #     # Mock existing user - should remain enabled
    #     existing_user = User(
    #         username="existinguser",
    #         email="existing@example.com",
    #         google_id="google_user_123",
    #         name="Existing User",
    #         avatar_url="https://example.com/avatar.jpg",
    #         enabled=True,  # Should remain enabled
    #         is_admin=False,
    #         is_moderator=False
    #     )
    #     mock_get_or_create_user.return_value = existing_user
    
    #     # Test Google login
    #     response = client.post("/api/v1/auth/google-login", json={
    #         "token": "valid_google_token"
    #     })
    
    #     assert response.status_code == status.HTTP_200_OK
    #     data = response.json()
    #     assert "access_token" in data
    #     assert data["token_type"] == "bearer"

    def test_regular_registration_creates_disabled_user(self, client, db_session):
        """Test that regular registration creates a user with enabled=False."""
        response = client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "Password123!"
        })

        assert response.status_code == status.HTTP_200_OK
        
        # Verify the user was created in the database with enabled=False
        user = db_session.query(User).filter(User.username == "newuser").first()
        assert user is not None
        assert user.enabled is False  # Regular users should be disabled by default
        assert user.google_id is None  # Should not have Google ID

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
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer invalid_token"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_no_token(self, client):
        """Test getting current user without token."""
        response = client.get("/api/v1/auth/me")

        assert response.status_code == status.HTTP_403_FORBIDDEN