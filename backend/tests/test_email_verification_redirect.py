
import pytest
from unittest.mock import patch, MagicMock
from app.models import User

class TestEmailVerificationRedirect:
    """Test email verification redirect logic."""

    def test_verify_email_redirect_no_double_slash(self, client, monkeypatch):
        """Test that the redirect URL handles trailing slash in FRONTEND_URL correctly."""
        # Set FRONTEND_URL with a trailing slash
        monkeypatch.setenv("FRONTEND_URL", "http://localhost/")
        
        # Mock the verification service to return a user (success)
        with patch('app.services.email_verification_service.email_verification_service.verify_token') as mock_verify:
            mock_verify.return_value = User(id=1, email="test@example.com", email_verified=True)
            
            # Call the endpoint
            response = client.get("/api/v1/auth/verify-email?token=valid_token", follow_redirects=False)
            
            # Check response is a redirect
            assert response.status_code == 302
            
            # Check location header doesn't have double slash
            location = response.headers["location"]
            assert "http://localhost/verify-email" in location
            assert "http://localhost//verify-email" not in location
            assert location == "http://localhost/verify-email?success=true"

    def test_verify_email_redirect_error_no_double_slash(self, client, monkeypatch):
        """Test that the error redirect URL handles trailing slash in FRONTEND_URL correctly."""
        # Set FRONTEND_URL with a trailing slash
        monkeypatch.setenv("FRONTEND_URL", "http://localhost/")
        
        # Mock the verification service to return None (failure)
        with patch('app.services.email_verification_service.email_verification_service.verify_token') as mock_verify:
            mock_verify.return_value = None
            
            # Call the endpoint
            response = client.get("/api/v1/auth/verify-email?token=invalid_token", follow_redirects=False)
            
            # Check response is a redirect
            assert response.status_code == 302
            
            # Check location header doesn't have double slash
            location = response.headers["location"]
            assert "http://localhost/verify-email" in location
            assert "http://localhost//verify-email" not in location
            assert location == "http://localhost/verify-email?error=invalid_or_expired"
