# Update difficulty levels across Divemap

**Status:** In Progress
**Created:** 2025-10-31-18-00-45
**Started:** 2025-10-31
**Agent PID:** 259015
**Branch:** feature/difficulty-levels-taxonomy

## Original Todo

Change difficulty taxonomy throughout the system:

- Beginner → Open Water
- Intermediate → Advanced Open Water
- Advanced → Deep/Nitrox
- Expert → Technical Diving

And ensure difficulty can be undefined for a `DiveSite` or a `Dive`.

## Description (Refined)

Replace legacy difficulty values with a normalized, extensible taxonomy backed by a lookup table. Support null/unspecified difficulty for both `DiveSite` and `Dive`. Expose stable `difficulty_code` values via the API and UI with human-readable labels, and keep ordering via an `order_index`. Backend and frontend deploy together; no runtime legacy input handling is required. The design allows adding future levels by inserting rows in the lookup table without schema changes.

## Success Criteria

- [ ] Functional: Existing records map correctly to new levels; unspecified remains null
- [ ] Functional: Create/update supports setting or clearing difficulty (null)
- [ ] Functional: Filters accept codes and can include unspecified via a flag
- [ ] Functional: Sorting by difficulty respects `order_index`; nulls placed last by default
- [ ] Functional: Aggregations show an "Unspecified" bucket for nulls
- [ ] Quality: Backend lint/tests pass; DB migrations applied cleanly
- [ ] Quality: Frontend builds, ESLint passes inside container
- [ ] API: `difficulty_code` is nullable and the only accepted field
- [ ] UX: Forms include an "Unspecified" option; lists/cards render labels or "Unspecified"
- [ ] Docs: API/user docs and changelog updated with current date

## Implementation Plan

- [x] Data model and migrations
  - [x] Create `difficulty_levels` table with columns: `id` (PK), `code` (unique), `label` (unique), `order_index` (int)
  - [x] Insert initial rows: (1, 'OPEN_WATER', 'Open Water', 1), (2, 'ADVANCED_OPEN_WATER', 'Advanced Open Water', 2), (3, 'DEEP_NITROX', 'Deep/Nitrox', 3), (4, 'TECHNICAL_DIVING', 'Technical Diving', 4)
  - [x] Add nullable `difficulty_id` FK column to `dive_sites`, `dives`, `parsed_dive_trips` (where difficulty_level exists)
  - [x] Data migration: map current integer values → FK IDs:
    - [x] `dive_sites.difficulty_level` (1→FK id=1, 2→FK id=2, 3→FK id=3, 4→FK id=4)
    - [x] `dives.difficulty_level` (1→FK id=1, 2→FK id=2, 3→FK id=3, 4→FK id=4)
    - [x] `parsed_dive_trips.trip_difficulty_level` (1→FK id=1, 2→FK id=2, 3→FK id=3, 4→FK id=4, NULL→NULL)
  - [x] Remove NOT NULL constraint and default values; change to NULLABLE to support undefined
  - [x] Add FK constraints and indexes on `difficulty_id` columns
  - [x] Drop old `difficulty_level` integer columns after backfill complete
  - **Status**: Migration file `0040_migrate_difficulty_to_lookup_table.py` created with full upgrade/downgrade logic

- [x] Backend models/schemas
  - [x] Add `DifficultyLevel` SQLAlchemy model and relationships
  - [x] Expose `difficulty_code` (nullable) and `difficulty_label` (nullable) in Pydantic schemas
  - [x] Validators accept one of the four codes or null; legacy labels are not accepted
  - **Status**:
    - `DifficultyLevel` model added with relationships to DiveSite, Dive, ParsedDiveTrip
    - Updated schemas: `DiveSiteBase`, `DiveSiteUpdate`, `DiveBase`, `DiveUpdate`, `DiveSiteSearchParams`, `DiveSearchParams`, `ParsedDiveTripCreate`, `ParsedDiveTripUpdate`, `ParsedDiveTripResponse`
    - Added `DifficultyCode` type alias with Literal validation
    - Added `include_undefined` parameter to search schemas

