# Frontend Standardization Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 6 of the frontend standardization report focusing on removing redundant current-page titles from breadcrumbs across all detail pages.

**Architecture:** We are adopting the modern mobile-first UX practice of truncating the breadcrumb trail to only show the "Upward Navigation Path" and dropping the current page. This eliminates redundancy with the `H1` and saves critical vertical space on mobile devices.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Update DiveSiteDetail Breadcrumbs
**Files:**
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`

- [ ] **Step 1: Remove `diveSite.name` from items array**
Ensure the breadcrumbs array ends at the Region or Country, and does not push the current dive site name as an unlinked item.

### Task 2: Update TripDetail Breadcrumbs
**Files:**
- Modify: `frontend/src/pages/TripDetail.jsx`

- [ ] **Step 1: Remove `generateTripName(trip)` from items array**
The breadcrumbs should only contain `{ label: 'Dive Trips', to: '/dive-trips' }`.

### Task 3: Update RouteDetail Breadcrumbs
**Files:**
- Modify: `frontend/src/pages/RouteDetail.jsx`

- [ ] **Step 1: Remove `route.name` from items array**
The breadcrumbs should end at 'Dive Routes'.

### Task 4: Update DivingCenterDetail Breadcrumbs
**Files:**
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

- [ ] **Step 1: Remove `center.name` from items array**
Ensure the breadcrumbs array ends at the Region or Country.

### Task 5: Update DiveDetail Breadcrumbs
**Files:**
- Modify: `frontend/src/pages/DiveDetail.jsx`

- [ ] **Step 1: Remove `dive.name` from items array**
The breadcrumbs should end at 'Public Dives'.
