# Frontend Standardization Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 5 of the frontend standardization report focusing on unifying the detail page headers, back buttons, and action icons.

**Architecture:** Detail pages like `TripDetail.jsx`, `DiveDetail.jsx`, and `RouteDetail.jsx` currently use disparate patterns for back navigation (e.g., text links above the title) and action icons. We will standardize these to use the icon-only `<ArrowLeft>` positioned to the left of the `H1` title, mirroring `DiveSiteDetail.jsx`, and fix the inconsistent `<Share2>` icon.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Fix Share Icon in TripDetail

**Files:**
- Modify: `frontend/src/pages/TripDetail.jsx`

- [ ] **Step 1: Replace `<Navigation>` with `<Share2>`**
Replace the `<Navigation>` component with `<Share2>` for the Share button to match the rest of the application. Change the action buttons to just say "Edit" and "Delete" instead of "Edit Trip" and "Delete Trip".

### Task 2: Standardize Detail Page Headers

**Files:**
- Modify: `frontend/src/components/TripHeader.jsx`
- Modify: `frontend/src/pages/DiveDetail.jsx`
- Modify: `frontend/src/pages/RouteDetail.jsx`

- [ ] **Step 1: Refactor `TripHeader.jsx` Header**
Move the back button next to the `h1` and wrap them in a flex container. Remove the "Back to Trips" text.

- [ ] **Step 2: Refactor `DiveDetail.jsx` Header**
Move the back button next to the `h1` and wrap them in a flex container. Apply `font-display` to the `h1`.

- [ ] **Step 3: Refactor `RouteDetail.jsx` Header**
Move the back button next to the `h1` and wrap them in a flex container. Remove the "Back" text. Apply `font-display` to the `h1`.
