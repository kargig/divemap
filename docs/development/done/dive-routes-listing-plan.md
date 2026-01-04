# Implementation Plan: Global Dive Route Listing Page

## Overview
This plan outlines the steps required to implement a dedicated "Dive Routes" listing page in the Divemap frontend. The backend already supports the necessary API endpoints for global listing, searching, filtering, and pagination.

## 1. Frontend: New Page Creation
Create a new page component at `frontend/src/pages/DiveRoutes.js`.

### Key Features:
- **Data Fetching:** Use `useQuery` to call `GET /api/v1/dive-routes/`.
- **Search & Filtering:**
    - Text search for route names and descriptions.
    - Dropdown filter for `route_type` (scuba, walk, swim).
    - Sorting by `created_at` (default) and `name`.
- **UI Layout:**
    - Use a responsive grid or list layout.
    - Reuse the `RoutePreview` component or create a similar card display.
    - Implement pagination controls (Previous/Next) using the `page` and `total_pages` from the API response.
- **Empty State:** Handle cases where no routes match the search criteria.

## 2. Frontend: Routing Configuration
Update `frontend/src/App.js` to include the new route.

- **Import:** `import DiveRoutes from './pages/DiveRoutes';`
- **Route Definition:**
  ```jsx
  <Route path='/dive-routes' element={<DiveRoutes />} />
  ```

## 3. Frontend: Navigation
Update `frontend/src/components/Navbar.js` to provide easy access to the new page.

- **Desktop Navigation:** Add a "Routes" link with the `MapPin` or `Route` icon.
- **Mobile Navigation:** Add the same link to the mobile menu overlay.
- **Consistency:** Ensure the styling matches existing links like "Dives" and "Dive Sites".

## 4. Backend (Optional Enhancements)
While the current backend is sufficient, future improvements could include:
- Adding a `dive_site_name` directly to the `DiveRouteListResponse` to avoid extra lookups if not already included (currently it uses `joinedload(DiveRoute.creator)` but we might want `dive_site` too).
- Improving the `popular` endpoint to support more granular timeframes.

## Verification Steps
- [ ] Verify the page loads all public routes by default.
- [ ] Test the search functionality with partial strings.
- [ ] Test filtering by different route types (scuba vs swim).
- [ ] Verify pagination works correctly when more than 20 routes exist.
- [ ] Ensure the "Dive Site" link on each route card correctly navigates to the site details.
