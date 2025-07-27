# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the Divemap application.

## [Latest Release] - 2025-07-27

### 🚀 Major Features

#### **Fly.io Production Deployment**
- **Complete Production Setup**: Successfully deployed the entire application stack to Fly.io
- **Multi-Service Architecture**: Deployed backend, frontend, and database as separate services
- **Internal Networking**: Configured secure communication between services using Fly.io's internal network
- **Persistent Storage**: Set up persistent volumes for database and file uploads
- **Environment Management**: Proper secret management using `fly secrets` instead of hardcoded values

**Deployment Components:**
- **Database**: MySQL database with persistent volume (`divemap-db`)
- **Backend**: FastAPI application with automatic migrations (`divemap-backend`)
- **Frontend**: React application with optimized build (`divemap`)

**Configuration Files Added:**
- `backend/fly.toml` - Backend deployment configuration
- `frontend/fly.toml` - Frontend deployment configuration  
- `database/fly.toml` - Database deployment configuration
- `backend/Dockerfile` - Backend container configuration
- `frontend/Dockerfile` - Frontend container configuration
- `FLY_DEPLOYMENT_GUIDE.md` - Comprehensive deployment documentation

**Environment Variables:**
- **Backend**: `DATABASE_URL`, `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Frontend**: `REACT_APP_API_URL`, `REACT_APP_GOOGLE_CLIENT_ID`
- **Database**: `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`

**Deployment URLs:**
- **Frontend**: https://divemap.fly.dev
- **Backend**: https://divemap-backend.fly.dev
- **Database**: Internal network only

#### **Authentication and Login Fixes**
- **Google OAuth Integration**: Added proper Google OAuth support with conditional rendering
- **Login Flow Fixes**: Resolved immediate logout issues after successful authentication
- **API Endpoint Consistency**: Fixed trailing slash inconsistencies between frontend and backend
- **Admin Access**: Ensured proper admin authentication for admin pages

**Authentication Improvements:**
- **Conditional Google OAuth**: Google Sign-In button only shows when `REACT_APP_GOOGLE_CLIENT_ID` is configured
- **Graceful Degradation**: Application works without Google OAuth when not configured
- **API Path Fixes**: Corrected all API endpoint paths to match backend expectations
- **Admin Page Access**: Fixed authentication for admin tags and users pages

**Files Modified:**
- `frontend/src/pages/Login.js` - Added conditional Google OAuth rendering
- `frontend/src/pages/Register.js` - Added conditional Google OAuth rendering
- `frontend/src/utils/googleAuth.js` - Added client ID validation
- `frontend/src/contexts/AuthContext.js` - Fixed `/api/v1/auth/me` endpoint
- `frontend/src/pages/AdminTags.js` - Fixed `/api/v1/tags/with-counts` endpoint
- `frontend/src/pages/AdminUsers.js` - Fixed `/api/v1/users/admin/users` endpoint

**API Endpoint Fixes:**
```javascript
// Before (with trailing slash)
api.get('/api/v1/auth/me/')
api.get('/api/v1/tags/with-counts/')
api.get('/api/v1/users/admin/users/')

