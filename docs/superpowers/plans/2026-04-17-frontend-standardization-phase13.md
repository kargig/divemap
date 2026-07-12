# Frontend Standardization Phase 13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 13 of the frontend standardization report to visually differentiate "Completed" and "Cancelled" dive trips at the card level.

**Architecture:** Currently, only the label/badge changes color when a trip is past/cancelled. The entire `TripCard.jsx` continues to use the active True Blue (`rgb(0,114,178)`) left-border and (in Grid view) the active Blue background for the placeholder image. This creates cognitive dissonance. We will dynamically adjust the card border and grid background to a muted gray if the trip is "completed" or "cancelled".

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Dynamically Style Trip Cards

**Files:**
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Get Status Variables**
Ensure `displayStatus` is calculated *before* `cardClasses` are defined.

```jsx
// Before
  const tripName = generateTripName(trip);
  const tripSlug = slugify(tripName);
  const tripUrl = `/dive-trips/${trip.id}/${tripSlug}`;
  const displayStatus = getDisplayStatus(trip);

  // Card classes based on view mode
  const cardClasses = isGrid
// After
  const tripName = generateTripName(trip);
  const tripSlug = slugify(tripName);
  const tripUrl = `/dive-trips/${trip.id}/${tripSlug}`;
  const displayStatus = getDisplayStatus(trip);
  const isInactive = displayStatus === 'completed' || displayStatus === 'cancelled';

  // Determine dynamic border color
  const borderLeftColor = isInactive ? 'border-l-gray-400' : 'border-l-[rgb(0,114,178)]';
```

- [ ] **Step 2: Update `cardClasses`**
Inject the dynamic `borderLeftColor`.

```jsx
// Before
  const cardClasses = isGrid
    ? 'bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300'
    : `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] mb-6 hover:shadow-md transition-shadow duration-300 relative ${
        !user ? 'pointer-events-none' : ''
      }`;
// After
  const cardClasses = isGrid
    ? `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderLeftColor} overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300`
    : `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderLeftColor} mb-6 hover:shadow-md transition-shadow duration-300 relative ${
        !user ? 'pointer-events-none' : ''
      }`;
```

- [ ] **Step 3: Update Grid Background Color**
Change the blue background of the calendar placeholder to a muted gray if inactive.

```jsx
// Before
      {isGrid && (
        <div className='relative h-48 bg-blue-600 flex items-center justify-center text-white overflow-hidden'>
// After
      {isGrid && (
        <div className={`relative h-48 ${isInactive ? 'bg-gray-500' : 'bg-divemap-blue'} flex items-center justify-center text-white overflow-hidden`}>
```

- [ ] **Step 4: Dim the Card Background (Optional but Recommended)**
Apply a slight opacity drop or background tint to inactive cards.

```jsx
// Before
  const cardStyle = !user && !isGrid ? { filter: 'blur(1.5px)' } : {};
// After
  const cardStyle = {
    ...(!user && !isGrid ? { filter: 'blur(1.5px)' } : {}),
    ...(isInactive ? { opacity: 0.85, backgroundColor: '#f9fafb' } : {}),
  };
```
