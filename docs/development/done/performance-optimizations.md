# Performance Optimizations for Dives and Dive Sites

## Objective
Following the performance optimizations for `/dive-trips` (#196), this task applies similar improvements to `/dives`, `/dive-sites`, and `/diving-centers`. The goal is to eliminate N+1 queries, consolidate metadata into primary API responses, and standardize the response structure across the application.

## Key Files & Context
- `backend/app/routers/dives/dives_crud.py`: Core dive logic.
- `backend/app/routers/dive_sites.py`: Core dive site logic.
- `backend/app/routers/diving_centers.py`: Core diving center logic.
- `backend/app/schemas/__init__.py`: Response schemas (DiveResponse, DiveSiteResponse, etc.).
- `frontend/src/hooks/useViewportData.js`: Map data fetching hook.
- `frontend/src/components/LeafletMapView.jsx`: Map rendering component.

## Current Issues Identified
1. **Manual N+1 Queries**: Backend endpoints manually query related entities (sites, centers, ratings, counts) in loops.
2. **Redundant API Calls**: Frontend fetches data and counts separately (e.g., `dives` and `dives-count`).
3. **Inconsistent Structure**: Moving from `List[Item]` to `{ items: [], total: N }` without updating all consumers (Map, Admin, Tests).
4. **Schema Rigidity**: Mandatory fields in base schemas (e.g., `name` in `DiveSiteBase`) break `minimal` detail level responses used on the map.

## Proposed Strategy: Full Standardization

### Phase 1: Backend Standardization & Optimization
- **Standardize Structure**: All collection endpoints (`/dives`, `/dive-sites`, `/diving-centers`) MUST return a consistent `{ items, total, page, page_size, ... }` object.
- **Eager Loading**: Use `joinedload` and `selectinload` to fetch relationships efficiently.
- **SQL Aggregation**: Use subqueries or aggregate joins for `average_rating`, `total_ratings`, `comment_count`, and `route_count`.
- **Schema Relaxing**: Update base schemas to make fields like `name`, `latitude`, and `longitude` optional to support `minimal` detail levels without validation errors.
- **Pydantic Compatibility**: Ensure `match_types` dictionary keys are stringified to satisfy Pydantic/JSON requirements.

### Phase 2: Frontend Consumer Alignment
- **Global Hook Update**: Update `useViewportData.js` to strictly handle the new `{ items, total }` structure for all entity types.
- **Map Component Fix**: Update `LeafletMapView.jsx` to correctly extract arrays from the standardized response and remove legacy fallbacks.
- **Admin Pages Synchronization**: Update `AdminDives`, `AdminDiveSites`, and `AdminDivingCenters` to use body-based pagination info instead of headers.
- **Edit/Create Forms**: Update services (e.g., `getDivingCenters`) to maintain backward compatibility for simple array consumers by returning `.items` by default.

### Phase 3: Systematic Test Synchronization
- **Audit**: Identify all tests using list endpoints.
- **Update Assertions**: Move from `assert len(data) == N` to `assert data["total"] == N` and `assert len(data["items"]) == N`.
- **Index Updates**: Change `data[0]` to `data["items"][0]` in all affected test cases.
- **Header Removal**: Eliminate assertions for legacy `X-Total-Count` headers once body-based pagination is confirmed.

## Verification & Validation Plan
1. **Backend Tests**: Run full suite for dives, dive-sites, and diving-centers:
   `cd backend && ./docker-test-github-actions.sh tests/test_dives.py tests/test_dive_sites.py tests/test_diving_centers.py`
2. **Browser Verification**:
   - Visit `/dives`, `/dive-sites`, and `/diving-centers` list views.
   - Verify `/map` renders markers correctly at all zoom levels.
   - Verify Admin tables load and paginate correctly.
3. **Console Audit**: Check browser console for "data.forEach is not a function" or "Uncaught ReferenceError" after each modification.
4. **Log Audit**: Monitor backend logs for Pydantic `ValidationError` or SQLAlchemy `SAWarning` (e.g., Cartesian products).
