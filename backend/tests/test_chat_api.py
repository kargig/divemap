import pytest
from fastapi import status
from unittest.mock import patch, AsyncMock
import uuid
from types import SimpleNamespace
from app.schemas.chat import SearchIntent, IntentType

class TestChatAPI:
    """Test Chatbot endpoints."""

    @pytest.mark.asyncio
    @patch("app.services.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_send_message_success(self, mock_openai, client, auth_headers):
        """Test successful chat message interaction."""
        # Mock responses for intent extraction and response generation
        # extract_search_intent uses json_schema=SearchIntent, so we return an actual SearchIntent
        intent = SearchIntent(
            intent_type=IntentType.DISCOVERY,
            keywords=["wreck"],
            location="Athens"
        )
        
        mock_openai.side_effect = [
            # First call: extract_search_intent
            (intent, {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}),
            # Second call: generate_response
            ("I found some great wreck dives near Athens for you! [Alekos Wreck](/dive-sites/1)", {"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30})
        ]

        response = client.post("/api/v1/chat/message", json={
            "message": "Find wreck dives in Athens",
            "history": []
        }, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "response" in data
        assert "message_id" in data
        assert "intent" in data
        assert data["intent"]["intent_type"] == "discovery"
        assert "wreck" in data["intent"]["keywords"]

    def test_submit_feedback_success(self, client, test_user):
        """Test submitting feedback for a chat message."""
        message_id = str(uuid.uuid4())
        
        response = client.post("/api/v1/chat/feedback", json={
            "message_id": message_id,
            "rating": True,
            "category": "accuracy",
            "comments": "Great answer!"
        })

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["message"] == "Feedback submitted successfully"

    def test_admin_get_feedback_unauthorized(self, client, auth_headers):
        """Test that regular users cannot access admin feedback (Forbidden)."""
        response = client.get("/api/v1/admin/chat/feedback", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_get_feedback_success(self, client, admin_headers):
        """Test that admin can access feedback dashboard."""
        # First, create some feedback
        message_id = str(uuid.uuid4())
        client.post("/api/v1/chat/feedback", json={
            "message_id": message_id,
            "rating": False,
            "category": "tone",
            "comments": "Too robotic"
        })

        response = client.get("/api/v1/admin/chat/feedback", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["category"] == "tone"
        assert data[0]["rating"] is False

    def test_admin_get_feedback_stats(self, client, admin_headers):
        """Test getting feedback statistics."""
        response = client.get("/api/v1/admin/chat/feedback/stats", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_feedback" in data
        assert "satisfaction_rate" in data
        assert "category_breakdown" in data

    @pytest.mark.asyncio
    @patch("app.services.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_admin_get_sessions(self, mock_openai, client, admin_headers, test_user):
        """Test admin session listing and transcript view."""
        # 1. Create a session by sending a message
        intent = SearchIntent(intent_type=IntentType.CHIT_CHAT)
        mock_openai.side_effect = [
            (intent, {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}),
            ("Hello!", {"prompt_tokens": 20, "completion_tokens": 10, "total_tokens": 30})
        ]
        
        # Use auth_headers for the user sending the message
        from app.auth import create_access_token
        user_token = create_access_token(data={"sub": test_user.username})
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        chat_resp = client.post("/api/v1/chat/message", json={
            "message": "Hi",
            "history": []
        }, headers=user_headers)
        
        session_id = chat_resp.json()["session_id"]

        # 2. Admin list sessions
        response = client.get("/api/v1/admin/chat/sessions", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert any(s["id"] == session_id for s in data)

        # 3. Admin get session detail
        response = client.get(f"/api/v1/admin/chat/sessions/{session_id}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == session_id
        assert len(data["messages"]) >= 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"
