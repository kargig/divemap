# Nearby Diving Centers with POINT + Global Typeahead

**Status:** Done
**Created:** 2025-10-30-19-47-20
**Agent PID:** 28688
**Branch:** feature/nearby-diving-centers-point
**Started:** 2025-10-30T19:47:20Z

## Original Todo

Pre-populate the diving center selector on dive site edit (e.g., `/dive-sites/:id/edit`) with centers within 100 km sorted by distance, and allow the user to type to match any diving center name globally (even if farther than 100 km).

## Description

Add geospatial support using MySQL `POINT` with SRID 4326 and a spatial index for `diving_centers` so we can efficiently query nearby centers (≤100 km) relative to a dive site's coordinates. Provide two backend endpoints:

- Nearby: return centers within a given radius (default 100 km) sorted by distance.
- Search: global name search across all centers with optional distance-aware ranking when site coordinates are known. On the frontend, replace the limited alphabetical dropdown with an async autocomplete that pre-populates with nearby results and searches globally as the user types.

## Success Criteria

- [x] Functional: Nearby endpoint returns centers within 100 km sorted by distance
- [x] Functional: Search endpoint matches by name across all centers (beyond 100 km)
- [x] Functional: Frontend pre-populates options with nearby centers on load
- [x] Functional: Typing queries the global search and allows selection of distant centers
- [x] Quality: Spatial index present; queries complete quickly on realistic data sizes
- [x] Quality: Linting and formatting pass (backend and frontend)
- [x] Tests: Backend unit/integration tests for distance and search behaviors pass
- [x] Docs: Add/update developer docs describing POINT, backfill, and endpoints

## Implementation Plan

### Backend

- [x] Schema: Add `location POINT SRID 4326 NULL` to `diving_centers`; add `SPATIAL INDEX (location)`
- [x] Backfill: Set `location = ST_SRID(POINT(longitude, latitude), 4326)` where lat/lng present
- [x] Writes: Ensure create/update paths keep `location` in sync with lat/lng (or standardize on `location` as the source of truth)
- [x] Nearby endpoint: `GET /api/diving-centers/nearby?lat=..&lng=..&radius_km=100&limit=50` using spatial prefilter and distance calculation; return a lean payload `{id, name, distance_km [, city, country]}`
- [x] Search endpoint: `GET /api/diving-centers/search?q=..&limit=20[&lat=..&lng=..]` name-based matching (prefix > substring; optional fuzzy), with optional distance for ranking ties
- [x] Permissions: Ensure endpoints respect current auth/roles used for site editing
- [x] Tests: Unit tests for distance calc, bounding boxes, ranking; integration tests for endpoints
- [x] CI: Add MySQL-backed Docker test job to run spatial tests only (marked with `@pytest.mark.spatial`); keep existing SQLite tests for non-spatial logic

### Frontend

- [x] Replace dropdown with async autocomplete component on `dive site edit` page
- [x] On mount: call `nearby` with site coords to pre-populate options
- [x] On type (debounced 250–300 ms): call `search?q=` to fetch global matches
- [x] Display distance badges where coords available; preserve selection even if not in nearby list
- [x] Error handling and empty states (e.g., no coords, no nearby results)
- [x] Tests: Component behavior, debouncing, selection preservation

### Performance/Scalability

- [x] Use spatial index for fast candidate filtering; small, lean responses
- [x] Add indexes on `name` (and consider FULLTEXT when available) for search

### Migration & Rollout

- [x] Alembic migration: add `POINT` column and spatial index; backfill `location` from existing lat/lng
- [x] Deploy backend first; then ship frontend using new endpoints
- [x] Monitor query latency and logs; adjust limits or indexing as needed

## Phases

### Phase 1: Select

- Create branch `feature/nearby-diving-centers-point`
- Initialize this work folder and task.md
- Request commit (Phase 1 message per project rules)

### Phase 2: Refine

- Confirm association multiplicity (single vs multiple centers per site)
- Confirm MySQL spatial support in environments
- Finalize endpoint contracts and response shapes
- Update this file with final plan
- Request commit (Phase 2 message)

