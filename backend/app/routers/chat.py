from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List

from app.database import get_db
from app.auth import get_current_user, get_current_user_optional
from app.models import User, ChatFeedback, ChatSession, ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse, ChatFeedbackCreate, ChatSessionResponse, ChatSessionDetailResponse
from app.services.chat import ChatService
from app.limiter import limiter, skip_rate_limit_for_admin
from app.utils import get_client_ip
from sqlalchemy import desc, func

router = APIRouter()

@router.post("/message", response_model=ChatResponse)
@skip_rate_limit_for_admin("5/minute")
async def send_message(
    request: Request,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Main chatbot interaction endpoint.
    Processes natural language queries and returns relevant diving information.
    """
    # Populate client IP for geolocation context
    chat_request.client_ip = get_client_ip(request)
    
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
        query=feedback.query,
        response=feedback.response,
        debug_data=feedback.debug_data,
        rating=feedback.rating,
        category=feedback.category,
        comments=feedback.comments
    )
    db.add(new_feedback)
    db.commit()
    return {"message": "Feedback recorded successfully"}

@router.get("/last-activity")
async def get_last_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the timestamp of the user's last interaction with the AI assistant.
    """
    msg = db.query(ChatMessage).join(ChatSession).filter(
        ChatSession.user_id == current_user.id
    ).order_by(desc(ChatMessage.created_at)).first()

    if msg:
        return {"last_activity_at": msg.created_at.isoformat()}
    return {"last_activity_at": None}

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_my_chat_sessions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the chat sessions history for the current user.
    """
    token_subquery = db.query(
        ChatMessage.session_id,
        func.sum(ChatMessage.tokens_total).label("total_tokens")
    ).group_by(ChatMessage.session_id).subquery()

    query = db.query(ChatSession, func.coalesce(token_subquery.c.total_tokens, 0))\
        .outerjoin(token_subquery, ChatSession.id == token_subquery.c.session_id)\
        .filter(ChatSession.user_id == current_user.id)

    results = query.order_by(desc(ChatSession.updated_at)).offset(offset).limit(limit).all()

    response = []
    for session, total_tokens in results:
        session.total_tokens = int(total_tokens) if total_tokens else 0
        response.append(session)

    return response

@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_my_session_detail(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get full transcript for a specific chat session of the current user.
    """
    session = db.query(ChatSession).options(joinedload(ChatSession.messages)).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session.total_tokens = sum((msg.tokens_total or 0) for msg in session.messages)
    return session
