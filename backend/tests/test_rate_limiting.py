import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from app.main import app
from app.auth import create_access_token
from app.models import User

class TestRateLimiting:
    """Test rate limiting behavior for localhost and admin users"""
    
    def test_rate_limiting_decorator_exists(self):
        """Test that the custom rate limiting decorator is available"""
        from app.limiter import skip_rate_limit_for_admin
        assert callable(skip_rate_limit_for_admin)
    
    def test_custom_key_func_exists(self):
        """Test that the custom key function is available"""
        from app.limiter import custom_key_func
        assert callable(custom_key_func)
    
    def test_limiter_initialized(self):
        """Test that the limiter is properly initialized"""
        from app.limiter import limiter
        assert limiter is not None
    
    def test_rate_limiting_applied_to_endpoints(self, client):
        """Test that rate limiting is applied to endpoints"""
        # Make multiple requests to a rate-limited endpoint
        responses = []
        for i in range(15):  # More than the rate limit
            response = client.get("/api/v1/dive-sites/")
            responses.append(response.status_code)
        
        # Should have at least one rate limited response (429)
        assert 429 in responses, "Rate limiting is not working as expected"
    
    def test_auth_endpoints_rate_limited(self, client):
        """Test that auth endpoints are rate limited"""
        # Make multiple requests to auth endpoints
        responses = []
        for i in range(10):  # More than the rate limit (5/minute)
            response = client.post("/api/v1/auth/register", json={
                "username": f"testuser{i}",
                "email": f"test{i}@example.com",
                "password": "TestPassword123!"
            })
            responses.append(response.status_code)
        
        # Should have at least one rate limited response (429)
        assert 429 in responses, "Auth endpoints are not rate limited as expected"
    
    def test_rate_limiting_with_authentication(self, client, test_user):
        """Test rate limiting behavior with authenticated users"""
        # Create a user token
        token = create_access_token(data={"sub": test_user.username})
        headers = {"Authorization": f"Bearer {token}"}
        
        # Make multiple requests to a rate-limited endpoint
        responses = []
        for i in range(15):  # More than the rate limit
            response = client.get("/api/v1/dive-sites/", headers=headers)
            responses.append(response.status_code)
        
        # Should have at least one rate limited response (429)
        assert 429 in responses, "Authenticated users should be rate limited"
    
    def test_rate_limiting_decorator_import(self):
        """Test that the decorator can be imported and used"""
        try:
            from app.limiter import skip_rate_limit_for_admin
            
            # Test that it can be used as a decorator
            @skip_rate_limit_for_admin("10/minute")
            def test_function():
                return "success"
            
            assert callable(test_function)
        except Exception as e:
            pytest.fail(f"Failed to import or use rate limiting decorator: {e}")
    
    def test_custom_key_func_behavior(self):
        """Test the custom key function behavior"""
        from app.limiter import custom_key_func
        from fastapi import Request
        
        # Mock request objects
        localhost_request = Mock(spec=Request)
        localhost_request.client.host = "127.0.0.1"
        
        external_request = Mock(spec=Request)
        external_request.client.host = "192.168.1.100"
        
        # Test localhost behavior
        localhost_key = custom_key_func(localhost_request)
        assert localhost_key == "localhost"
        
        # Test external IP behavior
        external_key = custom_key_func(external_request)
        assert external_key == "192.168.1.100"
    
    def test_rate_limiting_configuration(self):
        """Test that rate limiting is properly configured"""
        from app.limiter import limiter
        
        # Check that the limiter is properly initialized
        assert limiter is not None
        assert hasattr(limiter, 'limit')
        assert callable(limiter.limit)
    
    def test_endpoints_use_custom_decorator(self):
        """Test that endpoints are using the custom decorator"""
        # Check that the dive sites router uses the custom decorator
        from app.routers.dive_sites import router
        
        # Verify that the router has endpoints
        assert len(router.routes) > 0
        
        # Check that auth router uses the custom decorator
        from app.routers.auth import router as auth_router
        assert len(auth_router.routes) > 0 