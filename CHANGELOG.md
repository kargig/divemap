# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the Divemap application.

## [Latest Release] - 2024-01-XX

### 🚀 Major Features

#### **New Dive Site Fields and Enhanced Validation**
- **Maximum Depth**: Added `max_depth` field to track dive site depth in meters
- **Alternative Names**: Added `alternative_names` field for dive site aliases
- **Mandatory Coordinates**: Improved validation to ensure latitude/longitude are always required
- **Form Field Reorganization**: Better user experience with logical field ordering
- **Empty Field Handling**: Proper handling of empty optional fields

**New Fields:**
- **`max_depth`**: Maximum depth in meters (optional, 0-1000m range)
- **`alternative_names`**: Alternative names/aliases for dive sites (optional)

**Form Field Ordering:**
1. Name (with Difficulty Level)
2. Alternative Names ← *New position*
3. Description
4. Location (Latitude*, Longitude*, Address)
5. Gas Tanks Necessary
6. Maximum Depth ← *New position*
7. Dive Plans
8. Access Instructions ← *New position*
9. Marine Life
10. Safety Information

**Validation Improvements:**
- **Client-side Validation**: Prevents submission with empty required fields
- **Server-side Validation**: Backend rejects null latitude/longitude values
- **Error Messages**: Clear feedback for validation failures
- **Required Field Indicators**: Asterisks (*) mark mandatory fields

**Files Modified:**
- `backend/app/models.py` - Added new database fields
- `backend/app/schemas.py` - Added field validation with empty string handling
- `backend/app/routers/dive_sites.py` - Added mandatory field validation
- `frontend/src/pages/EditDiveSite.js` - Updated form with new fields and validation
- `frontend/src/pages/CreateDiveSite.js` - Updated form with new fields and validation
- `frontend/src/pages/DiveSiteDetail.js` - Added display for new fields
- `backend/migrations/versions/0002_add_max_depth_and_alternative_names.py` - Database migration

**Database Migration:**
```sql
-- Added max_depth column
ALTER TABLE dive_sites ADD COLUMN max_depth DECIMAL(5,2) NULL;

-- Added alternative_names column  
ALTER TABLE dive_sites ADD COLUMN alternative_names TEXT NULL;
```

#### **User Rating Display Bug Fix**
- **Issue**: Rating stars showed previous dive site's rating when navigating between sites
- **Solution**: Fixed `useEffect` hooks to properly reset rating state
- **User Experience**: Users now see empty stars when they haven't rated a site
- **Visual Feedback**: Clear indication of rating status

**Technical Fix:**
```javascript
// Before: Only set rating if user_rating existed
useEffect(() => {
  if (diveSite && diveSite.user_rating) {
    setRating(diveSite.user_rating);
  }
}, [diveSite]);

// After: Reset to 0 if no user_rating
useEffect(() => {
  if (diveSite) {
    if (diveSite.user_rating) {
      setRating(diveSite.user_rating);
    } else {
      setRating(0); // Reset to 0 if user hasn't rated
    }
  }
}, [diveSite]);
```

**Files Modified:**
- `frontend/src/pages/DiveSiteDetail.js` - Fixed rating state management
- `frontend/src/pages/DivingCenterDetail.js` - Fixed rating state management

#### **Tag Management Bug Fix**
- **Issue**: 422 error when adding tags to dive sites
- **Root Cause**: Empty strings for `max_depth` field not handled properly
- **Solution**: Added Pydantic validator to convert empty strings to `null`
- **Result**: Tag management now works without errors

**Technical Solution:**
```python
# Backend schema update
max_depth: Optional[Union[float, str]] = Field(None, ge=0, le=1000)

@validator('max_depth', pre=True)
def handle_empty_strings(cls, v):
    if isinstance(v, str) and v.strip() == '':
        return None
    return v
```

**Testing:**
- Added comprehensive tests for new fields
- Added validation tests for mandatory fields
- Added tests for empty string handling
- All existing functionality continues to work

#### **Database Migration System (Alembic)**
- **Alembic Integration**: Complete migration system for version-controlled database changes
- **Automatic Execution**: Migrations run automatically before application startup
- **Environment Compatibility**: Works with both development and Docker environments
- **Health Checks**: Database availability verification before migration execution
- **Rollback Support**: Full migration history with downgrade capabilities
- **Python Path Fixes**: Resolved asdf Python environment compatibility issues

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

#### **Multi-Currency Support System**
- **10 World Currencies**: Support for USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD, NZD
- **Euro Default**: Euro (€) is the default currency for all cost fields
- **Currency Symbols**: Proper display with currency symbols and flags
- **Flexible Input**: Users can submit costs in any supported currency
- **Visual Formatting**: Automatic formatting with symbols, flags, and codes
- **Database Migration**: Added currency fields to cost tables with indexes
- **API Integration**: Updated all cost-related endpoints to handle currency
- **Frontend Utility**: Comprehensive currency utility functions

**Supported Currencies:**
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

