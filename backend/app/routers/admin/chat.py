from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.auth import get_current_admin_user
from app.models import User, ChatFeedback, ChatSession, ChatMessage as ChatMessageModel
from app.schemas.chat import (
    ChatFeedbackResponse, ChatFeedbackStats, 
    ChatSessionResponse, ChatSessionDetailResponse
)

router = APIRouter()

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(
    user_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    List all chat sessions.
    """
    # Subquery to calculate total tokens per session
    token_subquery = db.query(
        ChatMessageModel.session_id,
        func.sum(ChatMessageModel.tokens_total).label("total_tokens")
    ).group_by(ChatMessageModel.session_id).subquery()

    query = db.query(ChatSession, func.coalesce(token_subquery.c.total_tokens, 0))\
        .outerjoin(token_subquery, ChatSession.id == token_subquery.c.session_id)\
        .options(joinedload(ChatSession.user))

    if user_id:
        query = query.filter(ChatSession.user_id == user_id)
        
    results = query.order_by(desc(ChatSession.updated_at)).offset(offset).limit(limit).all()
    
    # Map results to response
    response = []
    for session, total_tokens in results:
        # Attach the calculated value (Pydantic will pick it up)
        session.total_tokens = int(total_tokens) if total_tokens else 0
        response.append(session)
        
    return response

@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_session_detail(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get full transcript for a chat session.
    """
    session = db.query(ChatSession).options(joinedload(ChatSession.user), joinedload(ChatSession.messages)).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Calculate total tokens from messages
    session.total_tokens = sum((msg.tokens_total or 0) for msg in session.messages)
    
    return session

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Delete a chat session and all its messages.
    """
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    db.delete(session)
    db.commit()
    return None

@router.get("/feedback", response_model=List[ChatFeedbackResponse])
async def get_chat_feedback(
    rating: Optional[int] = Query(None, description="Filter by rating (1 for positive, -1 for negative)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get list of chat feedback for admin review.
    """
    query = db.query(ChatFeedback).options(joinedload(ChatFeedback.user))
    
    if rating is not None:
        query = query.filter(ChatFeedback.rating == rating)
    
    if category:
        query = query.filter(ChatFeedback.category == category)
        
    return query.order_by(desc(ChatFeedback.created_at)).offset(offset).limit(limit).all()

@router.get("/feedback/stats", response_model=ChatFeedbackStats)
async def get_chat_feedback_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get summary statistics for chat feedback.
    """
    total = db.query(func.count(ChatFeedback.id)).scalar()
    positive = db.query(func.count(ChatFeedback.id)).filter(ChatFeedback.rating == True).scalar()
    negative = db.query(func.count(ChatFeedback.id)).filter(ChatFeedback.rating == False).scalar()
    
    # Category breakdown for negative feedback
    categories = db.query(
        ChatFeedback.category, 
        func.count(ChatFeedback.id)
    ).filter(ChatFeedback.rating == False).group_by(ChatFeedback.category).all()
    
    category_breakdown = {cat or "unspecified": count for cat, count in categories}
    
    # Satisfaction rate
    satisfaction_rate = (positive / total * 100) if total > 0 else 0
    
    return {
        "total_feedback": total,
        "positive_count": positive,
        "negative_count": negative,
        "satisfaction_rate": round(satisfaction_rate, 2),
        "category_breakdown": category_breakdown
    }

@router.get("/feedback/{feedback_id}", response_model=ChatFeedbackResponse)
async def get_feedback_detail(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get detailed information for a specific feedback entry.
    """
    feedback = db.query(ChatFeedback).options(joinedload(ChatFeedback.user)).filter(ChatFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return feedback

@router.delete("/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Delete a chat feedback entry.
    """
    feedback = db.query(ChatFeedback).filter(ChatFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    db.delete(feedback)
    db.commit()
    return None
