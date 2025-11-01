# Update difficulty levels across Divemap

**Status:** Complete (All phases finished, ready for deployment)
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

- [x] Functional: Existing records map correctly to new levels; unspecified remains null
- [x] Functional: Create/update supports setting or clearing difficulty (null)
- [x] Functional: Filters accept codes and can include unspecified via a flag
- [x] Functional: Sorting by difficulty respects `order_index`; nulls placed last by default
- [x] Functional: Aggregations show an "Unspecified" bucket for nulls (handled by `exclude_unspecified_difficulty` flag with default `false`)
- [x] Quality: Backend lint/tests pass; DB migrations applied cleanly (846 tests passing)
- [x] Quality: Frontend builds, ESLint passes inside container (build successful, ESLint warnings are pre-existing)
- [x] API: `difficulty_code` is nullable and the only accepted field
- [x] UX: Forms include an "Unspecified" option; lists/cards render labels or "Unspecified"
- [x] Docs: API/user docs and changelog updated with current date (November 01, 2025)

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
    - Added `exclude_unspecified_difficulty` parameter to search schemas (default: false)

- [x] Backend routers/logic
  - [x] Helper functions: `get_difficulty_id_by_code()` and `get_difficulty_code_by_id()` added to models.py
  - [x] `dive_sites.py`:
    - [x] Updated imports (DifficultyLevel, get_difficulty_id_by_code)
    - [x] Updated `apply_basic_filters()` to use `difficulty_code` and `exclude_unspecified_difficulty`
    - [x] Updated `search_dive_sites_with_fuzzy()` to accept `difficulty_code` in filters
    - [x] Updated sorting to use `order_index` via LEFT JOIN
    - [x] Updated `get_dive_sites()` endpoint (list) with `difficulty_code` and `exclude_unspecified_difficulty`
    - [x] Updated `get_dive_sites_count()` endpoint with `difficulty_code` and `exclude_unspecified_difficulty`
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
    - [x] Updated `get_dives_count()` to accept `difficulty_code` and `exclude_unspecified_difficulty`
    - [x] Updated `get_dives()` to accept `difficulty_code` and `exclude_unspecified_difficulty`
    - [x] Updated sorting to use `order_index` via LEFT JOIN
    - [x] Updated all response serialization to return `difficulty_code` and `difficulty_label`
  - [x] `dives_admin.py`:
    - [x] Updated all admin endpoints (count, list, get single, update)
    - [x] Updated filtering to use `difficulty_code` and `exclude_unspecified_difficulty`
    - [x] Updated response serialization to return `difficulty_code` and `difficulty_label`
  - [x] `newsletters.py`:
    - [x] Updated parsed dive trip list/search endpoint with `difficulty_code` and `exclude_unspecified_difficulty`
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
  - [x] Aggregations count NULLs under an "Unspecified" bucket (handled by `exclude_unspecified_difficulty` flag with default `false`)

- [x] OpenAPI
  - [x] Documented `difficulty_code` enum values (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING) in all endpoint descriptions
  - [x] Marked `difficulty_code` as nullable in all schemas and endpoint parameters
  - [x] Added `exclude_unspecified_difficulty` query parameter to all relevant endpoints with default `false`
  - [x] All endpoint descriptions and examples updated in API documentation

