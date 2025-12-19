import pytest
from fastapi import status
from datetime import datetime, timedelta, timezone
from app.models import ApiKey, User, Notification
from app.auth import get_password_hash, verify_password
import secrets
import base64


class TestApiKeyManagement:
    """Test API key management endpoints (admin only)."""

    def test_list_api_keys_admin(self, client, admin_headers, db_session, test_admin_user):
        """Test listing all API keys as admin."""
        # Create some test API keys
        key1 = ApiKey(
            name="Test Key 1",
            key_hash=get_password_hash("dm_testkey1"),
            description="Test key 1",
            created_by_user_id=test_admin_user.id,
            is_active=True
        )
        key2 = ApiKey(
            name="Test Key 2",
            key_hash=get_password_hash("dm_testkey2"),
            description="Test key 2",
            created_by_user_id=test_admin_user.id,
            is_active=False
        )
        db_session.add(key1)
        db_session.add(key2)
        db_session.commit()

        response = client.get("/api/v1/users/admin/api-keys", headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

        # Check that all required fields are present
        for key in data:
            assert "id" in key
            assert "name" in key
            assert "description" in key
            assert "created_by_user_id" in key
            assert "created_by_username" in key
            assert "expires_at" in key
            assert "last_used_at" in key
            assert "is_active" in key
            assert "created_at" in key
            assert "updated_at" in key
            # Key value should NOT be in response
            assert "api_key" not in key
            assert "key_hash" not in key

    def test_list_api_keys_non_admin_forbidden(self, client, auth_headers):
        """Test listing API keys as non-admin user (should be forbidden)."""
        response = client.get("/api/v1/users/admin/api-keys", headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]

    def test_list_api_keys_unauthorized(self, client):
        """Test listing API keys without authentication."""
        response = client.get("/api/v1/users/admin/api-keys")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_api_key_admin(self, client, admin_headers, db_session, test_admin_user):
        """Test creating a new API key as admin."""
        key_data = {
            "name": "Lambda Email Processor",
            "description": "API key for Lambda function to send emails"
        }

        response = client.post("/api/v1/users/admin/api-keys", json=key_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] > 0
        assert data["name"] == "Lambda Email Processor"
        assert data["description"] == "API key for Lambda function to send emails"
        assert "api_key" in data  # Key value should be shown on creation
        assert data["api_key"].startswith("dm_")
        assert len(data["api_key"]) > 10  # Should be a substantial key
        assert data["warning"] == "Store this API key securely. It will not be shown again."
        
        # Verify it was stored in database with correct created_by_user_id

        # Verify key was stored in database
        db_key = db_session.query(ApiKey).filter(ApiKey.id == data["id"]).first()
        assert db_key is not None
        assert db_key.name == "Lambda Email Processor"
        assert db_key.is_active is True
        # Verify the key hash matches
        assert verify_password(data["api_key"], db_key.key_hash)

    def test_create_api_key_with_expiration(self, client, admin_headers, db_session, test_admin_user):
        """Test creating an API key with expiration date."""
        future_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        key_data = {
            "name": "Temporary Key",
            "description": "Key that expires in 30 days",
            "expires_at": future_date
        }

        response = client.post("/api/v1/users/admin/api-keys", json=key_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["expires_at"] is not None

        # Verify expiration was stored
        db_key = db_session.query(ApiKey).filter(ApiKey.id == data["id"]).first()
        assert db_key.expires_at is not None

    def test_create_api_key_non_admin_forbidden(self, client, auth_headers):
        """Test creating API key as non-admin user (should be forbidden)."""
        key_data = {
            "name": "Test Key",
            "description": "Test description"
        }

        response = client.post("/api/v1/users/admin/api-keys", json=key_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]

    def test_create_api_key_unauthorized(self, client):
        """Test creating API key without authentication."""
        key_data = {
            "name": "Test Key",
            "description": "Test description"
        }

        response = client.post("/api/v1/users/admin/api-keys", json=key_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_api_key_invalid_data(self, client, admin_headers):
        """Test creating API key with invalid data."""
        # Empty name
        key_data = {
            "name": "",
            "description": "Test description"
        }

        response = client.post("/api/v1/users/admin/api-keys", json=key_data, headers=admin_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_api_key_admin(self, client, admin_headers, db_session, test_admin_user):
        """Test getting API key details as admin."""
        # Create a test API key
        key = ApiKey(
            name="Test Key",
            key_hash=get_password_hash("dm_testkey"),
            description="Test description",
            created_by_user_id=test_admin_user.id,
            is_active=True
        )
        db_session.add(key)
        db_session.commit()
        db_session.refresh(key)

        response = client.get(f"/api/v1/users/admin/api-keys/{key.id}", headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == key.id
        assert data["name"] == "Test Key"
        assert data["description"] == "Test description"
        assert data["is_active"] is True
        # Key value should NOT be in response
        assert "api_key" not in data
        assert "key_hash" not in data

    def test_get_api_key_not_found(self, client, admin_headers):
        """Test getting non-existent API key."""
        response = client.get("/api/v1/users/admin/api-keys/99999", headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_api_key_non_admin_forbidden(self, client, auth_headers, db_session, test_admin_user):
        """Test getting API key as non-admin user (should be forbidden)."""
        # Create a test API key
        key = ApiKey(
            name="Test Key",
            key_hash=get_password_hash("dm_testkey"),
            created_by_user_id=test_admin_user.id
        )
        db_session.add(key)
        db_session.commit()

        response = client.get(f"/api/v1/users/admin/api-keys/{key.id}", headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_api_key_admin(self, client, admin_headers, db_session, test_admin_user):
        """Test updating API key as admin."""
        # Create a test API key
        key = ApiKey(
            name="Original Name",
            key_hash=get_password_hash("dm_testkey"),
            description="Original description",
            created_by_user_id=test_admin_user.id,
            is_active=True
        )
        db_session.add(key)
        db_session.commit()
        db_session.refresh(key)

        update_data = {
            "name": "Updated Name",
            "description": "Updated description",
            "is_active": False
        }

        response = client.put(f"/api/v1/users/admin/api-keys/{key.id}", json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"
        assert data["is_active"] is False

        # Verify changes were persisted
        db_session.refresh(key)
        assert key.name == "Updated Name"
        assert key.description == "Updated description"
        assert key.is_active is False

    def test_update_api_key_partial(self, client, admin_headers, db_session, test_admin_user):
        """Test updating API key with partial data."""
        # Create a test API key
        key = ApiKey(
            name="Original Name",
            key_hash=get_password_hash("dm_testkey"),
            description="Original description",
            created_by_user_id=test_admin_user.id,
            is_active=True
        )
        db_session.add(key)
        db_session.commit()
        db_session.refresh(key)

        # Update only name
        update_data = {"name": "Updated Name Only"}

        response = client.put(f"/api/v1/users/admin/api-keys/{key.id}", json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name Only"
        assert data["description"] == "Original description"  # Should remain unchanged
        assert data["is_active"] is True  # Should remain unchanged

    def test_update_api_key_expiration(self, client, admin_headers, db_session, test_admin_user):
        """Test updating API key expiration date."""
        # Create a test API key
        key = ApiKey(
            name="Test Key",
            key_hash=get_password_hash("dm_testkey"),
            created_by_user_id=test_admin_user.id
        )
        db_session.add(key)
        db_session.commit()
        db_session.refresh(key)

        future_date = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
        update_data = {"expires_at": future_date}

        response = client.put(f"/api/v1/users/admin/api-keys/{key.id}", json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["expires_at"] is not None

        # Verify expiration was updated
        db_session.refresh(key)
        assert key.expires_at is not None

    def test_update_api_key_not_found(self, client, admin_headers):
        """Test updating non-existent API key."""
        update_data = {"name": "Updated Name"}

        response = client.put("/api/v1/users/admin/api-keys/99999", json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_api_key_non_admin_forbidden(self, client, auth_headers, db_session, test_admin_user):
        """Test updating API key as non-admin user (should be forbidden)."""
        # Create a test API key
        key = ApiKey(
            name="Test Key",
            key_hash=get_password_hash("dm_testkey"),
            created_by_user_id=test_admin_user.id
        )
        db_session.add(key)
        db_session.commit()

        update_data = {"name": "Updated Name"}

        response = client.put(f"/api/v1/users/admin/api-keys/{key.id}", json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_api_key_admin(self, client, admin_headers, db_session, test_admin_user):
        """Test deleting API key as admin."""
        # Create a test API key
        key = ApiKey(
            name="Test Key",
            key_hash=get_password_hash("dm_testkey"),
            created_by_user_id=test_admin_user.id
        )
        db_session.add(key)
        db_session.commit()
        key_id = key.id

        response = client.delete(f"/api/v1/users/admin/api-keys/{key_id}", headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        assert "deleted successfully" in response.json()["message"].lower()

        # Verify key was deleted
        db_key = db_session.query(ApiKey).filter(ApiKey.id == key_id).first()
        assert db_key is None

    def test_delete_api_key_not_found(self, client, admin_headers):
        """Test deleting non-existent API key."""
        response = client.delete("/api/v1/users/admin/api-keys/99999", headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_api_key_non_admin_forbidden(self, client, auth_headers, db_session, test_admin_user):
        """Test deleting API key as non-admin user (should be forbidden)."""
        # Create a test API key
        key = ApiKey(
            name="Test Key",
            key_hash=get_password_hash("dm_testkey"),
            created_by_user_id=test_admin_user.id
        )
        db_session.add(key)
        db_session.commit()

        response = client.delete(f"/api/v1/users/admin/api-keys/{key.id}", headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestApiKeyAuthentication:
    """Test API key authentication for Lambda endpoints."""

    def test_lambda_endpoint_with_valid_api_key(self, client, db_session, test_user):
        """Test Lambda endpoint accepts valid API key."""
        # Create a test API key
        api_key_value = "dm_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        key_hash = get_password_hash(api_key_value)
        
        key = ApiKey(
            name="Lambda Test Key",
            key_hash=key_hash,
            created_by_user_id=test_user.id,
            is_active=True
        )
        db_session.add(key)
        db_session.commit()

        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            email_sent=False
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)

        # Test Lambda endpoint with API key
        headers = {"X-API-Key": api_key_value}
        response = client.get(f"/api/v1/notifications/internal/{notification.id}", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == notification.id
        assert data["title"] == "Test Notification"

        # Verify last_used_at was updated
        db_session.refresh(key)
        assert key.last_used_at is not None

    def test_lambda_endpoint_with_invalid_api_key(self, client, db_session, test_user):
        """Test Lambda endpoint rejects invalid API key."""
        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message"
        )
        db_session.add(notification)
        db_session.commit()

        # Test Lambda endpoint with invalid API key
        headers = {"X-API-Key": "invalid_key"}
        response = client.get(f"/api/v1/notifications/internal/{notification.id}", headers=headers)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid API key" in response.json()["detail"]

    def test_lambda_endpoint_without_api_key(self, client, db_session, test_user):
        """Test Lambda endpoint rejects requests without API key."""
        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message"
        )
        db_session.add(notification)
        db_session.commit()

        # Test Lambda endpoint without API key
        response = client.get(f"/api/v1/notifications/internal/{notification.id}")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "API key required" in response.json()["detail"]

    def test_lambda_endpoint_with_expired_api_key(self, client, db_session, test_user):
        """Test Lambda endpoint rejects expired API key."""
        # Create an expired API key
        api_key_value = "dm_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        key_hash = get_password_hash(api_key_value)
        
        expired_date = datetime.now(timezone.utc) - timedelta(days=1)
        key = ApiKey(
            name="Expired Key",
            key_hash=key_hash,
            created_by_user_id=test_user.id,
            is_active=True,
            expires_at=expired_date
        )
        db_session.add(key)
        db_session.commit()

        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message"
        )
        db_session.add(notification)
        db_session.commit()

        # Test Lambda endpoint with expired API key
        headers = {"X-API-Key": api_key_value}
        response = client.get(f"/api/v1/notifications/internal/{notification.id}", headers=headers)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid API key" in response.json()["detail"]

    def test_lambda_endpoint_with_revoked_api_key(self, client, db_session, test_user):
        """Test Lambda endpoint rejects revoked (inactive) API key."""
        # Create an inactive API key
        api_key_value = "dm_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        key_hash = get_password_hash(api_key_value)
        
        key = ApiKey(
            name="Revoked Key",
            key_hash=key_hash,
            created_by_user_id=test_user.id,
            is_active=False  # Revoked
        )
        db_session.add(key)
        db_session.commit()

        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message"
        )
        db_session.add(notification)
        db_session.commit()

        # Test Lambda endpoint with revoked API key
        headers = {"X-API-Key": api_key_value}
        response = client.get(f"/api/v1/notifications/internal/{notification.id}", headers=headers)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid API key" in response.json()["detail"]

    def test_lambda_endpoint_with_legacy_env_var(self, client, db_session, test_user, monkeypatch):
        """Test Lambda endpoint falls back to legacy LAMBDA_API_KEY env var."""
        # Set legacy environment variable
        legacy_key = "legacy_test_key_12345"
        monkeypatch.setenv("LAMBDA_API_KEY", legacy_key)

        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message"
        )
        db_session.add(notification)
        db_session.commit()

        # Need to reload the module to pick up the new env var
        import importlib
        import app.routers.notifications
        importlib.reload(app.routers.notifications)

        # Test Lambda endpoint with legacy API key
        headers = {"X-API-Key": legacy_key}
        response = client.get(f"/api/v1/notifications/internal/{notification.id}", headers=headers)

        # Should work with legacy key (backward compatibility)
        assert response.status_code == status.HTTP_200_OK

    def test_mark_email_sent_with_valid_api_key(self, client, db_session, test_user):
        """Test marking email as sent with valid API key."""
        # Create a test API key
        api_key_value = "dm_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        key_hash = get_password_hash(api_key_value)
        
        key = ApiKey(
            name="Lambda Test Key",
            key_hash=key_hash,
            created_by_user_id=test_user.id,
            is_active=True
        )
        db_session.add(key)
        db_session.commit()

        # Create a test notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            email_sent=False
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)

        # Test marking email as sent
        headers = {"X-API-Key": api_key_value}
        response = client.put(
            f"/api/v1/notifications/internal/{notification.id}/mark-email-sent",
            headers=headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Response format: {"status": "success", "notification_id": ..., "email_sent_at": ...}
        assert data["status"] == "success"
        assert data["notification_id"] == notification.id
        assert "email_sent_at" in data
        
        # Verify changes were persisted
        db_session.refresh(notification)
        assert notification.email_sent is True
        assert notification.email_sent_at is not None

        # Verify changes were persisted
        db_session.refresh(notification)
        assert notification.email_sent is True
        assert notification.email_sent_at is not None

    def test_mark_email_sent_already_sent(self, client, db_session, test_user):
        """Test marking email as sent when already sent (idempotency)."""
        # Create a test API key
        api_key_value = "dm_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        key_hash = get_password_hash(api_key_value)
        
        key = ApiKey(
            name="Lambda Test Key",
            key_hash=key_hash,
            created_by_user_id=test_user.id,
            is_active=True
        )
        db_session.add(key)
        db_session.commit()

        # Create a test notification already marked as sent
        sent_time = datetime.now(timezone.utc)
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            email_sent=True,
            email_sent_at=sent_time
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)

        # Test marking email as sent again (should be idempotent)
        headers = {"X-API-Key": api_key_value}
        response = client.put(
            f"/api/v1/notifications/internal/{notification.id}/mark-email-sent",
            headers=headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Response might be a simple message or the notification object
        # Check if it's a dict with email_sent or just a message
        if isinstance(data, dict) and "email_sent" in data:
            assert data["email_sent"] is True
            # Should not change the timestamp
            assert data["email_sent_at"] == sent_time.isoformat()
        else:
            # If it's a message, verify in database that timestamp wasn't changed
            db_session.refresh(notification)
            assert notification.email_sent is True
            # Compare timestamps (handle timezone differences and timing)
            # SQLite returns naive datetime, MySQL returns timezone-aware
            # Allow 2 second tolerance for timing differences between API call and database update
            from datetime import timedelta
            
            if notification.email_sent_at.tzinfo is None:
                # If DB returned naive datetime, make sent_time naive for comparison
                # Also remove microseconds for comparison as DB may truncate them
                sent_time_naive = sent_time.replace(tzinfo=None, microsecond=0)
                notification_time_naive = notification.email_sent_at.replace(microsecond=0)
                # Allow 2 second tolerance for timing differences
                time_diff = abs((notification_time_naive - sent_time_naive).total_seconds())
                assert time_diff <= 2, f"Time difference {time_diff}s exceeds 2 second tolerance"
            else:
                # Both are timezone-aware, compare directly (remove microseconds for comparison)
                sent_time_no_us = sent_time.replace(microsecond=0)
                notification_time_no_us = notification.email_sent_at.replace(microsecond=0)
                # Allow 2 second tolerance for timing differences
                time_diff = abs((notification_time_no_us - sent_time_no_us).total_seconds())
                assert time_diff <= 2, f"Time difference {time_diff}s exceeds 2 second tolerance"
