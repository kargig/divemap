import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient

from app.models import RefreshToken, AuthAuditLog
from app.token_service import token_service


class TestTokenService:
    """Test the TokenService class functionality"""

    def test_token_service_initialization(self):
        """Test that TokenService initializes with correct configuration"""
        assert token_service.secret_key is not None
        assert token_service.algorithm == "HS256"
        assert token_service.access_token_expire == timedelta(minutes=15)
        assert token_service.refresh_token_expire == timedelta(days=30)
        assert token_service.enable_token_rotation is True
        assert token_service.enable_audit_logging is True
        assert token_service.max_active_sessions == 5

    def test_create_access_token(self):
        """Test access token creation"""
        data = {"sub": "testuser"}
        token = token_service.create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        
        # Verify token structure
        import jwt
        decoded = jwt.decode(token, token_service.secret_key, algorithms=[token_service.algorithm])
        assert decoded["sub"] == "testuser"
        assert decoded["type"] == "access"
        assert "exp" in decoded
        assert "iat" in decoded

    def test_create_refresh_token(self, test_user, mock_request, db_session):
        """Test refresh token creation"""
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        assert refresh_token is not None
        assert isinstance(refresh_token, str)
        
        # Verify token format: username:token_id:timestamp
        parts = refresh_token.split(":")
        assert len(parts) == 3
        assert parts[0] == test_user.username
        
        # Verify token stored in database
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == parts[1]).first()
        assert db_token is not None
        assert db_token.user_id == test_user.id
        assert db_token.is_revoked is False
        assert db_token.device_info == "Test Browser/1.0"
        assert db_token.ip_address == "127.0.0.1"

    def test_create_token_pair(self, test_user, mock_request, db_session):
        """Test creating both access and refresh tokens"""
        token_data = token_service.create_token_pair(test_user, mock_request, db_session)
        
        assert "access_token" in token_data
        assert "refresh_token" in token_data
        assert "token_type" in token_data
        assert "expires_in" in token_data
        
        assert token_data["token_type"] == "bearer"
        assert token_data["expires_in"] == 900  # 15 minutes in seconds
        
        # Verify both tokens are valid
        access_token = token_data["access_token"]
        refresh_token = token_data["refresh_token"]
        
        assert access_token is not None
        assert refresh_token is not None

    def test_refresh_access_token_success(self, test_user, mock_request, db_session):
        """Test successful access token refresh"""
        # Create a refresh token first
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Refresh the access token
        new_access_token = token_service.refresh_access_token(refresh_token, mock_request, db_session)
        
        assert new_access_token is not None
        assert isinstance(new_access_token, str)
        
        # Verify the new token is valid
        import jwt
        decoded = jwt.decode(new_access_token, token_service.secret_key, algorithms=[token_service.algorithm])
        assert decoded["sub"] == test_user.username
        assert decoded["type"] == "access"

    def test_refresh_access_token_invalid_format(self, mock_request, db_session):
        """Test refresh token with invalid format"""
        invalid_token = "invalid_token_format"
        result = token_service.refresh_access_token(invalid_token, mock_request, db_session)
        
        assert result is None

    def test_refresh_access_token_expired(self, test_user, mock_request, db_session):
        """Test refresh token that's too old (replay attack protection)"""
        # Create a token with old timestamp
        old_timestamp = datetime.utcnow().timestamp() - 700000  # More than 1 week ago (8+ days)
        token_id = "test_id_123"
        old_refresh_token = f"{test_user.username}:{token_id}:{old_timestamp}"
        
        # Manually create the database entry
        db_token = RefreshToken(
            id=token_id,
            user_id=test_user.id,
            token_hash="dummy_hash",
            expires_at=datetime.utcnow() + timedelta(days=30),
            device_info="Test Browser/1.0",
            ip_address="127.0.0.1"
        )
        db_session.add(db_token)
        db_session.commit()
        
        # Try to refresh with old token
        result = token_service.refresh_access_token(old_refresh_token, mock_request, db_session)
        
        assert result is None

    def test_refresh_access_token_revoked(self, test_user, mock_request, db_session):
        """Test refresh token that has been revoked"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        parts = refresh_token.split(":")
        token_id = parts[1]
        
        # Revoke the token
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        db_token.is_revoked = True
        db_session.commit()
        
        # Try to refresh with revoked token
        result = token_service.refresh_access_token(refresh_token, mock_request, db_session)
        
        assert result is None

    def test_refresh_access_token_expired_in_db(self, test_user, mock_request, db_session):
        """Test refresh token that has expired in database"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        parts = refresh_token.split(":")
        token_id = parts[1]
        
        # Set the token as expired
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        db_token.expires_at = datetime.utcnow() - timedelta(hours=1)
        db_session.commit()
        
        # Try to refresh with expired token
        result = token_service.refresh_access_token(refresh_token, mock_request, db_session)
        
        assert result is None

    def test_token_rotation(self, test_user, mock_request, db_session):
        """Test refresh token rotation for security"""
        # Create initial token pair
        old_refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Rotate the token
        new_tokens = token_service.rotate_refresh_token(old_refresh_token, mock_request, db_session)
        
        assert new_tokens is not None
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert "token_type" in new_tokens
        assert "expires_in" in new_tokens
        
        # Verify old token is revoked
        old_parts = old_refresh_token.split(":")
        old_token_id = old_parts[1]
        old_db_token = db_session.query(RefreshToken).filter(RefreshToken.id == old_token_id).first()
        assert old_db_token.is_revoked is True
        
        # Verify new refresh token is different
        assert new_tokens["refresh_token"] != old_refresh_token

    def test_revoke_refresh_token(self, test_user, mock_request, db_session):
        """Test revoking a specific refresh token"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Revoke the token
        result = token_service.revoke_refresh_token(refresh_token, db_session)
        
        assert result is True
        
        # Verify token is revoked in database
        parts = refresh_token.split(":")
        token_id = parts[1]
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        assert db_token.is_revoked is True

    def test_revoke_all_user_tokens(self, test_user, mock_request, db_session):
        """Test revoking all tokens for a user"""
        # Create multiple refresh tokens
        token1 = token_service.create_refresh_token(test_user, mock_request, db_session)
        token2 = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Revoke all tokens
        result = token_service.revoke_all_user_tokens(test_user.id, db_session)
        
        assert result is True
        
        # Verify all tokens are revoked
        tokens = db_session.query(RefreshToken).filter(RefreshToken.user_id == test_user.id).all()
        for token in tokens:
            assert token.is_revoked is True

    def test_session_limit_enforcement(self, test_user, mock_request, db_session):
        """Test that users can't exceed maximum active sessions"""
        # Create maximum allowed sessions
        for i in range(6):  # More than max_active_sessions (5)
            token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Verify only max_active_sessions tokens are active
        active_tokens = db_session.query(RefreshToken).filter(
            RefreshToken.user_id == test_user.id,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.utcnow()
        ).count()
        
        assert active_tokens <= token_service.max_active_sessions

    def test_cleanup_expired_tokens(self, test_user, mock_request, db_session):
        """Test cleanup of expired tokens"""
        # Create a token that's already expired
        expired_token = RefreshToken(
            id="expired_token",
            user_id=test_user.id,
            token_hash="dummy_hash",
            expires_at=datetime.utcnow() - timedelta(hours=1),
            device_info="Test Browser/1.0",
            ip_address="127.0.0.1"
        )
        db_session.add(expired_token)
        db_session.commit()
        
        # Verify expired token exists
        assert db_session.query(RefreshToken).filter(RefreshToken.id == "expired_token").first() is not None
        
        # Trigger cleanup
        token_service._cleanup_expired_tokens(test_user.id, db_session)
        
        # Verify expired token is removed
        assert db_session.query(RefreshToken).filter(RefreshToken.id == "expired_token").first() is None

    def test_audit_logging(self, test_user, mock_request, db_session):
        """Test audit logging functionality"""
        # Enable audit logging
        original_setting = token_service.enable_audit_logging
        token_service.enable_audit_logging = True
        
        try:
            # Create a token to trigger logging
            token_service.create_token_pair(test_user, mock_request, db_session)
            
            # Verify audit log entry was created
            audit_log = db_session.query(AuthAuditLog).filter(
                AuthAuditLog.user_id == test_user.id,
                AuthAuditLog.action == "token_created"
            ).first()
            
            assert audit_log is not None
            assert audit_log.success is True
            assert audit_log.ip_address == "127.0.0.1"
            assert audit_log.user_agent == "Test Browser/1.0"
            assert "Created token pair for user testuser" in audit_log.details
            
        finally:
            # Restore original setting
            token_service.enable_audit_logging = original_setting