// After (without trailing slash)
api.get('/api/v1/auth/me')
api.get('/api/v1/tags/with-counts')
api.get('/api/v1/users/admin/users')
```

#### **Database and Content Management**
- **Sample Data**: Added 20 comprehensive dive site tags to the database
- **Admin Interface**: Fixed admin pages to display tags and users properly
- **Backend Query Optimization**: Simplified complex database queries to prevent errors
- **Database Migration**: Ensured all schema changes are properly migrated

**Sample Tags Added:**
- Coral Reef, Wreck, Wall, Cave, Drift, Shark, Manta Ray, Turtle
- Deep, Shallow, Night, Photography, Training, Advanced, Beginner
- Current, Clear Water, Marine Life, Historical, Remote

**Database Improvements:**
- **Query Optimization**: Simplified `/with-counts` endpoint to avoid complex joins
- **Error Handling**: Better error handling for database operations
- **Performance**: Improved query performance with proper indexing

**Files Modified:**
- `backend/app/routers/tags.py` - Simplified `/with-counts` query
- `database/init.sql` - Updated schema with all new fields
- `export_database_data.py` - Script to export current database data

#### **Frontend API Communication Fixes**
- **Trailing Slash Consistency**: Fixed all API calls to match backend expectations
- **CORS Configuration**: Updated backend CORS to allow production frontend domain
- **Build Environment**: Fixed React environment variables to be available at build time
- **Error Handling**: Improved error handling for API communication issues

**API Communication Fixes:**
- **List Endpoints**: Added trailing slashes for list endpoints (e.g., `/api/v1/dive-sites/`)
- **Individual Endpoints**: Removed trailing slashes for individual resources (e.g., `/api/v1/dive-sites/{id}`)
- **Sub-resource Endpoints**: Proper handling of nested endpoints (e.g., `/api/v1/dive-sites/{id}/comments`)

**Files Modified:**
- `frontend/src/pages/DiveSites.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/DivingCenters.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/Home.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/AdminDiveSites.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/AdminDivingCenters.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/AdminUsers.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/AdminTags.js` - Fixed API calls with proper trailing slashes
- `frontend/src/contexts/AuthContext.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/DiveSiteDetail.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/DivingCenterDetail.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/EditDiveSite.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/EditDivingCenter.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/CreateDiveSite.js` - Fixed API calls with proper trailing slashes
- `frontend/src/pages/DiveSiteMap.js` - Fixed API calls with proper trailing slashes

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

### 🔧 Technical Improvements

#### **Docker Configuration**
- **Multi-stage Builds**: Optimized Docker images for production deployment
- **Environment Variables**: Proper handling of build-time environment variables
- **Dependency Management**: Improved package installation and caching
- **Security**: Non-root user execution and minimal attack surface

**Backend Dockerfile:**
```dockerfile
# Automatic database migrations
CMD ["sh", "-c", "python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

**Frontend Dockerfile:**
```dockerfile
# Build-time environment variables
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
```

#### **Deployment Documentation**
- **Comprehensive Guide**: Created detailed deployment documentation
- **Secret Management**: Proper documentation of `fly secrets` usage
- **Troubleshooting**: Added common issues and solutions
- **Step-by-step Instructions**: Clear deployment process documentation

**Documentation Files:**
- `FLY_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `API_CHANGELOG.md` - API changes documentation
- Updated `README.md` - Production deployment information

### 🐛 Bug Fixes

#### **Authentication Issues**
- **Immediate Logout**: Fixed users being logged out immediately after login
- **Google OAuth Errors**: Resolved `client_id=undefined` errors
- **API Endpoint Mismatches**: Fixed all trailing slash inconsistencies
- **Admin Page Access**: Resolved authentication issues for admin pages

#### **Database Issues**
- **Empty Tags**: Added sample tags to populate admin interface
- **Query Errors**: Fixed complex SQL queries causing internal server errors
- **Migration Issues**: Ensured all database migrations run properly

#### **Frontend Issues**
- **Build Errors**: Fixed `npm ci` issues and environment variable problems
- **API Communication**: Resolved 307 redirects and API call failures
- **Admin Interface**: Fixed admin pages not displaying content

### 📊 Performance Improvements

#### **Database Performance**
- **Query Optimization**: Simplified complex queries to improve performance
- **Indexing**: Proper database indexing for frequently queried fields
- **Connection Pooling**: Improved database connection management

#### **Frontend Performance**
- **Build Optimization**: Optimized React build process
- **Caching**: Improved React Query caching strategies
- **Bundle Size**: Reduced JavaScript bundle size for faster loading

### 🔒 Security Enhancements

#### **Environment Security**
- **Secret Management**: Moved all secrets to `fly secrets` instead of hardcoded values
- **CORS Configuration**: Proper CORS settings for production domains
- **Authentication**: Improved JWT token handling and validation

#### **Deployment Security**
- **Non-root Containers**: Docker containers run as non-root users
- **Minimal Attack Surface**: Reduced container image size and dependencies
- **Network Security**: Internal service communication using Fly.io's secure network

### 📝 Documentation Updates

#### **Deployment Documentation**
- **Complete Setup Guide**: Step-by-step deployment instructions
- **Troubleshooting Section**: Common issues and solutions
- **Configuration Examples**: Sample configuration files and commands
- **Maintenance Guide**: Ongoing maintenance and update procedures

#### **API Documentation**
- **Endpoint Consistency**: Updated all API endpoint documentation
- **Authentication**: Proper authentication documentation
- **Error Handling**: Comprehensive error response documentation

### 🧪 Testing

#### **Backend Testing**
- **All Tests Passing**: 56/56 tests passing
- **API Endpoint Testing**: Verified all endpoints work correctly
- **Authentication Testing**: Confirmed proper authentication flow
- **Database Testing**: Validated all database operations

#### **Frontend Testing**
- **Build Testing**: Verified production builds work correctly
- **API Communication**: Tested all frontend-backend communication
- **User Interface**: Confirmed all pages render and function properly
- **Authentication Flow**: Validated login/logout functionality

### 🚀 Deployment Status

#### **Production Environment**
- **Frontend**: ✅ Deployed and accessible at https://divemap.fly.dev
- **Backend**: ✅ Deployed and accessible at https://divemap-backend.fly.dev
- **Database**: ✅ Deployed with persistent storage
- **Authentication**: ✅ Working with proper JWT tokens
- **Admin Interface**: ✅ Functional with proper access control

#### **Monitoring and Logs**
- **Application Logs**: Available via `fly logs`
- **Database Logs**: Monitored for performance and errors
- **Error Tracking**: Comprehensive error handling and logging
- **Performance Monitoring**: Application performance tracking

---

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