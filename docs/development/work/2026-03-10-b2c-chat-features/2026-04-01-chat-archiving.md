# Chat Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement soft-delete/archiving for personal and business chat rooms, with auto-unarchiving upon new messages.

**Architecture:** Add `is_archived` booleans to `user_chat_rooms` and `user_chat_room_members`. Update the `/rooms` GET endpoint to filter out archived rooms. Update `send_message` to reset `is_archived` to `False` for all recipients. Add a PATCH endpoint and UI buttons to toggle the archive state.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Alembic), React (Tailwind CSS).

---

### Task 1: Database Schema Updates

**Files:**
- Modify: `backend/app/models.py`

- [x] **Step 1: Add Archive Flags**
- [x] **Step 2: Generate and Rename Migration**
- [x] **Step 3: Test Migration**
- [x] **Step 4: Commit**

### Task 2: API - Archive Endpoints & Auto-Unarchive

**Files:**
- Modify: `backend/app/schemas/user_chat.py`
- Modify: `backend/app/routers/user_chat.py`

- [x] **Step 1: Update Schemas**
- [x] **Step 2: Add Archive Endpoint**
- [x] **Step 3: Update `list_chat_rooms` to filter archived**
- [x] **Step 4: Implement Auto-Unarchive in `send_message`**
- [x] **Step 5: Commit**

### Task 3: Frontend UI - Archive Buttons

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/components/UserChat/RoomSettings.jsx`

- [x] **Step 1: Add API client method**
- [x] **Step 2: Update RoomSettings**
- [x] **Step 3: Run Frontend Linter**
- [x] **Step 4: Commit**
