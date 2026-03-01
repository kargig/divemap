# Chat Subsystem Implementation

**Status:** Complete
**Created:** 2026-02-22
**Updated:** 2026-02-28
**Agent PID:** 80812
**Branch:** feature/chat-subsystem

## Original Todo

Implement a secure, in-app chat subsystem to support Direct Messages (DMs) and User Groups. The system must protect message content from database leaks using Server-Side Envelope Encryption while providing a seamless multi-device user experience. Avoid expensive infrastructure like Redis, but utilize existing AWS SQS infrastructure if it helps offload heavy tasks within the free tier.

## Description

The Chat Subsystem integrates natively into the Divemap React frontend and FastAPI backend. It utilizes Application-Managed Server-Side Encryption (Envelope Encryption) to protect messages at rest in the database against dumps or SQL injection vulnerabilities. 

To provide real-time updates without the massive overhead of WebSockets or Redis, the system uses **Highly Optimized HTTP Polling with High-Watermark Cursors (`after_updated_at`)**. This ensures mobile clients can instantly "catch up" on both new messages and *edited* historical messages. 

To protect the database from the "polling stampede," the architecture utilizes an in-memory LRU cache for encryption keys and a `last_activity_at` short-circuit on the `chat_rooms` table.

Heavy asynchronous tasks (like distributing notification alerts to offline users in a large group chat) will be offloaded to the existing **AWS SQS** queues to prevent blocking the FastAPI request cycle.

**Core Features:**
- **User Friendship (Mutual Buddy) System:** To prevent spam, users must mutually agree to be "friends" or "buddies" before they can start a chat. A user sends a request, the other accepts, and only then can a DM or Group Chat be created.
- **Direct Messages (1-on-1) & Group Chats:** Private and multi-user rooms.
- **Server-Side Envelope Encryption:** A Master Encryption Key (MEK) encrypts unique Data Encryption Keys (DEKs) for each chat room. DEKs are cached in-memory using an LRU cache to save CPU cycles.
- **Resilient Synchronization (Edits Included):** Cursor-based fetching (`after_updated_at`) allows clients to fetch missed messages and recent edits in a single request.
- **Polling Stampede Protection:** A `last_activity_at` column on the room allows the API to return a `304 Not Modified` instantly if nothing has changed, completely bypassing the heavy messages table and decryption logic.
- **Group Management:** Users can leave group chats, and admins can rename rooms with automatic admin role reassignment.
- **Unified UI Notifications:** Chat and System notifications share a consistent, modern "at-a-glance" dropdown aesthetic in the Navbar.
- **User Mentions:** Users can mention other existing users within a group chat using `@username`.
- **Internal Link Previews:** Chat messages automatically detect and render links to internal Divemap resources (e.g., dive sites) with rich preview cards.

## Success Criteria

### Functional Requirements
- [x] **Functional**: Users can only create 1-on-1 DMs or Group Chats with users who have them listed as "buddies".
- [x] **Functional**: Messages are encrypted using room-specific DEKs before being stored.
- [x] **Functional**: Clients fetch new and edited messages using the `after_updated_at` cursor.
- [x] **Functional**: Senders can edit messages; the ciphertext updates and `is_edited` is set.
- [x] **Functional**: The `chat_rooms.last_activity_at` timestamp updates on every new message or edit.
- [x] **Functional**: Unread message counts are accurately tracked via `chat_room_members.last_read_at`.
- [x] **Functional**: Asynchronous notification generation for offline users is queued via AWS SQS.
- [x] **Functional**: Users can mention existing users in a group chat using `@username` syntax.
- [x] **Functional**: Links to internal Divemap application pages render as mini preview cards within the chat.
- [x] **Functional**: Users can leave group chats; admin roles are reassigned if the last admin leaves.
- [x] **Functional**: Group admins can rename their chat rooms.
- [x] **Functional**: A "Chat Dropdown" in the navbar provides quick access to recent activity without leaving the current page.

### Quality Requirements
- [x] **Quality**: The Master Encryption Key (MEK) is never logged or stored in the database.
- [x] **Quality**: Malformed ciphertexts return a `[Message unavailable]` placeholder instead of crashing.
- [x] **Quality**: Python's `functools.lru_cache` (or similar) is used to cache plaintext DEKs in FastAPI memory (e.g., max 1000 rooms, 10-minute TTL) to prevent symmetric decryption CPU thrashing.
- [x] **Quality**: All database queries strictly enforce the `created_at >= joined_at` authorization rule for group members.
- [x] **Quality**: The `GET /rooms` listing is optimized to avoid decryption; it relies on unread counts and timestamps for at-a-glance status.

