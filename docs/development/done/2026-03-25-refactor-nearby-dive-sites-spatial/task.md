# Refactor "Nearby Dive Sites" to use Spatial Data

**Status:** Planned
**Created:** 2026-03-25
**Branch:** feature/refactor-nearby-dive-sites-spatial

## Objective
Replace the slow, dynamically calculated Haversine formula used for finding "Nearby Dive Sites" on the Dive Site Details page with a highly optimized, index-backed spatial query using MySQL's native `POINT` type and `ST_Distance_Sphere`.

## Background & Motivation
Currently, `GET /api/v1/dive-sites/{id}/nearby` executes a raw SQL query containing complex trigonometric math (sines and cosines) to calculate distances against every single dive site in the database. Because it performs math on standard `float` columns (`latitude`, `longitude`), MySQL cannot use an index. This results in a full table scan and a massive performance bottleneck as the number of dive sites grows.

Migration `0038` successfully added a `location` column of type `POINT SRID 4326` with a `SPATIAL INDEX` to the `diving_centers` table. To achieve the same blazing-fast proximity searches for Dive Sites, we need to replicate this spatial architecture for the `dive_sites` table.

## Scope & Impact
- **Backend Affected Files**: 
  - `backend/app/models.py` (Update `DiveSite` model with `location` column)
  - `backend/migrations/versions/` (New Alembic migration)
  - `backend/app/routers/dive_sites.py` (Refactor the `/nearby` endpoint)
  - `backend/tests/` (Update or add spatial tests)
- **Frontend Affected Files**:
  - None! The API contract (request parameters and response schema) remains identical.
- **Database**: 
  - Add `location` column to `dive_sites`.
  - Backfill existing data.
  - Add `SPATIAL INDEX`.

## Success Criteria
- [ ] **Functional**: The `/nearby` endpoint returns the exact same dive sites within the 100km radius, sorted by distance.
- [ ] **Performance**: The query uses the new spatial index, entirely avoiding a full table scan.
- [ ] **Data Integrity**: All existing dive sites have their new `location` POINT backfilled correctly from their float `latitude` and `longitude`.
- [ ] **Automation**: SQLAlchemy `before_insert` and `before_update` hooks keep the `location` column in sync whenever a dive site's floats are modified.

## Implementation Steps

### Phase 1: Database Migration & Schema Updates
1. **Model Updates (`backend/app/models.py`)**:
   - Add `location = Column(sa.Text, nullable=False)` to the `DiveSite` class (declared minimally for ORM usage).
   - Implement `@event.listens_for(DiveSite, "before_insert")` and `@event.listens_for(DiveSite, "before_update")` to automatically inject `ST_SRID(POINT(lng, lat), 4326)` into the `location` column, mimicking the logic used for `DivingCenter`.
2. **Alembic Migration (`backend/migrations/versions/`)**:
   - Create a new migration file: `alembic revision -m "add_point_location_to_dive_sites"`.
   - In `upgrade()`:
     - Add `location POINT SRID 4326 NULL` to `dive_sites`.
     - Execute an `UPDATE` statement to backfill data: `SET location = ST_SRID(POINT(longitude, latitude), 4326) WHERE latitude IS NOT NULL...`.
     - Set a sentinel `POINT(0,0)` for rows with NULL coordinates to satisfy the NOT NULL requirement.
     - Modify column to `NOT NULL`.
     - Create the spatial index: `CREATE SPATIAL INDEX idx_dive_sites_location ON dive_sites (location)`.

### Phase 2: Refactoring the Endpoint
1. **API Logic (`backend/app/routers/dive_sites.py`)**:
   - Locate the `get_nearby_dive_sites` endpoint.
   - Delete the raw SQL Haversine query block.
   - Replace it with a spatial query utilizing `ST_Distance_Sphere(location, ST_SRID(POINT(:lng, :lat), 4326))`.
   - *Example Query Structure*:
     ```sql
     SELECT ds.id, ds.name, ds.description, ds.latitude, ds.longitude, ...
            ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) / 1000 AS distance_km
     FROM dive_sites ds
     WHERE ds.id != :site_id
       AND ds.location IS NOT NULL
       AND ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) <= 100000 -- 100km in meters
     ORDER BY distance_km ASC
     LIMIT :limit
     ```

### Phase 3: Testing & Verification
1. **Unit Tests**:
   - Run the MySQL-backed Docker test job (`./docker-test-github-actions.sh`).
   - Ensure `test_dive_sites.py` passing, specifically the nearby endpoints.
   - Add a `@pytest.mark.spatial` marker to the nearby dive site tests if they aren't already included in that suite.
2. **Manual Verification**:
   - Create a dive site via the UI and verify the `location` column populates correctly in the database.
   - Edit an existing dive site's coordinates and verify the `location` POINT updates.
   - Open a Dive Site Detail page and expand "Nearby Dive Sites" to verify they render quickly and accurately.

## Rollback Strategy
If the migration fails or causes unexpected side-effects, the Alembic `downgrade()` function will drop the spatial index and the `location` column. The backend can be reverted to the previous commit containing the Haversine formula, completely restoring original functionality.