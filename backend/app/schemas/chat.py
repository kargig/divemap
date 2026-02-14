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
    session_id: Optional[str] = None # For persistence
    user_location: Optional[Tuple[float, float]] = None # (lat, lon)
    context_entity_id: Optional[int] = None
    context_entity_type: Optional[str] = None # 'dive_site', 'diving_center', etc.

class IntentType(str, Enum):
    DISCOVERY = "discovery"      # "Find dive sites..."
    PERSONAL_RECOMMENDATION = "personal_recommendation" # "Where should I go diving?"
    CONTEXT_QA = "context_qa"    # "How deep is this?"
    KNOWLEDGE = "knowledge"      # "What is PADI?"
    COMPARISON = "comparison"    # "Difference between PADI and SSI"
    GEAR_RENTAL = "gear_rental"  # "How much for a tank?"
    CHIT_CHAT = "chit_chat"      # "Hello"
    LOGBOOK_DRAFT = "logbook_draft" # "Log a dive..."

class SearchIntent(BaseModel):
    intent_type: IntentType
    keywords: List[str] = []
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: Optional[str] = None # YYYY-MM-DD
    time: Optional[str] = None # HH:MM
    date_range: Optional[List[str]] = None # [YYYY-MM-DD, YYYY-MM-DD]
    difficulty_level: Optional[int] = None # 1-4
    context_entity_id: Optional[int] = None
    context_entity_type: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    message_id: str # UUID to link feedback
    session_id: str # UUID for history
    sources: List[Dict] = [] # Metadata about retrieved entities
    intent: Optional[SearchIntent] = None # For debugging/admin

class ChatFeedbackCreate(BaseModel):
    message_id: str
    query: Optional[str] = None
    response: Optional[str] = None
    debug_data: Optional[Dict] = None
    rating: bool # True for Up, False for Down
    category: Optional[str] = None # "accuracy", "tone", "safety"
    comments: Optional[str] = None

class ChatUser(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    
    class Config:
        from_attributes = True

class ChatFeedbackResponse(BaseModel):
    id: int
    message_id: Optional[str]
    user_id: Optional[int]
    user: Optional[ChatUser] = None
    query: Optional[str]
    response: Optional[str]
    debug_data: Optional[Dict]
    rating: bool
    category: Optional[str]
    comments: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatFeedbackStats(BaseModel):
    total_feedback: int
    positive_count: int
    negative_count: int
    satisfaction_rate: float
    category_breakdown: Dict[str, int]

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    debug_data: Optional[Dict] = None
    created_at: datetime
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    tokens_cached: Optional[int] = None
    tokens_total: Optional[int] = None
    
    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    id: str
    user_id: int
    user: Optional[ChatUser] = None
    created_at: datetime
    updated_at: datetime
    total_tokens: int = 0
    
    class Config:
        from_attributes = True

class ChatSessionDetailResponse(ChatSessionResponse):
    messages: List[ChatMessageResponse] = []
