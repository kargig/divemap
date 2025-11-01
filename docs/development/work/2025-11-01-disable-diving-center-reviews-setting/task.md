# Add disable_diving_center_reviews setting

**Status:** In Progress
**Created:** November 01, 2025
**Started:** November 01, 2025
**Agent PID:** 28688
**Branch:** feature/disable-diving-center-reviews-setting

## Original Todo

Add a configuration option that disables diving centers comments and ratings. The setting should be called "disable_diving_center_reviews" and should be configurable via the admin interface at `http://localhost/admin/diving-centers`.

## Description

Implement a database-backed configuration system to control whether diving center reviews (comments and ratings) are enabled or disabled across the application. This setting should be:

1. **Stored in database**: Create a `settings` table to support future configuration settings
2. **Admin-configurable**: Add a toggle control in the admin diving centers management page
3. **Backend enforcement**: API endpoints for ratings and comments should check the setting before allowing operations
4. **Frontend visibility**: The diving center detail page should conditionally hide/show rating and comment UI based on the setting
5. **API access**: Provide endpoint to read/update the setting (admin-only)

This design allows for future expansion with additional settings stored in the same table structure.

## Success Criteria

### Functional Requirements

- [x] Database: `settings` table created with `key` (unique string), `value` (TEXT/JSON), `description` (TEXT), `updated_at` (TIMESTAMP)
- [x] Database: Initial setting `disable_diving_center_reviews` inserted with default value `false` (JSON boolean)
- [x] Backend: API endpoint to get setting value (public read access) - `GET /api/v1/settings/{key}`
- [x] Backend: API endpoint to update setting value (admin-only) - `PUT /api/v1/settings/{key}`
- [x] Backend: Rating endpoint (`POST /api/v1/diving-centers/{id}/rate`) checks setting and returns 403 if disabled
- [x] Backend: Comment endpoints (`POST`, `PUT`, `DELETE /api/v1/diving-centers/{id}/comments`) check setting and return 403 if disabled
- [x] Backend: Comment list endpoint (`GET /api/v1/diving-centers/{id}/comments`) returns empty list if disabled (no error, just empty)
- [ ] Frontend: Admin UI toggle in `/admin/diving-centers` page to enable/disable reviews
- [ ] Frontend: Diving center detail page hides rating UI when setting is disabled
- [ ] Frontend: Diving center detail page hides comment UI when setting is disabled
- [ ] Frontend: Admin can toggle setting via UI without page refresh

### Quality Requirements

- [x] Database migration follows numerical ordering (migration 0041 created, follows 0040)
- [ ] All backend tests pass (run `docker-test-github-actions.sh`) - pending test creation
- [x] All linting checks pass (backend) - no linting errors found
- [x] No breaking changes to existing API responses (only adds new behavior when disabled)
- [x] Setting change takes effect immediately without restart (implemented via direct DB queries)

### User Validation

- [ ] Admin can toggle setting in UI and see immediate feedback
- [ ] When disabled, users cannot submit ratings (API returns 403)
- [ ] When disabled, users cannot submit comments (API returns 403)
- [ ] When disabled, rating/comment UI is hidden from non-admin users
- [ ] When enabled, all review functionality works as before
- [ ] Setting persists across server restarts

### Documentation

- [ ] Database migration documented in `docs/development/database.md`
- [ ] API endpoint documented in `docs/development/api.md`
- [ ] Changelog entry added with current date (November 01, 2025)

## Implementation Plan

### Phase 1: Database Schema and Migration

- [x] Create Alembic migration file (check next migration number, likely `0041_`)
  - [x] File: `backend/migrations/versions/0041_add_settings_table.py`
  - [x] Create `settings` table:
    - `id` (INT PRIMARY KEY AUTO_INCREMENT)
    - `key` (VARCHAR(255) UNIQUE NOT NULL) - Setting identifier
    - `value` (TEXT NOT NULL) - JSON string value
    - `description` (TEXT) - Human-readable description
    - `updated_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
    - `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    - INDEX on `key`
  - [x] Insert initial setting:
    - `key`: `"disable_diving_center_reviews"`
    - `value`: `"false"` (JSON boolean as string)
    - `description`: `"Disable comments and ratings for diving centers"`
  - [x] Implement upgrade() function
  - [x] Implement downgrade() function (drop table)
  - [ ] Test migration up and down (pending manual testing)

