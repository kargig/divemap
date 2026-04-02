# Chat Archiving & Soft-Delete Design

**Status:** Approved
**Date:** 2026-04-01
**Topic:** Chat Archiving, Soft-Delete, and Unfollow Distinctions

## 1. Objective
Introduce an "Archive Chat" feature to the Divemap User Chat Subsystem. This allows users to declutter their active inbox by hiding 1-on-1 DMs, group chats, and B2C broadcast channels. Archived chats will automatically reappear (unarchive) when new messages are received.

## 2. Architecture & Data Model

### 2.1 Soft-Delete / Archive State
- **`UserChatRoomMember` updates**:
  - Add `is_archived` (Boolean): Defaults to `False`. Tracks whether a specific user has hidden this room from their active inbox view.
- **Auto-Unarchive Logic**:
  - When the `send_message` or `broadcast` endpoints are triggered, the backend must query all `UserChatRoomMember` records for that room and update `is_archived = False` for any user where it was previously true, bringing the room back to their active inbox.

### 2.2 Distinctions for B2C Broadcasts
- **Archive**: Hides the broadcast channel from the inbox. The next time the Diving Center sends a broadcast (e.g., a trip announcement), the channel auto-unarchives and reappears.
- **Unfollow**: Permanently removes the user from the `diving_center_followers` list and sets their `UserChatRoomMember.left_at` timestamp. They will no longer receive broadcasts, and the channel will not auto-unarchive.

## 3. API Design

### 3.1 New Endpoints
- `PATCH /api/v1/user-chat/rooms/{room_id}/archive`:
  - **Payload:** `{"is_archived": bool}`
  - Updates the `is_archived` status for the `current_user` in the specified room.

### 3.2 Modified Endpoints
- `GET /api/v1/user-chat/rooms`:
  - Update the query to filter out rooms where the current user's `UserChatRoomMember.is_archived == True`.
  - For center managers viewing the "Business Inbox" (`BusinessChatStatus`), archiving implies the center as a whole has archived the customer thread. We need a shared `is_archived` state on the `UserChatRoom` table to support this, or managers must archive individually.
  - *Refinement for Business Inbox:* Add `is_archived` (Boolean) to `UserChatRoom` itself, defaulting to `False`. When a manager archives a B2C room, it archives for the whole center.

## 4. Frontend Requirements

### 4.1 Chat Inbox UI
- **Archive Action**: Add an "Archive" button/icon that appears on hover for desktop users (or swipe for mobile) in the `ChatInbox.jsx` list items. Clicking it calls the archive endpoint and optimistically removes the room from the list.

### 4.2 Room Settings UI
- **Archive/Unarchive Toggle**: In `RoomSettings.jsx`, add an "Archive Conversation" button. If the room is already archived (e.g., accessed via direct URL), the button should say "Unarchive Conversation".
- **Unfollow Integration**: For B2C broadcast channels, ensure the "Unfollow" option is clearly distinct from "Archive".

## 5. Success Criteria
- [ ] Users can archive personal and business chats to hide them from their inbox.
- [ ] Archived chats automatically reappear in the inbox when a new message is received.
- [ ] Center managers can archive customer chats globally for the business inbox.
- [ ] Users clearly understand the difference between Archiving a broadcast and Unfollowing a center.