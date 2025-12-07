---
name: Viewport-based dive site loading
overview: "Implement progressive loading of dive sites based on viewport bounds: fetch minimal data for world view, then full details as user zooms in. Add bounds filtering to backend API and update frontend to use viewport-based fetching with margin."
todos: []
---

# Viewport-Based Dive Site Loading Optimization

## Overview

Implement progressive loading strategy for dive sites on the map page (`http://localhost/map`):

- **World view (Zoom < 4, no bounds)**: Fetch minimal data (id, latitude, longitude only) - no name needed since sites are clustered
- **Zoom 4-7 (with bounds)**: Fetch minimal data (id, latitude, longitude only) - still mostly clustered
- **Zoom 8-9 (with bounds)**: Fetch basic data (id, name, latitude, longitude, difficulty_code, difficulty_label, average_rating) - some individual sites visible, need popup data
- **Zoom >= 10 (with bounds)**: Fetch full dive site details within viewport bounds (with 2-5% margin)
- **Backend**: Add bounds filtering parameters and detail_level to `/api/v1/dive-sites/` endpoint
- **Frontend**: Update `useViewportData` hook to use zoom-based progressive loading with bounds filtering

## Implementation Plan

### Phase 1: Backend API Enhancement

#### 1.1 Add Bounds Filtering to Dive Sites Endpoint

**File**: `backend/app/routers/dive_sites.py`

- Add query parameters to `get_dive_sites()` function:
  - `north: Optional[float]` (ge=-90, le=90)
  - `south: Optional[float]` (ge=-90, le=90)
  - `east: Optional[float]` (ge=-180, le=180)
  - `west: Optional[float]` (ge=-180, le=180)
  - `detail_level: Optional[str]` (default='full') - Options: 'minimal', 'basic', 'full'

- Add bounds filtering logic (similar to wind recommendations endpoint, lines 1201-1205):
  ```python
  if all(x is not None for x in [north, south, east, west]):
      query = query.filter(
          DiveSite.latitude.between(south, north),
          DiveSite.longitude.between(west, east)
      )
  ```

- Add progressive response levels based on `detail_level` parameter:
  - `detail_level='minimal'` (Zoom < 8): Return only `id`, `latitude`, `longitude` - no name needed since sites are clustered
  - `detail_level='basic'` (Zoom 8-9): Return `id`, `name`, `latitude`, `longitude`, `difficulty_code`, `difficulty_label`, `average_rating` - enough for popups when individual sites become visible
  - `detail_level='full'` (Zoom >= 10) or default: Return full response as currently implemented

- Validate bounds:
  - Ensure `north > south` and `east > west` (or handle longitude wrap-around)
  - Handle edge cases (poles, date line crossing)
  - When bounds are not provided and `detail_level='minimal'`, return all sites with minimal data (for world view)

#### 1.2 Update API Documentation

**File**: `backend/app/routers/dive_sites.py`

- Add parameter descriptions to OpenAPI docs
- Document bounds filtering behavior
- Document detail_level response formats

### Phase 2: Frontend Progressive Loading

#### 2.1 Update useViewportData Hook

**File**: `frontend/src/hooks/useViewportData.js`

- Modify `fetchData()` function to:
  - Check zoom level to determine data detail level
  - Add bounds parameters when viewport bounds are available (zoom >= 4)
  - Add `detail_level` parameter based on zoom level
  - Add 2-5% margin to bounds for zoom >= 4 (similar to wind data fetching)

- Bounds margin calculation (for zoom >= 4):
  ```javascript
  const latMargin = (bounds.north - bounds.south) * 0.025; // 2.5%
  const lonMargin = (bounds.east - bounds.west) * 0.025;
  const expandedBounds = {
    north: bounds.north + latMargin,
    south: bounds.south - latMargin,
    east: bounds.east + lonMargin,
    west: bounds.west - lonMargin
  };
  ```

- Zoom-based strategy:
  - **Zoom < 4 (world view, no bounds)**: 
    - Don't send bounds parameters
    - Set `detail_level='minimal'` - fetch all sites with id, lat, lng only
  - **Zoom 4-7 (with bounds)**: 
    - Send expanded bounds parameters
    - Set `detail_level='minimal'` - fetch sites in viewport with id, lat, lng only
  - **Zoom 8-9 (with bounds)**: 
    - Send expanded bounds parameters
    - Set `detail_level='basic'` - fetch sites in viewport with popup data
  - **Zoom >= 10 (with bounds)**: 
    - Send expanded bounds parameters
    - Set `detail_level='full'` - fetch full details for sites in viewport

- Update query parameters:
  ```javascript
  const zoom = viewport?.zoom || 2;
  let detailLevel = 'full';
  
  if (zoom < 4) {
    // World view: no bounds, minimal data
    detailLevel = 'minimal';
    // Don't add bounds parameters
  } else if (zoom < 8) {
    // Zoom 4-7: bounds with minimal data
    detailLevel = 'minimal';
    if (bounds) {
      diveSitesParams.append('north', expandedBounds.north);
      diveSitesParams.append('south', expandedBounds.south);
      diveSitesParams.append('east', expandedBounds.east);
      diveSitesParams.append('west', expandedBounds.west);
    }
  } else if (zoom < 10) {
    // Zoom 8-9: bounds with basic data
    detailLevel = 'basic';
    if (bounds) {
      diveSitesParams.append('north', expandedBounds.north);
      diveSitesParams.append('south', expandedBounds.south);
      diveSitesParams.append('east', expandedBounds.east);
      diveSitesParams.append('west', expandedBounds.west);
    }
  } else {
    // Zoom >= 10: bounds with full data
    detailLevel = 'full';
    if (bounds) {
      diveSitesParams.append('north', expandedBounds.north);
      diveSitesParams.append('south', expandedBounds.south);
      diveSitesParams.append('east', expandedBounds.east);
      diveSitesParams.append('west', expandedBounds.west);
    }
  }
  
  diveSitesParams.append('detail_level', detailLevel);
  ```


