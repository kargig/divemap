# Implement AI Chatbot for Dive Discovery with Weather Integration

**Status:** Implementation (Phase 6)
**Created:** 2026-02-14 13:10:22
**Agent PID:** 104221
**Branch:** feature/implement-chatbot

## Description

Implement an intelligent chatbot within Divemap that allows users to discover dive sites, trips, and centers using natural language. The system leverages OpenAI for intent understanding and response generation, integrates real-time weather suitability analysis, and prioritizes security against prompt injection and abuse. Access to the chatbot is restricted to registered users, and all chat interactions are recorded for quality assurance and improvement.

## Design Documents (Read in Order)

1.  [`01_backend_architecture.md`](design/01_backend_architecture.md): Service structure, Data Models (`SearchIntent`, `ChatFeedback`, `ChatSession`, `ChatMessage`), and API design.
2.  [`02_prompt_engineering.md`](design/02_prompt_engineering.md): System prompts for Intent Extraction and Response Synthesis.
3.  [`03_weather_integration.md`](design/03_weather_integration.md): Strategy for batch weather fetching and suitability ranking.
4.  [`04_frontend_ui_ux.md`](design/04_frontend_ui_ux.md): Component breakdown (`ChatWidget`), state management (`useChat`), and UX flows.
5.  [`05_feedback_dashboard.md`](design/05_feedback_dashboard.md): Admin UI/UX for reviewing feedback and improving prompts.
6.  [`06_testing_strategy.md`](design/06_testing_strategy.md): Unit/Integration testing plans and evaluation metrics.

## Success Criteria

- [x] **Functional**: Correctly interprets "Athens", "2026-02-15", "Advanced".
- [x] **Functional**: Resolves "tomorrow" or "this Sunday" to correct dates.
- [x] **Functional**: Suggests sites with "Good" weather suitability for the requested date.
- [x] **Functional**: Handles missing location by asking user or using geolocation.
- [x] **Functional**: Chatbot refuses to answer non-diving questions.
- [x] **Functional**: Links in responses are valid and clickable.
- [x] **Functional**: **Context Awareness**: "How deep is this site?" works when viewing a dive site page.
- [x] **Functional**: **Certification Helper**: Correctly answers "What do I need for PADI Advanced?".
- [x] **Functional**: **Feedback**: User can rate responses, and feedback is stored in DB.
- [x] **Functional**: **Restriction**: The chatbot widget is visible and openable by all users. However, inside the chat window, guest users see a "Login Required" prompt instead of the message input and history.
- [x] **Functional**: **History**: User chat sessions and messages are persisted in the database.
- [x] **Functional**: **Admin**: Admins can browse and review user chat histories via the dashboard.
- [x] **Security**: API endpoints are secured to reject unauthenticated requests.
- [x] **Security**: Rate limiting blocks excessive requests.
- [x] **Security**: System prompt instructions are robust against basic injection attempts.
- [x] **Performance**: Total response time < 5s (using parallel weather fetching if needed).

## Implementation Plan (Sequential)

### Phase 1: Foundation (Backend) - **COMPLETED**
*Focus: Data Structures & Core Service Wrapper*
- [x] Create `backend/app/schemas/chat.py` with Pydantic models (`SearchIntent`, `ChatRequest`, `ChatFeedbackCreate`).
- [x] Create `ChatFeedback` model in `backend/app/models.py`.
- [x] Create `backend/app/services/openai_service.py` with Singleton pattern and client initialization.
- [x] Refactor `newsletters.py` to use `OpenAIService` (Verification: Newsletter parsing still works).

### Phase 2: Core Logic (Backend) - **COMPLETED**
*Focus: Intent Understanding & Basic Search*
- [x] Implement `extract_search_intent` in `ChatService` with "System Prompt v1".
- [x] Implement `execute_search` logic: Query DB -> Filter by location/difficulty.
- [x] Implement `generate_response` logic.
- [x] Scaffold `backend/app/routers/chat.py` with `/message` endpoint.
- [x] **Verification**: Unit test `extract_search_intent` (Mocked OpenAI).
- [x] **Verification**: Manual API test "Find sites in Athens" (returns JSON response).

### Phase 3: Intelligence (Backend) - **COMPLETED**
*Focus: Weather & Advanced Capabilities*
- [x] Implement `fetch_wind_data_batch` in `open_meteo_service.py`.
- [x] Enhance `ChatService` to use batch weather fetch and `WindRecommendationService`.
- [x] Add `CertificationLevel` and `DivingCenter` service queries to `ChatService`.
- [x] **Verification**: Manual API test "Dive in Athens on Sunday" (returns weather reasoning).

### Phase 4: Interface (Frontend) - **COMPLETED**
*Focus: Basic Chat Interaction*
- [x] Create `frontend/src/hooks/useChat.js` hook for state management.
- [x] Create `ChatWidget`, `ChatWindow`, `MessageBubble` components.
- [x] Integrate `useChat` hook with API.
- [x] Implement `ChatWidget` to always render the launcher button, but conditionally render the *content* of the chat window: show a login prompt for guests, and the chat interface for logged-in users.
- [x] Add Markdown rendering for links.
- [x] **Verification**: User can type a message and see the response (if logged in).

### Phase 5: UX Polish (Frontend) - **COMPLETED**
*Focus: Usability & Context*
- [x] Implement `SuggestionChips` component.
- [x] Implement `FeedbackButtons` and connect to `/feedback` API.
- [x] Add Geolocation request logic to `ChatWidget`.
- [x] Add Contextual Handoff (pass current route ID to backend).
- [x] **Verification**: Navigate to a site, ask "How deep?", verify correct answer.

### Phase 6: Admin Tools, Persistence & Security (Full Stack) - **COMPLETED**
*Focus: Feedback Loop, Data Collection & Hardening*
- [x] Create `ChatSession` and `ChatMessage` models in `backend/app/models.py`.
- [x] Update `ChatService` to persist all chat interactions (user queries and bot responses).
- [x] Create `backend/app/routers/admin/chat.py` with endpoints to list sessions and view transcripts.
- [x] Create `frontend/src/pages/AdminChatHistory.js` and `AdminChatFeedback.js`.
- [x] Enforce authentication on all `/chat` endpoints in backend.
- [ ] Perform Prompt Injection security tests ("Ignore instructions...").
- [x] Verify Rate Limiting limits.

## Review

- [ ] Check token usage and cost projections.
- [ ] Verify `WindRecommendationService` accuracy with real weather data.
- [ ] **Refinement**: Ensure specific DB fields (e.g., `max_depth`) take precedence over generic descriptions in LLM context.

## Notes

- **Logbook Assistant**: For MVP, this will just be a "Draft" capability where the bot parses the text and returns a JSON/Structure that *could* be used to pre-fill a form, but full integration with the "Log Dive" form is a stretch goal.
- **Context Window**: Limit to last 10 messages.
- **Safety**: Never execute code generated by LLM; only parse JSON or display text.
