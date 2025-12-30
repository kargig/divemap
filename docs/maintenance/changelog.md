# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the
Divemap application.

## [Latest Release] - November 03, 2025

### ⚙️ New Features

#### **Comprehensive Dive Route Drawing and Selection System - ✅ COMPLETE**

A complete dive route system that allows users to draw, share, and select dive paths on dive site maps. This feature enables users to plan and document their exact dive routes with multi-segment support.

**Core Features:**

- **Multi-Segment Route Drawing**: Full-screen drawing interface supporting multiple route segments (walk, swim, scuba) on dive site maps
- **Touch-Optimized Interface**: Mobile-friendly drawing interface with mouse and touch support for smooth interaction
- **Route Types**: Three distinct route types with color coding:
  - **Walk Route**: Orange segments for surface walking paths
  - **Swim Route**: Blue segments for surface swimming paths
  - **Scuba Route**: Green segments for underwater diving paths
- **Dive Integration**: Users can select routes when creating or editing dives
- **Community Sharing**: Browse and select from community-created routes for each dive site
- **Route Analytics**: Track route views, copies, shares, and interactions for popular routes
- **Export Functionality**: Export routes in GPX and KML formats for use in other applications
- **Soft Deletion**: Safe route deletion with proper migration of associated dives
- **Route Minimap**: Visual preview and minimap display for routes

**Technical Implementation:**

- **Backend**: Complete REST API with CRUD operations, analytics tracking, export services, and deletion management
- **Frontend**: Full-screen drawing canvas with Leaflet integration, route selection components, and route detail pages
- **Database**: `dive_routes` table with multi-segment GeoJSON storage and `route_analytics` tracking table
- **Migrations**: `0036_add_dive_routes_table_with_mixed_drawing_type.py` and `0037_add_route_analytics_tracking_table.py`

**API Endpoints:**

- `GET /api/v1/dive-routes/` - List routes with filtering and pagination
- `POST /api/v1/dive-routes/` - Create new route
- `GET /api/v1/dive-routes/{route_id}` - Get route details
- `PUT /api/v1/dive-routes/{route_id}` - Update route
- `DELETE /api/v1/dive-routes/{route_id}` - Soft delete route
- `GET /api/v1/dive-routes/{route_id}/export/{format}` - Export route (GPX/KML)
- `GET /api/v1/dive-sites/{dive_site_id}/routes` - Get routes for dive site
- `POST /api/v1/dive-sites/{dive_site_id}/routes` - Create route for dive site
- `POST /api/v1/dive-routes/{route_id}/interactions` - Track route interactions

**Files Added/Modified:**

- `backend/app/routers/dive_routes.py` - Complete route API (871 lines)
- `backend/app/services/route_analytics_service.py` - Analytics tracking
- `backend/app/services/route_deletion_service.py` - Soft deletion management
- `backend/app/services/route_export_service.py` - GPX/KML export
- `backend/app/models.py` - DiveRoute and RouteAnalytics models
- `frontend/src/pages/DiveRouteDrawing.js` - Full-screen drawing interface
- `frontend/src/pages/RouteDetail.js` - Route detail and preview page
- `frontend/src/components/RouteCanvas.js` - Drawing canvas component
- `frontend/src/components/RouteSelection.js` - Route selection interface
- `frontend/src/components/DiveSiteRoutes.js` - Route display on dive sites
- `frontend/src/utils/routeUtils.js` - Route utility functions
- `frontend/src/utils/routeCompression.js` - Route data compression

**Test Coverage:**

- Comprehensive test suite with 518+ tests covering all route functionality
- Integration tests for route creation, selection, and deletion
- Validation tests for route data integrity
- Performance tests for large route datasets
- Security tests for input sanitization and authorization

**User Experience:**

- Intuitive drawing interface with undo/redo capabilities
- Route preview and minimap for visual confirmation
- Popular routes display for community discovery
- Seamless integration with dive creation and editing
- Mobile-optimized touch interactions for on-the-go route planning

#### **Settings System - ✅ COMPLETE**

A new database-backed settings system provides runtime configuration management without code deployment.

**Migration Details**:

- **New Table**: `settings` table with flexible key-value storage
- **Migration File**: `0041_add_settings_table.py`
- **Table Schema**:
  - `id`: Primary key (auto-increment)
  - `key`: Unique setting identifier (VARCHAR 255, indexed)
  - `value`: JSON-serialized setting value (TEXT)
  - `description`: Optional setting description (TEXT)
  - `created_at`, `updated_at`: Timestamp tracking

**Features**:

- **Generic Design**: Supports various data types (stored as JSON strings)
- **Fast Lookups**: Indexed key column for efficient queries
- **Audit Trail**: Automatic timestamp tracking for settings lifecycle
- **Admin API**: RESTful endpoints for reading and updating settings
- **Public Read Access**: Settings can be read without authentication for frontend integration

**API Endpoints**:

- `GET /api/v1/settings/{key}` - Public read access to individual settings
- `GET /api/v1/settings` - Admin-only list of all settings
- `PUT /api/v1/settings/{key}` - Admin-only update of setting values

