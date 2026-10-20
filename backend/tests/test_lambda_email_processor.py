"""
Tests for Lambda Email Processor

Tests the AWS Lambda function that processes email notifications from SQS.
Focuses on error handling, retry logic, and backend API interaction.
"""

import importlib.util
import json
import os

# Import the Lambda function module
# Lambda code is in backend/lambda/email_processor.py
import sys
import urllib.error
import urllib.request
from unittest.mock import MagicMock, Mock, mock_open, patch

import pytest

lambda_path = os.path.join(os.path.dirname(__file__), "..", "lambda")
email_processor_path = os.path.join(lambda_path, "email_processor.py")

# Load the module directly
spec = importlib.util.spec_from_file_location("email_processor", email_processor_path)
email_processor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(email_processor)

# Import functions for testing
call_backend_api = email_processor.call_backend_api
process_email_notification = email_processor.process_email_notification
process_push_notification = email_processor.process_push_notification
lambda_handler = email_processor.lambda_handler


class TestLambdaCallBackendAPI:
    """Test the call_backend_api function."""

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_success(self, mock_urlopen, mock_request_class):
        """Test successful backend API call."""
        # Mock successful response
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.reason = "OK"
        mock_response.read.return_value = b'{"id": 1, "title": "Test"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        mock_request = MagicMock()
        mock_request_class.return_value = mock_request

        result = call_backend_api("/api/v1/notifications/internal/1")

        assert result == {"id": 1, "title": "Test"}
        mock_urlopen.assert_called_once()
        # Verify timeout is 30 seconds
        call_args = mock_urlopen.call_args
        assert call_args[1]["timeout"] == 30
        # Verify Request was created
        mock_request_class.assert_called_once()

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_retryable_500_error(
        self, mock_urlopen, mock_request_class
    ):
        """Test retryable 500 error raises exception."""
        # Mock 500 error
        error_response = MagicMock()
        error_response.read.return_value = b"Internal Server Error"
        mock_http_error = urllib.error.HTTPError(
            "https://api.example.com/api/v1/notifications/internal/1",
            500,
            "Internal Server Error",
            {},
            error_response,
        )
        mock_urlopen.side_effect = mock_http_error

        with pytest.raises(Exception) as exc_info:
            call_backend_api("/api/v1/notifications/internal/1")

        assert "Backend API returned 500" in str(exc_info.value)

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_retryable_502_error(
        self, mock_urlopen, mock_request_class
    ):
        """Test retryable 502 error raises exception."""
        error_response = MagicMock()
        error_response.read.return_value = b"Bad Gateway"
        mock_http_error = urllib.error.HTTPError(
            "https://api.example.com/api/v1/notifications/internal/1",
            502,
            "Bad Gateway",
            {},
            error_response,
        )
        mock_urlopen.side_effect = mock_http_error

        with pytest.raises(Exception) as exc_info:
            call_backend_api("/api/v1/notifications/internal/1")

        assert "Backend API returned 502" in str(exc_info.value)

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_retryable_503_error(
        self, mock_urlopen, mock_request_class
    ):
        """Test retryable 503 error raises exception."""
        error_response = MagicMock()
        error_response.read.return_value = b"Service Unavailable"
        mock_http_error = urllib.error.HTTPError(
            "https://api.example.com/api/v1/notifications/internal/1",
            503,
            "Service Unavailable",
            {},
            error_response,
        )
        mock_urlopen.side_effect = mock_http_error

        with pytest.raises(Exception) as exc_info:
            call_backend_api("/api/v1/notifications/internal/1")

        assert "Backend API returned 503" in str(exc_info.value)

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_retryable_504_error(
        self, mock_urlopen, mock_request_class
    ):
        """Test retryable 504 error raises exception."""
        error_response = MagicMock()
        error_response.read.return_value = b"error code: 504"
        mock_http_error = urllib.error.HTTPError(
            "https://api.example.com/api/v1/notifications/internal/1",
            504,
            "Gateway Timeout",
            {},
            error_response,
        )
        mock_urlopen.side_effect = mock_http_error

        with pytest.raises(Exception) as exc_info:
            call_backend_api("/api/v1/notifications/internal/1")

        assert "Backend API returned 504" in str(exc_info.value)
        assert "error code: 504" in str(exc_info.value)

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_non_retryable_404_error(
        self, mock_urlopen, mock_request_class
    ):
        """Test non-retryable 404 error returns None."""
        error_response = MagicMock()
        error_response.read.return_value = b'{"detail": "Not Found"}'
        mock_http_error = urllib.error.HTTPError(
            "https://api.example.com/api/v1/notifications/internal/1",
            404,
            "Not Found",
            {},
            error_response,
        )
        mock_urlopen.side_effect = mock_http_error

        result = call_backend_api("/api/v1/notifications/internal/1")

        assert result is None

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_non_retryable_400_error(
        self, mock_urlopen, mock_request_class
    ):
        """Test non-retryable 400 error returns None (no exception)."""
        error_response = MagicMock()
        error_response.read.return_value = b"Bad Request"
        mock_http_error = urllib.error.HTTPError(
            "https://api.example.com/api/v1/notifications/internal/1",
            400,
            "Bad Request",
            {},
            error_response,
        )
        mock_urlopen.side_effect = mock_http_error

        result = call_backend_api("/api/v1/notifications/internal/1")

        assert result is None

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
            "CLOUDFLARE_API_TOKEN": "test-cf-token",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_cloudflare_token_header(
        self, mock_urlopen, mock_request_class
    ):
        """Test Cloudflare API token is added to headers when configured."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.reason = "OK"
        mock_response.read.return_value = b"{}"
        mock_urlopen.return_value.__enter__.return_value = mock_response

        mock_request = MagicMock()
        mock_request_class.return_value = mock_request

        call_backend_api("/api/v1/notifications/internal/1")

        # Verify Request was created
        mock_request_class.assert_called_once()
        # Verify CF-Access-Token header was added
        call_kwargs = mock_request_class.call_args[1]
        assert "CF-Access-Token" in call_kwargs.get("headers", {})
        assert call_kwargs["headers"]["CF-Access-Token"] == "test-cf-token"

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    @patch("urllib.request.Request")
    @patch("urllib.request.urlopen")
    def test_call_backend_api_user_agent_header(self, mock_urlopen, mock_request_class):
        """Test custom User-Agent header is set."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.reason = "OK"
        mock_response.read.return_value = b"{}"
        mock_urlopen.return_value.__enter__.return_value = mock_response

        mock_request = MagicMock()
        mock_request_class.return_value = mock_request

        call_backend_api("/api/v1/notifications/internal/1")

        # Verify add_header was called with User-Agent
        mock_request.add_header.assert_called()
        user_agent_calls = [
            call
            for call in mock_request.add_header.call_args_list
            if call[0][0] == "User-Agent"
        ]
        assert len(user_agent_calls) > 0
        assert user_agent_calls[0][0][1] == "Divemap-Lambda-NotificationProcessor/1.0"


