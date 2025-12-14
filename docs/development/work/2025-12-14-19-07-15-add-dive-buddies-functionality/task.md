# Add dive buddies functionality

**Status:** In Progress - Backend Complete & Tested, Frontend Pending

## Progress

### Phase 1: Database Schema & Models ✅ COMPLETED
- [x] Created Alembic migration (0045_add_dive_buddies_and_visibility.py)
- [x] Added `buddy_visibility` field to User model
- [x] Created DiveBuddy junction table model
- [x] Added relationships to User and Dive models
- [x] Migration run successfully
- [x] Database structure verified
- [x] Models tested and working

### Phase 2: Backend API - Core Endpoints ✅ COMPLETED
- [x] Updated Pydantic schemas (DiveResponse, DiveCreate, DiveUpdate, UserSearchResponse, AddBuddiesRequest, ReplaceBuddiesRequest)
- [x] Updated GET dive endpoint to include buddies
- [x] Created user search endpoint (GET /api/v1/users/search)
- [x] Updated dive creation endpoint to handle buddies
- [x] Updated dive update endpoint to handle buddies
- [x] Created buddy management endpoints (POST, PUT, DELETE /api/v1/dives/{dive_id}/buddies)
- [x] Added buddy filtering to dive list endpoints (buddy_id and buddy_username parameters)

### Phase 3: Backend API - User Profile Settings ✅ COMPLETED
- [x] Added `buddy_visibility` field to UserUpdate schema
- [x] User profile update endpoint automatically handles buddy_visibility (via setattr)

### Phase 9: Testing & Validation ✅ COMPLETED
- [x] Created comprehensive test suite (`test_dive_buddies.py`)
- [x] Test user search endpoint (6 tests)
- [x] Test dive creation with buddies (5 tests)
- [x] Test dive update with buddies (3 tests)
- [x] Test buddy management endpoints (6 tests)
- [x] Test buddy filtering (4 tests)
- [x] Test buddy visibility settings (3 tests)
- [x] Test get dive with buddies (2 tests)
- [x] Test multiple buddies per dive (1 test)
- [x] All 30 tests passing ✅
- [x] Test coverage includes all critical functionality
- [x] Edge cases tested (invalid IDs, permissions, visibility)

**Created:** 2025-12-14-19-07-15
**Agent PID:** 37893
**Branch:** feature/add-dive-buddies-functionality

## Implementation Status

### ✅ Completed Phases (1-3)

**Phase 1: Database Schema & Models**
- Migration `0045_add_dive_buddies_and_visibility.py` created and executed
- `dive_buddies` junction table created with proper indexes and constraints
- `buddy_visibility` field added to `users` table (default: 'public')
- `DiveBuddy` model created with relationships
- `User` and `Dive` models updated with buddy relationships
- All relationships tested and working

**Phase 2: Backend API - Core Endpoints**
- **Schemas Updated:**
  - `UserPublicInfo` schema created
  - `UserSearchResponse` schema created
  - `AddBuddiesRequest` schema created
  - `ReplaceBuddiesRequest` schema created
  - `DiveResponse` includes `buddies` field
  - `DiveCreate` includes `buddies` field (optional list of user IDs)
  - `DiveUpdate` includes `buddies` field (optional list of user IDs)
- **Endpoints Implemented:**
  - `GET /api/v1/dives/{dive_id}` - Returns dive with buddies list
  - `GET /api/v1/users/search` - Search users by username/name (public only)
  - `POST /api/v1/dives/` - Create dive with buddies
  - `PUT /api/v1/dives/{dive_id}` - Update dive buddies
  - `POST /api/v1/dives/{dive_id}/buddies` - Add buddies to dive (owner only)
  - `PUT /api/v1/dives/{dive_id}/buddies` - Replace all buddies (owner only)
  - `DELETE /api/v1/dives/{dive_id}/buddies/{user_id}` - Remove buddy (owner or buddy)
  - `GET /api/v1/dives/` - List dives with buddy filtering (buddy_id, buddy_username)
  - `GET /api/v1/dives/count` - Count dives with buddy filtering