- [x] Backend routers/logic
  - [x] Helper functions: `get_difficulty_id_by_code()` and `get_difficulty_code_by_id()` added to models.py
  - [x] `dive_sites.py`:
    - [x] Updated imports (DifficultyLevel, get_difficulty_id_by_code)
    - [x] Updated `apply_basic_filters()` to use `difficulty_code` and `include_undefined`
    - [x] Updated `search_dive_sites_with_fuzzy()` to accept `difficulty_code` in filters
    - [x] Updated sorting to use `order_index` via LEFT JOIN
    - [x] Updated `get_dive_sites()` endpoint (list) with `difficulty_code` and `include_undefined`
    - [x] Updated `get_dive_sites_count()` endpoint with `difficulty_code` and `include_undefined`
    - [x] Updated `create_dive_site()` to convert `difficulty_code` → `difficulty_id`
    - [x] Updated `update_dive_site()` endpoint to convert `difficulty_code` → `difficulty_id`
    - [x] Updated `get_dive_site()` endpoint (single site) to return `difficulty_code` and `difficulty_label`
    - [x] Updated nearby sites haversine query to JOIN with `difficulty_levels` table
    - [x] Updated all response serialization to return `difficulty_code` and `difficulty_label`
  - [x] `dives_crud.py`:
    - [x] Updated imports (DifficultyLevel, get_difficulty_id_by_code)
    - [x] Updated `create_dive()` to convert `difficulty_code` → `difficulty_id`
    - [x] Updated `update_dive()` endpoint to convert `difficulty_code` → `difficulty_id`
    - [x] Updated `get_dive()` endpoint (single dive) to return `difficulty_code` and `difficulty_label`
    - [x] Updated `get_dive_details()` endpoint to return `difficulty_code` and `difficulty_label`
    - [x] Updated `get_dives_count()` to accept `difficulty_code` and `include_undefined`
    - [x] Updated `get_dives()` to accept `difficulty_code` and `include_undefined`
    - [x] Updated sorting to use `order_index` via LEFT JOIN
    - [x] Updated all response serialization to return `difficulty_code` and `difficulty_label`
  - [x] `dives_admin.py`:
    - [x] Updated all admin endpoints (count, list, get single, update)
    - [x] Updated filtering to use `difficulty_code` and `include_undefined`
    - [x] Updated response serialization to return `difficulty_code` and `difficulty_label`
  - [x] `newsletters.py`:
    - [x] Updated parsed dive trip list/search endpoint with `difficulty_code` and `include_undefined`
    - [x] Updated create/update endpoints to convert `difficulty_code` → `difficulty_id`
    - [x] Updated get single trip endpoint to return `difficulty_code` and `difficulty_label`
    - [x] Updated sorting to use `order_index` via LEFT JOIN
    - [x] Updated all response serialization to return `trip_difficulty_code` and `trip_difficulty_label`
  - [x] `dives_import.py`:
    - [x] Added `convert_difficulty_to_code()` helper function for legacy format conversion
    - [x] Updated import logic to convert old formats (int/string labels) to new `difficulty_code`
    - [x] Updated `confirm_import_dives()` to use `difficulty_code`
    - [x] Updated `convert_to_divemap_format()` to use `difficulty_code`
  - [x] `dives_shared.py`:
    - [x] Removed deprecated imports (`get_difficulty_label`, `get_difficulty_value`)
  - [x] `privacy.py`:
    - [x] Updated privacy export endpoint to return `difficulty_code` and `difficulty_label`
    - [x] Added eager loading of difficulty relationship
  - [x] Replaced all `get_difficulty_label()` calls with relationship lookups (`difficulty.code`, `difficulty.label`)
  - [x] Removed all `get_difficulty_value()` calls (replaced with `convert_difficulty_to_code()` in import)
  - [ ] Aggregations count NULLs under an "Unspecified" bucket (check if needed - may be handled by `include_undefined`)

- [ ] OpenAPI
  - Document `difficulty_code` enum values as dynamic or listed examples; mark nullable
  - Add `include_undefined` query parameter in relevant endpoints

- [ ] Frontend updates
  - Update `difficultyHelpers.js`: replace integer mapping (1-4) with code-based mapping (`OPEN_WATER`, etc.)
  - Update `getDifficultyValue()` to accept/return codes instead of integers
  - Update `getDifficultyLabel()` to work with codes or fetch from API response
  - Forms: include an "Unspecified" option; submit `difficulty_code: null` when blank (instead of integer)
  - Filters: multi-select for codes plus a toggle to include unspecified; send codes in API (not integers)
  - Rendering: show labels or "Unspecified" for null; sort by `order`
  - Update all API calls: change from sending `difficulty_level` (int) to `difficulty_code` (string)
  - Update API response parsing: expect `difficulty_code` and `difficulty_label` instead of `difficulty_level` (int/string)

