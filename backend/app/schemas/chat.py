from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class ChatMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: ChatMessageRole
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    session_id: str | None = None  # For persistence
    user_location: tuple[float, float] | None = None  # (lat, lon)
    client_ip: str | None = None  # For IP-based geolocation
    map_context: dict[str, float] | None = None  # {lat, lng, zoom} from URL
    page_context: dict | None = None  # Rich context about the current page
    context_entity_id: int | None = None
    context_entity_type: str | None = None  # 'dive_site', 'diving_center', etc.


class IntentType(str, Enum):
    DISCOVERY = "discovery"  # "Find dive sites..."
    PERSONAL_RECOMMENDATION = "personal_recommendation"  # "Where should I go diving?"
    CONTEXT_QA = "context_qa"  # "How deep is this?"
    KNOWLEDGE = "knowledge"  # "What is PADI?"
    COMPARISON = "comparison"  # "Difference between PADI and SSI"
    GEAR_RENTAL = "gear_rental"  # "How much for a tank?"
    CAREER_PATH = "career_path"  # "What comes after Open Water?"
    MARINE_LIFE = "marine_life"  # "Where can I see seals?"
    CHIT_CHAT = "chit_chat"  # "Hello"
    LOGBOOK_DRAFT = "logbook_draft"  # "Log a dive..."
    CALCULATOR = "calculator"  # "MOD/SAC calculations"


class ChatIntermediateAction(BaseModel):
    action_type: Literal[
        "search", "resolve_location", "refine_intent", "final_answer", "tool_call"
    ]
    tool_name: str | None = None
    tool_args: dict | None = None
    tool_result: Any | None = None
    reasoning: str | None = None
    execution_time_ms: float | None = None


class ChatResponse(BaseModel):
    response: str
    message_id: str  # UUID to link feedback
    session_id: str  # UUID for history
    sources: list[dict] = []  # Metadata about retrieved entities
    intermediate_steps: list[ChatIntermediateAction] = []


class ChatFeedbackCreate(BaseModel):
    message_id: str
    query: str | None = None
    response: str | None = None
    debug_data: dict | None = None
    rating: bool  # True for Up, False for Down
    category: str | None = None  # "accuracy", "tone", "safety"
    comments: str | None = None


class ChatUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None = None


class ChatFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message_id: str | None
    user_id: int | None
    user: ChatUser | None = None
    query: str | None
    response: str | None
    debug_data: dict | None
    rating: bool
    category: str | None
    comments: str | None
    created_at: datetime


class ChatFeedbackStats(BaseModel):
    total_feedback: int
    positive_count: int
    negative_count: int
    satisfaction_rate: float
    category_breakdown: dict[str, int]


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    debug_data: dict | None = None
    created_at: datetime
    tokens_input: int | None = None
    tokens_output: int | None = None
    tokens_cached: int | None = None
    tokens_total: int | None = None


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: int
    user: ChatUser | None = None
    created_at: datetime
    updated_at: datetime
    total_tokens: int = 0
    first_question: str | None = None
    prompt_count: int = 0


class ChatSessionDetailResponse(ChatSessionResponse):
    messages: list[ChatMessageResponse] = []