### Phase 3: Implement

- Backend: migration, backfill, endpoints, permissions
- Frontend: async autocomplete, nearby pre-population, global search
- Add tests (unit/integration) and markers
- Run lint/format/type checks; run SQLite tests locally; run MySQL spatial tests via Docker job
- Request commit (Phase 3 message)

### Phase 4: Review

- Self-review: edge cases, error paths, performance
- Validate success criteria; verify UI flows
- Re-run all tests and fix issues
- Request commit (Phase 4 message)

#### Validation Checklist (to execute now)

- [x] Backend: Nearby returns centers ≤100 km, sorted by distance, for a known site
- [x] Backend: Search returns prefix first, then substring; distant centers appear
- [x] Backend: MySQL path works (POINT + ST_Distance_Sphere); SQLite fallback removed by decision
- [x] Frontend: Edit Dive Site → Add Diving Center → shows nearby pre-populated list
- [x] Frontend: Typing filters globally; selection persists and can be added
- [x] A11y: No eslint a11y violations in the new selector
- [x] Performance: Nearby/search responses < 300ms on local dataset

#### How to run tests

- SQLite (host venv):
  - Activate venv, set PYTHONPATH and GOOGLE_CLIENT_ID per Testing Standards
  - Run: `python -m pytest tests/ -v`

- MySQL spatial (CI/Docker job):
  - Run the MySQL-backed job that executes tests marked `@pytest.mark.spatial`
  - Verify spatial queries and backfill behave correctly

- Frontend (container):
  - Ensure frontend container is running, check logs for ESLint
  - Navigate to `/dive-sites/{id}/edit` and validate nearby + typeahead flows

#### Findings/Notes

- [x] Defensive migration: idempotent checks for existing column/index; sentinel POINT(0,0) to satisfy NOT NULL for SPATIAL INDEX
- [x] Rollback/rollforward verified: downgrade to 0037 cleans column/index, upgrade to 0038 recreates them; backfill count validated
- [x] Endpoint tests: `/api/v1/diving-centers/nearby` and `/api/v1/diving-centers/search` return expected shapes and ordering on MySQL
- [x] Frontend manual validation completed for nearby pre-population and typeahead selection

### Phase 5: Complete

- Ensure all success criteria are checked
- Move task to done per workflow if approved
- Request commit (Phase 5 message)

## Validation & QA

- Verify nearby results: distances are within radius and sorted ascending
- Verify search: prefix > substring ordering; distant centers appear when typed
- Verify selection persistence when option not in nearby list
- Validate behavior when site has no coordinates (empty nearby; search still works)
- Permissions: endpoints restricted to authorized users
- Non-ASCII and long names render and search correctly

## Testing Strategy

- MySQL (Docker, CI job):
  - Mark spatial tests with `@pytest.mark.spatial`
  - Validate `POINT`, spatial index usage, and `ST_Distance_Sphere` behavior
  - Performance-oriented assertions (reasonable execution times on sample data)

- Frontend:
  - Unit tests for autocomplete: debouncing, API calls, rendering distances, selection persistence
  - Integration tests simulating pre-population then typing to fetch global results

## Rollout & Monitoring

- Deploy backend first; verify nearby endpoint returns expected data
- Enable frontend feature; verify pre-population and search in staging
- Monitor logs: endpoint latency, error rates, query plans if available
- Add simple metrics (counts, average latency) if existing observability supports it

## Backout Plan

- If spatial issues arise, toggle frontend to use existing limited dropdown temporarily
- Backend can temporarily fall back to Haversine-only queries on `latitude/longitude` while keeping POINT column for later

## Review

- [ ] Verify accuracy at 100 km radius; spot-check distances
- [ ] Validate result ordering and selection workflow in the UI
- [ ] Confirm permissions and error handling paths

## Notes

- Both Haversine and `ST_Distance_Sphere` compute spherical distances; spatial index reduces candidates first, improving performance at scale.


