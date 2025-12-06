# Add wind overlay and dive site recommendations based on wind conditions

**Status:** In Progress
**Created:** 2025-11-30T11:59:24Z
**Started:** 2025-11-30T12:40:00Z
**Last Updated:** December 8, 2025
**Agent PID:** 121961
**Branch:** feature/wind-overlay-dive-sites-map

## Executive Summary

**Feature Goal:** Add wind overlay to dive sites map showing real-time wind speed/direction with intelligent dive site suitability recommendations based on wind conditions.

**Progress:**

- ✅ Phase 1: Database Schema & Backend API Foundation (100% - COMPLETE)
- ✅ Phase 2: Wind Recommendation Logic (100% - COMPLETE)
- ✅ Phase 3: Frontend Wind Overlay Component (100% - COMPLETE)
- ⏳ Phase 4: Dive Site Suitability Visualization (85% - IN PROGRESS)
  - ✅ Markers show suitability status (colored borders at zoom 12+, increased visibility)
  - ✅ Popups display wind conditions and suitability (fixed wind data display bug)
  - ⏳ Wind suitability filter (frontend UI complete, backend pending)
- ⏳ Phase 5: Integration & Testing (70% - IN PROGRESS)
  - ✅ Wind overlay integrated into IndependentMapView
  - ✅ Wind overlay integrated into DiveSitesMap
  - ✅ Frontend Forms - shore_direction input fields (COMPLETED)
- ⏳ Phase 6: User Experience Polish (60% - IN PROGRESS)

**Recent Fixes:**

