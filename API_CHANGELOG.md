# API Changelog

This document tracks recent changes, bug fixes, and improvements to the Divemap API.

## Latest Changes (Latest Release)

### ✅ Added: Google OAuth Authentication

**Feature:** Complete Google OAuth 2.0 integration for secure authentication.

**Implementation:**
- **New Endpoint**: `POST /api/v1/auth/google-login`
- **Token Verification**: Backend verifies Google ID tokens with Google's servers
- **User Management**: Automatic user creation and account linking
- **Security**: Rate limiting and proper error handling

**Request Format:**
```json
{
  "token": "google_id_token_from_frontend"
}
```

**Response Format:**
```json
{
  "access_token": "jwt_token_for_authenticated_user",
  "token_type": "bearer"
}
```

**Database Changes:**
- Added `google_id` field to users table
- Created index for efficient Google ID lookups
- Migration script provided in `backend/migrations/add_google_id.sql`

**Security Features:**
- Token verification with Google's servers
- Rate limiting on OAuth endpoints
- Account linking by email address
- Unique username generation for Google users

**Files Added:**
- `backend/app/google_auth.py` - Google OAuth utility functions
- `backend/migrations/add_google_id.sql` - Database migration
- `frontend/src/utils/googleAuth.js` - Frontend Google OAuth utility
- `GOOGLE_OAUTH_SETUP.md` - Complete setup guide

**Files Modified:**
- `backend/app/models.py` - Added google_id field to User model
- `backend/app/routers/auth.py` - Added Google OAuth endpoint
- `backend/requirements.txt` - Added Google OAuth dependencies
- `frontend/src/contexts/AuthContext.js` - Added Google OAuth methods
- `frontend/src/pages/Login.js` - Added Google Sign-In button
- `frontend/src/pages/Register.js` - Added Google Sign-Up button

### ✅ Added: Mass Delete Functionality

**Feature:** Bulk delete operations for admin management pages.

**Implementation:**
- **Select Multiple Items**: Checkbox selection for bulk operations
- **Confirmation Dialogs**: Clear confirmation with item names
- **Safety Features**: Protection against deleting used tags and self-deletion
- **Visual Feedback**: Loading states and success/error messages

**Admin Pages Updated:**
- `/admin/dive-sites` - Mass delete dive sites
- `/admin/diving-centers` - Mass delete diving centers  
- `/admin/tags` - Mass delete tags (with protection for used tags)
- `/admin/users` - Mass delete users (with self-deletion protection)

**Safety Features:**
- Tags with associated dive sites cannot be deleted
- Users cannot delete their own accounts
- Clear confirmation dialogs with item names
- Proper error handling and rollback

**Files Modified:**
- `frontend/src/pages/AdminDiveSites.js` - Added mass delete functionality
- `frontend/src/pages/AdminDivingCenters.js` - Added mass delete functionality
- `frontend/src/pages/AdminTags.js` - Added mass delete with protection
- `frontend/src/pages/AdminUsers.js` - Added mass delete with self-protection

### ✅ Fixed: Frontend Create Pages

**Issue:** Admin create pages for dive sites and diving centers showed empty pages.

**Root Cause:** Admin pages had "Add" buttons that navigated to `/admin/dive-sites/create` and `/admin/diving-centers/create`, but these routes didn't exist in React Router configuration.

**Solution:** Created comprehensive create forms and added proper routes:
```javascript
// Added routes in App.js
<Route path="/admin/dive-sites/create" element={<CreateDiveSite />} />
<Route path="/admin/diving-centers/create" element={<CreateDivingCenter />} />
```

**Features Implemented:**
- **CreateDiveSite.js**: Comprehensive form with all dive site fields including:
  - Basic information (name, description, difficulty level)
  - Location data (latitude, longitude, address)
  - Dive-specific information (access instructions, gas tanks, dive plans)
  - Marine life and safety information
- **CreateDivingCenter.js**: Comprehensive form with all diving center fields including:
  - Basic information (name, description, email)
  - Contact information (phone, website)
  - Location data (latitude, longitude, address)
