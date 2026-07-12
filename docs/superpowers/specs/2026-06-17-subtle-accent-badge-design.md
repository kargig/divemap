# Spec: Subtle Accent Badge UI Enhancement for Infinite Scrolling List Pages

**Date:** 2026-06-17  
**Status:** Approved  
**Author:** Gemini CLI UX Expert  

---

## 1. Objective & Purpose
With the implementation of infinite scrolling across major list views on Divemap, users lose the pagination context (e.g., "Page 1 of 5"). Displaying a dynamic total count of matching results near the page title ensures better user orientation, feedback, and interactive responsiveness.

We will introduce a **Subtle Accent Badge** (a colored "pill" or badge) directly inline next to each page's main heading (`h1`) across the five major search/list pages. This will dynamically display the number of active, filtered items currently matching the user's filters and search query.

---

## 2. Target Pages & Data Sources
We will enhance the following pages:
1.  **Dive Sites** (`DiveSites.jsx`): Matches `infiniteDiveSitesData?.pages[0]?.total`
2.  **Diving Centers** (`DivingCenters.jsx`): Matches `infiniteDivingCentersData?.pages[0]?.total`
3.  **Dives** (`Dives.jsx`): Matches `infiniteDivesData?.pages[0]?.total`
4.  **Dive Trips** (`DiveTrips.jsx`): Matches `infiniteTripsData?.pages[0]?.total`
5.  **Dive Routes** (`DiveRoutes.jsx`): Matches `infiniteRoutesData?.pages[0]?.total`

---

## 3. Core Component Architectures

### 3.1 `PageTitle` Component (`frontend/src/components/PageTitle.jsx`)
Standardized to accept a `badge` prop and display it inline with nice spacing, background, borders, and dark mode support.
- **Responsiveness:** We use `flex-wrap gap-2` to ensure that on small screens (like 320px portrait mode), the badge wraps gracefully below the text instead of causing horizontal overflow or squeezing adjacent elements.
- **Hover/Static State Color Style:** Blue/Subtle Accent styling.

### 3.2 `PageHeader` Component (`frontend/src/components/PageHeader.jsx`)
Standardized to accept a `badge` prop and forward it cleanly to `PageTitle`.

---

## 4. Visual Styles (Tailwind CSS)
The badge will be rendered with the following classes:
- **Badge Container:**
  `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-semibold border transition-all duration-300`
- **Light Mode Colors:**
  `bg-blue-50 text-blue-600 border-blue-100`
- **Dark Mode Colors:**
  `dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30`

---

## 5. Success Criteria & Verification Plan
- **Verification of no horizontal scrolling:** Using browser snapshot or listing console errors.
- **Dynamic behavior:** Verifying that filtering (e.g. searching for a country or tag) changes the badge count dynamically.
- **Styling consistency:** Consistent across all five list pages.
