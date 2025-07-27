# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.

## Features

- **User Management**: Registration, login, and profile management with Google OAuth support
- **Dive Sites**: Comprehensive CRUD operations with detailed information
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Rating System**: Rate dive sites and diving centers (1-10 scale)
- **Comments**: User comments on dive sites and diving centers
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities
- **Media Management**: Upload and display photos and videos for dive sites
- **Gear Rental**: Manage diving center gear rental costs with multi-currency support
- **Multi-Currency System**: Support for 10 major world currencies with Euro (€) as default
- **Tag System**: Comprehensive tag/label management for dive sites
- **Admin Dashboard**: Full administrative interface with separate management pages
- **Mass Operations**: Bulk delete functionality for admin management
- **Google OAuth**: Secure authentication with Google accounts
- **Database Migrations**: Alembic-based version-controlled database schema management

## Tech Stack

### Frontend
- **React** - UI framework
- **React Router DOM** - Client-side routing
- **React Query** - Data fetching and caching
- **React Hook Form** - Form handling
- **React Hot Toast** - Notifications
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **OpenLayers** - Interactive maps
- **Axios** - HTTP client
- **Google Identity Services** - OAuth authentication

### Backend
- **Python** - Programming language
- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **Pydantic** - Data validation
- **JWT** - Authentication
- **MySQL** - Database
- **Docker** - Containerization
- **Google Auth** - OAuth verification

### Testing
- **Pytest** - Backend testing framework
- **Node.js** - Frontend validation scripts
- **Automated Testing** - Regression prevention and data type validation

## Security

This application implements comprehensive security measures to protect user data and prevent common vulnerabilities:

### Security Features
- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Google OAuth Integration**: Secure authentication with Google Identity Services
- **Password Security**: Strong password requirements with bcrypt hashing (12 rounds)
- **Rate Limiting**: Comprehensive rate limiting on all endpoints to prevent abuse
- **Input Validation**: Strict input validation and sanitization using Pydantic models
- **Security Headers**: Complete set of HTTP security headers (CSP, XSS Protection, etc.)
- **CORS Protection**: Restrictive CORS configuration
- **SQL Injection Prevention**: Parameterized queries and input sanitization
- **Docker Security**: Container security with no-new-privileges and environment variables

### Security Vulnerabilities Fixed
- Updated all Python dependencies to fix known CVEs
- Fixed Node.js package vulnerabilities with overrides
- Implemented proper input validation and sanitization
- Added comprehensive rate limiting
- Enhanced authentication security
- Integrated Google OAuth with secure token verification

### Security Best Practices
- All secrets managed via environment variables
- Regular security updates and dependency scanning
- Comprehensive logging and monitoring capabilities
- Production-ready security configuration
- Google OAuth token verification with Google's servers

For detailed security information, see [SECURITY.md](SECURITY.md).

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd divemap
   ```

2. **Set up environment variables (recommended for production)**
   ```bash
   # Copy and modify the example environment file
   cp .env.example .env
   # Edit .env with your secure passwords and secrets
   ```

3. **Configure Google OAuth (optional but recommended)**
   ```bash
   # Follow the setup guide for Google OAuth
   # See GOOGLE_OAUTH_SETUP.md for detailed instructions
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

6. **Default admin credentials**
   - Username: `admin`
   - Password: `Admin123!`

**⚠️ Security Note**: Change default passwords immediately in production environments.

## Development

### Prerequisites
- Docker and Docker Compose
- Node.js (for local development and testing)
- Python 3.11+ (for local development)

### Running Tests
```bash
# Backend tests
docker-compose exec backend python -m pytest

# Frontend validation
node validate_frontend.js

# Regression testing
node test_regressions.js
```

### Testing Infrastructure

The project includes comprehensive testing infrastructure:

- **Backend Tests**: Pytest suite with fixtures for isolated testing
- **Frontend Validation**: Automated scripts for API health checks
- **Regression Testing**: Prevention of common frontend errors
- **Data Type Safety**: Validation of API response types

### Database
The application uses MySQL for data storage. The database is automatically initialized with sample data when the containers start.

