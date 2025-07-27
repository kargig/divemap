# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.

## Features

- **User Management**: Registration, login, and profile management
- **Dive Sites**: Comprehensive CRUD operations with detailed information
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Rating System**: Rate dive sites and diving centers (1-10 scale)
- **Comments**: User comments on dive sites and diving centers
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities
- **Media Management**: Upload and display photos and videos for dive sites
- **Gear Rental**: Manage diving center gear rental costs
- **Tag System**: Comprehensive tag/label management for dive sites
- **Admin Dashboard**: Full administrative interface with separate management pages

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

### Backend
- **Python** - Programming language
- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Pydantic** - Data validation
- **JWT** - Authentication
- **MySQL** - Database
- **Docker** - Containerization

### Testing
- **Pytest** - Backend testing framework
- **Node.js** - Frontend validation scripts
- **Automated Testing** - Regression prevention and data type validation

## Security

This application implements comprehensive security measures to protect user data and prevent common vulnerabilities:

### Security Features
- **Authentication & Authorization**: JWT-based authentication with role-based access control
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

### Security Best Practices
- All secrets managed via environment variables
- Regular security updates and dependency scanning
- Comprehensive logging and monitoring capabilities
- Production-ready security configuration

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

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

5. **Default admin credentials**
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
- **View, Edit, Delete** actions with confirmation
- **Loading states** and error handling
- **Responsive design** with hover effects

#### **Diving Centers Management** (`/admin/diving-centers`)
- **Full management** of diving centers
- **Contact information** display (email, phone, website)
- **Location data** with coordinates
- **Rating information** and status
- **View, Edit, Delete** functionality

#### **Tag Management** (`/admin/tags`)
- **Complete CRUD operations** with modal forms
- **Create and Edit** modals with validation
- **Delete protection** for tags with associated dive sites
- **Usage statistics** showing dive site counts
- **Real-time updates** with React Query

#### **User Management** (`/admin/users`)
- **Complete user management** system
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

### **Enhanced Admin Management System**
- **Separate Admin URLs**: Dedicated pages for each management area
  - `/admin` - Main dashboard with navigation cards
  - `/admin/dive-sites` - Dive sites management
  - `/admin/diving-centers` - Diving centers management
  - `/admin/tags` - Tag management with full CRUD
  - `/admin/users` - User management with role control
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

### **Advanced User Management**
- **Complete User CRUD**: Create, edit, delete users
- **Role Assignment**: Admin, moderator, and user roles
- **Status Control**: Enable/disable user accounts
- **Password Management**: Optional password updates
- **Safety Checks**: Prevent self-deletion and unauthorized actions

### **Enhanced Dive Sites Management**
- **Comprehensive Table View**: Tags, ratings, difficulty levels
- **Action Buttons**: View, edit, delete with confirmation dialogs
- **Loading States**: Proper loading indicators
- **Error Handling**: Comprehensive error messages
- **Responsive Design**: Mobile-friendly interface

### **Improved Diving Centers Management**
- **Contact Information**: Email, phone, website display
- **Location Data**: Coordinates and mapping information
- **Rating Display**: Average ratings and status
- **Action Management**: View, edit, delete operations
- **Enhanced UX**: Hover effects and visual feedback

### **Admin Management System**
- **Comprehensive Admin Dashboard**: Tag management, user management, dive sites, and diving centers
- **Tag Management**: View all tags with count of associated dive sites
- **User Management**: List, edit, delete, and create users with role and status control
- **User Approval System**: New users disabled by default, require admin approval
- **Role-Based Access Control**: User, Moderator, and Admin roles with appropriate permissions

### **User Registration and Approval**
- **Google OAuth Integration**: Login button for Google authentication (stub implementation)
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