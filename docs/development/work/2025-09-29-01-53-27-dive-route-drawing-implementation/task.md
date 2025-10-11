# Implement dive route drawing and selection system

**Status:** Refining
**Created:** 2025-09-29T01:53:27Z
**Agent PID:** 661645
**Branch:** feature/dive-route-drawing-implementation

## Description

Implement a dive route drawing and selection system that allows users to draw their exact dive paths on dive site maps and share them with the community. The system will build upon the existing Leaflet mapping infrastructure and integrate seamlessly with the current dive logging and dive site management systems.

### Key Features

- **Interactive Route Drawing**: Users can draw dive routes directly on dive site maps using mouse and touch interactions in a full-screen interface
- **2D Route Data**: Routes are stored as 2D GeoJSON only (no depth data) - drawing happens on 2D maps
- **Dive Site Association**: Routes are linked to dive sites, making them reusable across multiple dives at the same location
- **Route Selection**: Users can select from available routes when creating or editing dives
- **Simplified Storage**: Route data is stored with minimal metadata - difficulty and duration come from dive sites and dives
- **Community Sharing**: Users can browse and select from a community library of available routes for each dive site
- **Smart Deletion**: Routes can be deleted with proper restrictions and migration of associated dives
- **Mobile Optimization**: Touch-optimized drawing interface that works smoothly on mobile devices
- **Seamless Integration**: Routes are displayed in dive detail pages and can be selected during dive creation

## Success Criteria

### Functional Requirements

- [ ] Users can draw dive routes on dive site maps using mouse and touch in full-screen interface
- [ ] Routes are stored as 2D GeoJSON only (no depth data) - drawing happens on 2D maps
- [ ] Routes are properly associated with dive sites (not individual dives) for reusability
- [ ] Route data is stored and retrieved correctly from the database using simplified schema
- [ ] Users can browse available routes on dive site pages with filtering and search
- [ ] Users can select routes when creating or editing dives from available routes for that dive site
- [ ] Selected routes are displayed on dive detail pages (new "Route" tab or integrated map view)
- [ ] Route metadata (name, description, route type) is properly managed - no duplicate difficulty/duration
- [ ] Route deletion works with proper restrictions and migration of associated dives
- [ ] Mobile touch drawing works smoothly on various devices with optimized interface
- [ ] Route sharing and community features function correctly with proper permissions

### Quality Requirements

- [ ] All API endpoints respond correctly and handle errors gracefully
- [ ] Frontend components render without errors and follow project standards
- [ ] Mobile compatibility is verified across different devices and screen sizes
- [ ] Performance meets requirements (smooth drawing, fast loading)
- [ ] Code follows project standards (ESLint, Prettier, TypeScript where applicable)
- [ ] Tests provide adequate coverage for all new functionality

### User Experience Requirements

- [ ] Drawing interface is intuitive and responsive
- [ ] Route management is easy to use and understand
- [ ] Route discovery is efficient and user-friendly
- [ ] Mobile experience is optimized for touch interactions
- [ ] Integration with existing features is seamless

## Implementation Plan

### Phase 1: Database Schema & Models (Week 1) ✅ COMPLETED

- [x] Create simplified migration `0035_add_dive_routes_table.py` with 2D GeoJSON route data storage
- [x] Add simplified `DiveRoute` SQLAlchemy model with soft delete support
- [x] Add `selected_route_id` foreign key to `dives` table to link dives to selected routes
- [x] Create simplified Pydantic schemas for 2D route data validation
- [x] Implement two-tier deletion system (soft delete + hard delete)
- [x] Add soft delete fields and methods to DiveRoute model
- [x] Create RouteDeletionService with cross-user protection and migration logic
- [x] Add route deletion protection to prevent modification of other users' dives
- [ ] Write unit tests for simplified models and deletion logic

#### Phase 1 Files Created/Modified

- **Migration**: `backend/migrations/versions/0035_add_dive_routes_table.py` - Simplified schema with soft delete
- **Model**: `backend/app/models.py` - Added DiveRoute model, RouteType enum, updated relationships
- **Schemas**: `backend/app/schemas.py` - Added simplified Pydantic schemas with 2D GeoJSON validation
- **Service**: `backend/app/services/route_deletion_service.py` - Route deletion logic and permissions
- **Task**: `docs/development/work/2025-09-29-01-53-27-dive-route-drawing-implementation/task.md` - Updated plan

### Phase 2: Backend API Foundation (Week 2) ✅ COMPLETED