- **Features:**
  - Permission enforcement (only owner can add/update, buddy can remove self)
  - Validation (public visibility only, no self-adding)
  - Buddy filtering by ID or username
  - Username-to-ID conversion for filtering

**Phase 3: Backend API - User Profile Settings**
- `UserUpdate` schema includes `buddy_visibility` field
- `PUT /api/v1/users/me` automatically handles buddy_visibility updates

**Phase 9: Testing & Validation**
- Comprehensive test suite created: `backend/tests/test_dive_buddies.py`
- 30 tests covering all backend functionality
- All tests passing ✅
- Test coverage includes:
  - User search endpoint (6 tests)
  - Dive creation/update with buddies (8 tests)
  - Buddy management endpoints (6 tests)
  - Buddy filtering (4 tests)
  - Buddy visibility settings (3 tests)
  - Permission enforcement (3 tests)

### ✅ Completed Phases (4-8)

**Phase 4: Frontend - User Search Component** ✅
- Created `UserSearchInput` component with debounced search
- Added `searchUsers` API function
- Component includes avatar display, keyboard navigation, loading/error states

**Phase 5: Frontend - Create/Edit Dive Forms** ✅
- Added buddies section to `CreateDive.js`
- Added buddies section to `EditDive.js`
- Integrated `UserSearchInput` component
- Display selected buddies as removable chips
- Include buddies in form submission

**Phase 6: Frontend - Dive Details Page** ✅
- Added buddies display section to `DiveDetail.js`
- Shows buddy avatars, usernames, and names
- "Remove me" button for buddies (not owners)
- Links to user profiles
- Added `removeBuddy` API function

**Phase 7: Frontend - User Profile Settings** ✅
- Added buddy visibility toggle to `Profile.js`
- Dropdown with Public/Private options
- Displays current visibility setting in view mode
- Updates via existing profile update endpoint

**Phase 8: Frontend - Dive List Filtering** ✅
- Added `buddy_username` filter to `Dives.js`
- Added filter input to `ResponsiveFilterBar.js` (desktop and mobile)
- Integrated with URL query parameters
- Added to API query params and count query

### 🔄 Remaining Phase

**Phase 10: Documentation & Cleanup** (Not Started)

## Implementation Plan

See detailed phased implementation plan: [implementation-plan.md](./implementation-plan.md)

The implementation is divided into 10 phases:
1. Database Schema & Models (Foundation)
2. Backend API - Core Endpoints
3. Backend API - User Profile Settings
4. Frontend - User Search Component
5. Frontend - Create/Edit Dive Forms
6. Frontend - Dive Details Page
7. Frontend - User Profile Settings
8. Frontend - Dive List Filtering
9. Testing & Validation
10. Documentation & Cleanup

## Original Todo

