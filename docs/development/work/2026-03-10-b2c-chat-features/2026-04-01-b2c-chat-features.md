# B2C Chat Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the user chat subsystem to support B2C messaging, multi-agent business inboxes, automated greetings, and broadcast trip announcements.

**Architecture:** We will extend the existing `UserChatRoom` and `UserChatMessage` models to support a `diving_center_id` and `is_broadcast` flag. We will introduce a new `diving_center_managers` table for shared inbox access. Identity masking will occur at the serialization layer to display the center's logo and name instead of the responding manager's profile.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Alembic), React (Tailwind CSS).

---

### Task 1: Database Schema Updates - Multi-Agent & Center Branding

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas/diving_center.py`

- [x] **Step 1: Add `logo_url` to `DivingCenter`**
- [x] **Step 2: Create `DivingCenterManager` Model**
- [x] **Step 3: Update `DivingCenter` Pydantic Schemas**
- [x] **Step 4: Generate Alembic Migration**
- [x] **Step 5: Rename and Verify Migration**
- [x] **Step 6: Commit**

### Task 2: Database Schema Updates - B2C Chat Rooms & Settings

**Files:**
- Modify: `backend/app/models.py`

- [x] **Step 1: Create Business Status Enum**
- [x] **Step 2: Update `UserChatRoom` Model**
- [x] **Step 3: Create Chat Settings & Followers Models**
- [x] **Step 4: Generate Alembic Migration**
- [x] **Step 5: Rename and Verify Migration**
- [x] **Step 6: Commit**

### Task 3: API - Unified Inbox & Identity Masking

**Files:**
- Modify: `backend/app/schemas/user_chat.py`
- Modify: `backend/app/routers/user_chat.py`

- [x] **Step 1: Update Chat Schemas**
- [x] **Step 2: Update `list_chat_rooms` logic**
- [x] **Step 3: Update Identity Masking in `get_messages`**
- [x] **Step 4: Commit**

### Task 4: API - B2C Room Creation & Auto-Greeting

**Files:**
- Modify: `backend/app/routers/user_chat.py`

- [x] **Step 1: Update `create_chat_room` for B2C**
- [x] **Step 2: Inject Auto-Greeting**
- [x] **Step 3: Commit**

### Task 5: Frontend - B2C Chat UI

**Files:**
- Modify: `frontend/src/components/UserChat/ChatInbox.jsx`
- Modify: `frontend/src/components/UserChat/ChatRoom.jsx`

- [x] **Step 1: Inbox Toggle**
- [x] **Step 2: Quick Replies**
- [x] **Step 3: Commit**
