# Frontend Standardization Phase 11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 11 of the frontend standardization report to unify Dive Trip status colors across the application.

**Architecture:** Dive trips have 5 possible states: `scheduled`, `confirmed`, `cancelled`, `completed`, and `today`. Currently, `DiveTrips.jsx` defines a comprehensive color map, but `TripCard.jsx` hardcodes a simple binary check (`trip.trip_status === 'confirmed' ? green : blue`), breaking the visual design for cancelled or completed trips. We will extract the status color logic into a central utility and apply it universally.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Extract Status Color Utility

**Files:**
- Create: `frontend/src/utils/tripHelpers.js`

- [ ] **Step 1: Extract `getStatusColorClasses`**
Open `frontend/src/utils/tripHelpers.js` and add the exported function to handle trip status colors.

```javascript
export const getStatusColorClasses = (status, isSolid = false) => {
  if (isSolid) {
    // For grid view badges (solid backgrounds)
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500 text-white';
      case 'confirmed':
        return 'bg-green-500 text-white';
      case 'cancelled':
        return 'bg-red-500 text-white';
      case 'completed':
        return 'bg-gray-500 text-white';
      case 'today':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }
  
  // For list view badges (light backgrounds)
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    case 'today':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
```

### Task 2: Standardize `TripCard.jsx`

**Files:**
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Import Utility**
```jsx
// Before
import { formatDate } from '../utils/tripHelpers';
// After
import { formatDate, getStatusColorClasses } from '../utils/tripHelpers';
```

- [ ] **Step 2: Update Grid Badge**
```jsx
// Before
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
                trip.trip_status === 'confirmed'
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white'
              }`}
            >
// After
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${getStatusColorClasses(trip.trip_status, true)}`}
            >
```

- [ ] **Step 3: Update List Badge**
```jsx
// Before
            {!isGrid && trip.trip_status && (
              <span
                className={`sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  trip.trip_status === 'confirmed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                } shrink-0`}
              >
// After
            {!isGrid && trip.trip_status && (
              <span
                className={`sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColorClasses(trip.trip_status, false)} shrink-0`}
              >
```

### Task 3: Clean up `DiveTrips.jsx`

**Files:**
- Modify: `frontend/src/pages/DiveTrips.jsx`

- [ ] **Step 1: Remove duplicate function**
Delete the `getStatusColor` function from `frontend/src/pages/DiveTrips.jsx` as it is no longer used (it was previously dead code left behind).