class TestAuthEndpoints:
    """Test the authentication API endpoints"""

    def test_login_with_refresh_token(self, client, test_user):
        """Test login endpoint returns access token and sets refresh token as cookie"""
        response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that access token is returned in JSON response
        assert "access_token" in data
        assert "token_type" in data
        assert "expires_in" in data
        
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 900  # 15 minutes
        
        # Check that refresh token is set as HTTP-only cookie
        assert "refresh_token" in response.cookies
        # The cookie value should be present
        assert response.cookies["refresh_token"] is not None

    def test_register_with_refresh_token(self, client):
        """Test registration endpoint returns access token and sets refresh token as cookie"""
        response = client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "NewPass123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that access token is returned in JSON response
        assert "access_token" in data
        assert "token_type" in data
        assert "expires_in" in data
        assert "message" in data
        
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 900
        
        # Check that refresh token is set as cookie
        assert "refresh_token" in response.cookies
        assert response.cookies["refresh_token"] is not None

    @pytest.mark.skip(reason="Google OAuth test requires proper environment setup")
    def test_google_login_with_refresh_token(self, client, test_user):
        """Test Google login endpoint returns access token and sets refresh token as cookie"""
        # Mock the Google authentication
        with patch('app.google_auth.authenticate_google_user') as mock_auth:
            mock_auth.return_value = test_user
            
            response = client.post("/api/v1/auth/google-login", json={
                "token": "google_token_123"
            })
            
            assert response.status_code == 200
            data = response.json()
            
            # Check that access token is returned in JSON response
            assert "access_token" in data
            assert "token_type" in data
            assert "expires_in" in data
            
            # Check that refresh token is set as cookie
            assert "refresh_token" in response.cookies
            assert response.cookies["refresh_token"] is not None

    def test_refresh_token_endpoint_success(self, client, test_user, mock_request, db_session):
        """Test successful token refresh via API"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Set the refresh token as a cookie
        response = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "token_type" in data
        assert "expires_in" in data
        
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 900

    def test_refresh_token_endpoint_missing_token(self, client):
        """Test refresh endpoint without refresh token"""
        response = client.post("/api/v1/auth/refresh")
        
        assert response.status_code == 401
        data = response.json()
        assert "Refresh token not found" in data["detail"]

    def test_refresh_token_endpoint_invalid_token(self, client):
        """Test refresh endpoint with invalid refresh token"""
        response = client.post("/api/v1/auth/refresh", cookies={"refresh_token": "invalid_token"})
        
        assert response.status_code == 401
        data = response.json()
        assert "Token refresh failed" in data["detail"]

    def test_logout_endpoint(self, client, test_user, mock_request, db_session):
        """Test logout endpoint revokes refresh token"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Set the refresh token as a cookie
        response = client.post("/api/v1/auth/logout", cookies={"refresh_token": refresh_token})
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Logged out successfully"
        
        # Verify the refresh token is revoked
        parts = refresh_token.split(":")
        token_id = parts[1]
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        assert db_token.is_revoked is True

    def test_list_active_tokens(self, client, test_user, mock_request, db_session):
        """Test listing user's active tokens"""
        # Create some refresh tokens
        token1 = token_service.create_refresh_token(test_user, mock_request, db_session)
        token2 = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Login to get access token
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        access_token = login_response.json()["access_token"]
        
        # List active tokens
        response = client.get("/api/v1/auth/tokens", headers={
            "Authorization": f"Bearer {access_token}"
        })
        
        assert response.status_code == 200
        tokens = response.json()
        
        assert len(tokens) >= 2  # Should include the ones we created plus login tokens
        
        # Verify token structure
        for token in tokens:
            assert "id" in token
            assert "created_at" in token
            assert "last_used_at" in token
            assert "expires_at" in token
            assert "device_info" in token
            assert "ip_address" in token

    def test_revoke_specific_token(self, client, test_user, mock_request, db_session):
        """Test revoking a specific token"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        parts = refresh_token.split(":")
        token_id = parts[1]
        
        # Login to get access token
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        access_token = login_response.json()["access_token"]
        
        # Revoke the specific token
        response = client.delete(f"/api/v1/auth/tokens/{token_id}", headers={
            "Authorization": f"Bearer {access_token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Token revoked successfully"
        
        # Verify the token is revoked
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        assert db_token.is_revoked is True

    def test_revoke_nonexistent_token(self, client, test_user):
        """Test revoking a token that doesn't exist"""
        # Login to get access token
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        access_token = login_response.json()["access_token"]
        
        # Try to revoke a nonexistent token
        response = client.delete("/api/v1/auth/tokens/nonexistent_id", headers={
            "Authorization": f"Bearer {access_token}"
        })
        
        assert response.status_code == 404
        data = response.json()
        assert "Token not found" in data["detail"]


