import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

from app.schemas.chat import SearchIntent, ChatMessage, ChatRequest, ChatResponse, IntentType
from app.models import ChatSession, ChatMessage as ChatMessageModel, User
from app.services.chat.intent_extractor import extract_search_intent
from app.services.chat.executors.dispatcher import execute_search_intent
from app.services.chat.response_generator import generate_response
from app.services.chat.weather_enricher import enrich_results_with_weather

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self, db: Session):
        self.db = db

    async def process_message(self, request: ChatRequest, current_user: Optional[User] = None) -> ChatResponse:
        """
        Main entry point for the chat service.
        """
        # 1. Get or create session
        if not request.session_id:
            request.session_id = str(uuid.uuid4())
            session = ChatSession(id=request.session_id, user_id=current_user.id if current_user else None)
            self.db.add(session)
            self.db.commit()
        
        # 2. Extract Intent
        intent, usage = await extract_search_intent(self.db, request)
        
        # 3. Execute Search
        results = execute_search_intent(self.db, intent, current_user)
        
        # Restore intermediate steps for backward compatibility with tests/frontend
        intermediate_steps = [{
            "action_type": "search",
            "parameters": intent.model_dump(exclude_none=True),
            "reasoning": f"Step 1: Executing search for {intent.intent_type}"
        }]
        
        # 4. Weather Integration
        ask_for_time = enrich_results_with_weather(
            db=self.db,
            results=results,
            intent_date=intent.date,
            intent_time=intent.time,
            intent_lat=intent.latitude,
            intent_lon=intent.longitude,
            intent_location=intent.location
        )
            
        # 5. Generate Response
        answer, usage_resp = await generate_response(
            db=self.db,
            request=request,
            intent=intent,
            results=results,
            ask_for_time=ask_for_time
        )
        
        # Merge usage data
        tokens_input = usage.get("prompt_tokens", 0) + usage_resp.get("prompt_tokens", 0)
        tokens_output = usage.get("completion_tokens", 0) + usage_resp.get("completion_tokens", 0)
        tokens_total = usage.get("total_tokens", 0) + usage_resp.get("total_tokens", 0)
        tokens_cached = usage.get("cached_tokens", 0) + usage_resp.get("cached_tokens", 0)
        
        # 5. Save message to DB
        new_msg = ChatMessageModel(
            session_id=request.session_id,
            role="user",
            content=request.message,
            debug_data=intent.model_dump()
        )
        self.db.add(new_msg)
        self.db.flush()
        
        message_id = str(uuid.uuid4())
        bot_msg = ChatMessageModel(
            session_id=request.session_id,
            role="assistant",
            content=answer,
            debug_data={
                "intent": intent.model_dump(),
                "sources": results,
                "message_id": message_id,
                "intermediate_steps": intermediate_steps
            },
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            tokens_total=tokens_total,
            tokens_cached=tokens_cached
        )
        self.db.add(bot_msg)
        self.db.commit()
        
        return ChatResponse(
            response=answer,
            message_id=message_id,
            session_id=request.session_id,
            intent=intent,
            sources=results,
            intermediate_steps=intermediate_steps
        )
