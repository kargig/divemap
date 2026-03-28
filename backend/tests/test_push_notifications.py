import pytest
from sqlalchemy.orm import Session
from app.models import User, PushSubscription, Notification
from app.services.notification_service import NotificationService
from unittest.mock import MagicMock, patch

def test_subscribe_push(client, auth_headers, db_session: Session, test_user):
    payload = {
        "endpoint": "https://fcm.googleapis.com/test",
        "p256dh": "pubkey",
        "auth": "authsecret"
    }
    response = client.post("/api/v1/notifications/push/subscribe", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["endpoint"] == payload["endpoint"]
    assert data["user_id"] == test_user.id
    
    # Check DB
    sub = db_session.query(PushSubscription).filter(PushSubscription.user_id == test_user.id).first()
    assert sub is not None
    assert sub.endpoint == payload["endpoint"]

def test_unsubscribe_push(client, auth_headers, db_session: Session, test_user):
    # Setup sub
    sub = PushSubscription(
        user_id=test_user.id,
        endpoint="https://fcm.googleapis.com/to_delete",
        p256dh="key",
        auth="secret"
    )
    db_session.add(sub)
    db_session.commit()
    
    response = client.delete(f"/api/v1/notifications/push/unsubscribe?endpoint={sub.endpoint}", headers=auth_headers)
    assert response.status_code == 200
    
    # Check DB
    assert db_session.query(PushSubscription).filter(PushSubscription.endpoint == sub.endpoint).first() is None

def test_internal_get_subscriptions(client, db_session: Session, test_user):
    # Setup sub
    sub = PushSubscription(
        user_id=test_user.id,
        endpoint="https://fcm.googleapis.com/internal_test",
        p256dh="key",
        auth="secret"
    )
    db_session.add(sub)
    db_session.commit()
    
    # Set Lambda API Key for test
    with patch("app.routers.notifications.LAMBDA_API_KEY", "test_key"):
        headers = {"X-API-Key": "test_key"}
        response = client.get(f"/api/v1/notifications/internal/push-subscriptions/{test_user.id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["endpoint"] == sub.endpoint

def test_internal_fail_subscription(client, db_session: Session, test_user):
    # Setup sub
    sub = PushSubscription(
        user_id=test_user.id,
        endpoint="https://fcm.googleapis.com/fail_test",
        p256dh="key",
        auth="secret",
        fail_count=9
    )
    db_session.add(sub)
    db_session.commit()
    
    with patch("app.routers.notifications.LAMBDA_API_KEY", "test_key"):
        headers = {"X-API-Key": "test_key"}
        # 10th failure should delete it
        response = client.put(f"/api/v1/notifications/internal/push-subscriptions/{sub.id}/fail", headers=headers)
        assert response.status_code == 200
        assert "deleted" in response.json()["message"]
        
        assert db_session.query(PushSubscription).filter(PushSubscription.id == sub.id).first() is None

@patch("app.services.sqs_service.SQSService.send_push_tasks")
def test_notification_service_triggers_push(mock_send, db_session: Session, test_user):
    # Setup sub
    sub = PushSubscription(
        user_id=test_user.id,
        endpoint="https://fcm.googleapis.com/trigger_test",
        p256dh="key",
        auth="secret"
    )
    db_session.add(sub)
    
    # Setup preference
    from app.models import NotificationPreference
    pref = NotificationPreference(
        user_id=test_user.id,
        category="new_dive_sites",
        enable_website=True
    )
    db_session.add(pref)
    db_session.commit()
    
    service = NotificationService()
    # Mocking sqs_service.sqs_available
    service.sqs_service.sqs_available = True
    
    notification = MagicMock(spec=Notification)
    notification.id = 123
    notification.user_id = test_user.id
    notification.category = "new_dive_sites"
    notification.link_url = "/test"
    
    service._queue_push_notifications(notification, test_user, db_session)
    
    assert mock_send.called
    args = mock_send.call_args[0][0]
    assert len(args) == 1
    assert args[0]["subscription_id"] == sub.id
    assert args[0]["payload"]["tag"] == "new_dive_sites"

@patch("app.services.sqs_service.SQSService.send_push_tasks", return_value=1)
def test_internal_notify_chat_message(mock_send, client, db_session: Session, test_user):
    # Setup room and members
    from app.models import UserChatRoom, UserChatRoomMember
    room = UserChatRoom(is_group=False, encrypted_dek="test_dek")
    db_session.add(room)
    db_session.commit()
    
    member = UserChatRoomMember(room_id=room.id, user_id=test_user.id, role="MEMBER")
    db_session.add(member)
    db_session.commit()
    
    # Setup push sub for member
    sub = PushSubscription(
        user_id=test_user.id,
        endpoint="https://fcm.googleapis.com/chat_test",
        p256dh="key",
        auth="secret"
    )
    db_session.add(sub)
    db_session.commit()
    
    with patch("app.routers.notifications.LAMBDA_API_KEY", "test_key"):
        headers = {"X-API-Key": "test_key"}
        # sender_id is some other ID
        response = client.post(
            f"/api/v1/notifications/internal/notify-chat-message?room_id={room.id}&sender_id=999&message_id=888", 
            headers=headers
        )
        if response.status_code != 200:
            print(f"ERROR BODY: {response.text}")
        assert response.status_code == 200
        assert response.json()["notifications_created"] == 1
        
        # Check that a notification record was created
        from app.models import Notification
        notif = db_session.query(Notification).filter(Notification.user_id == test_user.id).first()
        assert notif is not None
        assert notif.category == "user_chat_message"
        
        # Verify the SQS mock was called indicating the pipeline worked
        assert mock_send.called