class TestTokenSecurity:
    """Test security aspects of the token system"""

    def test_token_expiration(self):
        """Test that access tokens expire correctly"""
        data = {"sub": "testuser"}
        token = token_service.create_access_token(data)
        
        # Verify token has expiration
        import jwt
        decoded = jwt.decode(token, token_service.secret_key, algorithms=[token_service.algorithm])
        assert "exp" in decoded
        
        # Calculate expected expiration
        expected_exp = datetime.utcnow() + token_service.access_token_expire
        actual_exp = datetime.fromtimestamp(decoded["exp"])
        
        # Allow 1 second tolerance for test timing
        assert abs((expected_exp - actual_exp).total_seconds()) <= 1

    def test_refresh_token_expiration(self, test_user, mock_request, db_session):
        """Test that refresh tokens have correct expiration"""
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Get the database entry
        parts = refresh_token.split(":")
        token_id = parts[1]
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        
        # Verify expiration is set correctly
        expected_exp = datetime.utcnow() + token_service.refresh_token_expire
        actual_exp = db_token.expires_at
        
        # Allow 1 second tolerance for test timing
        assert abs((expected_exp - actual_exp).total_seconds()) <= 1

    def test_token_rotation_security(self, test_user, mock_request, db_session):
        """Test that token rotation provides security benefits"""
        # Create initial token
        old_refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Rotate the token
        new_tokens = token_service.rotate_refresh_token(old_refresh_token, mock_request, db_session)
        
        # Verify old token is revoked and can't be used
        old_result = token_service.refresh_access_token(old_refresh_token, mock_request, db_session)
        assert old_result is None
        
        # Verify new token works
        new_result = token_service.refresh_access_token(new_tokens["refresh_token"], mock_request, db_session)
        assert new_result is not None

    def test_session_limit_security(self, test_user, mock_request, db_session):
        """Test that session limits provide security benefits"""
        # Create maximum allowed sessions
        tokens = []
        for i in range(token_service.max_active_sessions):
            token = token_service.create_refresh_token(test_user, mock_request, db_session)
            tokens.append(token)
        
        # Try to create one more session
        extra_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Verify we still have max_active_sessions active tokens
        active_count = db_session.query(RefreshToken).filter(
            RefreshToken.user_id == test_user.id,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.utcnow()
        ).count()
        
        assert active_count <= token_service.max_active_sessions

    def test_audit_logging_security(self, test_user, mock_request, db_session):
        """Test that audit logging provides security visibility"""
        # Enable audit logging
        original_setting = token_service.enable_audit_logging
        token_service.enable_audit_logging = True
        
        try:
            # Perform various actions
            token_service.create_token_pair(test_user, mock_request, db_session)
            token_service.refresh_access_token(
                token_service.create_refresh_token(test_user, mock_request, db_session),
                mock_request, db
            )
            
            # Verify audit logs were created
            logs = db_session.query(AuthAuditLog).filter(AuthAuditLog.user_id == test_user.id).all()
            
            # Should have at least token creation and refresh logs
            actions = [log.action for log in logs]
            assert "token_created" in actions
            assert "token_refresh" in actions
            
            # Verify log details
            for log in logs:
                assert log.ip_address == "127.0.0.1"
                assert log.user_agent == "Test Browser/1.0"
                assert log.timestamp is not None
                
        finally:
            # Restore original setting
            token_service.enable_audit_logging = original_setting


