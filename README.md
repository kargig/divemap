# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.



## Features

- **User Management**: Registration, login, and profile management with Google OAuth support
- **Dive Sites**: Comprehensive CRUD operations with detailed information including maximum depth, aliases, country, and region
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Diving Organizations**: Complete management system for diving organizations (PADI, SSI, GUE, etc.)
- **User Certifications**: Comprehensive certification tracking system with organization associations
- **Dive Logging**: Complete dive logging system with media uploads, tags, and statistics
- **Rating System**: Rate dive sites and diving centers (1-10 scale) with proper state management
- **Comments**: User comments on dive sites and diving centers
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities including country and region filters
- **Geocoding Integration**: Automatic country and region suggestions based on coordinates using OpenStreetMap
- **Media Management**: Upload and display photos and videos for dive sites and dives
- **Gear Rental**: Manage diving center gear rental costs with multi-currency support
- **Multi-Currency System**: Support for 10 major world currencies with Euro (€) as default
- **Tag System**: Comprehensive tag/label management for dive sites and dives with enhanced validation
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

### Data Population
After running migrations, populate diving organizations with initial data:

```bash
# Populate diving organizations
cd backend
source divemap_venv/bin/activate
python populate_diving_organizations.py

# List diving organizations
python populate_diving_organizations.py list
```

## Core Features

### **Comprehensive Dive Site Management**
- **Complete CRUD Operations**: Full create, read, update, delete functionality for dive sites
- **Advanced Search & Filtering**: Search by name, difficulty, country, region, and tags
- **Geocoding Integration**: Automatic country and region suggestions based on coordinates
- **Media Management**: Upload and display photos and videos for dive sites
- **Rating System**: 1-10 scale rating system with user feedback
- **Comment System**: User comments with diving credentials display
- **Tag System**: Comprehensive tagging with usage statistics and protection
- **Aliases System**: Multiple aliases per dive site for enhanced search and newsletter parsing

### **Diving Center Management**
- **Full Center Management**: Complete CRUD operations for diving centers
- **Gear Rental System**: Multi-currency gear rental cost management
- **Center-Dive Site Relationships**: Link diving centers to specific dive sites
- **Ownership System**: Claim and manage diving center ownership
- **Rating & Review System**: User ratings and comments for diving centers
- **Contact Information**: Email, phone, website, and location management

### **Diving Organizations & Certifications**
- **Organization Management**: Complete CRUD for diving organizations (PADI, SSI, GUE, etc.)
- **Pre-populated Data**: Top 10 diving organizations with comprehensive information
- **User Certification Tracking**: Users can manage their diving certifications
- **Organization Association**: Certifications linked to specific diving organizations
- **Active Status Management**: Users can activate/deactivate certifications
- **Public Profile Display**: Certifications visible on user profiles

### **Advanced Dive Logging System**
- **Comprehensive Dive Records**: Track dive details including depth, duration, visibility, and ratings
- **Media Uploads**: Photo and video uploads for dive memories
- **Tag System**: Tag dives for easy categorization and search
- **Privacy Controls**: Public and private dive visibility options
- **Diving Center Integration**: Link dives to specific diving centers
- **Dive Site Association**: Connect dives to existing dive sites
- **Statistics Tracking**: View counts, ratings, and dive statistics

### **Newsletter Management System**
- **AI-Powered Parsing**: OpenAI integration for intelligent newsletter content parsing
- **Dive Trip Extraction**: Automatically extract dive trip information from newsletters
- **Diving Center Matching**: Intelligent matching of diving centers from newsletter content
- **Dive Site Recognition**: Automatic recognition and linking of dive sites using aliases
- **Trip Management**: Create, update, and manage parsed dive trips
- **Multi-format Support**: Support for various newsletter formats and languages
- **Bulk Operations**: Mass upload and management of newsletter content

### **User Management & Authentication**
- **Google OAuth Integration**: Secure authentication with Google accounts
- **Role-Based Access Control**: Admin, moderator, and user roles with appropriate permissions
- **User Profile Management**: Comprehensive user profiles with diving information
- **Password Management**: Secure password change functionality
- **Account Status Control**: Enable/disable user accounts
- **Diving Credentials**: Track user certifications and dive counts

