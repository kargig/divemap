# B2C Center Profile Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Message Us" and "Follow for Updates" action buttons to the Diving Center profile page so users can initiate B2C chats and subscribe to broadcast announcements.

**Architecture:** Create backend API endpoints for following/unfollowing a center, then update the frontend profile page to display prominent action buttons and wire them up to mutations.

**Tech Stack:** Python (FastAPI, SQLAlchemy), React (Tailwind CSS, React Query).

---

### Task 1: Backend - Broadcast Subscription API

**Files:**
- Modify: `backend/app/routers/diving_centers.py`

- [x] **Step 1: Write Follow Endpoint Implementation**
- [x] **Step 2: Run Tests**
- [x] **Step 3: Commit**

### Task 2: Frontend API Client Updates

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/services/divingCenters.js`

- [x] **Step 1: Update `createChatRoom` to support center IDs**
- [x] **Step 2: Add Follow API Methods**
- [x] **Step 3: Commit**

### Task 3: Frontend Profile Header Action Buttons

**Files:**
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

- [x] **Step 1: Import Components and Hooks**
- [x] **Step 2: Set up Queries and Mutations**
- [x] **Step 3: Render Buttons in Header**
- [x] **Step 4: Run Frontend Linter**
- [x] **Step 5: Commit**