class TestLambdaProcessEmailNotification:
    """Test the process_email_notification function."""

    @patch.object(email_processor, "call_backend_api")
    @patch.object(email_processor, "EMAIL_SERVICE_AVAILABLE", True)
    @patch("app.services.email_service.EmailService")
    def test_process_email_notification_retryable_error_propagation(
        self, mock_email_service_class, mock_call_api
    ):
        """Test that retryable errors (5xx) are re-raised for SQS retry."""
        # Mock 504 error from backend API
        mock_call_api.side_effect = Exception(
            "Backend API returned 504 Gateway Timeout: error code: 504"
        )

        notification_data = {
            "title": "Test",
            "message": "Test message",
            "link_url": None,
            "category": "test",
        }

        with pytest.raises(Exception) as exc_info:
            process_email_notification(1, "test@example.com", notification_data)

        assert "Backend API returned 504" in str(exc_info.value) or "504" in str(
            exc_info.value
        )

    @patch.object(email_processor, "call_backend_api")
    @patch.object(email_processor, "EMAIL_SERVICE_AVAILABLE", True)
    @patch("app.services.email_service.EmailService")
    def test_process_email_notification_non_retryable_error(
        self, mock_email_service_class, mock_call_api
    ):
        """Test that non-retryable errors return False (no exception)."""
        # Mock successful API call but email send failure
        mock_call_api.return_value = {
            "id": 1,
            "title": "Test",
            "message": "Test",
            "email_sent": False,
        }

        mock_email_service = MagicMock()
        mock_email_service_class.return_value = mock_email_service
        mock_email_service.send_notification_email.return_value = False

        notification_data = {
            "title": "Test",
            "message": "Test message",
            "link_url": None,
            "category": "test",
        }

        result = process_email_notification(1, "test@example.com", notification_data)

        assert result is False


