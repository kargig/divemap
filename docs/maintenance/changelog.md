# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the Divemap application.

## [Latest Release] - 2025-08-09

### 🚀 Major Features

#### **Admin Dashboard Enhancement**
- **System Overview Dashboard**: Comprehensive platform statistics and health monitoring
  - Platform statistics (users, content, engagement, geographic distribution)
  - System health monitoring (database, application, resources, external services)
  - Real-time alerts and status indicators
  - Auto-refresh functionality with configurable intervals
- **Recent Activity Monitoring**: Real-time tracking of user actions and system changes
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
- **Activity Tracking**: Comprehensive logging of user actions and system changes

#### **Frontend Admin Interface**
- **Admin Dashboard Integration**: Clickable cards for System Overview and Recent Activity
- **Navigation Updates**: Added admin menu links for new monitoring pages
- **Real-time Updates**: Auto-refresh functionality with manual refresh options
- **Responsive Design**: Mobile-friendly interface with proper accessibility

### 🔧 API Enhancements

#### **Dive Filtering Improvements**
- **my_dives Parameter**: Added `my_dives=true` parameter to dives endpoint for filtering user's own dives
- **Authentication Required**: `my_dives` parameter requires authentication and returns 401 for unauthenticated requests
- **User-Specific Filtering**: Returns only current user's dives (both private and public)
- **Empty Results**: Returns empty array for users with no dives
- **Count Endpoint Support**: Added `my_dives` parameter to `/api/v1/dives/count` endpoint

#### **Dive Site Creation for Regular Users**
- **User Dive Site Creation**: Regular users can now create dive sites (previously admin/moderator only)
- **Ownership Tracking**: Added `created_by` field to dive sites table to track ownership
- **My Dive Sites Filter**: Added `my_dive_sites=true` parameter to filter dive sites created by current user
- **UI Improvements**: Enhanced dive site creation interface with better layout and user feedback

### 🚀 Major Features

#### **Subsurface XML Import System**
- **Frontend Import Modal**: Complete UI for uploading and reviewing Subsurface XML files
- **Backend API Endpoints**: Comprehensive API for XML parsing and dive confirmation
- **Dive Site Matching**: Enhanced matching with similarity detection and user selection
- **Privacy Controls**: Users can set privacy settings for imported dives
- **Skip Functionality**: Individual dive skip options during import process
- **Visual Indicators**: Privacy indicators on dive detail pages

#### **Moderator Permission Enhancements**
- **Ownership Management**: Moderators can now approve diving center ownership requests
- **Diving Organizations**: Full CRUD permissions for diving organizations
- **Newsletter Management**: Complete newsletter and dive trip management capabilities
- **User Listing**: Moderators can view all users in the system
- **Comprehensive Testing**: 136 new tests covering all moderator permissions

### 🐛 Bug Fixes

#### **Dive Name Regeneration**
- **Empty Name Handling**: Fixed dive name regeneration when users delete dive names
- **Automatic Naming**: System now properly regenerates names based on dive site and date
- **Frontend Integration**: Fixed data processing to preserve empty strings for backend regeneration

#### **Map View Improvements**
- **Automatic Fitting**: Map now automatically fits to show all dive sites matching search filters
- **Dynamic Zoom**: Removed fixed zoom level, map adapts to current dive sites data

## [Previous Release] - 2025-08-02

### 🔧 Import Script Enhancements

#### **Enhanced Dive Site Import System**
- **Smart Conflict Resolution**: Enhanced import script prefers updating existing sites over creating new ones
- **Similarity Matching**: Uses multiple algorithms to detect similar dive site names (80% threshold)
- **Proximity Checking**: Prevents duplicates within 200m radius
- **Selective Updates**: Preserves existing data not present in import files
- **Batch Processing**: Multiple modes for different import scenarios (interactive, skip-all, update-all, create-merge-all)
- **Merge File System**: Manual review capability for complex updates

**Import Script Features:**
- **Smart Matching**: Sequence matcher, word-based similarity, and substring matching
- **Interactive Mode**: User confirmation for each conflict
- **Force Mode**: Skip all confirmations for batch processing
- **Dry Run Mode**: Preview changes without making them
- **Merge Files**: Generate files for manual review and editing

**Update Behavior:**
- **Always Updated**: name, description, latitude, longitude
- **Preserved**: address, access_instructions, difficulty_level, marine_life, safety_information, aliases, country, region
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

### 🔒 Security Enhancements

