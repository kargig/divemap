# Frontend Standardization Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 8 of the frontend standardization report focusing on removing aggressive truncation from mobile breadcrumbs.

**Architecture:** The `Breadcrumbs.jsx` component artificially limits item widths on mobile (`max-w-[100px]` and `max-w-[150px]`) forcing text truncation. Since we removed the verbose "Current Page" nodes in Phase 6 and the container naturally wraps, this truncation is no longer necessary and actively harms UX by hiding location names. We will remove the truncation classes entirely.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Remove Truncation from Breadcrumbs

**Files:**
- Modify: `frontend/src/components/Breadcrumbs.jsx`

- [ ] **Step 1: Remove truncation from Link items**
```jsx
// Before
              <span className='leading-tight mt-0.5 sm:mt-1 truncate max-w-[100px] sm:max-w-none'>
// After
              <span className='leading-tight mt-0.5 sm:mt-1'>
```

- [ ] **Step 2: Remove truncation from Text items**
```jsx
// Before
            <span className='font-bold sm:font-medium text-gray-900 leading-tight mt-0.5 sm:mt-1 truncate max-w-[150px] sm:max-w-none'>
// After
            <span className='font-bold sm:font-medium text-gray-900 leading-tight mt-0.5 sm:mt-1'>
```
