# API Changelog

This document tracks recent changes, bug fixes, and improvements to the Divemap API.

## Latest Changes (Latest Release)

### ✅ Added: Database Migration System (Alembic)

**Feature:** Complete Alembic integration for version-controlled database schema management.

**Implementation:**
- **Automatic Migration Execution**: Migrations run before application startup
- **Environment Compatibility**: Works with both development and Docker environments
- **Health Checks**: Database availability verification before migration execution
- **Rollback Support**: Full migration history with downgrade capabilities
- **Python Path Fixes**: Resolved asdf Python environment compatibility issues

**Migration Workflow:**
```bash
# Development environment
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Run migrations
python run_migrations.py

# Create new migration
python create_migration.py "Description of changes"

# Check migration status
alembic current
alembic history
```

**Docker Integration:**
- Migrations run automatically before backend startup
- Database health checks ensure availability
- Error handling and recovery procedures

**Files Added:**
- `backend/alembic.ini` - Alembic configuration
- `backend/migrations/env.py` - Environment configuration
- `backend/migrations/script.py.mako` - Migration template
- `backend/migrations/versions/0001_initial.py` - Initial database schema
- `backend/run_migrations.py` - Migration execution script
- `backend/create_migration.py` - Migration generation script
- `backend/run_migrations_docker.sh` - Docker migration script
- `backend/MIGRATIONS_README.md` - User guide for migrations
- `backend/ALEMBIC_SETUP.md` - Comprehensive setup documentation

**Files Modified:**
- `backend/app/database.py` - Added `get_database_url()` function
- `backend/requirements.txt` - Added Alembic dependency
- `backend/Dockerfile` - Updated to run migrations before startup

**Migration Best Practices:**
- Always review auto-generated migrations
- Test migrations on development database first
- Backup production database before migrations
- Use descriptive migration names
- Handle dependencies between migrations

**Security Features:**
- Environment variable configuration
- Database connection validation
- Error handling and logging
- Rollback capabilities for failed migrations

### ✅ Added: Multi-Currency Support System

**Feature:** Comprehensive currency system supporting the top 10 world currencies with Euro (€) as default.

**Implementation:**
- **Supported Currencies**: USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, NZD
- **Default Currency**: Euro (€) is the default currency for all cost fields
- **Currency Symbols**: Proper display with currency symbols and flags
- **Flexible Input**: Users can submit costs in any supported currency
- **Visual Formatting**: Automatic formatting with symbols, flags, and codes

**Database Changes:**
- Added `currency` field to `center_dive_sites` table (VARCHAR(3), default 'EUR')
- Added `currency` field to `gear_rental_costs` table (VARCHAR(3), default 'EUR')
- Created indexes for currency fields for better performance
- Migration script provided in `database/add_currency_fields.sql`

**API Endpoint Updates:**
- **POST** `/api/v1/dive-sites/{id}/diving-centers` - Now accepts `currency` field
- **GET** `/api/v1/dive-sites/{id}/diving-centers` - Now returns `currency` field
- **POST** `/api/v1/diving-centers/{id}/gear-rental` - Now accepts `currency` field
- **GET** `/api/v1/diving-centers/{id}/gear-rental` - Now returns `currency` field

**Frontend Enhancements:**
- **Currency Utility**: `frontend/src/utils/currency.js` with comprehensive currency functions
- **EditDiveSite**: Added currency dropdown when adding diving centers
- **EditDivingCenter**: Added currency selection for gear rental costs
- **DiveSiteDetail**: Updated to display costs with proper currency symbols
- **Currency Formatting**: Automatic formatting with symbols, flags, and codes

**Currency Utility Functions:**
- `formatCost()`: Formats costs with currency symbols
- `getCurrencyOptions()`: Provides dropdown options with flags and names
- `getCurrencyInfo()`: Retrieves currency information by code
- `isValidCurrency()`: Validates currency codes
- `getDefaultCurrency()`: Returns default currency info

**Supported Currencies with Symbols:**
- 🇺🇸 USD (US Dollar) - $
- 🇪🇺 EUR (Euro) - € (default)
- 🇯🇵 JPY (Japanese Yen) - ¥
- 🇬🇧 GBP (British Pound) - £
- 🇨🇳 CNY (Chinese Yuan) - ¥
- 🇦🇺 AUD (Australian Dollar) - A$
- 🇨🇦 CAD (Canadian Dollar) - C$
- 🇨🇭 CHF (Swiss Franc) - CHF
- 🇭🇰 HKD (Hong Kong Dollar) - HK$
- 🇳🇿 NZD (New Zealand Dollar) - NZ$

**Files Added:**
- `frontend/src/utils/currency.js` - Comprehensive currency utility functions
- `database/add_currency_fields.sql` - Database migration script

**Files Modified:**
- `backend/app/models.py` - Added currency fields to CenterDiveSite and GearRentalCost models
- `backend/app/schemas.py` - Added currency fields with validation to schemas
- `backend/app/routers/dive_sites.py` - Updated endpoints to handle currency
- `backend/app/routers/diving_centers.py` - Updated gear rental endpoints
- `frontend/src/pages/EditDiveSite.js` - Added currency selection for diving centers
- `frontend/src/pages/EditDivingCenter.js` - Added currency selection for gear rental
- `frontend/src/pages/DiveSiteDetail.js` - Updated cost display with currency formatting

**Security Features:**
- Currency code validation (3-letter ISO format)
- Graceful handling of unsupported currencies
- Input sanitization and validation
- No breaking changes to existing functionality