- **Form Validation**: Client-side validation with required fields
- **API Integration**: Proper POST requests with error handling
- **User Experience**: Responsive design with proper navigation

**Files Created:**
- `frontend/src/pages/CreateDiveSite.js` - New comprehensive create form
- `frontend/src/pages/CreateDivingCenter.js` - New comprehensive create form
- `frontend/src/App.js` - Added routes and imports

### ✅ Fixed: Dive Sites API Serialization Issues

**Issue:** The `/api/v1/dive-sites/` endpoint was returning 500 Internal Server Error due to improper tag serialization.

**Root Cause:** AvailableTag SQLAlchemy model objects were being returned directly in API responses instead of being converted to dictionaries.

**Solution:** Updated tag serialization in all dive sites endpoints:
```python
# Before (causing 500 errors)
"tags": tags  # SQLAlchemy model objects

# After (fixed)
tags_dict = [
    {
        "id": tag.id,
        "name": tag.name,
        "description": tag.description,
        "created_by": tag.created_by,
        "created_at": tag.created_at
    }
    for tag in tags
]
"tags": tags_dict  # Properly serialized dictionaries
```

**Files Modified:**
- `backend/app/routers/dive_sites.py` - Updated tag serialization in:
  - `get_dive_sites()` function
  - `get_dive_site()` function  
  - `update_dive_site()` function
  - `create_dive_site()` function (added empty tags array)

### ✅ Fixed: Difficulty Level Validation

**Issue:** Dive sites with 'expert' difficulty level were causing validation errors.

**Root Cause:** Database contained dive sites with `difficulty_level = 'expert'`, but the API schema only allowed 'beginner', 'intermediate', or 'advanced'.

**Solution:** Updated all difficulty level patterns to include 'expert':
```python
# Before
difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced)$")

# After  
difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
```

**Files Modified:**
- `backend/app/schemas.py` - Updated patterns in:
  - `DiveSiteBase` class
  - `DiveSiteUpdate` class
  - `DiveSiteSearchParams` class
- `backend/app/routers/dive_sites.py` - Updated query parameter validation

### ✅ Fixed: Tag Model Field Mapping

**Issue:** Code was trying to access non-existent 'category' field on AvailableTag model.

**Root Cause:** The AvailableTag model only has fields: `id`, `name`, `description`, `created_by`, `created_at` - but code was trying to access `tag.category`.

**Solution:** Removed references to non-existent 'category' field and used actual model fields.

**Files Modified:**
- `backend/app/routers/dive_sites.py` - Fixed tag dictionary creation

### ✅ Fixed: Admin Authentication Issues

**Issue:** Admin user could not log in with default credentials.

**Root Cause:** Password requirements were updated to require uppercase and special characters, but the default admin password didn't meet these requirements.

**Solution:** Updated admin password to meet new requirements and created a script to update existing admin passwords.

**Files Modified:**
- `backend/update_admin_password.py` - Temporary script to update admin password
- Database admin user password hash updated

### ✅ Fixed: Docker Dependencies

**Issue:** Backend container failed to start with `ModuleNotFoundError: No module named 'slowapi'`.

**Root Cause:** Docker image needed to be rebuilt to include the latest requirements.txt changes.

**Solution:** Rebuilt Docker image and restarted containers:
```bash
docker-compose build backend
docker-compose down && docker-compose up -d
```

## API Response Format Changes

### Google OAuth Authentication

**New Endpoint:** `POST /api/v1/auth/google-login`

**Request:**
```json
{
  "token": "google_id_token_from_frontend"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_for_authenticated_user",
  "token_type": "bearer"
}
```

**Error Responses:**
```json
{
  "detail": "Invalid Google token"
}
```

### User Model Updates

**Database Schema Changes:**
- Added `google_id` field (VARCHAR(255), UNIQUE, NULLABLE)
- Created index for efficient Google ID lookups

