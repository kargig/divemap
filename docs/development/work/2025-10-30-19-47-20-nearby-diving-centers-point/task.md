# Nearby Diving Centers with POINT + Global Typeahead

**Status:** In Progress
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

- [ ] Functional: Nearby endpoint returns centers within 100 km sorted by distance
- [ ] Functional: Search endpoint matches by name across all centers (beyond 100 km)
- [ ] Functional: Frontend pre-populates options with nearby centers on load
- [ ] Functional: Typing queries the global search and allows selection of distant centers
- [ ] Quality: Spatial index present; queries complete quickly on realistic data sizes
- [ ] Quality: Linting and formatting pass (backend and frontend)
- [ ] Tests: Backend unit/integration tests for distance and search behaviors pass
- [ ] Docs: Add/update developer docs describing POINT, backfill, and endpoints

## Implementation Plan

### Backend

- [ ] Schema: Add `location POINT SRID 4326 NULL` to `diving_centers`; add `SPATIAL INDEX (location)`
- [ ] Backfill: Set `location = ST_SRID(POINT(longitude, latitude), 4326)` where lat/lng present
- [ ] Writes: Ensure create/update paths keep `location` in sync with lat/lng (or standardize on `location` as the source of truth)
- [ ] Nearby endpoint: `GET /api/diving-centers/nearby?lat=..&lng=..&radius_km=100&limit=50` using spatial prefilter and distance calculation; return a lean payload `{id, name, distance_km [, city, country]}`
- [ ] Search endpoint: `GET /api/diving-centers/search?q=..&limit=20[&lat=..&lng=..]` name-based matching (prefix > substring; optional fuzzy), with optional distance for ranking ties
- [ ] Permissions: Ensure endpoints respect current auth/roles used for site editing
- [ ] Tests: Unit tests for distance calc, bounding boxes, ranking; integration tests for endpoints
- [ ] CI: Add MySQL-backed Docker test job to run spatial tests only (marked with `@pytest.mark.spatial`); keep existing SQLite tests for non-spatial logic

### Frontend

- [ ] Replace dropdown with async autocomplete component on `dive site edit` page
- [ ] On mount: call `nearby` with site coords to pre-populate options
- [ ] On type (debounced 250–300 ms): call `search?q=` to fetch global matches
- [ ] Display distance badges where coords available; preserve selection even if not in nearby list
- [ ] Error handling and empty states (e.g., no coords, no nearby results)
- [ ] Tests: Component behavior, debouncing, selection preservation

### Performance/Scalability

- [ ] Use spatial index for fast candidate filtering; small, lean responses
- [ ] Add indexes on `name` (and consider FULLTEXT when available) for search

### Migration & Rollout

- [ ] Alembic migration: add `POINT` column and spatial index; backfill `location` from existing lat/lng
- [ ] Deploy backend first; then ship frontend using new endpoints
- [ ] Monitor query latency and logs; adjust limits or indexing as needed

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

- SQLite (host venv):
  - Unit tests for name search logic, ranking order (without spatial index)
  - Fallback Haversine computation tests where applicable

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