### Performance Requirements
- [x] **Performance**: The polling endpoint `GET /messages` must check `chat_rooms.last_activity_at` first. If no new activity occurred since the client's cursor, return `304 Not Modified` in < 10ms.
- [x] **Performance**: Database indexes on `chat_messages(room_id, updated_at)` and `chat_rooms(id, last_activity_at)` are implemented.
- [x] **Performance**: SQS queueing logic fails gracefully if AWS is unreachable, ensuring chat messages still deliver.

### Security Requirements
- [x] **Security**: Envelope encryption uses AES-128-CBC with HMAC (via Fernet) or AES-256-GCM.
- [x] **Security**: Chat API endpoints enforce standard Divemap JWT authentication.

### User Validation
- [x] **User validation**: Minimizing the browser for 5 minutes and returning correctly fetches missed messages AND updates any messages edited by others during that time.

### Documentation
- [x] **Documentation**: Cryptographic architecture and LRU caching strategy are documented.
- [x] **Documentation**: API endpoints (specifically the `304 Not Modified` behavior and `after_updated_at` cursor) are fully documented.

## Implementation Plan

### Phase 1: Cryptographic Core & Database Models

- [x] **Code change**: Generate Master Encryption Key (MEK) and add to `.env.example`.
- [x] **Code change**: Create `backend/app/utils/encryption.py` with Fernet wrapping logic. Implement an in-memory `@lru_cache` for the `decrypt_room_dek(encrypted_dek: str)` function to save CPU cycles.
- [x] **Code change**: Create `ChatRoom` model (`id`, `is_group`, `name`, `encrypted_dek`, `created_at`, `created_by_id`, **`last_activity_at`**).
- [x] **Code change**: Create `ChatRoomMember` model (`room_id`, `user_id`, `role`, `joined_at`, `left_at`, `last_read_at`).
- [x] **Code change**: Create `ChatMessage` model (`id`, `room_id`, `sender_id`, `content`, `created_at`, **`updated_at`**, `is_edited`).
- [x] **Code change**: Generate Alembic migration. Add indexes: `chat_messages(room_id, updated_at)` and `chat_rooms(id)`.
- [x] **Automated test**: Write unit tests verifying that messages and keys are stored as encrypted blobs.

### Phase 1.5: User Friendship (Mutual Buddy) System

- [x] **Code change**: Create `UserFriendship` model (`id`, `user_id`, `friend_id`, `status` [PENDING, ACCEPTED, REJECTED], `created_at`, `updated_at`). Ensure `user_id` and `friend_id` are unique pairs regardless of order.
- [x] **Code change**: Generate Alembic migration for the `UserFriendship` table.
- [x] **Code change**: Create API endpoints to send, accept, reject, and list friendship requests.
- [x] **Code change**: Update the `User` model relationships to easily access an accepted friends list.

### Phase 2: Core Backend API & SQS Offloading

- [x] **Code change**: Implement `POST /api/v1/chat/rooms` (Generates DEK, encrypts with MEK, saves room). Enforce that users can only start chats with users where an `ACCEPTED` relationship exists in the `user_friendships` table.
- [x] **Code change**: Implement `GET /api/v1/chat/rooms` (Lists active rooms with unread counts based on `last_read_at`).
- [x] **Code change**: Implement `POST /api/v1/chat/rooms/{room_id}/messages`.
    - Encrypt message and insert to DB.
    - Update `chat_rooms.last_activity_at = NOW()`.
    - **SQS Integration:** Push a lightweight event to SQS (`{"type": "new_chat_message", "room_id": ID, "sender_id": ID}`) so a background Lambda/Worker can generate standard Divemap notifications for offline members.
- [x] **Code change**: Implement `PUT /api/v1/chat/messages/{message_id}` (Encrypt new text, update `updated_at`, update `chat_rooms.last_activity_at = NOW()`).

### Phase 3: High-Watermark Polling & Short-Circuiting

- [x] **Code change**: Implement `GET /api/v1/chat/rooms/{room_id}/messages`.
    - **Step 1 (Short-Circuit):** Query `chat_rooms.last_activity_at`. If `last_activity_at <= after_updated_at` (from client query param), immediately return HTTP 304 Not Modified.
    - **Step 2 (Fetch):** If activity exists, query `chat_messages WHERE room_id = ? AND updated_at > ?`.
    - **Step 3 (Filter):** Enforce `created_at >= joined_at` for the requesting user.
    - **Step 4 (Decrypt):** Fetch DEK (hits LRU cache), decrypt messages, and return.
- [x] **Code change**: Implement `PUT /api/v1/chat/rooms/{room_id}/read` to update the user's `last_read_at` timestamp.
- [x] **Automated test**: Write integration tests ensuring the 304 short-circuit works and the LRU cache is hit during repeated requests.

### Phase 4: Frontend UI & Smart Polling

