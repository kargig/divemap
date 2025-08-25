import pytest
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from app.turnstile_service import TurnstileService
import httpx


class TestTurnstileService:
    """Test cases for TurnstileService"""

    def test_is_enabled_with_both_keys(self):
        """Test is_enabled returns True when both keys are set"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }):
            service = TurnstileService()
            assert service.is_enabled() is True

    def test_is_enabled_without_secret_key(self):
        """Test is_enabled returns False when secret key is missing"""
        with patch.dict('os.environ', {
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }, clear=True):
            service = TurnstileService()
            assert service.is_enabled() is False

    def test_is_enabled_without_site_key(self):
        """Test is_enabled returns False when site key is missing"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key'
        }, clear=True):
            service = TurnstileService()
            assert service.is_enabled() is False

    def test_is_enabled_with_empty_keys(self):
        """Test is_enabled returns False when keys are empty strings"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': '',
            'TURNSTILE_SITE_KEY': ''
        }, clear=True):
            service = TurnstileService()
            assert service.is_enabled() is False

    def test_is_enabled_with_whitespace_keys(self):
        """Test is_enabled returns False when keys are only whitespace"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': '   ',
            'TURNSTILE_SITE_KEY': '  '
        }, clear=True):
            service = TurnstileService()
            assert service.is_enabled() is False

    def test_is_enabled_with_undefined_keys(self):
        """Test is_enabled returns False when keys are 'undefined'"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'undefined',
            'TURNSTILE_SITE_KEY': 'undefined'
        }, clear=True):
            service = TurnstileService()
            assert service.is_enabled() is False

    @pytest.mark.asyncio
    async def test_verify_token_success(self):
        """Test successful token verification"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }):
            service = TurnstileService()
            
            # Create a mock response that behaves like the real httpx response
            class MockResponse:
                def __init__(self, status_code, json_data):
                    self.status_code = status_code
                    self._json_data = json_data
                
                def json(self):
                    return self._json_data
            
            mock_response = MockResponse(200, {"success": True})
            
            # Mock the httpx.AsyncClient
            with patch('app.turnstile_service.httpx.AsyncClient') as mock_client_class:
                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.aclose = AsyncMock()
                mock_client_class.return_value = mock_client
                
                result = await service.verify_token("test_token", "127.0.0.1")
                
                assert result["success"] is True
                assert service._initialized is True

    @pytest.mark.asyncio
    async def test_verify_token_failure_response(self):
        """Test token verification failure response"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }):
            service = TurnstileService()
            
            # Create a mock response that behaves like the real httpx response
            class MockResponse:
                def __init__(self, status_code, json_data):
                    self.status_code = status_code
                    self._json_data = json_data
                
                def json(self):
                    return self._json_data
            
            mock_response = MockResponse(200, {
                "success": False,
                "error-codes": ["invalid-input-response"]
            })
            
            # Mock the httpx.AsyncClient
            with patch('app.turnstile_service.httpx.AsyncClient') as mock_client_class:
                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client_class.return_value = mock_client
                
                with pytest.raises(HTTPException) as exc_info:
                    await service.verify_token("test_token", "127.0.0.1")
                
                assert exc_info.value.status_code == 400
                assert "invalid-input-response" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_verify_token_http_error(self):
        """Test token verification with HTTP error"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }):
            service = TurnstileService()
            
            # Create a mock response for HTTP error
            class MockResponse:
                def __init__(self, status_code):
                    self.status_code = status_code
            
            mock_response = MockResponse(500)
            
            with patch('app.turnstile_service.httpx.AsyncClient') as mock_client_class:
                mock_client = AsyncMock()
                mock_client.post.return_value = mock_response
                mock_client.aclose = AsyncMock()
                mock_client_class.return_value = mock_client
                
                with pytest.raises(HTTPException) as exc_info:
                    await service.verify_token("test_token", "127.0.0.1")
                
                assert exc_info.value.status_code == 500
                assert "Failed to verify Turnstile token" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_verify_token_timeout(self):
        """Test token verification timeout"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }):
            service = TurnstileService()
            
            with patch('app.turnstile_service.httpx.AsyncClient') as mock_client_class:
                mock_client = AsyncMock()
                mock_client.post.side_effect = httpx.TimeoutException("timeout")
                mock_client.aclose = AsyncMock()
                mock_client_class.return_value = mock_client
                
                with pytest.raises(HTTPException) as exc_info:
                    await service.verify_token("test_token", "127.0.0.1")
                
                assert exc_info.value.status_code == 408
                assert "Turnstile verification timeout" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_verify_token_not_enabled(self):
        """Test token verification when service is not enabled"""
        with patch.dict('os.environ', {}, clear=True):
            service = TurnstileService()
            
            with pytest.raises(ValueError) as exc_info:
                await service.verify_token("test_token", "127.0.0.1")
            
            assert "Both TURNSTILE_SECRET_KEY and TURNSTILE_SITE_KEY environment variables must be set and non-empty" in str(exc_info.value)

    def test_custom_verify_url(self):
        """Test custom verification URL from environment"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key',
            'TURNSTILE_VERIFY_URL': 'https://custom.verify.url'
        }):
            service = TurnstileService()
            assert service.verify_url == 'https://custom.verify.url'

    def test_default_verify_url(self):
        """Test default verification URL when not specified"""
        with patch.dict('os.environ', {
            'TURNSTILE_SECRET_KEY': 'test_secret_key',
            'TURNSTILE_SITE_KEY': 'test_site_key'
        }):
            service = TurnstileService()
            assert service.verify_url == 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