See [Settings API Documentation](../development/api.md#settings-api) for complete endpoint details and examples.

#### **Diving Center Reviews Control - ✅ COMPLETE**

Administrators can now globally disable or enable diving center reviews (ratings and comments) via a database setting.

**Setting**: `disable_diving_center_reviews`

- **Type**: Boolean
- **Default**: `false` (reviews enabled)
- **Admin UI**: Toggle available at `/admin/diving-centers`

**Behavior When Disabled (`true`)**:

- **Backend**: All rating and comment endpoints return `403 Forbidden`
- **Frontend**: Rating and comment UI completely hidden from all users
- **Listings**: Rating filters (`min_rating`, `max_rating`) are ignored
- **API Responses**: Rating data (`average_rating`, `total_ratings`) excluded from responses
- **Sort Options**: `comment_count` removed from valid sort fields

**Behavior When Enabled (`false`)**:

- All review functionality works normally
- Rating and comment UI visible to users
- Rating filters work in listing endpoints
- Rating data included in API responses

**Implementation Details**:

- Backend endpoints check setting before processing rating/comment requests
- Frontend components conditionally render based on setting value
- React Query hooks (`useSetting`) provide cached, efficient setting access
- Setting changes take effect immediately without server restart

**Files Modified**:

- `backend/app/routers/diving_centers.py` - Rating/comment endpoint enforcement
- `backend/app/routers/settings.py` - Settings API endpoints
- `backend/app/utils.py` - Helper function `is_diving_center_reviews_enabled()`
- `frontend/src/pages/AdminDivingCenters.js` - Admin toggle UI
- `frontend/src/pages/DivingCenterDetail.js` - Conditional review UI rendering
- `frontend/src/pages/DivingCenters.js` - Rating filter visibility control
- `frontend/src/components/DivingCentersResponsiveFilterBar.js` - Filter UI conditional rendering
- `frontend/src/hooks/useSettings.js` - React Query hooks for settings

#### **Share/Social Media Integration - ✅ COMPLETE**

Comprehensive sharing functionality across multiple social media platforms for dives, dive sites, and dive routes. Users can now share their dive experiences, favorite locations, and routes across various social media platforms and communication channels.

**Core Features:**

- **Multi-Platform Sharing**: Support for Twitter/X, Facebook, WhatsApp, Viber, Reddit, and Email
- **Privacy-Aware Sharing**: Private dives only shareable by owner/admin
- **Consistent Branding**: All share posts include "on Divemap" branding for platform visibility
- **Entity-Specific Messaging**: Tailored share content for dives, dive sites, and dive routes
- **Official Brand Icons**: Social media icons from Simple Icons CDN for professional appearance
- **Native Web Share API**: Mobile device support with native sharing capabilities
- **Share Analytics**: Track route shares for analytics and engagement metrics

**Technical Implementation:**

- **Backend**: ShareService for generating shareable URLs and formatted content
- **Frontend**: ShareButton and ShareModal components with platform-specific buttons
- **API Endpoints**: Complete share router with endpoints for all entity types
- **Share Preview**: Preview endpoints for all entity types to show what will be shared
- **Rate Limiting**: 30 requests/minute with admin exemption

**API Endpoints:**

- `POST /api/v1/share/dives/{dive_id}` - Generate share content for dive
- `GET /api/v1/share/dives/{dive_id}/preview` - Preview share content
- `POST /api/v1/share/dive-sites/{dive_site_id}` - Generate share content for dive site
- `GET /api/v1/share/dive-sites/{dive_site_id}/preview` - Preview share content
- `POST /api/v1/share/dive-routes/{route_id}` - Generate share content for route
- `GET /api/v1/share/dive-routes/{route_id}/preview` - Preview share content

**Files Added/Modified:**

- `backend/app/services/share_service.py` - Share service with platform URL generation
- `backend/app/routers/share.py` - Share router with all endpoints
- `frontend/src/components/ShareButton.js` - Reusable share button component
- `frontend/src/components/ShareModal.js` - Share modal with platform grid
- `frontend/src/utils/shareUtils.js` - Share utility functions
- `frontend/src/components/SocialMediaIcons.js` - Social media icon components
- `frontend/src/pages/DiveDetail.js` - Share integration
- `frontend/src/pages/DiveSiteDetail.js` - Share integration
- `frontend/src/pages/RouteDetail.js` - Share integration

**Test Coverage:**

- 25 comprehensive API tests covering all share functionality
- Privacy and authorization testing
- Platform URL generation validation
- Rate limiting structure verification

#### **Global Navbar Search - ✅ COMPLETE**

Unified global search functionality that allows users to search across all entity types (dive sites, diving centers, dives, dive routes, dive trips) directly from the navbar.

**Core Features:**

- **Unified Search Endpoint**: Single endpoint `/api/v1/search` that queries all entity types simultaneously
- **Real-Time Autocomplete**: Debounced search (300ms) with minimum 3 characters
- **Icon Differentiation**: Visual icons for each entity type (Map, Building, Anchor, Calendar, Route)
- **Keyboard Navigation**: Arrow keys, Enter, and Escape key support
- **Responsive Design**: Mobile and desktop optimized search interface
- **Grouped Results**: Results grouped by entity type with counts
- **Quick Navigation**: Click or keyboard selection navigates to detail pages

**Technical Implementation:**

- **Backend**: Sequential queries for all entity types (SQLAlchemy sessions not thread-safe)
- **Frontend**: GlobalSearchBar component with debounced search
- **API Integration**: Uses existing search logic from each entity router
- **Rate Limiting**: 150 requests/minute with admin exemption

**API Endpoints:**

- `GET /api/v1/search?q={query}&limit={limit}` - Global search across all entity types

**Response Format:**

- Returns grouped results by entity type with metadata
- Each result includes entity type, icon name, route path, and optional metadata
- Total count across all entity types

**Files Added/Modified:**

- `backend/app/routers/search.py` - Global search router
- `frontend/src/components/GlobalSearchBar.js` - Search bar component
- `frontend/src/api.js` - Search API function
- `frontend/src/components/Navbar.js` - Search bar integration

#### **Enhanced Newsletter Management and Trip Creation - ✅ COMPLETE**

Comprehensive enhancements to newsletter management, trip creation, and access control with improved user experience and expanded functionality.

**Core Features:**

- **Tabbed Navigation**: Admin newsletters page with Create/List tabs for better organization
- **Enhanced Newsletter List**: Displays diving center names and trip dates for better context
- **Dive Trips on Diving Centers**: Dive trips section on diving center detail pages with 3-month date navigation
- **Reusable Trip Form**: Extracted TripFormModal component for use in modals and standalone pages
- **Dedicated Create Trip Page**: New `/dive-trips/create` page for trip creation
- **Access Control**: Only admin/moderator/approved owners can create trips
- **Ownership Management**: Display claim reason in admin interface and owned centers in profile
- **Trip Filters**: Comprehensive filtering by diving center, dive site, and date range
- **Blurred Preview**: Unauthenticated users see 1-2 blurred dive trips with login prompt

**Technical Implementation:**

- **Backend**: Enhanced newsletter endpoints with diving center metadata support
- **Frontend**: Reusable components (TripFormModal, NewsletterUpload) for consistency
- **Access Control**: Backend restrictions for unauthenticated users (2 oldest trips per center)
- **Filtering**: Advanced filtering with dropdowns and calendar date pickers

**Files Added/Modified:**

- `backend/app/routers/newsletters.py` - Enhanced newsletter and trip endpoints
- `frontend/src/components/TripFormModal.js` - Reusable trip form component
- `frontend/src/pages/CreateTrip.js` - Dedicated create trip page
- `frontend/src/pages/AdminNewsletters.js` - Tabbed interface and enhanced actions
- `frontend/src/pages/DivingCenterDetail.js` - Dive trips with date navigation
- `frontend/src/pages/TripDetail.js` - Reordered tabs and renamed Overview
- `frontend/src/pages/DiveTrips.js` - Comprehensive filtering

#### **Route Map Enhancements - ✅ COMPLETE**

Significant improvements to route map visualization and editing capabilities with better navigation aids and user controls.

**Core Features:**

- **Compass Bearings**: Bearing degree labels (e.g., '20° N', '270° W') along route segments for navigation
- **Map Layers**: Switch between Street, Satellite, Terrain, and Navigation views
- **Satellite Default**: Default map layer changed to Satellite for better visual context
- **Bearing Toggle**: Show/hide bearing icons with toggle button
- **Snapping Toggle**: Optional snapping to dive site points within 50 meters when drawing routes
- **Zoom-Based Visibility**: Bearings visible only at zoom levels 16-18 to prevent clutter
- **Callback Fixes**: Fixed ReferenceError in RouteCanvas callback initialization

**Technical Implementation:**

- **Bearing Calculation**: Utilities in routeUtils.js for calculating bearings between waypoints
- **Map Layers Panel**: Reusable MapLayersPanel component for layer selection
- **Snapping Logic**: Optional snapping with visual state indicators
- **Callback Refs**: Prevent Leaflet Draw control recreation issues

**Files Modified:**

- `frontend/src/utils/routeUtils.js` - Bearing calculation functions
- `frontend/src/pages/RouteDetail.js` - Bearing labels and map layers
- `frontend/src/pages/DiveSiteMap.js` - Bearing labels on dive site routes
- `frontend/src/pages/DiveDetail.js` - Bearing labels on dive detail routes
- `frontend/src/components/RouteCanvas.js` - Map layers, snapping, callback fixes

### 🗄️ Database Changes

#### **Difficulty Taxonomy Migration - ✅ COMPLETE**

- **Normalized Difficulty System**: Migrated from integer-based difficulty levels to a lookup table system with stable codes
- **Extensible Architecture**: New difficulty levels can be added without schema changes by inserting rows into the `difficulty_levels` table
- **Improved Data Integrity**: Foreign key constraints ensure valid difficulty values across all entities
- **Nullable Support**: Dive sites, dives, and parsed dive trips can now have unspecified difficulty (NULL)

**Migration Details:**

- **New Table**: `difficulty_levels` lookup table with columns: `id`, `code`, `label`, `order_index`
- **Difficulty Mapping**:
  - Beginner → Open Water (`OPEN_WATER`)
  - Intermediate → Advanced Open Water (`ADVANCED_OPEN_WATER`)
  - Advanced → Deep/Nitrox (`DEEP_NITROX`)
  - Expert → Technical Diving (`TECHNICAL_DIVING`)
- **Migration File**: `0040_migrate_difficulty_to_lookup_table.py`
- **Data Preservation**: All existing difficulty values automatically mapped to new system
- **Schema Changes**: Replaced integer columns with nullable foreign key references

**Technical Implementation:**

- Created `difficulty_levels` table with 4 initial difficulty levels
- Added nullable `difficulty_id` foreign key columns to `dive_sites`, `dives`, and `parsed_dive_trips` tables
- Backfilled existing integer values to foreign key IDs
- Removed old integer `difficulty_level` columns
- Added indexes and foreign key constraints with `ON DELETE SET NULL`

### 🔧 API Changes

#### **Difficulty Code API Updates**

- **New Query Parameters**: All difficulty-related endpoints now accept `difficulty_code` (string) instead of `difficulty_level` (integer)
- **Exclude Unspecified**: Added `exclude_unspecified_difficulty` boolean parameter to filter endpoints to exclude records with unspecified difficulty
  - **Default**: `exclude_unspecified_difficulty` defaults to `false` (unspecified records are included by default)
  - **Rationale**: Ensures all dive sites, dives, and trips are visible by default, with users able to explicitly exclude unspecified difficulty when needed
  - **Parameter Name**: Changed from `include_unspecified_difficulty` to `exclude_unspecified_difficulty` for clarity and consistency
- **Response Format**: API responses now return both `difficulty_code` and `difficulty_label` fields
- **Stable Codes**: API uses consistent code values (`OPEN_WATER`, `ADVANCED_OPEN_WATER`, `DEEP_NITROX`, `TECHNICAL_DIVING`) instead of integers

**Updated Endpoints:**

- `/api/v1/dive-sites/` - List, count, create, update, get single
- `/api/v1/dives/` - List, count, create, update, get single, get details
- `/api/v1/admin/dives/` - All admin endpoints
- `/api/v1/newsletters/trips` - Parsed dive trip endpoints

**Breaking Changes:**

- `difficulty_level` parameter removed from all endpoints
- `difficulty_code` must be one of: `OPEN_WATER`, `ADVANCED_OPEN_WATER`, `DEEP_NITROX`, `TECHNICAL_DIVING`, or `null`
- Response format changed from integer-based `difficulty_level` to code-based `difficulty_code` and `difficulty_label`
- Sorting by `difficulty_level` now uses `order_index` from the lookup table

### 🎨 Frontend Changes

#### **Difficulty Taxonomy UI Updates**

- **Updated Forms**: All create/edit forms now use difficulty code dropdowns with "Unspecified" option
- **Filter Components**: All filter components updated to use `difficulty_code` and `exclude_unspecified_difficulty` checkbox (defaults to unchecked, meaning unspecified items are included)
- **Display Components**: All display components show human-readable `difficulty_label` or "Unspecified" for null values
- **Helper Functions**: Refactored `difficultyHelpers.js` to use code-based system instead of integer mapping

**Component Updates:**

- Create/Edit Dive Site forms
- Create/Edit Dive forms
- Unified Map Filters
- Dive Sites Filter Bar
- Responsive Filter Bar
- Sticky Filter Bar
- Dive Sites List Page
- Dives List Page
- Dive Site Detail Page
- Dive Detail Page
- Admin Dive Sites Page
- Admin Dives Page
- Dive Trips Page
- Map Components (DiveSitesMap, DivesMap, LeafletMapView)
- Independent Map View

**User Experience Improvements:**

- More descriptive difficulty labels (e.g., "Advanced Open Water" instead of "Intermediate")
- Ability to mark dive sites and dives as having unspecified difficulty
- Consistent difficulty display across all pages
- Filter option to include/exclude unspecified difficulty records

### ⚙️ Backend Changes

#### **Dives Router Refactoring - ✅ COMPLETE**

Significant architectural improvement that split the monolithic `dives.py` router into 13 focused modules for better maintainability and development workflow.

**Refactoring Details:**

- **Original File**: `backend/app/routers/dives.py` - 130KB, 3,400+ lines, 63 functions
- **New Structure**: Split into 13 focused modules with single responsibility principle
- **Completion Date**: September 27, 2025
- **Impact**: Improved code organization, reduced cognitive load, enabled parallel development

**Module Structure:**

- `dives_shared.py` - Shared imports and constants (43 lines)
- `dives_crud.py` - Core CRUD operations (1,189 lines)
- `dives_admin.py` - Admin operations (648 lines)
- `dives_media.py` - Media and tag operations
- `dives_search.py` - Search functionality
- `dives_import.py` - Subsurface XML import
- `dives_profiles.py` - Dive profile management
- `dives_utils.py` - Utility functions
- `dives_db_utils.py` - Database utilities
- `dives_validation.py` - Validation functions
- `dives_errors.py` - Error handling
- `dives_logging.py` - Logging utilities

**Technical Achievements:**

- **Zero Breaking Changes**: All existing API endpoints continue to work without changes
- **Performance Maintained**: Response times within 5% of baseline, memory usage within 10%
- **Test Coverage**: All 715+ tests continue to pass, 90%+ coverage maintained
- **Security**: No new vulnerabilities introduced, authentication/authorization preserved

**Benefits:**

- Improved maintainability through focused modules
- Better code navigation and editability
- Enabled parallel development across team members
- Clearer separation of concerns
- Easier to test individual functional areas
- Reduced merge conflicts in large file

**Files Changed:**

- Created `backend/app/routers/dives/` directory with 13 modules
- Removed original monolithic `dives.py` file
- Updated all imports across codebase
- Maintained backward compatibility for external dependencies

#### **Difficulty System Refactoring**

- **New Model**: `DifficultyLevel` SQLAlchemy model with relationships to `DiveSite`, `Dive`, and `ParsedDiveTrip`
- **Schema Updates**: All Pydantic schemas updated to use `difficulty_code` (string) and `difficulty_label` (string)
- **Helper Functions**: Added `get_difficulty_id_by_code()` and `get_difficulty_code_by_id()` for code/ID conversion
- **Deprecated Functions**: Removed `get_difficulty_label()` and `get_difficulty_value()` helper functions
- **Sorting**: All difficulty sorting now uses `order_index` from lookup table via LEFT JOIN operations

**Router Updates:**

- `dive_sites.py`: All endpoints updated with new difficulty filtering and response format
- `dives_crud.py`: All CRUD endpoints updated
- `dives_admin.py`: All admin endpoints updated
- `newsletters.py`: Parsed dive trip endpoints updated
- `dives_import.py`: Import logic updated with legacy format conversion helper
- `privacy.py`: Privacy export endpoints updated

**Test Coverage:**

- All 846 backend tests updated and passing
- Updated test fixtures to use `difficulty_id` with `DifficultyLevel` lookup
- Updated all API test calls to use `difficulty_code` parameter
- Updated all assertions to check for `difficulty_code` and `difficulty_label`

### 📚 Documentation Updates

- **API Documentation**: Updated `docs/development/api.md` with new `difficulty_code` parameters and response formats
- **Database Documentation**: Updated `docs/development/database.md` with new difficulty_levels lookup table system
- **Changelog**: Added comprehensive entry documenting the migration and all related changes

### 🎨 User Experience Improvements

#### **Navigation State Preservation - ✅ COMPLETE**

Significant improvements to navigation behavior ensure users maintain their context when navigating between list and detail pages.

**Key Features:**

- **Smart Back Navigation**: Back buttons now remember the previous page with all filters, search terms, and pagination intact
- **Fallback Mechanism**: When location state is unavailable (e.g., Ctrl+click or direct URL access), navigation falls back to base list pages instead of failing silently
- **URL Parameter Persistence**: All query parameters (filters, search, pagination) are preserved correctly in the browser URL
- **Cross-Page State**: Navigation state is passed through all detail pages (dives, dive sites, diving centers, dive trips) and map components

**Technical Implementation:**

- Replaced React Router `location` with `window.location` to capture actual browser URL state
- All `Link` components now pass `window.location.pathname + window.location.search` in state
- Back buttons check for `location.state?.from` and fallback to base list pages when unavailable
- URL synchronization enhanced to preserve `search` parameter in all update functions

**Files Modified:**

- Detail pages: `DiveSiteDetail.js`, `DiveDetail.js`, `DivingCenterDetail.js`, `TripDetail.js`
- List pages: `DiveSites.js`, `Dives.js`, `DivingCenters.js`, `DiveTrips.js`
- Map components: `DiveSitesMap.js`, `DivesMap.js`, `DivingCentersMap.js`
- Components: `TripHeader.js`

#### **Pagination Controls Enhancement - ✅ COMPLETE**

Added bottom pagination controls to all list pages for improved user experience.

**Features:**

- **Dual Pagination Controls**: Pagination controls now appear at both top and bottom of list pages
- **Consistent Layout**: Diving Centers page pagination moved below filters to match Dives and Dive Sites layout
- **Convenient Navigation**: Users can switch pages without scrolling back to the top

**Pages Updated:**

- Dives list page (`/dives`)
- Dive Sites list page (`/dive-sites`)
- Diving Centers list page (`/diving-centers`)

#### **Phone Number Validation and UX Improvements - ✅ COMPLETE**

Comprehensive phone number validation and improved link visibility for diving center pages.

**Phone Validation Features:**

- **E.164 Format Support**: Validates international phone numbers using `^\+[1-9]\d{1,14}$` pattern
- **Automatic Formatting**: Converts '00' prefix to '+' and removes whitespace automatically
- **Strict Validation**: Rejects phone numbers containing letters or special characters with clear error messages
- **User-Friendly Errors**: Error messages display the original entered value for clarity
- **Optional Field**: Empty phone numbers are allowed (field is optional)

**UI/UX Enhancements:**

- **Google Maps Directions**: Latitude/longitude coordinates now link directly to Google Maps directions from user's current location
- **Visual Link Indicators**: All clickable elements (email, phone, website, coordinates) now have consistent blue styling with hover effects
- **Icon Indicators**: Added icons (phone, external link, navigation) to clearly indicate clickable elements
- **Hover Feedback**: Smooth color transitions and underline effects on hover for better user feedback

**Files Modified:**

- `frontend/src/components/DivingCenterForm.js` - Phone validation logic
- `frontend/src/pages/DivingCenterDetail.js` - Google Maps link and link styling

#### **Search Parameter Persistence Fix - ✅ COMPLETE**

Fixed issue where search keywords were lost when URL parameters were synchronized.

**Fixes:**

- Search parameter now correctly persists in URL bar across navigation
- Added `filters.search` to URL update functions (`debouncedUpdateURL`, `immediateUpdateURL`)
- Added `filters.search` to `useEffect` dependency array to trigger URL updates
- Support for both `page_size` and `per_page` pagination parameters for backward compatibility

#### **Duplicate Warning Messages Fix - ✅ COMPLETE**

Consolidated duplicate "no results" and "did you mean" warning messages on dive sites page.

- Single warning block now renders once when no dive sites are found
- Conditional rendering based on view mode (not shown in map view)
- Cleaner, more consistent user experience

### 🗄️ Database Changes

#### **Dive Routes System - ✅ COMPLETE**

Added comprehensive database support for dive route drawing and selection.

**Migration Details:**

- **Migration Files**:
  - `0036_add_dive_routes_table_with_mixed_drawing_type.py` - Creates `dive_routes` table
  - `0037_add_route_analytics_tracking_table.py` - Creates `route_analytics` table
- **New Tables**:
  - `dive_routes`: Stores route data with multi-segment GeoJSON, route types, and soft delete support
  - `route_analytics`: Tracks user interactions (views, copies, shares) for analytics
- **Schema Changes**:
  - Added `selected_route_id` foreign key to `dives` table for route selection
  - Added indexes for performance on `dive_site_id`, `created_by`, `deleted_at`, and `route_type`

**Table Schema:**

- `dive_routes`:
  - Multi-segment GeoJSON storage in `route_data` column
  - Route type enum (scuba, walk, swim)
  - Soft delete support with `deleted_at` and `deleted_by`
  - Creator tracking and timestamps
- `route_analytics`:
  - Interaction type tracking (view, copy, share, download, export)
  - Timestamp and metadata for analytics

#### **Dive Site Address Removal - ✅ COMPLETE**

Removed address field from dive sites to simplify data model and focus on coordinates-based location.

**Migration Details:**

- **Migration File**: `0039_remove_address_from_dive_sites.py`
- **Schema Changes**: Dropped `address` column from `dive_sites` table
- **Model Updates**: Removed address from SQLAlchemy models and Pydantic schemas

**Technical Implementation:**

- Updated all API endpoints to exclude address from responses
- Removed address field from create/edit forms
- Updated backend tests to reflect address removal
- Fixed dive routes integration by removing stale address references

**Files Modified:**

- `backend/app/models.py` - Removed address field
- `backend/app/routers/dive_sites.py` - Removed address from responses
- `backend/app/schemas.py` - Removed address from schemas
- `frontend/src/pages/CreateDiveSite.js` - Removed address input
- `frontend/src/pages/EditDiveSite.js` - Removed address input

### 🔧 API Changes

#### **MySQL Spatial Search for Diving Centers - ✅ COMPLETE**

Added spatial search capabilities for finding diving centers near a specific location using MySQL POINT geometry.

**Features:**

- **Nearby Search Endpoint**: `/api/v1/diving-centers/nearby` - Find centers within radius of coordinates
- **Spatial Data Type**: Diving centers now use MySQL POINT type for precise location storage
- **Async Typeahead UI**: Frontend typeahead search with debouncing for smooth user experience
- **MySQL-Only Route**: `/api/v1/diving-centers/search` route is MySQL-only for spatial queries

**Technical Implementation:**

- Added `POINT` geometry column to `diving_centers` table
- Implemented spatial queries using `ST_Distance_Sphere` for accurate distance calculations
- Frontend integration with async search and debouncing
- Enhanced map components with nearby search capabilities

### 🐛 Bug Fixes

#### **Login Failure Feedback - ✅ COMPLETE**

Improved error feedback for failed login attempts.

**Changes:**

- Clear error messages displayed when login credentials are incorrect
- Better user feedback for authentication failures
- Improved error handling in login flow

#### **User Registration Enhancement - ✅ COMPLETE**

Users are now enabled by default on registration.

**Changes:**

- New user accounts are automatically enabled upon registration
- Eliminates need for manual admin approval for new users
- Streamlines user onboarding process

#### **HTTPS Protocol and Search Redirect Fixes - ✅ COMPLETE**

Fixed critical issues with API protocol handling and search endpoint redirects.

**Changes:**

- **Relative URL Support**: Changed API baseURL to empty string for relative URLs, ensuring API calls automatically use the same protocol as the page
- **HTTPS in Production**: Fixed issue where static builds were making HTTP requests in production instead of HTTPS
- **Search Endpoint Fix**: Updated search endpoint URL to include trailing slash to match FastAPI route definition, eliminating 307 redirect
- **Development Override**: Maintained baseURL override only for localhost development

**Files Modified:**

- `frontend/src/api.js` - Changed baseURL to relative URLs with localhost override
- Removed redundant HTTPS safety interceptor

## [Previous Release] - September 27, 2025

### 🚀 Major Features

#### **Comprehensive Dive Profile Visualization System - ✅ COMPLETE**

- **Interactive Dive Charts**: Professional-grade dive profile visualization with
  Recharts integration
- **Advanced Data Visualization**: Depth vs time, temperature profiles, NDL/CNS
  indicators, and gas change markers
- **Mobile Touch Support**: Pan and zoom functionality optimized for mobile devices
- **Chart Export Capabilities**: PNG and PDF export using html2canvas/jsPDF
- **Smart Performance Optimization**: Intelligent sampling for 1000+ data points
- **Accessibility Features**: High contrast mode and ARIA compliance

**Technical Implementation:**

- **Backend**: R2StorageService with Cloudflare R2 integration and local fallback
- **Database**: New dive profile metadata columns with comprehensive schema updates
- **API Integration**: Complete CRUD operations for dive profile management
- **Frontend**: AdvancedDiveProfileChart component with mobile-first design
- **Storage**: User-specific storage paths with automatic fallback mechanisms
- **Admin Monitoring**: Real-time R2 storage health monitoring in admin dashboard

**User Experience Features:**

- Interactive dive analysis with professional-grade visualization tools
- Mobile-optimized touch interactions for chart exploration
- Export functionality for sharing dive profiles
- Tabbed navigation in dive detail pages with URL parameter support
- Real-time data fetching with React Query integration
- Comprehensive error handling and loading states

**Files Added/Modified:**

- `backend/app/services/dive_profile_parser.py` - Subsurface XML parsing
- `backend/app/services/r2_storage_service.py` - Cloud storage integration
- `frontend/src/components/AdvancedDiveProfileChart.js` - Interactive charts
- `frontend/src/components/DiveProfileUpload.js` - Profile upload interface
- `frontend/src/utils/diveProfileHelpers.js` - Data processing utilities
- `backend/migrations/versions/0032_add_dive_profile_metadata.py` - Schema updates

#### **OpenLayers to Leaflet Migration - ✅ COMPLETE**

- **Complete Map System Overhaul**: Migrated entire mapping infrastructure from
  OpenLayers to Leaflet
- **Enhanced Performance**: Improved map rendering and reduced bundle size
- **Mobile-First Design**: Responsive map components optimized for all devices
- **Custom Icon System**: SVG-based markers for dive sites, diving centers, and dives
- **Dynamic Clustering**: Intelligent marker clustering with zoom-based enabling
- **Professional UI**: Enhanced zoom level display and clustering status indicators

**Migration Details:**

- **Components Migrated**: MiniMap, DiveSiteMap, DiveSitesMap, DivingCentersMap, DivesMap
- **Features Implemented**: Custom SVG icons, dynamic clustering, popup functionality
- **Cleanup Completed**: Removed all OpenLayers dependencies and unused components
- **Code Quality**: Fixed ESLint errors and improved maintainability
- **Documentation**: Updated all references from OpenLayers to Leaflet

**Technical Achievements:**

- **Bundle Size Reduction**: Eliminated OpenLayers package (significant size reduction)
- **Performance Optimization**: Faster map rendering and smoother interactions
- **Cross-Browser Compatibility**: Improved support across all modern browsers
- **Mobile Optimization**: Touch-friendly interactions and responsive design
- **Code Maintainability**: Cleaner, more maintainable codebase with better structure

#### **Enhanced Mobile User Experience - ✅ COMPLETE**

- **Mobile Landscape Optimization**: Fixed modal scrolling issues in mobile landscape mode
- **Additive Quick Filters**: Multiple simultaneous tag filters (Wreck AND Reef)
- **Stopdepth Ceiling Visualization**: Decompression stop visualization with area graphs
- **Comprehensive Help System**: Enhanced help page with visual improvements
- **Page Title Implementation**: Dynamic page titles across all pages for better UX

**Mobile Improvements:**

- **Modal Optimization**: Ultra-compact header design for mobile landscape (655x305 viewport)
- **Space Utilization**: 15% more chart space through optimized padding and margins
- **Touch Interactions**: Enhanced mobile touch support for chart interactions
- **Responsive Design**: Better mobile experience across all screen sizes
- **User Guidance**: Mobile landscape suggestions for better chart viewing

**Filter Enhancements:**

- **Additive Filtering**: Users can select multiple quick filters simultaneously
- **AND Logic**: Multiple tag filters now apply AND logic instead of replacing selections
- **UI Consistency**: Maintained mutually exclusive behavior for difficulty filters
- **Mobile Support**: Enhanced mobile filter interface with better usability

### 🔧 API Changes

#### **Dive Profile API Integration**

- **Profile Management**: Complete CRUD operations for dive profile data
- **Storage Integration**: Cloud storage with automatic local fallback
- **Data Processing**: Subsurface XML parsing and profile extraction
- **Admin Monitoring**: Real-time storage health monitoring
- **Public Access**: Public dive profile access for shared dives

#### **Enhanced Search and Filtering**

- **Fuzzy Search**: Comprehensive fuzzy search functionality across dive pages
- **Additive Filters**: Multiple simultaneous tag filters with AND logic
- **Mobile Optimization**: Mobile-optimized API responses and filtering
- **Performance**: Improved search performance and response times

### 🐛 Bug Fixes

#### **Recent Bug Fixes and Improvements**

- **Mobile Modal Scrolling**: Fixed modal scrolling issues in mobile landscape mode (655x305 viewport)
- **Dive Information Display**: Resolved dive-information and My Dives display issues for logged-in users
- **Google Login Authentication**: Fixed Google OAuth authentication errors and token handling
- **Import Date Handling**: Fixed confirm import date handling and name generation in dive import process
- **Public Dive Access**: Enabled public access to public dive profiles for better user experience
- **Map View Architecture**: Implemented independent map view architecture with improved performance
- **Fuzzy Search Integration**: Added comprehensive fuzzy search tests and unified search functionality

### 🎨 Frontend Changes

#### **Recent Frontend Enhancements**

- **Dive Profile Visualization**: Complete interactive dive profile charts with mobile touch support
- **Map System Migration**: Complete OpenLayers to Leaflet migration with enhanced performance
- **Mobile Landscape Optimization**: Ultra-compact modal design for mobile landscape viewing
- **Additive Quick Filters**: Multiple simultaneous tag filters with AND logic
- **Stopdepth Ceiling Visualization**: Decompression stop visualization with area graphs
- **Page Title Implementation**: Dynamic page titles across all pages for better UX
- **Help System Enhancement**: Comprehensive help page with visual improvements
- **Fuzzy Search Integration**: Unified fuzzy search functionality across dive pages

### 🔒 Security Enhancements

#### **Data Protection and Storage Security**

- **Secure Storage**: R2 storage integration with local fallback for data protection
- **User Data Protection**: Enhanced user data protection and privacy controls
- **Public Profile Controls**: Secure public profile access with proper authorization
- **Mobile Security**: Mobile-specific security optimizations and protections

### 🐛 Bug Fixes (September 2025)

#### **September 2025 Bug Fixes and Improvements**

- **Mobile Modal Scrolling**: Fixed modal scrolling issues in mobile landscape mode (655x305 viewport)
- **Dive Information Display**: Resolved dive-information and My Dives display issues for logged-in users
- **Google Login Authentication**: Fixed Google OAuth authentication errors and token handling
- **Import Date Handling**: Fixed confirm import date handling and name generation in dive import process
- **Public Dive Access**: Enabled public access to public dive profiles for better user experience
- **Map View Architecture**: Implemented independent map view architecture with improved performance
- **Fuzzy Search Integration**: Added comprehensive fuzzy search tests and unified search functionality

### 🚀 Infrastructure Changes

#### **Map System and Performance Improvements**

- **Complete Map Migration**: Full migration from OpenLayers to Leaflet for better performance
- **Mobile-First Design**: Responsive design implementation across all components
- **Bundle Optimization**: Significant bundle size reduction and performance improvements
- **Cross-Browser Support**: Enhanced compatibility across all modern browsers
- **Touch Optimization**: Mobile touch interactions and responsive design

---

## [Previous Release] - August 24, 2025

### 🚀 Major Features (August 2025)

#### **Cloudflare Turnstile Integration - ✅ COMPLETE**

- **Bot Protection**: Comprehensive Cloudflare Turnstile integration for
  authentication endpoints
- **Conditional Enabling**: Smart configuration detection -
  Turnstile only active when both environment variables are set
- **Privacy-First**: Privacy-focused CAPTCHA alternative that doesn't track user
  behavior
- **Comprehensive Testing**: 23 tests with 87% success rate covering all
  functionality
- **Production Monitoring**: Real-time verification tracking and performance
  metrics

**Technical Implementation:**

- **Backend**: TurnstileService with lazy initialization and comprehensive error
  handling
- **Database**: Migration 0030 adds turnstile_token and turnstile_verified_at
  fields to users table
- **Frontend**: Conditional Turnstile widget rendering based on environment
  configuration
- **Authentication**: Login and register endpoints with conditional Turnstile
  verification
- **Monitoring**: Real-time event tracking, success rate analysis, and
  performance metrics
- **Deployment**: Production-ready deployment scripts with environment
  validation

**Security Features:**

- Server-side token verification with Cloudflare API
- Comprehensive error handling and timeout management
- IP address tracking for security monitoring
- Rate limiting integration for authentication endpoints
- Audit logging for all verification attempts

**User Experience Benefits:**

- Seamless authentication when Turnstile is disabled
- Enhanced bot protection when Turnstile is enabled
- Privacy-focused approach with no user tracking
- Responsive design with proper error handling
- Conditional rendering based on configuration

**Files Added/Modified:**

- `backend/app/turnstile_service.py` - Core Turnstile verification service
- `backend/app/monitoring/turnstile_monitor.py` -
  Real-time monitoring and analytics
- `backend/migrations/versions/0030_add_turnstile_support.py` -
  Database schema update
- `backend/tests/test_turnstile_service.py` - Comprehensive service testing
- `backend/tests/test_auth_turnstile.py` - Authentication integration testing
- `backend/app/monitoring/` - Real-time monitoring and analytics system
- `frontend/src/components/Turnstile.js` - React Turnstile widget component
- `frontend/src/utils/turnstileConfig.js` - Frontend configuration utilities
- `frontend/deploy.sh` - Updated deployment script with Turnstile support
- `frontend/Dockerfile` - Build argument support for Turnstile configuration

**Implementation Details:**

- **Conditional Enabling**: Turnstile only activates when both
  `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` are set and non-empty
- **Lazy Initialization**: Backend service initializes only when needed,
  preventing configuration errors
- **Comprehensive Error Handling**: Covers HTTP errors, timeouts, verification
  failures, and general exceptions
- **Real-time Monitoring**: Tracks success rates, response times, error
  patterns, and IP addresses
- **Production Deployment**: Automated deployment script with environment
  validation and testing
- **Database Integration**: Seamless schema updates with proper migration
  management
- **Frontend Responsiveness**: Conditional rendering ensures smooth user
  experience regardless of configuration

**Testing & Quality Assurance:**

- **Unit Tests**: 13/13 Turnstile service tests passing with comprehensive
  coverage
- **Integration Tests**: 7/10 authentication integration tests passing (87%
  success rate)
- **Test Coverage**: All critical paths tested including success, failure, and
  error scenarios
- **Mock Testing**: Comprehensive mocking of external dependencies and async
  operations
- **Error Scenarios**: Thorough testing of timeout, HTTP error, and verification
  failure cases

**Monitoring & Analytics:**

- **Real-time Tracking**: Live monitoring of verification events and performance
  metrics
- **Success Rate Analysis**: Configurable time windows for trend analysis and
  alerting
- **Performance Metrics**: Response time tracking and performance degradation
  detection
- **Security Monitoring**: IP address tracking and suspicious activity detection
- **Operational Insights**: Comprehensive statistics for operational decision
  making

#### **Comprehensive Dive Profile Visualization System - ✅ COMPLETE**

- **Interactive Dive Charts**: Professional-grade dive profile visualization with
  Recharts integration
- **Advanced Data Visualization**: Depth vs time, temperature profiles, NDL/CNS
  indicators, and gas change markers
- **Mobile Touch Support**: Pan and zoom functionality optimized for mobile devices
- **Chart Export Capabilities**: PNG and PDF export using html2canvas/jsPDF
- **Smart Performance Optimization**: Intelligent sampling for 1000+ data points
- **Accessibility Features**: High contrast mode and ARIA compliance

**Technical Implementation:**

- **Backend**: R2StorageService with Cloudflare R2 integration and local fallback
- **Database**: New dive profile metadata columns with comprehensive schema updates
- **API Integration**: Complete CRUD operations for dive profile management
- **Frontend**: AdvancedDiveProfileChart component with mobile-first design
- **Storage**: User-specific storage paths with automatic fallback mechanisms
- **Admin Monitoring**: Real-time R2 storage health monitoring in admin dashboard

**User Experience Features:**

- Interactive dive analysis with professional-grade visualization tools
- Mobile-optimized touch interactions for chart exploration
- Export functionality for sharing dive profiles
- Tabbed navigation in dive detail pages with URL parameter support
- Real-time data fetching with React Query integration
- Comprehensive error handling and loading states

**Files Added/Modified:**

- `backend/app/services/dive_profile_parser.py` - Subsurface XML parsing
- `backend/app/services/r2_storage_service.py` - Cloud storage integration
- `frontend/src/components/AdvancedDiveProfileChart.js` - Interactive charts
- `frontend/src/components/DiveProfileUpload.js` - Profile upload interface
- `frontend/src/utils/diveProfileHelpers.js` - Data processing utilities
- `backend/migrations/versions/0032_add_dive_profile_metadata.py` - Schema updates

#### **OpenLayers to Leaflet Migration - ✅ COMPLETE**

- **Complete Map System Overhaul**: Migrated entire mapping infrastructure from
  OpenLayers to Leaflet
- **Enhanced Performance**: Improved map rendering and reduced bundle size
- **Mobile-First Design**: Responsive map components optimized for all devices
- **Custom Icon System**: SVG-based markers for dive sites, diving centers, and dives
- **Dynamic Clustering**: Intelligent marker clustering with zoom-based enabling
- **Professional UI**: Enhanced zoom level display and clustering status indicators

**Migration Details:**

- **Components Migrated**: MiniMap, DiveSiteMap, DiveSitesMap, DivingCentersMap, DivesMap
- **Features Implemented**: Custom SVG icons, dynamic clustering, popup functionality
- **Cleanup Completed**: Removed all OpenLayers dependencies and unused components
- **Code Quality**: Fixed ESLint errors and improved maintainability
- **Documentation**: Updated all references from OpenLayers to Leaflet

**Technical Achievements:**

- **Bundle Size Reduction**: Eliminated OpenLayers package (significant size reduction)
- **Performance Optimization**: Faster map rendering and smoother interactions
- **Cross-Browser Compatibility**: Improved support across all modern browsers
- **Mobile Optimization**: Touch-friendly interactions and responsive design
- **Code Maintainability**: Cleaner, more maintainable codebase with better structure

#### **Enhanced Mobile User Experience - ✅ COMPLETE**

- **Mobile Landscape Optimization**: Fixed modal scrolling issues in mobile landscape mode
- **Additive Quick Filters**: Multiple simultaneous tag filters (Wreck AND Reef)
- **Stopdepth Ceiling Visualization**: Decompression stop visualization with area graphs
- **Comprehensive Help System**: Enhanced help page with visual improvements
- **Page Title Implementation**: Dynamic page titles across all pages for better UX

**Mobile Improvements:**

- **Modal Optimization**: Ultra-compact header design for mobile landscape (655x305 viewport)
- **Space Utilization**: 15% more chart space through optimized padding and margins
- **Touch Interactions**: Enhanced mobile touch support for chart interactions
- **Responsive Design**: Better mobile experience across all screen sizes
- **User Guidance**: Mobile landscape suggestions for better chart viewing

**Filter Enhancements:**

- **Additive Filtering**: Users can select multiple quick filters simultaneously
- **AND Logic**: Multiple tag filters now apply AND logic instead of replacing selections
- **UI Consistency**: Maintained mutually exclusive behavior for difficulty filters
- **Mobile Support**: Enhanced mobile filter interface with better usability

#### **Nginx Reverse Proxy Architecture with Refresh Token Authentication**

- **Complete Authentication System**: Implemented comprehensive refresh token
  system with automatic token renewal
- **Token Rotation & Security**: Added token rotation, revocation capabilities,
  and audit logging
- **Nginx Reverse Proxy**: Unified frontend/backend architecture solving
  cross-origin cookie issues
- **Production Deployment**: Complete Fly.io production configuration with SSL
  termination and security headers
- **Session Management**: 15-minute access tokens with 30-day refresh tokens for
  seamless user experience

**Technical Implementation:**

- **Backend**: TokenService class, refresh token endpoints, database models for
  RefreshToken and AuthAuditLog
- **Frontend**: AuthContext with refresh token support, API interceptor for
  automatic renewal, SessionManager component
- **Infrastructure**: Nginx proxy configuration, Docker containers, Fly.io
  deployment setup
- **Security**: SameSite=strict cookies, HTTP-only storage, comprehensive rate
  limiting

**User Experience Benefits:**

- Users stay logged in for extended periods without manual re-authentication
- Seamless cross-origin authentication through unified proxy architecture
- Enhanced security with token rotation and audit logging
- Professional-grade production deployment with enterprise security features

#### **Enhanced Newsletter Parsing System**

- **Greek Date Support**: Added comprehensive Greek date parsing (e.g., 'Σάββατο
  23 Αυγούστου')
- **Double Dive Handling**: Support for 'Διπλή βουτιά' (double dive) scenarios
  with same or different locations
- **Improved AI Prompts**: Enhanced OpenAI prompts with Greek language rules and
  concrete examples
- **Newsletter ID Display**: Added source newsletter tracking in admin interface
  for better data traceability
- **Content Detection**: Improved handling of both quoted-printable and plain
  text newsletter content

**Backend Enhancements:**

- Enhanced logging configuration respecting LOG_LEVEL environment variable
- Improved OpenAI prompt engineering for better date extraction accuracy
- Newsletter ID integration in trip responses for complete data lineage
- Comprehensive error handling and validation for newsletter parsing

#### **Diving Center Reverse Geocoding System**

- **Location Automation**: Comprehensive reverse geocoding for diving centers
  using OpenStreetMap Nominatim API
- **Smart Location Cleaning**: Automatic removal of municipal and regional
  suffixes for cleaner location data
- **Batch Processing**: New utility script for updating multiple diving center
  locations efficiently
- **Rate Limiting**: Proper API rate limiting (75/minute for admins) with
  fallback handling
- **Error Recovery**: Graceful degradation when external geocoding services are
  unavailable

**New Features:**

- `/api/v1/diving-centers/reverse-geocode` endpoint for location data retrieval
- Automatic removal of 'Municipal Unit of', 'Municipality of', 'Regional Unit
  of' prefixes
- Comprehensive debug logging for troubleshooting and monitoring
- Support for both individual and batch location updates

#### **Comprehensive Hero Section and Logo Integration**

- **Visual Identity**: New navbar background with sea artifacts and
  marine-themed design elements
- **Favicon System**: Complete favicon package including Android, Apple, and
  standard web formats
- **Logo Integration**: Professional logo placement and branding throughout the
  application
- **Responsive Design**: Optimized visual elements for all device sizes and
  orientations

**Design Elements Added:**

- Sea artifacts including coral, fish, shells, and bubble designs
- Comprehensive favicon package with multiple sizes and formats
- Professional logo integration in navbar and key UI components
- Enhanced visual hierarchy and user experience

### 🔧 API Changes (August 2025)

#### **Rate Limiting Enhancements**

- **Increased Limits**: All rate limits increased by 1.5x multiplier for better
  user experience
- **Authentication**: Registration 5→8/min, Login 20→30/min, Google OAuth
  20→30/min
- **Content Operations**: Search 100→150/min, Details 200→300/min, Creation
  10→15/min
- **Proxy Security**: Configurable proxy chain security with
  SUSPICIOUS_PROXY_CHAIN_LENGTH environment variable
- **Production Optimization**: Production environment configured for
  Cloudflare + Fly.io + nginx architecture

**Configuration Updates:**

- New environment variables for proxy chain security configuration
- Production vs development rate limiting strategies
- Enhanced security logging for suspicious IP detection
- IPv6 support for Fly.io private address ranges

#### **Dive Sites API Improvements**

- **Tag Filtering Refactoring**: Eliminated code duplication and improved
  maintainability
- **Search Optimization**: Enhanced fuzzy search with consistent filter
  application
- **Pagination Fixes**: Fixed count vs results mismatch in tag-filtered searches
- **Performance**: Removed redundant API calls and improved response efficiency

**Technical Improvements:**

- Extracted reusable filtering functions (apply_tag_filtering,
  apply_search_filters, etc.)
- Reduced file size from 2233 to 2047 lines (186 lines removed)
- Fixed import issues for DiveSiteTag model in utility functions
- Consistent subquery approach for tag filtering across all endpoints

#### **Diving Centers API Enhancements**

- **Owner Authorization**: Comprehensive authorization system for diving center
  owners
- **Gear Rental Management**: Owners can now manage gear rental items for their
  centers
- **Organization Management**: Extended permissions for diving center
  organization relationships
- **Dive Site Relationships**: Enhanced management of dive site associations

**Authorization Rules:**

- Admins and moderators can manage any diving center
- Approved diving center owners can manage their own centers
- Regular users are properly blocked from unauthorized access
- Comprehensive testing coverage for all authorization scenarios

### 🐛 Bug Fixes (August 2025)

#### **Frontend Linting and Code Quality**

- **ESLint Errors**: Fixed all frontend linting errors and import order issues
- **Component Cleanup**: Removed unused JavaScript component files for cleaner
  codebase
- **Import Optimization**: Fixed import order and removed unused imports
  throughout frontend
- **Code Consistency**: Improved overall code quality and maintainability

## [Previous Release] - 2025-08-17

### 🚀 Major Features 2

#### **Node.js 20 Upgrade & Frontend Improvements - ✅ COMPLETE**

- **Performance Upgrade**: Successfully upgraded from Node.js 18 to Node.js 20
- **Docker Image Updates**: Both production and development containers now use
  `node:20-alpine`
- **Package Modernization**: Upgraded high and medium priority npm packages for
  better compatibility
- **ESLint 9 Migration**: Converted from legacy `.eslintrc.js` to modern
  `eslint.config.js` format
- **PropTypes Validation**: Fixed type mismatches between backend and frontend
  data structures
- **Map View Functionality**: Resolved critical bug preventing dive sites map
  view from working

**Technical Improvements:**

- **V8 Engine**: Node.js 20 uses V8 11.0+ with 15-20% performance improvement
- **Memory Management**: Better memory usage and reduced container footprint
- **Build Performance**: Faster npm install and build times
- **Security**: Extended LTS support until April 2026
- **Modern Features**: Latest ES2022+ language features and APIs

**Package Upgrades Completed:**

- **High Priority**: ESLint 9.33.0, eslint-config-prettier 10.1.8,
  eslint-plugin-react-hooks 5.2.0
- **Medium Priority**: React Router 7.8.1, react-hot-toast 2.6.0, lucide-react
  0.539.0, OpenLayers 10.6.1
- **Compatibility**: All packages tested and working with Node.js 20

**Critical Bug Fixes:**

- **Map View Bug**: Fixed circular dependency in useEffect causing map view to
  fail
- **PropTypes Errors**: Corrected type validation for all map components
- **ESLint Compatibility**: Updated configuration for ESLint 9 and Node.js 20
- **Test File Syntax**: Fixed missing parentheses in test files

**Files Modified:**

- `frontend/Dockerfile`: Updated to Node.js 20-alpine
- `frontend/Dockerfile.dev`: Updated to Node.js 20-alpine
- `frontend/package.json`: Upgraded package versions
- `frontend/eslint.config.js`: New ESLint 9 configuration
- `frontend/src/components/DiveSitesMap.js`: Fixed PropTypes validation
- `frontend/src/components/DivingCentersMap.js`: Fixed PropTypes validation
- `frontend/src/components/DiveMap.js`: Fixed PropTypes validation
- `frontend/src/pages/DiveSites.js`: Fixed view mode switching logic
- `frontend/tests/*.js`: Fixed syntax errors

**Testing Results:**

- ✅ **Build Success**: All Docker images build successfully with Node.js 20
- ✅ **Runtime Test**: Application runs correctly in new containers
- ✅ **Map View**: Dive sites map view now works correctly
- ✅ **ESLint**: All code validation passes with new configuration
- ✅ **PropTypes**: No more console warnings about type mismatches

---

## [Previous Release] - 2025-08-09

### 🚀 Major Features 3

#### **Phase 2: Map Integration and Visualization - ✅ COMPLETE**

- **TripMap Component**: Full-featured interactive map component for dive trips
  with OpenLayers integration
- **Interactive Trip Markers**: Custom SVG icons with status-based coloring
  (scheduled=blue, confirmed=green, cancelled=red, completed=gray)
- **Trip Clustering**: Automatic grouping of nearby trips for better
  visualization and performance
- **Coordinate Handling**: Intelligent fallback from dive site to diving center
  coordinates
- **Interactive Popups**: Rich popups showing trip details with clickable
  navigation links

**Map View Integration:**

- Seamless toggle between list and map views in DiveTrips page
- Map-specific controls with clustering toggle and user guidance
- Filter synchronization - all existing filters work seamlessly with map view
- Mobile optimization with responsive, touch-friendly design
- Performance optimization with efficient vector layer management

**Technical Implementation:**

- **OpenLayers Integration**: Professional-grade mapping library with custom
  trip icons
- **Vector Layer Management**: Efficient trip data rendering and real-time
  updates
- **State Management**: Synchronized view modes and filter states
- **Error Handling**: Graceful degradation for missing coordinate data
- **URL Parameter Support**: Direct navigation to map view with persistent state

**User Experience Features:**

- Interactive trip discovery through geographic exploration
- Visual trip status representation with intuitive color coding
- Seamless navigation from map markers to trip detail pages
- Status toggle controls for filtering trips by status on the map
- Responsive design optimized for desktop, tablet, and mobile devices

**Files Added:**

- `frontend/src/components/TripMap.js` - Complete map component
- `docs/development/phase-2-map-integration-summary.md` -
  Implementation documentation

**Files Modified:**

- `frontend/src/pages/DiveTrips.js` - Map integration and view toggle
- `docs/development/newsletter-parsing-implementation-plan.md` -
  Phase 2 completion status

#### **Frontend Rate Limiting Error Handling**

#### **Frontend Rate Limiting Error Handling 2**

- **Comprehensive Error Handling**: Implemented graceful handling of 429 rate
  limiting responses
- **User-Friendly Error Display**: RateLimitError component with countdown timer
  and retry functionality
- **API Interceptor Enhancement**: Automatic detection and handling of rate
  limiting responses
- **Toast Notifications**: Immediate feedback for users when rate limits are
  exceeded
- **Consistent User Experience**: Same error handling across all components
  (DiveSites, DiveTrips)
- **Retry Functionality**: Automatic retry button appears after countdown timer
  expires
- **Visual Indicators**: Warning icons, clock icons, and clear messaging for
  better UX

**Technical Implementation:**

- **API Interceptor**: `frontend/src/api.js` -
  Response interceptor for 429 handling
- **Error Component**: `frontend/src/components/RateLimitError.js` -
  Visual error display
- **Utility Function**: `frontend/src/utils/rateLimitHandler.js` -
  Centralized error handling
- **Component Integration**: Full integration in DiveSites.js and DiveTrips.js
  components

**User Experience Features:**

- Immediate toast notification when rate limiting occurs
- Clear explanation of what happened and when to retry
- Countdown timer showing remaining wait time
- Retry button that appears after timeout
- Consistent error handling across all API calls
- Responsive design with Tailwind CSS styling

#### **Admin Dashboard Enhancement**

- **General Statistics & System Metrics**: Comprehensive platform statistics and health
  monitoring
  - Platform statistics (users, content, engagement, geographic distribution)
  - System health monitoring (database, application, resources, external
services)
  - Real-time alerts and status indicators
  - Auto-refresh functionality with configurable intervals
- **Recent Activity Monitoring**: Real-time tracking of user actions and system
  changes
  - User activity tracking (registrations, content creation, engagement)
  - Time-based filtering (hour, 6 hours, day, week, month)
  - Activity type filtering (registrations, content creation, engagement)
  - Real-time statistics and activity list with auto-refresh
  - Responsive design with accessibility support

#### **Backend System Monitoring**

- **System Router**: New `/api/v1/admin/system/` endpoints for monitoring
  - `/overview` - Comprehensive system overview with platform statistics
  - `/health` - Detailed system health information
  - `/stats` - Platform statistics breakdown
  - `/activity` - Recent user and system activity
- **System Resource Monitoring**: CPU, memory, and disk usage tracking
- **Database Health Checks**: Connection status and response time monitoring
- **Activity Tracking**: Comprehensive logging of user actions and system
  changes

#### **Frontend Admin Interface**

- **Admin Dashboard Integration**: Clickable cards for General Statistics, System Metrics, and
  Recent Activity
- **Navigation Updates**: Added admin menu links for new monitoring pages
- **Real-time Updates**: Auto-refresh functionality with manual refresh options
- **Responsive Design**: Mobile-friendly interface with proper accessibility

### 🔧 API Enhancements

#### **Newsletter Content Enhancement**

- **newsletter_content Field**: Added `newsletter_content` field to
  `ParsedDiveTripResponse` schema
- **API Response Enhancement**: Trip details now include source newsletter
  content for better context
- **Backend Implementation**: Updated `get_parsed_trip` endpoint to fetch and
  include newsletter content
- **Database Integration**: Uses existing `source_newsletter_id` relationship
  for efficient data retrieval

**Technical Details:**

- **Schema Update**: `app/schemas.py` -
  Added `newsletter_content: Optional[str] = None`
- **API Update**: `app/routers/newsletters.py` -
  Enhanced trip response with newsletter content
- **Performance**: Direct database query using `source_newsletter_id` without
  additional relationships

#### **Database Schema Improvements**

- **Migration 0027**: Made `trip_difficulty_level` nullable in
  `parsed_dive_trips` table
- **Flexibility**: Allows newsletter parsing to handle cases where difficulty
  level cannot be determined
- **Data Integrity**: Maintains existing constraints while providing flexibility
  for incomplete data
- **Testing**: Migration tested on isolated MySQL container before production
  deployment

**Migration Details:**

- **File**:
  `backend/migrations/versions/0027_fix_trip_difficulty_level_nullable.py`
- **Purpose**: Fix `IntegrityError` when inserting trips with NULL difficulty
  levels
- **Safety**: Reversible migration with proper upgrade/downgrade procedures

#### **Dive Filtering Improvements**

- **my_dives Parameter**: Added `my_dives=true` parameter to dives endpoint for
  filtering user's own dives
- **Authentication Required**: `my_dives` parameter requires authentication and
  returns 401 for unauthenticated requests
- **User-Specific Filtering**: Returns only current user's dives (both private
  and public)
- **Empty Results**: Returns empty array for users with no dives
- **Count Endpoint Support**: Added `my_dives` parameter to
  `/api/v1/dives/count` endpoint

#### **Dive Site Creation for Regular Users**

- **User Dive Site Creation**: Regular users can now create dive sites
  (previously admin/moderator only)
- **Ownership Tracking**: Added `created_by` field to dive sites table to track
  ownership
- **My Dive Sites Filter**: Added `my_dive_sites=true` parameter to filter dive
  sites created by current user
- **UI Improvements**: Enhanced dive site creation interface with better layout
  and user feedback

### 🚀 Major Features 4

#### **Subsurface XML Import System**

- **Frontend Import Modal**: Complete UI for uploading and reviewing Subsurface
  XML files
- **Backend API Endpoints**: Comprehensive API for XML parsing and dive
  confirmation
- **Dive Site Matching**: Enhanced matching with similarity detection and user
  selection
- **Privacy Controls**: Users can set privacy settings for imported dives
- **Skip Functionality**: Individual dive skip options during import process
- **Visual Indicators**: Privacy indicators on dive detail pages

#### **Moderator Permission Enhancements**

- **Ownership Management**: Moderators can now approve diving center ownership
  requests
- **Diving Organizations**: Full CRUD permissions for diving organizations
- **Newsletter Management**: Complete newsletter and dive trip management
  capabilities
- **User Listing**: Moderators can view all users in the system
- **Comprehensive Testing**: 136 new tests covering all moderator permissions

### 🐛 Bug Fixes 2

#### **Dive Name Regeneration**

- **Empty Name Handling**: Fixed dive name regeneration when users delete dive
  names
- **Automatic Naming**: System now properly regenerates names based on dive site
  and date
- **Frontend Integration**: Fixed data processing to preserve empty strings for
  backend regeneration

#### **Map View Improvements**

- **Automatic Fitting**: Map now automatically fits to show all dive sites
  matching search filters
- **Dynamic Zoom**: Removed fixed zoom level, map adapts to current dive sites
  data

## [Previous Release] - 2025-08-02

### 🔧 Import Script Enhancements

#### **Enhanced Dive Site Import System**

- **Smart Conflict Resolution**: Enhanced import script prefers updating
  existing sites over creating new ones
- **Similarity Matching**: Uses multiple algorithms to detect similar dive site
  names (80% threshold)
- **Proximity Checking**: Prevents duplicates within 200m radius
- **Selective Updates**: Preserves existing data not present in import files
- **Batch Processing**: Multiple modes for different import scenarios
  (interactive, skip-all, update-all, create-merge-all)
- **Merge File System**: Manual review capability for complex updates

**Import Script Features:**

- **Smart Matching**: Sequence matcher, word-based similarity, and substring
  matching
- **Interactive Mode**: User confirmation for each conflict
- **Force Mode**: Skip all confirmations for batch processing
- **Dry Run Mode**: Preview changes without making them
- **Merge Files**: Generate files for manual review and editing

**Update Behavior:**

- **Always Updated**: name, description, latitude, longitude
- **Preserved**: address, access_instructions, difficulty_level, marine_life,
  safety_information, aliases, country, region
- **Selective**: Only changes fields present in import data

**Usage Examples:**

```bash
# Update all existing sites with conflicts
python utils/import_subsurface_divesite.py -f --update-all

# Create merge files for manual review
python utils/import_subsurface_divesite.py --create-merge-all

# Import only completely new sites
python utils/import_subsurface_divesite.py -f --skip-all
```

### 🔒 Security Enhancements 2

#### **Enhanced Rate Limiting System**

- **Custom Rate Limiting Decorator**: Implemented `@skip_rate_limit_for_admin()`
  with intelligent exemption logic
- **Localhost Exemptions**: Requests from localhost IPs (127.0.0.1, ::1,
  localhost) are exempt from rate limiting for development and testing
- **Admin User Exemptions**: Users with `is_admin=True` are exempt from rate
  limiting on authenticated endpoints
- **Comprehensive Coverage**: Updated 19 endpoints across auth and dive sites
  routers
- **Robust Error Handling**: Fallback to normal rate limiting on errors

**Rate Limiting Implementation:**

- Custom key function for localhost detection
- JWT token extraction and verification for admin user detection
- Database queries to verify admin privileges
- Protection against API abuse while maintaining administrative functionality

**Updated Endpoints:**

- **Auth Router**: 3 endpoints updated (register, login, google-login)
- **Dive Sites Router**: 16 endpoints updated with custom rate limiting
- **Rate Limits**: Comprehensive limits from 5/minute to 200/minute based on
  endpoint type

**Testing Coverage:**

- 10 new rate limiting tests (all passing)
- Real-world integration tests with Docker containers
- 237/238 existing tests passing (1 expected failure due to rate limiting)

### 🚀 Major Features 5

#### **Dive-Diving Center Integration**

- **Dive-Diving Center Association**: Dives can now be associated with diving
  centers that organized or facilitated the dive
- **Optional Relationship**: The diving center relationship is optional and can
  be added, changed, or removed
- **Complete Information**: API responses include both diving center ID and full
  diving center details
- **Admin Support**: Admin endpoints support diving center management for all
  dives
- **Comprehensive Testing**: Added 12 new tests covering all dive-diving center
  functionality

**New API Features:**

- `diving_center_id` field in dive creation and updates
- `diving_center` object in dive responses with full details
- Admin endpoints support diving center management
- Validation for diving center existence

**Database Changes:**

- Added `diving_center_id` foreign key to `dives` table
- Foreign key constraint to `diving_centers` table
- Optional relationship (NULL allowed)

**Testing Coverage:**

- Basic dive-diving center functionality tests
- Error handling for invalid diving centers
- Admin endpoint tests for diving center management
- Edge cases and validation tests

### 🚀 Major Features 6

#### **Dive Logging System**

- **Complete Dive Management**: Full CRUD operations for user dive logs
- **Comprehensive Dive Data**: Date, time, depth, visibility, ratings, suit
  type, difficulty level
- **Media Management**: Support for photos, videos, dive plans, and external
  links
- **Tag System**: Associate dives with tags for categorization
- **Automatic Name Generation**: Dives automatically named based on dive site
  and date
- **Privacy Controls**: Users can manage their own dives, admins can manage all
  dives
- **Search and Filtering**: Advanced filtering by dive site, depth, date range,
  ratings, and more

**New API Endpoints:**

- `GET /api/v1/dives/` - List user's dives with filtering
- `GET /api/v1/dives/{id}` - Get specific dive details
- `POST /api/v1/dives/` - Create new dive
- `PUT /api/v1/dives/{id}` - Update dive
- `DELETE /api/v1/dives/{id}` - Delete dive
- `GET /api/v1/dives/{id}/media` - Get dive media
- `POST /api/v1/dives/{id}/media` - Add media to dive
- `DELETE /api/v1/dives/{id}/media/{media_id}` - Delete dive media
- `POST /api/v1/dives/{id}/tags` - Add tag to dive
- `DELETE /api/v1/dives/{id}/tags/{tag_id}` - Remove tag from dive
- `GET /api/v1/admin/dives` - Admin: List all dives
- `PUT /api/v1/admin/dives/{id}` - Admin: Update any dive
- `DELETE /api/v1/admin/dives/{id}` - Admin: Delete any dive

#### **Frontend Dive Interface**

- **Dive List Page**: View all user dives with filtering and search
- **Dive Detail Page**: Comprehensive dive information display with media
  gallery
- **Create/Edit Dive**: Full form for creating and editing dives
- **Dive Map**: Interactive map showing dive locations
- **Admin Dive Management**: Admin interface for managing all dives
- **Media Gallery**: Photo and video display with external link support

#### **Database Schema Enhancements**

- **New Tables**: `dives`, `dive_media`, `dive_tags`
- **Enhanced Relationships**: Dives linked to users and dive sites
- **Media Support**: Comprehensive media management for dives
- **Tag Integration**: Dives can be tagged for categorization

**Migration Files:**

- `consolidated_dive_system_final.py` - Added complete dive system tables
- `add_dive_name_and_privacy.py` - Added dive name and privacy fields
- `add_is_active_column.py` - Added active status for dives

### 🔧 API Changes 2

#### **New Schemas and Models**

- **Dive**: Complete dive data model with validation
- **DiveMedia**: Media management for dives
- **DiveTag**: Tag associations for dives
- **Enhanced Responses**: Updated dive responses with media and tag information

#### **Enhanced Search and Filtering**

- **Advanced Filtering**: Filter by dive site, depth, date range, ratings,
  difficulty
- **Search by Name**: Search dives by dive site name
- **Admin Overrides**: Admin can view and manage all dives regardless of privacy

### 🗄️ Database Changes 2

#### **New Tables**

- `dives`: Store comprehensive dive information
- `dive_media`: Media files for dives (photos, videos, plans, external links)
- `dive_tags`: Association between dives and tags

#### **Schema Updates**

- **Added**: Complete dive logging system with media support
- **Enhanced**: Tag system now supports dive tagging
- **Improved**: Automatic dive name generation based on site and date

### 🎨 Frontend Changes 2

#### **New Pages and Components**

- **Dive List Page**: `/dives` - View and manage user dives
- **Dive Detail Page**: `/dives/{id}` - Comprehensive dive information
- **Create Dive Page**: `/dives/create` - Create new dives
- **Edit Dive Page**: `/dives/{id}/edit` - Edit existing dives
- **Admin Dives Page**: `/admin/dives` - Admin dive management
- **Dive Map Component**: Interactive map for dive locations
- **Media Gallery**: Photo and video display with external link support

#### **Enhanced User Experience**

- **Responsive Design**: Mobile-friendly dive interface
- **Media Upload**: Support for photos, videos, and external links
- **Tag Management**: Add and remove tags from dives
- **Search and Filter**: Advanced filtering capabilities
- **Automatic Naming**: Dives automatically named based on site and date

### ⚙️ Backend Changes 2

#### **New Routers**

- **Dives Router**: Complete CRUD operations for dives
- **Enhanced Main App**: Updated to include dive router
- **Media Management**: Comprehensive media upload and management
- **Tag Integration**: Tag system extended to support dives

#### **Enhanced Features**

- **Automatic Name Generation**: Dives named based on dive site and date
- **Privacy Controls**: Users manage their own dives, admins manage all
- **Advanced Filtering**: Comprehensive search and filter capabilities
- **Media Support**: Photos, videos, dive plans, and external links

## [Previous Release] - 2025-07-29

### 🚀 Major Features 7

#### **Diving Organizations Management System**

- **Complete CRUD Operations**: Full create, read, update, delete functionality
  for diving organizations
- **Organization Data**: Name, acronym, website, logo, description, country, and
  founding year
- **Admin-Only Management**: Only administrators can create, edit, or delete
  diving organizations
- **Data Validation**: Unique constraints on name and acronym to prevent
  duplicates
- **Pre-populated Data**: Script to populate with top 10 diving organizations
  (PADI, SSI, GUE, etc.)

**New API Endpoints:**

- `GET /api/v1/diving-organizations/` - List all diving organizations
- `GET /api/v1/diving-organizations/{id}` - Get specific organization
- `POST /api/v1/diving-organizations/` - Create new organization (admin only)
- `PUT /api/v1/diving-organizations/{id}` - Update organization (admin only)
- `DELETE /api/v1/diving-organizations/{id}` - Delete organization (admin only)

#### **User Certifications System**

- **Certification Tracking**: Users can manage their diving certifications
- **Organization Association**: Certifications linked to specific diving
  organizations
- **Active Status Management**: Users can activate/deactivate certifications
- **Public Profile Display**: Certifications visible on user profiles
- **Self-Service Management**: Users can add, edit, and manage their own
  certifications

**New API Endpoints:**

- `GET /api/v1/user-certifications/my-certifications` -
  Get user's certifications
- `GET /api/v1/user-certifications/users/{user_id}/certifications` -
  Get public certifications
- `POST /api/v1/user-certifications/my-certifications` - Add new certification
- `PUT /api/v1/user-certifications/my-certifications/{id}` -
  Update certification
- `DELETE /api/v1/user-certifications/my-certifications/{id}` -
  Delete certification
- `PATCH /api/v1/user-certifications/my-certifications/{id}/toggle` -
  Toggle active status

#### **Database Schema Enhancements 2**

- **New Tables**: `diving_organizations`, `user_certifications`,
  `diving_center_organizations`
- **Enhanced User Model**: Removed simple `diving_certification` field, replaced
  with comprehensive system
- **Relationship Management**: Many-to-many relationships between centers and
  organizations
- **Data Integrity**: Proper foreign key constraints and unique constraints

**Migration Files:**

- `c85d7af66778_add_diving_organizations_and_user_.py` -
  Added new tables and relationships
- `9002229c2a67_remove_unnecessary_certification_fields_.py` -
  Cleaned up certification fields

#### **Data Population Script**

- **Pre-populated Organizations**: Top 10 diving organizations automatically
  added
- **Duplicate Prevention**: Script checks for existing data before adding
- **Comprehensive Data**: Includes PADI, SSI, GUE, RAID, CMAS, TDI, NAUI, BSAC,
  SDI, IANTD
- **Organization Details**: Complete information including websites,
  descriptions, and founding years

### 🔧 API Changes 3

#### **New Schemas and Models 2**

- **DivingOrganization**: Complete organization management with validation
- **UserCertification**: User certification tracking with organization
  association
- **DivingCenterOrganization**: Many-to-many relationship between centers and
  organizations
- **Enhanced Responses**: Updated user and center responses to include
  organization data

#### **Enhanced User Management**

- **Certification Display**: User profiles now show diving certifications
- **Organization Information**: Detailed organization data in certification
  responses
- **Active Status**: Users can manage which certifications are currently active

### 🗄️ Database Changes 3

#### **New Tables 2**

- `diving_organizations`: Store diving organization information
- `user_certifications`: Track user certifications with organization links
- `diving_center_organizations`: Many-to-many relationship table

#### **Schema Updates 2**

- **Removed**: `users.diving_certification` field (replaced with comprehensive
  system)
- **Added**: Proper relationships and constraints for data integrity
- **Enhanced**: User model with certification relationships

### 🎨 Frontend Changes 3

#### **New Admin Features** (Planned)

- **Diving Organizations Management**: Admin interface for managing
  organizations
- **User Certification Display**: Enhanced user profiles with certification
  information
- **Organization Selection**: Dropdown menus for organization selection in forms

### ⚙️ Backend Changes 3

#### **New Routers 2**

- **Diving Organizations Router**: Complete CRUD operations for organizations
- **User Certifications Router**: Self-service certification management
- **Enhanced Main App**: Updated to include new routers

#### **Data Population**

- **Populate Script**: `populate_diving_organizations.py` for initial data
- **Duplicate Prevention**: Smart checking to avoid duplicate entries
- **Comprehensive Data**: Top 10 diving organizations with complete information

### 📚 Documentation Updates 2

#### **API Documentation**

- **New Endpoints**: Complete documentation for diving organizations and
  certifications
- **Schema Updates**: Updated with new models and relationships
- **Example Usage**: Code examples for new API endpoints

#### **Database Documentation**

- **Schema Changes**: Updated with new tables and relationships
- **Migration Guide**: Instructions for applying new migrations
- **Data Population**: Guide for populating initial organization data

## [Previous Release] - 2025-07-27

### 🚀 Major Features 8

#### **Enhanced Admin Management System**

- **Separate Admin URLs**: Dedicated pages for each management area
- **Enhanced Navigation**: Dropdown menu in navbar for admin users
- **Improved UX**: Card-based dashboard with visual icons and descriptions
- **Modal Forms**: Inline create/edit forms for tags and users
- **Real-time Updates**: React Query integration for instant data refresh

#### **Comprehensive Tag Management**

- **Full CRUD Operations**: Create, read, update, delete tags
- **Modal Forms**: Clean create and edit interfaces
- **Delete Protection**: Tags with associated dive sites cannot be deleted
- **Usage Statistics**: Display dive site counts for each tag

#### **Advanced User Management**

- **Complete User CRUD**: Create, edit, delete users
- **Role Assignment**: Admin, moderator, and user roles
- **Status Control**: Enable/disable user accounts
- **Password Management**: Optional password updates

### 🐛 Bug Fixes 3

#### **Frontend Create Pages**

- **Issue**: Admin create pages showed empty pages
- **Solution**: Created comprehensive create forms and added proper routes

#### **Dive Sites API Serialization**

- **Issue**: 500 errors due to improper tag serialization
- **Solution**: Updated tag serialization to return dictionaries instead of
  model objects

#### **Difficulty Level Validation**

- **Issue**: 'expert' difficulty level caused validation errors
- **Solution**: Updated schema patterns to include 'expert'

#### **Admin Authentication**

- **Issue**: Admin could not log in with default credentials
- **Solution**: Updated admin password to meet new requirements

#### **Docker Dependencies**

- **Issue**: Backend container failed to start with missing slowapi
- **Solution**: Rebuilt Docker image with updated requirements

### 📚 Documentation Updates 3

#### **API Documentation 2**

- **New Endpoints**: Documented all new admin endpoints
- **Response Formats**: Updated with proper tag serialization
- **Error Handling**: Comprehensive error documentation

#### **Security Documentation**

- **Password Requirements**: Updated security requirements
- **Admin Access**: Documented admin authentication changes
- **Rate Limiting**: Added rate limiting documentation

## Migration Notes

### For Developers

1. **Google OAuth Setup**: Follow `GOOGLE_OAUTH_SETUP.md` for complete
configuration
2. **Database Migration**: Run the Google ID migration script
3. **Dependencies**: Update requirements.txt and rebuild containers
4. **Frontend Dependencies**: Install Google OAuth packages if needed

### For Users

1. **Google Sign-In**: New Google OAuth authentication option
2. **Admin Features**: Enhanced mass delete functionality
3. **UI Improvements**: Better toast notifications and layout
4. **Security**: Enhanced authentication and authorization

### For Administrators

1. **Google OAuth Configuration**: Set up Google Cloud Console credentials
2. **Database Migration**: Run migration script for Google ID field
3. **Environment Variables**: Configure Google OAuth environment variables
4. **Container Rebuild**: Rebuild backend container with new dependencies

## Performance Impact

- **Positive**: Fixed 500 errors improve API reliability
- **Minimal**: Tag serialization adds small overhead but improves data
  consistency
- **Google OAuth**: Adds secure authentication without performance impact
- **Mass Delete**: Efficient bulk operations with proper error handling
- **No Breaking Changes**: All existing functionality preserved

## Security Notes

- **Google OAuth**: Secure token verification with Google's servers
- **Rate Limiting**: OAuth endpoints have rate limiting protection
- **Account Security**: Google users are enabled by default but can be managed
- **Mass Delete Safety**: Protection against deleting used tags and
  self-deletion
- **No Security Vulnerabilities**: All existing security measures remain intact
- **Enhanced Authentication**: Additional OAuth provider support

## Future Roadmap

### Planned Features

1. **Additional OAuth Providers**: Facebook, GitHub, etc.
2. **Bulk Operations**: Bulk update and bulk create functionality
3. **Advanced Search**: Enhanced search and filtering capabilities
4. **Mobile App**: Native mobile application
5. **Real-time Features**: Live updates and notifications

### Technical Improvements

1. **Performance Optimization**: Database query optimization
2. **Caching**: Redis caching for frequently accessed data
3. **API Versioning**: Proper API versioning strategy
4. **Monitoring**: Application performance monitoring
5. **Testing**: Enhanced test coverage and automation

## Related Documentation

- **[API Documentation](../development/api.md)** - Complete API reference
- **[Database Documentation](../development/database.md)** -
  Database schema and migrations
- **[Security Documentation](../security/README.md)** -
  Security measures and audit results
- **[Deployment Documentation](../deployment/README.md)** -
  Deployment procedures
