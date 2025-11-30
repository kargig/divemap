# Add wind overlay and dive site recommendations based on wind conditions

**Status:** In Progress
**Created:** 2025-11-30T11:59:24Z
**Started:** 2025-11-30T12:40:00Z
**Last Updated:** 2025-11-30T11:30:00Z
**Agent PID:** 121961
**Branch:** feature/wind-overlay-dive-sites-map

## Progress Summary

**Completed Phases:**

- ✅ Phase 1: Database Schema & Backend API Foundation (100%)
- ✅ Phase 2: Wind Recommendation Logic (100%)

**In Progress:**

- ⏳ Phase 3: Frontend Wind Overlay Component (0%)
- ⏳ Phase 4: Dive Site Suitability Visualization (0%)
- ⏳ Phase 5: Integration & Testing (0%)
- ⏳ Phase 6: User Experience Polish (0%)

**Recent Changes:**

- Fixed shore_direction validation: Cannot be set to None (returns 422 error)
- Fixed response serialization: get_dive_site and update_dive_site endpoints now include all shore_direction fields
- Updated wind speed threshold: 6.2 m/s is now the safe threshold (below this = safe for diving)
- Added datetime_str support: Wind recommendations can now be fetched for current time or forecasts (max +2 days ahead)
- Fixed Open-Meteo unit issue: Explicitly request wind_speed_unit=ms to ensure correct units
- Updated DiveSiteUpdate schema: Added missing shore_direction_confidence, shore_direction_method, shore_direction_distance_m fields

## Description

Add a wind overlay feature to the dive sites map that displays real-time wind speed and direction data, and provides intelligent recommendations for which dive sites are suitable for diving based on wind conditions. This feature will help divers avoid sites where wind is blowing directly onto the shore, making entry/exit dangerous or uncomfortable.

The feature will:

1. Integrate with Open-Meteo API to fetch current wind conditions
2. Display wind data as directional arrows/vectors on the map at `/map?type=dive-sites`
3. Allow users to toggle the wind overlay on/off
4. Add shore direction data to dive sites (compass bearing in degrees, 0-360) - automatically detected from OpenStreetMap
5. Calculate and highlight which dive sites are suitable based on wind vs shore direction
6. Provide visual indicators (colors/badges) for dive site suitability

## Shore Direction Data Source

### Primary Method: Automatic Detection from OpenStreetMap (Similar to Reverse Geocoding)

- Automatically determine shore direction from GPS coordinates using OpenStreetMap coastline data
- Use Overpass API to query for coastline segments (`natural=coastline`) near the dive site
- Find the nearest coastline segment to the dive site coordinates
- Calculate the bearing/orientation of the coastline segment
- Shore direction = perpendicular to coastline (coastline bearing + 90°)
- OSM coastlines are oriented with land on left, water on right - this helps determine direction
- **Fully automated** - no user input required, similar to how country/region is auto-detected
- **No API costs** - Overpass API is free (unlike OpenAI)
- **Fallback to manual entry** if:
  - No coastline data found nearby
  - Dive site is too far from coast
  - User wants to override/verify the automatic detection

### Manual Entry (Fallback/Override)

- Optional field in create/edit forms for manual override
- Users can verify/correct the automatically detected direction
- Useful for edge cases or when OSM data is incomplete
- Field is **optional (nullable)** - automatic detection fills it when possible

### AI-Powered Enhancement (Future/Optional)

- Could use OpenAI GPT-4 Vision as additional fallback if OSM data unavailable
- Lower priority since automatic OSM method should cover most cases

## Current State

- Dive sites map exists at `/map?type=dive-sites` using `IndependentMapView` component
- Map uses Leaflet via `LeafletMapView` component
- Dive sites have latitude/longitude but no shore direction field
- No weather/wind data integration exists

## Target State

- Wind overlay toggle button in map controls
- Wind arrows displayed on map showing speed and direction
- Dive sites have optional `shore_direction` field (degrees, 0-360)
- Dive sites are color-coded or highlighted based on wind suitability
- Backend API endpoint to fetch wind data from Open-Meteo
- Recommendation logic: avoid sites where wind direction is within ±45° of shore direction

## Success Criteria

### Functional Requirements

- [x] Backend API endpoint fetches wind data from Open-Meteo API for given coordinates
- [ ] Wind overlay toggle button appears in map controls when viewing dive sites
- [ ] Wind overlay is **only available at zoom level 15-18** (to avoid excessive API calls)
  - Toggle button is disabled/grayed out when zoom < 15
  - Show tooltip: "Zoom in to level 15 or higher to enable wind overlay"
  - When zoom < 15, show message: "Wind overlay requires zoom level 15+"
