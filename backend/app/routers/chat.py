from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user_optional
from app.models import User, ChatFeedback
from app.schemas.chat import ChatRequest, ChatResponse, ChatFeedbackCreate
from app.services.chat_service import ChatService
from app.limiter import limiter

router = APIRouter()

@router.post("/message", response_model=ChatResponse)
@limiter.limit("5/minute")
async def send_message(
    request: Request,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Main chatbot interaction endpoint.
    Processes natural language queries and returns relevant diving information.
    """
    chat_service = ChatService(db)
    try:
        response = await chat_service.process_message(chat_request, current_user)
        return response
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Chat processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat message."
        )

@router.post("/feedback", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    feedback: ChatFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Submit user feedback (thumbs up/down) for a chatbot response.
    """
    new_feedback = ChatFeedback(
        message_id=feedback.message_id,
        user_id=current_user.id if current_user else None,
        rating=feedback.rating,
        category=feedback.category,
        comments=feedback.comments
    )
    db.add(new_feedback)
    db.commit()
    return {"message": "Feedback submitted successfully"}