#### **Google OAuth Authentication**
- **Complete OAuth 2.0 Integration**: Secure authentication with Google Identity Services
- **Backend Token Verification**: Server-side verification with Google's servers
- **Automatic User Creation**: New users created from Google data
- **Account Linking**: Existing users can link Google accounts by email
- **Environment Configuration**: Easy setup with environment variables
- **Frontend Integration**: Google Sign-In buttons on login/register pages
- **Security Features**: Rate limiting and proper error handling

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

#### **Mass Delete Functionality**
- **Bulk Operations**: Select multiple items for deletion across all admin pages
- **Safety Features**: Protection against deleting used tags and self-deletion
- **Confirmation Dialogs**: Clear confirmation with item names
- **Visual Feedback**: Loading states and success/error messages
- **Responsive Design**: Works on all screen sizes

**Admin Pages Updated:**
- `/admin/dive-sites` - Mass delete dive sites
- `/admin/diving-centers` - Mass delete diving centers

#### **Interactive Maps with OpenLayers**
- **Map Library Migration**: Replaced Leaflet with OpenLayers for better performance and consistency
- **Mini Map Component**: Interactive mini map in dive site detail pages
- **Full-Screen Map View**: Dedicated map page for each dive site with nearby sites
- **Geographic Navigation**: Click on nearby dive sites to navigate between them
- **Custom Markers**: Distinct markers for current site vs nearby sites
- **Responsive Design**: Maps work on all screen sizes with proper scaling
- **Error Handling**: Proper loading states and null checks to prevent runtime errors

**Files Added:**
- `frontend/src/components/MiniMap.js` - Reusable mini map component
- `frontend/src/pages/DiveSiteMap.js` - Full-screen map view component

**Files Modified:**
- `frontend/src/pages/DiveSiteDetail.js` - Added mini map and nearby navigation
- `frontend/src/App.js` - Added map route
- `frontend/package.json` - Removed Leaflet dependencies, kept OpenLayers
- `frontend/src/pages/DiveSites.js` - Preserved filter state in URL

**Technical Improvements:**
- **Duplicate Icon Fix**: Resolved "2 icons, one on top of the other" issue
- **Runtime Error Fix**: Added proper null checks and loading states
- **Performance**: OpenLayers provides better performance than Leaflet
- **Consistency**: Same mapping library used across the entire application  
- `/admin/tags` - Mass delete tags (with protection for used tags)
- `/admin/users` - Mass delete users (with self-deletion protection)

**Files Modified:**
- `frontend/src/pages/AdminDiveSites.js` - Added mass delete functionality
- `frontend/src/pages/AdminDivingCenters.js` - Added mass delete functionality
- `frontend/src/pages/AdminTags.js` - Added mass delete with protection
- `frontend/src/pages/AdminUsers.js` - Added mass delete with self-protection

### 🎨 User Experience Improvements

#### **Toast Notification Enhancements**
- **Positioning**: Notifications appear below navbar to prevent navigation blocking
- **Duration**: Reduced to 500ms for quicker disappearance
- **Z-index Management**: Proper layering with navbar
- **Responsive Design**: Works on all screen sizes

#### **Layout Improvements**
- **Fixed Navbar**: Sticky navigation with proper z-index
- **Content Spacing**: Adjusted padding to account for fixed navbar
- **Table Responsiveness**: Text wrapping to prevent horizontal scrollbars
- **Container Width**: Increased max-width for better content display

### 🔧 Technical Improvements

#### **Dependency Management**
- **Google OAuth Packages**: Added google-auth and google-auth-oauthlib
- **Version Conflicts**: Fixed pyasn1 dependency conflicts
- **Docker Rebuild**: Updated container with new dependencies

#### **Database Schema Updates**
- **Currency Fields**: Added currency fields to center_dive_sites and gear_rental_costs tables
- **Currency Indexes**: Created indexes for currency fields for better performance
- **Default Values**: Set 'EUR' as default currency for all existing records
- **Google ID Field**: Added google_id to users table
- **Index Creation**: Efficient Google ID lookups
- **Migration Script**: Automated database migration

#### **Frontend Linting Fixes**
- **ESLint Errors**: Fixed all linting warnings and errors
- **Missing Imports**: Added required icon imports
- **useEffect Dependencies**: Fixed React Hook dependency warnings
- **Unused Variables**: Cleaned up unused imports and variables

### 🐛 Bug Fixes

#### **Backend Issues**
- **Currency Validation**: Fixed currency code validation and error handling
- **Currency Migration**: Successfully added currency fields to database
- **Currency Defaults**: Properly set Euro as default currency for existing records
- **Google OAuth Dependencies**: Fixed ModuleNotFoundError for Google packages
- **Database Migration**: Successfully added google_id field
- **Container Rebuild**: Fixed dependency installation issues

#### **Frontend Issues**
- **Missing Icon Imports**: Added X, Loader, Save icons to admin pages
- **useEffect Dependencies**: Fixed React Hook exhaustive-deps warnings
- **Unused Variables**: Removed unused navigate imports
- **Build Errors**: Fixed all compilation errors

