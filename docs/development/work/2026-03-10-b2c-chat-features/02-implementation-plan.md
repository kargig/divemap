# B2C Chat Features: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the user chat subsystem to support B2C messaging, multi-agent business inboxes, automated greetings, broadcast trip announcements, UI enrichments, and database UUID migration.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Alembic), React (Tailwind CSS, React Query), MySQL.

---

## Phase 1: Security & Database Foundation

### Task 1.1: Chat Room UUID Migration
**Goal:** Migrate `UserChatRoom.id` from sequential integers to random UUID strings (Version 4).
- [ ] **Step 1:** Modify `backend/app/models.py`. Change `UserChatRoom.id` to `String(36)`. Update all FKs in `UserChatRoomMember` and `UserChatMessage` to match.
- [ ] **Step 2:** Generate empty Alembic migration `XXXX_migrate_chat_to_uuid.py`. Implement multi-stage migration logic using Python `uuid.uuid4()` strings for true randomness (do not use MySQL `UUID()` inside Alembic).
- [ ] **Step 3:** Modify `frontend/src/pages/Messages.jsx` to parse string UUIDs instead of integers.

### Task 1.2: Multi-Agent & B2C Schema Updates
**Goal:** Support business inboxes and multi-agent permissions.
- [ ] **Step 1:** Add `logo_url` to `DivingCenter` in `models.py` and schemas.
- [ ] **Step 2:** Create `DivingCenterManager` model.
- [ ] **Step 3:** Create `BusinessChatStatus` Enum (`UNREAD`, `READ`, `RESOLVED`). Add `diving_center_id`, `is_broadcast`, and `business_status` to `UserChatRoom`.
- [ ] **Step 4:** Create `DivingCenterChatSettings` and `DivingCenterFollower` models.
- [ ] **Step 5:** Generate and verify Alembic migrations for these schema updates.

## Phase 2: Core B2C Inbox & Identity Masking

### Task 2.1: Unified API
- [ ] **Step 1:** Update `list_chat_rooms` in `routers/user_chat.py`. Use a `UNION` or complex `or_` query to return rooms where the user is a `UserChatRoomMember` OR the user manages the `diving_center_id` attached to the room. Include an `is_manager_view` boolean in the schema.
- [ ] **Step 2:** Update `get_messages` logic for Identity Masking. If the sender is a manager of the B2C room, override the `sender` profile payload with the diving center's name and logo.

### Task 2.2: B2C Room Creation
- [ ] **Step 1:** Modify `POST /api/v1/user-chat/rooms`. Bypass mutual buddy checks if `diving_center_id` is provided.
- [ ] **Step 2:** Automatically inject the `auto_greeting` from `DivingCenterChatSettings` into the room as the first message upon creation.

### Task 2.3: Frontend B2C Inbox
- [ ] **Step 1:** Add a "Personal / Business" toggle at the top of `ChatInbox.jsx`. Filter based on `room.is_manager_view`.
- [ ] **Step 2:** Update `ChatRoom.jsx` to render Quick Reply chips and respect `is_broadcast` rules (hide input field for customers).

## Phase 3: Archiving & Soft-Delete

### Task 3.1: Database Archive Flags
- [ ] **Step 1:** Add `is_archived` (Boolean) to both `UserChatRoom` (global for business) and `UserChatRoomMember` (personal for user). Generate migrations.

### Task 3.2: Archive Endpoints & Auto-Unarchive
- [ ] **Step 1:** Create `PATCH /api/v1/user-chat/rooms/{room_id}/archive`.
- [ ] **Step 2:** Update `list_chat_rooms` to omit archived rooms.
- [ ] **Step 3:** Update `send_message` to automatically unarchive the room (`is_archived = False`) for all members upon a new message.

### Task 3.3: Frontend Archive UI
- [ ] **Step 1:** Add "Archive Chat" button in `frontend/src/components/UserChat/RoomSettings.jsx`.
- [ ] **Step 2:** Wire it to the new `PATCH` API using React Query.

## Phase 4: Follows & Broadcasts

### Task 4.1: Subscription APIs
- [ ] **Step 1:** Create `POST /follow`, `DELETE /unfollow`, and `GET /follow-status` in `backend/app/routers/diving_centers.py`.
- [ ] **Step 2:** Add "Follow for Updates" button to the frontend Diving Center header.

### Task 4.2: Trip & Text Broadcast Endpoints
- [ ] **Step 1:** Create `POST /api/v1/diving-centers/{id}/broadcast` accepting `BroadcastTripRequest(trip_id)`. Generate an encrypted `TRIP_AD` message in the center's broadcast room.
- [ ] **Step 2:** Create `POST /api/v1/diving-centers/{id}/broadcast/text` for custom text announcements.
- [ ] **Step 3:** Integrate SQS `send_message` inside both endpoints to trigger push/email notifications for all followers.

## Phase 5: Profile Enrichment & UI Standardization

### Task 5.1: Trip Creation Integration
- [ ] **Step 1:** Add "Broadcast to followers" checkbox to `TripFormModal.jsx`. Trigger the broadcast API on success in `CreateTrip.jsx`.

### Task 5.2: Diving Center Profile Tabs
- [ ] **Step 1:** Refactor `DivingCenterDetail.jsx` into tabs: "Overview", "Upcoming Trips" (default date range `TODAY` to `+3 months`), and "Management" (visible strictly via secure backend validation).
- [ ] **Step 2:** Build the "Broadcast Announcement" form inside the Management tab.

### Task 5.3: Cross-Component Summaries
- [ ] **Step 1:** Extract the top header of the diving center profile into a standalone `DivingCenterSummaryCard.jsx`.
- [ ] **Step 2:** Inject this card into the "Diving Center" tab of `TripDetail.jsx` so users have full interactivity (Message/Follow) from the trip page.

### Task 5.4: UI Standard Enhancements
- [ ] **Step 1:** In `MessageBubble.jsx`, design a rich layout for `TRIP_AD` payloads showing date, status, spots remaining, and clickable dive site maps.
- [ ] **Step 2:** Implement `CurrencyIcon.jsx` to dynamically render `Euro`, `DollarSign`, etc. Replace all hardcoded string `$`/`€` symbols globally.
- [ ] **Step 3:** Strictly adhere to Divemap UI mappings. Replace misconfigured depth icons (`Thermometer`, `MapPin`) across `DiveTrips.jsx`, `DivesMap.jsx`, and `MessageBubble.jsx` with the canonical `TrendingUp` icon. Replace `Eye`/`Heart` tabs in `TripDetail.jsx` with `Info`/`Ticket` to prevent semantic clashes.