# Frontend Standardization Phase 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 10 of the frontend standardization report to unify internal card padding across mobile and desktop views, establishing standard Density Tiers.

**Architecture:** Internal card padding is fragmented (`p-2.5`, `p-4`, etc.). We will standardize to three density tiers: `p-3` (12px) for standard list cards, `p-2` (8px) for compact list cards, and `p-4 sm:p-6` for main detail blocks.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Unify Standard List Cards to `p-3`

**Files:**
- Modify: `frontend/src/components/DiveSiteCard.jsx`
- Modify: `frontend/src/pages/Dives.jsx`
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Standardize `DiveSiteCard.jsx`**
Update the main container padding.
```jsx
// Before
className={`dive-item bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] p-2.5 sm:p-6 hover:shadow-md transition-all duration-200 relative ${compactLayout ? 'p-2 sm:p-4' : 'p-2.5 sm:p-6'}`}
// After
className={`dive-item bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] p-3 sm:p-6 hover:shadow-md transition-all duration-200 relative ${compactLayout ? 'p-2 sm:p-4' : 'p-3 sm:p-6'}`}
```

- [ ] **Step 2: Standardize `Dives.jsx`**
Update the main container padding for list items.
```jsx
// Before
className={`dive-item rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] p-2.5 sm:p-6 hover:shadow-md transition-all duration-200 ${
// After
className={`dive-item rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] p-3 sm:p-6 hover:shadow-md transition-all duration-200 ${
```

- [ ] **Step 3: Standardize `TripCard.jsx`**
Update the main content wrapper padding.
```jsx
// Before
<div className={isGrid ? 'p-4 flex-1 flex flex-col' : 'p-4 sm:p-5 lg:p-4'}>
// After
<div className={isGrid ? 'p-3 sm:p-4 flex-1 flex flex-col' : 'p-3 sm:p-5 lg:p-4'}>
```

### Task 2: Standardize Detail Page Blocks to `p-4 sm:p-6`

**Files:**
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`
- Modify: `frontend/src/pages/TripDetail.jsx`

- [ ] **Step 1: Check `DiveSiteDetail.jsx` blocks**
Ensure the overview block and description blocks use `p-4 sm:p-6`.
```jsx
// Before
      <div
        id='overview'
        className='bg-white p-2.5 sm:p-6 rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6 scroll-mt-20'
      >
// After
      <div
        id='overview'
        className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6 scroll-mt-20'
      >
```

```jsx
// Before
            <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
// After
            <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
```

- [ ] **Step 2: Check `TripDetail.jsx` blocks**
Ensure main blocks use `p-4 sm:p-6` or similar.
