# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the Divemap application.

## [Latest Release] - 2025-07-27

### 🚀 Major Features

#### **Fly.io Private IPv6 Database Configuration**
- **Private Network Setup**: Allocated private IPv6 address for secure database connectivity
- **Flycast Integration**: Database accessible via `divemap-db.flycast` hostname
- **Enhanced Security**: Database isolated from public internet exposure
- **Performance Optimization**: Direct private network communication

**Benefits:**
- **Security**: Database not exposed to public internet
- **Performance**: Direct private network communication
- **Reliability**: Stable internal network connectivity
- **Cost**: No additional bandwidth charges for internal traffic

#### **API Endpoint Trailing Slash Fixes**
- **Fixed Dive Site Detail Page**: Resolved 307 redirect issues preventing display of nearby dive sites, comments, and media
- **Consistent API Patterns**: Standardized all frontend API calls to match backend FastAPI routing expectations
- **Improved User Experience**: Dive site detail pages now properly display all content sections

**Fixed Endpoints:**
- `/api/v1/dive-sites/{id}/comments/` → `/api/v1/dive-sites/{id}/comments`
- `/api/v1/dive-sites/{id}/media/` → `/api/v1/dive-sites/{id}/media`
- `/api/v1/dive-sites/{id}/nearby/` → `/api/v1/dive-sites/{id}/nearby`
- `/api/v1/diving-centers/{id}/comments/` → `/api/v1/diving-centers/{id}/comments`
- `/api/v1/diving-centers/{id}/gear-rental/` → `/api/v1/diving-centers/{id}/gear-rental`

#### **Database Connectivity and Container Optimization**
- **Robust Database Connectivity Check**: Backend container now waits for database availability before starting
- **IPv6 Support for Fly.io**: Implemented netcat-openbsd with IPv6 support for cloud deployment
- **Retry Logic**: 10 retry attempts with random 1-5 second delays between attempts
- **Container Optimization**: Removed unnecessary build dependencies (gcc, default-libmysqlclient-dev)
- **Pre-compiled Wheels**: All Python packages now use pre-compiled wheels for faster builds

**Benefits:**
- **Faster Builds**: No compilation step needed, only pre-compiled wheel downloads
- **Smaller Containers**: Reduced container size by ~200MB
- **Better Security**: Fewer installed packages reduces potential vulnerabilities
- **Consistent Behavior**: Pre-compiled wheels work identically across environments

### 🔧 API Changes

#### **Enhanced User Profile Management**
- **New Password Change Endpoint**: `POST /api/v1/users/me/change-password`
- **Enhanced Profile Fields**: Added diving experience, preferred diving type, home country/region
- **Security Features**: Current password verification, strong password validation, rate limiting

#### **View Tracking Implementation**
- **New Feature**: Added view count tracking for dive sites and diving centers
- **Admin Only**: View counts visible only to admin users
- **Automatic Increment**: View counts increment on each detail page visit
- **Database Schema**: Added `view_count` columns to dive_sites and diving_centers tables

### 🏗️ Infrastructure Changes

#### **Container Optimization**
- **Removed Dependencies**: Eliminated `gcc` and `default-libmysqlclient-dev`
- **Pre-compiled Wheels**: All Python packages use pre-compiled wheels
- **Faster Builds**: Reduced build time and container size

#### **Database Connectivity**
- **Startup Script**: Robust database connectivity check before application startup
- **IPv6 Support**: Full IPv6 support for cloud deployment
- **Visual Logging**: Clear indicators for all startup states

### 🔒 Security Updates

#### **Dependency Updates**
- **Python Dependencies**: Updated FastAPI, Starlette, Python-Jose, AnyIO
- **Node.js Dependencies**: Updated React Scripts, fixed nth-check, PostCSS, SVGO vulnerabilities
- **Security Headers**: Implemented comprehensive security headers

#### **Security Headers**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy: default-src 'self'...

### 🗄️ Database Changes

#### **Migration History**
- `0004_add_view_count_fields.py` - Added view tracking
- `0005_add_user_diving_fields.py` - Added user profile fields

### 🎨 Frontend Changes

#### **Admin Interface Enhancements**
- **Sortable Columns**: All admin page columns now sortable with visual indicators
- **View Tracking Display**: Added Views column to admin pages (admin only)
- **Performance**: Optimized with React useMemo for better performance

#### **User Experience Improvements**
- **Profile Management**: Enhanced profile form with diving fields
- **Password Change**: Added password change functionality
- **Form Validation**: Improved form validation and error handling

### ⚙️ Backend Changes

#### **API Improvements**
- **Endpoint Standardization**: Consistent trailing slash handling
- **Error Responses**: Improved error responses and validation
- **Performance**: Database query optimizations and caching improvements

#### **Code Quality**
- **Refactoring**: Improved code organization and separation of concerns
- **Test Coverage**: Enhanced test coverage and documentation updates

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