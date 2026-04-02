# Chat Room UUID Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `UserChatRoom.id` from sequential integers to random UUID strings to prevent enumeration attacks and information disclosure.

**Architecture:** We will transition to string-based UUIDs (36 characters). This requires a coordinated migration of the primary key and all associated foreign keys in the `user_chat_room_members` and `user_chat_messages` tables.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Alembic), MySQL.

---

### Task 1: Update Backend Models & Helper Functions

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/user_chat.py`

- [x] **Step 1: Update `UserChatRoom` Model**
- [x] **Step 2: Update Child Models**
- [x] **Step 3: Fix type hints in Router**
- [x] **Step 4: Commit**

### Task 2: Custom Alembic Migration (Data Preservation)

**Files:**
- Create: `backend/migrations/versions/XXXX_migrate_chat_to_uuid.py`

- [x] **Step 1: Generate Empty Migration**
- [x] **Step 2: Implement the multi-stage migration logic**
- [x] **Step 3: Run and Verify Migration**
- [x] **Step 4: Commit**

### Task 3: Frontend Update - Remove Integer Parsing

**Files:**
- Modify: `frontend/src/pages/Messages.jsx`
- Modify: `frontend/src/components/UserChat/ChatInbox.jsx`

- [x] **Step 1: Update `Messages.jsx`**
- [x] **Step 2: Update `ChatInbox.jsx`**
- [x] **Step 3: Run Frontend Linter**
- [x] **Step 4: Commit**