- [x] **Code change**: Create `ChatInbox` component (lists rooms with unread badges).
- [x] **Code change**: Create `ChatRoom` component (main message thread view).
- [x] **Code change**: Create `MessageBubble` component (handles display and edited state).
- [x] **Code change**: Implement smart polling using `react-query`. 
    - The client tracks the highest `updated_at` timestamp it has seen in the current room.
    - It requests `?after_updated_at=<timestamp>` every ~3 seconds.
    - It correctly handles `304 Not Modified` responses without updating UI state.
    - When new/edited messages arrive, it merges them into the local state (appending new ones, replacing edited ones based on `message.id`).
- [x] **Code change**: Add global unread indicator to desktop and mobile navbars by polling `/api/v1/user-chat/unread-count`.
- [x] **Code change**: Add a window focus event listener (via `react-query`'s default `refetchOnWindowFocus`) to catch up when user returns.

### Phase 5: UI Refinement & Integration

- [x] **Code change**: Create `/buddies` management page for handling accepted friends and pending requests.
- [x] **Code change**: Optimize Navbar layout. Consolidated "Diving Centers" and "Dive Trips" into "Dive / Explore" dropdown to save space for chat icons.
- [x] **Code change**: Distinguish AI assistant icon (`ChatbotIcon`) from user messaging (`MessageSquare`).
- [x] **Code change**: Fix mobile flexbox "squishing" issues in `ChatInbox` and `BuddyRequests` using `shrink-0` and `min-w-0`.
- [x] **Code change**: Ensure corrupted ciphertexts return `[Message unavailable]` gracefully.
- [ ] **Code change**: Create `scripts/rotate_chat_master_key.py`. Decrypts all `encrypted_dek` values and re-encrypts with a new MEK. Must also clear the LRU cache if run while the app is live.

### Phase 6: Rich Chat Features & Mentions

- [x] **Code change**: Implement User Mentions parsing in frontend message input and display.
- [x] **Code change**: Update `MessageBubble` component to detect internal Divemap URLs (e.g., `/dive-sites/:id`) and render a mini preview card containing basic details of the linked entity.

### Phase 7: Group Management & Unified Navbar UI

- [x] **Code change**: Implement `PUT /api/v1/user-chat/rooms/{room_id}` for group renaming (admin only).
- [x] **Code change**: Implement `DELETE /api/v1/user-chat/rooms/{room_id}/leave` with automatic admin reassignment.
- [x] **Code change**: Create `NewChatModal` with multi-buddy selection and group naming.
- [x] **Code change**: Create `RoomSettings` side-panel for participant lists and group management.
- [x] **Code change**: Create `ChatDropdown` for modern Navbar activity tracking.
- [x] **Code change**: Refactor `NotificationBell` to match the new unified dropdown aesthetic.
- [x] **Code change**: Optimize `GET /rooms` listing to remove message decryption and focus on timestamps/counts.

## Review

- [ ] Verify SQS message payload size is well within the 256KB free tier limit (sending only IDs, no message text).
- [ ] Ensure LRU cache does not cause memory leaks (use `cachetools.TTLCache` in Python if a strict time-to-live is needed instead of unbounded LRU).

## Notes

**User Friendship (Mutual Buddy) System:**
To protect users from spam, Divemap requires a mutual friendship before messaging is allowed. This is separate from the existing `DiveBuddy` model (which only tags users in dive logs). We will introduce a new `UserFriendship` table.
- A user sends a friend request (`status='PENDING'`).
- The recipient can accept (`status='ACCEPTED'`) or reject (`status='REJECTED'`).
- To prevent duplicating rows (A->B and B->A), the backend logic should ensure that `user_id` is always the smaller of the two IDs, and `friend_id` is the larger, or enforce constraints so only one directional relationship exists per pair.
- The `POST /api/v1/chat/rooms` endpoint will verify that an `ACCEPTED` friendship exists between the room creator and every other participant before allowing the room to be created.

**The `after_updated_at` Synchronization Model:**
By shifting from an ID-based cursor to a timestamp-based cursor (`updated_at`), the polling endpoint solves two problems at once. When the client asks "Give me everything modified since T", the database returns brand new messages (where `updated_at == created_at`) AND historical messages that were recently edited (where `updated_at > created_at`). The frontend simply merges this array into its state, replacing old messages with their edited versions.

**Polling Stampede Protection:**
Polling every 3 seconds across thousands of users generates massive HTTP traffic. By storing `last_activity_at` on the `chat_rooms` table, the backend can do a blazing-fast index lookup on a single row. If the room hasn't changed since the client's cursor, the API skips the heavy `chat_messages` query and the decryption CPU cycles entirely, returning a 304.

**In-Memory DEK Caching:**
Symmetric decryption (AES) is CPU intensive. To avoid decrypting the Room's Data Encryption Key (DEK) on every single poll, `decrypt_room_dek()` is wrapped in an LRU cache. The FastAPI worker decrypts it once, holds the plaintext DEK in memory, and reuses it for subsequent polls for that room.
