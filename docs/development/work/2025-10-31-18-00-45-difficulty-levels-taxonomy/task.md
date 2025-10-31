# Update difficulty levels across Divemap

**Status:** Refining
**Created:** 2025-10-31-18-00-45
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

- [ ] Data model and migrations
  - Create `difficulty_levels` table with columns: `id` (PK), `code` (unique), `label` (unique), `order_index` (int)
  - Insert initial rows: (1, 'OPEN_WATER', 'Open Water', 1), (2, 'ADVANCED_OPEN_WATER', 'Advanced Open Water', 2), (3, 'DEEP_NITROX', 'Deep/Nitrox', 3), (4, 'TECHNICAL_DIVING', 'Technical Diving', 4)
  - Add nullable `difficulty_id` FK column to `dive_sites`, `dives`, `parsed_dive_trips` (where difficulty_level exists)
  - Data migration: map current integer values → FK IDs:
    - `dive_sites.difficulty_level` (1→FK id=1, 2→FK id=2, 3→FK id=3, 4→FK id=4)
    - `dives.difficulty_level` (1→FK id=1, 2→FK id=2, 3→FK id=3, 4→FK id=4)
    - `parsed_dive_trips.trip_difficulty_level` (1→FK id=1, 2→FK id=2, 3→FK id=3, 4→FK id=4, NULL→NULL)
  - Remove NOT NULL constraint and default values; change to NULLABLE to support undefined
  - Add FK constraints and indexes on `difficulty_id` columns
  - Drop old `difficulty_level` integer columns after backfill complete

- [ ] Backend models/schemas
  - Add `DifficultyLevel` SQLAlchemy model and relationships
  - Expose `difficulty_code` (nullable) and `difficulty_label` (nullable) in Pydantic schemas
  - Validators accept one of the four codes or null; legacy labels are not accepted

- [ ] Backend routers/logic
  - Update create/update endpoints: accept `difficulty_code` (string) instead of `difficulty_level` (integer)
  - Update list/search endpoints: accept `difficulty_code` (comma-separated) instead of `difficulty_level` (integer), add `include_undefined=true|false`
  - Replace `get_difficulty_label()` calls with relationship lookup to `difficulty.code` or `difficulty.label`
  - Remove `get_difficulty_value()` calls; validate `difficulty_code` directly
  - Sorting by difficulty uses `order_index` via JOIN; apply LEFT JOIN so NULLs are not dropped
  - Aggregations count NULLs under an "Unspecified" bucket

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

- [ ] Tests
  - Backend: mapping migration correctness; create/update null; filters (specified/unspecified/mixed); sorting with NULLs; serialization
  - Frontend: form defaults; clearing a selection; filters including unspecified; display of "Unspecified"

- [ ] Documentation & Changelog
  - Update API reference, user/admin docs, and add changelog entry with current date
  - Describe the taxonomy change and data migration; no deprecation window needed

## Phased Implementation

### Phase 1: Schema and data (single Alembic revision)

- Create `difficulty_levels` table and seed 4 rows (ids 1..4 with codes/labels/order_index)
- Add nullable `difficulty_id` to `dive_sites`, `dives`, `parsed_dive_trips`
- Backfill FK ids from existing integers (1→1, 2→2, 3→3, 4→4; NULL stays NULL)
- Add indexes and FKs (ON DELETE SET NULL)
- Drop old integer `difficulty_level` columns

### Phase 2: Backend models and API

- Add `DifficultyLevel` model and relationships
- Schemas: expose `difficulty_code` (nullable) and `difficulty_label` (nullable)
- Endpoints: accept/filter by `difficulty_code`; add `include_undefined`
- Sorting: use `order_index`; replace helpers with relationship-backed values
- Update OpenAPI (nullable codes, filters, sorting)

### Phase 3: Frontend updates

- Replace integer-based helpers with code-based or fetch levels from API
- Forms: include “Unspecified”; submit `difficulty_code: null`
- Filters: send `difficulty_code` and `include_undefined`
- Rendering: show labels or “Unspecified”; sort by provided order

### Phase 4: Tests and validation

- Backend: migration correctness; create/update null; filters; sorting with NULLs; serialization
- Frontend: form defaults/clearing; filters with unspecified; rendering/snapshots
- Run lint/format/build in containers/venv per project rules

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
  - Step 1: Create `difficulty_levels` table and insert 4 rows
  - Step 2: Add nullable `difficulty_id` columns (no FK constraint yet)
  - Step 3: Backfill using CASE: `UPDATE dive_sites SET difficulty_id = difficulty_level WHERE difficulty_level IN (1,2,3,4)`
  - Step 4: Remove NOT NULL constraint and defaults: `ALTER TABLE ... MODIFY difficulty_id INT NULL`
  - Step 5: Add FK constraints: `ALTER TABLE ... ADD FOREIGN KEY (difficulty_id) REFERENCES difficulty_levels(id)`
  - Step 6: Add indexes on `difficulty_id` columns
  - Step 7: Drop old `difficulty_level` integer columns