- [ ] Wind overlay can be enabled/disabled via toggle button (when zoom >= 15)
- [ ] Wind arrows/vectors display on map showing direction and speed when overlay is enabled
- [ ] Wind overlay automatically disables when zoom drops below 15
- [ ] Wind data updates automatically (every 15-30 minutes) or on manual refresh
- [x] Database migration adds `shore_direction` field to `dive_sites` table (nullable, 0-360 degrees)
- [x] Database migration adds optional `shore_direction_confidence` field (enum: 'high', 'medium', 'low') for tracking detection quality
- [x] Database migration adds optional `shore_direction_method` field (string, default: 'osm_coastline') for tracking detection method
- [x] Dive site schemas support `shore_direction` field (optional)
- [x] Dive site schemas support `shore_direction_confidence` and `shore_direction_method` fields (optional, for admin/debugging)
- [x] Recommendation algorithm calculates wind suitability for each dive site
- [ ] Dive sites are visually distinguished (color/badge) based on suitability:
  - Green/Good: Wind conditions are favorable (speed < 10 knots and direction favorable, or light winds)
  - Yellow/Caution: Wind is somewhat unfavorable (speed 10-15 knots with unfavorable direction, or light winds with unfavorable direction)
  - Orange/Difficult: Challenging conditions (speed 15-20 knots, or 10-15 knots with very unfavorable direction) - experienced divers only
  - Red/Avoid: Dangerous conditions (speed > 20 knots, or 15-20 knots with wind blowing onto shore) - not recommended
  - Gray/Unknown: Cannot determine suitability (no shore direction data)
- [ ] Recommendation logic works correctly:
  - Considers both wind direction AND wind speed
  - Avoids sites where wind speed > 20 knots (dangerous regardless of direction)
  - Avoids sites where wind direction ±45° matches shore direction AND speed >= 15 knots
  - Provides appropriate warnings for difficult conditions (15-20 knots)
- [ ] Wind overlay works on both `/map?type=dive-sites` (IndependentMapView) and map view in DiveSites page
- [ ] Zoom level is visible in `/map?type=dive-sites` (IndependentMapView):
  - Currently shown in LeafletMapView controls overlay (top-right)
  - Ensure zoom level display is clearly visible and readable
  - Format: "Zoom: 15.2" (with 1 decimal place)
  - Consider adding zoom level to other visible locations if needed
- [ ] Wind overlay respects zoom level restrictions (only active at zoom 15-18)
- [x] Wind data is cached appropriately to avoid excessive API calls (in-memory Python dict with TTL)
- [ ] Wind overlay adapts to zoom level (shows/hides arrows, adjusts density)
- [ ] Wind data fetching is debounced to prevent excessive API calls during map panning
- [ ] Wind suitability filter works correctly (filters dive sites by wind conditions)
- [x] Dive sites without shore_direction are handled gracefully (shown as "unknown" suitability)

### Quality Requirements

