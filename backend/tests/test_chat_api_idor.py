import pytest
from fastapi import status
from unittest.mock import patch, AsyncMock
import uuid
from app.models import ChatSession

class TestChatAPIIDOR:
    
    @pytest.mark.asyncio
    @patch("app.services.chat.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_chat_session_message_idor(self, mock_openai, client, auth_headers_other_user, test_user, db_session):
        """Test that a user cannot append messages to another user's chat session."""
        # Create a session belonging to test_user (User A)
        session_id = str(uuid.uuid4())
        session = ChatSession(id=session_id, user_id=test_user.id)
        db_session.add(session)
        db_session.commit()
        
        mock_openai.side_effect = [("Hi", {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15})]
        
        # Try to use this session_id to send a message as auth_headers_other_user (User B)
        response = client.post("/api/v1/chat/message", json={
            "message": "Hi",
            "history": [],
            "session_id": session_id
        }, headers=auth_headers_other_user)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_chat_session_detail_idor(self, client, auth_headers_other_user, test_user, db_session):
        """Test that a user cannot view the transcript of another user's chat session."""
        # Create a session belonging to test_user (User A)
        session_id = str(uuid.uuid4())
        session = ChatSession(id=session_id, user_id=test_user.id)
        db_session.add(session)
        db_session.commit()
        
        # Try to access the session details as auth_headers_other_user (User B)
        response = client.get(f"/api/v1/chat/sessions/{session_id}", headers=auth_headers_other_user)
        
        # Should return 404 to avoid leaking the existence of the session entirely
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Chat session not found" in response.json()["detail"]
