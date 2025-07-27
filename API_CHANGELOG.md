# API Changelog

This document tracks recent changes, bug fixes, and improvements to the Divemap API.

## Latest Changes (2025-07-27)

### ✅ Fixed: API Endpoint Consistency Issues

**Issue:** Frontend API calls were using inconsistent trailing slashes, causing 307 redirects and authentication failures.

**Root Cause:** FastAPI's routing behavior expects specific trailing slash patterns:
- List endpoints: `/api/v1/resource/` (with trailing slash)
- Individual endpoints: `/api/v1/resource/{id}` (without trailing slash)

**Solution:** Fixed all frontend API calls to match backend expectations.

**API Endpoint Fixes:**

**Authentication Endpoints:**
- **Fixed:** `/api/v1/auth/me/` → `/api/v1/auth/me`
- **Fixed:** `/api/v1/auth/login` (no change needed)
- **Fixed:** `/api/v1/auth/register` (no change needed)

**Tags Endpoints:**
- **Fixed:** `/api/v1/tags/with-counts/` → `/api/v1/tags/with-counts`
- **Fixed:** `/api/v1/tags/` (list endpoint - trailing slash correct)
- **Fixed:** `/api/v1/tags/{id}` (individual endpoint - no trailing slash)

**Users Endpoints:**
- **Fixed:** `/api/v1/users/admin/users/` → `/api/v1/users/admin/users`
- **Fixed:** `/api/v1/users/admin/users/{id}` (no change needed)

**Dive Sites Endpoints:**
- **Fixed:** `/api/v1/dive-sites/` (list endpoint - trailing slash correct)
- **Fixed:** `/api/v1/dive-sites/{id}` (individual endpoint - no trailing slash)
- **Fixed:** `/api/v1/dive-sites/{id}/comments/` → `/api/v1/dive-sites/{id}/comments`
- **Fixed:** `/api/v1/dive-sites/{id}/media/` → `/api/v1/dive-sites/{id}/media`
- **Fixed:** `/api/v1/dive-sites/{id}/nearby/` → `/api/v1/dive-sites/{id}/nearby`
- **Fixed:** `/api/v1/dive-sites/reverse-geocode/` → `/api/v1/dive-sites/reverse-geocode`

**Diving Centers Endpoints:**
- **Fixed:** `/api/v1/diving-centers/` (list endpoint - trailing slash correct)
- **Fixed:** `/api/v1/diving-centers/{id}` (individual endpoint - no trailing slash)
- **Fixed:** `/api/v1/diving-centers/{id}/comments/` → `/api/v1/diving-centers/{id}/comments`
- **Fixed:** `/api/v1/diving-centers/{id}/gear-rental/` → `/api/v1/diving-centers/{id}/gear-rental`

**Files Modified:**
- `frontend/src/contexts/AuthContext.js` - Fixed `/api/v1/auth/me` endpoint
- `frontend/src/pages/AdminTags.js` - Fixed `/api/v1/tags/with-counts` endpoint
- `frontend/src/pages/AdminUsers.js` - Fixed `/api/v1/users/admin/users` endpoint
- `frontend/src/pages/DiveSites.js` - Fixed list endpoint calls
- `frontend/src/pages/DivingCenters.js` - Fixed list endpoint calls
- `frontend/src/pages/Home.js` - Fixed list endpoint calls
- `frontend/src/pages/AdminDiveSites.js` - Fixed list endpoint calls
- `frontend/src/pages/AdminDivingCenters.js` - Fixed list endpoint calls
- `frontend/src/pages/DiveSiteDetail.js` - Fixed individual and sub-resource endpoints
- `frontend/src/pages/DivingCenterDetail.js` - Fixed individual and sub-resource endpoints
- `frontend/src/pages/EditDiveSite.js` - Fixed individual and sub-resource endpoints
- `frontend/src/pages/EditDivingCenter.js` - Fixed individual and sub-resource endpoints
- `frontend/src/pages/CreateDiveSite.js` - Fixed sub-resource endpoints
- `frontend/src/pages/DiveSiteMap.js` - Fixed individual and sub-resource endpoints

### ✅ Fixed: Database Query Optimization