- [x] Implement CRUD API endpoints for route management (`/api/v1/dive-routes`)
- [x] Add route search and filtering capabilities with pagination by dive site
- [x] Add route endpoints to existing dive site APIs (`/api/v1/dive-sites/{id}/routes`)
- [x] Add route validation logic for geometry and metadata
- [x] Implement two-tier deletion system with cross-user protection
- [ ] Write comprehensive unit tests for API endpoints

#### Phase 2 Files Created/Modified

- **Router**: `backend/app/routers/dive_routes.py` - Complete CRUD API with two-tier deletion
- **Integration**: `backend/app/routers/dive_sites.py` - Added route endpoints to dive sites
- **Main App**: `backend/app/main.py` - Added dive routes router to FastAPI app
- **Service**: `backend/app/services/route_deletion_service.py` - Updated with two-tier deletion
- **Task**: `docs/development/work/2025-09-29-01-53-27-dive-route-drawing-implementation/task.md` - Updated plan

### Phase 3: Route Drawing Interface (Week 3) ✅ COMPLETED

- [x] Install and configure Leaflet.draw plugin in frontend
- [x] Create full-screen RouteDrawingCanvas component with touch/mouse support
- [x] Add "Draw Route" button to dive site detail pages that opens full-screen drawing interface
- [x] Implement real-time route preview during drawing with waypoint markers
- [x] Add route validation on frontend (geometry, metadata, required fields)

#### Phase 3 Files Created/Modified

- **Component**: `frontend/src/components/RouteDrawingCanvas.js` - Full-screen drawing interface with Leaflet.draw
- **Page**: `frontend/src/pages/DiveSiteDetail.js` - Added Draw Route button and integration
- **Package**: `frontend/package.json` - Added leaflet-draw dependency
- **Task**: `docs/development/work/2025-09-29-01-53-27-dive-route-drawing-implementation/task.md` - Updated plan

### Phase 4: Mobile Drawing Optimization (Week 4) ✅ COMPLETED

- [x] Implement mobile-optimized touch drawing interface with gesture support
- [x] Add route snapping to existing dive site markers and boundaries
- [x] Create route data compression utilities for performance
- [x] Add comprehensive error handling and user feedback with loading states
- [ ] Test drawing interface on various mobile devices

#### Phase 4 Files Created/Modified

- **Component**: `frontend/src/components/RouteDrawingCanvas.js` - Enhanced with mobile optimization, error handling, route snapping
- **Utility**: `frontend/src/utils/routeCompression.js` - Route data compression utilities for performance
- **Task**: `docs/development/work/2025-09-29-01-53-27-dive-route-drawing-implementation/task.md` - Updated plan

### Phase 5: Route Management & Metadata (Week 5)

- [ ] Add route editing and management interface with metadata forms
- [ ] Integrate drawing canvas with dive site maps using existing Leaflet infrastructure
- [ ] Implement route interaction endpoints (view, verify, copy, share)
- [ ] Add route sharing and community features with proper permissions

### Phase 6: Route Discovery on Dive Sites (Week 6)

- [ ] Create RouteSelectionInterface component for browsing routes by dive site
- [ ] Add "Available Routes" section to dive site detail pages with filtering and search
- [ ] Implement route filtering and search functionality (difficulty, duration, type)
- [ ] Create route preview and details modal with map visualization

### Phase 7: Dive Integration (Week 7)

- [ ] Add route selection interface to dive creation/edit forms
- [ ] Add "Route" tab to dive detail pages to display selected route
- [ ] Integrate route display with existing LeafletMapView component in dive details
- [ ] Add route selection endpoints to dive creation/edit APIs

### Phase 8: Advanced Features & Export (Week 8)

- [ ] Add route analytics and usage tracking for community insights
- [ ] Implement route export functionality (GPX, KML formats)
- [ ] Add route interaction endpoints (view, verify, copy, share)

### Phase 9: Testing & Performance (Week 9)

- [ ] Comprehensive end-to-end testing across all devices
- [ ] Performance testing with large datasets (1000+ routes)
- [ ] Mobile device testing and optimization
- [ ] Route data validation and quality checks

### Phase 10: Security & Polish (Week 10)

- [ ] Security testing and vulnerability assessment
- [ ] User acceptance testing and feedback integration
- [ ] Update documentation and user guides
- [ ] Final bug fixes and performance optimization

## Dependencies & Prerequisites

### Technical Dependencies

- **Leaflet.draw plugin**: Must be installed before Phase 2
- **Migration 0035**: Must be created and tested before Phase 1 completion
- **Existing API patterns**: Follow established router patterns from `dive_sites.py`
- **Mobile testing devices**: Required for Phase 4+ (mobile drawing optimization)

### Phase Dependencies

