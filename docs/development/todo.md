# Divemap Development Todo

## Active Tasks

### High Priority

### Medium Priority

#### 4. Create Constants File for Magic Numbers

**Status:** Planning

**Priority:** Medium

**Description:** Extract magic numbers (debounce delays, viewport limits) into a centralized constants file to improve code maintainability and reduce duplication.

**Tasks:**

- [ ] Identify all magic numbers in the codebase (debounce delays, viewport limits, etc.)
- [ ] Create centralized constants file with meaningful names
- [ ] Replace magic numbers with named constants
- [ ] Make configuration values easily adjustable
- [ ] Update documentation to reference constants file

**Files:** `frontend/src/constants/index.js`

#### 5. Implement Custom Hooks for Repeated Patterns

**Status:** Planning

**Priority:** Medium

**Description:** Create `useDropdownState()` hook for managing multiple dropdown states and refactor repeated dropdown logic in Navbar component.

**Tasks:**

- [ ] Create `useDropdownState()` custom hook
- [ ] Refactor Navbar component to use the new hook
- [ ] Improve code reusability and consistency
- [ ] Test hook functionality across different components
- [ ] Document hook usage patterns

**Files:** `frontend/src/hooks/useDropdownState.js`

#### 6. Add Error Boundaries for React Components

**Status:** Planning

**Priority:** Medium

**Description:** Implement React error boundaries to catch and handle component errors gracefully, preventing entire app crashes from single component failures.

**Tasks:**

- [ ] Create error boundary components
- [ ] Implement error boundary wrapper for main app
- [ ] Add error logging and reporting
- [ ] Create user-friendly error fallback UI
- [ ] Test error boundary functionality
- [ ] Document error boundary usage

**Files:** `frontend/src/components/ErrorBoundary.js`

#### 7. Consider TypeScript Migration

**Status:** Planning

**Priority:** Medium

**Description:** Evaluate migrating from JavaScript to TypeScript for better type safety, improved developer experience, and reduced runtime errors.

**Tasks:**

- [ ] Evaluate TypeScript migration feasibility
- [ ] Create migration plan and timeline
- [ ] Set up TypeScript configuration
- [ ] Migrate core components to TypeScript
- [ ] Update build process and tooling
- [ ] Train team on TypeScript best practices

**Files:** `tsconfig.json`, `frontend/src/`

#### 8. Add Comprehensive PropTypes Validation

**Status:** Planning

**Priority:** Medium

**Description:** Add PropTypes validation to all React components to improve component documentation and catch prop-related bugs during development.

**Tasks:**

- [ ] Audit existing components for PropTypes usage
- [ ] Add PropTypes to all components missing validation
- [ ] Improve component documentation and usage clarity
- [ ] Set up PropTypes validation in development mode
- [ ] Create PropTypes documentation guidelines

**Files:** `frontend/src/components/`

#### 9. ~~Map View for Dive Sites and Diving Centers~~ **COMPLETED**

**Status:** Completed

**Priority:** ~~Medium~~ **N/A**

**Description:** ~~Implement independent map view for dive sites and diving centers that is separate from list/grid views and their filters/pagination.~~ **This has been implemented as IndependentMapView system.**

**Tasks:**

- [x] Design map view architecture independent of list/grid views
- [x] Implement region-based map display showing all dive sites/centers in viewport
- [x] Add data point clustering for performance optimization
- [x] Implement progressive clustering breakdown on zoom
- [x] Ensure mobile-responsive design and touch interactions
- [x] Set performance limits to prevent map slowdown
- [x] Test map performance with large datasets
- [x] Validate mobile and desktop user experience

**Files:** `frontend/src/pages/IndependentMapView.js`, `frontend/src/components/LeafletMapView.js`

