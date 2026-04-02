# B2C Chat & Broadcast Features Design

**Status:** Approved
**Date:** 2026-04-01
**Topic:** Business-to-Consumer (B2C) Chat, Multi-Agent Support, and Broadcast Channels

## 1. Objective
Expand the existing Divemap User Chat Subsystem to support B2C communication. This allows regular users to message Diving Centers directly, and enables center owners/managers to manage a shared "Business Inbox" with automated greetings, quick replies, and broadcast capabilities for trip announcements.

## 2. Architecture & Data Model

### 2.1 Multi-Agent Support
To support multiple staff members managing a single center's inbox:
- **`diving_center_managers` table**:
  - `id` (PK)
  - `diving_center_id` (FK to `diving_centers`)
  - `user_id` (FK to `users`)
  - `created_at` (Timestamp)
- **Permissions**:
  - **Owner**: Existing `owner_id` in `diving_centers`. Full control (delete center, manage managers).
  - **Manager**: Entry in `diving_center_managers`. Access to Business Inbox, Broadcasts, and Profile editing.

### 2.2 Chat Room Enhancements
- **`UserChatRoom` updates**:
  - `diving_center_id` (FK, nullable): Links the room to a specific business.
  - `is_broadcast` (Boolean): Flags a one-way announcement channel.
  - `business_status` (Enum: `UNREAD`, `READ`, `RESOLVED`): Shared state for the center.
  - `last_responded_by_id` (FK to `users`, nullable): Tracks which manager last replied.
- **`DivingCenter` updates**:
  - `logo_url` (String/Text): Public URL for the center's branding (stored in R2).

### 2.3 Automation & Opt-in
- **`diving_center_chat_settings` table**:
  - `diving_center_id` (FK, unique)
  - `auto_greeting` (Text)
  - `quick_replies` (JSON array of strings)
- **`diving_center_followers` table**:
  - `user_id` (FK)
  - `diving_center_id` (FK)
  - `created_at` (Timestamp)
  - *Note: Users must "Follow" a center to receive Broadcasts.*

## 3. API Design & Security

### 3.1 Unified Inbox
- `GET /api/v1/user-chat/rooms`:
  - Returns rooms where the user is a `UserChatRoomMember` **UNION** rooms where `diving_center_id` matches a center managed by the user.
  - Business rooms are returned with their `business_status`.

### 3.2 Identity Masking
- **Server-side Logic**: When fetching messages for a room with a `diving_center_id`, if the `sender_id` is a manager of that center:
  - Override the `sender` profile in the JSON response to use the center's `name` and `logo_url`.
  - The actual `sender_id` remains in the DB for audit logs but is masked for the customer.
- **Manager View**: Managers will see a "Replied by [Name]" indicator in the frontend for internal accountability.

### 3.3 B2C Room Creation & Auto-Greetings
- `POST /api/v1/user-chat/rooms`:
  - Allows creating a room with a `diving_center_id` without the "Mutual Buddy" check.
  - If a `diving_center_id` is provided, the backend automatically injects a `UserChatMessage` containing the `auto_greeting` from settings (sender_id = NULL).

### 3.4 Broadcasts
- `POST /api/v1/diving-centers/{id}/broadcast`:
  - Sends a message to the center's broadcast channel.
  - Supports `type="TRIP_AD"` with a `trip_id` payload to render rich "Trip Cards" in the chat.

## 4. Technical Deep Dive (For Implementation)

### 4.1 Notifications & Real-Time Sync
- **Broadcast Push Notifications**: When a customer sends a message to a business, the backend will trigger a push notification to **all active managers** of that center. 
- **Notification Suppression**: To prevent "notification spam", the backend should check if a manager is currently connected via WebSocket to that specific room before sending the push payload.

### 4.2 Manager Lifecycle
- Adding a manager must verify the user exists and doesn't duplicate an entry.
- Removing a manager should immediately revoke their access to the unified inbox and disable their ability to reply to existing business threads.

### 4.3 Performance (Serialization)
- Identity masking logic must be applied at the serialization layer (Pydantic model or Response override) *after* database retrieval. Avoid complex SQL joins for the masking itself to keep queries fast. Use `orjson` where applicable for large inbox payloads.

## 5. Frontend Requirements

### 5.1 Chat Inbox
- **Toggle Switch**: "Personal / Business" filter at the top of the inbox list for managers.
- **Status Indicators**: "Resolved" vs "Open" badges for business threads.

### 5.2 Chat Room
- **Quick Reply Pills**: Rendered above the message input for customers.
- **Trip Cards**: Rich rendering for messages with `type="TRIP_AD"`, including trip details and a "View Trip" button.
- **Broadcast Mode**: Hide input field for non-managers if `room.is_broadcast` is True.

### 5.3 Center Profile
- **"Message Us" Button**: Initiates/opens the B2C chat.
- **"Follow for Updates" Button**: Adds user to `diving_center_followers` and joins the broadcast room.

## 6. Success Criteria
- [ ] Users can chat with businesses without buddy requests.
- [ ] Managers can reply as the "Diving Center" identity.
- [ ] Shared inbox status (Unread/Read/Resolved) works globally for all managers.
- [ ] All managers receive notifications for new customer inquiries.
- [ ] Broadcasts correctly deliver trip announcements to followers.
- [ ] No leakage of manager personal profiles to customers.