#### 2.2 Handle Initial Load (World View)

**File**: `frontend/src/hooks/useViewportData.js`

- When viewport bounds are not yet available or zoom < 4:
  - Don't send bounds parameters
  - Set `detail_level='minimal'` for initial load
  - Once bounds are available and zoom >= 4, switch to viewport-based fetching

#### 2.3 Update Viewport Change Detection

**File**: `frontend/src/hooks/useViewportData.js`

- Update `hasViewportChanged()` to consider:
  - Zoom level changes that cross thresholds (4, 8, 10) - these affect detail_level
  - Significant bounds changes (already implemented)
  - Transition from world view (zoom < 4) to zoomed view (zoom >= 4)

### Phase 3: Frontend Component Updates

#### 3.1 Handle Minimal Data in Map Components

**Files**:

- `frontend/src/components/LeafletMapView.js`
- `frontend/src/components/DiveSitesMap.js`

- Ensure components handle different data detail levels gracefully:
  - **Minimal data (id, lat, lng only)**: 
    - Markers work with minimal data
    - Clusters show count only (no individual site names)
    - No popups for individual sites (only cluster popups)
  - **Basic data (id, name, lat, lng, difficulty, rating)**: 
    - Markers work with basic data
    - Popups show available data (name, difficulty, rating)
    - May need to fetch full details on demand if user wants more info
  - **Full data**: 
    - All existing functionality works as before

#### 3.2 Optional: On-Demand Full Data Fetching

**File**: `frontend/src/components/LeafletMapView.js`

- When user clicks marker at zoom 8-9 (basic data):
  - Check if full data is available for that dive site
  - If not, fetch full details for that specific site via `/api/v1/dive-sites/{id}`
  - Update marker/popup with full data
  - Cache full data for future use

### Phase 4: Testing & Optimization

#### 4.1 Performance Testing

- Measure API response times for minimal vs basic vs full data
- Measure page load time improvement (especially initial load)
- Measure data transfer reduction at different zoom levels
- Test with various zoom levels and viewport changes
- Compare before/after metrics

#### 4.2 Edge Cases

- Test longitude wrap-around (e.g., -179 to 179)
- Test polar regions (north/south bounds)
- Test rapid zoom/pan changes
- Test initial load with no bounds (world view)
- Test transition from world view (zoom < 4) to zoomed view (zoom >= 4)
- Test zoom level transitions (3->4, 7->8, 9->10)
- Test when bounds become available after initial load

#### 4.3 Cache Management

- Ensure React Query cache handles different detail levels correctly
- Consider separate cache keys for different detail levels:
  - `['dive-sites', 'minimal', bounds]`
  - `['dive-sites', 'basic', bounds]`
  - `['dive-sites', 'full', bounds]`
- Invalidate cache appropriately when switching between detail levels
- When upgrading from minimal to basic/full, merge data instead of replacing

## Files to Modify

### Backend

- `backend/app/routers/dive_sites.py` - Add bounds filtering and detail_level response modes

### Frontend

- `frontend/src/hooks/useViewportData.js` - Implement zoom-based progressive loading logic
- `frontend/src/components/LeafletMapView.js` - Handle different data detail levels in markers
- `frontend/src/components/DiveSitesMap.js` - Handle different data detail levels (if used separately)

## Success Criteria

- [ ] Backend API accepts bounds parameters (north, south, east, west)
- [ ] Backend API supports detail_level parameter ('minimal', 'basic', 'full')
- [ ] World view (zoom < 4) fetches minimal data only (id, lat, lng) without bounds
- [ ] Zoom 4-7 fetches minimal data with bounds filtering
- [ ] Zoom 8-9 fetches basic data with bounds filtering
- [ ] Zoom >= 10 fetches full details with bounds filtering
- [ ] Bounds margin (2-5%) is applied to viewport bounds for zoom >= 4
- [ ] Page load time is reduced (measure before/after, especially initial load)
- [ ] Data transfer is reduced (measure before/after at different zoom levels)
- [ ] Map markers display correctly with minimal data (clustered)
- [ ] Map markers display correctly with basic data (individual sites with popups)
- [ ] Popups work correctly at zoom 8-9 with basic data
- [ ] Popups work correctly at zoom >= 10 with full data
- [ ] No regressions in existing functionality
- [ ] Edge cases are handled (poles, date line, rapid changes, zoom transitions)

## Notes

- **Zoom Thresholds**: 
  - Zoom < 4: World view, no bounds, minimal data
  - Zoom 4-7: Bounds filtering, minimal data
  - Zoom 8-9: Bounds filtering, basic data
  - Zoom >= 10: Bounds filtering, full data
- **Margin Percentage**: User requested 2-5%, implementation uses 2.5% (can be adjusted)
- **World View**: For zoom < 4, fetch all sites with minimal data (no bounds filtering needed)
- **Backward Compatibility**: Ensure existing API calls without bounds/detail_level still work (return full data)
- **Performance**: Monitor API response times and adjust page_size if needed for bounds-filtered queries
- **Cache Strategy**: Consider merging data when upgrading detail levels (e.g., minimal -> basic -> full)