**Issue:** `/api/v1/tags/with-counts` endpoint was causing internal server errors due to complex SQL joins.

**Root Cause:** Complex query with `func.count()` and `outerjoin()` was not working properly with the database setup.

**Solution:** Simplified the query to use separate queries for better reliability.

**Before (Complex Query):**
```python
tags_with_counts = db.query(
    AvailableTag,
    func.count(DiveSiteTag.dive_site_id).label('dive_site_count')
).outerjoin(DiveSiteTag, AvailableTag.id == DiveSiteTag.tag_id).group_by(AvailableTag.id).all()
```

**After (Simplified Query):**
```python
# Get all tags
tags = db.query(AvailableTag).all()

result = []
for tag in tags:
    # Count associated dive sites for this tag
    dive_site_count = db.query(DiveSiteTag).filter(DiveSiteTag.tag_id == tag.id).count()
    
    tag_dict = {
        "id": tag.id,
        "name": tag.name,
        "description": tag.description,
        "created_by": tag.created_by,
        "created_at": tag.created_at,
        "dive_site_count": dive_site_count
    }
    result.append(tag_dict)
```

**Files Modified:**
- `backend/app/routers/tags.py` - Simplified `/with-counts` query

### ✅ Added: Production Deployment Configuration

**Feature:** Complete production deployment setup with Fly.io.

**New Configuration Files:**
- `backend/fly.toml` - Backend deployment configuration
- `frontend/fly.toml` - Frontend deployment configuration
- `database/fly.toml` - Database deployment configuration
- `backend/Dockerfile` - Backend container configuration
- `frontend/Dockerfile` - Frontend container configuration
- `FLY_DEPLOYMENT_GUIDE.md` - Comprehensive deployment documentation

**Environment Variables:**
- **Backend:** `DATABASE_URL`, `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Frontend:** `REACT_APP_API_URL`, `REACT_APP_GOOGLE_CLIENT_ID`
- **Database:** `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`

**Deployment URLs:**
- **Frontend:** https://divemap.fly.dev
- **Backend:** https://divemap-backend.fly.dev
- **Database:** Internal network only

**CORS Configuration:**
```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://divemap.fly.dev",
        "https://divemap-frontend.fly.dev",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)
```

### ✅ Added: Sample Database Content

**Feature:** Added comprehensive sample tags to populate the admin interface.

**Sample Tags Added (20 total):**
- Coral Reef, Wreck, Wall, Cave, Drift, Shark, Manta Ray, Turtle
- Deep, Shallow, Night, Photography, Training, Advanced, Beginner
- Current, Clear Water, Marine Life, Historical, Remote

**Database Improvements:**
- **Query Optimization:** Simplified complex queries to avoid errors
- **Error Handling:** Better error handling for database operations
- **Performance:** Improved query performance with proper indexing

**Files Added:**
- `export_database_data.py` - Script to export current database data

**Files Modified:**
- `database/init.sql` - Updated schema with all new fields

### ✅ Fixed: Google OAuth Conditional Rendering

**Issue:** Google OAuth button showed `client_id=undefined` when not configured.

**Solution:** Added conditional rendering to only show Google OAuth when properly configured.

**Implementation:**
```javascript
// Conditional rendering in Login/Register pages
{process.env.REACT_APP_GOOGLE_CLIENT_ID && 
 process.env.REACT_APP_GOOGLE_CLIENT_ID !== 'undefined' && (
  // Google Sign-In button section
)}

