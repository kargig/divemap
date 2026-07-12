# Plan: Build Tool Execution History UI & Deprecate SearchIntent

## Objective
Replace the legacy `SearchIntent` mapping logic with a modern, scalable "Tool Execution History" UI in the Admin Dashboard. This will provide administrators with a clear, step-by-step timeline of exactly how the ReAct agent generates its answers, while dramatically simplifying backend maintenance.

## Background & Motivation
Currently, when the LLM executes a specialized tool (like `calculate_diving_physics`), the backend attempts to shoehorn those specific arguments backwards into a massive, monolithic `SearchIntent` object just so the admin dashboard can display a `<pre>` tag of the `debug_data`. 

This is unscalable. If we add a new tool (e.g., `book_dive_trip`), we would have to add all of its arguments as nullable fields to the `SearchIntent` schema. By migrating to a native Tool Execution UI, the frontend will dynamically render the raw OpenAI tool calls and outputs, allowing us to add infinite new tools to the backend without ever touching the UI or database schemas.

## Scope & Impact
- **Backend Affected Files**: 
  - `backend/app/schemas/chat.py` (Removing `SearchIntent` from outputs)
  - `backend/app/services/chat/chat_service.py` (Removing backward-mapping logic)
  - `backend/tests/` (Fixing tests that assert the existence of the `intent` key)
- **Frontend Affected Files**:
  - `frontend/src/pages/AdminChatHistory.jsx`
  - `frontend/src/components/tables/AdminChatHistoryTable.jsx`
- **Database**: No schema migrations required. `debug_data` is a flexible JSON column. Old chat history will still render (though it may lack the new timeline structure).

## Implementation Steps

### Phase 1: Backend Cleanup & API Modification (The "Breakage")
1. **Schema Updates (`backend/app/schemas/chat.py`)**:
   - Remove `intent: Optional[SearchIntent] = None` from `ChatResponse`.
   - Update `ChatIntermediateAction` to ensure it captures:
     - `tool_name` (e.g., "search_dive_sites")
     - `tool_args` (Raw JSON arguments passed by the LLM)
     - `tool_result` (Raw JSON output returned by the backend function, truncated if necessary)
     - `execution_time_ms` (Optional, for performance debugging)
2. **Service Refactor (`backend/app/services/chat/chat_service.py`)**:
   - Delete all instances of `last_intent = SearchIntent(...)`.
   - Update the database persistence logic. Instead of saving `debug_data={"intent": last_intent.model_dump(), ...}`, save the raw `intermediate_steps` array and the final `collected_results` directly into the `debug_data` JSON column.
3. **Test Fixes (`backend/tests/`)**:
   - Run `./docker-test-github-actions.sh`.
   - Fix all `AssertionError` failures in `test_chat_api.py` and others that expect `assert "intent" in data`. 
   - Update tests to instead assert `assert "intermediate_steps" in data`.

### Phase 2: Frontend UI Development (The "Make")
1. **Component Creation**:
   - Create a new component: `frontend/src/components/Admin/AgentExecutionTimeline.jsx`.
   - This component will accept the `intermediate_steps` array as a prop.
2. **Timeline Design (Tailwind CSS)**:
   - Render a vertical timeline (using border-left and relative positioning).
   - For each step, display an icon based on the tool (e.g., 🧮 for calculator, 📍 for location search, 🌤️ for weather).
   - Display the `tool_name` as the header.
   - **Input Accordion**: A collapsible section showing the syntax-highlighted JSON arguments (`tool_args`).
   - **Output Accordion**: A collapsible section showing the returned data (`tool_result`). If the result is a massive array of 10 dive sites, show a summary pill ("Returned 10 items") that expands into the full JSON.
3. **Integration**:
   - In `AdminChatHistory.jsx`, replace the `<pre>{JSON.stringify(msg.debug_data)}</pre>` block.
   - Add logic to gracefully fallback to the old `<pre>` tag if the `debug_data` belongs to a legacy chat message (e.g., if it contains an `intent` key instead of an `intermediate_steps` array).

## Verification & Testing
- **E2E Backend**: Run the full pytest suite. Ensure no `500 Internal Server Errors` occur due to Pydantic validation failures.
- **Frontend Admin**: Log in as an admin, navigate to the Chat History page, and verify that both *new* multi-step agent chats and *old* legacy chats render without crashing.
- **Evaluation Script**: Run `python evaluate_chat_quality.py --type calculator` to verify that the removal of `SearchIntent` does not break the automated evaluation harness. (The harness currently extracts `intent` on line 170, so it will need a minor update to pull from `intermediate_steps` instead).

## Rollback Strategy
If the frontend UI proves too difficult to read for administrators compared to the old summarized intent, we can revert the frontend component to a simple JSON stringify while keeping the backend improvements. The backend changes are strictly beneficial for performance and maintainability.