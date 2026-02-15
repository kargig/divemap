# Backend Architecture Design: Divemap Chatbot

## 1. Overview
The backend architecture is built around a centralized `ChatService` orchestrator that coordinates between Natural Language Understanding (OpenAI), Data Retrieval (SQLAlchemy/Search), Weather Analysis (Open-Meteo), and Response Synthesis.

## 2. Core Components

### 2.1. OpenAIService (`app/services/openai_service.py`)
**Purpose**: A robust, secure wrapper for all OpenAI API interactions.
**Responsibilities**:
- **Client Management**: Singleton initialization with API key.
- **Cost Control**: Token usage tracking and logging per request.
- **Resilience**: Retry logic (exponential backoff) for API timeouts/errors (Circuit Breaker pattern).
- **Security**: Centralized prompt injection filtering (input sanitization) and output validation (JSON schema enforcement).

**Interface**:
```python
class OpenAIService:
    async def get_chat_completion(
        self, 
        messages: List[Dict], 
        model: str = "gpt-4o", 
        json_schema: Optional[Type[BaseModel]] = None
    ) -> Union[str, Dict]: ...
```

### 2.2. ChatService (`app/services/chat_service.py`)
**Purpose**: The "brain" of the chatbot. Orchestrates the pipeline.
**Pipeline**:
1.  **Intent Extraction**: 
    - Input: User message, Chat History, Current Page Context (e.g., `dive_site_id=123`).
    - Action: Calls `OpenAIService` with a specialized "Extractor" system prompt.
    - Output: `SearchIntent` object (Pydantic).
2.  **Entity Search / Data Retrieval**:
    - **Discovery Intent**: If `intent.type == "discovery"`, calls `SearchService` (to be refactored/extended from `routers/search.py`). Queries `DiveSite` and `ParsedDiveTrip` tables.
    - **Context Intent**: If `intent.type == "context_qa"` (e.g., "how deep is this site?"), fetches specific entity data directly by ID.
    - **Knowledge Intent**: If `intent.type == "certification"`, queries `CertificationLevel`.
3.  **Weather Enrichment** (Conditional):
    - If `intent.date` is present and search returned geospatial entities:
    - Calls `WeatherIntegration.fetch_wind_data_batch` for the candidate sites.
    - Calls `WindRecommendationService.calculate_wind_suitability` for each site.
    - Filters/Ranks results based on suitability.
4.  **Response Synthesis**:
    - Input: Original Query, Retrieved Data (formatted as structured XML/JSON context), Weather Analysis.
    - Action: Calls `OpenAIService` with a "Synthesizer" system prompt.
    - Output: Natural language response with Markdown links.

### 2.3. API Router (`app/routers/chat.py`)
**Purpose**: REST API entry point.
**Endpoints**:
- `POST /api/v1/chat/message`: Main interaction.
- `POST /api/v1/chat/feedback`: Submit thumbs up/down.
**Middleware**:
- **Rate Limiting**: Strict per-user limits (e.g., 5/min).
- **Auth**: Optional user authentication (tracks usage if logged in).

## 3. Data Models (`app/schemas/chat.py`)

### 3.1. SearchIntent (Internal)
```python
class IntentType(str, Enum):
    DISCOVERY = "discovery"      # "Find dive sites..."
    CONTEXT_QA = "context_qa"    # "How deep is this?"
    KNOWLEDGE = "knowledge"      # "What is PADI?"
    CHIT_CHAT = "chit_chat"      # "Hello"
    LOGBOOK_DRAFT = "logbook_draft" # "Log a dive..."

class SearchIntent(BaseModel):
    intent_type: IntentType
    keywords: List[str]
    location: Optional[str]
    date: Optional[date]
    date_range: Optional[Tuple[date, date]]
    difficulty_level: Optional[int] # 1-4
    context_entity_id: Optional[int]
    context_entity_type: Optional[str]
```

## 4. Database Schema Changes

### 4.1. ChatFeedback Table
New table to store user feedback for RLHF (Reinforcement Learning from Human Feedback) or manual tuning.
```python
class ChatFeedback(Base):
    __tablename__ = "chat_feedback"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    message_id = Column(String(50), nullable=True) # UUID from frontend/backend to link to conversation
    rating = Column(Boolean) # True=Up, False=Down
    category = Column(String(50), nullable=True) # "accuracy", "tone", "safety"
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
```

## 5. Security Design
- **Prompt Hardening**: System prompts will explicitly forbid:
    - SQL generation/execution.
    - Revealing internal instructions.
    - Answering non-diving topics (politics, coding, etc.).
- **Context Isolation**: Database results fed to the LLM are wrapped in `<data>` tags with instructions to treat them *only* as data sources.
- **Input Validation**: Max input length (500 chars) enforced at API level.
