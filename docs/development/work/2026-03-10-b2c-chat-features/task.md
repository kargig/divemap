# B2C Chat Features (Diving Centers to Users)

**Status:** Planning
**Created:** 2026-03-10
**Branch:** feature/b2c-chat

## Objective
Expand the existing Divemap User Chat Subsystem to support B2C (Business-to-Consumer) communication. This will allow regular users to directly message Diving Centers, and allow Diving Center owners/managers to respond from a shared inbox, set up automated greetings, and broadcast announcements to followers.

## Description
Currently, chat is restricted to mutual "Buddies" (user-to-user). To support B2C:
1. **Message Center Button:** Users need a clear "Message Us" call-to-action on the Diving Center profile page.
2. **Business Profiles:** Chats must be directed to the "Diving Center Entity", not a specific user's personal account.
3. **Multi-Agent Support:** Any user with `manager` or `owner` roles for a specific Diving Center must be able to view and reply to messages sent to that center.
4. **Automated Greetings & Quick Replies:** Centers should be able to configure auto-responders.
5. **Broadcast Channels:** One-way communication channels where centers can announce trips or weather updates to subscribed users.

## Success Criteria

### Functional Requirements
- [ ] Users can initiate a chat with a Diving Center from the center's profile page without needing a mutual friendship.
- [ ] Diving Center owners/managers can access a dedicated "Business Inbox" distinct from their personal chats.
- [ ] Messages sent by managers appear to the user as coming from the Diving Center (e.g., center logo and name) rather than the individual manager's personal profile.
- [ ] Owners can configure an automated greeting message that sends instantly when a user opens a new chat.
- [ ] Owners can configure up to 5 clickable "Quick Reply" chips for users (e.g., "Pricing?", "Boat schedule?").
- [ ] Owners can create a "Broadcast Channel".
- [ ] Users can "Subscribe" or "Follow" a Diving Center to automatically join their Broadcast Channel.
- [ ] Only owners/managers can send messages in a Broadcast Channel (one-way communication).

### Quality Requirements
- [ ] Must reuse the existing `UserChatRoom` and `UserChatMessage` infrastructure and encryption (MEK/DEK) logic to maintain security.
- [ ] The `after_updated_at` polling optimization must continue to work flawlessly for business inboxes.
- [ ] Proper database indexing to support fast queries for "all chats where center_id = X".

## Technical Architecture & Design Choices

### 1. How do we model a "Business" in the Chat System?
Currently, `UserChatRoom` has `is_group` (boolean). We need to support entity-based chats.
**Design Choice:** Add a nullable `diving_center_id` to `UserChatRoom`.
- If `diving_center_id` is set and `is_group` is False, it's a 1-on-1 B2C chat between a User and the Center.
- If `diving_center_id` is set and `is_group` is True, it's a Broadcast Channel.

### 2. How do center owners see messages sent to them?
**Design Choice:** We do NOT automatically add all managers to the `UserChatRoomMember` table for every single customer chat (this would bloat the database).
Instead, we modify the `GET /api/v1/chat/rooms` endpoint.
- For a regular user: Fetch rooms where they are in `UserChatRoomMember`.
- For a center owner/manager: Fetch rooms where they are in `UserChatRoomMember` **UNION** rooms where `diving_center_id` matches a center they manage.
- We will add a "Business Inbox" toggle in the frontend `/messages` UI to separate personal chats from business queries.

### 3. Roles and Permissions (Owner vs Manager)
Currently, a Diving Center has a single `owner_id` who claims the center. To support "Multi-Agent" chat, we will introduce a `DivingCenterManager` table.
- **Owner (Primary):** Has full control over the center. Can edit details, manage chat/broadcasts, delete the center, and invite/remove other users as Managers.
- **Manager (Staff):** Can edit center details and manage the Business Inbox (reply to users, send broadcasts, configure auto-greetings). They CANNOT delete the center or add/remove other managers.

### 4. How do they respond? (Identity Masking)
When a manager replies, the message is stored with their actual `sender_id` for audit purposes.
However, the `ChatMessageResponse` schema will be updated:
- If the room belongs to a `diving_center_id` AND the `sender_id` is a manager of that center, the API will override the sender profile in the response payload to display the Diving Center's name and logo instead of the manager's personal avatar.

### 5. Automated Greetings & Quick Replies
**Design Choice:** Add configuration fields to the `DivingCenter` model (or a new `DivingCenterChatSettings` table):
- `auto_greeting_message` (Text)
- `quick_replies` (JSON array of strings)

When a user clicks "Message Us" and a new room is created:
1. The backend automatically injects the `auto_greeting_message` into the room as the first message (sender_id = null, or a system ID representing the center).
2. The frontend `ChatRoom.jsx` detects the `quick_replies` from the room metadata and renders them as clickable pill buttons above the input textarea.

### 6. Broadcast Channels & Subscriptions
**How do users participate?**
Users cannot reply in Broadcast Channels. The frontend will hide the input textarea and display: "Only admins can post in this channel."

**How do they see and join?**
- A "Follow" button on the Diving Center profile page.
- Clicking "Follow" adds the user to the `UserChatRoomMember` table for that center's designated Broadcast Room.
- The Broadcast Room will appear in their normal Chat Inbox, but with a Megaphone icon indicating it's a broadcast.

**Should owners subscribe users manually?**
**Design Choice: NO.** Strict anti-spam policy. Diving Center owners CANNOT forcefully subscribe users or import email lists to spam them via in-app chat. Users must explicitly opt-in by clicking "Follow" on the center's profile.

## Implementation Plan

### Phase 1: Database Schema Updates
1. **Multi-Agent Support (Managers):** Create a `diving_center_managers` table (`id`, `diving_center_id`, `user_id`, `created_at`, `added_by_id`) to allow the `owner_id` (existing field in `diving_centers`) to invite multiple staff members.
2. Add `diving_center_id` (ForeignKey) to `user_chat_rooms`.
3. Add `is_broadcast` (Boolean) to `user_chat_rooms`.
4. Create `diving_center_chat_settings` table (auto_greeting, quick_replies).
5. Generate Alembic migration.

### Phase 2: API Modifications
1. Update `GET /api/v1/user-chat/rooms` to merge personal rooms with managed business rooms.
2. Update `POST /api/v1/user-chat/rooms` to support creating a room with a `diving_center_id` (bypassing the mutual buddy check).
3. Implement auto-greeting injection logic upon B2C room creation.
4. Modify `GET /api/v1/user-chat/rooms/{id}/messages` to mask manager identities with center branding.

### Phase 3: Frontend - Business Inbox
1. Add a "Personal / Business" toggle at the top of the `ChatInbox.jsx` component for users who manage centers.
2. Update `MessageBubble.jsx` to render center logos when the sender is masked.

### Phase 4: Frontend - Quick Replies & Public Profiles
1. Add "Message Us" button to `DivingCenterDetail.jsx`.
2. Update `ChatRoom.jsx` to render Quick Reply chips.
3. Clicking a Quick Reply populates the input and sends the message instantly.

### Phase 5: Broadcast Channels
1. Add "Follow for Updates" button to `DivingCenterDetail.jsx`.
2. Create API endpoint for owners to create/manage their broadcast channel.
3. Update `ChatRoom.jsx` to disable the input field if `room.is_broadcast` is true and the user is not a manager.