// Client ID validation in googleAuth utility
if (!this.clientId || this.clientId === 'undefined') {
  throw new Error('Google OAuth client ID not configured');
}
```

**Files Modified:**
- `frontend/src/pages/Login.js` - Added conditional Google OAuth rendering
- `frontend/src/pages/Register.js` - Added conditional Google OAuth rendering
- `frontend/src/utils/googleAuth.js` - Added client ID validation

### ✅ Fixed: Authentication Flow Issues

**Issue:** Users were logged out immediately after successful login.

**Root Cause:** Frontend was calling `/api/v1/auth/me/` (with trailing slash) but backend expected `/api/v1/auth/me` (without trailing slash).

**Solution:** Fixed the API endpoint call in AuthContext.

**Before:**
```javascript
const response = await api.get('/api/v1/auth/me/');
```

**After:**
```javascript
const response = await api.get('/api/v1/auth/me');
```

**Files Modified:**
- `frontend/src/contexts/AuthContext.js` - Fixed `/api/v1/auth/me` endpoint

### ✅ Fixed: Admin Page Authentication

**Issue:** Admin pages were not displaying content due to authentication and API endpoint issues.

**Solutions:**
1. **Fixed API Endpoints:** Corrected all admin page API calls
2. **Added Sample Data:** Populated database with sample tags
3. **Fixed Backend Queries:** Resolved internal server errors
4. **Improved Error Handling:** Better error handling for admin operations

**Admin Pages Fixed:**
- `/admin/tags` - Now displays 20 sample tags with dive site counts
- `/admin/users` - Now displays users with proper authentication

**Files Modified:**
- `frontend/src/pages/AdminTags.js` - Fixed API calls and error handling
- `frontend/src/pages/AdminUsers.js` - Fixed API calls and error handling
- `backend/app/routers/tags.py` - Fixed query optimization

---

## Previous Changes (Latest Release)

### ✅ Added: Country and Region Fields with Geocoding

**Feature:** Added country and region fields to dive sites with automatic geocoding support.

**New Fields Added:**
- **`country`**: Country name (VARCHAR(100), optional, indexed)
- **`region`**: Region/state/province name (VARCHAR(100), optional, indexed)

**Database Changes:**
- Added `country` column to `dive_sites` table (VARCHAR(100), nullable)
- Added `region` column to `dive_sites` table (VARCHAR(100), nullable)
- Created indexes for performance: `ix_dive_sites_country`, `ix_dive_sites_region`
- Migration: `backend/migrations/versions/0003_add_country_region_fields.py`

**New API Endpoint:**
- **GET** `/api/v1/dive-sites/reverse-geocode` - Get country/region suggestions from coordinates

**Request Parameters:**
- `latitude` (float, required): Latitude coordinate (-90 to 90)
- `longitude` (float, required): Longitude coordinate (-180 to 180)

**Response Format:**
```json
{
  "country": "Iceland",
  "region": "Bláskógabyggð",
  "full_address": "Bláskógabyggð, Southern Region, Iceland"
}
```

**Error Responses:**
```json
{
  "detail": "Geocoding service timeout. Please try again later."
}
```

**Updated API Endpoints:**
- **GET** `/api/v1/dive-sites/` - Added `country` and `region` query parameters for filtering
- **POST** `/api/v1/dive-sites/` - Now accepts `country` and `region` fields
- **PUT** `/api/v1/dive-sites/{id}` - Now accepts `country` and `region` fields
- **GET** `/api/v1/dive-sites/{id}` - Now returns `country` and `region` fields

**Geocoding Features:**
- **OpenStreetMap Integration**: Uses Nominatim API for reverse geocoding
- **Rate Limiting**: 50 requests per minute to respect API limits
- **Error Handling**: Comprehensive error handling with fallback location detection
- **Fallback System**: Provides basic location data when geocoding service is unavailable
- **User-Agent Header**: Proper identification as required by Nominatim API

**Frontend Enhancements:**
- **Filter UI**: Country and region filters in dive sites list
- **Edit Forms**: Country and region input fields with "Suggest from Coordinates" button
- **Create Forms**: Same functionality for new dive site creation
- **Responsive Design**: Filters work on all screen sizes

**Files Modified:**
- `backend/app/models.py` - Added country and region fields to DiveSite model
- `backend/app/schemas.py` - Added country and region to all dive site schemas
- `backend/app/routers/dive_sites.py` - Added reverse geocoding endpoint and filtering
- `frontend/src/pages/DiveSites.js` - Added country and region filters
- `frontend/src/pages/CreateDiveSite.js` - Added country/region fields and geocoding
- `frontend/src/pages/EditDiveSite.js` - Added country/region fields and geocoding

**Testing:**
- All backend tests pass (56/56)
- Frontend validation passes
- API endpoints working correctly
- Geocoding functionality working
- Authentication properly enforced

### ✅ Fixed: Dive Site Update Cache Issue

**Issue:** After saving dive site changes, users saw "Dive site not found" error.

**Root Cause:** React Query cache not properly updated before navigation to dive site detail page.

**Solution:** Improved cache management with immediate data updates and proper invalidation.

**Technical Fix:**
```javascript
// Before: Simple invalidation and navigation
await queryClient.invalidateQueries(['dive-site', id]);
navigate(`/dive-sites/${id}`);

