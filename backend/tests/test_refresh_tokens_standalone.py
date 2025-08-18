#!/usr/bin/env python3
"""
Standalone tests for refresh token functionality
This file can be run independently without importing the main app
"""

import os
import sys
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

# Set test environment variables before importing app modules
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "15"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "30"
os.environ["ENABLE_TOKEN_ROTATION"] = "true"
os.environ["ENABLE_AUDIT_LOGGING"] = "true"
os.environ["MAX_ACTIVE_SESSIONS_PER_USER"] = "5"

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import RefreshToken, AuthAuditLog
from app.token_service import token_service
from app.auth import get_password_hash


class TestTokenServiceStandalone:
    """Test the TokenService class functionality without database dependencies"""

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

    def test_token_rotation_configuration(self):
        """Test token rotation configuration"""
        assert token_service.enable_token_rotation is True
        assert token_service.max_active_sessions == 5

    def test_audit_logging_configuration(self):
        """Test audit logging configuration"""
        assert token_service.enable_audit_logging is True

    def test_environment_variable_loading(self):
        """Test that environment variables are loaded correctly"""
        assert token_service.secret_key == "test-secret-key-for-testing-only"
        assert token_service.algorithm == "HS256"
        assert token_service.access_token_expire == timedelta(minutes=15)
        assert token_service.refresh_token_expire == timedelta(days=30)


class TestModelsStandalone:
    """Test model definitions without database"""

    def test_refresh_token_model_definition(self):
        """Test RefreshToken model has correct attributes"""
        # Create a mock refresh token instance
        mock_token = RefreshToken(
            id="test_id",
            user_id=1,
            token_hash="test_hash",
            expires_at=datetime.utcnow() + timedelta(days=30),
            device_info="Test Browser",
            ip_address="127.0.0.1"
        )
        
        assert mock_token.id == "test_id"
        assert mock_token.user_id == 1
        assert mock_token.token_hash == "test_hash"
        assert mock_token.device_info == "Test Browser"
        assert mock_token.ip_address == "127.0.0.1"
        assert mock_token.is_revoked is False

    def test_auth_audit_log_model_definition(self):
        """Test AuthAuditLog model has correct attributes"""
        # Create a mock audit log instance
        mock_log = AuthAuditLog(
            user_id=1,
            action="test_action",
            ip_address="127.0.0.1",
            user_agent="Test Browser",
            success=True,
            details="Test details"
        )
        
        assert mock_log.user_id == 1
        assert mock_log.action == "test_action"
        assert mock_log.ip_address == "127.0.0.1"
        assert mock_log.user_agent == "Test Browser"
        assert mock_log.success is True
        assert mock_log.details == "Test details"


class TestSecurityFeatures:
    """Test security features of the token system"""

    def test_secret_key_validation(self):
        """Test that secret key is properly set"""
        assert token_service.secret_key is not None
        assert len(token_service.secret_key) > 0
        assert token_service.secret_key != "your-secret-key-change-in-production"

    def test_algorithm_validation(self):
        """Test that algorithm is properly set"""
        assert token_service.algorithm in ["HS256", "HS384", "HS512"]

    def test_token_expiration_validation(self):
        """Test that token expiration times are reasonable"""
        assert token_service.access_token_expire <= timedelta(hours=1)  # Should be short
        assert token_service.refresh_token_expire >= timedelta(days=1)  # Should be longer

    def test_session_limit_validation(self):
        """Test that session limits are reasonable"""
        assert token_service.max_active_sessions > 0
        assert token_service.max_active_sessions <= 10  # Shouldn't be too high


def run_standalone_tests():
    """Run the standalone tests"""
    print("🧪 Running Standalone Refresh Token Tests...")
    print("=" * 50)
    
    # Run tests with pytest
    result = pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--disable-warnings"
    ])
    
    if result == 0:
        print("\n✅ All standalone tests passed!")
        return True
    else:
        print("\n❌ Some standalone tests failed!")
        return False


if __name__ == "__main__":
    success = run_standalone_tests()
    sys.exit(0 if success else 1)