#### **Layout Issues**
- **Toast Positioning**: Fixed notifications appearing behind navbar
- **Table Overflow**: Prevented horizontal scrollbars with text wrapping
- **Navbar Z-index**: Proper layering of fixed navbar

### 🔒 Security Enhancements

#### **Google OAuth Security**
- **Token Verification**: Backend verification with Google's servers
- **Rate Limiting**: OAuth endpoints protected against abuse
- **Account Security**: Google users enabled by default but manageable
- **Error Handling**: Comprehensive error handling for OAuth failures

#### **Mass Delete Safety**
- **Tag Protection**: Tags with associated dive sites cannot be deleted
- **Self-Deletion Prevention**: Users cannot delete their own accounts
- **Confirmation Dialogs**: Clear confirmation with item names
- **Error Rollback**: Proper error handling and rollback

### 📚 Documentation Updates

#### **New Documentation**
- **Google OAuth Setup Guide**: Complete setup instructions
- **API Changelog**: Updated with new endpoints and features
- **README Updates**: Comprehensive feature documentation

#### **Updated Documentation**
- **Security Documentation**: Added Google OAuth security notes
- **API Documentation**: New Google OAuth endpoint documentation
- **Migration Guides**: Database migration instructions

### 🧪 Testing Improvements

#### **New Test Cases**
- **Google OAuth Testing**: Token verification and user creation tests
- **Mass Delete Testing**: Bulk operations with safety features
- **Frontend Validation**: Build and linting checks

#### **Updated Test Infrastructure**
- **Dependency Testing**: Google OAuth package integration
- **Database Testing**: Google ID field validation
- **Frontend Testing**: Build success verification

## [Previous Release] - 2024-01-XX

### 🚀 Major Features

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
- **Form Validation**: Client-side validation with user feedback
- **Loading States**: Visual feedback during operations

#### **Advanced User Management**
- **Complete User CRUD**: Create, edit, delete users
- **Role Assignment**: Admin, moderator, and user roles
- **Status Control**: Enable/disable user accounts
- **Password Management**: Optional password updates
- **Safety Checks**: Prevent self-deletion and unauthorized actions

### 🐛 Bug Fixes

#### **Frontend Create Pages**
- **Issue**: Admin create pages showed empty pages
- **Solution**: Created comprehensive create forms and added proper routes
- **Files**: Added CreateDiveSite.js and CreateDivingCenter.js

#### **Dive Sites API Serialization**
- **Issue**: 500 errors due to improper tag serialization
- **Solution**: Updated tag serialization to return dictionaries instead of model objects
- **Files**: Modified backend/app/routers/dive_sites.py

#### **Difficulty Level Validation**
- **Issue**: 'expert' difficulty level caused validation errors
- **Solution**: Updated schema patterns to include 'expert'
- **Files**: Modified backend/app/schemas.py

#### **Tag Model Field Mapping**
- **Issue**: Code tried to access non-existent 'category' field
- **Solution**: Removed references to non-existent field
- **Files**: Modified backend/app/routers/dive_sites.py

#### **Admin Authentication**
- **Issue**: Admin could not log in with default credentials
- **Solution**: Updated admin password to meet new requirements
- **Files**: Created backend/update_admin_password.py

#### **Docker Dependencies**
- **Issue**: Backend container failed to start with missing slowapi
- **Solution**: Rebuilt Docker image with updated requirements
- **Files**: Updated backend/requirements.txt

### 📚 Documentation Updates

#### **API Documentation**
- **New Endpoints**: Documented all new admin endpoints
- **Response Formats**: Updated with proper tag serialization
- **Error Handling**: Comprehensive error documentation

#### **Security Documentation**
- **Password Requirements**: Updated security requirements
- **Admin Access**: Documented admin authentication changes
- **Rate Limiting**: Added rate limiting documentation

## Migration Notes

### For Developers

1. **Google OAuth Setup**: Follow `GOOGLE_OAUTH_SETUP.md` for complete configuration
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
- **Minimal**: Tag serialization adds small overhead but improves data consistency
- **Google OAuth**: Adds secure authentication without performance impact
- **Mass Delete**: Efficient bulk operations with proper error handling
- **No Breaking Changes**: All existing functionality preserved

## Security Notes

- **Google OAuth**: Secure token verification with Google's servers
- **Rate Limiting**: OAuth endpoints have rate limiting protection
- **Account Security**: Google users are enabled by default but can be managed
- **Mass Delete Safety**: Protection against deleting used tags and self-deletion
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

## Support

For questions or issues related to these changes:

1. **Google OAuth Setup**: See `GOOGLE_OAUTH_SETUP.md`
2. **API Documentation**: See `API_CHANGELOG.md`
3. **Security Information**: See `SECURITY.md`
4. **General Documentation**: See `README.md`

## Contributing

When contributing to the project:

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation for any changes
4. Test thoroughly before submitting pull requests
5. Follow security best practices 