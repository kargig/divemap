# Dive Buddies Implementation Plan

**Task:** Add dive buddies functionality  
**Created:** 2025-12-14  
**Status:** ✅ Core Feature Complete | 🔄 Documentation Pending

## Quick Status Summary

### ✅ Fully Completed (Phases 1-9)
- **Backend:** Database schema, API endpoints, user search, buddy management, filtering
- **Frontend:** User search component, create/edit forms, dive details, profile settings, dive list filtering
- **Testing:** 30 comprehensive backend tests, all passing
- **Code Quality:** Linting errors fixed, route consistency fixed, N+1 query optimization

### 🔄 Remaining Work (Phase 10)
- **Documentation:** API documentation updates, project description updates
- **Final Review:** Cross-browser testing, mobile testing, production readiness review

### 📋 Post-Implementation Enhancements
- User profile statistics page with comprehensive stats and filtered list links
- Backend endpoint enhancements for user profile statistics
- Dive sites API filter enhancement (`created_by_username` parameter)

## Implementation Status Summary

### ✅ Completed: Phases 1-9 (Backend & Frontend Implementation)
- **Phase 1:** Database schema and models ✅
- **Phase 2:** Backend API core endpoints ✅
- **Phase 3:** Backend API user profile settings ✅
- **Phase 4:** Frontend user search component ✅
- **Phase 5:** Frontend create/edit dive forms ✅
- **Phase 6:** Frontend dive details page ✅
- **Phase 7:** Frontend user profile settings ✅
- **Phase 8:** Frontend dive list filtering ✅
- **Phase 9:** Testing & validation ✅

### ⏳ Pending: Phase 10 (Documentation & Cleanup)
- Phase 10: Documentation & cleanup

## Overview

This document outlines a detailed phased implementation plan for adding dive buddies functionality to Divemap. The feature allows users to declare registered users as buddies for their dives, with privacy controls and filtering capabilities.

## Implementation Phases

### Phase 1: Database Schema & Models (Foundation)

**Goal:** Create database structure and SQLAlchemy models for dive buddies

**Tasks:**

1. **Create Database Migration**
   - Create Alembic migration file: `0045_add_dive_buddies_and_visibility.py`
   - Add `buddy_visibility` column to `users` table:
     - Type: `Enum('public', 'private')` or `String(20)` with default 'public'
     - Default value: 'public'
     - Nullable: False
   - Create `dive_buddies` junction table:
     - `id` (Integer, primary key)
     - `dive_id` (Integer, ForeignKey to dives.id, not null, indexed)
     - `user_id` (Integer, ForeignKey to users.id, not null, indexed)
     - `created_at` (DateTime, server default now())
     - Unique constraint on (dive_id, user_id) to prevent duplicates
     - Indexes on both foreign keys for performance
   - Review migration file for correctness
   - Test migration on development database

2. **Update SQLAlchemy Models**
   - Add `buddy_visibility` field to `User` model in `backend/app/models.py`:
     - Type: `Column(String(20), default='public', nullable=False)`
     - Or use Enum if preferred
   - Create `DiveBuddy` model (junction table):
     - Follow pattern from `DiveTag` model
     - Include relationships to both Dive and User
   - Add `buddies` relationship to `Dive` model:
     - `buddies = relationship("User", secondary="dive_buddies", back_populates="buddy_dives")`
   - Add `buddy_dives` relationship to `User` model:
     - `buddy_dives = relationship("Dive", secondary="dive_buddies", back_populates="buddies")`
   - Verify model relationships are correct

3. **Run Migration & Verify**
   - Take database backup before migration
   - Run migration: `python run_migrations.py`
   - Verify table structure in database
   - Test that relationships work in Python shell
   - Rollback test (verify downgrade works)

**Files to Modify:**
- `backend/migrations/versions/0045_add_dive_buddies_and_visibility.py` (new)
- `backend/app/models.py`

**Success Criteria:**
- [x] Migration creates `dive_buddies` table successfully ✅
- [x] Migration adds `buddy_visibility` column to `users` table ✅
- [x] All existing users have `buddy_visibility='public'` by default ✅
- [x] SQLAlchemy relationships work correctly ✅
- [x] Migration can be rolled back successfully ✅

