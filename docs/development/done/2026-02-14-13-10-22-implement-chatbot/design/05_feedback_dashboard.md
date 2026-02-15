# Feedback Review Dashboard (Admin)

## 1. Overview
The Feedback Review Dashboard is a tool for administrators to analyze chatbot performance, identify weaknesses in intent extraction or response generation, and systematically improve the system prompts based on real user interactions.

## 2. UI Design
**Location**: `/admin/chat-feedback` (New Admin Route)

### 2.1. Metrics Overview
- **Satisfaction Rate**: % of Thumbs Up vs Total Feedback.
- **Top Negative Categories**: Breakdown of issues (e.g., "Accuracy", "Tone", "Safety").
- **Feedback Trend**: Line chart of satisfaction over time (Weekly/Monthly).

### 2.2. Feedback List (Table)
- **Columns**: `Date`, `User`, `Rating`, `Category`, `Query Preview`, `Response Preview`.
- **Filters**: `Rating` (Show only Negative), `Date Range`, `Category`.
- **Actions**: "View Details", "Mark as Resolved", "Add to Test Suite".

### 2.3. Detailed Interaction View (Modal)
- **Conversation Context**: Shows the user query and the full bot response.
- **Debug Data**:
    - **Extracted Intent**: The JSON the bot parsed (e.g., `{"location": "Athens", "date": null}`).
    - **Retrieved Sources**: The list of DB entities found.
    - **Weather Data**: What the weather service returned.
- **Action**: "Copy as Prompt Example" (Formats the query/response pair for insertion into the System Prompt code).

## 3. Workflow for Prompt Enhancement

### 3.1. Identifying Issues
1.  Admin filters for "Thumbs Down" feedback.
2.  Review the **Debug Data** to find the failure point:
    - **Extraction Failure**: Did it miss the location? -> *Fix*: Update Intent Prompt examples.
    - **Search Failure**: Did it extract correctly but find nothing? -> *Fix*: Check DB data or search logic.
    - **Reasoning Failure**: Did it find data but give bad advice? -> *Fix*: Update Response Prompt guidelines.

### 3.2. Improving the Prompt
1.  Admin selects a corrected version of the interaction.
2.  Admin adds this as a "Few-Shot" example in `app/services/chat_service.py` (or a dedicated prompts file).
3.  **Example**:
    ```python
    # New example added to prompt
    User: "Find wrecks near Athens"
    Assistant: { "intent": "discovery", "location": "Athens", "keywords": ["wreck"] }
    ```

## 4. Implementation Plan
- [ ] Create `admin/chat/feedback.py` router.
- [ ] Create `AdminFeedbackPage` frontend component.
- [ ] Implement `GET /api/v1/admin/chat/feedback` endpoint with filters.
