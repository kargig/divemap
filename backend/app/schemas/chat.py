from pydantic import BaseModel, Field
from typing import Optional, List, Union, Literal, Dict, Tuple
from datetime import datetime, date
from enum import Enum

class ChatMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ChatMessage(BaseModel):
    role: ChatMessageRole
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    user_location: Optional[Tuple[float, float]] = None # (lat, lon)
    context_entity_id: Optional[int] = None
    context_entity_type: Optional[str] = None # 'dive_site', 'diving_center', etc.

class IntentType(str, Enum):
    DISCOVERY = "discovery"      # "Find dive sites..."
    CONTEXT_QA = "context_qa"    # "How deep is this?"
    KNOWLEDGE = "knowledge"      # "What is PADI?"
    CHIT_CHAT = "chit_chat"      # "Hello"
    LOGBOOK_DRAFT = "logbook_draft" # "Log a dive..."

class SearchIntent(BaseModel):
    intent_type: IntentType
    keywords: List[str] = []
    location: Optional[str] = None
    date: Optional[str] = None # YYYY-MM-DD
    date_range: Optional[List[str]] = None # [YYYY-MM-DD, YYYY-MM-DD]
    difficulty_level: Optional[int] = None # 1-4
    context_entity_id: Optional[int] = None
    context_entity_type: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    message_id: str # UUID to link feedback
    sources: List[Dict] = [] # Metadata about retrieved entities
    intent: Optional[SearchIntent] = None # For debugging/admin

class ChatFeedbackCreate(BaseModel):
    message_id: str
    rating: bool # True for Up, False for Down
    category: Optional[str] = None # "accuracy", "tone", "safety"
    comments: Optional[str] = None