class TestLambdaHandler:
    """Test the lambda_handler function."""

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    def test_lambda_handler_retryable_error_propagation(self):
        """Test that retryable errors are re-raised to fail Lambda."""
        from unittest.mock import patch

        # Create test event
        test_event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "notification_id": 1,
                            "user_email": "test@example.com",
                            "notification": {
                                "title": "Test",
                                "message": "Test message",
                                "link_url": None,
                                "category": "test",
                            },
                        }
                    )
                }
            ]
        }

        # Mock process_email_notification to raise retryable error
        with patch.object(
            email_processor, "process_email_notification"
        ) as mock_process:
            mock_process.side_effect = Exception(
                "Backend API returned 504 Gateway Timeout: error code: 504"
            )

            with pytest.raises(Exception) as exc_info:
                lambda_handler(test_event, None)

            assert "Backend API returned 504" in str(exc_info.value) or "504" in str(
                exc_info.value
            )

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    def test_lambda_handler_non_retryable_error_returns_200_with_failure(self):
        """Test that non-retryable errors return 200 with failure_count (Lambda succeeds)."""
        # Create test event
        test_event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "notification_id": 1,
                            "user_email": "test@example.com",
                            "notification": {
                                "title": "Test",
                                "message": "Test message",
                                "link_url": None,
                                "category": "test",
                            },
                        }
                    )
                }
            ]
        }

        # Mock process_email_notification to raise non-retryable error
        with patch.object(
            email_processor, "process_email_notification"
        ) as mock_process:
            mock_process.side_effect = Exception("Template rendering failed")

            result = lambda_handler(test_event, None)

            # Non-retryable errors should result in 200 status with failure_count > 0
            assert result["statusCode"] == 200
            body_data = json.loads(result["body"])
            assert "failure_count" in body_data
            assert body_data["failure_count"] == 1
            assert body_data["success_count"] == 0

    @patch.dict(
        os.environ,
        {
            "BACKEND_API_URL": "https://api.example.com",
            "LAMBDA_API_KEY": "test-api-key",
        },
    )
    def test_lambda_handler_retryable_error_in_handler_re_raises(self):
        """Test that retryable errors caught in handler are re-raised."""
        # Create test event
        test_event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "notification_id": 1,
                            "user_email": "test@example.com",
                            "notification": {
                                "title": "Test",
                                "message": "Test message",
                                "link_url": None,
                                "category": "test",
                            },
                        }
                    )
                }
            ]
        }

        # Mock process_email_notification to raise retryable error
        with patch.object(
            email_processor, "process_email_notification"
        ) as mock_process:
            # Simulate a retryable error being raised
            mock_process.side_effect = Exception(
                "Backend API returned 503 Service Unavailable"
            )

            with pytest.raises(Exception) as exc_info:
                lambda_handler(test_event, None)

            # Should re-raise because it's a retryable error
            error_msg = str(exc_info.value)
            assert "Backend API returned 503" in error_msg or "503" in error_msg


