from datetime import timedelta
import pytest
from unittest.mock import patch
from app.services.ses_service import SESService
from app.models import User, NotificationPreference
from app.auth import create_access_token

def test_ses_service_blocks_invalid_emails():
    ses = SESService()
    with patch.object(ses, '_create_ses_client') as mock_client:
        result = ses.send_email(
            to_email="testuser@facebook.divemap.invalid",
            subject="Test Subject",
            html_body="<p>Test</p>"
        )
        assert result is False
        mock_client.assert_not_called()

def test_notification_preference_blocks_enabling_email_for_synthetic_user(client, db_session):
    user = User(
        username="fb_tester",
        email="fb_tester@facebook.divemap.invalid",
        password_hash="dummy",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    pref = NotificationPreference(
        user_id=user.id,
        category="system",
        enable_website=True,
        enable_email=False
    )
    db_session.add(pref)
    db_session.commit()

    token = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=15))
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        f"/api/v1/notifications/preferences/system",
        json={"enable_email": True},
        headers=headers
    )
    assert response.status_code == 400
    assert "synthetic/social account" in response.json()["detail"]