- [ ] **Add dive buddies functionality**
  - **Database Changes:**
    - Create `dive_buddies` junction table with `dive_id` and `user_id` foreign keys
    - Add `buddy_visibility` field to `users` table (default: 'public', options: 'public'/'private')
    - Create Alembic migration for new table and field
    - Add relationship in Dive model: `buddies = relationship("User", secondary="dive_buddies", back_populates="buddy_dives")`
    - Add relationship in User model: `buddy_dives = relationship("Dive", secondary="dive_buddies", back_populates="buddies")`
  - **Backend API:**
    - Add `buddies` field to Dive schema (Pydantic) - list of user IDs or user objects
    - Update GET `/api/v1/dives/{dive_id}` to include buddies list with user details (id, username, name, avatar_url)
    - Add POST/PUT `/api/v1/dives/{dive_id}/buddies` endpoint for dive owner to add/update buddies
    - Add DELETE `/api/v1/dives/{dive_id}/buddies/{user_id}` endpoint for dive owner or the buddy themselves to remove
    - Add GET `/api/v1/users/search` endpoint to search users by username/name (only returns users with `buddy_visibility='public'`)
    - Enforce permissions: only dive owner can add/update buddies list
    - Allow buddies to remove themselves from a dive (but not re-add themselves)
    - Filter user search results to exclude users with `buddy_visibility='private'`
    - Update dive creation/update endpoints to accept `buddies` array
    - Add `buddy_id` and `buddy_username` filter parameters to GET `/api/v1/dives/` endpoint
    - Filter dives by buddy using join with `dive_buddies` junction table
    - Support filtering by single buddy or multiple buddies (comma-separated buddy IDs)
    - Add `buddy_id` and `buddy_username` filter parameters to GET `/api/v1/dives/count` endpoint
  - **Frontend - User Profile Settings:**
    - Add buddy visibility toggle in user profile settings page (`/profile`)
    - Add setting: "Allow others to add me as a dive buddy" (default: enabled/public)
    - When disabled (private), user won't appear in buddy search results
    - Store setting as `buddy_visibility` field in user profile
  - **Frontend - Create/Edit Dive:**
    - Add "Buddies" section to CreateDive.js and EditDive.js forms
    - Implement user search dropdown (similar to dive site search) with debounced search
    - Show only users with `buddy_visibility='public'` in search results
    - Display selected buddies as removable chips/tags
    - Allow dive owner to add/remove buddies
    - Show validation message if trying to add user with private visibility
  - **Frontend - Dive Details Page:**
    - Add "Buddies" section to DiveDetail.js showing list of buddy users
    - Display buddy avatars, usernames, and names
    - Show "Remove me" button for buddies (not the dive owner) to remove themselves
    - Hide "Remove me" button for dive owner (they use edit page instead)
    - Display message if no buddies assigned
    - Link buddy names/usernames to their user profile pages
  - **Frontend - User Search Component:**
    - Create reusable UserSearchInput component (similar to dive site search)
    - Implement debounced search (0.5 seconds) calling `/api/v1/users/search`
    - Display user avatar, username, and name in dropdown
    - Filter out current user from results (can't add yourself as buddy)
    - Handle loading and error states
  - **Frontend - Dive List Filtering:**
    - Add "Filter by Buddy" option to dive list filters in Dives.js
    - Add buddy search/select dropdown to filter bar (similar to dive site filter)
    - Display selected buddy filter with ability to clear
    - Users interact only with usernames (never IDs) - all UI elements show usernames
    - Frontend can optionally convert selected username to user ID before API call (for efficiency, but users never see IDs)
    - Pass `buddy_username` parameter to dive list API calls (or convert to `buddy_id` internally if preferred)
    - Update filter state management to include buddy filter (store username, not ID)
    - Show buddy filter in URL query parameters for shareable filtered views (using username for readability)
    - Support filtering by single buddy username only (backend may support multiple, but frontend uses single username)
  - **Testing:**
    - Test buddy addition/removal by dive owner
    - Test buddy self-removal functionality
    - Test that private visibility users don't appear in search
    - Test that dive owner cannot be removed by buddies
    - Test that removed buddies cannot re-add themselves
    - Test multiple buddies per dive
    - Test buddy display on dive details page
    - Test user search with various query strings
    - Test permission enforcement (non-owners cannot modify buddies)
    - Test backend API filtering dives by buddy_id parameter (for API flexibility)
    - Test backend API filtering dives by buddy_username parameter
    - Test frontend filtering dives by username only (users never interact with IDs)
    - Test that frontend username-to-ID conversion works correctly (if implemented)
    - Test that filtered results only show dives with the specified buddy
    - Test that buddy filter works with other existing filters (dive site, difficulty, date range, etc.)
    - Test buddy filter UI in dive list page (username-based search and selection, no IDs visible to users)
    - Test clearing buddy filter
    - Test buddy filter persistence in URL query parameters (using username for readability)
  - **Migration Considerations:**
    - Consider migrating existing buddy text from `dive_information` field to new `dive_buddies` table (optional, can be separate task)
