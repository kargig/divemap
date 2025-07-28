# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.



## Features

- **User Management**: Registration, login, and profile management with Google OAuth support
- **Dive Sites**: Comprehensive CRUD operations with detailed information including maximum depth, alternative names, country, and region
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Rating System**: Rate dive sites and diving centers (1-10 scale) with proper state management
- **Comments**: User comments on dive sites and diving centers
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities including country and region filters
- **Geocoding Integration**: Automatic country and region suggestions based on coordinates using OpenStreetMap
- **Media Management**: Upload and display photos and videos for dive sites
- **Gear Rental**: Manage diving center gear rental costs with multi-currency support
- **Multi-Currency System**: Support for 10 major world currencies with Euro (€) as default
- **Tag System**: Comprehensive tag/label management for dive sites with enhanced validation
- **Admin Dashboard**: Full administrative interface with separate management pages
- **Mass Operations**: Bulk delete functionality for admin management
- **Google OAuth**: Secure authentication with Google accounts
- **Database Migrations**: Alembic-based version-controlled database schema management
- **Enhanced Validation**: Mandatory coordinate fields with client and server-side validation
- **Form Field Management**: Intelligent handling of optional fields with proper empty value conversion
- **Cache Management**: Improved React Query cache management for seamless user experience
- **Enhanced User Profiles**: Diving certification tracking and dive count management
- **Password Management**: Secure password change functionality with current password verification
- **Comment Credentials**: User diving information displayed alongside comments
- **Database Connectivity**: Robust startup process with database availability checking
- **Container Optimization**: Pre-compiled wheels and IPv6 support for cloud deployment

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
- **Docker** - Containerization with optimized builds
- **Google Auth** - OAuth verification
- **Netcat-openbsd** - IPv6-compatible database connectivity checking

### Testing
- **Pytest** - Backend testing framework
- **Node.js** - Frontend validation scripts
- **Automated Testing** - Regression prevention and data type validation

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

## Documentation

For comprehensive documentation, see the [docs/](./docs/) directory:

- **[Getting Started](./docs/getting-started/README.md)** - Installation and setup guide
- **[Development Guide](./docs/development/README.md)** - Development setup and workflow
- **[API Documentation](./docs/development/api.md)** - API endpoints and usage
- **[Database Guide](./docs/development/database.md)** - Database documentation and migrations
- **[Testing Guide](./docs/development/testing.md)** - Testing procedures and best practices
- **[Deployment Guide](./docs/deployment/README.md)** - Deployment strategies and infrastructure
- **[Security Documentation](./docs/security/README.md)** - Security measures and best practices

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

### Database
The application uses MySQL for data storage. The database is automatically initialized with sample data when the containers start.

### Database Migrations
Database schema changes are managed using Alembic migrations:

```bash
# Run migrations manually
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Create new migration
python create_migration.py "Description of changes"

# Run migrations
python run_migrations.py

# Check migration status
alembic current
alembic history
```

**Note**: Migrations run automatically before the backend starts in Docker containers.

## Recent Enhancements

### **Google OAuth Authentication**
- **Google Sign-In Integration**: Complete OAuth 2.0 implementation
- **Secure Token Verification**: Backend verification with Google's servers
- **Automatic User Creation**: New users created from Google data
- **Account Linking**: Existing users can link Google accounts

### **Mass Delete Functionality**
- **Bulk Operations**: Select multiple items for deletion
- **Admin Management**: Available on all admin pages
- **Safety Features**: Protection against deleting used tags and self-deletion

### **Enhanced Admin Management System**
- **Separate Admin URLs**: Dedicated pages for each management area
- **Enhanced Navigation**: Dropdown menu in navbar for admin users
- **Modal Forms**: Inline create/edit forms for tags and users
- **Real-time Updates**: React Query integration for instant data refresh

### **Comprehensive Tag Management**
- **Full CRUD Operations**: Create, read, update, delete tags
- **Modal Forms**: Clean create and edit interfaces
- **Delete Protection**: Tags with associated dive sites cannot be deleted
- **Usage Statistics**: Display dive site counts for each tag

### **Advanced User Management**
- **Complete User CRUD**: Create, edit, delete users
- **Role Assignment**: Admin, moderator, and user roles
- **Status Control**: Enable/disable user accounts
- **Password Management**: Optional password updates

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