class TestIntegration:
    """Test integration scenarios"""

    def test_complete_auth_flow(self, client, test_user):
        """Test complete authentication flow with refresh"""
        # 1. Login
        login_response = client.post("/api/v1/auth/login", json={
            "username": "testuser",
            "password": "TestPass123!"
        })
        assert login_response.status_code == 200
        
        login_data = login_response.json()
        access_token = login_data["access_token"]
        refresh_token = login_data["refresh_token"]
        
        # 2. Use access token for authenticated request
        me_response = client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        assert me_response.status_code == 200
        
        # 3. Refresh token
        refresh_response = client.post("/api/v1/auth/refresh", cookies={
            "refresh_token": refresh_token
        })
        assert refresh_response.status_code == 200
        
        new_access_token = refresh_response.json()["access_token"]
        
        # 4. Use new access token
        me_response2 = client.get("/api/v1/auth/me", headers={
            "Authorization": f"Bearer {new_access_token}"
        })
        assert me_response2.status_code == 200
        
        # 5. Logout
        logout_response = client.post("/api/v1/auth/logout", cookies={
            "refresh_token": refresh_token
        })
        assert logout_response.status_code == 200

    def test_multiple_device_sessions(self, client, test_user):
        """Test multiple device sessions for the same user"""
        # Simulate login from different devices
        devices = [
            {"User-Agent": "Mobile Browser/1.0", "ip": "192.168.1.100"},
            {"User-Agent": "Desktop Browser/2.0", "ip": "192.168.1.101"},
            {"User-Agent": "Tablet Browser/1.5", "ip": "192.168.1.102"}
        ]
        
        tokens = []
        for device in devices:
            # Mock request for each device
            mock_request = Mock()
            mock_request.headers = {"User-Agent": device["User-Agent"]}
            mock_request.client = Mock()
            mock_request.client.host = device["ip"]
            
            # Create token for this device
            token = token_service.create_refresh_token(test_user, mock_request, db_session)
            tokens.append(token)
        
        # Verify all tokens are active
        assert len(tokens) == 3
        
        # Verify tokens have different device info
        device_infos = set()
        for token in tokens:
            parts = token.split(":")
            token_id = parts[1]
            db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
            device_infos.add(db_token.device_info)
        
        assert len(device_infos) == 3  # Different devices

    def test_token_expiration_handling(self, client, test_user, mock_request, db_session):
        """Test handling of expired tokens"""
        # Create a refresh token
        refresh_token = token_service.create_refresh_token(test_user, mock_request, db_session)
        
        # Manually expire the token in database
        parts = refresh_token.split(":")
        token_id = parts[1]
        db_token = db_session.query(RefreshToken).filter(RefreshToken.id == token_id).first()
        db_token.expires_at = datetime.utcnow() - timedelta(hours=1)
        db_session.commit()
        
        # Try to refresh with expired token
        response = client.post("/api/v1/auth/refresh", cookies={
            "refresh_token": refresh_token
        })
        
        assert response.status_code == 401
        data = response.json()
        assert "Invalid or expired refresh token" in data["detail"]