### ✅ Added: Google OAuth Authentication

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

### Currency Support

**New Fields in Responses:**
- `currency` field added to diving center associations and gear rental costs
- Default value is "EUR" for all existing records
- Currency codes follow ISO 4217 standard (3-letter codes)

**Diving Center Association Response:**
```json
{
  "id": 1,
  "name": "Diving Center Name",
  "description": "Description",
  "email": "info@divingcenter.com",
  "phone": "+1234567890",
  "website": "www.divingcenter.com",
  "latitude": 12.3456,
  "longitude": -78.9012,
  "dive_cost": 150.00,
  "currency": "EUR"
}
```

**Gear Rental Cost Response:**
```json
{
  "id": 1,
  "diving_center_id": 1,
  "item_name": "Full Set",
  "cost": 50.00,
  "currency": "USD",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Request Format for Adding Diving Centers:**
```json
{
  "diving_center_id": 1,
  "dive_cost": 150.00,
  "currency": "EUR"
}
```

**Request Format for Adding Gear Rental:**
```json
{
  "item_name": "Full Set",
  "cost": 50.00,
  "currency": "USD"
}
```

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

1. **Currency System Testing**: Verify currency storage, retrieval, and formatting
2. **Multi-Currency Support**: Test all 10 supported currencies (USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, NZD)
3. **Currency Validation**: Test currency code validation and error handling
4. **Default Currency**: Verify Euro (€) is properly set as default
5. **Frontend Currency Display**: Test currency symbol and flag display
6. **Google OAuth Testing**: Verify Google token verification and user creation
7. **Mass Delete Testing**: Test bulk operations with safety features
8. **Tag Serialization Testing**: Verify tags are returned as dictionaries, not model objects
9. **Difficulty Level Validation**: Test that 'expert' difficulty level is accepted
10. **Response Validation**: Ensure all dive site endpoints return valid JSON
11. **Admin Authentication**: Test admin login with updated password requirements

### Updated Test Data

- Updated test dive sites to include 'expert' difficulty level
- Fixed test tag data to match actual model fields
- Updated admin password in test fixtures
- Added Google OAuth test scenarios

## Migration Notes

### For Developers

1. **Currency System Setup**: Run the currency migration script: `database/add_currency_fields.sql`
2. **Currency Validation**: All currency codes must be 3-letter ISO format (e.g., 'USD', 'EUR', 'JPY')
3. **Default Currency**: Euro (€) is the default currency for all cost fields
4. **Google OAuth Setup**: Follow `GOOGLE_OAUTH_SETUP.md` for complete configuration
5. **Database Migration**: Run the Google ID migration script
6. **Tag Handling**: When working with dive site tags, always expect dictionaries with fields: `id`, `name`, `description`, `created_by`, `created_at`
7. **Difficulty Levels**: The API now supports four difficulty levels: 'beginner', 'intermediate', 'advanced', 'expert'
8. **Admin Access**: Default admin credentials may have changed - check with system administrator

### For Frontend

1. **Currency System**: Import and use currency utility functions from `frontend/src/utils/currency.js`
2. **Currency Display**: Use `formatCost()` function to display costs with proper currency symbols
3. **Currency Selection**: Use `getCurrencyOptions()` for dropdown menus with flags and names
4. **Default Currency**: Euro (€) is automatically selected for new cost entries
5. **Google OAuth**: Implement Google Sign-In buttons using Google Identity Services
6. **Mass Delete**: Add checkbox selection and bulk delete functionality
7. **Tag Display**: Tags are now properly serialized and can be displayed directly
8. **Difficulty Filtering**: Frontend can now filter by 'expert' difficulty level
9. **Error Handling**: 500 errors on dive sites endpoint should be resolved
10. **Latitude/Longitude**: Now returned as numbers instead of strings - no need for `Number()` conversion

## Performance Impact

- **Positive**: Fixed 500 errors improve API reliability
- **Currency System**: Minimal overhead with improved user experience
- **Currency Indexes**: Database indexes improve query performance for currency fields
- **Minimal**: Tag serialization adds small overhead but improves data consistency
- **Google OAuth**: Adds secure authentication without performance impact
- **Mass Delete**: Efficient bulk operations with proper error handling
- **No Breaking Changes**: All existing functionality preserved

## Security Notes

- **Currency Validation**: Currency codes are validated to prevent injection attacks
- **Input Sanitization**: Currency inputs are properly sanitized and validated
- **Google OAuth**: Secure token verification with Google's servers
- **Rate Limiting**: OAuth endpoints have rate limiting protection
- **Account Security**: Google users are enabled by default but can be managed
- **Mass Delete Safety**: Protection against deleting used tags and self-deletion
- No security vulnerabilities were introduced
- All existing authentication and authorization mechanisms remain intact
- Input validation patterns updated to be more permissive (added 'expert' difficulty)

## Future Considerations

1. **Currency Enhancements**: Consider adding currency conversion rates and real-time exchange rates
2. **Additional Currencies**: Consider adding more currencies based on user demand
3. **Currency Preferences**: Consider user-specific currency preferences and settings
4. **Google OAuth Enhancements**: Consider additional OAuth providers (Facebook, GitHub, etc.)
5. **Tag Categories**: If tag categories are needed in the future, add a `category` field to the AvailableTag model
6. **Difficulty Levels**: Consider if additional difficulty levels are needed
7. **Serialization**: Consider using Pydantic's `from_attributes = True` for automatic model serialization
8. **Mass Operations**: Consider adding bulk update and bulk create functionality 