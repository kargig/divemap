# Frontend UI/UX Design: Divemap Chatbot

## 1. Overview
The frontend implementation focuses on a non-intrusive, accessible, and context-aware chat widget that integrates seamlessly into the existing React application.

## 2. Components Structure

### 2.1. ChatWidget (Container)
**Location**: `src/components/Chat/ChatWidget.js`
**Role**: The smart container managing state and visibility.
- **State**:
    - `isOpen`: Boolean (is window visible).
    - `messages`: Array of `ChatMessage` objects.
    - `isTyping`: Boolean (show loading skeleton).
- **Props**: None (Context is derived from Router/Store).
- **Position**: Fixed bottom-right (z-index 50).

### 2.2. ChatButton (FAB)
**Role**: The trigger button.
- **Appearance**: Circular FAB with Chat Icon (`lucide-react`).
- **Interaction**: Toggles `isOpen`.
- **Notification Badge**: Shows unread messages count (if proactive suggestions are implemented).

### 2.3. ChatWindow
**Role**: The main interface.
- **Header**: "Divemap Assistant" + Close Button + Clear History option.
- **Body (`MessageList`)**: Scrollable area.
    - **Virtualization**: Use `react-window` or similar if history gets long (MVP: standard mapping).
    - **Auto-scroll**: Auto-scroll to bottom on new message.
- **Footer (`InputArea`)**:
    - Text Input (multiline, auto-expanding).
    - Send Button (disabled when empty/loading).
    - Suggestion Chips (scrollable horizontal list above input).

### 2.4. MessageBubble
**Role**: Renders a single message.
- **Variants**: `User` (Right aligned, blue), `Assistant` (Left aligned, gray/white).
- **Content Rendering**:
    - **Markdown**: Support for bold, italics, lists.
    - **Links**: Detect standard markdown links `[Text](url)` and render as internal `Link` components (using `react-router-dom`) to prevent full page reloads.
- **Feedback**: "Assistant" messages show `FeedbackButtons` (Thumbs Up/Down) on hover or persistently at the bottom of the bubble.

### 2.5. SuggestionChips
**Role**: Quick actions to guide the user and reduce typing.
- **Context-Aware**:
    - **Global**: "Find nearby sites", "Check weather today", "My upcoming trips".
    - **Contextual**: On Dive Site Page: "How deep is this?", "Best time to dive here?".
- **Interaction**: Clicking a chip sends that text as a user message immediately.

### 2.6. FeedbackButtons
**Role**: Collect binary feedback on responses.
- **UI**: Small Thumbs Up / Thumbs Down icons.
- **Action**:
    - On click: Sends `POST /api/v1/chat/feedback`.
    - UI State: Highlights the selected icon (e.g., green for up, red for down).
    - Optional: Show a small "Thank you" toast.

## 3. User Experience (UX) Flow

### 3.1. Contextual Handoff
1.  User navigates to `/dive-sites/123`.
2.  `ChatWidget` detects route change via `useLocation`.
3.  Widget sends `context_entity_type="dive_site"` and `context_entity_id="123"` with the next message.
4.  User types: "Is this good for beginners?".
5.  Backend receives context + query -> Resolves "this" to Site 123 -> Checks difficulty -> Responds.

### 3.2. Weather Query
1.  User types: "Weather in Athens tomorrow".
2.  Chatbot shows "Checking forecast..." (Status Indicator).
3.  Chatbot responds: "Tomorrow in Athens looks great! Winds are 5 knots (Offshore)."
4.  Response includes a link: "[View Wind Map](/map?lat=...&wind=true)".

## 4. State Management (Hook)
**`useChat` Hook**:
```javascript
const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = async (text, context) => {
    // 1. Optimistic UI: Add user message
    // 2. Set Loading
    // 3. API Call POST /chat/message
    // 4. On Success: Add bot response
    // 5. On Error: Add error system message + Toast
  };

  return { messages, sendMessage, isLoading };
}
```

## 5. Accessibility (a11y)
- **Keyboard Nav**: Tab order must flow into the chat window when open.
- **Screen Readers**:
    - `aria-live="polite"` for the message container to announce new messages.
    - `aria-label` for FAB and Send buttons.
- **Focus Management**: Focus input when window opens; return focus to FAB when closed.
