---
name: intent-based-testing
description: Specialized testing workflow for AI/LLM-driven features. Use when verifying that natural language inputs map to correct structured intents and downstream logic, or when creating regression tests for prompts.
---

# Intent-Based Testing

This skill provides a structured approach to testing AI/LLM-driven features where natural language inputs drive system logic. Unlike traditional unit tests, these tests must account for the probabilistic nature of LLMs while ensuring the deterministic business logic downstream is solid.

## Core Philosophy

1.  **Decouple Extraction from Execution**: Test "Did the LLM understand?" separately from "Did the code do the right thing with that understanding?".
2.  **Golden Datasets**: Maintain a list of "Input -> Expected Intent" pairs to catch regression in prompt engineering.
3.  **Mocking**: Use recorded or mocked LLM responses to test the business logic pipeline deterministically.

## Testing Workflows

### 1. Intent Extraction Testing (Prompt Regression)

**Goal**: Verify that the Prompt + Model correctly parses natural language into JSON.

**Strategy**:
*   Create a test file (e.g., `tests/intents/test_discovery_intents.py`).
*   Define a list of test cases:
    ```python
    TEST_CASES = [
        ("Find wrecks in Athens", {"type": "discovery", "loc": "Athens", "kw": ["wreck"]}),
        ("Diving tomorrow", {"type": "discovery", "date": "TOMORROW_ISO"}),
    ]
    ```
*   Run these inputs through the `extract_intent` function (using a live or cached LLM call).
*   Compare output JSON against expected JSON.

### 2. Pipeline Logic Testing (Mocked)

**Goal**: Verify that *given* a specific Intent, the system queries the DB correctly and returns the right data.

**Strategy**:
*   **Mock the LLM**: Do NOT call OpenAI. Manually construct the `SearchIntent` object.
    ```python
    intent = SearchIntent(intent_type="discovery", location="Athens")
    ```
*   **Execute Logic**: Pass this intent to `ChatService.execute_search(intent)`.
*   **Assert**: Verify that the database query contained `WHERE location LIKE '%Athens%'`.

### 3. Response Synthesis Testing

**Goal**: Verify that the system handles empty results, weather warnings, or rich data correctly in the final text.

**Strategy**:
*   **Mock Data**: detailed search results and weather data.
*   **Mock LLM**: Return a fixed string like "Generated Response" or use a lower-intelligence model/cache.
*   **Assert**: Verify that the *inputs* to the LLM context (the `<data>` block) were formatted correctly.

## Live Debugging & Context Verification

When investigating reports like "The bot said it doesn't know X, but X is in the DB":

1.  **Trace the Pipeline**: Ensure the backend emits structured logs at each stage:
    *   **Intent**: `[DEBUG] Extracted Intent: { ... }` (Did it catch the date? The location?)
    *   **Search**: `[DEBUG] DB Results: 5 items` (Did the query actually find anything?)
    *   **Enrichment**: `[DEBUG] Weather Fetch: Success` (Did external APIs fail silently?)
    *   **Prompt Construction**: `[DEBUG] System Prompt Data Context: ...` (This is critical!)

2.  **Verify Context Quality**:
    *   The LLM only knows what is in the prompt.
    *   If the bot says "I don't know the depth", check the `Data Context` log.
    *   **Action**: Explicitly add missing fields (e.g., `max_depth`) to the `generate_response` loop.
    *   **Action**: Use human-readable labels (e.g., "Southeast" instead of "135°") to reduce LLM hallucination.

3.  **Check Date/Time Logic**:
    *   Verify `datetime.now()` vs `target_date`.
    *   Ensure "Tomorrow" logic handles timezone boundaries correctly.
    *   Look for "ask_for_time" loops if the intent was ambiguous.

## Creating Golden Datasets

When adding a new feature (e.g., "Logbook"), create a corresponding Golden Dataset:

1.  **Collect Inputs**: Write down 10-20 ways a user might ask for this feature.
    *   "Log a dive"
    *   "I just dove at Blue Hole"
    *   "Add entry for yesterday"
2.  **Define Expectations**: Write the exact JSON expected for each.
3.  **Save**: Store as `tests/data/golden_logbook_intents.json`.

## Debugging "Why did it fail?"

1.  **Check the Prompt**: Did the System Prompt clearly define the missing field?
2.  **Check the Schema**: Is the Pydantic model too strict?
3.  **Check the Context**: Did the conversation history confuse the model?

## Helper Tools (Conceptual)

*   **`generate_test_matrix`**: If you have a skill to generate code, ask it to "Create a parameterized pytest for these 5 intent cases".
*   **`validate_json_schema`**: Ensure your expected outputs match the current Pydantic models.