#### **Enhanced Rate Limiting System**
- **Custom Rate Limiting Decorator**: Implemented `@skip_rate_limit_for_admin()` with intelligent exemption logic
- **Localhost Exemptions**: Requests from localhost IPs (127.0.0.1, ::1, localhost) are exempt from rate limiting for development and testing
- **Admin User Exemptions**: Users with `is_admin=True` are exempt from rate limiting on authenticated endpoints
- **Comprehensive Coverage**: Updated 19 endpoints across auth and dive sites routers
- **Robust Error Handling**: Fallback to normal rate limiting on errors

**Rate Limiting Implementation:**
- Custom key function for localhost detection
- JWT token extraction and verification for admin user detection
- Database queries to verify admin privileges
- Protection against API abuse while maintaining administrative functionality

**Updated Endpoints:**
- **Auth Router**: 3 endpoints updated (register, login, google-login)
- **Dive Sites Router**: 16 endpoints updated with custom rate limiting
- **Rate Limits**: Comprehensive limits from 5/minute to 200/minute based on endpoint type

**Testing Coverage:**
- 10 new rate limiting tests (all passing)
- Real-world integration tests with Docker containers
- 237/238 existing tests passing (1 expected failure due to rate limiting)

### 🚀 Major Features

#### **Dive-Diving Center Integration**
- **Dive-Diving Center Association**: Dives can now be associated with diving centers that organized or facilitated the dive
- **Optional Relationship**: The diving center relationship is optional and can be added, changed, or removed
- **Complete Information**: API responses include both diving center ID and full diving center details
- **Admin Support**: Admin endpoints support diving center management for all dives
- **Comprehensive Testing**: Added 12 new tests covering all dive-diving center functionality

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

### 🚀 Major Features

#### **Dive Logging System**
- **Complete Dive Management**: Full CRUD operations for user dive logs
- **Comprehensive Dive Data**: Date, time, depth, visibility, ratings, suit type, difficulty level
- **Media Management**: Support for photos, videos, dive plans, and external links
- **Tag System**: Associate dives with tags for categorization
- **Automatic Name Generation**: Dives automatically named based on dive site and date
- **Privacy Controls**: Users can manage their own dives, admins can manage all dives
- **Search and Filtering**: Advanced filtering by dive site, depth, date range, ratings, and more

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
- **Dive Detail Page**: Comprehensive dive information display with media gallery
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

### 🔧 API Changes

#### **New Schemas and Models**
- **Dive**: Complete dive data model with validation
- **DiveMedia**: Media management for dives
- **DiveTag**: Tag associations for dives
- **Enhanced Responses**: Updated dive responses with media and tag information

#### **Enhanced Search and Filtering**
- **Advanced Filtering**: Filter by dive site, depth, date range, ratings, difficulty
- **Search by Name**: Search dives by dive site name
- **Admin Overrides**: Admin can view and manage all dives regardless of privacy

### 🗄️ Database Changes

#### **New Tables**
- `dives`: Store comprehensive dive information
- `dive_media`: Media files for dives (photos, videos, plans, external links)
- `dive_tags`: Association between dives and tags

#### **Schema Updates**
- **Added**: Complete dive logging system with media support
- **Enhanced**: Tag system now supports dive tagging
- **Improved**: Automatic dive name generation based on site and date

### 🎨 Frontend Changes

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

### ⚙️ Backend Changes

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

### 🚀 Major Features

#### **Diving Organizations Management System**
- **Complete CRUD Operations**: Full create, read, update, delete functionality for diving organizations
- **Organization Data**: Name, acronym, website, logo, description, country, and founding year
- **Admin-Only Management**: Only administrators can create, edit, or delete diving organizations
- **Data Validation**: Unique constraints on name and acronym to prevent duplicates
- **Pre-populated Data**: Script to populate with top 10 diving organizations (PADI, SSI, GUE, etc.)

**New API Endpoints:**
- `GET /api/v1/diving-organizations/` - List all diving organizations
- `GET /api/v1/diving-organizations/{id}` - Get specific organization
- `POST /api/v1/diving-organizations/` - Create new organization (admin only)
- `PUT /api/v1/diving-organizations/{id}` - Update organization (admin only)
- `DELETE /api/v1/diving-organizations/{id}` - Delete organization (admin only)

#### **User Certifications System**
- **Certification Tracking**: Users can manage their diving certifications
- **Organization Association**: Certifications linked to specific diving organizations
- **Active Status Management**: Users can activate/deactivate certifications
- **Public Profile Display**: Certifications visible on user profiles
- **Self-Service Management**: Users can add, edit, and manage their own certifications