class TestLambdaProcessPushNotification:
    """Test process_push_notification function."""

    @patch.dict(
        os.environ,
        {
            "VAPID_PRIVATE_KEY": "test-vapid-key",
            "VAPID_ADMIN_EMAIL": "mailto:admin@example.com",
        },
    )
    @patch.object(email_processor, "WEB_PUSH_AVAILABLE", True)
    @patch.object(email_processor, "webpush")
    def test_process_push_notification_success(self, mock_webpush):
        """Test successful push notification."""
        result = process_push_notification(
            subscription_id=1,
            endpoint="https://fcm.googleapis.com/fcm/send/test",
            p256dh="test-p256dh",
            auth="test-auth",
            payload={"title": "Test", "body": "Message"},
        )
        assert result is True
        mock_webpush.assert_called_once()

    @patch.dict(
        os.environ,
        {
            "VAPID_PRIVATE_KEY": "test-vapid-key",
            "VAPID_ADMIN_EMAIL": "mailto:admin@example.com",
        },
    )
    @patch.object(email_processor, "WEB_PUSH_AVAILABLE", True)
    @patch.object(email_processor, "call_backend_api")
    @patch.object(email_processor, "webpush")
    def test_process_push_notification_410_gone(
        self, mock_webpush, mock_call_backend_api
    ):
        """Test 410 Gone calls backend API with ?status_code=410."""
        # Create mock WebPushException with response.status_code = 410
        mock_response = MagicMock()
        mock_response.status_code = 410
        ex = email_processor.WebPushException("Push failed: 410 Gone")
        ex.response = mock_response
        mock_webpush.side_effect = ex

        result = process_push_notification(
            subscription_id=12,
            endpoint="https://fcm.googleapis.com/fcm/send/test",
            p256dh="test-p256dh",
            auth="test-auth",
            payload={"title": "Test"},
        )
        assert result is False
        mock_call_backend_api.assert_called_once_with(
            "/api/v1/notifications/internal/push-subscriptions/12/fail?status_code=410",
            method="PUT",
        )

    @patch.dict(
        os.environ,
        {
            "VAPID_PRIVATE_KEY": "test-vapid-key",
            "VAPID_ADMIN_EMAIL": "mailto:admin@example.com",
        },
    )
    @patch.object(email_processor, "WEB_PUSH_AVAILABLE", True)
    @patch.object(email_processor, "call_backend_api")
    @patch.object(email_processor, "webpush")
    def test_process_push_notification_404_not_found(
        self, mock_webpush, mock_call_backend_api
    ):
        """Test 404 Not Found calls backend API with ?status_code=404."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        ex = email_processor.WebPushException("Push failed: 404 Not Found")
        ex.response = mock_response
        mock_webpush.side_effect = ex

        result = process_push_notification(
            subscription_id=10,
            endpoint="https://fcm.googleapis.com/fcm/send/test",
            p256dh="test-p256dh",
            auth="test-auth",
            payload={"title": "Test"},
        )
        assert result is False
        mock_call_backend_api.assert_called_once_with(
            "/api/v1/notifications/internal/push-subscriptions/10/fail?status_code=404",
            method="PUT",
        )

    @patch.dict(
        os.environ,
        {
            "VAPID_PRIVATE_KEY": "test-vapid-key",
            "VAPID_ADMIN_EMAIL": "mailto:admin@example.com",
        },
    )
    @patch.object(email_processor, "WEB_PUSH_AVAILABLE", True)
    @patch.object(email_processor, "call_backend_api")
    @patch.object(email_processor, "webpush")
    def test_process_push_notification_400_bad_request(
        self, mock_webpush, mock_call_backend_api
    ):
        """Test 400 Bad Request calls backend API with ?status_code=400."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        ex = email_processor.WebPushException("Push failed: 400 Bad Request")
        ex.response = mock_response
        mock_webpush.side_effect = ex

        result = process_push_notification(
            subscription_id=15,
            endpoint="https://fcm.googleapis.com/fcm/send/test",
            p256dh="test-p256dh",
            auth="test-auth",
            payload={"title": "Test"},
        )
        assert result is False
        mock_call_backend_api.assert_called_once_with(
            "/api/v1/notifications/internal/push-subscriptions/15/fail?status_code=400",
            method="PUT",
        )

    @patch.dict(
        os.environ,
        {
            "VAPID_PRIVATE_KEY": "test-vapid-key",
            "VAPID_ADMIN_EMAIL": "mailto:admin@example.com",
        },
    )
    @patch.object(email_processor, "WEB_PUSH_AVAILABLE", True)
    @patch.object(email_processor, "call_backend_api")
    @patch.object(email_processor, "webpush")
    def test_process_push_notification_500_transient_no_fail_call(
        self, mock_webpush, mock_call_backend_api
    ):
        """Test 500 server error does not call fail endpoint."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        ex = email_processor.WebPushException("Push failed: 500 Internal Server Error")
        ex.response = mock_response
        mock_webpush.side_effect = ex

        result = process_push_notification(
            subscription_id=16,
            endpoint="https://fcm.googleapis.com/fcm/send/test",
            p256dh="test-p256dh",
            auth="test-auth",
            payload={"title": "Test"},
        )
        assert result is False
        mock_call_backend_api.assert_not_called()