// After: Proper cache update and invalidation
queryClient.setQueryData(['dive-site', id], updatedDiveSite);
await queryClient.invalidateQueries(['admin-dive-sites']);
await queryClient.invalidateQueries(['dive-sites']);
await new Promise(resolve => setTimeout(resolve, 100));
navigate(`/dive-sites/${id}`);
```

**Files Modified:**
- `frontend/src/pages/EditDiveSite.js` - Fixed update mutation and cache management
- `frontend/src/pages/DiveSiteDetail.js` - Added debugging and better error handling

**User Experience:**
- Seamless navigation after updates without errors
- Proper loading states and error messages
- Better debugging information in console

### ✅ Added: New Dive Site Fields and Validation Improvements

**Feature:** Added new fields to dive sites and improved validation for mandatory fields.

**New Fields Added:**
- **`max_depth`**: Maximum depth in meters (DECIMAL(5,2), optional)
- **`alternative_names`**: Alternative names/aliases for dive sites (TEXT, optional)

**Database Changes:**
- Added `max_depth` column to `dive_sites` table (DECIMAL(5,2), nullable)
- Added `alternative_names` column to `dive_sites` table (TEXT, nullable)
- Migration: `backend/migrations/versions/0002_add_max_depth_and_alternative_names.py`

**API Endpoint Updates:**
- **POST** `/api/v1/dive-sites/` - Now accepts `max_depth` and `alternative_names` fields
- **PUT** `/api/v1/dive-sites/{id}` - Now accepts `max_depth` and `alternative_names` fields
- **GET** `/api/v1/dive-sites/{id}` - Now returns `max_depth` and `alternative_names` fields
- **GET** `/api/v1/dive-sites/` - Now returns `max_depth` and `alternative_names` fields

**Validation Improvements:**
- **Latitude/Longitude**: Now properly enforced as mandatory fields
- **Empty String Handling**: Backend now properly handles empty strings for optional numeric fields
- **Frontend Validation**: Client-side validation prevents submission with empty required fields
- **Error Messages**: Clear error messages for validation failures

**Frontend Enhancements:**
- **Form Field Ordering**: Reorganized form fields for better user experience
  - Alternative Names moved below Name field
  - Maximum Depth moved above Dive Plans
  - Access Instructions moved between Dive Plans and Marine Life
- **Required Field Indicators**: Latitude and Longitude marked with asterisks (*)
- **Validation Feedback**: Toast notifications for validation errors
- **Empty Field Handling**: Proper handling of empty optional fields

**Schema Updates:**
```python
# DiveSiteBase and DiveSiteCreate schemas
max_depth: Optional[float] = Field(None, ge=0, le=1000)
alternative_names: Optional[str] = None

# DiveSiteUpdate schema with improved validation
max_depth: Optional[Union[float, str]] = Field(None, ge=0, le=1000)

@validator('max_depth', pre=True)
def handle_empty_strings(cls, v):
    if isinstance(v, str) and v.strip() == '':
        return None
    return v
```

**Backend Validation:**
```python
# Prevents latitude/longitude from being set to null
if 'latitude' in update_data and update_data['latitude'] is None:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Latitude cannot be empty"
    )
```

**Files Modified:**
- `backend/app/models.py` - Added max_depth and alternative_names fields
- `backend/app/schemas.py` - Added new fields with validation
- `backend/app/routers/dive_sites.py` - Added validation for mandatory fields
- `frontend/src/pages/EditDiveSite.js` - Updated form with new fields and validation
- `frontend/src/pages/CreateDiveSite.js` - Updated form with new fields and validation
- `frontend/src/pages/DiveSiteDetail.js` - Added display for new fields
- `backend/migrations/versions/0002_add_max_depth_and_alternative_names.py` - Database migration

**Testing:**
- Added comprehensive tests for new fields
- Added validation tests for mandatory fields
- Added tests for empty string handling
- All existing tests continue to pass

### ✅ Fixed: User Rating Display Bug

**Issue:** When users navigated between dive sites, the rating stars would show the previous dive site's rating instead of the current dive site's rating.

**Root Cause:** The `useEffect` hooks in dive site and diving center detail pages only set the rating when `user_rating` existed, but didn't reset to 0 when the user hadn't rated the current item.

**Solution:**
```javascript
// Before (buggy):
useEffect(() => {
  if (diveSite && diveSite.user_rating) {
    setRating(diveSite.user_rating);
  }
}, [diveSite]);

