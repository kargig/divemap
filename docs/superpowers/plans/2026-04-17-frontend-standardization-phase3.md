# Frontend Standardization Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 3 of the frontend standardization report focusing on mobile layout fixes for the Trip Details page.

**Architecture:** We will fix the overflowing elements on the Trip Detail mobile view. This includes making the trip image responsive (`w-full` on mobile), making the tab navigation scrollable horizontally, and fixing the nested padding and button wrapping issues in the Diving Center tab.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Fix Trip Image Placeholder

**Files:**
- Modify: `frontend/src/components/TripHeader.jsx`

- [ ] **Step 1: Make Image Responsive**
Update the image container to be full width on mobile, and fixed width on larger screens.

```jsx
// Before
          <div className='mt-6 lg:mt-0 lg:ml-6'>
            <div className='w-64 h-48 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0'>

// After
          <div className='mt-6 lg:mt-0 lg:ml-6 w-full lg:w-auto'>
            <div className='w-full lg:w-64 h-48 sm:h-56 lg:h-48 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0'>
```
*(Also ensure the `img` inside is `w-full h-full object-cover`)*

### Task 2: Fix Tab Overflow in TripDetail

**Files:**
- Modify: `frontend/src/pages/TripDetail.jsx`

- [ ] **Step 1: Make Tabs Wrap on Mobile**
Do NOT use horizontal scrolling (forbidden UX). Instead, force the tabs into a 2-column grid on mobile, and standard flex row on tablet/desktop.

```jsx
// Before
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8 px-6'>

// After
        <div className='border-b border-gray-200'>
          <nav className='grid grid-cols-2 sm:flex sm:space-x-8 px-2 sm:px-6'>
```
*(Also ensure the buttons inside the nav are centered and slightly smaller on mobile to fit perfectly)*

- [ ] **Step 2: Reduce Tab Content Padding on Mobile**
```jsx
// Before
        {/* Tab Content */}
        <div className='p-6'>

// After
        {/* Tab Content */}
        <div className='p-4 sm:p-6'>
```

### Task 3: Fix Diving Center Card Overflow

**Files:**
- Modify: `frontend/src/components/DivingCenterSummaryCard.jsx`

- [ ] **Step 1: Fix Card Padding on Mobile**
Reduce the extreme padding on mobile to give content more room.
```jsx
// Before
    <div className='bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-100'>
// After
    <div className='bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-gray-100'>
```

- [ ] **Step 2: Fix Button Overflow**
Change the flex behavior of the action buttons so they stack on very small screens instead of shrinking their content.
```jsx
// Before
            {user && (
              <div className='flex flex-wrap gap-2 mt-3 w-full'>
                <Button
                  ...
                  className='flex-1 sm:flex-none shadow-sm'
// After
            {user && (
              <div className='flex flex-col sm:flex-row flex-wrap gap-2 mt-4 w-full'>
                <Button
                  ...
                  className='w-full sm:w-auto shadow-sm'
```
*(Apply the class change to both the Message and Follow buttons)*

- [ ] **Step 3: Fix Contact Info Padding**
```jsx
// Before
        <div className='space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 h-fit'>
// After
        <div className='space-y-3 sm:space-y-4 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100 h-fit'>
```

### Task 4: Standardize TripDetail Typography & Buttons

**Files:**
- Modify: `frontend/src/pages/TripDetail.jsx`
- Modify: `frontend/src/components/TripHeader.jsx`

- [ ] **Step 1: Use Unified Buttons in TripDetail**
Replace raw `<button>` elements with the unified `<Button>` component in `TripDetail.jsx`. Apply standard variants (`primary`, `secondary`, `danger`, `white`).

- [ ] **Step 2: Eradicate Micro-Text in TripHeader**
Change `text-[10px]` to `text-xs` in the metadata labels of `TripHeader.jsx`.jsx
// Before
    <div className='bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-100'>
// After
    <div className='bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-gray-100'>
```

- [ ] **Step 2: Fix Button Overflow**
Change the flex behavior of the action buttons so they stack on very small screens instead of shrinking their content.
```jsx
// Before
            {user && (
              <div className='flex flex-wrap gap-2 mt-3 w-full'>
                <Button
                  ...
                  className='flex-1 sm:flex-none shadow-sm'
// After
            {user && (
              <div className='flex flex-col sm:flex-row flex-wrap gap-2 mt-4 w-full'>
                <Button
                  ...
                  className='w-full sm:w-auto shadow-sm'
```
*(Apply the class change to both the Message and Follow buttons)*

- [ ] **Step 3: Fix Contact Info Padding**
```jsx
// Before
        <div className='space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 h-fit'>
// After
        <div className='space-y-3 sm:space-y-4 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100 h-fit'>
```