**GitHub Issue:** [#54](https://github.com/kargig/divemap/issues/54) - **COMPLETED**

#### 10. Media Upload/Download with Cloudflare R2 and External Links

**Status:** Planning

**Priority:** Medium

**Description:** Implement media handling system supporting both Cloudflare R2 uploads/downloads and external media links (YouTube, Vimeo, etc.) for pictures and videos.

**Tasks:**

- [ ] Design media handling architecture supporting both R2 and external links
- [ ] Implement external media link support (YouTube, Vimeo, image hosting services)
- [ ] Implement Cloudflare R2 upload functionality for pictures and videos
- [ ] Implement Cloudflare R2 download/streaming functionality
- [ ] Ensure media can be viewed/streamed directly from R2
- [ ] Add media link validation and security checks
- [ ] Implement media type detection and appropriate display methods
- [ ] Test media upload/download performance and reliability
- [ ] Validate external media link functionality across different services
- [ ] Ensure mobile compatibility for media viewing

**Files:** `docs/development/media-handling-implementation.md`

**GitHub Issue:** [#55](https://github.com/kargig/divemap/issues/55)

#### 11. Dive Route Drawing and Selection

**Status:** Planning

**Priority:** Medium

**Description:** Implement interactive dive route drawing functionality allowing users to draw their exact dive path on dive site maps for a specific dive, with the ability for other users to view and select from multiple routes. Each dive route is uniquely attached to a specific dive ID, which is linked to a specific dive site. Users browsing dive sites can view available dive routes and access detailed information by visiting the specific dive details page.

**Tasks:**

- [ ] Design dive route drawing interface with mouse/touch support
- [ ] Implement route drawing canvas overlay on dive site maps
- [ ] Add route saving and association with specific dive logs (dive ID)
- [ ] Implement route storage and retrieval from database with proper relationships
- [ ] Create dive site route browsing interface showing available routes
- [ ] Implement route selection interface for users to choose from available routes
- [ ] Add route metadata (depth, time, difficulty, etc.) linked to dive ID
- [ ] Implement route sharing and community features
- [ ] Ensure mobile compatibility for touch-based route drawing
- [ ] Add route validation and quality checks
- [ ] Test route drawing accuracy and performance
- [ ] Implement route search and filtering by dive site
- [ ] Create dive details page integration showing route information
- [ ] Implement route preview and summary on dive site pages

**Files:** `docs/development/dive-route-drawing-implementation.md`

**GitHub Issue:** [#56](https://github.com/kargig/divemap/issues/56)

#### 12. Dive Route Annotations and Points of Interest

**Status:** Planning

**Priority:** Medium

**Description:** Implement annotation system for dive routes allowing users to mark specific points with comments and icons indicating points of interest such as caverns, big rocks, ship wrecks, car wrecks, airplane wrecks, and other underwater features.

**Tasks:**

- [ ] Design annotation interface for adding points of interest to dive routes
- [ ] Implement point marking system on dive route maps
- [ ] Create icon library for common underwater features (caverns, wrecks, rocks, etc.)
- [ ] Add text comment functionality for each annotation point
- [ ] Implement annotation storage and retrieval from database
- [ ] Create annotation editing and deletion capabilities
- [ ] Add annotation filtering and search by feature type
- [ ] Implement annotation sharing and community features
- [ ] Ensure mobile compatibility for annotation creation and viewing
- [ ] Add annotation validation and quality checks
- [ ] Test annotation system performance with multiple points
- [ ] Create annotation display on dive site and dive details pages
- [ ] Implement annotation export and import functionality

**Files:** `docs/development/dive-route-annotations-implementation.md`

**GitHub Issue:** [#57](https://github.com/kargig/divemap/issues/57)

#### 13. Email Notifications System

**Status:** Planning

**Priority:** Medium

**Description:** Implement email notifications system for admin users and general users. Initially for admin notifications about new user registrations and diving center claims requiring review. Later expanded to user notifications about new dive sites and diving centers in areas of interest.

**Tasks:**

- [ ] Design email notification system architecture
- [ ] Implement admin notification for new user registrations requiring approval
- [ ] Implement admin notification for diving center claims requiring review
- [ ] Set up email service integration (SMTP or email service provider)
- [ ] Create email templates for different notification types
- [ ] Implement notification preferences and settings for users
- [ ] Add user notification system for new dive sites in areas of interest
- [ ] Add user notification system for new diving centers in areas of interest
- [ ] Implement notification frequency controls (immediate, daily digest, weekly)
- [ ] Add notification history and management interface
- [ ] Test email delivery and reliability
- [ ] Implement notification unsubscribe and opt-out functionality
- [ ] Add notification analytics and delivery tracking

**Files:** `docs/development/email-notifications-implementation.md`

**GitHub Issue:** [#19](https://github.com/kargig/divemap/issues/19)

#### 14. Enhanced Subsurface Dive Import with Interactive Dive Profiles

**Status:** Planning

**Priority:** Medium

**Description:** Improve importing of dives from Subsurface to include detailed timing data (10sec, 30sec, 1min intervals) with dive computer information such as temperature, NDL, CNS%, deco stops, gas switches, and other events. Implement interactive dive profile graphs with depth vs time visualization, multiple data series, and exportable/shareable dive profiles.

**Tasks:**

- [ ] Enhance Subsurface import to capture detailed timing intervals (configurable: 10sec, 30sec, 1min)
- [ ] Import dive computer data for each timing: temperature, NDL, CNS%, deco status, gas switches
- [ ] Design database schema for storing detailed dive timing and event data
- [ ] Implement interactive dive profile graph with depth vs time (Y: depth, X: time)
- [ ] Add secondary Y-axis for temperature and CNS% data visualization
- [ ] Implement event markers for gas switches, deco starts/stops, and other dive events
- [ ] Create configurable graph display options (which data series to show)
- [ ] Add graph export functionality (PNG, PDF, data export)
- [ ] Implement shareable dive profile URLs for other users
- [ ] Ensure mobile-responsive graph interaction and display
- [ ] Test with various Subsurface export formats and dive computer data
- [ ] Optimize graph rendering performance for large datasets

**Files:** `docs/development/enhanced-subsurface-import-implementation.md`

**GitHub Issue:** [#61](https://github.com/kargig/divemap/issues/61)

### Low Priority

#### 15. Refactor Dropdown State Management

**Status:** Planning

**Priority:** Low

**Description:** Consolidate dropdown state management using custom hooks to reduce state duplication across components and improve code organization.

**Tasks:**

- [ ] Analyze existing dropdown state patterns
- [ ] Create comprehensive dropdown state management hook
- [ ] Refactor all dropdown implementations
- [ ] Reduce state duplication across components
- [ ] Improve code organization and maintainability
- [ ] Test dropdown functionality across all components

**Files:** `frontend/src/hooks/useDropdownState.js`

#### 16. Implement Proper Error Logging Service

**Status:** Planning

**Priority:** Low

**Description:** Create centralized error logging service for frontend to implement proper error reporting and monitoring for production issues.

**Tasks:**

- [ ] Design error logging service architecture
- [ ] Implement centralized error logging service
- [ ] Add error reporting and monitoring capabilities
- [ ] Integrate with existing error handling
- [ ] Improve debugging capabilities for production issues
- [ ] Test error logging functionality

**Files:** `frontend/src/services/errorLogging.js`

#### 17. Add Performance Monitoring for Map Operations

**Status:** Planning

**Priority:** Low

**Description:** Implement performance monitoring for map rendering and data loading to track and optimize map performance metrics.

**Tasks:**

- [ ] Design performance monitoring system
- [ ] Implement map rendering performance tracking
- [ ] Add data loading performance metrics
- [ ] Create performance dashboard/visualization
- [ ] Identify performance bottlenecks in real-time
- [ ] Optimize based on performance data

**Files:** `frontend/src/services/performanceMonitoring.js`

#### 18. Consider Code Splitting for Large Components

**Status:** Planning

**Priority:** Low

**Description:** Implement code splitting for large React components to improve initial page load performance and optimize bundle size.

**Tasks:**

- [ ] Identify large components suitable for code splitting
- [ ] Implement React.lazy() for component splitting
- [ ] Add Suspense boundaries for loading states
- [ ] Optimize bundle size and loading times
- [ ] Test code splitting performance improvements
- [ ] Monitor bundle size changes

**Files:** `frontend/src/components/`

#### 19. Add Comprehensive Test Coverage

**Status:** Planning

**Priority:** Low

**Description:** Implement comprehensive test suite for all components to ensure code reliability and prevent regressions.

**Tasks:**

- [ ] Set up testing framework and tools
- [ ] Add unit tests for all components
- [ ] Implement integration tests
- [ ] Add end-to-end tests
- [ ] Ensure code reliability and prevent regressions
- [ ] Set up continuous testing pipeline

**Files:** `frontend/src/__tests__/`

#### 20. CSS and Sticky Positioning Guide

**Status:** Documentation

**Priority:** Low

**Description:** Create comprehensive guide for CSS sticky positioning and related layout techniques.

**Tasks:**

- [ ] Review existing sticky positioning implementations
- [ ] Document best practices
- [ ] Create examples and use cases
- [ ] Update component documentation

**Files:** `docs/development/css-and-sticky-positioning-guide.md`

**GitHub Issue:** [#59](https://github.com/kargig/divemap/issues/59)

#### 21. Remove Obsolete OpenLayers Map Components (Partial)

**Status:** Planning

**Priority:** High

**Description:** Remove redundant OpenLayers-based map components that are no longer used after implementing the new Leaflet-based IndependentMapView system. **NOTE: TripMap.js must be preserved as it has trip-specific functionality not covered by IndependentMapView.**

**Tasks:**

- [ ] Remove `DiveMap.js` component (430 lines) - replaced by LeafletMapView
- [ ] Remove `DiveSitesMap.js` component (694 lines) - replaced by LeafletMapView
- [ ] Remove `DivingCentersMap.js` component - replaced by LeafletMapView
- [ ] Remove `DivesMap.js` component (757 lines) - replaced by LeafletMapView
- [ ] **PRESERVE `TripMap.js` component (961 lines)** - has unique trip-specific features:
  - Trip status-based icon colors (scheduled/confirmed/cancelled/completed)
  - Trip-specific filtering (price, status, diving center, dive sites)
  - Trip popup with detailed trip information
  - Status toggle filtering logic
  - Trip-specific coordinate grouping and clustering
- [ ] Remove `DiveTripsMap.js` component (685 lines) - **UNUSED** (not imported anywhere)
- [ ] Remove `UnifiedMapView.js` component (508 lines) - replaced by LeafletMapView
- [ ] Update imports in pages that reference removed components
- [ ] **KEEP OpenLayers dependencies in package.json** - still needed for TripMap.js (until Task #25 migration)
- [ ] Clean up unused map-related utility functions

**Files:** `frontend/src/components/`, `frontend/package.json`

**Important:** IndependentMapView only supports 'dive-sites', 'diving-centers', and 'dives' entity types. It does NOT support dive trips, which have unique requirements like trip status visualization, trip-specific filtering, and trip popup content. Only TripMap.js is needed for dive trip functionality.

#### 22. Remove Obsolete Map Pages

**Status:** Planning

**Priority:** High

**Description:** Remove redundant map pages that are no longer needed after implementing the unified IndependentMapView.

**Tasks:**

- [ ] Remove `DiveMapView.js` page (541 lines) - replaced by IndependentMapView
- [ ] Remove `DiveSiteMap.js` page (436 lines) - replaced by IndependentMapView
- [ ] Update App.js routing to remove obsolete routes
- [ ] Remove `/dives/map` route
- [ ] Remove `/dive-sites/:id/map` route
- [ ] Update navigation links to use `/map` instead of specific map routes
- [ ] Clean up unused imports and dependencies

**Files:** `frontend/src/pages/`, `frontend/src/App.js`

#### 23. Consolidate Map-Related Utilities

**Status:** Planning

**Priority:** Medium

**Description:** Consolidate and clean up map-related utility functions that are no longer needed after removing obsolete OpenLayers components (while keeping OpenLayers for TripMap.js).

**Tasks:**

- [ ] Review `difficultyHelpers.js` for map-specific functions that can be removed
- [ ] Check for unused OpenLayers-specific utility functions
- [ ] Consolidate icon creation logic (currently duplicated across components)
- [ ] Remove unused clustering and viewport management utilities
- [ ] Optimize remaining utility functions for Leaflet usage

**Files:** `frontend/src/utils/`

#### 24. Update Package Dependencies (Partial)

**Status:** Planning

**Priority:** Medium

**Description:** Clean up package dependencies after removing obsolete map components while preserving OpenLayers for TripMap functionality.

**Tasks:**

- [ ] **KEEP OpenLayers packages: `ol`, `ol-react`** - still needed for TripMap.js (until Task #25 migration)
- [ ] Remove only unused OpenLayers-related dependencies (if any)
- [ ] Update package-lock.json
- [ ] Verify OpenLayers imports only remain in TripMap components
- [ ] Test application functionality after dependency cleanup
- [ ] **DEPENDENCY:** Complete Task #25 (Migrate TripMap to Leaflet) before removing OpenLayers

**Files:** `frontend/package.json`, `frontend/package-lock.json`

**Note:** OpenLayers must be preserved until Task #25 (Migrate TripMap to Leaflet) is completed. After migration, all OpenLayers dependencies can be removed.


#### 26. Floating Search Filters Guide

**Status:** Documentation

**Priority:** Low

**Description:** Document the floating search filters implementation and usage patterns.

**Tasks:**

- [ ] Document current implementation
- [ ] Create usage examples
- [ ] Document best practices
- [ ] Update component documentation

**Files:** `docs/development/floating-search-filters-guide.md`

**GitHub Issue:** [#60](https://github.com/kargig/divemap/issues/60)

## Completed Tasks

The following tasks have been completed and moved to `docs/development/done/`:

- ✅ **Cloudflare Turnstile Integration** - Complete bot protection with optimized database schema
- ✅ **Mobile Sorting Consolidation** - Consolidated mobile controls into filter overlay
- ✅ **Newsletter Parsing Implementation** - Complete newsletter parsing and trip display
- ✅ **Sorting Functionality** - Comprehensive sorting across all entities
- ✅ **Refresh Token Implementation** - Complete authentication system with refresh tokens
- ✅ **Diving Centers UX Improvements** - Content-first design with unified search
- ✅ **Dive Sites UX Improvements** - Mobile-optimized with progressive disclosure
- ✅ **Dive Trips UX Improvements** - Enhanced trip browsing and search
- ✅ **Mobile Sorting UX** - Mobile-optimized sorting controls
- ✅ **Fuzzy Search Implementation** - Complete fuzzy search across all public content types (Dives, Diving Centers, Dive Sites, Dive Trips) with consistent scoring, match type badges, and mobile-optimized interfaces
- ✅ **Frontend Rate Limiting and Error Handling** - Complete rate limiting error handling integration across all major frontend pages (10/10 pages) with API interceptor, RateLimitError component, countdown timers, and comprehensive error handling patterns
- ✅ **Nginx Proxy Implementation** - Complete nginx reverse proxy for development and production environments, resolving cross-origin cookie issues with refresh tokens and providing unified origin for frontend and backend services

## Notes

- All completed implementation plans have been moved to `docs/development/done/`
- Active implementation plans are in `docs/development/work/`
- This todo follows the new Todo Implementation Program structure
- New tasks should be created using the proper workflow in `docs/development/work/[task-name]/task.md`