### **Interactive Map System**
- **OpenLayers Integration**: High-performance interactive maps
- **Dive Site Visualization**: Display dive sites with detailed information
- **Diving Center Mapping**: Show diving centers with contact and service information
- **Geographic Filtering**: Filter by location, country, and region
- **Responsive Design**: Mobile-friendly map interface

### **Advanced Search & Filtering**
- **Multi-criteria Search**: Search by name, difficulty, location, and tags
- **Geographic Filtering**: Filter by country and region
- **Rating-based Filtering**: Filter by minimum and maximum ratings
- **Tag-based Filtering**: Filter by multiple tags simultaneously
- **Pagination Support**: Efficient handling of large datasets

### **Admin Management System**
- **Comprehensive Admin Interface**: Dedicated admin pages for all management areas
- **Bulk Operations**: Mass delete functionality for efficient management
- **Real-time Updates**: React Query integration for instant data refresh
- **Modal Forms**: Clean inline create/edit interfaces
- **Safety Features**: Protection against accidental deletions and data loss

### **Multi-Currency Support**
- **10 Major Currencies**: Support for EUR, USD, GBP, AUD, CAD, CHF, JPY, SEK, NOK, DKK
- **Automatic Conversion**: Real-time currency conversion rates
- **Flexible Pricing**: Support for different currencies across the platform
- **User Preferences**: Currency selection based on user location

### **Security & Performance**
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Comprehensive API rate limiting with admin exemptions
- **Input Validation**: Comprehensive client and server-side validation
- **Database Migrations**: Alembic-based version-controlled schema management
- **Container Optimization**: Pre-compiled wheels and IPv6 support for cloud deployment

## API Documentation

For comprehensive API documentation including all endpoints, request/response formats, authentication methods, and usage examples, see the [API Documentation](./docs/development/api.md).

The API provides RESTful endpoints for:
- **Authentication & User Management** - Registration, login, profile management
- **Dive Sites** - CRUD operations, ratings, comments, media management
- **Diving Centers** - Full management with gear rental costs
- **Diving Organizations** - Complete organization management system
- **User Certifications** - Certification tracking with organization associations
- **Dive Logging** - Complete dive logging with media uploads and tags
- **Newsletter Management** - Upload, parse, and manage dive trip information
- **Tag System** - Comprehensive tag management for dive sites and dives
- **Media Management** - Photo and video uploads for dive sites and dives
- **Rating & Comment System** - User ratings and comments for dive sites and centers

Interactive API documentation is available at: http://localhost:8000/docs

## Contributing

We welcome contributions to Divemap! Please follow these guidelines:

### Development Setup
1. **Fork the repository** and clone it locally
2. **Set up the development environment** following the [Development Guide](./docs/development/README.md)
3. **Create a feature branch** for your changes
4. **Follow the coding standards** outlined in the [Architecture Documentation](./docs/development/architecture.md)

### Testing Requirements
Before submitting changes, ensure all tests pass:
```bash
# Backend tests
docker-compose exec backend python -m pytest

# Frontend validation
node validate_frontend.js

# Regression testing
node test_regressions.js
```

### Documentation
- **API Changes**: Update the [API Documentation](./docs/development/api.md)
- **Database Changes**: Follow the [Database Migration Guide](./docs/development/database.md)
- **Testing**: Refer to the [Testing Guide](./docs/development/testing.md)
- **Deployment**: Check the [Deployment Documentation](./docs/deployment/README.md)

### Code Quality
- Follow the established code style and patterns
- Add appropriate tests for new functionality
- Update documentation for any API or database changes
- Ensure all tests pass before submitting

### Pull Request Process
1. **Test thoroughly** - Run all tests and validation scripts
2. **Update documentation** - Include relevant documentation updates
3. **Provide clear descriptions** - Explain the purpose and impact of changes
4. **Reference issues** - Link to any related issues or discussions

For detailed development guidelines, see the [Development Documentation](./docs/development/README.md).

## License

This project is licensed under the MIT License. 
