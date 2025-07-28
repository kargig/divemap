# Development Overview

This document provides a comprehensive guide for developers working on the Divemap project, including setup, architecture, development workflow, recent feature implementations, and utility scripts.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Code Standards](#code-standards)
7. [Testing Strategy](#testing-strategy)
8. [GitHub Actions](#github-actions)
9. [Recent Features](#recent-features)
10. [API Fixes](#api-fixes)
11. [Utility Scripts](#utility-scripts)
12. [Deployment](#deployment)

## Overview

Divemap is a comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers. The application features interactive maps, user authentication, content management, and a robust API.

### Key Features

- **User Management**: Registration, login, and profile management with Google OAuth
- **Dive Sites**: Comprehensive CRUD operations with detailed information
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Rating System**: Rate dive sites and diving centers (1-10 scale)
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities
- **Admin Dashboard**: Full administrative interface with separate management pages
- **Multi-Currency Support**: Support for 10 major world currencies
- **Tag System**: Comprehensive tag/label management for dive sites

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
- **Puppeteer** - Frontend testing
- **Node.js** - Frontend validation scripts
- **Automated Testing** - Regression prevention and data type validation

## Development Setup

### Prerequisites

1. **Python 3.11+**
2. **Node.js 16+**
3. **Docker and Docker Compose**
4. **MySQL 8.0+**

### Environment Setup

#### 1. Clone Repository
```bash
git clone <repository-url>
cd divemap
```

#### 2. Set Up Environment Variables
```bash
# Copy example environment file
cp env.example .env

# Edit environment variables
nano .env
```

#### 3. Start Services with Docker
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

#### 4. Verify Setup
```bash
# Check frontend
curl http://localhost:3000

# Check backend
curl http://localhost:8000/health

# Check database
docker-compose exec db mysql -u divemap_user -p -e "SELECT 1"
```

## Project Structure

```
divemap/
├── backend/                 # FastAPI backend
│   ├── app/                # Application code
│   │   ├── routers/        # API routes
│   │   ├── models.py       # Database models
│   │   ├── schemas.py      # Pydantic schemas
│   │   └── main.py         # FastAPI application
│   ├── migrations/         # Alembic migrations
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/                # Source code
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utility functions
│   ├── tests/              # Frontend tests
│   └── package.json        # Node.js dependencies
├── database/               # Database configuration
├── docs/                   # Documentation
├── utils/                  # Utility scripts
└── docker-compose.yml      # Development environment
```

## Development Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Test changes
# Commit changes
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature
```

### 2. Database Changes
```bash
# Modify models in backend/app/models.py
# Generate migration
cd backend
python create_migration.py "Description of changes"

# Review migration
cat migrations/versions/latest_migration.py

# Apply migration
python run_migrations.py
```

### 3. API Development
```bash
# Add new endpoints in backend/app/routers/
# Update schemas in backend/app/schemas.py
# Test endpoints
curl -X GET http://localhost:8000/api/v1/endpoint
```

### 4. Frontend Development
```bash
# Add new components in frontend/src/components/
# Add new pages in frontend/src/pages/
# Update routing in frontend/src/App.js
# Test changes
npm test
```

## Code Standards

### Python (Backend)
- **PEP 8** compliance
- **Type hints** for all functions
- **Docstrings** for all public functions
- **Pydantic models** for data validation
- **SQLAlchemy ORM** for database operations

### JavaScript (Frontend)
- **ESLint** configuration
- **Prettier** formatting
- **React hooks** for state management
- **Functional components** with hooks
- **PropTypes** for component validation

### Database
- **Alembic migrations** for all schema changes
- **Foreign key constraints** for data integrity
- **Indexes** for performance optimization
- **Consistent naming** conventions

## Testing Strategy

### Backend Testing
```bash
# Run all tests
cd backend
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_auth.py -v

# Run with coverage
python -m pytest tests/ --cov=app --cov-report=html
```

### Frontend Testing
```bash
# Run validation tests
cd frontend
node tests/validate_frontend.js

# Run regression tests
node tests/test_regressions.js

# Run all frontend tests
npm test
```

### Integration Testing
```bash
# Test full application
docker-compose up -d
npm run test:integration
```

## GitHub Actions

The project uses GitHub Actions for continuous integration and automated testing. See [GitHub Actions Documentation](./github-actions.md) for detailed information about:

- **Backend Tests Workflow**: Automated testing on PR creation and commits
- **Environment Setup**: Virtual environment and service container configuration
- **Coverage Reporting**: Integration with Codecov for coverage tracking
- **Troubleshooting**: Common issues and debugging steps

## Recent Features

### View Tracking

View counts are tracked for dive sites and diving centers, displayed only to admin users.

**Implementation:**
- **Database**: Added `view_count` column to `dive_sites` and `diving_centers` tables
- **API**: View counts included only for admin users in responses
- **Frontend**: Added "Views" column to admin pages
- **Security**: View counts hidden from regular users

**Usage:**
- View counts increment on each detail page visit
- Only admins can see view counts in admin interface
- Regular users experience unchanged

### Admin Page Sorting

All columns in admin pages are now sortable with visual indicators.

**Features:**
- **Sortable Columns**: Name, difficulty, rating, views (dive sites); name, contact, rating, views (diving centers)
- **Behavior**: Click to sort, click again to reverse
- **Visual Feedback**: Chevron icons show sort state and direction
- **Smart Sorting**: Handles string and numeric data appropriately

**Technical Details:**
- Uses React `useMemo` for performance optimization
- Handles null/undefined values gracefully
- Integrates with existing selection and mass delete features

## API Fixes

### Trailing Slash Standardization

Standardized trailing slash handling across all API endpoints.

**Issue:** Frontend was using trailing slashes in API URLs for individual resource endpoints, but the backend FastAPI routes don't have trailing slashes for those endpoints. This caused 307 redirects.

**Solution:** Fixed all frontend API calls to remove trailing slashes from individual resource endpoints while keeping them for list endpoints.

**FastAPI Routing Pattern:**
- List endpoints: `/api/v1/resource/` (with trailing slash)
- Individual endpoints: `/api/v1/resource/{id}` (without trailing slash)

**Files Modified:**
- `frontend/src/pages/DiveSiteDetail.js`
- `frontend/src/pages/DiveSiteMap.js`
- `frontend/src/pages/EditDiveSite.js`
- `frontend/src/pages/CreateDiveSite.js`
- `frontend/src/pages/DivingCenterDetail.js`
- `frontend/src/pages/EditDivingCenter.js`

## Utility Scripts

The `utils/` directory contains utility scripts for development and maintenance purposes.

### Database Utilities

#### **export_database_data.py**
- **Purpose**: Export all current database data as SQL INSERT statements
- **Output**: SQL statements that can be included in init.sql
- **Tables Exported**:
  - users
  - dive_sites
  - diving_centers
  - available_tags
  - dive_site_tags
  - site_media
  - site_ratings
  - site_comments
  - center_ratings
  - center_comments
  - center_dive_sites
  - gear_rental_costs
  - parsed_dive_trips
  - newsletters

**Usage:**
```bash
# Export current database data to SQL statements
cd utils
python export_database_data.py > ../local_data_export.sql
```

**Features:**
- **SQL String Escaping**: Properly escapes quotes and special characters
- **NULL Handling**: Correctly handles NULL values in database
- **Comprehensive Export**: Exports all tables with all fields
- **Error Handling**: Graceful error handling and session management

**Requirements:**
- Python 3.11+
- SQLAlchemy
- PyMySQL
- Access to the Divemap database

**Environment Setup:**
```bash
# Set database connection (if not using default)
export DATABASE_URL="mysql+pymysql://user:password@host:port/database"
```

**Notes:**
- These scripts are for development and maintenance purposes
- Always backup your database before running export scripts
- Generated SQL files can be used to recreate database state
- Scripts are designed to work with the current database schema

## Deployment

### Development Deployment
```bash
# Start development environment
docker-compose up -d

# Access applications
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Database: localhost:3306
```

### Production Deployment
```bash
# Deploy to Fly.io
fly deploy

# Check deployment status
fly status
```

### Environment Variables
```bash
# Required environment variables
DATABASE_URL=mysql://user:password@host:port/database
SECRET_KEY=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Related Documentation

- **[Architecture Documentation](./architecture.md)** - System design and components
- **[API Documentation](./api.md)** - API endpoints and usage
- **[Database Documentation](./database.md)** - Database schema and migrations
- **[Testing Documentation](./testing.md)** - Testing procedures and best practices 