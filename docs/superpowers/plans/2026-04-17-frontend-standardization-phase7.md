# Frontend Standardization Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 7 of the frontend standardization report focusing on fixing the unreadable mobile horizontal tabs navigation in DiveSiteDetail.jsx.

**Architecture:** The "Mobile Horizontal Tabs Navigation" section is currently using `overflow-x-auto` (horizontal scrolling, which is forbidden UX) and incredibly small text (`text-[7px]`). We will convert this into a 3-column grid (`grid-cols-3`) on mobile that automatically drops to a 6-column grid (`sm:grid-cols-6`) on slightly larger screens, ensuring no horizontal scrolling is required. We will also bump the font size up to `text-xs`.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Refactor Mobile Navigation Grid

**Files:**
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`

- [ ] **Step 1: Replace Scroll Container with Grid Container**
Remove the horizontal scrolling classes and convert the `flex` navigation container to a `grid`.

```jsx
// Before
      {/* Mobile Horizontal Tabs Navigation */}
      <div className='lg:hidden -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 mb-4 overflow-x-auto hide-scrollbar sticky top-0 bg-gray-50/90 backdrop-blur-sm z-40 py-2 border-b border-gray-200/50'>
        <nav
          className='flex justify-between items-center w-full gap-1 px-1'
          aria-label='Mobile Sections'
        >
// After
      {/* Mobile Grid Navigation */}
      <div className='lg:hidden -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 mb-4 sticky top-0 bg-gray-50/90 backdrop-blur-sm z-40 py-2 border-b border-gray-200/50'>
        <nav
          className='grid grid-cols-3 sm:grid-cols-6 gap-2 px-1'
          aria-label='Mobile Sections'
        >
```

- [ ] **Step 2: Fix Element Formatting**
For each of the 6 anchors (Info, Map, Weather, Routes, Dives, Comments), increase the text size to `text-[10px] sm:text-xs` (or just `text-xs`) and increase the padding/icon sizing to match.