- [ ] Frontend updates
  - [x] Update `difficultyHelpers.js`: replace integer mapping (1-4) with code-based mapping (`OPEN_WATER`, etc.)
  - [x] Update `getDifficultyOptions()` to return codes with "Unspecified" option
  - [x] Update `getDifficultyLabel()` to work with codes and return 'Unspecified' for null
  - [x] Forms: include an "Unspecified" option; submit `difficulty_code: null` when blank (instead of integer)
    - [x] CreateDiveSite.js updated
    - [x] EditDiveSite.js updated
    - [x] CreateDive.js updated
    - [x] EditDive.js updated
  - [x] Filters: Updated all filter components with `difficulty_code` and `exclude_unspecified_difficulty`
    - [x] UnifiedMapFilters.js
    - [x] DiveSitesFilterBar.js
    - [x] ResponsiveFilterBar.js
    - [x] StickyFilterBar.js
  - [x] API calls: Updated all list pages (DiveSites.js, Dives.js, AdminDiveSites.js, AdminDives.js, DiveTrips.js) to send `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] Rendering: show labels or "Unspecified" for null; sort by `order_index` (backend handles via JOIN)
  - [x] Update remaining API calls: AdminDives, AdminDiveSites, DiveTrips, IndependentMapView.js all updated
  - [x] Update API response parsing: expect `difficulty_code` and `difficulty_label` instead of `difficulty_level` (int/string)

- [x] Backend tests (Phase 2.5)
  - [x] Updated all test files to use `difficulty_code` and `difficulty_id` instead of integer `difficulty_level`
  - [x] Fixed conftest.py fixtures to use `difficulty_id` with DifficultyLevel lookup
  - [x] Updated test_dive_sites.py: API calls use `difficulty_code`, assertions check `difficulty_code` and `difficulty_label`
  - [x] Updated test_dives.py: All 340+ tests updated, including performance tests (fixed `large_dive_dataset` fixture)
  - [x] Updated test_newsletters.py: Added `trip_difficulty_id` to all parsed dive trip test objects
  - [x] Updated test_sorting.py: Sorting tests updated for new difficulty codes and order_index
  - [x] Updated test_privacy.py: Privacy export tests updated
  - [x] Updated test_fuzzy_search.py: Dive site creation uses `difficulty_id`
  - [x] Updated test_system.py: System tests updated
  - [x] Updated test_dive_import_with_profiles.py: Uses `difficulty_code` in import tests
  - [x] Updated test_dive_routes_integration.py: Uses `difficulty_code` in API calls
  - [x] Fixed router endpoint bugs: create_dive_site response serialization, dives_import code conversion
  - [x] All 846 tests pass successfully in Docker test environment

- [x] Frontend tests (Phase 4)
  - [x] Form defaults; clearing a selection (tested with Playwright)
  - [x] Filters including unspecified (tested with Playwright)
  - [x] Display of "Unspecified" (verified in browser testing)
  - [x] Second pass review: Found and fixed 7 additional issues (IndependentMapView, AdminNewsletters, DiveTrips, ResponsiveFilterBar, StickyFilterBar, AdminDiveSites)
  - [x] Run ESLint validation inside container (completed - all fixable errors resolved, build successful)
  - [x] Run build checks (completed - build successful, exit code 0, no compilation errors)

- [x] Documentation & Changelog
  - [x] Updated API reference (`docs/development/api.md`) with new `difficulty_code` parameters and response formats
  - [x] Updated database documentation (`docs/development/database.md`) with new lookup table system
  - [x] Added comprehensive changelog entry dated November 01, 2025
  - [x] Described taxonomy change, data migration, API changes, and frontend/backend updates

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
- [x] All endpoints accept `difficulty_code` (string) and `exclude_unspecified_difficulty` (bool) for filtering
- [x] All responses return `difficulty_code` and `difficulty_label` (both nullable)

### Phase 2.5: Backend Testing ✅ COMPLETE

- [x] Test file updates
  - [x] Updated conftest.py: Fixtures use `difficulty_id` with DifficultyLevel lookup
  - [x] Updated test_dive_sites.py: All difficulty references converted to `difficulty_code`/`difficulty_id`
  - [x] Updated test_dives.py: All 340+ tests updated, performance tests fixed
  - [x] Updated test_newsletters.py: Added `trip_difficulty_id` to prevent filtering of test trips
  - [x] Updated test_sorting.py: Sorting tests updated for new codes and order_index
  - [x] Updated test_privacy.py: Privacy export tests updated
  - [x] Updated test_fuzzy_search.py: Dive site creation uses `difficulty_id`
  - [x] Updated test_system.py: System tests updated
  - [x] Updated test_dive_import_with_profiles.py: Uses `difficulty_code` in import tests
  - [x] Updated test_dive_routes_integration.py: Uses `difficulty_code` in API calls
- [x] Router bug fixes identified and fixed
  - [x] Fixed create_dive_site endpoint: Now returns `difficulty_code` and `difficulty_label` correctly
  - [x] Fixed dives_import.py: Converts `difficulty_code` to `difficulty_id` before creating Dive objects
  - [x] Fixed update_dive_site: Removed redundant db.refresh() calls
  - [x] Fixed newsletters.py: Added validation for invalid difficulty codes
  - [x] Fixed dives_admin.py: Removed duplicate function definition
- [x] Test execution
  - [x] All 846 tests pass in Docker test environment (docker-test-github-actions.sh)
  - [x] Exit code: 0 (success)
  - [x] No test failures or errors remaining
- [x] Migration verification
  - [x] Verified migration applied successfully (0040)
  - [x] Verified difficulty_levels table created with 4 rows
  - [x] Verified FK columns exist and are nullable
  - [x] Verified old columns removed
  - [x] Verified data migration correct (integer values mapped to FK IDs)

### Phase 3: Frontend updates ✅ COMPLETE

- [x] Replace integer-based helpers with code-based or fetch levels from API
  - [x] Updated `difficultyHelpers.js`: Replaced integer mappings with code-based system (OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING)
  - [x] Added `getDifficultyOptions()` helper that includes "Unspecified" option
  - [x] Updated `getDifficultyLabel()` to work with codes and return 'Unspecified' for null
  - [x] Updated `getDifficultyColorClasses()` to work with codes
  - [x] Added `getDifficultyOrder()` for sorting
- [x] Forms: include "Unspecified"; submit `difficulty_code: null`
  - [x] Updated `CreateDiveSite.js`: Changed to `difficulty_code`, uses `getDifficultyOptions()`, submits null for empty
  - [x] Updated `EditDiveSite.js`: Changed to `difficulty_code`, uses API response `difficulty_code` directly
  - [x] Updated `CreateDive.js`: Changed to `difficulty_code`, uses `getDifficultyOptions()`, submits null for empty
  - [x] Updated `EditDive.js`: Changed to `difficulty_code`, uses API response `difficulty_code` directly
- [x] Filters: send `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] Updated `UnifiedMapFilters.js`: Changed to `difficulty_code`, added `exclude_unspecified_difficulty` checkbox
  - [x] Updated `DiveSitesFilterBar.js`: Changed to `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] Updated `ResponsiveFilterBar.js`: Changed to `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] Updated `StickyFilterBar.js`: Changed to `difficulty_code` and `exclude_unspecified_difficulty`