- [ ] Backend tests (Phase 2.5)
  - Mapping migration correctness
  - Create/update endpoints with null difficulty
  - Filters (specified/unspecified/mixed)
  - Sorting with NULLs
  - Serialization (difficulty_code and difficulty_label in responses)
  - Run lint/format checks
  - Run tests in virtual environment per project rules

- [ ] Frontend tests (Phase 4)
  - Form defaults; clearing a selection
  - Filters including unspecified
  - Display of "Unspecified"
  - Run ESLint validation inside container

- [ ] Documentation & Changelog
  - Update API reference, user/admin docs, and add changelog entry with current date
  - Describe the taxonomy change and data migration; no deprecation window needed

## Phased Implementation

### Phase 1: Schema and data (single Alembic revision) ✅ COMPLETE

- [x] Create `difficulty_levels` table and seed 4 rows (ids 1..4 with codes/labels/order_index)
- [x] Add nullable `difficulty_id` to `dive_sites`, `dives`, `parsed_dive_trips`
- [x] Backfill FK ids from existing integers (1→1, 2→2, 3→3, 4→4; NULL stays NULL)
- [x] Add indexes and FKs (ON DELETE SET NULL)
- [x] Drop old integer `difficulty_level` columns
- **File**: `backend/migrations/versions/0040_migrate_difficulty_to_lookup_table.py`

### Phase 2: Backend models and API ✅ COMPLETE

- [x] Add `DifficultyLevel` model and relationships
- [x] Schemas: expose `difficulty_code` (nullable) and `difficulty_label` (nullable)
- [x] Helper functions: `get_difficulty_id_by_code()`, `get_difficulty_code_by_id()`
- [x] `dive_sites.py`: All endpoints updated (list, count, create, update, get single, nearby sites)
- [x] `dives_crud.py`: All endpoints updated (create, list, count, update, get single, get details)
- [x] `dives_admin.py`: All admin endpoints updated
- [x] `newsletters.py`: All parsed dive trip endpoints updated
- [x] `dives_import.py`: Import logic updated with legacy format conversion helper
- [x] `dives_shared.py`: Removed deprecated imports
- [x] `privacy.py`: Privacy endpoints updated
- [x] Replaced all `get_difficulty_label()` calls with relationship lookups
- [x] Removed all `get_difficulty_value()` calls (replaced with conversion helper in import)
- [x] Sorting: use `order_index` via LEFT JOIN (implemented across all routers)
- [x] OpenAPI: nullable codes, filters documented via schema updates
- [x] All endpoints accept `difficulty_code` (string) and `include_undefined` (bool) for filtering
- [x] All responses return `difficulty_code` and `difficulty_label` (both nullable)

### Phase 2.5: Backend Testing

- [ ] Migration correctness tests
  - Verify data migration maps integers correctly (1→OPEN_WATER, 2→ADVANCED_OPEN_WATER, etc.)
  - Verify NULL values remain NULL after migration
  - Test migration upgrade and downgrade paths
- [ ] Endpoint tests
  - Create endpoints: accept `difficulty_code` and convert to `difficulty_id`
  - Create endpoints: accept `difficulty_code: null` and set `difficulty_id: null`
  - Update endpoints: update difficulty code
  - Update endpoints: clear difficulty (set to null)
  - Get endpoints: return `difficulty_code` and `difficulty_label` correctly
- [ ] Filtering tests
  - Filter by specific `difficulty_code` (returns only matching records)
  - Filter with `include_undefined=true` (includes NULL difficulties)
  - Filter with `include_undefined=false` (excludes NULL difficulties)
  - Filter by invalid code (handles gracefully)
- [ ] Sorting tests
  - Sort by difficulty_level respects `order_index`
  - NULL difficulties placed last (or according to sort order)
  - Sorting works with filters applied
- [ ] Serialization tests
  - Responses include both `difficulty_code` and `difficulty_label`
  - NULL difficulties return `difficulty_code: null` and `difficulty_label: null`
  - Valid codes return correct labels
- [ ] Code quality checks
  - Run lint checks in virtual environment
  - Run format checks
  - All tests pass in virtual environment per project rules

### Phase 3: Frontend updates

