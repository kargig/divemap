# Frontend Standardization Phase 12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 12 of the frontend standardization report to ensure past dive trips automatically display as "Completed", enforcing consistent business logic across the UI.

**Architecture:** The logic to convert past "scheduled/confirmed" trips into "completed" trips (`getDisplayStatus`) currently lives as dead code inside `DiveTrips.jsx` and `AdminNewsletters.jsx`. We will extract this to `utils/tripHelpers.js` and pipe it directly into `TripCard.jsx` and `TripHeader.jsx` so the badges accurately reflect reality.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Extract Display Status Utility

**Files:**
- Modify: `frontend/src/utils/tripHelpers.js`

- [ ] **Step 1: Export `getDisplayStatus`**
Add the time-aware status conversion logic to the utility file.

```javascript
export const getDisplayStatus = (trip) => {
  if (!trip || !trip.trip_status || !trip.trip_date) return 'unknown';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tripDate = new Date(trip.trip_date);
  tripDate.setHours(0, 0, 0, 0);

  // If the trip date is in the past and it wasn't cancelled, show it as completed
  if (tripDate < today && trip.trip_status !== 'cancelled') {
    return 'completed';
  }

  // If the trip is exactly today and wasn't cancelled
  if (tripDate.getTime() === today.getTime() && trip.trip_status !== 'cancelled') {
    return 'today';
  }

  return trip.trip_status;
};
```

### Task 2: Implement Utility in TripCard

**Files:**
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Import and Apply**
Import `getDisplayStatus` and replace all raw references to `trip.trip_status` with `displayStatus`.

```jsx
// At top
import { formatDate, getStatusColorClasses, getDisplayStatus } from '../utils/tripHelpers';

// Inside component
  const displayStatus = getDisplayStatus(trip);

// Update grid badge:
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${getStatusColorClasses(displayStatus, true)}`}
            >
              {displayStatus}
            </span>

// Update list badge:
            {!isGrid && displayStatus && (
              <span
                className={`sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColorClasses(displayStatus, false)} shrink-0`}
              >
                {displayStatus}
              </span>
            )}
```

### Task 3: Implement Utility in TripHeader

**Files:**
- Modify: `frontend/src/components/TripHeader.jsx`

- [ ] **Step 1: Update Header Badges**
Import and use the display status logic.

```jsx
// At top
import { formatDate, getStatusColorClasses, getDisplayStatus } from '../utils/tripHelpers';

// Inside component
  const displayStatus = getDisplayStatus(trip);

// Inside render
                  <div className='font-medium text-xs sm:text-base'>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColorClasses(displayStatus, false)}`}
                    >
                      {displayStatus}
                    </span>
                  </div>
```

### Task 4: Clean up Dead Code

**Files:**
- Modify: `frontend/src/pages/DiveTrips.jsx`
- Modify: `frontend/src/pages/AdminNewsletters.jsx`

- [ ] **Step 1: Remove isolated logic**
Remove the localized `getDisplayStatus` functions from both files to prevent duplication.