**New API Endpoints:**
- `GET /api/v1/user-certifications/my-certifications` - Get user's certifications
- `GET /api/v1/user-certifications/users/{user_id}/certifications` - Get public certifications
- `POST /api/v1/user-certifications/my-certifications` - Add new certification
- `PUT /api/v1/user-certifications/my-certifications/{id}` - Update certification
- `DELETE /api/v1/user-certifications/my-certifications/{id}` - Delete certification
- `PATCH /api/v1/user-certifications/my-certifications/{id}/toggle` - Toggle active status

#### **Database Schema Enhancements**
- **New Tables**: `diving_organizations`, `user_certifications`, `diving_center_organizations`
- **Enhanced User Model**: Removed simple `diving_certification` field, replaced with comprehensive system
- **Relationship Management**: Many-to-many relationships between centers and organizations
- **Data Integrity**: Proper foreign key constraints and unique constraints

**Migration Files:**
- `c85d7af66778_add_diving_organizations_and_user_.py` - Added new tables and relationships
- `9002229c2a67_remove_unnecessary_certification_fields_.py` - Cleaned up certification fields

#### **Data Population Script**
- **Pre-populated Organizations**: Top 10 diving organizations automatically added
- **Duplicate Prevention**: Script checks for existing data before adding
- **Comprehensive Data**: Includes PADI, SSI, GUE, RAID, CMAS, TDI, NAUI, BSAC, SDI, IANTD
- **Organization Details**: Complete information including websites, descriptions, and founding years

### 🔧 API Changes

#### **New Schemas and Models**
- **DivingOrganization**: Complete organization management with validation
- **UserCertification**: User certification tracking with organization association
- **DivingCenterOrganization**: Many-to-many relationship between centers and organizations
- **Enhanced Responses**: Updated user and center responses to include organization data

#### **Enhanced User Management**
- **Certification Display**: User profiles now show diving certifications
- **Organization Information**: Detailed organization data in certification responses
- **Active Status**: Users can manage which certifications are currently active

### 🗄️ Database Changes

#### **New Tables**
- `diving_organizations`: Store diving organization information
- `user_certifications`: Track user certifications with organization links
- `diving_center_organizations`: Many-to-many relationship table

#### **Schema Updates**
- **Removed**: `users.diving_certification` field (replaced with comprehensive system)
- **Added**: Proper relationships and constraints for data integrity
- **Enhanced**: User model with certification relationships

### 🎨 Frontend Changes

#### **New Admin Features** (Planned)
- **Diving Organizations Management**: Admin interface for managing organizations
- **User Certification Display**: Enhanced user profiles with certification information
- **Organization Selection**: Dropdown menus for organization selection in forms

### ⚙️ Backend Changes

#### **New Routers**
- **Diving Organizations Router**: Complete CRUD operations for organizations
- **User Certifications Router**: Self-service certification management
- **Enhanced Main App**: Updated to include new routers

#### **Data Population**
- **Populate Script**: `populate_diving_organizations.py` for initial data
- **Duplicate Prevention**: Smart checking to avoid duplicate entries
- **Comprehensive Data**: Top 10 diving organizations with complete information

### 📚 Documentation Updates

#### **API Documentation**
- **New Endpoints**: Complete documentation for diving organizations and certifications
- **Schema Updates**: Updated with new models and relationships
- **Example Usage**: Code examples for new API endpoints

#### **Database Documentation**
- **Schema Changes**: Updated with new tables and relationships
- **Migration Guide**: Instructions for applying new migrations
- **Data Population**: Guide for populating initial organization data

## [Previous Release] - 2025-07-27

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

#### **Advanced User Management**
- **Complete User CRUD**: Create, edit, delete users
- **Role Assignment**: Admin, moderator, and user roles
- **Status Control**: Enable/disable user accounts
- **Password Management**: Optional password updates

### 🐛 Bug Fixes

#### **Frontend Create Pages**
- **Issue**: Admin create pages showed empty pages
- **Solution**: Created comprehensive create forms and added proper routes

#### **Dive Sites API Serialization**
- **Issue**: 500 errors due to improper tag serialization
- **Solution**: Updated tag serialization to return dictionaries instead of model objects

#### **Difficulty Level Validation**
- **Issue**: 'expert' difficulty level caused validation errors
- **Solution**: Updated schema patterns to include 'expert'

#### **Admin Authentication**
- **Issue**: Admin could not log in with default credentials
- **Solution**: Updated admin password to meet new requirements

#### **Docker Dependencies**
- **Issue**: Backend container failed to start with missing slowapi
- **Solution**: Rebuilt Docker image with updated requirements

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

## Related Documentation

- **[API Documentation](../development/api.md)** - Complete API reference
- **[Database Documentation](../development/database.md)** - Database schema and migrations
- **[Security Documentation](../security/README.md)** - Security measures and audit results
- **[Deployment Documentation](../deployment/README.md)** - Deployment procedures