**User Creation from Google OAuth:**
- Automatic user creation from Google data
- Username generation from Google name or email
- Account linking for existing users by email
- Google users are enabled by default (no admin approval required)

### Dive Sites Response

**Before:** Tags were returned as SQLAlchemy model objects causing serialization errors.

**After:** Tags are properly serialized as dictionaries:
```json
{
  "id": 1,
  "name": "Dive Site Name",
  "description": "Description",
  "latitude": 12.3456,  // Now returned as number instead of string
  "longitude": -78.9012,  // Now returned as number instead of string
  "difficulty_level": "expert",  // Now supports 'expert'
  "tags": [
    {
      "id": 1,
      "name": "Coral Reef",
      "description": "Beautiful coral formations",
      "created_by": 1,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "average_rating": 8.5,
  "total_ratings": 10
}
```

### Data Type Changes

**Latitude/Longitude Format:**
- **Before:** Returned as strings (e.g., `"12.3456"`)
- **After:** Returned as numbers (e.g., `12.3456`)

This change improves frontend performance by eliminating the need for `Number()` conversion and reduces the risk of type conversion errors.

## Testing Updates

### New Test Cases Added

1. **Google OAuth Testing**: Verify Google token verification and user creation
2. **Mass Delete Testing**: Test bulk operations with safety features
3. **Tag Serialization Testing**: Verify tags are returned as dictionaries, not model objects
4. **Difficulty Level Validation**: Test that 'expert' difficulty level is accepted
5. **Response Validation**: Ensure all dive site endpoints return valid JSON
6. **Admin Authentication**: Test admin login with updated password requirements

### Updated Test Data

- Updated test dive sites to include 'expert' difficulty level
- Fixed test tag data to match actual model fields
- Updated admin password in test fixtures
- Added Google OAuth test scenarios

## Migration Notes

### For Developers

1. **Google OAuth Setup**: Follow `GOOGLE_OAUTH_SETUP.md` for complete configuration
2. **Database Migration**: Run the Google ID migration script
3. **Tag Handling**: When working with dive site tags, always expect dictionaries with fields: `id`, `name`, `description`, `created_by`, `created_at`
4. **Difficulty Levels**: The API now supports four difficulty levels: 'beginner', 'intermediate', 'advanced', 'expert'
5. **Admin Access**: Default admin credentials may have changed - check with system administrator

### For Frontend

1. **Google OAuth**: Implement Google Sign-In buttons using Google Identity Services
2. **Mass Delete**: Add checkbox selection and bulk delete functionality
3. **Tag Display**: Tags are now properly serialized and can be displayed directly
4. **Difficulty Filtering**: Frontend can now filter by 'expert' difficulty level
5. **Error Handling**: 500 errors on dive sites endpoint should be resolved
6. **Latitude/Longitude**: Now returned as numbers instead of strings - no need for `Number()` conversion

## Performance Impact

- **Positive**: Fixed 500 errors improve API reliability
- **Minimal**: Tag serialization adds small overhead but improves data consistency
- **Google OAuth**: Adds secure authentication without performance impact
- **Mass Delete**: Efficient bulk operations with proper error handling
- **No Breaking Changes**: All existing functionality preserved

## Security Notes

- **Google OAuth**: Secure token verification with Google's servers
- **Rate Limiting**: OAuth endpoints have rate limiting protection
- **Account Security**: Google users are enabled by default but can be managed
- **Mass Delete Safety**: Protection against deleting used tags and self-deletion
- No security vulnerabilities were introduced
- All existing authentication and authorization mechanisms remain intact
- Input validation patterns updated to be more permissive (added 'expert' difficulty)

## Future Considerations

1. **Google OAuth Enhancements**: Consider additional OAuth providers (Facebook, GitHub, etc.)
2. **Tag Categories**: If tag categories are needed in the future, add a `category` field to the AvailableTag model
3. **Difficulty Levels**: Consider if additional difficulty levels are needed
4. **Serialization**: Consider using Pydantic's `from_attributes = True` for automatic model serialization
5. **Mass Operations**: Consider adding bulk update and bulk create functionality 