### Database Migrations
Database schema changes are managed using Alembic migrations:

```bash
# Run migrations manually
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python run_migrations.py

# Create new migration
python create_migration.py "Description of changes"

# Check migration status
alembic current
alembic history
```

**Note**: Migrations run automatically before the backend starts in Docker containers.

## Admin Interface

### Admin Dashboard Structure

The admin interface is organized into separate management pages for better organization and user experience:

#### **Main Admin Dashboard** (`/admin`)
- **Overview dashboard** with navigation cards
- **Quick access** to all management areas
- **System statistics** and overview information

#### **Dive Sites Management** (`/admin/dive-sites`)
- **Complete CRUD operations** for dive sites
- **Enhanced table view** with tags and ratings
- **Mass delete functionality** for bulk operations
- **View, Edit, Delete** actions with confirmation
- **Loading states** and error handling
- **Responsive design** with hover effects

#### **Diving Centers Management** (`/admin/diving-centers`)
- **Full management** of diving centers
- **Mass delete functionality** for bulk operations
- **Contact information** display (email, phone, website)
- **Location data** with coordinates
- **Rating information** and status
- **View, Edit, Delete** functionality

#### **Tag Management** (`/admin/tags`)
- **Complete CRUD operations** with modal forms
- **Mass delete functionality** with protection for used tags
- **Create and Edit** modals with validation
- **Delete protection** for tags with associated dive sites
- **Usage statistics** showing dive site counts
- **Real-time updates** with React Query

#### **User Management** (`/admin/users`)
- **Complete user management** system
- **Mass delete functionality** with self-deletion protection
- **Create new users** with role assignment
- **Edit user details** including roles and status
- **Delete users** with safety checks
- **Password management** (optional updates)

### Admin Navigation

The admin interface includes an enhanced navigation system:

- **Dropdown menu** in the navbar for admin users
- **Direct links** to each admin section
- **Icon-based navigation** for better UX
- **Click-outside** to close functionality
- **Smooth transitions** and hover effects

## API Endpoints