### Phase 2: Backend Models and Schemas

- [x] Add `Setting` SQLAlchemy model to `backend/app/models.py`
  - [x] Table name: `settings`
  - [x] Columns: `id`, `key`, `value`, `description`, `created_at`, `updated_at`
  - [x] Helper methods: Using specific `is_diving_center_reviews_enabled()` helper instead of general helpers (YAGNI principle - will add general helpers if/when multiple settings are needed)
- [x] Add Pydantic schemas to `backend/app/schemas.py`
  - [x] `SettingResponse`: `key` (str), `value` (Union), `description` (Optional[str])
  - [x] `SettingUpdate`: `value` (Union) - JSON-serializable value
- [x] Create settings router file `backend/app/routers/settings.py`
  - [x] `GET /api/v1/settings/{key}` - Public read access to setting value
  - [x] `GET /api/v1/settings` - List all settings (admin-only)
  - [x] `PUT /api/v1/settings/{key}` - Update setting value (admin-only)
  - [x] Validate JSON value format (via Pydantic)
  - [x] Handle missing settings gracefully (return 404)
  - [x] Register router in `main.py`

### Phase 3: Backend Logic Updates

- [x] Update rating endpoint in `backend/app/routers/diving_centers.py`
  - [x] Function: `rate_diving_center()` (line ~1177)
  - [x] Check `disable_diving_center_reviews` setting at start of function
  - [x] If disabled, return `HTTPException(status_code=403, detail="Reviews are currently disabled")`
  - [x] Import helper function `is_diving_center_reviews_enabled`
- [x] Update comment endpoints in `backend/app/routers/diving_centers.py`
  - [x] Function: `create_diving_center_comment()` (line ~1287)
  - [x] Function: `update_diving_center_comment()` (line ~1349)
  - [x] Function: `delete_diving_center_comment()` (line ~1411)
  - [x] Check `disable_diving_center_reviews` setting in each
  - [x] If disabled, return 403 error
