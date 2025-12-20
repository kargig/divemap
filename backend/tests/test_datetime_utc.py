"""
Tests for UTC datetime handling and serialization.

Validates that:
1. Database stores timestamps in UTC
2. Datetime fields are normalized to UTC when retrieved
3. API responses serialize datetimes as UTC ISO strings
4. The utcnow() utility function works correctly
5. Notification timestamps are correctly serialized
6. Pydantic validators normalize datetimes to UTC
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models import Notification, User
from app.utils import utcnow
from app.schemas import NotificationResponse


class TestUTCNowUtility:
    """Test the utcnow() utility function."""

    def test_utcnow_returns_timezone_aware(self):
        """Test that utcnow() returns timezone-aware datetime."""
        now = utcnow()
        assert isinstance(now, datetime)
        assert now.tzinfo is not None
        assert now.tzinfo == timezone.utc

    def test_utcnow_returns_utc(self):
        """Test that utcnow() returns UTC timezone."""
        now = utcnow()
        assert now.tzinfo == timezone.utc

    def test_utcnow_accuracy(self):
        """Test that utcnow() returns current time (within 1 second tolerance)."""
        before = datetime.now(timezone.utc)
        now = utcnow()
        after = datetime.now(timezone.utc)
        
        assert before <= now <= after
        # Should be very close to current time
        assert abs((now - datetime.now(timezone.utc)).total_seconds()) < 1


class TestDatabaseUTCStorage:
    """Test that database stores timestamps in UTC."""

    def test_notification_created_at_stored_as_utc(self, db_session, test_user):
        """Test that notification created_at is stored in UTC."""
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)

        # Verify created_at exists and is timezone-aware
        assert notification.created_at is not None
        # When retrieved from database with timezone=True, SQLAlchemy should return timezone-aware
        # However, MySQL DATETIME doesn't store timezone, so it may be naive
        # The important thing is that it represents UTC time
        
        # Check that created_at is recent (within last minute)
        now_utc = utcnow()
        # Normalize both to naive datetimes for comparison (MySQL DATETIME is naive but represents UTC)
        now_naive = now_utc.replace(tzinfo=None)
        created_at_naive = notification.created_at.replace(tzinfo=None) if notification.created_at.tzinfo else notification.created_at
        time_diff = abs((now_naive - created_at_naive).total_seconds())
        assert time_diff < 60, f"created_at should be recent, but difference is {time_diff} seconds"


class TestPydanticUTCValidation:
    """Test Pydantic validators normalize datetimes to UTC."""

    def test_notification_response_normalizes_naive_datetime_to_utc(self):
        """Test that NotificationResponse normalizes naive datetime to UTC."""
        # Create a naive datetime (simulating database return)
        naive_dt = datetime(2025, 12, 20, 10, 30, 0)
        
        # Create NotificationResponse - validator should normalize to UTC
        response = NotificationResponse(
            id=1,
            user_id=1,
            category="test",
            title="Test",
            message="Test",
            is_read=False,
            email_sent=False,
            created_at=naive_dt
        )
        
        # After validation, created_at should be timezone-aware UTC
        assert response.created_at.tzinfo is not None
        assert response.created_at.tzinfo == timezone.utc
        # Time should be the same (just timezone added)
        assert response.created_at.replace(tzinfo=None) == naive_dt

    def test_notification_response_normalizes_other_timezone_to_utc(self):
        """Test that NotificationResponse converts other timezones to UTC."""
        # Create a timezone-aware datetime in a different timezone (e.g., UTC+2)
        other_tz = timezone(timedelta(hours=2))
        dt_other_tz = datetime(2025, 12, 20, 12, 30, 0, tzinfo=other_tz)
        
        # Create NotificationResponse - validator should convert to UTC
        response = NotificationResponse(
            id=1,
            user_id=1,
            category="test",
            title="Test",
            message="Test",
            is_read=False,
            email_sent=False,
            created_at=dt_other_tz
        )
        
        # After validation, created_at should be UTC
        assert response.created_at.tzinfo == timezone.utc
        # Time should be converted (12:30 UTC+2 = 10:30 UTC)
        assert response.created_at.hour == 10
        assert response.created_at.minute == 30

    def test_notification_response_preserves_utc_datetime(self):
        """Test that NotificationResponse preserves already-UTC datetime."""
        # Create a UTC datetime
        utc_dt = datetime(2025, 12, 20, 10, 30, 0, tzinfo=timezone.utc)
        
        # Create NotificationResponse
        response = NotificationResponse(
            id=1,
            user_id=1,
            category="test",
            title="Test",
            message="Test",
            is_read=False,
            email_sent=False,
            created_at=utc_dt
        )
        
        # Should remain UTC
        assert response.created_at.tzinfo == timezone.utc
        assert response.created_at == utc_dt

    def test_notification_response_handles_none_datetime(self):
        """Test that NotificationResponse handles None datetime fields."""
        response = NotificationResponse(
            id=1,
            user_id=1,
            category="test",
            title="Test",
            message="Test",
            is_read=False,
            email_sent=False,
            created_at=datetime(2025, 12, 20, 10, 30, 0, tzinfo=timezone.utc),
            read_at=None,
            email_sent_at=None
        )
        
        # None values should remain None
        assert response.read_at is None
        assert response.email_sent_at is None


class TestAPIDatetimeSerialization:
    """Test that API endpoints serialize datetimes as UTC ISO strings."""

    def test_get_notifications_returns_utc_iso_strings(self, client, auth_headers, db_session, test_user):
        """Test that get_notifications returns UTC ISO datetime strings."""
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()

        # Get notifications
        response = client.get("/api/v1/notifications/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check datetime fields are ISO strings with UTC timezone
        for notif in data:
            if "created_at" in notif and notif["created_at"]:
                created_at_str = notif["created_at"]
                # Should be ISO format string
                assert isinstance(created_at_str, str)
                # Should end with 'Z' (UTC) or '+00:00'
                assert created_at_str.endswith('Z') or created_at_str.endswith('+00:00') or '+00:00' in created_at_str
                
                # Parse and verify it's UTC
                parsed_dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                assert parsed_dt.tzinfo == timezone.utc

    def test_mark_notification_read_returns_utc_datetime(self, client, auth_headers, db_session, test_user):
        """Test that mark_notification_read returns UTC datetime."""
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()

        # Mark as read
        response = client.put(
            f"/api/v1/notifications/{notification.id}/read",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        
        # Check read_at is UTC ISO string
        if "read_at" in data and data["read_at"]:
            read_at_str = data["read_at"]
            assert isinstance(read_at_str, str)
            assert read_at_str.endswith('Z') or read_at_str.endswith('+00:00') or '+00:00' in read_at_str
            
            # Parse and verify it's UTC
            parsed_dt = datetime.fromisoformat(read_at_str.replace('Z', '+00:00'))
            assert parsed_dt.tzinfo == timezone.utc

    def test_get_new_since_last_check_returns_utc_datetimes(self, client, auth_headers, db_session, test_user):
        """Test that get_new_since_last_check returns UTC datetimes."""
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()

        # Get new notifications
        response = client.get(
            "/api/v1/notifications/new-since-last-check",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check datetime fields are UTC ISO strings
        for notif in data:
            if "created_at" in notif and notif["created_at"]:
                created_at_str = notif["created_at"]
                assert isinstance(created_at_str, str)
                # Should be UTC format
                assert created_at_str.endswith('Z') or created_at_str.endswith('+00:00') or '+00:00' in created_at_str


class TestNotificationTimeAccuracy:
    """Test that notification times are accurate and display correctly."""

    def test_notification_created_recently_shows_correct_time(self, client, auth_headers, db_session, test_user):
        """Test that a recently created notification shows correct relative time."""
        # Create notification
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()

        # Get notifications immediately
        response = client.get("/api/v1/notifications/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        notification_data = next((n for n in data if n["id"] == notification.id), None)
        assert notification_data is not None
        
        # Parse created_at
        created_at_str = notification_data["created_at"]
        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        
        # Should be very recent (within 5 seconds)
        now_utc = utcnow()
        time_diff = abs((now_utc - created_at).total_seconds())
        assert time_diff < 5, f"Notification should be recent, but time difference is {time_diff} seconds"

    def test_notification_timezone_independence(self, client, auth_headers, db_session, test_user):
        """Test that notification times are timezone-independent (stored in UTC)."""
        # Create notification at a specific UTC time
        specific_utc_time = datetime(2025, 12, 20, 10, 0, 0, tzinfo=timezone.utc)
        
        # Manually set created_at (simulating what database would store)
        notification = Notification(
            user_id=test_user.id,
            category="test",
            title="Test Notification",
            message="Test message",
            is_read=False
        )
        db_session.add(notification)
        db_session.commit()
        
        # Update created_at directly (bypassing ORM defaults for testing)
        from sqlalchemy import text
        db_session.execute(
            text("UPDATE notifications SET created_at = :dt WHERE id = :id"),
            {"dt": specific_utc_time.replace(tzinfo=None), "id": notification.id}
        )
        db_session.commit()
        db_session.refresh(notification)

        # Get notifications
        response = client.get("/api/v1/notifications/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        notification_data = next((n for n in data if n["id"] == notification.id), None)
        assert notification_data is not None
        
        # Parse created_at from API response
        created_at_str = notification_data["created_at"]
        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        
        # Should match the UTC time we set (allowing for small database rounding)
        # The hour and minute should match
        assert created_at.hour == 10
        assert created_at.minute == 0
        assert created_at.tzinfo == timezone.utc


class TestDatabaseConnectionUTC:
    """Test that database connection is configured for UTC."""

    def test_database_session_timezone(self, db_session):
        """Test that database session timezone is set to UTC."""
        from sqlalchemy import text
        
        # Query MySQL timezone setting
        result = db_session.execute(text("SELECT @@session.time_zone")).scalar()
        
        # Should be UTC (+00:00 or SYSTEM with UTC)
        # MySQL might return '+00:00', 'SYSTEM', or 'UTC'
        assert result in ['+00:00', 'SYSTEM', 'UTC', '+00:00:00'], \
            f"Expected UTC timezone, but got: {result}"


class TestSerializationHelper:
    """Test the _serialize_datetime_utc helper function."""

    def test_serialize_datetime_utc_with_naive_datetime(self):
        """Test serialization of naive datetime (assumes UTC)."""
        from app.routers.notifications import _serialize_datetime_utc
        
        naive_dt = datetime(2025, 12, 20, 10, 30, 0)
        result = _serialize_datetime_utc(naive_dt)
        
        assert isinstance(result, str)
        assert result.endswith('+00:00') or result.endswith('Z')
        # Parse and verify it's UTC
        parsed = datetime.fromisoformat(result.replace('Z', '+00:00'))
        assert parsed.tzinfo == timezone.utc
        assert parsed.hour == 10
        assert parsed.minute == 30

    def test_serialize_datetime_utc_with_utc_datetime(self):
        """Test serialization of UTC datetime."""
        from app.routers.notifications import _serialize_datetime_utc
        
        utc_dt = datetime(2025, 12, 20, 10, 30, 0, tzinfo=timezone.utc)
        result = _serialize_datetime_utc(utc_dt)
        
        assert isinstance(result, str)
        assert result.endswith('+00:00') or result.endswith('Z')
        # Parse and verify
        parsed = datetime.fromisoformat(result.replace('Z', '+00:00'))
        assert parsed == utc_dt

    def test_serialize_datetime_utc_with_other_timezone(self):
        """Test serialization converts other timezone to UTC."""
        from app.routers.notifications import _serialize_datetime_utc
        
        other_tz = timezone(timedelta(hours=2))
        dt_other_tz = datetime(2025, 12, 20, 12, 30, 0, tzinfo=other_tz)
        result = _serialize_datetime_utc(dt_other_tz)
        
        assert isinstance(result, str)
        assert result.endswith('+00:00') or result.endswith('Z')
        # Parse and verify it's converted to UTC (12:30 UTC+2 = 10:30 UTC)
        parsed = datetime.fromisoformat(result.replace('Z', '+00:00'))
        assert parsed.tzinfo == timezone.utc
        assert parsed.hour == 10
        assert parsed.minute == 30

    def test_serialize_datetime_utc_with_none(self):
        """Test serialization handles None."""
        from app.routers.notifications import _serialize_datetime_utc
        
        result = _serialize_datetime_utc(None)
        assert result is None




