import pytest
from fastapi import status
from app.models import ChatFeedback

class TestAdminChat:
    """Test Admin Chat endpoints."""

    def test_get_feedback_empty(self, client, admin_headers):
        """Test getting feedback when table is empty."""
        response = client.get("/api/v1/admin/chat/feedback", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_feedback_stats_empty(self, client, admin_headers):
        """Test getting feedback stats when table is empty."""
        response = client.get("/api/v1/admin/chat/feedback/stats", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_feedback"] == 0
        assert data["positive_count"] == 0
        assert data["negative_count"] == 0
        assert data["satisfaction_rate"] == 0
        assert data["category_breakdown"] == {}

    def test_get_feedback_with_data(self, client, admin_headers, db_session, test_user):
        """Test getting feedback with data."""
        feedback = ChatFeedback(
            user_id=test_user.id,
            message_id="msg-1",
            rating=True,
            category="accuracy",
            comments="Good",
            debug_data={"intent": "discovery"}
        )
        db_session.add(feedback)
        db_session.commit()

        response = client.get("/api/v1/admin/chat/feedback", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["message_id"] == "msg-1"
        assert data[0]["rating"] is True
        assert data[0]["debug_data"] == {"intent": "discovery"}
