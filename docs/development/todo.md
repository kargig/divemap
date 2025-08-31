# Divemap Development Todo

## Active Tasks

### High Priority

### Medium Priority

#### 4. Map View for Dive Sites and Diving Centers

**Status:** Planning

**Priority:** Medium

**Description:** Implement independent map view for dive sites and diving centers that is separate from list/grid views and their filters/pagination.

**Tasks:**

- [ ] Design map view architecture independent of list/grid views
- [ ] Implement region-based map display showing all dive sites/centers in viewport
- [ ] Add data point clustering for performance optimization
- [ ] Implement progressive clustering breakdown on zoom
- [ ] Ensure mobile-responsive design and touch interactions
- [ ] Set performance limits to prevent map slowdown
- [ ] Test map performance with large datasets
- [ ] Validate mobile and desktop user experience

**Files:** `docs/development/map-view-implementation.md`

**GitHub Issue:** [#54](https://github.com/kargig/divemap/issues/54)

#### 5. Media Upload/Download with Cloudflare R2 and External Links

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

#### 6. Dive Route Drawing and Selection

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

#### 7. Dive Route Annotations and Points of Interest

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

#### 8. Email Notifications System

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

#### 9. Enhanced Subsurface Dive Import with Interactive Dive Profiles

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

#### 10. CSS and Sticky Positioning Guide

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

#### 11. Floating Search Filters Guide

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