// After (fixed):
useEffect(() => {
  if (diveSite) {
    if (diveSite.user_rating) {
      setRating(diveSite.user_rating);
    } else {
      setRating(0); // Reset to 0 if user hasn't rated this dive site
    }
  }
}, [diveSite]);
```

**Files Modified:**
- `frontend/src/pages/DiveSiteDetail.js` - Fixed rating state management
- `frontend/src/pages/DivingCenterDetail.js` - Fixed rating state management

**User Experience:**
- Users now see empty stars when they haven't rated a dive site/diving center
- Users see their previous rating when they have rated the current item
- Clear visual feedback about rating status

### ✅ Fixed: 422 Error When Adding Tags

**Issue:** Attempting to add tags to dive sites would result in a 422 Unprocessable Entity error.

**Root Cause:** The frontend was sending empty strings `""` for `max_depth` when the field was left empty, but the backend expected either a number or `null`.

**Solution:**
1. **Backend Schema Fix**: Modified `DiveSiteUpdate` schema to handle empty strings for `max_depth`
2. **Frontend Validation**: Added proper handling of empty `max_depth` values
3. **Pydantic Validator**: Added validator to convert empty strings to `None`

**Technical Details:**
```python
# Backend schema update
max_depth: Optional[Union[float, str]] = Field(None, ge=0, le=1000)

@validator('max_depth', pre=True)
def handle_empty_strings(cls, v):
    if isinstance(v, str) and v.strip() == '':
        return None
    return v
```

```javascript
// Frontend validation
if (formData.max_depth && formData.max_depth.trim() !== '') {
  updateData.max_depth = parseFloat(formData.max_depth);
} else {
  updateData.max_depth = null;
}
```

**Testing:**
- Added test to verify empty `max_depth` values are handled correctly
- All existing functionality continues to work
- Tag management now works without errors

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

### ✅ Fixed: Interactive Maps with OpenLayers

**Feature:** Migrated from Leaflet to OpenLayers for better performance and consistency.

**Implementation:**
- **Map Library Migration**: Replaced Leaflet with OpenLayers across all map components
- **Mini Map Component**: Interactive mini map in dive site detail pages
- **Full-Screen Map View**: Dedicated map page for each dive site with nearby sites
- **Geographic Navigation**: Click on nearby dive sites to navigate between them
- **Custom Markers**: Distinct markers for current site vs nearby sites
- **Error Handling**: Proper loading states and null checks to prevent runtime errors

**Technical Improvements:**
- **Duplicate Icon Fix**: Resolved "2 icons, one on top of the other" issue
- **Runtime Error Fix**: Added proper null checks and loading states
- **Performance**: OpenLayers provides better performance than Leaflet
- **Consistency**: Same mapping library used across the entire application

**Frontend Components:**
- **MiniMap**: Reusable component for displaying dive site locations
- **DiveSiteMap**: Full-screen map view with nearby site navigation
- **DiveSiteDetail**: Enhanced with mini map and nearby site navigation

**Files Modified:**
- `frontend/src/components/MiniMap.js` - OpenLayers implementation
- `frontend/src/pages/DiveSiteMap.js` - OpenLayers implementation
- `frontend/src/pages/DiveSiteDetail.js` - Added mini map integration
- `frontend/package.json` - Removed Leaflet dependencies
- `frontend/src/App.js` - Added map routes

**API Endpoints:**
- **GET** `/api/v1/dive-sites/{id}/nearby` - Returns nearby dive sites with distances
- **GET** `/api/v1/dive-sites/{id}` - Returns dive site details for map display

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