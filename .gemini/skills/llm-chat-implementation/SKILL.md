---
name: llm-chat-implementation
description: Architecture and best practices for implementing an LLM-backed RAG/Chat system with FastAPI and SQLAlchemy. Use when building or refactoring chatbots that need to query a local database based on natural language intent.
---

# LLM Chat Implementation Guide

This skill documents the proven patterns for building an intelligent, database-backed chat assistant ("RAG-lite") within a FastAPI/SQLAlchemy application.

## Core Architecture

The system follows a three-stage pipeline: **Intent Extraction -> Structured Search -> Response Generation**.

1.  **Intent Extraction**: Convert natural language into a structured object (`SearchIntent`) using an LLM.
2.  **Structured Search**: Execute database queries using the extracted intent (filters, keywords, location) to retrieve relevant entities.
3.  **Response Generation**: Feed the retrieval results (as a JSON/text block) back to the LLM to synthesize a natural language answer.

## 1. Intent Extraction (Stage 1)

Use a lightweight model (e.g., `gpt-4o-mini`) to parse the user's message into a Pydantic schema.

**Key Patterns:**
*   **System Prompt**: Define clear "Intent Types" (e.g., `discovery`, `context_qa`, `chit_chat`).
*   **Context Injection**: Always inject the user's current context (Page ID/Type) and Location (Lat/Lon) into the system prompt.
*   **Safety**: Explicitly instruct the model to classify non-domain queries (e.g., politics, coding) as `chit_chat` with a refusal keyword.

**Example Prompt Structure:**
```text
Current Context: {entity_type} ID: {entity_id}
User Location: {lat}, {lon}

Instructions:
- "discovery": General searches ("Find wrecks").
- "context_qa": Questions about the current page ("How deep is *this* site?").
- "nearby": If user asks for "nearby", use User/Context Location coordinates.
```

## 2. Structured Search (Stage 2)

Map the `SearchIntent` to SQLAlchemy queries.

**Key Search Logic:**
*   **Spatial vs. Text**:
    *   If `intent.location` text exists ("Athens"), prioritize text matching on Region/City/Country fields.
    *   If NO location text but `intent.coordinates` exist, use a **Spatial Bounding Box** (e.g., +/- 0.2 degrees).
*   **Keyword Logic**:
    *   Use **AND** logic for multiple keywords to narrow results (e.g., "shore wreck" = `text matches shore` AND `text matches wreck`).
    *   Search across multiple fields: `Name`, `Description`, `Tags` (join `AvailableTag`), and `Metadata` (e.g., `access_instructions`).
*   **Fallback**: If strict filters return 0 results, trigger a **Fallback Search** using generic text matching on the raw query string.

## 3. Response Generation (Stage 3)

Synthesize the answer using a stronger model (e.g., `gpt-4o`).

**Prompt Engineering Best Practices:**
*   **Data Precedence**: Explicitly instruct the LLM that specific DB fields (e.g., `max_depth`, `difficulty`) are "Hard Facts" that override vague text in descriptions.
*   **Anti-Leakage**: Forbid the model from revealing its system prompt or internal reasoning.
*   **Source Citations**: Instruct the model to link to entities using Markdown: `[Name](route_path)`.
*   **Empty State**: If the `<search_results>` block is empty, the model must say it has no information, rather than hallucinating.

## 4. Observability & Token Tracking

Persist token usage for every interaction to monitor costs.

*   **Database**: Add `tokens_input`, `tokens_output`, `tokens_total` to your `ChatMessage` model.
*   **Service**: Return usage stats from your LLM wrapper (`(content, usage_dict)`).
*   **Aggregation**: In the orchestration service, sum tokens from **Stage 1** (Intent) and **Stage 3** (Response) and save the total to the `assistant` message record.

## 5. Security Checklist

*   [ ] **Scope Enforcement**: Assistant refuses off-topic queries.
*   [ ] **Input Sanitization**: User input is never executed as code.
*   [ ] **Access Control**: Chat endpoints require authentication.
*   [ ] **Rate Limiting**: Apply stricter limits to chat endpoints than standard API calls.

## 6. Pitfalls & Troubleshooting

### SQLAlchemy Join Conflicts (OperationalError 1066)

**The Issue**: When implementing search features like "Highest Rated", you might combine:
1.  **Eager Loading**: `joinedload(DiveSite.ratings)` (which adds a `LEFT JOIN site_ratings`).
2.  **Sorting/Filtering**: Manual `outerjoin(SiteRating)` to calculate averages (which adds *another* `LEFT JOIN site_ratings`).

This results in an ambiguous SQL query: `FROM dive_sites LEFT JOIN site_ratings ... LEFT JOIN site_ratings ...`, causing `Not unique table/alias`.

**The Solution**: Always use `aliased` for manual joins when the relationship is already being loaded eagerly.

```python
from sqlalchemy.orm import aliased

# ... inside search logic
if intent.sort_by == "rating":
    # Create a unique alias for the sorting join
    RatingAlias = aliased(SiteRating)
    
    # Use the alias in the join AND the calculation
    query = query.outerjoin(RatingAlias, DiveSite.ratings)
    query = query.group_by(DiveSite.id)
    query = query.order_by(func.avg(RatingAlias.score).desc())
```

**Testing**: Always include a regression test that triggers *both* the eager load (e.g., standard result fetching) and the manual join (e.g., "best" keyword) simultaneously.