- Fixed shore_direction validation: Cannot be set to None (returns 422 error)
- Fixed response serialization: All shore_direction fields now included in API responses
- Updated wind speed threshold: 6.2 m/s is safe threshold (below = safe for diving)
- Added datetime_str support: Wind recommendations for current time or forecasts (max +2 days ahead)
- Fixed Open-Meteo unit issue: Explicitly request wind_speed_unit=ms
- Updated DiveSiteUpdate schema: Added missing shore_direction fields
- Fixed RouteLayer validation in DiveSiteMap.js: Added coordinate validation to prevent "Invalid LatLng" errors
- Updated zoom level display: Changed to match DiveSiteMap style (top-left, white background)
- Removed yellow zoom indicator: Cleaned up WindOverlayToggle tooltip display
- Fixed wind overlay toggle: Changed hardcoded `enabled={true}` to `enabled={windOverlayEnabled}` in LeafletMapView.js and DiveSitesMap.js
- Improved WindOverlay cleanup: Always remove markers when component unmounts or enabled becomes false
- Fixed arrow direction calculation (first attempt): Corrected formula from `(targetDirection - 90 + 360) % 360` to `(360 - targetDirection) % 360` (this was still incorrect)
- Cleaned up WindOverlay.js comments: Removed redundant explanations, kept only essential documentation
- Added wind conditions to dive site popups: Suitability badge, wind speed/direction/gusts, reasoning, and warnings
- Updated dive site markers with colored borders: Show suitability status at zoom 12+ when wind overlay enabled
- Increased border visibility: Changed border width from 2px to 4px and added white outline for better contrast
- Fixed popup wind data bug: Changed from `rec.wind_data.wind_speed` to `rec.wind_speed` (wind data is directly on recommendation object, not nested)
- Updated task.md: Marked Phase 4 markers and popups as complete
- Updated all button colors to colorblind-safe palette: Replaced Tailwind classes (bg-blue-600, bg-green-600, bg-gray-600) with Okabe-Ito colors from UI_COLORS (primary: #0072B2, success: #009E73, neutral: #374151)
- Created button-color-coding-standards.md: Comprehensive documentation for button color usage, implementation examples, and colorblind accessibility guidelines
- Verified wind condition colors are colorblind-safe: All suitability colors (good, caution, difficult, avoid, unknown) use approved Okabe-Ito palette from colorPalette.js
- Fixed variable naming: Renamed `enabled` prop to `isWindOverlayEnabled` in WindOverlay and `isOverlayEnabled` in WindOverlayToggle for better clarity
- Fixed React Query enabled prop: Ensured `shouldFetchWindData` and `shouldFetchRecommendations` are always boolean values using `!!` operator
- Fixed wind arrows at viewport edges: Added 5% margin to map bounds when fetching wind data and filtered points strictly within viewport in WindOverlay.js
- Fixed backend grid generation: Updated `_create_grid_points` to generate points INSIDE bounds (not at edges) with margin to ensure arrows appear within viewport
- Added jitter factor to wind data: Implemented 5x multiplier for wind arrows with small random jitter (20% of grid spacing) for better visual density
- Improved jitter implementation: Added retry logic (up to 10 attempts) to ensure jittered points stay within bounds, maximizing visible arrows
- Created comprehensive backend test suite: Added 71 new tests across 4 test files covering Open-Meteo service, Weather API router, OSM Coastline service, and Meteo API response parsing
- Fixed test cache interference: Resolved test failures in Docker environment by using `monkeypatch` to clear cache before tests that need isolation
- Added datetime selection for wind overlay: Users can now select date/time for wind data (current time or up to +2 days ahead) with clear display of which datetime is being shown
- Fixed backend datetime validation: Rounded max_future to next hour to allow selecting any hour within 2-day window (prevents edge case where selecting hour at 2-day limit fails)
- Fixed datetime display format: Updated to show "22:00" instead of "22" for better clarity in wind data info box
- Fixed test datetime mocking: Added freezegun library (v1.5.5) to simplify datetime mocking in tests, replacing complex manual datetime patching with simple `@freeze_time()` decorator
- Refactored test datetime handling: Updated `test_parse_forecast_response_exact_hour` and `test_fetch_wind_data_single_point_forecast` to use freezegun, reducing test code complexity by ~13 lines per test
- Fixed test cache isolation: Added cache clearing to `test_fetch_wind_data_single_point_caching` using `monkeypatch` to ensure test isolation
- Fixed wind arrow direction calculation: Corrected formula from `(targetDirection - 90 + 360) % 360` to `(targetDirection - 180 + 360) % 360` to properly account for default arrow pointing down (south, 180° compass). Formula now correctly rotates from default down position to target direction
- Changed minimum zoom level: Wind overlay now available at zoom 12-18 (changed from 13-18) for better accessibility
- Added zoom level 12 support: Backend grid spacing updated to 0.10° (~11km) for zoom level 12
- Added logging for debugging: Frontend console logs for bounds calculation and grid point distribution, backend logs for grid point generation
- Reduced frontend margin: Changed from 5% to 2.5% margin for better arrow coverage while still ensuring arrows appear within viewport
- Added visible loading indicator: Centered loading overlay on map showing "Loading wind data..." with spinner when wind data is being fetched (initial load or refetch on map movement)
- Fixed loading state: Updated to use `isFetching` in addition to `isLoading` so loading indicator appears on refetches (map movement, zoom changes, datetime changes)
- Added close button to map info box: Users can now dismiss the map info box showing points count and coordinates
- Enhanced tooltips: Added detailed tooltips to WindOverlayToggle explaining wind overlay features, arrow direction, and zoom requirements
- Created WindOverlayLegend component: Combined legend with tabs for wind arrows and dive site suitability, includes color scales, explanations, and wind speed thresholds
- Added "Show Legend" button: Map button (top right) to show/hide wind overlay legend, similar to "Show Time Slider" button
- Moved map info to button: Changed map info from always visible to toggle button (left side, below zoom buttons) for cleaner UI
- Integrated legends: Added legend toggle buttons and rendering in both IndependentMapView and DiveSitesMap components

---

## Context & Background

### Feature Description

Add a wind overlay feature to the dive sites map that displays real-time wind speed and direction data, and provides intelligent recommendations for which dive sites are suitable for diving based on wind conditions. This feature helps divers avoid sites where wind is blowing directly onto the shore, making entry/exit dangerous or uncomfortable.

### Current State

- Dive sites map exists at `/map?type=dive-sites` using `IndependentMapView` component
- Map uses Leaflet via `LeafletMapView` component
- Dive sites have latitude/longitude but no shore direction field
- No weather/wind data integration exists

### Target State

- Wind overlay toggle button in map controls
- Wind arrows displayed on map showing speed and direction
- Dive sites have optional `shore_direction` field (degrees, 0-360)
- Dive sites are color-coded or highlighted based on wind suitability
- Backend API endpoint to fetch wind data from Open-Meteo
- Recommendation logic: avoid sites where wind direction is within ±45° of shore direction

### Shore Direction Data Source

#### Primary Method: Automatic Detection from OpenStreetMap

- Automatically determine shore direction from GPS coordinates using OpenStreetMap coastline data
- Use Overpass API to query for coastline segments (`natural=coastline`) near the dive site
- Find nearest coastline segment and calculate bearing
- Shore direction = perpendicular to coastline (coastline bearing + 90°)
- Fully automated, no API costs, similar to reverse geocoding
- Fallback to manual entry if no coastline found or user wants to override

#### Manual Entry (Fallback/Override)

- Optional field in create/edit forms for manual override
- Users can verify/correct automatically detected direction
- Field is optional (nullable) - automatic detection fills it when possible

### Key Research & Learnings

#### Overpass API Testing

- Overpass API can timeout under load (504 errors) - implemented retry logic and fallback endpoints
- Distance-based confidence works well: <100m = high, 100-500m = medium, >500m = low
- Bearing calculation (coastline + 90°) produces accurate shore directions
- API responses can be large (75KB+) - need efficient parsing
- Multiple Overpass instances available for redundancy
- Successful tests: 37.777450378278026,24.0852531524052 → 152.2° (SSE), 37.7799068396316,24.08582830313313 → 89.0° (E)

#### Wind Speed Research

- **6.2 m/s (~12 knots)**: Safe threshold - below this = safe for diving
- **7.7 m/s (~15 knots)**: Critical threshold - creates 1+ meter waves, rough conditions, difficult entry/exit
- **10 m/s (~20 knots)**: Dangerous threshold - very rough conditions, high risk of strong currents, not recommended
- Wind gusts > 25 knots (~13 m/s) upgrade severity by one level
- Wind speed affects suitability independently of direction (high winds = dangerous regardless)

#### Wind Speed Thresholds (Final Implementation)

- **Safe/Good**: < 6.2 m/s (~12 knots) - Safe for diving, ideal for all divers, minimal waves
- **Moderate/Caution**: 6.2-7.7 m/s (12-15 knots) - Experienced divers OK, beginners cautious
- **Difficult**: 7.7-10 m/s (15-20 knots) - Challenging conditions, experienced divers only
- **Dangerous/Avoid**: > 10 m/s (>20 knots) - Not recommended for shore diving

---

## Phase Definitions (What "Done" Means)

### Phase 1: Database Schema & Backend API Foundation

**Definition of Done:**

- Database migration created and applied successfully
- All database fields added to models and schemas
- OSM coastline service implemented with retry/fallback logic
- Open-Meteo service implemented with caching
- All backend API endpoints functional and tested
- Automatic shore direction detection integrated into create/update flows
- All validation and error handling in place

### Phase 2: Wind Recommendation Logic

**Definition of Done:**

- Wind recommendation service implemented with correct thresholds
- Recommendation endpoint returns accurate suitability calculations
- Wind speed thresholds match research (6.2 m/s safe, 7.7 m/s difficult, 10 m/s avoid)
- Gust handling correctly upgrades severity
- Direction-based logic works correctly (favorable/unfavorable calculations)
- Edge cases handled (null shore_direction, 360° wrap, etc.)

### Phase 3: Frontend Wind Overlay Component

**Definition of Done:**

- WindOverlay component renders wind arrows on map
- WindOverlayToggle component enables/disables overlay with zoom restrictions
- Wind overlay integrated into LeafletMapView
- Zoom level 12-18 restriction enforced (toggle disabled < 12, auto-hide < 12)
- Wind data fetching debounced and cached
- Performance optimized (max arrows, React.memo, lazy loading)
- Datetime selection: Users can select date/time for wind data (current or up to +2 days ahead)
- Datetime display: Clear indication on map showing which datetime wind data represents

### Phase 4: Dive Site Suitability Visualization

**Definition of Done:**

- Dive site markers show suitability status (color/badge)
- Dive site popups display wind conditions and suitability
- Wind suitability filter added to dive sites list/map
- All visual indicators clear and understandable

### Phase 5: Integration & Testing

**Definition of Done:**

- Wind overlay integrated into IndependentMapView
- Wind overlay integrated into DiveSitesMap
- All tests pass (mobile, error handling, performance, edge cases)
- Zoom level restrictions verified
- Integration with existing map features verified

### Phase 6: User Experience Polish

**Definition of Done:**

- Tooltips/help text added
- Legends added (wind arrows, suitability colors)
- Accessibility verified (keyboard navigation, screen readers)
- Loading indicators and error messages implemented
- Wind conditions added to dive site detail pages
- Admin tools for shore direction management (optional)

---

## Completed Work

### Phase 1: Database Schema & Backend API Foundation ✅

**Database Schema:**

- ✅ Migration `0042_add_shore_direction_fields_to_dive_sites.py` created and applied
- ✅ Added `shore_direction DECIMAL(5, 2)` nullable, 0-360 degrees
- ✅ Added `shore_direction_confidence ENUM('high', 'medium', 'low')` nullable
- ✅ Added `shore_direction_method VARCHAR(50)` nullable
- ✅ Added `shore_direction_distance_m DECIMAL(8, 2)` nullable

**Models & Schemas:**

- ✅ Updated `DiveSite` model in `backend/app/models.py` with all shore_direction fields
- ✅ Updated Pydantic schemas in `backend/app/schemas.py`:
  - Added fields to `DiveSiteBase`, `DiveSiteCreate`, `DiveSiteUpdate`, `DiveSiteResponse`
  - Added validation: `Field(None, ge=0, le=360)` for shore_direction
  - Added validator to prevent shore_direction from being set to None

**OSM Coastline Service:**

- ✅ Created `backend/app/services/osm_coastline_service.py`
- ✅ Multiple endpoint support with fallback (primary + fallback Overpass instances)
- ✅ Retry logic with exponential backoff
- ✅ Distance calculation using Haversine formula
- ✅ Bearing calculation (coastline + 90°)
- ✅ Confidence levels based on distance (<100m=high, 100-500m=medium, >500m=low)
- ✅ Error handling for timeouts, rate limits, connection errors

**Shore Direction Integration:**

- ✅ Auto-detection on dive site create when coordinates provided
- ✅ Auto-detection on update when coordinates change OR shore_direction is NULL
- ✅ Graceful error handling (doesn't fail dive site creation/update)
- ✅ Validation: shore_direction cannot be set to None (returns 422 error)
- ✅ Response serialization: get_dive_site and update_dive_site endpoints include all shore_direction fields

**Backend Endpoints:**

- ✅ `POST /api/v1/dive-sites/{id}/detect-shore-direction` - Trigger automatic detection
  - Rate limiting (10/minute for admins)
  - Permission checks (admin/moderator/owner)
  - Returns detection result with confidence and distance

**Open-Meteo Service:**

- ✅ Created `backend/app/services/open_meteo_service.py`
- ✅ Single point and grid fetching implemented
- ✅ In-memory caching with TTL (15-30 minutes)
- ✅ Support for current and forecast data (datetime_str parameter)
- ✅ Validation for datetime_str (max +2 days ahead, no past dates)
- ✅ Explicit `wind_speed_unit=ms` parameter to ensure m/s units
- ✅ Error handling and rate limiting
- ✅ Grid point generation: Points generated INSIDE bounds (not at edges) with margin to ensure visibility
- ✅ Jitter factor support: Multiplies wind arrows by configurable factor (default: 5) with small random offsets
- ✅ Jitter retry logic: Retries up to 10 times to ensure jittered points stay within bounds
- ✅ Adaptive grid spacing: Zoom 12 (0.10°), 13-14 (0.08°), 15-16 (0.05°), 17 (0.03°), 18+ (0.02°)

**Weather API Endpoint:**

- ✅ `GET /api/v1/weather/wind` - Fetch wind data for coordinates/bounds
  - Accepts latitude/longitude (single point) OR bounds
  - Supports datetime_str for current or forecast data
  - Returns wind data with metadata
  - Comprehensive test coverage: 9 tests in `test_weather_api.py` covering validation, jitter factor, bounds, and datetime handling

**Main Application:**

- ✅ Added weather router to `backend/app/main.py`

**Backend Test Coverage:**

- ✅ Created `backend/tests/test_open_meteo_service.py` (29 tests)
  - Grid point generation tests (6 tests): Zoom level spacing, point sampling, bounds validation
  - Jitter factor tests (6 tests): Default/custom jitter, bounds validation, retry logic, cache reuse
  - Wind data fetching tests (17 tests): Current/forecast data, API errors, timeouts, caching, date validation
  - All tests use unique coordinates to prevent cache interference
  - Fixed cache interference in Docker environment using `monkeypatch`
  - Refactored to use freezegun for datetime mocking: Simplified `test_fetch_wind_data_single_point_forecast` and `test_fetch_wind_data_single_point_caching` by replacing complex datetime patching with `@freeze_time()` decorator

- ✅ Created `backend/tests/test_weather_api.py` (9 tests)
  - Endpoint validation tests: Jitter factor (min/max/default), bounds validation, datetime validation
  - Single point and grid query tests
  - All tests passing with proper mocking of service layer

- ✅ Created `backend/tests/test_osm_coastline_service.py` (28 tests)
  - Distance/bearing calculation tests (8 tests): Haversine distance, bearing calculations, point-to-segment distance
  - Overpass API querying tests (5 tests): Success, timeout, fallback endpoints, non-JSON responses, invalid JSON
  - Shore direction detection tests (15 tests): Success cases, confidence levels (high/medium/low), multiple segments, invalid geometry, edge cases, exception handling
  - Comprehensive coverage of OSM coastline service functionality

- ✅ Created `backend/tests/test_open_meteo_api_responses.py` (14 tests)
  - Current weather response parsing (4 tests): Complete responses, missing gusts, zero values, high wind values
  - Forecast response parsing (6 tests): Exact hour match, hour not found, mismatched arrays, missing arrays, empty arrays, index out of bounds
  - Edge cases (4 tests): Neither current nor hourly, null values, parameter validation (wind_speed_unit, timezone)
  - Tests verify actual API response structure parsing and error handling
  - Refactored to use freezegun for datetime mocking: Simplified test code by replacing complex datetime patching with `@freeze_time()` decorator

### Phase 2: Wind Recommendation Logic ✅

**Wind Recommendation Service:**

- ✅ Created `backend/app/services/wind_recommendation_service.py`
- ✅ Wind speed threshold: 6.2 m/s for safe diving (below this = safe)
- ✅ Wind speed categories: light (< 6.2 m/s), moderate (6.2-7.7 m/s), strong (7.7-10 m/s), very_strong (> 10 m/s)
- ✅ Gust handling: gusts > 25 knots (13 m/s) upgrade severity by one level
- ✅ Direction-based suitability calculation (favorable/unfavorable)
- ✅ Combined logic for final suitability (good/caution/difficult/avoid/unknown)
- ✅ Edge cases handled: 360° wrap, null shore_direction, boat-only sites

**Recommendation Endpoint:**

- ✅ `GET /api/v1/dive-sites/wind-recommendations` - Get suitability recommendations
  - Supports datetime_str for forecast recommendations
  - Returns recommendations with reasoning and wind_speed_category
  - Includes wind_data in response
  - Handles sites without shore_direction (returns "unknown" suitability)

---

## Pending Work

### Phase 3: Frontend Wind Overlay Component ✅

**Status:** COMPLETED

**Datetime Selection Feature:**

- ✅ Created `WindDateTimePicker` component for selecting wind data datetime
- ✅ **Major rewrite: Replaced dropdown/calendar with slider-based picker using `react-slider`**
  - ✅ Floating design: Slider floats on top of map (z-40) without interfering with map interaction
  - ✅ Slider-based control: Horizontal slider for selecting date/time within -1 hour to +2 days range
  - ✅ Play/pause animation: Automatically advances slider by 3 hours, waits for data to load + minimum 3 second pause
  - ✅ Manual control: Users can drag slider to any date/time within bounds
  - ✅ Date labels: Centered in day ranges (not at day boundaries) for better UX
  - ✅ Day boundary markers: Vertical lines and markers show day transitions at midnight
  - ✅ Timezone display: Shows user's browser timezone (UTC+X format)
  - ✅ Close button: X button in top-right corner to hide slider
  - ✅ Compact design: Reduced height (24px slider, smaller buttons/text), increased width (600px min, 95vw max)
  - ✅ Tooltip: Orange tooltip above slider thumb shows current selected date/time
- ✅ Added datetime state management to `IndependentMapView`, `LeafletMapView`, and `DiveSitesMap`
- ✅ Updated wind data API calls to include `datetime_str` parameter
- ✅ Updated wind recommendations API calls to include `datetime_str` parameter
- ✅ Removed redundant datetime info box: Removed "Wind data for: [timestamp]" box since timestamp is now visible on slider
- ✅ Integrated datetime picker as floating component (visible when wind overlay enabled and zoom >= 12)
- ✅ Validation: Max +2 days ahead, no past dates (min: current time - 1 hour)
- ✅ Backend validation: Rounded max_future to next hour to allow selecting any hour within 2-day window
- ✅ React Query cache keys updated to include datetime for proper cache separation
- ✅ Added `showWindSlider` state: Controls slider visibility, can be hidden/shown via close button
- ✅ Added "Show Time Slider" button: Appears when slider is hidden to allow re-opening

**Tasks:**

- [x] Create `WindOverlay` component in `frontend/src/components/WindOverlay.js`
  - ✅ Display wind arrows on Leaflet map using react-leaflet
  - ✅ Arrow visualization: custom SVG arrows with rotated arrows
  - ✅ Arrow direction = direction wind is GOING (opposite of where wind comes FROM)
  - ✅ Arrow size proportional to wind speed (40px base + 10px per 5 m/s, max 80px) - increased for better visibility
  - ✅ Arrow color coding: Light blue (< 5 m/s), Blue (5-7.7 m/s), Orange (7.7-10 m/s), Red (> 10 m/s)
  - ✅ Arrow direction calculation: Fixed formula to correctly point arrows in the direction wind is going
  - ✅ Arrow visibility: Added white outline/shadow for better contrast against water background
  - ✅ Grid placement: Show wind arrows at grid points from API response
  - ✅ Performance optimization: Limit max arrows (100), debounce map movements
  - ✅ Coordinate validation: Validates lat/lon are valid numbers within valid ranges before creating markers
  - ✅ Zoom level handling: Only show arrows at zoom level 12-18
  - ✅ Hide arrows when zoom < 12 (overlay disabled)
  - ✅ Z-index/layering: Arrows above map tiles but below markers/popups (zIndexOffset: 100)
  - ✅ Tooltips on hover: Show wind speed and direction in popups
  - ✅ Viewport edge filtering: Added 5% margin to bounds when fetching data and filter points strictly within viewport to prevent arrows at edges
  - ✅ Prop naming: Renamed `enabled` to `isWindOverlayEnabled` for better clarity

- [x] Create `WindOverlayToggle` component in `frontend/src/components/WindOverlayToggle.js`
  - ✅ Toggle button to enable/disable wind overlay
  - ✅ Zoom level checking: Disable button when zoom < 12 (now uses accurate zoom from map instance)
  - ✅ Visual feedback: Disabled state (grayed out with tooltip), Enabled state (active button)
  - ✅ Show loading state when fetching data (spinner icon on button)
  - ✅ Auto-disable: Automatically disable overlay when zoom drops below 12
  - ✅ Show current zoom level in tooltip
  - ✅ Removed yellow zoom indicator (cleaner UX)
  - ✅ Prop naming: Renamed `enabled` to `isOverlayEnabled` for better clarity

- [x] Integrate wind overlay into `LeafletMapView.js`
  - ✅ Add WindOverlay component conditionally when enabled AND zoom >= 12
  - ✅ Pass map bounds and zoom level to fetch wind data for visible area
  - ✅ Zoom level restriction: Only fetch/display wind data when zoom >= 12
  - ✅ Zoom change handling: Automatically hide wind overlay when zoom < 12
  - ✅ Debounce map movements: Wait 1s after map stops moving before fetching
  - ✅ Viewport change detection: Only fetch when bounds change significantly
  - ✅ Handle wind data updates via React Query
  - ✅ Lazy loading: Only fetch wind data when overlay toggle is enabled AND zoom >= 12
  - ✅ Cache wind data: Use React Query cache (5min stale, 15min cache) - reduced for better responsiveness
  - ✅ Zoom level monitoring: Auto-disable overlay when zoom < 12
  - ✅ Zoom level display: Updated to match DiveSiteMap style (top-left, white background with border)
  - ✅ Fixed toggle functionality: Changed `enabled={true}` to `enabled={windOverlayEnabled}` to properly respect toggle state
  - ✅ Improved marker cleanup: Always remove markers when overlay is disabled or component unmounts
  - ✅ Fixed arrow direction: Corrected rotation formula from `(targetDirection - 90 + 360) % 360` to `(targetDirection - 180 + 360) % 360` to properly point arrows in the direction wind is going (accounts for default arrow pointing down/south)
  - ✅ Added visible loading indicator: Centered overlay on map showing "Loading wind data..." with spinner when fetching (uses `isFetching` to show on refetches too)
  - ✅ Removed debugging console.log statements: Cleaned up bounds calculation and grid point distribution logs
  - ✅ Reduced frontend margin: Changed from 5% to 2.5% for better arrow coverage
  - ✅ Added close button to map info box: Users can dismiss the info box showing points count and coordinates
  - ✅ Moved map info to button: Changed from always visible to toggle button (left side, below zoom buttons) for cleaner UI
  - ✅ Map info button: Shows "Map Info" button when info box is hidden, positioned at `left-4 top-24`
  - ✅ Fixed z-index layering: Changed slider z-index from z-50 to z-40 and added CSS rules so Leaflet popups (z-1000) can overlay the slider
  - ✅ Removed redundant wind data info box: Removed "Wind data for: [timestamp]" box since timestamp is now visible on slider
  - ✅ Added `onWindFetchingChange` callback: Passes `isFetchingWind` state to parent component for slider play/pause logic

### Phase 4: Dive Site Suitability Visualization ⏳

**Tasks:**

- [x] Update dive site markers to show suitability status
  - ✅ Added colored border/ring to markers (4px width with white outline for visibility)
  - ✅ Green for good, yellow for caution, orange for difficult, red for avoid, gray for unknown
  - ✅ Implementation: Colored border around existing marker icon
  - ✅ Conditional display: Only show suitability indicators when wind overlay is enabled AND zoom >= 12
  - ✅ Z-index: Markers remain above wind arrows
  - ✅ Increased border visibility: Changed from 2px to 4px with white outline for better contrast

- [x] Add suitability information to dive site popups
  - ✅ Display wind conditions and suitability status
  - ✅ Show wind speed in multiple units: m/s and knots (via formatWindSpeed helper)
  - ✅ Show wind direction (degrees and cardinal via formatWindDirection helper)
  - ✅ Show wind gusts if available
  - ✅ Show shore direction if available (in reasoning text)
  - ✅ Detailed reasoning explaining why site is suitable/unsuitable
  - ✅ Wind speed warnings: Warning message for sites without shore_direction
  - ✅ Conditional display: Only show wind info when recommendation is available
  - ✅ Fixed bug: Changed from `rec.wind_data.wind_speed` to `rec.wind_speed` (wind data is directly on recommendation object)

- [x] Add wind suitability filter to dive sites list/map
  - **Backend Implementation:**
    - [x] Add `wind_suitability` query parameter to `GET /api/v1/dive-sites/` endpoint in `backend/app/routers/dive_sites.py`
    - [x] Validate `wind_suitability` parameter (must be one of: 'good', 'caution', 'difficult', 'avoid', 'unknown')
    - [x] Add optional `datetime_str` parameter to allow filtering by forecast wind conditions (default: current time)
    - [x] Implement filtering logic: Fetch wind data for center point of matching dive sites, calculate suitability for each site
    - [x] Filter dive sites based on `wind_suitability` parameter matching recommendation suitability
    - [x] Handle edge cases: Sites without shore_direction (should match 'unknown' filter)
    - [x] Error handling: Gracefully handle wind data fetch failures (returns empty result when filtering)
    - [ ] Optimize performance: Consider batch fetching wind data for multiple dive sites (currently uses center point)
    - [ ] Add caching: Cache wind recommendations to avoid redundant API calls during filtering
    - [ ] Update API documentation: Add `wind_suitability` parameter to endpoint docs
  - **Frontend Implementation:**
    - ✅ Filter UI: Added wind suitability dropdown to `UnifiedMapFilters` component
    - ✅ Filter state: Added `wind_suitability` to filter state in `IndependentMapView.js`
    - ✅ URL params: Added `wind_suitability` to URL parsing and filter keys
    - ✅ API integration: Added `wind_suitability` to allowed filter keys in `useViewportData.js`
    - [ ] Visual indicator: Show count of sites in each category (optional enhancement)
    - [ ] Update filter when wind data changes (optional enhancement)

### Phase 5: Integration & Testing ⏳

**Tasks:**

- [x] Integrate wind overlay into `IndependentMapView.js`
  - ✅ Add WindOverlayToggle to map controls (next to layers button)
  - ✅ Connect to wind data fetching via LeafletMapView
  - ✅ Handle state management (windOverlayEnabled state)
  - ✅ Zoom level tracking: Added `currentZoom` state that tracks actual map zoom from map instance (fixes wind button being disabled incorrectly)
  - ✅ Zoom change handling: Update toggle button state when zoom changes via map instance `zoomend` event
  - ✅ Fixed ReferenceError: Added missing windOverlayEnabled state declaration
  - ✅ Added wind feature promotion banner: Banner appears when wind overlay is disabled, promoting the feature with "Try Wind Overlay" button
  - ✅ Added `handleEnableWindFeature`: Enables wind overlay, shows slider, and zooms to demo location (Lat: 37.7135, Lng: 23.9643)
  - ✅ Added `handleWindOverlayToggle`: Custom toggle handler that automatically shows slider when enabling wind overlay
  - ✅ Added `showWindSlider` state: Controls slider visibility, can be hidden/shown
  - ✅ Added "Show Time Slider" button: Appears when slider is hidden to allow users to re-open it
  - ✅ Added "Show Legend" button: Map button (top right) to show/hide wind overlay legend, similar to "Show Time Slider" button
  - ✅ Removed legend toggle from controls: Moved legend toggle from controls area to map button for better UX

- [x] Integrate wind overlay into `DiveSitesMap.js` (for map view in DiveSites page)
  - ✅ Add toggle button in top-right corner
  - ✅ Display wind overlay when enabled
  - ✅ Fixed toggle functionality: Changed `enabled={true}` to `enabled={windOverlayEnabled}`

- [x] Frontend Forms (COMPLETED)
  - ✅ Added shore_direction input field to `CreateDiveSite.js` form
    - ✅ Number input with min=0, max=360, step=0.01
    - ✅ Placeholder: "Auto-detected from coordinates (or enter manually)"
    - ✅ Helper text: "Shore direction in degrees (0-360). 0° = North, 90° = East, 180° = South, 270° = West"
    - ✅ Optional field (not required)
    - ✅ Manual override allowed
    - ✅ All shore_direction fields included in formData state and submit payload
  - ✅ Added shore_direction input field to `EditDiveSite.js` form
    - ✅ Number input with min=0, max=360, step=0.01
    - ✅ Shows current value from `diveSite.shore_direction`
    - ✅ Shows confidence level if available (`shore_direction_confidence`)
    - ✅ Shows detection method if available (`shore_direction_method`)
    - ✅ Shows distance to coastline if available (`shore_direction_distance_m`)
    - ✅ "Re-detect from coordinates" button triggers `/api/v1/dive-sites/{id}/detect-shore-direction` endpoint
    - ✅ Manual override allowed
    - ✅ All shore_direction fields included in formData state and submit payload

- [ ] Testing Tasks
  - [x] Backend unit tests for Open-Meteo service (`test_open_meteo_service.py`)
    - ✅ 29 tests covering grid generation, jitter logic, API error handling, date validation, and caching
    - ✅ Fixed cache interference issues using `monkeypatch` to clear cache before tests
    - ✅ All tests passing in both local and Docker environments
    - ✅ Refactored to use freezegun: Simplified datetime mocking with `@freeze_time()` decorator, reducing test complexity by ~13 lines per test
  - [x] Backend unit tests for Weather API router (`test_weather_api.py`)
    - ✅ 9 tests covering endpoint validation, jitter factor handling, bounds validation, and datetime validation
    - ✅ All tests passing
  - [x] Backend unit tests for OSM Coastline service (`test_osm_coastline_service.py`)
    - ✅ 28 tests covering distance/bearing calculations, Overpass API querying, shore direction detection, confidence levels, and error handling
    - ✅ Tests cover: Haversine distance, bearing calculations, point-to-segment distance, API retry/fallback logic, confidence thresholds, edge cases (empty responses, invalid geometry, etc.)
    - ✅ All tests passing
  - [x] Backend unit tests for Meteo API response parsing (`test_open_meteo_api_responses.py`)
    - ✅ 14 tests covering current weather parsing, forecast parsing, missing/null values, array mismatches, and edge cases
    - ✅ Tests verify: Response structure parsing, parameter validation (wind_speed_unit, timezone), error handling
    - ✅ All tests passing
    - ✅ Refactored to use freezegun: Simplified datetime mocking with `@freeze_time()` decorator, reducing test complexity
  - [ ] Test wind overlay on mobile devices
  - [ ] Test error handling (API failures, network issues)
  - [ ] Test performance with many dive sites
  - [x] Verify wind data caching works correctly
    - ✅ Cache tests verify TTL behavior, cache hits/misses, and cache cleanup
  - [ ] Test recommendation logic with various wind/shore direction combinations
  - [x] Test Overpass API error handling (timeouts, rate limiting, fallback endpoints, no coastline found)
    - ✅ Comprehensive test coverage in `test_osm_coastline_service.py` for all error scenarios
  - [x] Test shore direction detection (various coordinates, bearing calculations, confidence levels, manual override)
    - ✅ Test coverage includes distance calculations, bearing accuracy, confidence level assignment, and edge cases
  - [ ] Test wind overlay performance (many wind data points, map panning/zooming, mobile touch interactions, debouncing)
  - [ ] Test zoom level restrictions (toggle disabled < 12, auto-hide < 12, enable at 12+, verify no API calls < 12)
  - [ ] Test wind recommendation edge cases (null shore_direction, various wind speeds, gusts, 360° wrap, boat-only sites)
  - [x] Test wind data grid resolution (different zoom levels, grid density adaptation, large/small map bounds)
    - ✅ Grid generation tests verify adaptive spacing for zoom levels 12-18
  - [ ] Test integration with existing map features (all map layers, z-index/layering, marker clustering, route overlays)

### Phase 6: User Experience Polish ⏳

**Tasks:**

- [x] Add tooltips/help text explaining wind overlay
  - ✅ Enhanced tooltips in WindOverlayToggle component with detailed explanations
  - ✅ Explains what wind overlay shows (wind speed and direction)
  - ✅ Explains how to interpret arrows (direction wind is going TO, opposite of where it comes FROM)
  - ✅ Explains suitability colors (green/yellow/orange/red/gray)
  - ✅ Explains zoom requirement: "Wind overlay requires zoom level 12 or higher to avoid excessive API calls"
  - ✅ Shows current zoom level in tooltip
  - ✅ Tooltip appears on hover with title, description, and zoom information

- [x] Add legend explaining wind arrow colors/sizes
  - ✅ Created WindOverlayLegend component with "Wind Arrows" tab
  - ✅ Shows examples of different wind speeds with color swatches
  - ✅ Explains arrow direction meaning (arrows point where wind is going)
  - ✅ Shows color scale: Light blue (< 5 m/s), Blue (5-7.7 m/s), Orange (7.7-10 m/s), Red (> 10 m/s)
  - ✅ Explains arrow size: Larger arrows indicate stronger winds (40px base + 10px per 5 m/s, max 80px)
  - ✅ Includes wind speed thresholds with descriptions

- [x] Add legend explaining dive site suitability colors
  - ✅ Created "Suitability" tab in WindOverlayLegend component
  - ✅ Green: Good conditions (< 6.2 m/s)
  - ✅ Yellow: Caution (6.2-7.7 m/s)
  - ✅ Orange: Difficult (7.7-10 m/s, experienced divers only)
  - ✅ Red: Avoid (> 10 m/s, not recommended)
  - ✅ Gray: Unknown (no shore direction data)
  - ✅ Includes wind speed reference and thresholds
  - ✅ Explains shore direction consideration in suitability calculation

- [x] Ensure accessibility (keyboard navigation, screen readers)
  - ✅ Added ARIA labels to wind overlay toggle button
  - ✅ Added ARIA labels to legend toggle buttons
  - ✅ Added ARIA labels to map info button
  - ✅ Added descriptive text for wind arrows in legend
  - ✅ Keyboard navigation works for all controls (buttons are focusable)
  - ✅ Screen reader friendly descriptions in tooltips and legends

- [x] Add loading indicators during wind data fetch
  - ✅ Show spinner/loading state on toggle button (WindOverlayToggle component)
  - ✅ Show "Loading wind data..." message in tooltip
  - ✅ Centered map overlay with spinner and message when fetching wind data (visible on initial load and refetches)
  - ✅ Uses `isFetching` in addition to `isLoading` to show indicator on map movements, zoom changes, and datetime changes
  - ✅ Disable toggle while loading
  - ✅ Integrated loading state from LeafletMapView to IndependentMapView via callback prop
  - ✅ Slider play/pause respects loading state: Waits for data to finish loading before advancing (minimum 3 second pause between advances)

- [ ] Add error messages with retry options
  - Show user-friendly error if wind data fails to load
  - Provide "Retry" button
  - Show "Using cached data" if available

- [ ] Add wind conditions to dive site detail pages
  - Show current wind conditions for dive site location
  - Display suitability status
  - Show wind forecast (optional: next 24 hours)
  - Update automatically or on refresh

- [ ] Add admin tools for shore direction management (optional)
  - Bulk detection endpoint for existing dive sites
  - Admin UI to view/edit shore directions
  - Statistics: How many sites have shore_direction set
  - Manual override capability for admins

---

## Success Criteria Reference

### Functional Requirements

**Backend (Phase 1-2):**

- ✅ Backend API endpoint fetches wind data from Open-Meteo API for given coordinates
- ✅ Database migration adds `shore_direction` field to `dive_sites` table
- ✅ Database migration adds optional `shore_direction_confidence` field
- ✅ Database migration adds optional `shore_direction_method` field
- ✅ Database migration adds optional `shore_direction_distance_m` field
- ✅ Dive site schemas support `shore_direction` field (optional)
- ✅ Dive site schemas support `shore_direction_confidence` and `shore_direction_method` fields
- ✅ Recommendation algorithm calculates wind suitability for each dive site
- ✅ Wind data is cached appropriately to avoid excessive API calls
- ✅ Dive sites without shore_direction are handled gracefully (shown as "unknown" suitability)
- ✅ All API endpoints respond correctly and handle errors gracefully

**Frontend (Phase 3-4):**

- [x] Wind overlay toggle button appears in map controls when viewing dive sites
- [x] Wind overlay is only available at zoom level 12-18 (to avoid excessive API calls)
- [x] Toggle button is disabled/grayed out when zoom < 12
- [x] Show tooltip: "Zoom in to level 12 or higher to enable wind overlay"
- [x] Wind overlay can be enabled/disabled via toggle button (when zoom >= 12)
- [x] Wind arrows/vectors display on map showing direction and speed when overlay is enabled
- [x] Wind overlay automatically disables when zoom drops below 12
- [x] Wind data updates automatically (every 15-30 minutes) or on manual refresh
- [x] Zoom level is visible in `/map?type=dive-sites` (IndependentMapView) - matches DiveSiteMap style
- [x] Wind overlay respects zoom level restrictions (only active at zoom 13-18)
- [x] Wind overlay adapts to zoom level (shows/hides arrows, adjusts density)
- [x] Wind data fetching is debounced to prevent excessive API calls during map panning
- [x] Coordinate validation: Invalid coordinates are filtered out before creating markers
- [x] Wind overlay toggle correctly enables/disables overlay (arrows disappear when disabled)
- [x] Wind arrows point in the correct direction (east for west wind, matching meteorological convention)
- [x] Dive sites are visually distinguished (color/badge) based on suitability (colored borders on markers, suitability badges in popups)
- [x] Recommendation logic works correctly (considers both direction AND speed)
- [x] Wind overlay works on both `/map?type=dive-sites` (IndependentMapView) and map view in DiveSites page
- [ ] Wind suitability filter works correctly (filters dive sites by wind conditions)

### Quality Requirements

- ✅ All API endpoints respond correctly and handle errors gracefully
- ✅ Frontend components render without errors and follow project standards
- [ ] Mobile compatibility verified (wind overlay works on mobile devices)
- [ ] Performance meets requirements (wind overlay doesn't slow down map rendering)
- ✅ Code follows project standards (ESLint, Prettier)
- ✅ Open-Meteo API errors are handled gracefully (fallback, retry logic)
- ✅ Wind data fetching doesn't block map rendering
- ✅ All TypeScript/PropTypes validations pass
- ✅ All button colors use colorblind-safe Okabe-Ito palette
- ✅ Wind condition colors verified as colorblind-safe (all suitability colors from approved palette)
- ✅ Removed all debugging console.log statements from frontend files (code cleanup)
- ✅ Fixed z-index layering: Leaflet popups can now overlay the wind date/time slider

### User Experience Requirements

- ✅ Wind overlay toggle is intuitive and clearly labeled (tooltip: "Enable wind overlay (zoom 12+)")
- ✅ Wind arrows are clearly visible but don't obstruct dive site markers (increased size, white outline for contrast)
- ✅ Wind speed and direction are readable (appropriate sizing, colors, formatted in multiple units)
- ✅ Dive site suitability indicators are clear and understandable (colored borders on markers, badges in popups)
- [x] Loading states are shown when fetching wind data
  - ✅ Toggle button shows spinner icon when loading
  - ✅ Centered map overlay shows "Loading wind data..." with spinner when fetching (appears on initial load and refetches)
  - ✅ Uses `isFetching` in addition to `isLoading` to show indicator on map movements and other refetches
- [ ] Error messages are user-friendly if wind data fails to load
- ✅ Wind overlay integrates seamlessly with existing map features (z-index layering, zoom restrictions)
- ✅ All UI colors are colorblind-safe (buttons and wind suitability indicators use Okabe-Ito palette)
- ✅ Wind date/time slider can be hidden/shown: Close button and "Show Time Slider" button for better UX
- ✅ Wind feature promotion: Banner appears when overlay is disabled, with one-click enable and auto-zoom to demo location
- ✅ Fixed zoom level tracking: Wind button now correctly enables at zoom 12+ using accurate zoom from map instance
- ✅ Enhanced tooltips: Detailed tooltips explain wind overlay features, arrow direction, and zoom requirements
- ✅ Wind overlay legend: Combined legend with tabs for wind arrows and dive site suitability, accessible via "Show Legend" button
- ✅ Map info button: Changed from always visible to toggle button (left side, below zoom buttons) for cleaner UI
