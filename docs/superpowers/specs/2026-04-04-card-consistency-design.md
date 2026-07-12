# Design Spec: Mobile Card Consistency

## Overview
The goal of this project is to standardize the design and interactive elements of list cards across the main five listing pages (`/dives`, `/dive-sites`, `/dive-routes`, `/diving-centers`, `/dive-trips`). This ensures a unified user experience, especially on mobile devices.

## Scope
The changes affect the list view card components used in the following files:
- `frontend/src/pages/Dives.jsx`
- `frontend/src/components/DiveSiteCard.jsx`
- `frontend/src/pages/DiveRoutes.jsx`
- `frontend/src/pages/DivingCenters.jsx`
- `frontend/src/components/TripCard.jsx`

## Design Decisions

1. **Card Theme Consistency**
   - All list-view cards will feature a consistent left border accent: `border-l-4 border-l-[rgb(45,107,138)]`.
   - `TripCard.jsx` will be updated to include this border to match the rest of the application.

2. **Title Links**
   - The primary title of every card must be wrapped in a `<Link>` component directing to the respective detail page.

3. **Removal of Redundant Actions**
   - The explicit "View Details" button inside `TripCard.jsx` will be removed.
   - The explicit "View Route" link/text inside `DiveRoutes.jsx` will be removed.

4. **Bottom-Right Chevron Arrow**
   - A `ChevronRight` icon will be placed at the bottom right corner of the footer in every card.
   - The icon will be wrapped in a `<Link>` to the details page, making it a functional clickable element.
   - The arrow will be visible on **both mobile and desktop** viewports. The `sm:hidden` class will be removed from existing implementations (e.g., in `Dives.jsx` and `DiveSiteCard.jsx`).
   - The styling for the chevron wrapper will be standardized to resemble a subtle icon-button (e.g., `flex items-center justify-center w-8 h-8 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors ml-auto`).
   - For `DivingCenters.jsx`, the existing chevron in the action row will be updated to match this styling or adapted as the primary right-aligned navigation icon.