- [x] Rendering: show labels or "Unspecified"; sort by provided order
  - [x] Updated display components to use `difficulty_code` and `difficulty_label` from API responses:
    - [x] DiveSiteDetail.js: Shows `difficulty_code` and `difficulty_label` correctly
    - [x] DiveDetail.js: Shows `difficulty_code` and `difficulty_label` correctly
    - [x] DiveSites.js: Cards display `difficulty_label` from API
    - [x] Dives.js: Cards display `difficulty_label` from API
    - [x] DiveSitesMap.js: Map markers show `difficulty_label` correctly
    - [x] DivesMap.js: Map markers show `difficulty_label` correctly
    - [x] LeafletMapView.js: Tooltips show `difficulty_label` correctly
  - [x] Sorting uses API `order_index` (backend handles via JOIN)
- [x] API calls: Updated all list pages and admin pages
  - [x] Updated `DiveSites.js`: Changed API calls to send `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] Updated `Dives.js`: Changed API calls to send `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] Updated `AdminDiveSites.js`: Filter uses `difficulty_code`, API calls updated
  - [x] Updated `AdminDives.js`: Filter and edit form use `difficulty_code`, filtering logic updated
  - [x] Updated `DiveTrips.js`: Display uses `trip_difficulty_code` and `trip_difficulty_label`
- [x] Response parsing: Updated to expect `difficulty_code` and `difficulty_label`
  - [x] All form components parse API responses correctly
  - [x] All display components use `difficulty_code` and `difficulty_label` from API
  - [x] URL parameters updated to use `difficulty_code` and `exclude_unspecified_difficulty`

### Phase 4: Frontend Testing and Validation ✅ COMPLETE