**Status:** ✅ COMPLETED

---

### Phase 2: Backend API - Core Endpoints

**Goal:** Implement backend API endpoints for managing dive buddies

**Tasks:**

1. **Update Pydantic Schemas**
   - Add `buddies` field to `DiveResponse` schema in `backend/app/schemas.py`:
     - Type: `List[UserPublicInfo]` or similar
     - Include: id, username, name, avatar_url
   - Add `buddies` field to `DiveCreate` schema (optional list of user IDs)
   - Add `buddies` field to `DiveUpdate` schema (optional list of user IDs)
   - Create `UserPublicInfo` schema if it doesn't exist (id, username, name, avatar_url)
   - Create `UserSearchResponse` schema for user search endpoint

2. **Update GET Dive Endpoint**
   - Modify `get_dive` in `backend/app/routers/dives/dives_crud.py`
   - Load buddies using joinedload or query
   - Include buddies in response with user details
   - Handle case where dive has no buddies (return empty list)

3. **Create User Search Endpoint**
   - Create new endpoint: `GET /api/v1/users/search`
   - Location: `backend/app/routers/users.py` or new file
   - Parameters:
     - `query` (string, required): search term
     - `limit` (integer, optional, default 25): max results
   - Filter users by:
     - `buddy_visibility='public'` (only show public users)
     - `enabled=True` (only active users)
     - Search in username and name fields (case-insensitive)
   - Return: List of users with id, username, name, avatar_url
   - Exclude current user from results (can't add yourself)
   - Add pagination if needed

4. **Update Dive Creation/Update Endpoints**
   - Modify `create_dive` in `dives_crud.py`:
     - Accept `buddies` array in request (list of user IDs)
     - Validate all buddy user IDs exist
     - Validate all buddy users have `buddy_visibility='public'`
     - Create `DiveBuddy` records for each buddy
     - Handle duplicate buddy prevention
   - Modify `update_dive` in `dives_crud.py`:
     - Accept `buddies` array in request (optional)
     - If provided, replace existing buddies (delete old, add new)
     - Validate permissions (only dive owner can update)
     - Validate buddy visibility and existence

5. **Create Buddy Management Endpoints**
   - Create `POST /api/v1/dives/{dive_id}/buddies`:
     - Add single or multiple buddies to a dive
     - Validate dive ownership (only owner can add)
     - Validate buddy visibility
     - Prevent duplicates
   - Create `DELETE /api/v1/dives/{dive_id}/buddies/{user_id}`:
     - Remove buddy from dive
     - Allow dive owner OR the buddy themselves to remove
     - Validate that user is actually a buddy of the dive
   - Create `PUT /api/v1/dives/{dive_id}/buddies`:
     - Replace entire buddy list
     - Only dive owner can use this
     - Validate all buddy IDs and visibility

6. **Add Buddy Filtering to Dive List Endpoints**
   - Modify `get_dives` in `dives_crud.py`:
     - Add `buddy_id` query parameter (optional, integer)
     - Add `buddy_username` query parameter (optional, string)
     - If `buddy_username` provided, convert to user ID first
     - Join with `dive_buddies` table to filter
     - Support filtering by single buddy (not multiple initially)
   - Modify `get_dives_count` in `dives_crud.py`:
     - Add same `buddy_id` and `buddy_username` parameters
     - Apply same filtering logic

**Files to Modify:**
- `backend/app/schemas.py`
- `backend/app/routers/dives/dives_crud.py`
- `backend/app/routers/users.py` (or create new file)

**Success Criteria:**
- [x] User search endpoint returns only public users ✅
- [x] Dive creation accepts and saves buddies ✅
- [x] Dive update can modify buddies list ✅
- [x] GET dive endpoint includes buddies in response ✅
- [x] Buddy management endpoints enforce permissions correctly ✅
- [x] Buddy filtering works in dive list endpoints ✅
- [x] All endpoints handle edge cases (no buddies, invalid IDs, etc.) ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- All schemas created: `UserPublicInfo`, `UserSearchResponse`, `AddBuddiesRequest`, `ReplaceBuddiesRequest`
- User search endpoint: `GET /api/v1/users/search?query=...&limit=25`
- Buddy management endpoints:
  - `POST /api/v1/dives/{dive_id}/buddies` - Add buddies (owner only)
  - `PUT /api/v1/dives/{dive_id}/buddies` - Replace all buddies (owner only)
  - `DELETE /api/v1/dives/{dive_id}/buddies/{user_id}` - Remove buddy (owner or buddy)
- Buddy filtering: `buddy_id` and `buddy_username` parameters in dive list endpoints

---

### Phase 3: Backend API - User Profile Settings

**Goal:** Add buddy visibility setting to user profile

**Tasks:**

1. **Update User Profile Schema**
   - Add `buddy_visibility` field to user profile update schema
   - Add validation (only 'public' or 'private' allowed)

2. **Update User Profile Endpoint**
   - Modify user profile update endpoint in `backend/app/routers/users.py` or settings
   - Allow users to update their `buddy_visibility` setting
   - Validate input (public/private only)
   - Return updated user profile

3. **Add GET User Profile Endpoint (if needed)**
   - Ensure user can view their own `buddy_visibility` setting
   - Include in profile response

**Files to Modify:**
- `backend/app/schemas.py`
- `backend/app/routers/users.py` or `backend/app/routers/settings.py`

**Success Criteria:**
- [x] Users can update their buddy visibility setting ✅
- [x] Setting is validated (only public/private) ✅
- [x] Setting persists correctly in database ✅
- [x] Setting affects user search results immediately ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- `UserUpdate` schema includes `buddy_visibility` field with validation
- `PUT /api/v1/users/me` endpoint automatically handles buddy_visibility via setattr

---

### Phase 4: Frontend - User Search Component

**Goal:** Create reusable user search component for buddy selection

**Tasks:**

1. **Create UserSearchInput Component**
   - Create `frontend/src/components/UserSearchInput.js`
   - Follow pattern from dive site search (similar to CreateDive.js)
   - Features:
     - Debounced search (0.5 seconds)
     - Calls `/api/v1/users/search` endpoint
     - Displays user avatar, username, and name in dropdown
     - Filters out current user from results
     - Loading state display
     - Error state display
     - Empty state message
   - Props:
     - `onSelect`: callback when user selected
     - `excludeUserIds`: array of user IDs to exclude (for already selected buddies)
     - `placeholder`: custom placeholder text
     - `className`: custom styling
   - Handle keyboard navigation (arrow keys, enter, escape)

2. **Test Component in Isolation**
   - Create test page or use Storybook if available
   - Test search functionality
   - Test loading/error states
   - Test user selection

**Files to Create:**
- `frontend/src/components/UserSearchInput.js`

**Success Criteria:**
- [x] Component searches users correctly ✅
- [x] Component filters out current user ✅
- [x] Component displays loading/error states ✅
- [x] Component is reusable and well-structured ✅
- [x] Component handles edge cases (no results, API errors) ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- Created `frontend/src/components/UserSearchInput.js`
- Debounced search (0.5 seconds)
- Keyboard navigation support
- Avatar display with fallback
- Excludes specified user IDs
- Loading and error state handling

---

### Phase 5: Frontend - Create/Edit Dive Forms

**Goal:** Add buddy selection to dive creation and editing forms

**Tasks:**

1. **Update CreateDive.js**
   - Add "Buddies" section to form
   - Add state for selected buddies (array of user objects)
   - Integrate `UserSearchInput` component
   - Display selected buddies as removable chips/tags
   - Handle adding buddies (prevent duplicates)
   - Handle removing buddies
   - Include buddies array in form submission
   - Map selected users to user IDs for API call
   - Show validation errors if any

2. **Update EditDive.js**
   - Load existing buddies when dive data loads
   - Add "Buddies" section to form (same as CreateDive)
   - Pre-populate selected buddies from dive data
   - Allow adding/removing buddies
   - Include buddies in update API call
   - Handle permission errors (only owner can edit)

3. **Style Buddy Selection UI**
   - Style buddy chips/tags consistently with existing design
   - Add remove button/icon to each chip
   - Show helpful placeholder text
   - Match existing form styling patterns

**Files to Modify:**
- `frontend/src/pages/CreateDive.js`
- `frontend/src/pages/EditDive.js`

**Success Criteria:**
- [x] Users can search and select buddies in create form ✅
- [x] Users can add/remove buddies in edit form ✅
- [x] Selected buddies display correctly as chips ✅
- [x] Form submission includes buddies ✅
- [x] Validation works correctly ✅
- [x] UI is consistent with existing design ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- Added `handleBuddySelect` and `handleBuddyRemove` functions
- Integrated `UserSearchInput` component in both forms
- Selected buddies displayed as removable chips with avatars
- Buddies included in API submission (mapped to user IDs)
- Duplicate prevention implemented
- Admin users can edit any dive (permission check updated)

---

### Phase 6: Frontend - Dive Details Page

**Goal:** Display buddies on dive details page with self-removal option

**Tasks:**

1. **Update DiveDetail.js**
   - Add "Buddies" section to dive details display
   - Display list of buddy users with:
     - Avatar (if available)
     - Username
     - Full name (if available)
   - Link each buddy to their user profile page
   - Show "No buddies" message if dive has no buddies

2. **Add Self-Removal Functionality**
   - Check if current user is a buddy (not the dive owner)
   - Show "Remove me" button for buddies
   - Hide "Remove me" button for dive owner (they use edit page)
   - Implement removal API call
   - Update UI after successful removal
   - Show success/error toast messages

3. **Style Buddies Section**
   - Match existing dive details styling
   - Use consistent avatar/username display pattern
   - Style "Remove me" button appropriately

**Files to Modify:**
- `frontend/src/pages/DiveDetail.js`

**Success Criteria:**
- [x] Buddies display correctly on dive details page ✅
- [x] Buddy avatars and names show correctly ✅
- [x] "Remove me" button appears for buddies only ✅
- [x] Self-removal works correctly ✅
- [x] UI updates after removal ✅
- [x] Links to user profiles work ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- Added "Dive Buddies" section below Tags section
- Displays up to 3 buddies in dive list with "+N" indicator
- Shows buddy avatars, usernames, and names
- "Remove me" button for non-owner buddies
- Links to `/users/:username` profile pages
- Added `removeBuddy` API function
- Optimized with eager loading to prevent N+1 queries

---

### Phase 7: Frontend - User Profile Settings

**Goal:** Add buddy visibility toggle to user profile settings

**Tasks:**

1. **Update Profile.js**
   - Add "Privacy" or "Buddy Settings" section
   - Add toggle/switch for "Allow others to add me as a dive buddy"
   - Default: enabled (public)
   - Load current `buddy_visibility` setting
   - Update setting when toggle changes
   - Show success/error messages
   - Add helpful description text

2. **Style Settings UI**
   - Match existing profile settings styling
   - Use consistent toggle/switch component
   - Add clear labels and descriptions

**Files to Modify:**
- `frontend/src/pages/Profile.js`

**Success Criteria:**
- [x] Toggle displays current setting correctly ✅
- [x] Users can change their buddy visibility ✅
- [x] Setting persists correctly ✅
- [x] Setting affects search results immediately ✅
- [x] UI is clear and user-friendly ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- Added buddy visibility dropdown (Public/Private) to Profile.js
- Integrated into "Account Information" section
- Displays current setting in view mode
- Updates via existing `PUT /api/v1/users/me` endpoint
- Removed duplicate statistics from Account Information section

---

### Phase 8: Frontend - Dive List Filtering

**Goal:** Add buddy filter to dive list page

**Tasks:**

1. **Update Dives.js**
   - Add buddy filter to filter bar
   - Integrate `UserSearchInput` component for buddy selection
   - Store selected buddy username in filter state (not ID)
   - Pass `buddy_username` parameter to API calls
   - Display selected buddy filter with clear button
   - Update URL query parameters when buddy filter changes
   - Read buddy filter from URL on page load
   - Clear buddy filter functionality

2. **Update Filter State Management**
   - Add `buddy_username` to filter state
   - Include in API query parameters
   - Include in URL query parameters
   - Handle filter clearing

3. **Style Filter UI**
   - Match existing filter bar styling
   - Position buddy filter appropriately
   - Show selected buddy clearly
   - Make clear button obvious

**Files to Modify:**
- `frontend/src/pages/Dives.js`

**Success Criteria:**
- [x] Users can filter dives by buddy username ✅
- [x] Filter works with other existing filters ✅
- [x] Filter persists in URL ✅
- [x] Filter can be cleared ✅
- [x] UI is consistent with existing filters ✅

**Status:** ✅ COMPLETED

**Implementation Details:**
- Added `buddy_username` filter to `Dives.js` and `ResponsiveFilterBar.js`
- Integrated with URL query parameters
- Added to both dive list and count API calls
- Filter displayed in active filters list
- Buddies displayed in dive cards (up to 3 with "+N" indicator)
- Fixed route consistency: all routes use `/users/:username` (plural)

---

### Phase 9: Testing & Validation

**Status:** ✅ COMPLETED - All backend tests passing (30/30)

**Goal:** Comprehensive testing of all functionality

**Tasks:**

1. **Backend API Testing**
   - Test user search endpoint with various queries
   - Test user search respects visibility settings
   - Test dive creation with buddies
   - Test dive update with buddies
   - Test buddy addition endpoint
   - Test buddy removal endpoint (owner and self)
   - Test permission enforcement
   - Test buddy filtering in dive list
   - Test edge cases (duplicate buddies, invalid IDs, etc.)

2. **Frontend Testing**
   - Test buddy selection in create dive form
   - Test buddy selection in edit dive form
   - Test buddy display on dive details page
   - Test self-removal functionality
   - Test buddy visibility toggle in profile
   - Test buddy filtering in dive list
   - Test all error states and edge cases

3. **Integration Testing**
   - Test full flow: create dive with buddies → view dive → edit buddies
   - Test visibility settings affect search results
   - Test filtering works end-to-end
   - Test permission enforcement across all endpoints

4. **User Acceptance Testing**
   - Test as dive owner (can add/remove buddies)
   - Test as buddy (can remove self, cannot re-add)
   - Test with private visibility (doesn't appear in search)
   - Test with public visibility (appears in search)
   - Test filtering by buddy works correctly

**Files Created:**
- `backend/tests/test_dive_buddies.py` ✅ (30 comprehensive tests)

**Test Coverage:**
- ✅ User search endpoint (6 tests)
- ✅ Dive creation with buddies (5 tests)
- ✅ Dive update with buddies (3 tests)
- ✅ Buddy management endpoints (6 tests)
- ✅ Buddy filtering (4 tests)
- ✅ Buddy visibility settings (3 tests)
- ✅ Get dive with buddies (2 tests)
- ✅ Multiple buddies per dive (1 test)

**Success Criteria:**
- [x] All backend tests pass (30/30) ✅
- [x] All frontend functionality works correctly ✅
- [x] All edge cases handled ✅
- [x] No API errors ✅
- [x] All user flows work end-to-end ✅

**Additional Testing Completed:**
- [x] Frontend buddy selection in create/edit forms tested ✅
- [x] Frontend buddy display on dive details tested ✅
- [x] Frontend self-removal functionality tested ✅
- [x] Frontend buddy visibility toggle tested ✅
- [x] Frontend buddy filtering in dive list tested ✅
- [x] Route consistency fixed (/user/ vs /users/) ✅
- [x] Linting errors fixed ✅

---

### Phase 10: Documentation & Cleanup

**Goal:** Document changes and clean up code

**Tasks:**

1. **Update Documentation**
   - Update API documentation if applicable
   - Add comments to complex code sections
   - Document buddy visibility behavior
   - Update project description if needed
   - Document user profile statistics feature (added post-implementation)

2. **Code Review & Cleanup**
   - Review all code changes
   - Remove debug code
   - Ensure consistent code style
   - Fix any linting issues ✅ (Fixed: CreateDive.js missing functions, route consistency)
   - Optimize database queries if needed ✅ (N+1 query fix for dive list buddies)

3. **Final Testing**
   - Run full test suite
   - Test on different browsers
   - Test on mobile devices
   - Verify no regressions

**Additional Features Added (Post-Implementation):**
- User profile statistics page (`/users/:username`):
  - Dive sites created (with link to filtered list)
  - Dives created (with link to filtered list)
  - Diving centers owned
  - Dive site comments count
  - Dive site ratings count
  - Total dives claimed
  - Dives as buddy (with link to filtered list)
- Backend endpoint: `GET /api/v1/users/{username}/public` enhanced with statistics
- Backend endpoint: `GET /api/v1/dive-sites/` added `created_by_username` filter parameter

**Success Criteria:**
- [x] Code is clean and well-documented (mostly complete)
- [x] No linting errors ✅
- [x] All tests pass ✅
- [ ] Documentation is updated (API docs, project description)
- [ ] Ready for production (pending final documentation review)

**Status:** 🔄 IN PROGRESS

---

## Implementation Order Summary

1. **Phase 1:** Database Schema & Models (Foundation) ✅ COMPLETED
2. **Phase 2:** Backend API - Core Endpoints ✅ COMPLETED
3. **Phase 3:** Backend API - User Profile Settings ✅ COMPLETED
4. **Phase 4:** Frontend - User Search Component ✅ COMPLETED
5. **Phase 5:** Frontend - Create/Edit Dive Forms ✅ COMPLETED
6. **Phase 6:** Frontend - Dive Details Page ✅ COMPLETED
7. **Phase 7:** Frontend - User Profile Settings ✅ COMPLETED
8. **Phase 8:** Frontend - Dive List Filtering ✅ COMPLETED
9. **Phase 9:** Testing & Validation ✅ COMPLETED
10. **Phase 10:** Documentation & Cleanup 🔄 IN PROGRESS

## Recent Updates

### Post-Implementation Enhancements
- **User Profile Statistics:** Added comprehensive statistics display to `/users/:username` page
  - Shows dive sites created, dives created, diving centers owned, comments, ratings, total dives, and buddy dives
  - Includes clickable links to filtered dive lists
  - Backend schema updated with `UserProfileStats` including all new fields
- **Route Consistency:** Fixed all routes to use `/users/:username` (plural) consistently
- **Code Quality:** Fixed linting errors in `CreateDive.js` (missing `handleBuddySelect` and `handleBuddyRemove` functions)
- **Performance:** Optimized dive list query to prevent N+1 queries when displaying buddies

## Remaining Work

### Phase 10: Documentation & Cleanup
- [ ] Update API documentation with new endpoints and parameters
- [ ] Document user profile statistics feature
- [ ] Update project description if needed
- [ ] Final code review and cleanup
- [ ] Cross-browser and mobile testing
- [ ] Production readiness review

## Dependencies

- Phase 1 must complete before Phase 2
- Phase 2 must complete before Phase 4
- Phase 3 can run in parallel with Phase 2
- Phase 4 must complete before Phases 5, 6, and 8
- Phases 5, 6, 7, 8 can run in parallel after Phase 4
- Phase 9 requires all previous phases
- Phase 10 is final cleanup

## Risk Mitigation

1. **Database Migration Risks:**
   - Always backup database before migration
   - Test migration on development first
   - Have rollback plan ready

2. **API Breaking Changes:**
   - Ensure backward compatibility where possible
   - Version API if needed
   - Test with existing frontend code

3. **Performance Concerns:**
   - Index foreign keys in junction table
   - Optimize queries with joins
   - Test with large datasets

4. **Permission Issues:**
   - Thoroughly test permission enforcement
   - Test edge cases (admin users, etc.)
   - Document permission rules clearly

## Estimated Timeline

- Phase 1: 1-2 hours
- Phase 2: 3-4 hours
- Phase 3: 1 hour
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours
- Phase 6: 1-2 hours
- Phase 7: 1 hour
- Phase 8: 2-3 hours
- Phase 9: 3-4 hours
- Phase 10: 1-2 hours

**Total Estimated Time:** 17-25 hours