- [x] All API endpoints respond correctly and handle errors gracefully
- [ ] Frontend components render without errors and follow project standards
- [ ] Mobile compatibility verified (wind overlay works on mobile devices)
- [ ] Performance meets requirements (wind overlay doesn't slow down map rendering)
- [ ] Code follows project standards (ESLint, Prettier)
- [ ] Open-Meteo API errors are handled gracefully (fallback, retry logic)
- [ ] Wind data fetching doesn't block map rendering
- [ ] All TypeScript/PropTypes validations pass

### User Experience Requirements

- [ ] Wind overlay toggle is intuitive and clearly labeled
- [ ] Wind arrows are clearly visible but don't obstruct dive site markers
- [ ] Wind speed and direction are readable (appropriate sizing, colors)
- [ ] Dive site suitability indicators are clear and understandable
- [ ] Loading states are shown when fetching wind data
- [ ] Error messages are user-friendly if wind data fails to load
- [ ] Wind overlay integrates seamlessly with existing map features

## Implementation Plan

### Phase 1: Database Schema & Backend API Foundation

**Status: COMPLETED** ✅

**Key Learnings from Overpass API Testing:**

- Overpass API can timeout under load (504 errors) - need retry logic and fallback endpoints
- Distance-based confidence works well: <100m = high, 100-500m = medium, >500m = low
- Bearing calculation (coastline + 90°) produces accurate shore directions
- API responses can be large (75KB+) - need efficient parsing
- Multiple Overpass instances available for redundancy
- Successful tests: 37.777450378278026,24.0852531524052 → 152.2° (SSE), 37.7799068396316,24.08582830313313 → 89.0° (E)

**Key Learnings from Wind Speed Research:**

- **15 knots (~7.7 m/s)** is critical threshold: Creates 1+ meter waves, rough conditions, difficult entry/exit
- **20 knots (~10 m/s)** is dangerous threshold: Very rough conditions, high risk of strong currents, not recommended
- Wind gusts are often more dangerous than sustained winds (consider gusts > 25 knots)
- Wind speed affects suitability independently of direction (high winds = dangerous regardless)
- Thresholds for shore diving:
  - < 10 knots: Good conditions (all divers)
  - 10-15 knots: Caution (experienced divers OK, beginners cautious)
  - 15-20 knots: Difficult (experienced divers only)
  - > 20 knots: Avoid (not recommended for shore diving)

- [x] Create database migration to add `shore_direction` column to `dive_sites` table
  - Column: `shore_direction DECIMAL(5, 2)` nullable, 0-360 degrees
  - Add index if needed for filtering (for queries filtering by shore_direction)
- [x] Create database migration to add `shore_direction_confidence` column:
  - Column: `shore_direction_confidence ENUM('high', 'medium', 'low')` nullable
  - Track quality of automatic detection
- [x] Create database migration to add `shore_direction_method` column:
  - Column: `shore_direction_method VARCHAR(50)` nullable, default 'osm_coastline'
  - Track how shore direction was determined (for future: 'manual', 'ai', 'osm_coastline')
- [x] Create database migration to add `shore_direction_distance_m` column (optional):
  - Column: `shore_direction_distance_m DECIMAL(8, 2)` nullable
  - Store distance to coastline for reference/debugging
- [x] Update `DiveSite` model in `backend/app/models.py` to include `shore_direction` field
  - **COMPLETED**: All fields added (shore_direction, shore_direction_confidence, shore_direction_method, shore_direction_distance_m)
- [x] Update Pydantic schemas in `backend/app/schemas.py`:
  - **COMPLETED**: All fields added to DiveSiteBase, DiveSiteCreate, DiveSiteUpdate, DiveSiteResponse
  - **COMPLETED**: Validation added (ge=0, le=360 for shore_direction)
  - **COMPLETED**: DiveSiteUpdate schema now includes all shore_direction fields (was missing confidence, method, distance)
  - Add `shore_direction: Optional[float]` to `DiveSiteBase`, `DiveSiteCreate`, `DiveSiteUpdate`, `DiveSiteResponse`
  - Add validation: `Field(None, ge=0, le=360)` for shore_direction
  - Add `shore_direction_confidence`, `shore_direction_method`, `shore_direction_distance_m` to `DiveSiteResponse`
- [x] Create OpenStreetMap coastline service in `backend/app/services/osm_coastline_service.py`:
  - **COMPLETED**: Service fully implemented and tested
  - **COMPLETED**: Multiple endpoint support with fallback
  - **COMPLETED**: Retry logic with exponential backoff
  - **COMPLETED**: Distance and bearing calculations
  - **COMPLETED**: Confidence levels based on distance
  - **COMPLETED**: Successfully tested with multiple dive sites
  - Function to query Overpass API for coastline data near coordinates
  - Query format: `[out:json][timeout:15];(way["natural"="coastline"](around:1000,{lat},{lon}););out geom;`
  - **Multiple endpoint support**: Try multiple Overpass instances if one fails:
    - Primary: `https://overpass-api.de/api/interpreter`
    - Fallback: `https://overpass.kumi.systems/api/interpreter`
  - **Error handling**: Handle timeouts (504 errors), rate limits, and connection errors gracefully
  - **Retry logic**: Retry failed requests with exponential backoff (max 2-3 retries)
  - **Distance calculation**: Use Haversine formula to find nearest coastline segment
  - **Bearing calculation**: Calculate coastline bearing between segment endpoints
  - **Shore direction**: Calculate as coastline bearing + 90° (perpendicular, facing seaward)
  - **Confidence levels** (based on distance to coastline):
    - High: < 100 meters
    - Medium: 100-500 meters
    - Low: > 500 meters
  - **Edge cases**:
    - No coastline found within radius → return None
    - Multiple segments → use nearest one
    - Invalid geometry → skip and try next segment
    - **Islands**: If multiple coastlines found, use the one closest to dive site
    - **Bays/coves**: Use nearest segment (may not be perfect for curved coastlines, but acceptable)
    - **Lakes/rivers**: Query for `natural=coastline` OR `natural=water` + `waterway=*` to handle inland water bodies
    - **Boat-only sites**: May not have nearby coastline - return None (user can mark as boat-only)
    - **Curved coastlines**: Use segment endpoints to calculate bearing (approximation is acceptable)
  - **Caching**: Cache results in database (shore_direction field) to avoid repeated API calls
  - Return: `{shore_direction: <degrees>, confidence: <high|medium|low>, method: "osm_coastline", distance_to_coastline_m: <meters>}`
- [x] Integrate automatic shore direction detection into dive site creation/update:
  - **COMPLETED**: Auto-detection on create when coordinates provided
  - **COMPLETED**: Auto-detection on update when coordinates change OR shore_direction is NULL
  - **COMPLETED**: Graceful error handling (doesn't fail dive site creation/update)
  - **COMPLETED**: Validation added: shore_direction cannot be set to None (returns 422 error)
  - **COMPLETED**: Response serialization fixed: get_dive_site and update_dive_site endpoints now include all shore_direction fields
  - When dive site is created/updated with coordinates, automatically detect shore_direction
  - Call OSM coastline service if shore_direction not provided manually
  - **Async/background processing**: Consider making detection async to avoid blocking API calls
  - **Graceful degradation**: If detection fails, allow dive site creation to proceed (field remains null)
  - Store detected value in database with confidence level (optional field)
  - Log detection results for debugging (success/failure, distance, confidence)
  - **Update existing sites**: Create migration script or admin endpoint to backfill shore_direction for existing dive sites
- [ ] Add shore_direction input field to `CreateDiveSite.js` form:
  - Number input with min=0, max=360, step=1
  - Placeholder: "Auto-detected from coordinates (or enter manually)"
  - Show detected value if available (from auto-detection)
  - Allow manual override
  - Optional field (not required)
- [ ] Add shore_direction input field to `EditDiveSite.js` form:
  - Same as create form
  - Show current value (auto-detected or manual)
  - Add "Re-detect from coordinates" button to trigger auto-detection
  - Allow manual override
- [x] Add backend endpoint `/api/v1/dive-sites/{id}/detect-shore-direction`:
  - **COMPLETED**: Endpoint implemented and tested
  - **COMPLETED**: Rate limiting applied (10/minute for admins)
  - **COMPLETED**: Permission checks (admin/moderator/owner)
  - **COMPLETED**: Returns detection result with confidence and distance
  - Triggers automatic detection for existing dive site
  - Returns detected shore_direction with confidence and distance
  - Can be called from frontend "Re-detect" button
  - **Rate limiting**: Limit requests to prevent API abuse (e.g., 10 requests/minute per user)
  - **Error handling**: Return user-friendly error messages if detection fails
  - **Update database**: Optionally update dive site with detected value (or return for user confirmation)
- [x] Create Open-Meteo service in `backend/app/services/open_meteo_service.py`:
  - **COMPLETED**: Service implemented with single point and grid fetching
  - **COMPLETED**: In-memory caching with TTL (15-30 minutes)
  - **COMPLETED**: Support for current and forecast data (datetime_str parameter)
  - **COMPLETED**: Validation for datetime_str (max +2 days ahead, no past dates)
  - **COMPLETED**: Explicit `wind_speed_unit=ms` parameter to ensure m/s units from API
  - Function to fetch current wind data for coordinates or bounds
  - **API Parameters**: Use `current` endpoint for real-time data:
    - Variables: `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`
    - Timezone: Auto-detect or use UTC
    - Model: Use default "best match" or specify model
  - **Grid resolution strategy**:
    - For single point: Fetch data for that coordinate
    - For bounds: Create grid of points (e.g., every 0.1° or 0.2° depending on zoom level)
    - Adaptive grid: More points when zoomed in, fewer when zoomed out
    - Maximum points: Limit to ~50-100 points to avoid API overload
  - **Caching strategy** (in-memory Python dict with TTL):
    - **Storage location**: In-memory Python dictionary (not in database)
    - **Rationale**:
      - Wind data is temporary (15-30 min TTL) - doesn't need persistence
      - Fast access (no database queries)
      - Simple implementation (no Redis setup needed)
      - Lost on restart is acceptable (data refreshes quickly)
    - Cache by geographic bounds (rounded to 0.1° grid)
    - TTL: 15-30 minutes for current conditions
    - Cache key format: `wind-{rounded_lat}-{rounded_lon}-{timestamp_bucket}`
    - In-memory cache with size limit (e.g., 100 entries, LRU eviction)
    - **Implementation**: Use Python `dict` with `datetime` timestamps, or `cachetools.TTLCache` for automatic expiration
    - **Future upgrade**: Can migrate to Redis if needed (shared cache, persistence, larger scale)
  - Handle API errors and rate limiting
  - **Rate limiting**: Respect Open-Meteo limits (typically generous for non-commercial use)
  - **Error handling**: Return cached data if available, even if expired, when API fails
- [x] Create backend API endpoint `/api/v1/weather/wind`:
  - **COMPLETED**: Endpoint accepts latitude/longitude or bounds
  - **COMPLETED**: Supports datetime_str for current or forecast data
  - **COMPLETED**: Returns wind data with metadata
  - Accept: `latitude`, `longitude` (single point) OR `bounds` (north, south, east, west)
  - Accept optional: `zoom_level` (to determine grid density)
  - Fetch wind data from Open-Meteo API for grid of points
  - Return array of wind data points: `[{lat, lon, wind_speed_10m, wind_direction_10m, wind_gusts_10m, timestamp}]`
  - Include metadata: `{data_age_seconds, grid_resolution, point_count}`
  - Handle errors gracefully (return empty array or cached data)

### Phase 2: Wind Recommendation Logic

- [x] Create recommendation service in `backend/app/services/wind_recommendation_service.py`:
  - **COMPLETED**: Service implemented with full logic
  - **COMPLETED**: Wind speed threshold updated to 6.2 m/s for safe diving (below this = safe)
  - **COMPLETED**: Wind speed categories: light (< 6.2 m/s), moderate (6.2-7.7 m/s), strong (7.7-10 m/s), very_strong (> 10 m/s)
  - **COMPLETED**: Gust handling: gusts > 25 knots (13 m/s) upgrade severity by one level
  - **COMPLETED**: Direction-based suitability calculation (favorable/unfavorable)
  - **COMPLETED**: Combined logic for final suitability (good/caution/difficult/avoid/unknown)
  - Function to calculate wind suitability for a dive site
  - Input: wind direction (degrees), wind speed (m/s), wind_gusts (m/s, optional), shore direction (degrees, nullable)
  - Output: suitability score/status (good/caution/difficult/avoid/unknown) with reasoning
  - **Wind Speed Thresholds (based on research and implementation)**:
    - **Safe/Good conditions**: < 6.2 m/s (~12 knots) - Safe for diving, ideal for all divers, minimal waves
      - Below this threshold, conditions are generally safe regardless of direction (with favorable direction = "good", unfavorable = "caution")
    - **Moderate/Caution**: 6.2-7.7 m/s (12-15 knots) - Experienced divers OK, beginners should be cautious
      - Waves may reach 0.5-1 meter
      - Surface conditions becoming rougher
      - Direction becomes more important at this level
    - **Difficult**: 7.7-10 m/s (15-20 knots) - Challenging conditions, experienced divers only
      - Waves typically 1+ meters (3+ feet)
      - Rough surface waters, difficult entry/exit
      - Reduced visibility possible
      - Stronger currents
    - **Dangerous/Avoid**: > 10 m/s (>20 knots) - Not recommended for shore diving
      - Large waves, very rough conditions
      - High risk of strong currents and rip currents
      - Significantly reduced visibility
      - Entry/exit extremely difficult and dangerous
  - **Wind Gust Considerations**:
    - Gusts are used to upgrade severity by one level (not to calculate effective wind speed)
    - If gusts exceed 25 knots (~13 m/s), upgrade severity: good → caution, caution → difficult, difficult → avoid
    - Gust information is appended to reasoning text separately (e.g., "GOOD conditions (gusts up to 16.5 knots)")
    - Example: Sustained 4 m/s (8 knots) with gusts 15 m/s (29 knots) → base "good" upgraded to "caution" due to gusts
  - **Core logic (combining direction and speed)**:
    - If shore_direction is null → return "unknown" (can't determine direction-based suitability)
    - Calculate angle difference: `abs(wind_direction - shore_direction)` (handle 360° wrap)
    - **Base suitability from direction**:
      - If angle difference <= 45° → direction = "unfavorable" (wind blowing onto shore)
      - If angle difference <= 90° → direction = "somewhat_unfavorable"
      - Otherwise → direction = "favorable"
    - **Final suitability calculation** (using sustained wind speed as primary factor):
      - If wind speed >= 20 knots (10 m/s) → "avoid" (too dangerous regardless of direction)
      - If wind speed >= 15 knots (7.7 m/s):
        - If direction = "unfavorable" → "avoid" (dangerous conditions)
        - If direction = "somewhat_unfavorable" → "difficult" (strong winds, experienced divers only)
        - If direction = "favorable" → "difficult" (strong winds, experienced divers only)
      - If wind speed >= 6.2 m/s (12 knots):
        - If direction = "unfavorable" → "caution" (moderate winds with unfavorable direction)
        - If direction = "somewhat_unfavorable" → "caution" (moderate winds with somewhat unfavorable direction)
        - If direction = "favorable" → "good" (acceptable conditions)
      - If wind speed < 6.2 m/s (12 knots):
        - If direction = "unfavorable" → "caution" (light winds with unfavorable direction)
        - Otherwise → "good" (safe for diving)
    - **Wind gust handling**:
      - Gusts are used to upgrade severity by one level (not to calculate effective wind speed)
      - If gusts > 25 knots (13 m/s), upgrade severity: good → caution, caution → difficult, difficult → avoid
      - Gust information is appended to reasoning text separately
      - Example: Sustained 4 m/s with gusts 15 m/s → base "good" upgraded to "caution" due to gusts
  - **Edge cases**:
    - Handle 360° wrap (e.g., wind 350°, shore 10° = 20° difference, not 340°)
    - Multiple wind conditions (current vs forecast) - use current for now
    - Boat-only dive sites: May not need shore_direction (mark as N/A)
    - Convert wind speed units: Accept m/s, km/h, knots - normalize to m/s internally
- [x] Add recommendation endpoint `/api/v1/dive-sites/wind-recommendations`:
  - **COMPLETED**: Endpoint implemented and tested
  - **COMPLETED**: Supports datetime_str for forecast recommendations
  - **COMPLETED**: Returns recommendations with reasoning and wind_speed_category
  - **COMPLETED**: Includes wind_data in response
  - **COMPLETED**: Handles sites without shore_direction (returns "unknown" suitability)
  - Accept: `wind_direction` (optional, will fetch from Open-Meteo if not provided)
  - Accept: `wind_speed` (optional, will fetch from Open-Meteo if not provided)
  - Accept: `wind_gusts` (optional, for more accurate assessment)
  - Accept: `latitude`, `longitude` or `bounds` (for fetching wind data)
  - Accept: `include_unknown` (boolean, default false - whether to include sites without shore_direction)
  - Accept: `min_suitability` (optional, filter by minimum suitability: good/caution/difficult/avoid)
  - Return list of dive sites with suitability status:
    - Include: `{dive_site_id, name, suitability: good/caution/difficult/avoid/unknown, wind_direction, wind_speed, wind_gusts, shore_direction, reasoning, wind_speed_category}`
    - `wind_speed_category`: "light" (< 10 knots), "moderate" (10-15 knots), "strong" (15-20 knots), "very_strong" (> 20 knots)
  - Include wind data in response
  - **Filtering**: Optionally filter to only return suitable sites (exclude "avoid" and "difficult" if desired)
  - **Sorting**: Sort by suitability (good first, then caution, then difficult, then avoid, then unknown)

### Phase 3: Frontend Wind Overlay Component

**Status: NOT STARTED** ⏳

- [ ] Create `WindOverlay` component in `frontend/src/components/WindOverlay.js`:
  - Display wind arrows on Leaflet map using react-leaflet
  - **Arrow visualization**:
    - Use custom SVG arrows or Leaflet DivIcon with rotated arrows
    - Arrow direction = wind direction (where wind is coming FROM)
    - Arrow size proportional to wind speed (e.g., 20px base + 5px per 5 m/s)
    - Arrow color coding:
      - Light winds (< 5 m/s / < 10 knots): Light blue/green (good conditions)
      - Moderate winds (5-7.7 m/s / 10-15 knots): Blue (caution)
      - Strong winds (7.7-10 m/s / 15-20 knots): Orange (difficult conditions)
      - Very strong winds (> 10 m/s / > 20 knots): Red (dangerous, avoid)
  - **Grid placement**:
    - Show wind arrows at grid points from API response
    - Adaptive density based on zoom level:
      - Zoom < 8: Show every 2nd or 3rd point (sparse)
      - Zoom 8-12: Show all points
      - Zoom > 12: Show all points (may need more detailed grid)
  - **Performance optimization**:
    - Limit maximum arrows displayed (e.g., max 100 arrows)
    - Use React.memo to prevent unnecessary re-renders
    - Debounce map movements before fetching new data
    - Only fetch when overlay is enabled
  - **Zoom level handling**:
    - **Restriction**: Only show arrows at zoom level 15-18 (to avoid excessive API calls)
    - Hide arrows when zoom < 15 (overlay disabled)
    - Show arrows at zoom >= 15
    - Adjust arrow size based on zoom level (larger at higher zoom)
    - Consider hiding arrows at zoom > 18 if too cluttered (optional)
  - **Z-index/layering**: Ensure arrows are above map tiles but below markers/popups
  - Update based on map bounds/zoom level changes
  - **Tooltips on hover**: Show wind speed and direction when hovering over arrows
- [ ] Create `WindOverlayToggle` component in `frontend/src/components/WindOverlayToggle.js`:
  - Toggle button to enable/disable wind overlay
  - **Zoom level checking**: Disable button when zoom < 15
  - **Visual feedback**:
    - Disabled state: Grayed out button with tooltip "Zoom in to level 15+ to enable"
    - Enabled state: Active button when zoom >= 15
  - Show loading state when fetching data
  - Display current wind conditions summary
  - **Auto-disable**: Automatically disable overlay when zoom drops below 15
  - Show current zoom level in button or nearby (e.g., "Wind Overlay (Zoom: 15.2)")
- [ ] Integrate wind overlay into `LeafletMapView.js`:
  - Add WindOverlay component conditionally when enabled AND zoom >= 15
  - Pass map bounds and zoom level to fetch wind data for visible area
  - **Zoom level restriction**: Only fetch/display wind data when zoom >= 15
  - **Zoom change handling**: Automatically hide wind overlay when zoom < 15
  - **Debounce map movements**: Wait 500ms-1s after map stops moving before fetching
  - **Viewport change detection**: Only fetch when bounds change significantly (similar to useViewportData pattern)
  - Handle wind data updates
  - **Lazy loading**: Only fetch wind data when overlay toggle is enabled AND zoom >= 15
  - **Cache wind data**: Use React Query cache to avoid refetching same bounds
  - **Zoom level monitoring**: Listen to zoom events to enable/disable overlay automatically

### Phase 4: Dive Site Suitability Visualization

**Status: NOT STARTED** ⏳

- [ ] Update dive site markers to show suitability status:
  - Add color coding or badge to markers
  - Green for good, yellow for caution, red for avoid, gray for unknown
  - **Implementation options**:
    - Option A: Add colored border/ring around existing marker icon
    - Option B: Add small badge/indicator next to marker
    - Option C: Change marker icon color (if not using custom icons)
  - **Conditional display**: Only show suitability indicators when wind overlay is enabled
  - Update marker icons or add overlay badges
  - **Z-index**: Ensure markers remain above wind arrows
- [ ] Add suitability information to dive site popups:
  - Display wind conditions and suitability status
  - Show wind speed in multiple units: m/s, km/h, and knots (for diver familiarity)
  - Show wind direction (degrees and cardinal)
  - Show wind gusts if available (often more important than sustained winds)
  - Show shore direction if available
  - **Detailed reasoning** explaining why site is suitable/unsuitable:
    - "Wind from SSE (152°) at 18 knots blowing onto north-facing shore - AVOID (dangerous conditions)"
    - "Wind from NW (315°) at 8 knots favorable for east-facing shore - GOOD conditions"
    - "Wind at 22 knots from any direction - AVOID (too dangerous for shore diving)"
    - "Wind at 12 knots from SW (225°) - CAUTION (moderate winds with somewhat unfavorable direction)"
    - "Wind at 17 knots from favorable direction - DIFFICULT (strong winds, experienced divers only)"
    - "Shore direction unknown - cannot determine direction-based suitability"
  - **Wind speed warnings**: Highlight when wind speed exceeds thresholds:
    - "⚠️ Wind speed 18 knots - challenging conditions"
    - "🚫 Wind speed 25 knots - dangerous, not recommended"
  - **Conditional display**: Only show wind info when wind overlay is enabled or wind data is available
- [ ] Add wind suitability filter to dive sites list/map:
  - Filter option: "Show only suitable dive sites"
  - Filter by wind conditions (good/caution/difficult/avoid/unknown)
  - **Advanced filter options**:
    - "Hide dangerous conditions" (exclude "avoid" and "difficult")
    - "Show only good conditions" (only "good")
    - "Show all conditions" (no filter)
  - Update when wind data changes
  - **Integration**: Add to existing filter UI in `UnifiedMapFilters` or `ResponsiveFilterBar`
  - **State management**: Store filter preference in URL params or local state
  - **Visual indicator**: Show count of sites in each category (e.g., "5 good, 3 caution, 2 difficult, 1 avoid")

### Phase 5: Integration & Testing

**Status: NOT STARTED** ⏳

- [ ] Integrate wind overlay into `IndependentMapView.js`:
  - Add WindOverlayToggle to map controls
  - Connect to wind data fetching
  - Handle state management
  - **Ensure zoom level is visible**: Verify zoom level display in map controls (LeafletMapView already shows it, but ensure it's clearly visible)
  - **Zoom level tracking**: Pass current zoom level to WindOverlayToggle component
  - **Zoom change handling**: Update toggle button state when zoom changes
- [ ] Integrate wind overlay into `DiveSitesMap.js` (for map view in DiveSites page):
  - Add toggle button
  - Display wind overlay when enabled
- [ ] Test wind overlay on mobile devices
- [ ] Test error handling (API failures, network issues)
- [ ] Test performance with many dive sites
- [ ] Verify wind data caching works correctly
- [ ] Test recommendation logic with various wind/shore direction combinations
- [ ] Test Overpass API error handling:
  - Test timeout scenarios (504 errors)
  - Test rate limiting
  - Test fallback to alternative endpoints
  - Test cases where no coastline is found
- [ ] Test shore direction detection:
  - Test with various coordinates (coastal, inland, islands)
  - Verify bearing calculations are correct
  - Test confidence level assignment based on distance
  - Test manual override functionality
- [ ] Test backfill script for existing dive sites:
  - Run on subset of dive sites first
  - Verify detection accuracy
  - Handle errors gracefully (don't break on individual failures)
- [ ] Test wind overlay performance:
  - Test with many wind data points (50-100 points)
  - Test map panning/zooming performance
  - Test on mobile devices (touch interactions)
  - Verify debouncing works correctly
- [ ] Test zoom level restrictions:
  - Verify wind overlay toggle is disabled at zoom < 15
  - Verify wind overlay automatically hides when zoom drops below 15
  - Verify wind overlay enables when zoom reaches 15+
  - Test zoom level 15-18 range (wind overlay should work)
  - Test zoom level > 18 (wind overlay should still work, but may need adjustment)
  - Verify no API calls are made when zoom < 15
  - Test zoom level display is visible in IndependentMapView
- [ ] Test wind recommendation edge cases:
  - Test with null shore_direction (should return "unknown")
  - Test with various wind speeds:
    - Light winds (< 10 knots / 5 m/s) - should be "good" or "caution" depending on direction
    - Moderate winds (10-15 knots / 5-7.7 m/s) - should be "caution" or "good"
    - Strong winds (15-20 knots / 7.7-10 m/s) - should be "difficult" or "avoid"
    - Very strong winds (> 20 knots / > 10 m/s) - should always be "avoid"
  - Test wind gusts: Verify gusts > 25 knots upgrade severity appropriately
  - Test angle calculations (360° wrap cases)
  - Test with boat-only dive sites
  - Test combinations: Various wind speeds with favorable/unfavorable directions
  - Verify wind speed thresholds match research (15 knots = difficult, 20 knots = avoid)
- [ ] Test wind data grid resolution:
  - Test with different zoom levels
  - Verify grid density adapts correctly
  - Test with large map bounds (entire region)
  - Test with small map bounds (single dive site area)
- [ ] Test integration with existing map features:
  - Verify wind overlay works with all map layers (street, satellite, terrain)
  - Test z-index/layering (markers above arrows)
  - Test with marker clustering (wind overlay should not interfere)
  - Test with route overlays (if applicable)

### Phase 6: User Experience Polish

**Status: NOT STARTED** ⏳

- [ ] Add tooltips/help text explaining wind overlay:
  - Explain what wind overlay shows (wind speed and direction)
  - Explain how to interpret arrows (direction wind is coming FROM)
  - Explain suitability colors (green/yellow/red)
  - **Explain zoom requirement**: "Wind overlay requires zoom level 15 or higher to avoid excessive API calls"
  - Link to help documentation
- [ ] Add legend explaining wind arrow colors/sizes:
  - Show examples of different wind speeds
  - Explain arrow direction meaning
  - Show color scale (light blue → dark blue/red)
- [ ] Add legend explaining dive site suitability colors:
  - Green: Good conditions (wind < 10 knots and favorable direction, or light winds)
  - Yellow: Caution (wind 10-15 knots with unfavorable direction, or light winds with unfavorable direction)
  - Orange: Difficult (wind 15-20 knots, or 10-15 knots with very unfavorable direction) - experienced divers only
  - Red: Avoid (wind > 20 knots, or 15-20 knots with wind blowing onto shore) - not recommended
  - Gray: Unknown (no shore direction data)
  - Include wind speed reference: "Wind speeds: < 10 knots (good), 10-15 knots (caution), 15-20 knots (difficult), > 20 knots (avoid)"
- [ ] Ensure accessibility (keyboard navigation, screen readers):
  - Add ARIA labels to wind overlay toggle
  - Add descriptive text for wind arrows
  - Ensure keyboard navigation works for all controls
- [ ] Add loading indicators during wind data fetch:
  - Show spinner/loading state on toggle button
  - Show "Loading wind data..." message
  - Disable toggle while loading
- [ ] Add error messages with retry options:
  - Show user-friendly error if wind data fails to load
  - Provide "Retry" button
  - Show "Using cached data" if available
- [ ] Add wind conditions to dive site detail pages:
  - Show current wind conditions for dive site location
  - Display suitability status
  - Show wind forecast (optional: next 24 hours)
  - Update automatically or on refresh
- [ ] Add admin tools for shore direction management:
  - Bulk detection endpoint for existing dive sites
  - Admin UI to view/edit shore directions
  - Statistics: How many sites have shore_direction set
  - Manual override capability for admins
