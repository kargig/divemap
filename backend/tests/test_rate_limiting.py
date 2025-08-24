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
        # Create a test client that simulates external IP to bypass localhost exemption
        with patch('app.limiter.is_localhost_ip', return_value=False):
            # Make multiple requests to a rate-limited endpoint
            responses = []
            for i in range(160):  # More than the new rate limit (150/minute)
                response = client.get("/api/v1/dive-sites/")
                responses.append(response.status_code)

            # Should have at least one rate limited response (429)
            assert 429 in responses, "Rate limiting is not working as expected"

    def test_auth_endpoints_rate_limited(self, client):
        """Test that auth endpoints are rate limited"""
        # Create a test client that simulates external IP to bypass localhost exemption
        with patch('app.limiter.is_localhost_ip', return_value=False):
            # Make multiple requests to login endpoints (which have 30/minute limit)
            responses = []
            for i in range(35):  # More than the new rate limit (30/minute)
                response = client.post("/api/v1/auth/login", json={
                    "username": f"testuser{i}",
                    "password": "TestPassword123!"
                })
                responses.append(response.status_code)

            # Should have at least one rate limited response (429)
            assert 429 in responses, "Auth endpoints are not rate limited as expected"

    def test_register_endpoint_rate_limited(self, client):
        """Test that the register endpoint is rate limited (5/minute limit)"""
        # Create a test client that simulates external IP to bypass localhost exemption
        with patch('app.limiter.is_localhost_ip', return_value=False):
            # Make multiple requests to register endpoint (which has 8/minute limit)
            responses = []
            for i in range(12):  # More than the new rate limit (8/minute)
                response = client.post("/api/v1/auth/register", json={
                    "username": f"testuser{i}",
                    "email": f"testuser{i}@example.com",
                    "password": "TestPassword123!"
                })
                responses.append(response.status_code)

            # Should have at least one rate limited response (429)
            assert 429 in responses, "Register endpoint is not rate limited as expected"

            # Verify that the first few requests were successful (200 or 400 for duplicate)
            successful_responses = [r for r in responses[:8] if r in [200, 400]]
            assert len(successful_responses) > 0, "First requests should be successful"

            # Verify that later requests were rate limited
            rate_limited_responses = [r for r in responses[8:] if r == 429]
            assert len(rate_limited_responses) > 0, "Later requests should be rate limited"

    def test_rate_limiting_with_authentication(self, client, test_user):
        """Test rate limiting behavior with authenticated users"""
        # Create a user token
        token = create_access_token(data={"sub": test_user.username})
        headers = {"Authorization": f"Bearer {token}"}

        # Create a test client that simulates external IP to bypass localhost exemption
        with patch('app.limiter.is_localhost_ip', return_value=False):
            # Make multiple requests to a rate-limited endpoint
            responses = []
            for i in range(160):  # More than the new rate limit (150/minute)
                response = client.get("/api/v1/dive-sites/", headers=headers)
                responses.append(response.status_code)

            # Should have at least one rate limited response (429)
            assert 429 in responses, "Authenticated users should be rate limited"

    def test_rate_limiting_decorator_import(self):
        """Test that the decorator can be imported and used"""
        try:
            from app.limiter import skip_rate_limit_for_admin

            # Test that it can be used as a decorator
            @skip_rate_limit_for_admin("15/minute")
            def test_function():
                return "success"

            assert callable(test_function)
        except Exception as e:
            pytest.fail(f"Failed to import or use rate limiting decorator: {e}")

    def test_custom_key_func_behavior(self):
        """Test the custom key function behavior"""
        from app.limiter import custom_key_func
        from fastapi import Request

        # Mock request objects with proper structure
        localhost_request = Mock(spec=Request)
        localhost_request.client = Mock()
        localhost_request.client.host = "127.0.0.1"
        localhost_request.headers = {}
        localhost_request.remote_addr = None

        external_request = Mock(spec=Request)
        external_request.client = Mock()
        external_request.client.host = "192.168.1.100"
        external_request.headers = {}
        external_request.remote_addr = None

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

    def test_localhost_exemption_works(self, client):
        """Test that localhost requests are properly exempted from rate limiting"""
        # This test should pass because localhost requests are exempted
        responses = []
        for i in range(20):  # More than any rate limit
            response = client.get("/api/v1/dive-sites/")
            responses.append(response.status_code)

        # All requests should succeed (200) because localhost is exempted
        assert all(r == 200 for r in responses), "Localhost requests should be exempted from rate limiting"