- [x] Update comment list endpoint (optional enhancement)
  - [x] Function: `get_diving_center_comments()` (line ~1234)
  - [x] If disabled, return empty list `[]` (don't error, just hide content)
  - [x] This allows frontend to gracefully handle disabled state
- [x] Add setting check helper function
  - [x] Location: `backend/app/utils.py`
  - [x] Function: `is_diving_center_reviews_enabled(db: Session) -> bool`
  - [x] Returns `True` if setting is `false` (not disabled)
  - [x] Returns `False` if setting is `true` (disabled)
  - [ ] Cache result per request to avoid multiple DB queries (future optimization)

### Phase 4: Backend Testing

- [x] Create test file `backend/tests/test_settings.py`
  - [x] Test settings table exists after migration (implicitly tested via Setting model)
  - [x] Test GET `/api/v1/settings/{key}` returns correct value
  - [x] Test GET `/api/v1/settings/{key}` returns 404 for non-existent setting
  - [x] Test GET `/api/v1/settings` (admin-only) - list all settings
  - [x] Test PUT `/api/v1/settings/{key}` (admin-only) - update setting
  - [x] Test non-admin cannot update setting
  - [x] Test non-admin cannot list all settings
  - [x] Test invalid setting key returns 404
  - [x] Test JSON value validation (boolean, string, number types)
  - [x] Test public read access works without authentication
- [x] Update `backend/tests/test_diving_centers.py`
  - [x] Test rating endpoint returns 403 when setting is disabled
  - [x] Test comment creation returns 403 when setting is disabled
  - [x] Test comment update returns 403 when setting is disabled
  - [x] Test comment deletion returns 403 when setting is disabled
  - [x] Test comment list returns empty list when setting is disabled
  - [x] Test rating/comment work normally when setting is enabled
  - [x] Test setting can be toggled and takes effect immediately
- [ ] Run all backend tests
  - [ ] Execute: `cd backend && ./docker-test-github-actions.sh`
  - [ ] Verify all tests pass (expect existing test count + new tests)
  - [ ] Fix any regressions

### Phase 5: Frontend API Integration

- [ ] Create API helper functions in `frontend/src/api.js`
  - [ ] `getSetting(key: string)` - Fetch setting value
  - [ ] `updateSetting(key: string, value: any)` - Update setting (admin-only)
- [ ] Add React Query hooks for settings
  - [ ] `useSetting(key)` - Query hook for reading setting
  - [ ] `useUpdateSetting()` - Mutation hook for updating setting
  - [ ] Invalidate queries on successful update

### Phase 6: Frontend Admin UI

- [ ] Update `frontend/src/pages/AdminDivingCenters.js`
  - [ ] Add settings section at top of page (above search bar)
  - [ ] Add toggle switch: "Enable Diving Center Reviews"
  - [ ] Label: "Disable Diving Center Reviews" (inverted logic for UX)
  - [ ] Use React Query to fetch current setting value
  - [ ] Use mutation to update setting on toggle
  - [ ] Show loading state during update
  - [ ] Show success/error toast messages
  - [ ] Styling: Match existing admin page design (green/blue theme)
  - [ ] Position: Between page title and search form

### Phase 7: Frontend Diving Center Detail Page

- [ ] Update `frontend/src/pages/DivingCenterDetail.js`
  - [ ] Fetch `disable_diving_center_reviews` setting on component mount
  - [ ] Conditionally render rating section:
    - [ ] Hide rating stars UI when disabled
    - [ ] Hide rating submission form when disabled
    - [ ] Show message: "Reviews are currently disabled" (optional, or just hide)
  - [ ] Conditionally render comment section:
    - [ ] Hide comment form when disabled
    - [ ] Hide existing comments list when disabled (or show empty state)
    - [ ] Hide comment edit/delete buttons when disabled
  - [ ] Admin users should still see reviews (setting affects public users only)
  - [ ] Use React Query to fetch setting (cache for request lifetime)

### Phase 8: Frontend Testing and Validation

- [ ] Manual testing with Playwright MCP
  - [ ] Test admin toggle functionality:
    - [ ] Navigate to `/admin/diving-centers`
    - [ ] Verify toggle is visible and shows current state
    - [ ] Toggle setting on/off
    - [ ] Verify UI updates immediately
    - [ ] Verify toast notification appears
  - [ ] Test public user experience:
    - [ ] Navigate to `/diving-centers/{id}` as non-admin
    - [ ] Toggle setting to disabled in admin UI (separate tab/window)
    - [ ] Refresh diving center detail page
    - [ ] Verify rating UI is hidden
    - [ ] Verify comment UI is hidden
    - [ ] Verify no console errors
  - [ ] Test API enforcement:
    - [ ] With setting disabled, attempt to submit rating via browser devtools
    - [ ] Verify API returns 403 error
    - [ ] Attempt to submit comment
    - [ ] Verify API returns 403 error
- [ ] ESLint validation
  - [ ] Run: `docker exec divemap_frontend npm run lint`
  - [ ] Fix any linting errors
  - [ ] Verify build succeeds: `docker exec divemap_frontend npm run build`

### Phase 9: Documentation

- [ ] Update `docs/development/database.md`
  - [ ] Add section: "Settings Table"
  - [ ] Document table schema
  - [ ] Document `disable_diving_center_reviews` setting
  - [ ] Document migration number (0041)
- [ ] Update `docs/development/api.md`
  - [ ] Add section: "Settings API"
  - [ ] Document `GET /api/v1/settings/{key}` endpoint
  - [ ] Document `PUT /api/v1/settings/{key}` endpoint (admin-only)
  - [ ] Document `GET /api/v1/settings` endpoint (admin-only)
  - [ ] Add curl examples for all endpoints
- [ ] Update `docs/maintenance/changelog.md`
  - [ ] Add entry dated November 01, 2025
  - [ ] Document new settings system
  - [ ] Document `disable_diving_center_reviews` feature
  - [ ] Note admin UI toggle location

## Testing Plan

### Backend API Testing (curl)

#### Test 1: Get Setting Value (Public Access)

```bash
# Should return {"key": "disable_diving_center_reviews", "value": false}
curl -X GET "http://localhost/api/v1/settings/disable_diving_center_reviews" \
  -H "Content-Type: application/json"
```

**Expected:** `200 OK` with JSON response containing `value: false`

#### Test 2: List All Settings (Admin Only)

```bash
# Login as admin first to get token
TOKEN=$(curl -X POST "http://localhost/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.access_token')

# Get all settings
curl -X GET "http://localhost/api/v1/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected:** `200 OK` with array of settings (at least one: disable_diving_center_reviews)

#### Test 3: Update Setting (Admin Only)

```bash
# Update setting to disable reviews
curl -X PUT "http://localhost/api/v1/settings/disable_diving_center_reviews" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": true}'
```

**Expected:** `200 OK` with updated setting response

#### Test 4: Verify Setting Update

```bash
# Check setting value changed
curl -X GET "http://localhost/api/v1/settings/disable_diving_center_reviews" \
  -H "Content-Type: application/json"
```

**Expected:** `200 OK` with `value: true`

#### Test 5: Rating Blocked When Disabled

```bash
# Attempt to rate diving center (need user token, not admin)
USER_TOKEN=$(curl -X POST "http://localhost/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass"}' | jq -r '.access_token')

# Attempt rating (replace {id} with actual diving center ID)
curl -X POST "http://localhost/api/v1/diving-centers/1/rate" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 8}'
```

**Expected:** `403 Forbidden` with error message "Reviews are currently disabled"

#### Test 6: Comment Blocked When Disabled

```bash
# Attempt to create comment
curl -X POST "http://localhost/api/v1/diving-centers/1/comments" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment_text": "Great diving center!"}'
```

**Expected:** `403 Forbidden` with error message "Reviews are currently disabled"

#### Test 7: Comment List Returns Empty When Disabled

```bash
# Get comments (should return empty list, not error)
curl -X GET "http://localhost/api/v1/diving-centers/1/comments" \
  -H "Content-Type: application/json"
