# B2C Chat Features: Technical Specification

**Status:** Approved
**Date:** 2026-04-01
**Topic:** Business-to-Consumer (B2C) Chat, Multi-Agent Support, Broadcast Channels, and Chat Archiving

## 1. Objective
Expand the existing Divemap User Chat Subsystem to support B2C communication. This allows regular users to message Diving Centers directly, and enables center owners/managers to manage a shared "Business Inbox" with automated greetings, broadcast capabilities for trip announcements, and chat archiving.

## 2. Architecture & Data Model

### 2.1 Chat Room UUID Migration
To prevent enumeration attacks and information disclosure, `UserChatRoom.id` must be migrated from sequential integers to random Version 4 UUID strings (36 characters). This requires coordinated migration of the primary key and all associated foreign keys in the `user_chat_room_members` and `user_chat_messages` tables.

### 2.2 Multi-Agent Support
To support multiple staff members managing a single center's inbox:
- **`diving_center_managers` table**:
  - `id` (PK)
  - `diving_center_id` (FK to `diving_centers`)
  - `user_id` (FK to `users`)
  - `created_at` (Timestamp)
- **Permissions**:
  - **Owner**: Existing `owner_id` in `diving_centers`. Full control.
  - **Manager**: Entry in `diving_center_managers`. Access to Business Inbox, Broadcasts, and Profile editing.

### 2.3 Chat Room Enhancements
- **`UserChatRoom` updates**:
  - `diving_center_id` (FK, nullable): Links the room to a specific business.
  - `is_broadcast` (Boolean): Flags a one-way announcement channel.
  - `business_status` (Enum: `UNREAD`, `READ`, `RESOLVED`): Shared state for the center.
  - `last_responded_by_id` (FK to `users`, nullable): Tracks which manager last replied.
  - `is_archived` (Boolean): Global archive state for the business inbox.
- **`DivingCenter` updates**:
  - `logo_url` (String/Text): Public URL for the center's branding (stored in R2).

### 2.4 Soft-Delete / Archive State
- **`UserChatRoomMember` updates**:
  - `is_archived` (Boolean): Defaults to `False`. Tracks whether a specific user has hidden this room from their active personal inbox view.
- **Auto-Unarchive Logic**:
  - When a message or broadcast is sent, the backend queries all `UserChatRoomMember` records and sets `is_archived = False` for users where it was previously true.

### 2.5 Automation & Opt-in
- **`diving_center_chat_settings` table**:
  - `diving_center_id` (FK, unique)
  - `auto_greeting` (Text)
  - `quick_replies` (JSON array of strings)
- **`diving_center_followers` table**:
  - `user_id` (FK)
  - `diving_center_id` (FK)
  - `created_at` (Timestamp)
  - *Note: Users must explicitly "Follow" a center to receive Broadcasts.*

## 3. API Design & Security

### 3.1 Unified Inbox
- `GET /api/v1/user-chat/rooms`:
  - Returns rooms where the user is a `UserChatRoomMember` **UNION** rooms where `diving_center_id` matches a center managed/owned by the user.
  - Business rooms are returned with their `business_status`.

### 3.2 Identity Masking
- **Server-side Logic**: When fetching messages for a B2C room, if the `sender_id` is a manager/owner of that center:
  - Override the `sender` profile in the JSON response to use the center's `name` and `logo_url`.
  - The actual `sender_id` remains in the DB for audit logs but is masked for the customer.
- **Manager View**: Managers will see a "Replied by [Name]" indicator in the frontend for internal accountability.

### 3.3 B2C Room Creation & Auto-Greetings
- `POST /api/v1/user-chat/rooms`:
  - Allows creating a room with a `diving_center_id` without the mutual "Buddy" check.
  - If `diving_center_id` is provided, the backend injects the `auto_greeting` (if configured) as the first message.

### 3.4 Broadcasts
- `POST /api/v1/diving-centers/{id}/broadcast`:
  - Payload: `BroadcastTripRequest(trip_id: int)`
  - Creates a broadcast room (if not exists), adds all followers, and sends an encrypted `TRIP_AD` message.
- `POST /api/v1/diving-centers/{id}/broadcast/text`:
  - Payload: `BroadcastTextRequest(message: str)`
  - Sends an encrypted `TEXT` message.
- **Notifications**: Both broadcast endpoints trigger an SQS event `{"type": "new_chat_message", ...}` to generate push/email notifications for followers.

### 3.5 Archiving
- `PATCH /api/v1/user-chat/rooms/{room_id}/archive`:
  - Payload: `{"is_archived": bool}`
  - Updates `is_archived` status for the `current_user`. For center managers viewing a business chat, it archives the room globally for the center (`UserChatRoom.is_archived`).

## 4. Frontend Requirements

### 4.1 Chat Inbox & Room UI
- **Toggle Switch**: "Personal / Business" filter at the top of `ChatInbox.jsx` for managers.
- **Archive Action**: "Archive Chat" button in `RoomSettings.jsx`.
- **Trip Cards**: Rich rendering for messages with `type="TRIP_AD"`, showing date, time, standard dynamic `CurrencyIcon` for price, and `TrendingUp` icon for max depth. Dive sites should be clickable.
- **Broadcast Mode**: Hide input field for non-managers if `room.is_broadcast` is True.

### 4.2 Center Profile & Trip Details
- **Tabbed Interface (`DivingCenterDetail.jsx`)**: Organize profile into "Overview", "Upcoming Trips" (defaulting to current date forward), and "Management" (restricted to owners/managers/admins).
- **Management Tab**: Displays follower count and a form to send custom Text Broadcasts.
- **Trip Detail Enrichment**: Extract the center header into `DivingCenterSummaryCard.jsx` and render it inside the `TripDetail.jsx` "Diving Center" tab, including "Message Us" and "Follow" buttons.
- **UI Icons**: Strictly adhere to Divemap standards (e.g., `TrendingUp` for depth, dynamic `CurrencyIcon` for price, `ChevronRight` for View Trip).