- [x] Frontend: form defaults/clearing; filters with unspecified; rendering/snapshots
  - [x] Tested with Playwright MCP: Dive Sites List, Detail, Create/Edit forms, Dives List
  - [x] All tested pages display new difficulty taxonomy correctly
  - [x] "Include Unspecified" checkbox functional on all filter components
  - [x] Forms correctly submit `difficulty_code` (string) or `null` for unspecified
  - [x] Display components show `difficulty_label` from API or "Unspecified" for null
  - [x] Fixed issues found during testing (first pass):
    - [x] ResponsiveFilterBar.js: Fixed hardcoded old options in second location
    - [x] AdminDiveSites.js: Fixed filter dropdown to use `getDifficultyOptions()` and `difficulty_code`
    - [x] AdminDives.js: Fixed filter dropdown and edit form to use new system
- [x] Fixed issues found during second pass review:
  - [x] IndependentMapView.js: Updated filter state and URL parsing to `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] AdminNewsletters.js: Changed `trip_difficulty_level` to `trip_difficulty_code` in form data
  - [x] DiveTrips.js: Fixed filter state, error messages, and display to use `trip_difficulty_code` and `trip_difficulty_label`
  - [x] ResponsiveFilterBar.js: Fixed `getActiveFilters()` to use `difficulty_code` with `getDifficultyLabel()`
  - [x] StickyFilterBar.js: Fixed `getActiveFilters()` to use `difficulty_code` with `getDifficultyLabel()`
  - [x] AdminDiveSites.js: Fixed `clearFilters()`, sorting (uses `getDifficultyOrder()`), table display
- [x] Run ESLint validation inside container (completed - 14 auto-fixable errors fixed, 3 remaining formatting issues fixed manually, 930 warnings remain but are pre-existing code quality issues)
- [x] Run build checks (completed - build successful, exit code 0)
- [x] Verified API integration works correctly with backend changes (via browser testing)
- [x] Verified all functional `difficulty_level` references updated to `difficulty_code` (only `sortOptions.js` remains, which is correct)

### Phase 5: Docs and rollout ✅ COMPLETE

- [x] Update API documentation (`docs/development/api.md`):
  - [x] Updated all query parameters from `difficulty_level` to `difficulty_code` and added `exclude_unspecified_difficulty` (default: false)
  - [x] Updated all response examples to show `difficulty_code` and `difficulty_label`
  - [x] Updated all enum descriptions to reflect new code values
  - [x] Updated curl examples to use new `difficulty_code` parameter
  - [x] Added notes about `difficulty_level` sorting using `order_index`
- [x] Update database documentation (`docs/development/database.md`):
  - [x] Updated "Difficulty Level System" section to reflect new lookup table architecture
  - [x] Documented migration 0040 instead of 0024
  - [x] Explained extensibility, data integrity, and nullable support features
- [x] Add changelog entry (`docs/maintenance/changelog.md`):
  - [x] Added comprehensive entry dated November 01, 2025
  - [x] Documented database changes, API changes, frontend changes, backend changes
  - [x] Included migration details, breaking changes, and user experience improvements
- [ ] Deploy backend and frontend in the same release (pending user deployment)
- [ ] Smoke tests: create/list/filter/sort for all levels and unspecified (pending user validation)

## Notes

- Canonical levels and stable codes (extensible):
  - 1: Open Water (`OPEN_WATER`)
  - 2: Advanced Open Water (`ADVANCED_OPEN_WATER`)
  - 3: Deep/Nitrox (`DEEP_NITROX`)
  - 4: Technical Diving (`TECHNICAL_DIVING`)
  - Unspecified is represented as NULL (no row)

- Migration completed: All integer-based difficulty columns have been removed
  - Old system: `dive_sites.difficulty_level` (integer, NOT NULL, default=2)
  - New system: `dive_sites.difficulty_id` (FK to `difficulty_levels`, nullable)
  - Old helper functions (`get_difficulty_label()`, `get_difficulty_value()`) removed
  - New API: Accepts `difficulty_code` (string: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING, or null)
  - API responses return both `difficulty_code` and `difficulty_label` (both nullable)

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

### ✅ Completed (Phase 1, Phase 2, Phase 2.5)

1. **Migration**: Complete Alembic migration with upgrade/downgrade (0040_migrate_difficulty_to_lookup_table.py)
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
6. **Filtering & Sorting**: Updated to use `difficulty_code` with `exclude_unspecified_difficulty` flag (default: false) and `order_index` via JOINs
7. **Backend Testing**: All 846 tests updated and passing:
   - Updated all 10 test files to use `difficulty_code` and `difficulty_id`
   - Fixed router bugs (create endpoints, import conversion, duplicate functions)
   - All tests pass in Docker test environment (docker-test-github-actions.sh)

### ✅ Completed (All Phases)

- Phase 3: Frontend updates ✅ COMPLETE
  - [x] All helper functions updated (difficultyHelpers.js)
  - [x] All form components updated (Create/Edit DiveSite, Create/Edit Dive)
  - [x] All filter components updated (UnifiedMapFilters, DiveSitesFilterBar, ResponsiveFilterBar, StickyFilterBar)
  - [x] All display components updated (DiveSiteDetail, DiveDetail, DiveSites, Dives, Maps, DiveTrips)
  - [x] All API calls updated (DiveSites, Dives, AdminDiveSites, AdminDives, DiveTrips)
  - [x] URL parameters updated to use `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] IndependentMapView.js: Updated filter state and URL parsing to `difficulty_code` and `exclude_unspecified_difficulty`
  - [x] AdminNewsletters.js: Updated form data to use `trip_difficulty_code`
  - [x] ResponsiveFilterBar.js: Fixed `getActiveFilters()` to use `difficulty_code` with `getDifficultyLabel()`
  - [x] StickyFilterBar.js: Fixed `getActiveFilters()` to use `difficulty_code` with `getDifficultyLabel()`
  - [x] AdminDiveSites.js: Fixed filter dropdown, sorting (uses `getDifficultyOrder()`), table display, and clearFilters
  - [x] Fixed issues found during testing and second pass:
    - [x] ResponsiveFilterBar.js: Fixed hardcoded old options in second location
    - [x] AdminDiveSites.js: Fixed filter dropdown, sorting logic (with order_index), table display, and clearFilters
    - [x] AdminDives.js: Fixed filter dropdown and edit form
    - [x] All active filter displays updated to use `difficulty_code`
    - [x] DiveTrips.js: Fixed filter state, error messages, and display
    - [x] IndependentMapView.js: Fixed filter state and URL parsing
