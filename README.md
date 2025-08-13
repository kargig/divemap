# Divemap - Scuba Dive Site & Center Review Platform

A comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers.



## Features

### **Core Platform**
- **User Management**: Registration, login, and profile management with Google OAuth support
- **Dive Sites**: Comprehensive CRUD operations with detailed information including maximum depth, aliases, country, and region
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Diving Organizations**: Complete management system for diving organizations (PADI, SSI, GUE, etc.)
- **User Certifications**: Comprehensive certification tracking system with organization associations
- **Dive Logging**: Complete dive logging system with media uploads, tags, and statistics
- **Rating System**: Rate dive sites and diving centers (1-10 scale) with proper state management
- **Comments**: User comments on dive sites and diving centers with diving credentials display
- **Interactive Map**: View dive sites and diving centers on an interactive map using OpenLayers
- **Media Management**: Upload and display photos and videos for dive sites and dives
- **Tag System**: Comprehensive tag/label management for dive sites and dives with enhanced validation

### **Advanced Search & Filtering**
- **Multi-criteria Search**: Search by name, difficulty, location, and tags
- **Geographic Filtering**: Filter by country and region
- **Rating-based Filtering**: Filter by minimum and maximum ratings
- **Tag-based Filtering**: Filter by multiple tags simultaneously
- **Full-text Search**: Advanced search across multiple fields with location-based filtering
- **Trip Search**: Intelligent search across trip descriptions, requirements, and associated data
- **Duration Filtering**: Filter trips by minimum and maximum duration
- **Advanced Sorting**: Sort by relevance, date, duration, and other criteria
- **Pagination Support**: Efficient handling of large datasets

### **Admin Dashboard & System Monitoring**
- **System Overview Dashboard**: Real-time platform statistics including user counts, content metrics, and engagement data
- **System Health Monitoring**: CPU, memory, disk usage, and database connectivity monitoring
- **Recent Activity Tracking**: Monitor user registrations, content creation, comments, and system changes
- **Performance Metrics**: Track API response times, error rates, and system performance indicators
- **Backup & Export Management**: Automated data export and backup management capabilities
- **Permission System**: Comprehensive role-based access control with admin, moderator, and user roles
- **Bulk Operations**: Mass delete functionality for efficient management
- **Real-time Updates**: React Query integration for instant data refresh

### **Newsletter Management System**
- **AI-Powered Parsing**: OpenAI integration for intelligent newsletter content parsing
- **Dive Trip Extraction**: Automatically extract dive trip information from newsletters
- **Diving Center Matching**: Intelligent matching of diving centers from newsletter content
- **Dive Site Recognition**: Automatic recognition and linking of dive sites using aliases
- **Trip Management**: Create, update, and manage parsed dive trips
- **Multi-format Support**: Support for various newsletter formats and languages
- **Distance Calculations**: Haversine formula for accurate geographic distance calculations from user location
- **User Location Integration**: Geolocation API support with manual coordinate input fallback

### **Multi-Currency Support**
- **10 Major Currencies**: Support for EUR, USD, GBP, AUD, CAD, CHF, JPY, SEK, NOK, DKK
- **Automatic Conversion**: Real-time currency conversion rates
- **Flexible Pricing**: Support for different currencies across the platform
- **User Preferences**: Currency selection based on user location

### **Security & Performance**
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Comprehensive permission system with admin, moderator, and user roles
- **Rate Limiting**: Comprehensive API rate limiting with admin exemptions and intelligent client IP detection
- **Input Validation**: Comprehensive client and server-side validation
- **Database Migrations**: Alembic-based version-controlled schema management
- **Container Optimization**: Pre-compiled wheels and IPv6 support for cloud deployment
- **System Monitoring**: Real-time health monitoring and performance metrics
- **Client IP Detection**: Robust proxy header analysis for accurate client identification

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

- **[Getting Started](./docs/getting-started/README.md)** - User onboarding and application usage guide
- **[Development Guide](./docs/development/README.md)** - Development setup and workflow
- **[API Documentation](./docs/development/api.md)** - API endpoints and usage
- **[Database Guide](./docs/development/database.md)** - Database documentation and migrations
- **[Testing Guide](./docs/development/testing.md)** - Testing procedures and best practices
- **[Architecture Documentation](./docs/development/architecture.md)** - System architecture and admin dashboard features
- **[Permissions Guide](./docs/development/permissions.md)** - User roles, permissions, and access control
- **[Deployment Guide](./docs/deployment/README.md)** - Comprehensive deployment strategies, Docker, and infrastructure
- **[Fly.io Guide](./docs/deployment/fly-io.md)** - Advanced Fly.io deployment features and configuration
- **[Security Documentation](./docs/security/README.md)** - Security measures and best practices
- **[Maintenance Guide](./docs/maintenance/README.md)** - Database migrations, changelog, and troubleshooting
- **[Testing Strategy](./docs/TESTING_STRATEGY.md)** - Comprehensive testing strategy and procedures
- **[Importing Data](./docs/development/importing-data.md)** - Guide for importing dive sites and dives from Subsurface

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
- **System Administration** - Platform statistics, health monitoring, activity tracking, and client IP detection

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
- **Testing**: Refer to the [Testing Guide](./docs/development/testing.md) and [Testing Strategy](./docs/TESTING_STRATEGY.md)
- **Deployment**: Check the [Deployment Documentation](./docs/deployment/README.md) and [Fly.io Guide](./docs/deployment/fly-io.md)
- **User Experience**: Update the [Getting Started Guide](./docs/getting-started/README.md) for user-facing changes
- **Maintenance**: Refer to the [Maintenance Guide](./docs/maintenance/README.md) for operational procedures

**Note**: Documentation has been consolidated to eliminate duplication. See the [Documentation Index](./docs/README.md) for the complete structure.

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

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
