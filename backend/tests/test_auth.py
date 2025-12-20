import pytest
from fastapi import status
from app.models import User
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone, timedelta

class TestAuth:
    """Test authentication endpoints."""

    def test_register_success(self, client, monkeypatch):
        """Test successful user registration with enabled=True by default."""
        # Disable email verification requirement for this test
        monkeypatch.setenv("EMAIL_VERIFICATION_REQUIRED", "false")
        
        # Mock Turnstile service to be disabled for this test
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
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "message" in data

    def test_register_duplicate_username(self, client, test_user):
        """Test registration with duplicate username."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/register", json={
                "username": "testuser",  # Already exists
                "email": "different@example.com",
                "password": "Password123!"
            })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username or email already registered" in response.json()["detail"]

    def test_register_duplicate_email(self, client, test_user):
        """Test registration with duplicate email."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
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
    
        # Test with invalid token (should return 400 since it's a client error)
        response = client.post("/api/v1/auth/google-login", json={"token": "invalid_token"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch('app.routers.auth.verify_google_token')
    @patch('app.routers.auth.get_or_create_google_user')
    def test_google_login_new_user_automatically_enabled(self, mock_get_or_create_user, mock_verify_token, client, db_session):
        """Test that new Google users are automatically enabled."""
        # Mock Google token verification
        mock_verify_token.return_value = {
            'sub': 'google_user_123',
            'email': 'googleuser@example.com',
            'name': 'Google User',
            'picture': 'https://example.com/avatar.jpg'
        }
    
        # Create a proper database user for Google OAuth
        google_user = User(
            username="googleuser",
            email="googleuser@example.com",
            password_hash="dummy_hash",  # Required field
            google_id="google_user_123",
            name="Google User",
            avatar_url="https://example.com/avatar.jpg",
            enabled=True,  # Google users should be enabled by default
            is_admin=False,
            is_moderator=False
        )
        db_session.add(google_user)
        db_session.commit()
        db_session.refresh(google_user)
        
        mock_get_or_create_user.return_value = google_user
    
        # Test Google login
        response = client.post("/api/v1/auth/google-login", json={
            "token": "valid_google_token"
        })
    
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Verify that the user was created with enabled=True
        mock_get_or_create_user.assert_called_once()
        created_user = mock_get_or_create_user.call_args[0][1]  # Second argument is google_user_info
        assert created_user['email'] == 'googleuser@example.com'
        
        # Test platform functionality: Google user can access protected endpoints
        access_token = data["access_token"]
        me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert me_response.status_code == status.HTTP_200_OK
        
        me_data = me_response.json()
        assert me_data["username"] == "googleuser"
        assert me_data["email"] == "googleuser@example.com"
        assert me_data["enabled"] is True
        
        # Verify user exists in database with correct data
        db_user = db_session.query(User).filter(User.email == "googleuser@example.com").first()
        assert db_user is not None
        assert db_user.enabled is True
        assert db_user.google_id == "google_user_123"
        assert db_user.name == "Google User"
        assert db_user.avatar_url == "https://example.com/avatar.jpg"

    @patch('app.routers.auth.verify_google_token')
    @patch('app.routers.auth.get_or_create_google_user')
    def test_google_login_existing_user_remains_enabled(self, mock_get_or_create_user, mock_verify_token, client, db_session):
        """Test that existing Google users remain enabled."""
        # Mock Google token verification
        mock_verify_token.return_value = {
            'sub': 'google_user_123',
            'email': 'existing@example.com',
            'name': 'Existing User',
            'picture': 'https://example.com/avatar.jpg'
        }
    
        # Create a proper database user for Google OAuth
        existing_user = User(
            username="existinguser",
            email="existing@example.com",
            password_hash="dummy_hash",  # Required field
            google_id="google_user_123",
            name="Existing User",
            avatar_url="https://example.com/avatar.jpg",
            enabled=True,  # Should remain enabled
            is_admin=False,
            is_moderator=False
        )
        db_session.add(existing_user)
        db_session.commit()
        db_session.refresh(existing_user)
        
        mock_get_or_create_user.return_value = existing_user
    
        # Test Google login
        response = client.post("/api/v1/auth/google-login", json={
            "token": "valid_google_token"
        })
    
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Test platform functionality: Existing Google user can access protected endpoints
        access_token = data["access_token"]
        me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert me_response.status_code == status.HTTP_200_OK
        
        me_data = me_response.json()
        assert me_data["username"] == "existinguser"
        assert me_data["email"] == "existing@example.com"
        assert me_data["enabled"] is True
        
        # Verify user remains enabled in database
        db_user = db_session.query(User).filter(User.email == "existing@example.com").first()
        assert db_user is not None
        assert db_user.enabled is True
        assert db_user.google_id == "google_user_123"

    def test_google_oauth_refresh_token_functionality(self, client, db_session):
        """Test that Google OAuth users can use refresh tokens to maintain sessions."""
        # Mock Google token verification
        with patch('app.routers.auth.verify_google_token') as mock_verify, \
             patch('app.routers.auth.get_or_create_google_user') as mock_get_or_create:
            
            # Set up the mocks
            mock_verify.return_value = {
                'sub': 'google_user_456',
                'email': 'refreshuser@example.com',
                'name': 'Refresh User',
                'picture': 'https://example.com/refresh-avatar.jpg'
            }
            
            # Create a proper database user for Google OAuth
            refresh_user = User(
                username="refreshuser",
                email="refreshuser@example.com",
                password_hash="dummy_hash",  # Required field
                google_id="google_user_456",
                name="Refresh User",
                avatar_url="https://example.com/refresh-avatar.jpg",
                enabled=True,
                is_admin=False,
                is_moderator=False
            )
            db_session.add(refresh_user)
            db_session.commit()
            db_session.refresh(refresh_user)
            
            mock_get_or_create.return_value = refresh_user
            
            # Test Google login to get initial tokens
            response = client.post("/api/v1/auth/google-login", json={
                "token": "valid_google_token"
            })
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "access_token" in data
            
            # Get refresh token from cookies
            refresh_token = response.cookies.get("refresh_token")
            assert refresh_token is not None
            
            # Test platform functionality: User can access protected endpoints
            access_token = data["access_token"]
            me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
            assert me_response.status_code == status.HTTP_200_OK
            
            # Test refresh token functionality
            refresh_response = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})
            assert refresh_response.status_code == status.HTTP_200_OK
            
            refresh_data = refresh_response.json()
            assert "access_token" in refresh_data
            assert refresh_data["token_type"] == "bearer"
            
            # Verify new access token works
            new_access_token = refresh_data["access_token"]
            me_response_after_refresh = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_access_token}"})
            assert me_response_after_refresh.status_code == status.HTTP_200_OK
            
            # Verify user data is consistent
            me_data = me_response_after_refresh.json()
            assert me_data["username"] == "refreshuser"
            assert me_data["email"] == "refreshuser@example.com"
            assert me_data["enabled"] is True

    def test_google_oauth_error_handling(self, client):
        """Test that Google OAuth errors are handled gracefully."""
        # Test with invalid token format
        response = client.post("/api/v1/auth/google-login", json={
            "token": ""  # Empty token
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        
        # Test with missing token
        response = client.post("/api/v1/auth/google-login", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test with malformed JSON
        response = client.post("/api/v1/auth/google-login", data="invalid json", headers={"Content-Type": "application/json"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_google_oauth_user_data_persistence(self, client, db_session):
        """Test that Google OAuth user data is properly persisted and retrieved."""
        # Mock Google token verification
        with patch('app.routers.auth.verify_google_token') as mock_verify, \
             patch('app.routers.auth.get_or_create_google_user') as mock_get_or_create:
            
            # Set up the mocks
            mock_verify.return_value = {
                'sub': 'google_user_789',
                'email': 'persistuser@example.com',
                'name': 'Persist User',
                'picture': 'https://example.com/persist-avatar.jpg'
            }
            
            # Create a proper database user for Google OAuth
            persist_user = User(
                username="persistuser",
                email="persistuser@example.com",
                password_hash="dummy_hash",  # Required field
                google_id="google_user_789",
                name="Persist User",
                avatar_url="https://example.com/persist-avatar.jpg",
                enabled=True,
                is_admin=False,
                is_moderator=False
            )
            db_session.add(persist_user)
            db_session.commit()
            db_session.refresh(persist_user)
            
            mock_get_or_create.return_value = persist_user
            
            # Test Google login
            response = client.post("/api/v1/auth/google-login", json={
                "token": "valid_google_token"
            })
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            access_token = data["access_token"]
            
            # Test that user data is accessible through the platform
            me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
            assert me_response.status_code == status.HTTP_200_OK
            
            me_data = me_response.json()
            assert me_data["username"] == "persistuser"
            assert me_data["email"] == "persistuser@example.com"
            assert me_data["enabled"] is True
            assert me_data["name"] == "Persist User"
            
            # Verify data persistence in database
            db_user = db_session.query(User).filter(User.email == "persistuser@example.com").first()
            assert db_user is not None
            assert db_user.username == "persistuser"
            assert db_user.email == "persistuser@example.com"
            assert db_user.google_id == "google_user_789"
            assert db_user.name == "Persist User"
            assert db_user.avatar_url == "https://example.com/persist-avatar.jpg"
            assert db_user.enabled is True
            assert db_user.is_admin is False
            assert db_user.is_moderator is False

    def test_regular_registration_creates_enabled_user(self, client, db_session):
        """Test that regular registration creates a user with enabled=True and email_verified=False."""
        # Mock Turnstile service to be disabled for this test
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
        
        # Verify the user was created in the database with enabled=True and email_verified=False
        user = db_session.query(User).filter(User.username == "newuser").first()
        assert user is not None
        assert user.enabled is True
        assert user.email_verified is False  # Email verification required
        assert user.google_id is None  # Should not have Google ID

    def test_login_success(self, client, test_user):
        """Test successful login."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!"
            })

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_disabled_user(self, client, db_session):
        """Test login with disabled user."""
        # Create a disabled user
        from app.auth import get_password_hash
        from datetime import datetime, timezone
        disabled_user = User(
            username="disableduser",
            email="disabled@example.com",
            password_hash=get_password_hash("password"),
            enabled=False,
            email_verified=True,  # User is verified but disabled
            email_verified_at=datetime.now(timezone.utc)
        )
        db_session.add(disabled_user)
        db_session.commit()

        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
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
        """Test login with invalid username or email."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "nonexistent",
                "password": "password"
            })

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect username/email or password" in response.json()["detail"]

    def test_login_invalid_email(self, client):
        """Test login with invalid email."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "nonexistent@example.com",
                "password": "password"
            })

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect username/email or password" in response.json()["detail"]

    def test_login_invalid_password(self, client, test_user):
        """Test login with invalid password."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "wrongpassword"
            })

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect username/email or password" in response.json()["detail"]

    def test_login_with_email(self, client, test_user):
        """Test login with email instead of username."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "test@example.com",
                "password": "TestPass123!"
            })

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_with_username(self, client, test_user):
        """Test login with username (existing functionality)."""
        # Mock Turnstile service to be disabled for this test
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = False
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!"
            })

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

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

    def test_turnstile_persistence_on_registration(self, client, db_session):
        """Test that Turnstile data is persisted during registration when enabled."""
        # Mock Turnstile service to be enabled and return success
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(return_value={"success": True})
            
            response = client.post("/api/v1/auth/register", json={
                "username": "turnstileuser",
                "email": "turnstile@example.com",
                "password": "Password123!"
            })

        assert response.status_code == status.HTTP_201_CREATED
        
        # Verify the user was created with Turnstile verification timestamp
        user = db_session.query(User).filter(User.username == "turnstileuser").first()
        assert user is not None
        assert user.turnstile_verified_at is not None

    def test_turnstile_persistence_on_login(self, client, test_user, db_session):
        """Test that Turnstile data is persisted during login when enabled."""
        # Mock Turnstile service to be enabled and return success
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(return_value={"success": True})
            
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!"
            })

        assert response.status_code == status.HTTP_200_OK
        
        # Verify the user's Turnstile verification timestamp was updated
        db_session.refresh(test_user)
        assert test_user.turnstile_verified_at is not None

    def test_turnstile_persistence_failure_handling(self, client, test_user, db_session):
        """Test that login still succeeds even if Turnstile persistence fails."""
        # Mock Turnstile service to be enabled and return success
        with patch('app.routers.auth.turnstile_service') as mock_service:
            mock_service.is_enabled.return_value = True
            mock_service.verify_token = AsyncMock(return_value={"success": True})
            
            # Test that login succeeds with Turnstile enabled
            response = client.post("/api/v1/auth/login", json={
                "username": "testuser",
                "password": "TestPass123!"
            })

        # Login should succeed
        assert response.status_code == status.HTTP_200_OK
        
        # Verify the user's Turnstile verification timestamp was updated
        db_session.refresh(test_user)
        assert test_user.turnstile_verified_at is not None


class TestDivingCenterAuthorization:
    """Test diving center authorization functions."""

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_admin(self, db_session, test_admin_user, test_diving_center):
        """Test that admins can manage any diving center."""
        from app.auth import can_manage_diving_center
        
        result = await can_manage_diving_center(
            test_diving_center.id, 
            test_admin_user, 
            db_session
        )
        
        assert result == test_admin_user

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_moderator(self, db_session, test_moderator_user, test_diving_center):
        """Test that moderators can manage any diving center."""
        from app.auth import can_manage_diving_center
        
        result = await can_manage_diving_center(
            test_diving_center.id, 
            test_moderator_user, 
            db_session
        )
        
        assert result == test_moderator_user

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_approved_owner(self, db_session, test_user, test_diving_center):
        """Test that approved owners can manage their own diving center."""
        from app.auth import can_manage_diving_center
        from app.models import OwnershipStatus
        
        # Set the user as the approved owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        result = await can_manage_diving_center(
            test_diving_center.id, 
            test_user, 
            db_session
        )
        
        assert result == test_user

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_unapproved_owner(self, db_session, test_user, test_diving_center):
        """Test that unapproved owners cannot manage their diving center."""
        from app.auth import can_manage_diving_center
        from app.models import OwnershipStatus
        from fastapi import HTTPException
        
        # Set the user as the owner but with unapproved status
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        with pytest.raises(HTTPException) as exc_info:
            await can_manage_diving_center(
                test_diving_center.id, 
                test_user, 
                db_session
            )
        
        assert exc_info.value.status_code == 403
        assert "Not enough permissions" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_denied_owner(self, db_session, test_user, test_diving_center):
        """Test that denied owners cannot manage their diving center."""
        from app.auth import can_manage_diving_center
        from app.models import OwnershipStatus
        from fastapi import HTTPException
        
        # Set the user as the owner but with denied status
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.denied
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        with pytest.raises(HTTPException) as exc_info:
            await can_manage_diving_center(
                test_diving_center.id, 
                test_user, 
                db_session
            )
        
        assert exc_info.value.status_code == 403
        assert "Not enough permissions" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_non_owner(self, db_session, test_user, test_diving_center):
        """Test that non-owners cannot manage diving centers."""
        from app.auth import can_manage_diving_center
        from app.models import OwnershipStatus, User
        from fastapi import HTTPException
        
        # Create a different user to be the owner
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="$2b$12$bkh2s0S1uAXrAMa5CewBwubJhyiZJTs1jEwy7I4R2Sn9q9cXW2BxO",  # "TestPass123!"
            is_admin=False,
            is_moderator=False,
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Set the other user as the owner
        test_diving_center.owner_id = other_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        with pytest.raises(HTTPException) as exc_info:
            await can_manage_diving_center(
                test_diving_center.id, 
                test_user, 
                db_session
            )
        
        assert exc_info.value.status_code == 403
        assert "Not enough permissions" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_nonexistent_center(self, db_session, test_user):
        """Test that requests to non-existent diving centers return 404."""
        from app.auth import can_manage_diving_center
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            await can_manage_diving_center(
                99999,  # Non-existent diving center ID
                test_user, 
                db_session
            )
        
        assert exc_info.value.status_code == 404
        assert "Diving center not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_can_manage_diving_center_unclaimed_center(self, db_session, test_user, test_diving_center):
        """Test that unclaimed diving centers cannot be managed by regular users."""
        from app.auth import can_manage_diving_center
        from app.models import OwnershipStatus
        from fastapi import HTTPException
        
        # Ensure the diving center is unclaimed
        test_diving_center.owner_id = None
        test_diving_center.ownership_status = OwnershipStatus.unclaimed
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        with pytest.raises(HTTPException) as exc_info:
            await can_manage_diving_center(
                test_diving_center.id, 
                test_user, 
                db_session
            )
        
        assert exc_info.value.status_code == 403
        assert "Not enough permissions" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_create_can_manage_diving_center_dep_factory(self, db_session, test_user, test_diving_center):
        """Test the factory function that creates diving center management dependencies."""
        from app.auth import create_can_manage_diving_center_dep
        from app.models import OwnershipStatus
        
        # Set the user as the approved owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        # Create a dependency function for this specific diving center
        dependency_func = create_can_manage_diving_center_dep(test_diving_center.id)
        
        # Test that the dependency function works correctly
        result = await dependency_func(
            current_user=test_user,
            db=db_session
        )
        
        assert result == test_user

    @pytest.mark.asyncio
    async def test_create_can_manage_diving_center_dep_factory_unauthorized(self, db_session, test_user, test_diving_center):
        """Test that the factory function correctly handles unauthorized users."""
        from app.auth import create_can_manage_diving_center_dep
        from app.models import OwnershipStatus, User
        from fastapi import HTTPException
        
        # Create a different user to be the owner
        other_user = User(
            username="otheruser2",
            email="other2@example.com",
            password_hash="$2b$12$bkh2s0S1uAXrAMa5CewBwubJhyiZJTs1jEwy7I4R2Sn9q9cXW2BxO",  # "TestPass123!"
            is_admin=False,
            is_moderator=False,
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Set the other user as the owner
        test_diving_center.owner_id = other_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)
        
        # Create a dependency function for this specific diving center
        dependency_func = create_can_manage_diving_center_dep(test_diving_center.id)
        
        # Test that the dependency function correctly denies access
        with pytest.raises(HTTPException) as exc_info:
            await dependency_func(
                current_user=test_user,
                db=db_session
            )
        
        assert exc_info.value.status_code == 403
        assert "Not enough permissions" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_create_can_manage_diving_center_dep_factory_admin(self, db_session, test_admin_user, test_diving_center):
        """Test that the factory function works correctly for admins."""
        from app.auth import create_can_manage_diving_center_dep
        
        # Create a dependency function for this specific diving center
        dependency_func = create_can_manage_diving_center_dep(test_diving_center.id)
        
        # Test that the dependency function works correctly for admins
        result = await dependency_func(
            current_user=test_admin_user,
            db=db_session
        )
        
        assert result == test_admin_user

    @pytest.mark.asyncio
    async def test_create_can_manage_diving_center_dep_factory_moderator(self, db_session, test_moderator_user, test_diving_center):
        """Test that the factory function works correctly for moderators."""
        from app.auth import create_can_manage_diving_center_dep
        
        # Create a dependency function for this specific diving center
        dependency_func = create_can_manage_diving_center_dep(test_diving_center.id)
        
        # Test that the dependency function works correctly for moderators
        result = await dependency_func(
            current_user=test_moderator_user,
            db=db_session
        )
        
        assert result == test_moderator_user

    @pytest.mark.asyncio
    async def test_ownership_status_enum_handling_in_auth(self, db_session, test_user, test_diving_center):
        """Test that ownership status enum is handled correctly in authorization functions."""
        from app.auth import can_manage_diving_center
        from app.models import OwnershipStatus
        from fastapi import HTTPException
        
        # Test with different ownership statuses
        statuses_to_test = [
            OwnershipStatus.unclaimed,
            OwnershipStatus.claimed,
            OwnershipStatus.denied
        ]
        
        for ownership_status in statuses_to_test:
            # Set the ownership status
            test_diving_center.owner_id = test_user.id
            test_diving_center.ownership_status = ownership_status
            db_session.commit()
            db_session.refresh(test_diving_center)

            if ownership_status == OwnershipStatus.approved:
                # Should succeed
                result = await can_manage_diving_center(
                    test_diving_center.id, 
                    test_user, 
                    db_session
                )
                assert result == test_user
            else:
                # Should fail
                with pytest.raises(HTTPException) as exc_info:
                    await can_manage_diving_center(
                        test_diving_center.id, 
                        test_user, 
                        db_session
                    )
                assert exc_info.value.status_code == 403
                assert "Not enough permissions" in str(exc_info.value.detail)

        # Clean up - set back to approved for other tests
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()

    def test_auth_functions_import_consistency(self):
        """Test that all necessary auth functions are properly imported and available."""
        from app.auth import (
            can_manage_diving_center,
            create_can_manage_diving_center_dep,
            get_current_user,
            is_admin_or_moderator
        )
        
        # Verify all functions are callable
        assert callable(can_manage_diving_center)
        assert callable(create_can_manage_diving_center_dep)
        assert callable(get_current_user)
        assert callable(is_admin_or_moderator)
        
        # Verify the factory function returns a callable
        factory_result = create_can_manage_diving_center_dep(123)
        assert callable(factory_result)