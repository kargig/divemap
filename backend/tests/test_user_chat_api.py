import pytest
from unittest import mock
from cryptography.fernet import Fernet
from app.models import UserChatRoom, UserChatRoomMember, UserChatMessage

@pytest.fixture
def mock_master_key():
    # Provide a consistent master key for tests
    key = Fernet.generate_key().decode('utf-8')
    with mock.patch("os.getenv", side_effect=lambda k, default=None: key if k == "CHAT_MASTER_KEY" else default):
        yield key

def test_create_dm_room(client, auth_headers, test_user_other, mock_master_key):
    # Test creating a DM with another user
    response = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={
            "is_group": False,
            "participant_ids": [test_user_other.id]
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_group"] is False
    assert "id" in data
    room_id = data["id"]
    
    # Check that creating the exact same DM again returns the same room ID
    response2 = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={
            "is_group": False,
            "participant_ids": [test_user_other.id]
        }
    )
    assert response2.status_code == 201
    assert response2.json()["id"] == room_id

def test_create_group_room(client, auth_headers, test_user_other, test_admin_user, mock_master_key):
    # Test creating a Group chat
    response = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={
            "is_group": True,
            "name": "Test Dive Group",
            "participant_ids": [test_user_other.id, test_admin_user.id]
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_group"] is True
    assert data["name"] == "Test Dive Group"

def test_send_and_list_messages(client, auth_headers, test_user, test_user_other, mock_master_key):
    # 1. Create a room
    room_res = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={
            "is_group": False,
            "participant_ids": [test_user_other.id]
        }
    )
    room_id = room_res.json()["id"]
    
    # 2. Send a message
    with mock.patch("app.routers.user_chat.sqs_service.sqs_client") as mock_sqs:
        msg_res = client.post(
            f"/api/v1/user-chat/rooms/{room_id}/messages",
            headers=auth_headers,
            json={
                "content": "Hello, this is a secret message!"
            }
        )
        assert msg_res.status_code == 201
        msg_data = msg_res.json()
        assert msg_data["content"] == "Hello, this is a secret message!"
        assert msg_data["sender_id"] == test_user.id
        msg_id = msg_data["id"]
        
    # 3. Edit the message
    edit_res = client.put(
        f"/api/v1/user-chat/messages/{msg_id}",
        headers=auth_headers,
        json={
            "content": "Hello, this is an edited message!"
        }
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["content"] == "Hello, this is an edited message!"
    assert edit_res.json()["is_edited"] is True

def test_list_chat_rooms(client, auth_headers, test_user_other, mock_master_key):
    # Create room and send message
    room_res = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={"is_group": False, "participant_ids": [test_user_other.id]}
    )
    room_id = room_res.json()["id"]
    
    client.post(
        f"/api/v1/user-chat/rooms/{room_id}/messages",
        headers=auth_headers,
        json={"content": "List check message"}
    )
    
    # List rooms
    res = client.get("/api/v1/user-chat/rooms", headers=auth_headers)
    assert res.status_code == 200
    rooms = res.json()
    assert len(rooms) >= 1
    # Find the room we just created
    target_room = next((r for r in rooms if r["id"] == room_id), None)
    assert target_room is not None
    assert "unread_count" in target_room

def test_get_messages_short_circuit(client, auth_headers, test_user_other, mock_master_key):
    # 1. Create room
    room_res = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={"is_group": False, "participant_ids": [test_user_other.id]}
    )
    room_id = room_res.json()["id"]
    
    # 2. Send message
    msg_res = client.post(
        f"/api/v1/user-chat/rooms/{room_id}/messages",
        headers=auth_headers,
        json={"content": "First message"}
    )
    msg_data = msg_res.json()
    
    # 3. Fetch without cursor -> gets message
    get_res = client.get(f"/api/v1/user-chat/rooms/{room_id}/messages", headers=auth_headers)
    assert get_res.status_code == 200
    assert len(get_res.json()) >= 1
    
    # 4. Fetch with cursor representing the future
    from datetime import datetime, timezone, timedelta
    future_time = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
    
    import urllib.parse
    future_time_encoded = urllib.parse.quote(future_time)
    get_res_304 = client.get(f"/api/v1/user-chat/rooms/{room_id}/messages?after_updated_at={future_time_encoded}", headers=auth_headers)
    assert get_res_304.status_code == 304, get_res_304.text

def test_mark_room_read(client, auth_headers, test_user_other, mock_master_key):
    room_res = client.post(
        "/api/v1/user-chat/rooms",
        headers=auth_headers,
        json={"is_group": False, "participant_ids": [test_user_other.id]}
    )
    room_id = room_res.json()["id"]
    
    res = client.put(f"/api/v1/user-chat/rooms/{room_id}/read", headers=auth_headers)
    assert res.status_code == 200
