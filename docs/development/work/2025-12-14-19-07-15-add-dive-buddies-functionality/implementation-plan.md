# Dive Buddies Implementation Plan

**Task:** Add dive buddies functionality  
**Created:** 2025-12-14  
**Status:** In Progress - Backend Complete, Testing Phase

## Implementation Status Summary

### ✅ Completed: Phases 1-3 (Backend Implementation)
- **Phase 1:** Database schema and models ✅
- **Phase 2:** Backend API core endpoints ✅
- **Phase 3:** Backend API user profile settings ✅

### 🔄 In Progress: Phase 9 (Testing)
- Creating comprehensive test suite for buddy functionality

### ⏳ Pending: Phases 4-8, 10 (Frontend & Documentation)
- Phase 4: Frontend user search component
- Phase 5: Frontend create/edit dive forms
- Phase 6: Frontend dive details page
- Phase 7: Frontend user profile settings
- Phase 8: Frontend dive list filtering
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
- [ ] Component searches users correctly
- [ ] Component filters out current user
- [ ] Component displays loading/error states
- [ ] Component is reusable and well-structured
- [ ] Component handles edge cases (no results, API errors)

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
- [ ] Users can search and select buddies in create form
- [ ] Users can add/remove buddies in edit form
- [ ] Selected buddies display correctly as chips
- [ ] Form submission includes buddies
- [ ] Validation works correctly
- [ ] UI is consistent with existing design

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
- [ ] Buddies display correctly on dive details page
- [ ] Buddy avatars and names show correctly
- [ ] "Remove me" button appears for buddies only
- [ ] Self-removal works correctly
- [ ] UI updates after removal
- [ ] Links to user profiles work

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
- [ ] Toggle displays current setting correctly
- [ ] Users can change their buddy visibility
- [ ] Setting persists correctly
- [ ] Setting affects search results immediately
- [ ] UI is clear and user-friendly

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
- [ ] Users can filter dives by buddy username
- [ ] Filter works with other existing filters
- [ ] Filter persists in URL
- [ ] Filter can be cleared
- [ ] UI is consistent with existing filters

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
- [ ] All frontend functionality works correctly (Pending Phase 4-8)
- [x] All edge cases handled ✅
- [x] No API errors ✅
- [ ] All user flows work end-to-end (Pending frontend implementation)

---

### Phase 10: Documentation & Cleanup

**Goal:** Document changes and clean up code

**Tasks:**

1. **Update Documentation**
   - Update API documentation if applicable
   - Add comments to complex code sections
   - Document buddy visibility behavior
   - Update project description if needed

2. **Code Review & Cleanup**
   - Review all code changes
   - Remove debug code
   - Ensure consistent code style
   - Fix any linting issues
   - Optimize database queries if needed

3. **Final Testing**
   - Run full test suite
   - Test on different browsers
   - Test on mobile devices
   - Verify no regressions

**Success Criteria:**
- [ ] Code is clean and well-documented
- [ ] No linting errors
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Ready for production

---

## Implementation Order Summary

1. **Phase 1:** Database Schema & Models (Foundation)
2. **Phase 2:** Backend API - Core Endpoints
3. **Phase 3:** Backend API - User Profile Settings
4. **Phase 4:** Frontend - User Search Component
5. **Phase 5:** Frontend - Create/Edit Dive Forms
6. **Phase 6:** Frontend - Dive Details Page
7. **Phase 7:** Frontend - User Profile Settings
8. **Phase 8:** Frontend - Dive List Filtering
9. **Phase 9:** Testing & Validation
10. **Phase 10:** Documentation & Cleanup

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
