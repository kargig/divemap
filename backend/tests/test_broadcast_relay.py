import pytest
import base64
from datetime import date
from fastapi import status
from unittest.mock import MagicMock, patch
from app.models import ParsedDiveTrip, UserChatRoom, UserChatRoomMember, User, DivingCenterFollower, UserChatMessage

class TestBroadcastRelay:
    
    @pytest.fixture(autouse=True)
    def setup_env(self, monkeypatch):
        # Generate a valid 32-byte base64-encoded key for Fernet
        valid_key = base64.urlsafe_b64encode(b"a" * 32).decode()
        monkeypatch.setenv("CHAT_MASTER_KEY", valid_key)
        monkeypatch.setenv("LAMBDA_API_KEY", "test-lambda-api-key")
        
        # Also patch the global in notifications router for immediate pick-up
        with patch("app.routers.notifications.LAMBDA_API_KEY", "test-lambda-api-key"):
            yield

    def test_get_broadcast_targets_pagination(self, client, admin_headers, db_session, test_diving_center, test_user):
        """Test the internal paginated API for broadcast targets."""
        # 1. Setup: Create a broadcast room and multiple followers
        room = UserChatRoom(
            id="test-room-relay",
            diving_center_id=test_diving_center.id,
            is_broadcast=True,
            created_by_id=test_user.id,
            encrypted_dek="dummy-dek-string"
        )
        db_session.add(room)
        
        # Add 5 followers
        for i in range(5):
            u = User(username=f"follower_{i}", email=f"f_{i}@example.com", password_hash="...", enabled=True)
            db_session.add(u)
            db_session.flush()
            member = UserChatRoomMember(room_id=room.id, user_id=u.id, role="MEMBER")
            db_session.add(member)
        
        db_session.commit()
        
        # 2. Test first page (limit 2)
        response = client.get(
            f"/api/v1/notifications/internal/broadcast-targets/{room.id}?sender_id={test_user.id}&offset=0&limit=2",
            headers={"X-API-Key": "test-lambda-api-key"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["targets"]) == 2
        assert data["has_more"] is True
        assert data["total_count"] == 5
        
        # 3. Test last page
        response = client.get(
            f"/api/v1/notifications/internal/broadcast-targets/{room.id}?sender_id={test_user.id}&offset=4&limit=2",
            headers={"X-API-Key": "test-lambda-api-key"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["targets"]) == 1
        assert data["has_more"] is False

    def test_broadcast_trip_triggers_relay_task(self, client, admin_headers, db_session, test_diving_center):
        """Test that broadcasting a trip now sends the relay task to SQS."""
        # Setup trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 6, 1),
            diving_center_id=test_diving_center.id,
            trip_description="Relay Test Trip"
        )
        db_session.add(trip)
        db_session.commit()

        # Mock SQSService to verify the call
        with patch("app.services.sqs_service.SQSService") as mock_sqs_class:
            mock_sqs_instance = mock_sqs_class.return_value
            mock_sqs_instance.sqs_available = True
            
            response = client.post(
                f"/api/v1/diving-centers/{test_diving_center.id}/broadcast",
                json={"trip_id": trip.id},
                headers=admin_headers
            )
            
            assert response.status_code == status.HTTP_201_CREATED
            # Verify send_broadcast_relay_task was called
            mock_sqs_instance.send_broadcast_relay_task.assert_called_once()
            args, kwargs = mock_sqs_instance.send_broadcast_relay_task.call_args
            assert kwargs['offset'] == 0
            assert kwargs['limit'] == 100

    def test_get_broadcast_context(self, client, db_session, test_diving_center, test_user):
        """Test the internal API for fetching broadcast metadata."""
        # Setup room and message
        room = UserChatRoom(
            id="context-room",
            diving_center_id=test_diving_center.id,
            is_broadcast=True,
            encrypted_dek="dummy-dek-string"
        )
        db_session.add(room)
        db_session.flush()
        
        msg = UserChatMessage(room_id=room.id, sender_id=test_user.id, content=b"...", message_type="TEXT")
        db_session.add(msg)
        db_session.commit()
        
        response = client.get(
            f"/api/v1/notifications/internal/broadcast-context/{msg.id}",
            headers={"X-API-Key": "test-lambda-api-key"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["center_name"] == test_diving_center.name
        assert data["sender_name"] == (test_user.name or test_user.username)

    def test_create_bulk_notifications(self, client, db_session, test_user):
        """Test the internal bulk creation API."""
        requests = [
            {"user_id": test_user.id, "category": "test", "title": "T1", "message": "M1"},
            {"user_id": test_user.id, "category": "test", "title": "T2", "message": "M2"}
        ]
        
        response = client.post(
            "/api/v1/notifications/internal/create-bulk",
            json=requests,
            headers={"X-API-Key": "test-lambda-api-key"}
        )
        
        assert response.status_code == 200
        assert response.json()["created_count"] == 2