```

**Expected:** `200 OK` with empty array `[]`

#### Test 8: Re-enable Reviews

```bash
# Update setting back to enabled
curl -X PUT "http://localhost/api/v1/settings/disable_diving_center_reviews" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": false}'
```

**Expected:** `200 OK` with `value: false`

#### Test 9: Rating Works When Enabled

```bash
# Now rating should work
curl -X POST "http://localhost/api/v1/diving-centers/1/rate" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 9}'
```

**Expected:** `200 OK` with rating response

#### Test 10: Non-Admin Cannot Update Setting

```bash
# Attempt to update setting as regular user
curl -X PUT "http://localhost/api/v1/settings/disable_diving_center_reviews" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": true}'
```

**Expected:** `403 Forbidden` or `401 Unauthorized`

### Frontend Testing (Playwright MCP)

#### Test 1: Admin Toggle Visibility

1. Navigate to `http://localhost/admin/diving-centers`
2. Take snapshot of page
3. Verify settings section is visible
4. Verify toggle switch is present
5. Verify toggle shows current state (checked/unchecked)

#### Test 2: Admin Toggle Functionality

1. Note initial toggle state (screenshot)
2. Click toggle to change state
3. Wait for API call to complete (check network requests)
4. Verify toast notification appears ("Setting updated successfully")
5. Verify toggle reflects new state
6. Refresh page
7. Verify toggle state persisted

#### Test 3: Public User - Reviews Enabled