- **Phase 1 → Phase 2**: Database schema must be complete before API implementation
- **Phase 2 → Phase 3**: Backend APIs must be ready before frontend drawing interface
- **Phase 3 → Phase 4**: Basic drawing interface must work before mobile optimization
- **Phase 4 → Phase 5**: Mobile drawing must be stable before advanced management features
- **Phase 5 → Phase 6**: Route management must be complete before discovery features
- **Phase 6 → Phase 7**: Route discovery must work before dive integration
- **Phase 7 → Phase 8**: Core functionality must be complete before advanced features
- **Phase 8 → Phase 9**: All features must be implemented before comprehensive testing
- **Phase 9 → Phase 10**: Testing must be complete before final polish
- **Continuous**: Unit testing throughout all phases, mobile testing from Phase 4+

### Integration Points

- **Dive Site Pages**: "Draw Route" button and "Available Routes" section added to dive site detail pages
- **Dive Creation/Edit**: Route selection interface integrated into dive creation and edit forms
- **Dive Detail Pages**: New "Route" tab added to display selected route with map visualization
- **Map System**: Integration with existing LeafletMapView component for route display
- **API Layer**: New router following established patterns in `backend/app/routers/`

## User Experience Flow

### Route Creation Flow

1. **User visits dive site detail page** → Sees existing map and dive site information
2. **User clicks "Draw Route" button** → Opens full-screen map interface with drawing tools
3. **User draws route on map** → Uses mouse/touch to create polyline with waypoints
4. **User fills route metadata** → Enters name, description, difficulty, duration, etc.
5. **User saves route** → Route is associated with dive site and becomes available to community

### Route Selection Flow

1. **User creates new dive or edits existing dive** → Navigates to dive creation/edit form
2. **User selects dive site** → System loads available routes for that dive site
3. **User browses available routes** → Views route cards with previews and metadata
4. **User selects a route** → Route is associated with the dive (optional)
5. **User saves dive** → Dive now has selected route for future reference

### Route Display Flow

1. **User views dive detail page** → Sees existing tabs: "Details" and "Profile"
2. **User clicks "Route" tab** → New tab displays selected route with map visualization
3. **User sees route details** → Map shows route path, waypoints, and dive site context
4. **User can interact with route** → Zoom, pan, view waypoint details, export route

## Design Decisions & Simplifications

### Simplified Data Model

- **2D GeoJSON Only**: Routes are drawn on 2D maps without depth data - depth comes from dive records
- **No Duplicate Metadata**: Difficulty and duration are managed at dive site and dive levels, not route level
- **Minimal Schema**: Only essential fields (id, dive_site_id, created_by, name, description, route_data, route_type, timestamps)
- **Soft Delete**: Routes are soft deleted to preserve data integrity and allow restoration

### Route Deletion Strategy

- **Two-Tier Deletion System**:
  - **Soft Delete (Hide)**: Hide routes from new selections, preserve data integrity
  - **Hard Delete (Remove)**: Permanently delete routes, only if no other users' dives use them
- **Permission-Based Access**:
  - **Route Creators**: Can soft delete any route, hard delete only their own dives
  - **Admins**: Can soft delete or hard delete any route with migration
  - **Site Moderators**: Can soft delete routes on sites they moderate
- **Cross-User Protection**: Cannot hard delete routes used by other users' dives
- **Migration Support**: Dives can be migrated to alternative routes before hard deletion
- **Restoration**: Soft-deleted routes can be restored by creators or admins
- **Data Integrity**: Prevents modification of other users' dive data

### Why These Simplifications?

1. **2D Maps**: Drawing happens on 2D maps - depth is a dive property, not a route property
2. **No Data Duplication**: Difficulty/duration are already managed at appropriate levels
3. **Cleaner UX**: Simpler route creation and management
4. **Better Performance**: Smaller database footprint and faster queries
5. **Maintainable**: Less complex code and fewer edge cases

## Technical Requirements & Constraints

### Database Schema

- **Migration Number**: 0035 (next in sequence after 0034)
- **Table Name**: `dive_routes`
- **Route Data Format**: 2D GeoJSON only (no depth data)
- **Relationships**: Foreign keys to `dive_sites.id` and `users.id` (NOT dives.id)
- **Dive Integration**: Add `selected_route_id` foreign key to `dives` table
- **Soft Delete**: `deleted_at` and `deleted_by` fields for safe deletion
- **Indexes**: Performance indexes for `dive_site_id`, `created_by`, `deleted_at`

### Frontend Dependencies

- **Leaflet.draw**: Must be added to `package.json` before Phase 2
- **React Leaflet**: Already available (v4.2.1)
- **Touch Events**: Custom implementation for mobile drawing
- **Performance**: Max 1000 routes per viewport (following existing map limits)