For detailed API documentation and recent changes, see [API_CHANGELOG.md](API_CHANGELOG.md).

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/google-login` - Google OAuth authentication
- `GET /api/v1/auth/me` - Get current user info

### Users
- `GET /api/v1/users/` - Get all users (admin only)
- `GET /api/v1/users/{user_id}` - Get user by ID
- `PUT /api/v1/users/{user_id}` - Update user profile

### Dive Sites
- `GET /api/v1/dive-sites/` - Get all dive sites
- `POST /api/v1/dive-sites/` - Create dive site (admin/moderator)
- `GET /api/v1/dive-sites/{id}` - Get dive site by ID
- `PUT /api/v1/dive-sites/{id}` - Update dive site (admin/moderator)
- `DELETE /api/v1/dive-sites/{id}` - Delete dive site (admin/moderator)
- `POST /api/v1/dive-sites/{id}/rate` - Rate dive site
- `GET /api/v1/dive-sites/{id}/comments` - Get dive site comments
- `POST /api/v1/dive-sites/{id}/comments` - Add comment to dive site

### Diving Centers
- `GET /api/v1/diving-centers/` - Get all diving centers
- `POST /api/v1/diving-centers/` - Create diving center (admin/moderator)
- `GET /api/v1/diving-centers/{id}` - Get diving center by ID
- `PUT /api/v1/diving-centers/{id}` - Update diving center (admin/moderator)
- `DELETE /api/v1/diving-centers/{id}` - Delete diving center (admin/moderator)
- `POST /api/v1/diving-centers/{id}/rate` - Rate diving center
- `GET /api/v1/diving-centers/{id}/comments` - Get diving center comments
- `POST /api/v1/diving-centers/{id}/comments` - Add comment to diving center

### Media Management
- `GET /api/v1/dive-sites/{id}/media` - Get dive site media
- `POST /api/v1/dive-sites/{id}/media` - Upload media to dive site
- `DELETE /api/v1/dive-sites/{id}/media/{media_id}` - Delete dive site media

### Gear Rental Management
- `GET /api/v1/diving-centers/{id}/gear-rental` - Get diving center gear rental costs
- `POST /api/v1/diving-centers/{id}/gear-rental` - Add gear rental cost
- `PUT /api/v1/diving-centers/{id}/gear-rental/{gear_id}` - Update gear rental cost
- `DELETE /api/v1/diving-centers/{id}/gear-rental/{gear_id}` - Delete gear rental cost

### Tag Management
- `GET /api/v1/tags/` - Get all available tags
- `GET /api/v1/tags/with-counts` - Get tags with dive site counts
- `POST /api/v1/tags/` - Create new tag (admin/moderator)
- `PUT /api/v1/tags/{tag_id}` - Update tag (admin/moderator)
- `DELETE /api/v1/tags/{tag_id}` - Delete tag (admin/moderator)
- `POST /api/v1/tags/dive-sites/{dive_site_id}/tags` - Add tag to dive site
- `DELETE /api/v1/tags/dive-sites/{dive_site_id}/tags/{tag_id}` - Remove tag from dive site

See the full API documentation at http://localhost:8000/docs

## Recent Enhancements

### **Google OAuth Authentication**
- **Google Sign-In Integration**: Complete OAuth 2.0 implementation
- **Secure Token Verification**: Backend verification with Google's servers
- **Automatic User Creation**: New users created from Google data
- **Account Linking**: Existing users can link Google accounts
- **Environment Configuration**: Easy setup with environment variables
- **Frontend Integration**: Google Sign-In buttons on login/register pages
- **Error Handling**: Comprehensive error handling and user feedback
- **Security**: Rate limiting and proper token validation

### **Mass Delete Functionality**
- **Bulk Operations**: Select multiple items for deletion
- **Admin Management**: Available on all admin pages (dive sites, diving centers, tags, users)
- **Safety Features**: Protection against deleting used tags and self-deletion
- **Confirmation Dialogs**: Clear confirmation with item names
- **Visual Feedback**: Loading states and success/error messages
- **Responsive Design**: Works on all screen sizes

### **Enhanced Admin Management System**
- **Separate Admin URLs**: Dedicated pages for each management area
  - `/admin` - Main dashboard with navigation cards
  - `/admin/dive-sites` - Dive sites management with mass delete
  - `/admin/diving-centers` - Diving centers management with mass delete
  - `/admin/tags` - Tag management with full CRUD and mass delete
  - `/admin/users` - User management with role control and mass delete
- **Enhanced Navigation**: Dropdown menu in navbar for admin users
- **Improved UX**: Card-based dashboard with visual icons and descriptions
- **Modal Forms**: Inline create/edit forms for tags and users
- **Real-time Updates**: React Query integration for instant data refresh

### **Comprehensive Tag Management**
- **Full CRUD Operations**: Create, read, update, delete tags
- **Modal Forms**: Clean create and edit interfaces
- **Delete Protection**: Tags with associated dive sites cannot be deleted
- **Usage Statistics**: Display dive site counts for each tag
- **Form Validation**: Client-side validation with user feedback
- **Loading States**: Visual feedback during operations
- **Mass Delete**: Bulk delete with protection for used tags

### **Advanced User Management**
- **Complete User CRUD**: Create, edit, delete users
- **Role Assignment**: Admin, moderator, and user roles
- **Status Control**: Enable/disable user accounts
- **Password Management**: Optional password updates
- **Safety Checks**: Prevent self-deletion and unauthorized actions
- **Mass Delete**: Bulk user deletion with self-deletion protection

### **Enhanced Dive Sites Management**
- **Comprehensive Table View**: Tags, ratings, difficulty levels
- **Action Buttons**: View, edit, delete with confirmation dialogs
- **Loading States**: Proper loading indicators
- **Error Handling**: Comprehensive error messages
- **Responsive Design**: Mobile-friendly interface
- **Mass Delete**: Bulk delete functionality for dive sites

### **Improved Diving Centers Management**
- **Contact Information**: Email, phone, website display
- **Location Data**: Coordinates and mapping information
- **Rating Display**: Average ratings and status
- **Action Management**: View, edit, delete operations
- **Enhanced UX**: Hover effects and visual feedback
- **Mass Delete**: Bulk delete functionality for diving centers

### **Toast Notification Improvements**
- **Positioning**: Notifications appear below navbar to prevent navigation blocking
- **Duration**: Reduced to 500ms for quicker disappearance
- **Z-index Management**: Proper layering with navbar
- **Responsive Design**: Works on all screen sizes

### **Layout Improvements**
- **Fixed Navbar**: Sticky navigation with proper z-index
- **Content Spacing**: Adjusted padding to account for fixed navbar
- **Table Responsiveness**: Text wrapping to prevent horizontal scrollbars
- **Container Width**: Increased max-width for better content display

### **Admin Management System**
- **Comprehensive Admin Dashboard**: Tag management, user management, dive sites, and diving centers
- **Tag Management**: View all tags with count of associated dive sites
- **User Management**: List, edit, delete, and create users with role and status control
- **User Approval System**: New users disabled by default, require admin approval
- **Role-Based Access Control**: User, Moderator, and Admin roles with appropriate permissions

### **User Registration and Approval**
- **Google OAuth Integration**: Complete login and registration with Google
- **Admin Approval Workflow**: New users must be approved by admin before accessing features
- **User Status Management**: Enable/disable users with immediate effect
- **Registration Feedback**: Clear messaging about approval requirements

### **Map UI and Zoom Management**
- **Zoom Level Debugging**: Real-time zoom level indicator for optimal map configuration
- **Smart Zoom Behavior**: Keeps zoom 5 levels before maximum for better context
- **Map Counter Positioning**: Moved to bottom-left for improved UX
- **Configurable Max Zoom**: Set to level 18 for optimal detail without excessive zoom
- **Map Fit Optimization**: Different zoom behavior for single vs multiple site selection

### **Testing Infrastructure**
- ✅ Comprehensive backend test suite with Pytest
- ✅ Frontend validation scripts for regression prevention
- ✅ Data type safety testing and validation
- ✅ Automated testing for common frontend errors

### User Experience Improvements
- ✅ Rating display changed from stars to numeric format (X.X/10)
- ✅ Enhanced dive site details with comprehensive information
- ✅ Improved search and filtering with parameter validation
- ✅ Better error handling and loading states

### Admin Functionality
- ✅ Comprehensive edit forms for dive sites and diving centers
- ✅ Media management for dive sites
- ✅ Gear rental cost management for diving centers
- ✅ Protected routes for admin/moderator users

### Data Type Safety
- ✅ Fixed latitude/longitude type conversion issues
- ✅ Improved array safety checks
- ✅ API parameter filtering to prevent 422 errors
- ✅ Comprehensive error prevention guidelines

### Recent Bug Fixes (Latest)
- ✅ **Google OAuth Implementation**: Complete OAuth 2.0 integration with token verification
- ✅ **Mass Delete Functionality**: Bulk operations for all admin management pages
- ✅ **Toast Notification Fixes**: Proper positioning and duration management
- ✅ **Layout Improvements**: Fixed navbar and responsive table design
- ✅ **Dependency Management**: Fixed Google OAuth package conflicts
- ✅ **Database Migration**: Added google_id field to users table
- ✅ **Frontend Linting**: Fixed all ESLint errors and warnings
- ✅ **Create Pages Implementation**: Added missing create forms for dive sites and diving centers
- ✅ **Dive Sites API Serialization**: Fixed tag serialization issues that were causing 500 errors
- ✅ **Difficulty Level Validation**: Updated schema to support 'expert' difficulty level  
- ✅ **Tag Model Compatibility**: Fixed AvailableTag model field mapping (removed non-existent 'category' field)
- ✅ **Response Validation**: Fixed Pydantic response validation errors for dive sites endpoint
- ✅ **Admin Authentication**: Resolved admin login issues with updated password requirements
- ✅ **Docker Dependencies**: Fixed slowapi import errors in containerized environment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run the testing suite:
   ```bash
   node validate_frontend.js
   node test_regressions.js
   ```
6. Submit a pull request

## License

This project is licensed under the MIT License. 