# Frontend Standardization Phase 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 9 of the frontend standardization report to standardize and reduce the left/right "buffers" (padding) on mobile views, maximizing screen real estate for content.

**Architecture:** Across the application, the top-level container padding on mobile is fragmented (ranging from `px-4` down to `px-2.5`). We will unify the main wrapper across all primary pages to use `px-2` (8px) on mobile, preserving standard padding (`sm:px-4 lg:px-6 xl:px-8`) on larger screens.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Unify Layout Wrapper Paddings

**Files:**
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`
- Modify: `frontend/src/pages/TripDetail.jsx`
- Modify: `frontend/src/pages/DiveDetail.jsx`
- Modify: `frontend/src/pages/RouteDetail.jsx`
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`
- Modify: `frontend/src/pages/DiveSites.jsx`
- Modify: `frontend/src/pages/Dives.jsx`
- Modify: `frontend/src/pages/DiveTrips.jsx`
- Modify: `frontend/src/pages/DivingCenters.jsx`

- [ ] **Step 1: Replace Mobile `px-` classes**
Search for the main layout wrapper (usually starting with `max-w-[95vw]`) and standardize the padding sequence to: `px-2 sm:px-4 lg:px-6 xl:px-8`.

Example replacement in `RouteDetail.jsx`:
```jsx
// Before
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-4 sm:px-6 py-6'>
// After
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
```

Example replacement in `DiveSiteDetail.jsx`:
```jsx
// Before
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2.5 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
// After
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
```

Do this for all the listed files.
