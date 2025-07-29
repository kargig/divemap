# Divemap Changelog

This document tracks all recent changes, improvements, and bug fixes to the Divemap application.

## [Latest Release] - 2025-07-29

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