- Replace integer-based helpers with code-based or fetch levels from API
- Forms: include “Unspecified”; submit `difficulty_code: null`
- Filters: send `difficulty_code` and `include_undefined`
- Rendering: show labels or “Unspecified”; sort by provided order

### Phase 4: Frontend Testing and Validation

- Frontend: form defaults/clearing; filters with unspecified; rendering/snapshots
- Run ESLint validation inside container
- Run build checks
- Verify all API integration works correctly with backend changes

### Phase 5: Docs and rollout

- Update API/user docs; add dated changelog entry
- Deploy backend and frontend in the same release
- Smoke tests: create/list/filter/sort for all levels and unspecified

## Notes

- Canonical levels and stable codes (extensible):
  - 1: Open Water (`OPEN_WATER`)
  - 2: Advanced Open Water (`ADVANCED_OPEN_WATER`)
  - 3: Deep/Nitrox (`DEEP_NITROX`)
  - 4: Technical Diving (`TECHNICAL_DIVING`)
  - Unspecified is represented as NULL (no row)

- Current state (integer-based):
  - `dive_sites.difficulty_level`: Integer column, NOT NULL, default=2 (intermediate)
  - `dives.difficulty_level`: Integer column, NOT NULL, default=2 (intermediate)
  - `parsed_dive_trips.trip_difficulty_level`: Integer column, NULLABLE
  - Helper functions: `get_difficulty_label(1-4)` → 'beginner'/'intermediate'/'advanced'/'expert'
  - Helper functions: `get_difficulty_value('beginner'/'intermediate'/'advanced'/'expert')` → 1-4
  - API accepts integers 1-4; serializes as string labels

- Legacy integer → New FK mapping for data migration:
  - Integer 1 (beginner) → `difficulty_levels.id=1` (code='OPEN_WATER')
  - Integer 2 (intermediate) → `difficulty_levels.id=2` (code='ADVANCED_OPEN_WATER')
  - Integer 3 (advanced) → `difficulty_levels.id=3` (code='DEEP_NITROX')
  - Integer 4 (expert) → `difficulty_levels.id=4` (code='TECHNICAL_DIVING')
  - NULL (if exists in parsed_dive_trips) → NULL (remains undefined)

- Migration execution details:
  - Step 1: Create `difficulty_levels` table and insert 4 rows ✅
  - Step 2: Add nullable `difficulty_id` columns (no FK constraint yet) ✅
  - Step 3: Backfill using CASE: `UPDATE dive_sites SET difficulty_id = difficulty_level WHERE difficulty_level IN (1,2,3,4)` ✅
  - Step 4: Remove NOT NULL constraint and defaults: `ALTER TABLE ... MODIFY difficulty_id INT NULL` ✅
  - Step 5: Add FK constraints: `ALTER TABLE ... ADD FOREIGN KEY (difficulty_id) REFERENCES difficulty_levels(id)` ✅
  - Step 6: Add indexes on `difficulty_id` columns ✅
  - Step 7: Drop old `difficulty_level` integer columns ✅

## Implementation Status Summary

### ✅ Completed (Phase 1 & Phase 2)

1. **Migration**: Complete Alembic migration with upgrade/downgrade
2. **Models**: DifficultyLevel model + relationships in DiveSite, Dive, ParsedDiveTrip
3. **Schemas**: All Pydantic schemas updated to use `difficulty_code` with `DifficultyCode` type
4. **Routers**: All router files updated:
   - `dive_sites.py`: All endpoints (list, count, create, update, get single, nearby sites)
   - `dives_crud.py`: All endpoints (create, list, count, update, get single, get details)
   - `dives_admin.py`: All admin endpoints
   - `newsletters.py`: All parsed dive trip endpoints
   - `dives_import.py`: Import logic with conversion helper for legacy formats
   - `dives_shared.py`: Removed deprecated imports
   - `privacy.py`: Privacy export endpoint
5. **All deprecated helpers removed**: Replaced `get_difficulty_label()` and `get_difficulty_value()` with relationship lookups
6. **Filtering & Sorting**: Updated to use `difficulty_code` with `include_undefined` flag and `order_index` via JOINs

### ⏳ Pending (Phase 2.5, 3, 4, 5)

- Phase 2.5: Backend testing (migration, endpoints, filtering, sorting, serialization)
- Phase 3: Frontend updates (helpers, forms, filters, rendering)
- Phase 4: Frontend testing and validation
- Phase 5: Documentation and changelog