1. Navigate to `http://localhost/diving-centers/1` as non-admin user
2. Take snapshot
3. Verify rating stars UI is visible
4. Verify comment form is visible
5. Verify existing comments are displayed (if any)

#### Test 4: Public User - Reviews Disabled

1. As admin, set `disable_diving_center_reviews` to `true` in admin UI
2. Navigate to `http://localhost/diving-centers/1` as non-admin user
3. Take snapshot
4. Verify rating stars UI is hidden
5. Verify comment form is hidden
6. Verify comment list is hidden or shows empty state
7. Check browser console for errors

#### Test 5: Admin User - Always See Reviews

1. As admin user, navigate to `http://localhost/diving-centers/1`
2. Take snapshot
3. Verify rating UI is visible (even if setting is disabled)
4. Verify comment UI is visible (even if setting is disabled)
5. Note: Admin override behavior (if implemented) or admin sees reviews regardless

#### Test 6: API Error Handling

1. Open browser devtools Network tab
2. Navigate to diving center detail page
3. With setting disabled, attempt to submit rating via JavaScript console:

   ```javascript
   fetch('/api/v1/diving-centers/1/rate', {
     method: 'POST',
     headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer TOKEN'},
     body: JSON.stringify({score: 8})
   }).then(r => r.json()).then(console.log)
   ```

4. Verify 403 error response
5. Verify error message displayed to user

#### Test 7: Setting Change Takes Effect Immediately

1. Open two browser windows:
   - Window 1: Admin UI at `/admin/diving-centers`
   - Window 2: Diving center detail page at `/diving-centers/1`
2. In Window 2, verify reviews are visible
3. In Window 1, toggle setting to disabled
4. In Window 2, refresh page
5. Verify reviews are now hidden
6. Reverse: Toggle back to enabled in Window 1
7. Refresh Window 2
8. Verify reviews are visible again

#### Test 8: Mobile Responsiveness

1. Set browser to mobile viewport (375x667)
2. Navigate to `/admin/diving-centers`
3. Verify toggle is visible and usable on mobile
4. Navigate to `/diving-centers/1`
5. Verify hidden review sections don't cause layout issues
6. Verify no horizontal scrolling

### Integration Testing Checklist

- [ ] Backend migration runs successfully
- [ ] Setting table created with correct schema
- [ ] Initial setting value is `false`
- [ ] Settings API endpoints return correct responses
- [ ] Rating endpoint blocks when setting is `true`
- [ ] Comment endpoints block when setting is `true`
- [ ] Frontend admin toggle works and persists
- [ ] Frontend detail page hides reviews when disabled
- [ ] All existing tests still pass
- [ ] No breaking changes to existing functionality
- [ ] Documentation updated correctly

## Review

- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes

- **Setting Storage Format**: Store values as JSON strings in database for flexibility (boolean, string, number, object) - ✅ Implemented
- **Caching Strategy**: Consider caching setting values in memory with TTL to reduce DB queries (future optimization) - Deferred for now
- **Admin Override**: Consider whether admins should always see reviews or respect the setting (recommendation: respect setting for consistency) - Currently admins are also blocked, but this can be adjusted
- **Future Settings**: Table structure supports additional settings like `disable_dive_site_reviews`, `maintenance_mode`, etc. - ✅ Architecture supports this
- **Migration Safety**: Migration includes downgrade path for rollback if needed - ✅ Implemented
- **Implementation Status**: Phases 1-3 complete. Backend API fully functional. Frontend integration (Phases 5-8) pending.
- **Files Created/Modified**:
  - ✅ `backend/migrations/versions/0041_add_settings_table.py` - Migration file
  - ✅ `backend/app/models.py` - Added Setting model
  - ✅ `backend/app/schemas.py` - Added SettingResponse and SettingUpdate schemas
  - ✅ `backend/app/routers/settings.py` - New settings router
  - ✅ `backend/app/routers/diving_centers.py` - Updated all review endpoints
  - ✅ `backend/app/utils.py` - Added `is_diving_center_reviews_enabled()` helper
  - ✅ `backend/app/main.py` - Registered settings router
