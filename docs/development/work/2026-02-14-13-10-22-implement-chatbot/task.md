# Implement AI Chatbot for Dive Discovery with Weather Integration

**Status:** Implementation (Phase 4)
**Created:** 2026-02-14 13:10:22
**Agent PID:** 104221
**Branch:** feature/implement-chatbot

## Description

Implement an intelligent chatbot within Divemap that allows users to discover dive sites, trips, and centers using natural language. The system leverages OpenAI for intent understanding and response generation, integrates real-time weather suitability analysis, and prioritizes security against prompt injection and abuse.

## Design Documents (Read in Order)

1.  [`01_backend_architecture.md`](design/01_backend_architecture.md): Service structure, Data Models (`SearchIntent`, `ChatFeedback`), and API design.
2.  [`02_prompt_engineering.md`](design/02_prompt_engineering.md): System prompts for Intent Extraction and Response Synthesis.
3.  [`03_weather_integration.md`](design/03_weather_integration.md): Strategy for batch weather fetching and suitability ranking.
4.  [`04_frontend_ui_ux.md`](design/04_frontend_ui_ux.md): Component breakdown (`ChatWidget`), state management (`useChat`), and UX flows.
5.  [`05_feedback_dashboard.md`](design/05_feedback_dashboard.md): Admin UI/UX for reviewing feedback and improving prompts.
6.  [`06_testing_strategy.md`](design/06_testing_strategy.md): Unit/Integration testing plans and evaluation metrics.

## Success Criteria

- [x] **Functional**: Correctly interprets "Athens", "2026-02-15", "Advanced".
- [x] **Functional**: Resolves "tomorrow" or "this weekend" to correct dates.
- [x] **Functional**: Suggests sites with "Good" weather suitability for the requested date.
- [ ] **Functional**: Handles missing location by asking user or using geolocation.
- [ ] **Functional**: Chatbot refuses to answer non-diving questions.
- [x] **Functional**: Links in responses are valid and clickable.
- [ ] **Functional**: **Context Awareness**: "How deep is this site?" works when viewing a dive site page.
- [ ] **Functional**: **Certification Helper**: Correctly answers "What do I need for PADI Advanced?".
- [ ] **Functional**: **Feedback**: User can rate responses, and feedback is stored in DB.
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

### Phase 4: Interface (Frontend) - **IN PROGRESS**
*Focus: Basic Chat Interaction*
- [x] Create `frontend/src/hooks/useChat.js` hook for state management.
- [ ] Create `ChatWidget`, `ChatWindow`, `MessageBubble` components.
- [ ] Integrate `useChat` hook with API.
- [ ] Add Markdown rendering for links.
- [ ] **Verification**: User can type a message and see the response.

### Phase 5: UX Polish (Frontend)
*Focus: Usability & Context*
- [ ] Implement `SuggestionChips` component.
- [ ] Implement `FeedbackButtons` and connect to `/feedback` API.
- [ ] Add Geolocation request logic to `ChatWidget`.
- [ ] Add Contextual Handoff (pass current route ID to backend).
- [ ] **Verification**: Navigate to a site, ask "How deep?", verify correct answer.

### Phase 6: Admin Tools & Security (Full Stack)
*Focus: Feedback Loop & Hardening*
- [ ] Create `backend/app/routers/admin/chat.py`.
- [ ] Create `frontend/src/pages/AdminFeedback.js`.
- [ ] Perform Prompt Injection security tests ("Ignore instructions...").
- [ ] Verify Rate Limiting limits.

## Review

- [ ] Check token usage and cost projections.
- [ ] Verify `WindRecommendationService` accuracy with real weather data.

## Notes

- **Logbook Assistant**: For MVP, this will just be a "Draft" capability where the bot parses the text and returns a JSON/Structure that *could* be used to pre-fill a form, but full integration with the "Log Dive" form is a stretch goal.
- **Context Window**: Limit to last 10 messages.
- **Safety**: Never execute code generated by LLM; only parse JSON or display text.