- Phase 4: Frontend testing and validation ✅ COMPLETE
  - [x] Browser testing with Playwright MCP completed
  - [x] Second pass comprehensive review completed (7 additional issues found and fixed)
  - [x] All functional `difficulty_level` references migrated to `difficulty_code`
  - [x] Verified API integration works correctly with backend changes
  - [x] ESLint validation completed (14 auto-fixable errors fixed, 3 remaining formatting issues fixed manually)
  - [x] Build checks completed (build successful, exit code 0, no compilation errors)
- Phase 5: Documentation and changelog ✅ COMPLETE
  - [x] API documentation updated with new difficulty_code system
  - [x] Database documentation updated with lookup table architecture
  - [x] Changelog entry added (November 01, 2025)
- Phase 6: Parameter standardization ✅ COMPLETE
  - [x] Renamed parameter from `include_unspecified_difficulty` to `exclude_unspecified_difficulty` across backend and frontend
  - [x] Changed default from `include_unspecified_difficulty: True` to `exclude_unspecified_difficulty: False` across all endpoints
  - [x] Updated backend filtering logic to use inverted condition (`if exclude_unspecified_difficulty: exclude NULL`)
  - [x] Updated frontend state to use `exclude_unspecified_difficulty: false` by default
  - [x] Updated frontend API calls to send `exclude_unspecified_difficulty` directly (no conversion)
  - [x] Updated frontend URL parsing to read/write `exclude_unspecified_difficulty`
  - [x] Updated checkbox label from "Include Unspecified" to "Exclude Unspecified"
  - [x] Updated task.md and api.md with parameter name change
  - [x] Updated API documentation to reflect new default
  - [x] Updated changelog with default behavior change