### API Endpoints

- **Base Path**: `/api/v1/dive-routes`
- **Authentication**: JWT token required for create/update/delete
- **Rate Limiting**: Follow existing patterns from other routers
- **Error Handling**: Consistent with existing API error responses

### Mobile Requirements

- **Touch Targets**: Minimum 44px for mobile interaction
- **Performance**: Smooth drawing on devices with 2GB+ RAM
- **Responsive**: Works on screens 320px+ width
- **Offline**: Basic route viewing when offline (cached data)

### Security Considerations

- **Input Validation**: Server-side validation of all route data
- **Permission Checks**: Users can only edit their own routes
- **Data Sanitization**: Prevent XSS in route metadata
- **Rate Limiting**: Prevent abuse of route creation endpoints

## Review

- [x] **CRITICAL BUG**: Multi-segment routes lose drawn segments when switching route types (walk → swim → scuba)
- [x] **ARCHITECTURAL ISSUE**: Drawing controls are recreated when routeType changes, destroying existing segments
- [x] **ROOT CAUSE**: useEffect dependencies include routeType, causing complete system recreation
- [x] **SOLUTION**: Complete architectural rewrite to separate drawing infrastructure from segment management

### Comprehensive Fix Plan

#### **Root Cause Analysis**
The problem is **architectural**: we're treating route type changes as requiring complete recreation of the drawing system, when we should treat it as just a color/style change for NEW segments only.

#### **Core Issues**
1. **Drawing Controls Recreation**: `useEffect` recreates entire system when `routeType` changes
2. **FeatureGroup Destruction**: Existing drawn items are lost when controls are recreated  
3. **State Synchronization**: No proper sync between React state and Leaflet layers
4. **Color Application**: Colors are baked into drawing controls instead of applied dynamically

#### **Architectural Solution**

**Phase 1: Restructure State Management**
- Remove internal `routeType` state from `MultiSegmentRouteCanvas`
- Add `segments` state to track all drawn segments with their types and colors
- Create `onDrawCreated` callback with proper dependencies using `useCallback`

**Phase 2: Fix MapInitializer Architecture**  
- Change `useEffect` dependencies to `[diveSite, onDrawCreated]` (NOT `routeType`)
- Create persistent FeatureGroup that never gets recreated
- Add segment restoration logic to restore existing segments on initialization
- Remove `routeType` from drawing control configuration

**Phase 3: Implement Segment Management**
- Add segment list UI with type indicators, color swatches, and delete buttons
- Add segment count display and clear all functionality
- Ensure proper cleanup and state synchronization between React and Leaflet

**Phase 4: Testing and Validation**
- Test complete workflow: walk → swim → scuba segments
- Verify segments persist when switching route types
- Verify color application matches legend
- Verify segment management works properly

#### **Key Technical Changes**

1. **State Management**:
   ```javascript
   // MultiSegmentRouteCanvas
   const [segments, setSegments] = useState([]); // Track all segments
   const onDrawCreated = useCallback((e) => {
     // Apply current routeType color to new segment
     // Add to persistent FeatureGroup
     // Update segments state
   }, [routeType, diveSite, setSegments]);
   ```

2. **MapInitializer Architecture**:
   ```javascript
   // MapInitializer
   useEffect(() => {
     // Initialize drawing controls ONCE
     // Create persistent FeatureGroup
     // Restore existing segments
     // Set up event handlers
   }, [diveSite, onDrawCreated]); // NOT routeType
   ```

3. **Segment Management**:
   ```javascript
   // Segment restoration
   segments.forEach(segment => {
     const layer = L.geoJSON(segment.geometry);
     layer.setStyle({ color: segment.properties.color });
     drawnItemsRef.current.addLayer(layer);
   });
   ```

#### **Expected User Workflow**
1. Select "Multi" mode → Select "Walk Route" → Draw walk segment (orange)
2. Select "Swim Route" → Walk segment remains visible → Draw swim segment (blue)  
3. Select "Scuba Route" → Both segments remain visible → Draw scuba segment (green)
4. See all segments with different colors → Manage segments → Save complete route

This is a **complete architectural rewrite** that addresses the root cause rather than symptoms. The solution separates drawing infrastructure (stable) from segment management (dynamic), ensuring segments persist across route type changes.

## Notes

[Important findings during implementation]

## Related Documentation

- **Technical Specification**: [technical-specification.md](./technical-specification.md) - Detailed code examples, API specifications, and component architecture
- **README**: [README.md](./README.md) - Directory overview and quick reference
