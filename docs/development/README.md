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
8. [Docker Configuration](#docker-configuration)
9. [GitHub Actions](#github-actions)
10. [Auto-Reload Configuration](#auto-reload-configuration)
11. [Recent Features](#recent-features)
12. [Diving Organizations Admin](#diving-organizations-admin)
13. [API Fixes](#api-fixes)
14. [Utility Scripts](#utility-scripts)
15. [React JavaScript Linting](#react-javascript-linting)
16. [Deployment](#deployment)

## React JavaScript Linting

For comprehensive React JavaScript linting setup and best practices, see the dedicated [React Linting Guide](./react-linting.md).

### Quick Start

```bash
# Install dependencies
cd frontend
npm install

# Run linting checks
npm run lint:check

# Fix issues automatically
npm run lint:fix
npm run format
```

## Overview

Divemap is a comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers. The application features interactive maps, user authentication, content management, and a robust API.

### Key Features

- **User Management**: Registration, login, and profile management with Google OAuth
- **Dive Sites**: Comprehensive CRUD operations with detailed information and aliases system
- **Diving Centers**: Full management with gear rental costs and dive site associations
- **Rating System**: Rate dive sites and diving centers (1-10 scale)
- **Interactive Map**: View dive sites and diving centers on an interactive map
- **Search & Filtering**: Advanced search and filtering capabilities
- **Admin Dashboard**: Full administrative interface with separate management pages
- **Multi-Currency Support**: Support for 10 major world currencies
- **Tag System**: Comprehensive tag/label management for dive sites
- **Aliases System**: Multiple aliases per dive site for enhanced search and newsletter parsing

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

## Rate Limiting Implementation

The application implements a sophisticated rate limiting system with special exemptions for development and administrative operations.

### Rate Limiting Features

#### **Custom Rate Limiting Decorator**
- **Decorator**: `@skip_rate_limit_for_admin()` with intelligent exemption logic
- **Localhost Detection**: Automatically detects requests from localhost IPs
- **Admin User Detection**: Verifies JWT tokens and checks admin privileges
- **Fallback Protection**: Robust error handling with fallback to normal rate limiting

#### **Rate Limiting Exemptions**

**Localhost Requests:**
- Exempt from all rate limiting for development and testing
- Detects: `127.0.0.1`, `::1`, `localhost`
- Facilitates development workflow and testing

**Admin Users:**
- Exempt from rate limiting on authenticated endpoints
- Allows administrators to perform bulk operations
- Only applies to endpoints requiring authentication

#### **Rate Limits by Endpoint**

| Endpoint Category | Rate Limit | Description |
|------------------|------------|-------------|
| **Dive Sites** | 100/minute | GET requests for dive site listings |
| **Dive Site Details** | 200/minute | GET requests for individual dive sites |
| **Dive Site Creation** | 10/minute | POST requests to create dive sites |
| **Dive Site Updates** | 20/minute | PUT requests to update dive sites |
| **User Registration** | 5/minute | POST requests for user registration |
| **User Login** | 10/minute | POST requests for authentication |

#### **Testing Rate Limiting**

```bash
# Run rate limiting tests
cd backend
python -m pytest tests/test_rate_limiting.py -v

# Test with real HTTP requests
python test_rate_limiting_real.py
```

#### **Development Considerations**

- **Localhost Exemption**: Development requests from localhost are not rate limited
- **Admin Operations**: Admin users can perform bulk operations without restrictions
- **Error Handling**: Comprehensive error handling ensures system stability
- **Security**: Regular users are still protected by appropriate rate limits

## Frontend Rate Limiting Error Handling

The frontend implements comprehensive error handling for rate limiting responses (HTTP 429) to provide a better user experience when API rate limits are exceeded.

### Frontend Rate Limiting Features

#### **API Interceptor Enhancement**
- **File**: `frontend/src/api.js`
- **Feature**: Automatically detects 429 responses and marks them as rate-limited
- **Extracts**: Retry-after time from headers or response data
- **Sets**: `error.isRateLimited = true` and `error.retryAfter` for consistent handling

#### **RateLimitError Component**
- **File**: `frontend/src/components/RateLimitError.js`
- **Features**: 
  - User-friendly error message with countdown timer
  - Retry button that appears after countdown
  - Visual indicators (warning icon, clock icon)
  - Responsive design with Tailwind CSS

#### **Rate Limit Handler Utility**
- **File**: `frontend/src/utils/rateLimitHandler.js`
- **Features**:
  - Centralized rate limiting error handling
  - Toast notifications for immediate feedback
  - Consistent error message formatting
  - Reusable across all components

#### **Component Integration**
- **DiveTrips.js**: Full rate limiting error handling implemented
- **DiveSites.js**: Full rate limiting error handling implemented
- **Both components now show**: 
  - RateLimitError component for visual feedback
  - Toast notifications for immediate awareness
  - Proper error handling for all API calls

### Error Handling Flow

1. **API Call Fails** → 429 response received
2. **API Interceptor** → Marks error as rate-limited, extracts retry-after time
3. **Component useEffect** → Detects rate-limited error, shows toast notification
4. **UI Rendering** → Shows RateLimitError component with countdown
5. **User Experience** → Clear message, countdown timer, retry option after timeout

### User Experience Features

- **Immediate Feedback**: Toast notification appears telling user about rate limiting
- **Visual Error Display**: RateLimitError component shows with:
  - Clear explanation of what happened
  - Countdown timer showing when user can retry
  - Retry button (appears after countdown)
- **Consistent Experience**: Same error handling across all components
- **User Guidance**: Clear instructions on what to do next

### Implementation Details

#### **API Response Interceptor**
```javascript
// Response interceptor to handle errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      // Rate limiting - extract retry after information if available
      const retryAfter = error.response.headers['retry-after'] || 
                        error.response.data?.retry_after || 30;
      error.retryAfter = retryAfter;
      error.isRateLimited = true;
    }
    return Promise.reject(error);
  }
);
```

#### **Component Error Handling**
```javascript
// Show toast notifications for rate limiting errors
useEffect(() => {
  handleRateLimitError(error, 'dive sites', () => window.location.reload());
}, [error]);

// Render rate limiting error component
if (error?.isRateLimited) {
  return (
    <RateLimitError
      retryAfter={error.retryAfter}
      onRetry={() => window.location.reload()}
    />
  );
}
```

#### **Rate Limit Handler Utility**
```javascript
export const handleRateLimitError = (error, context = 'data', onRetry = null) => {
  if (error?.isRateLimited) {
    const retryAfter = error.retryAfter || 30;
    
    // Show toast notification
    toast.error(
      `Rate limiting in effect for ${context}. Please wait ${retryAfter} seconds before trying again.`,
      {
        duration: 5000,
        position: 'top-center',
        id: `rate-limit-${context}`, // Prevent duplicate toasts
      }
    );
    
    // Execute retry callback if provided
    if (onRetry && typeof onRetry === 'function') {
      onRetry();
    }
  }
};
```

### Testing Frontend Rate Limiting

```bash
# Check frontend container logs for ESLint errors
docker logs divemap_frontend --tail 20

# Run ESLint on specific files
docker exec divemap_frontend npm run lint -- src/components/RateLimitError.js
docker exec divemap_frontend npm run lint -- src/pages/DiveSites.js

# Test rate limiting error handling
# Navigate to /dive-sites and trigger rate limiting (if possible)
# Verify RateLimitError component displays correctly
```

## Docker Configuration

The Divemap project uses multiple Dockerfiles to optimize for different environments and use cases.

### Dockerfile Overview

| Dockerfile | Purpose | Dependencies | Size | Use Case |
|------------|---------|--------------|------|----------|
| `frontend/Dockerfile` | Production | Production only | ~144MB | Production deployment |
| `frontend/Dockerfile.dev` | Development | All dependencies | ~200MB | Development & testing |

### Frontend Dockerfiles

#### 1. Production Dockerfile (`frontend/Dockerfile`)

**Purpose**: Optimized production build with minimal dependencies

**Key Features**:
- **Multi-stage build** for smaller final image
- **Production dependencies only** (excludes devDependencies)
- **Optimized build process** with `--only=production` flag
- **Static file serving** with `serve` package

**Build Command**:
```bash
cd frontend
docker build -t divemap_frontend_prod .
```

**Run Command**:
```bash
docker run -p 8080:8080 divemap_frontend_prod
```

**Dependencies Included**:
- React and React DOM
- React Router for navigation
- React Query for data fetching
- OpenLayers for maps
- Tailwind CSS for styling
- Axios for HTTP requests

**Dependencies Excluded**:
- Puppeteer (testing tool)
- Testing libraries
- Development tools

#### 2. Development Dockerfile (`frontend/Dockerfile.dev`)

**Purpose**: Full development environment with testing capabilities

**Key Features**:
- **All dependencies** including devDependencies
- **Testing tools** (Puppeteer for E2E tests)
- **Development server** with hot reload
- **Complete testing environment**

**Build Command**:
```bash
cd frontend
docker build -f Dockerfile.dev -t divemap_frontend_dev .
```

**Run Command**:
```bash
docker run -p 3000:3000 divemap_frontend_dev
```

**Dependencies Included**:
- All production dependencies
- Puppeteer for browser testing
- Testing libraries
- Development tools

### Dependency Management

#### Package.json Structure
```json
{
  "dependencies": {
    // Production dependencies only
    "react": "^18.2.0",
    "axios": "^1.3.4"
  },
  "devDependencies": {
    // Development and testing dependencies
    "puppeteer": "^21.11.0"
  }
}
```

#### Installation Commands
```bash
# Development (includes all dependencies)
npm install

# Production only (excludes devDependencies)
npm ci --only=production

# Docker production build
docker build -t divemap_frontend_prod .

# Docker development build
docker build -f Dockerfile.dev -t divemap_frontend_dev .
```

## Auto-Reload Configuration

The backend supports automatic reloading of Python files during development, controlled by the `ENVIRONMENT` environment variable.

### Environment-Based Auto-Reload

- **Development Mode** (`ENVIRONMENT=development`): Auto-reload enabled
- **Production Mode** (`ENVIRONMENT=production`): Auto-reload disabled

### Usage Options

#### 1. Default Development Setup
```bash
# Auto-reload enabled by default
docker-compose up backend
```

#### 2. Enhanced Development Setup
```bash
# Enhanced reload with directory watching
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up backend
```

This uses `startup_dev.sh` which includes:
- `--reload-dir /app/app` - Watch application files
- `--reload-dir /app/migrations` - Watch migration files

#### 3. Production Setup
```bash
# Explicitly disable auto-reload
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up backend
```

### How Auto-Reload Works

When `ENVIRONMENT=development`:

1. **File Monitoring**: Uvicorn watches Python files in the application directory
2. **Change Detection**: When a `.py` file is modified, the server detects the change
3. **Automatic Restart**: The server restarts automatically to load the new code
4. **Fast Reload**: Only the necessary parts are restarted, not the entire application

### Benefits

- **Immediate Feedback**: See changes instantly without manual restart
- **Development Speed**: Faster iteration during development
- **No Manual Restarts**: Eliminates the need to manually restart the server

### Security Considerations

- **Development Only**: Auto-reload is never enabled in production
- **File Watching**: Only watches Python files, not sensitive configuration files
- **Performance**: Minimal overhead in development mode

### Troubleshooting

#### Auto-reload not working?
1. **Check Environment**: Ensure `ENVIRONMENT=development`
2. **Check Volumes**: Ensure backend code is mounted as a volume
3. **Check Permissions**: Ensure the container can read the mounted files
4. **Check Logs**: Look for reload-related messages in container logs

#### Performance Issues?
1. **Too Many Files**: The `--reload-dir` option can limit watched directories
2. **Large Codebase**: Consider using specific directory watching
3. **System Resources**: Monitor CPU/memory usage during development

### Configuration Files

- `backend/startup.sh` - Conditional reload based on environment
- `backend/startup_dev.sh` - Enhanced development reload
- `docker-compose.dev.yml` - Development override
- `docker-compose.prod.yml` - Production override
```

### Environment-Specific Usage

#### Development Environment
```bash
# Use development Dockerfile for full testing capabilities
docker build -f Dockerfile.dev -t divemap_frontend_dev .
docker run -p 3000:3000 divemap_frontend_dev

# Run tests in development environment
npm run test:frontend
npm run test:validation
npm run test:e2e
```

#### Production Environment
```bash
# Use production Dockerfile for optimized deployment
docker build -t divemap_frontend_prod .
docker run -p 8080:8080 divemap_frontend_prod

# Production build excludes testing tools
# Smaller image size: 797MB → 144MB (82% reduction)
```

#### CI/CD Pipeline
```yaml
# Example GitHub Actions workflow
- name: Build Production Image
  run: |
    cd frontend
    docker build -t divemap_frontend_prod .

- name: Build Development Image
  run: |
    cd frontend
    docker build -f Dockerfile.dev -t divemap_frontend_dev .
```

### Testing Strategy

#### Development Testing
- **Full test suite** available in development environment
- **Puppeteer E2E tests** for browser automation
- **Frontend validation** for accessibility and performance
- **Integration tests** for user interactions

#### Production Testing
- **No testing tools** in production environment
- **Optimized for performance** and security
- **Static file serving** only
- **Health checks** via `/health` endpoint

### Performance Comparison

| Metric | Production | Development |
|--------|------------|-------------|
| **Image Size** | 144MB | ~200MB |
| **Build Time** | Faster | Slower |
| **Testing** | ❌ No | ✅ Full suite |
| **Hot Reload** | ❌ No | ✅ Yes |
| **Security** | ✅ Optimized | ⚠️ Development tools |

### Best Practices

#### 1. Development Workflow
```bash
# Start development environment
docker build -f Dockerfile.dev -t divemap_frontend_dev .
docker run -p 3000:3000 divemap_frontend_dev

# Run tests
npm run test:frontend
npm run test:validation
```

#### 2. Production Deployment
```bash
# Build production image
docker build -t divemap_frontend_prod .

# Deploy to production
docker run -d -p 8080:8080 divemap_frontend_prod
```

#### 3. CI/CD Integration
```yaml
# Use development image for testing
- name: Test Frontend
  run: |
    docker build -f Dockerfile.dev -t divemap_frontend_test .
    docker run divemap_frontend_test npm run test:e2e

# Use production image for deployment
- name: Deploy Frontend
  run: |
    docker build -t divemap_frontend_prod .
    docker push divemap_frontend_prod
```

### Troubleshooting

#### Common Issues

1. **Tests failing in production build**
   - Use `Dockerfile.dev` for testing
   - Production excludes testing dependencies

2. **Large image size**
   - Use production Dockerfile
   - Excludes devDependencies automatically

3. **Missing dependencies**
   - Check if dependency is in correct section
   - Production dependencies vs devDependencies

4. **Build failures**
   - Verify package.json structure
   - Check for dependency conflicts

#### Debugging Commands
```bash
# Check image contents
docker run --rm divemap_frontend_prod ls -la /app

# Inspect node_modules
docker run --rm divemap_frontend_dev ls -la /app/node_modules

# Compare image sizes
docker images | grep divemap_frontend
```

## GitHub Actions

The project uses GitHub Actions for continuous integration and automated testing. See [GitHub Actions Documentation](./github-actions.md) for detailed information about:

- **Backend Tests Workflow**: Automated testing on PR creation and commits
- **Environment Setup**: Virtual environment and service container configuration
- **Coverage Reporting**: Integration with Codecov for coverage tracking
- **Troubleshooting**: Common issues and debugging steps

## Recent Features

### Admin Dashboard System Monitoring

A comprehensive system monitoring and activity tracking system has been implemented for administrators.

**Key Features:**
- **System Overview Dashboard**: Comprehensive platform statistics and health monitoring
- **Recent Activity Monitoring**: Real-time tracking of user actions and system changes
- **System Health Endpoints**: Backend API endpoints for monitoring system status
- **Real-time Activity Tracking**: Database queries for user and system activity

**System Overview Dashboard:**
- Platform statistics (users, content, engagement, geographic distribution)
- System health monitoring (database, application, resources, external services)
- Real-time alerts and status indicators
- Auto-refresh functionality with configurable intervals

**Recent Activity Monitoring:**
- User activity tracking (registrations, content creation, engagement)
- Time-based filtering (hour, 6 hours, day, week, month)
- Activity type filtering (registrations, content creation, engagement)
- Real-time statistics and activity list with auto-refresh
- Responsive design with accessibility support

**Backend System Monitoring:**
- System Router with `/api/v1/admin/system/` endpoints
- System resource monitoring (CPU, memory, disk usage)
- Database health checks (connection status, response time)
- Activity tracking (comprehensive logging of user actions)

**API Endpoints:**
- `GET /api/v1/admin/system/overview` - System overview with platform statistics
- `GET /api/v1/admin/system/health` - System health monitoring
- `GET /api/v1/admin/system/stats` - Platform statistics breakdown
- `GET /api/v1/admin/system/activity` - Recent activity with filtering

**Frontend Integration:**
- Admin dashboard integration with clickable cards
- Navigation updates with admin menu links
- Real-time updates with auto-refresh functionality
- Responsive design for mobile and desktop

### Subsurface XML Import System

A comprehensive dive import system has been implemented for importing dives from Subsurface XML files.

**Key Features:**
- **Frontend Import Modal**: Complete UI for uploading and reviewing Subsurface XML files
- **Backend API Endpoints**: Comprehensive API for XML parsing and dive confirmation
- **Dive Site Matching**: Enhanced matching with similarity detection and user selection
- **Privacy Controls**: Users can set privacy settings for imported dives
- **Skip Functionality**: Individual dive skip options during import process
- **Visual Indicators**: Privacy indicators on dive detail pages

**API Endpoints:**
- `POST /api/v1/dives/import/subsurface-xml` - Upload and parse XML file
- `POST /api/v1/dives/import/confirm` - Confirm and import selected dives

**Import Process:**
1. User uploads Subsurface XML file
2. System parses dive sites and dives
3. User reviews and selects dives to import
4. User sets privacy settings for each dive
5. System imports selected dives with user confirmation

### Dive Filtering Enhancements

Enhanced dive filtering capabilities with user-specific filtering options.

**New Parameters:**
- **`my_dives=true`**: Filter to show only current user's dives (requires authentication)
- **`my_dive_sites=true`**: Filter dive sites to show only those created by current user

**Features:**
- **Authentication Required**: `my_dives` parameter requires authentication
- **User-Specific Results**: Returns only current user's content
- **Empty Results**: Returns empty array for users with no content
- **Count Support**: Both parameters work with count endpoints

**API Endpoints Updated:**
- `GET /api/v1/dives/` - Added `my_dives` parameter
- `GET /api/v1/dives/count` - Added `my_dives` parameter
- `GET /api/v1/dive-sites/` - Added `my_dive_sites` parameter

### Dive Site Creation for Regular Users

Regular users can now create dive sites, with ownership tracking and filtering.

**Features:**
- **User Creation**: Regular users can create dive sites (previously admin/moderator only)
- **Ownership Tracking**: Added `created_by` field to track dive site ownership
- **My Dive Sites Filter**: Filter to show only user's created dive sites
- **UI Improvements**: Enhanced dive site creation interface

### Sorting Functionality Implementation

A comprehensive sorting system is being implemented for all entity list views.

**Status**: 🚧 In Progress
**Implementation**: [Sorting Implementation Plan](./sorting-implementation-plan.md)

**Features:**
- **User-Configurable Sorting**: Sort by name, country, region, difficulty, popularity, dates, etc.
- **Rating Filter Removal**: Remove rating filters from dive sites for cleaner interface
- **Consistent Interface**: Unified sorting experience across dives, dive sites, and diving centers
- **Performance Optimization**: Database indexes and optimized queries for sorting

**Planned Timeline**: 4-6 weeks

**Database Changes:**
- Added `created_by` foreign key to `dive_sites` table
- Migration 0019: `add_created_by_field_to_dive_sites_table.py`

### Moderator Permission Enhancements

Enhanced moderator capabilities for improved content management.

**New Moderator Permissions:**
- **Ownership Management**: Approve diving center ownership requests
- **Diving Organizations**: Full CRUD permissions for diving organizations
- **Newsletter Management**: Complete newsletter and dive trip management
- **User Listing**: View all users in the system

**Testing Coverage:**
- 136 new tests covering all moderator permissions
- Comprehensive permission validation
- All tests passing

### Newsletter Management System

A comprehensive newsletter parsing and trip management system has been implemented in the admin interface.

**Key Features:**
- **Re-parse Functionality**: Re-submit existing newsletters for re-parsing with current logic
- **CRUD Operations**: Full Create, Read, Update, Delete operations for parsed dive trips
- **Multiple Dives Per Trip**: Each trip can contain multiple individual dives with specific details
- **Admin Interface**: Complete management at `/admin/newsletters`
- **Aliases Integration**: Enhanced dive site matching using aliases for improved parsing accuracy

**Trip Management:**
- Trip-level information (date, time, duration, difficulty, price, status)
- Individual dive details (dive number, time, duration, description)
- Link to specific dive sites for each dive
- Status tracking (scheduled/confirmed/cancelled/completed)

**API Endpoints:**
- `POST /api/v1/newsletters/{newsletter_id}/reparse` - Re-parse newsletter
- `POST /api/v1/newsletters/trips` - Create trip with multiple dives
- `GET /api/v1/newsletters/trips/{trip_id}` - Get trip with dive details
- `PUT /api/v1/newsletters/trips/{trip_id}` - Update trip and dives
- `DELETE /api/v1/newsletters/trips/{trip_id}` - Delete trip

**Database Schema:**
- `ParsedDiveTrip` model for trip-level information
- `ParsedDive` model for individual dive details within trips
- Relationships to diving centers, dive sites, and newsletter sources
- Enhanced dive site matching using aliases for improved parsing accuracy

**Access:** Available to admin users at `/admin/newsletters`

### Alphabetical Pagination Implementation

Added alphabetical pagination to `/dives` and `/diving-centers` endpoints, matching the existing `/dive-sites` functionality.

**Features:**
- **Alphabetical Sorting**: Case-insensitive alphabetical sorting by name for all endpoints
- **Consistent Pagination**: Standardized pagination headers across all endpoints
- **Frontend Integration**: Proper pagination header handling in React components
- **URL State Management**: Pagination state preserved in URL parameters
- **Filter Integration**: Works with existing search and filter functionality

**Technical Implementation:**
- **Backend**: Fixed header naming consistency (`X-Total-Count`, `X-Total-Pages`, etc.)
- **Frontend**: Enhanced pagination header handling with React Query caching
- **Files Modified**:
  - `backend/app/routers/dives.py`
  - `backend/app/routers/diving_centers.py`
  - `frontend/src/pages/Dives.js`
  - `frontend/src/pages/DivingCenters.js`

**Endpoints Updated:**
- `/api/v1/dives/` - Alphabetical sorting by dive name
- `/api/v1/diving-centers/` - Alphabetical sorting by center name
- `/api/v1/dive-sites/` - Already had alphabetical sorting (for comparison)

### Diving Organizations Admin Management

A comprehensive CRUD interface for managing diving certification organizations has been added to the admin dashboard.

**Features:**
- **Full CRUD Operations**: Create, read, update, and delete diving organizations
- **Search & Filtering**: Real-time search across names, acronyms, and countries
- **Bulk Operations**: Select and delete multiple organizations at once
- **Form Validation**: Client-side and server-side validation
- **Admin Integration**: Seamlessly integrated into the admin dashboard

**Technical Implementation:**
- **Frontend**: New `AdminDivingOrganizations.js` component with React Query
- **Backend**: Existing API endpoints for diving organizations
- **Routing**: Added `/admin/diving-organizations` route with admin protection
- **UI/UX**: Consistent with existing admin pages using Tailwind CSS

**Organization Fields:**
- Name (required)
- Acronym (required)
- Website URL
- Logo URL
- Description
- Country
- Founded Year

**Access:** Available to admin users at `/admin/diving-organizations`

For detailed documentation, see [Diving Organizations Admin Management](./diving-organizations-admin.md).

### View Tracking

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

### Import Scripts

#### **import_subsurface_divesite.py**
- **Purpose**: Import dive sites from text files with smart conflict resolution
- **Strategy**: Prefers updating existing sites over creating new ones
- **Features**:
  - Smart similarity matching for dive site names
  - Proximity checking (200m threshold)
  - Interactive merge functionality for complex updates
  - Batch processing modes for different workflows
  - Dry run mode for testing
  - Merge file generation for manual review

**Usage:**
```bash
# Interactive mode with conflict resolution
python utils/import_subsurface_divesite.py

# Update all existing sites with conflicts
python utils/import_subsurface_divesite.py -f --update-all

# Create merge files for manual review
python utils/import_subsurface_divesite.py --create-merge-all

# Import only completely new sites
python utils/import_subsurface_divesite.py -f --skip-all
```

**Update Behavior:**
- **Always updated**: name, description, latitude, longitude
- **Preserved**: address, access_instructions, difficulty_level, marine_life, safety_information, aliases, country, region
- **Selective updates**: Only changes fields present in import data

## Aliases System

### Overview
The aliases system allows dive sites to have multiple alternative names, enhancing search functionality and newsletter parsing accuracy. This replaces the deprecated `alternative_names` field with a structured approach.

### Database Schema
- **Table**: `dive_site_aliases`
- **Fields**: `id`, `dive_site_id`, `alias`, `created_at`
- **Constraints**: Unique constraint on `dive_site_id` and `alias`
- **Relationships**: Foreign key to `dive_sites` table

### API Endpoints
- **GET** `/api/v1/dive-sites/{dive_site_id}/aliases` - List aliases for a dive site
- **POST** `/api/v1/dive-sites/{dive_site_id}/aliases` - Create new alias
- **PUT** `/api/v1/dive-sites/{dive_site_id}/aliases/{alias_id}` - Update alias
- **DELETE** `/api/v1/dive-sites/{dive_site_id}/aliases/{alias_id}` - Delete alias

### Frontend Integration
- **Admin Interface**: Full CRUD operations in dive site edit page
- **Display**: Aliases shown in dive site detail and listing pages
- **Search**: Enhanced search functionality using aliases
- **Newsletter Parsing**: Improved dive site matching using aliases

### Migration from Alternative Names
- **Deprecated**: `alternative_names` field in `dive_sites` table
- **Migration**: Existing data should be migrated to aliases table
- **Backward Compatibility**: API responses updated to use aliases structure

### Usage Examples
```bash
# Create alias for dive site
curl -X POST "http://localhost:8000/api/v1/dive-sites/1/aliases" \
  -H "Content-Type: application/json" \
  -d '{"alias": "Blue Hole"}'

# List aliases for dive site
curl "http://localhost:8000/api/v1/dive-sites/1/aliases"

# Update alias
curl -X PUT "http://localhost:8000/api/v1/dive-sites/1/aliases/1" \
  -H "Content-Type: application/json" \
  -d '{"alias": "Blue Hole Updated"}'
```

#### **import_kml_dive_sites.py**
- **Purpose**: Import dive sites from KML files with automatic tag assignment
- **Features**:
  - Parses KML placemarks for dive site data
  - Automatic tag assignment based on icon categories
  - Database integration for bulk imports
  - Support for extended data fields

**Usage:**
```bash
# Import from KML file
python utils/import_kml_dive_sites.py path/to/dive_sites.kml
```

**Icon to Tag Mapping:**
- Shore Dive, Boat Dive, Wreck, Reef, Wall, Cave, Drift
- Deep, Shallow, Night Dive, Training, Photography
- Marine Life, Advanced, Beginner

**Requirements:**
- Backend database connection
- KML file with proper placemark structure
- GPS coordinates in placemarks

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
- **[Diving Organizations Admin](./diving-organizations-admin.md)** - Diving organizations management
- **[Permissions Documentation](./permissions.md)** - User permissions and access control
- **[Frontend Rate Limiting Error Handling](./frontend-rate-limiting-error-handling.md)** - Comprehensive frontend error handling for API rate limits
