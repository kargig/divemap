# Divemap Project Description

**Last Updated**: December 14, 2025  
**Version**: 2.1  
**Author**: AI Assistant

## Project Overview

Divemap is a comprehensive web application for scuba diving enthusiasts to discover, rate, and review dive sites and diving centers. It serves as a community platform connecting divers worldwide through shared experiences, detailed dive logging, and interactive mapping.

## Core Functionality

### User Management

- **Authentication**: Google OAuth and email/password registration
- **User Profiles**: Comprehensive user profiles with diving credentials and statistics
- **Public Profiles**: User profile pages with dive statistics, certifications, and activity metrics
- **Role-Based Access**: Admin, moderator, and user roles with appropriate permissions
- **Certification Tracking**: Integration with diving organizations (PADI, SSI, GUE, etc.)
- **Buddy Visibility**: Users can control whether they appear in buddy search results (public/private)

### Dive Site Management

- **CRUD Operations**: Complete dive site management with detailed information
- **Geographic Data**: GPS coordinates, country, region, and address information
- **Rich Content**: Descriptions, access instructions, marine life, safety information
- **Media Support**: Photo and video uploads with cloud storage integration
- **Rating System**: 1-10 scale user ratings with comments
- **Tag System**: Comprehensive tagging for enhanced search and categorization

### Diving Centers

- **Center Management**: Complete diving center profiles with contact information
- **Gear Rental**: Detailed gear rental costs and availability
- **Dive Site Associations**: Links between centers and dive sites
- **Trip Management**: Dive trip organization and booking facilitation

### Dive Logging

- **Personal Dive Logs**: Detailed dive logging with comprehensive data
- **Dive Profile Visualization**: Interactive dive profile charts with depth, temperature, and gas data
- **Profile Import**: XML import from Subsurface and other dive computer software
- **Media Integration**: Photo and video attachments for each dive
- **Statistics Tracking**: Dive statistics and personal diving metrics
- **Privacy Controls**: Public/private dive visibility settings
- **Dive Buddies**: Add registered users as dive buddies with privacy controls
- **Buddy Management**: Dive owners can add/update buddies; buddies can remove themselves
- **Buddy Filtering**: Filter dives by buddy username in dive list

### Interactive Mapping

- **Leaflet Integration**: Modern, responsive mapping with clustering
- **Multi-Entity Support**: Dive sites, diving centers, and personal dives
- **Geographic Filtering**: Location-based search and filtering
- **Mobile Optimization**: Touch-optimized interactions for mobile devices

### Advanced Search & Discovery

- **Fuzzy Search**: Intelligent search across all content types
- **Multi-Criteria Filtering**: Difficulty, location, rating, and tag-based filtering
- **Geographic Search**: Location-based discovery with distance calculations
- **Newsletter Parsing**: AI-powered extraction of dive trip information

## Technical Architecture

### Frontend Stack

- **Framework**: React 18.3.1 with functional components and hooks
- **Routing**: React Router DOM 7.8.1 for client-side navigation
- **State Management**: React Query 3.39.3 for server state and caching
- **Styling**: Tailwind CSS 3.4.17 for utility-first styling
- **Maps**: Leaflet 1.9.4 with React Leaflet 4.2.1
- **Charts**: Recharts 2.8.0 for interactive dive profile visualizations
- **Icons**: Lucide React 0.539.0 for consistent iconography
- **Forms**: React Hook Form for form handling and validation
- **Notifications**: React Hot Toast 2.6.0 for user feedback
- **HTTP Client**: Axios 1.3.4 for API communication
- **Export**: html2canvas and jsPDF for chart export functionality

### Backend Stack

- **Framework**: FastAPI with Python 3.11+
- **Database**: MySQL with SQLAlchemy ORM
- **Migrations**: Alembic for database schema management
- **Authentication**: JWT tokens with Google OAuth integration
- **Validation**: Pydantic for data validation and serialization
- **Storage**: Cloudflare R2 with local filesystem fallback for dive profiles
- **Containerization**: Docker with optimized builds

### Development Tools

- **Testing**: Pytest for backend, Node.js validation scripts for frontend
- **Linting**: ESLint 9.33.0 with Prettier for code formatting
- **Build**: React Scripts 5.0.1 for frontend builds
- **Deployment**: Docker Compose for local development, Fly.io for production

## Key Features

### Map System

- **Independent Map View**: Separate map interface for exploring all entity types
- **Progressive Clustering**: Performance-optimized clustering with zoom-based breakdown
- **Responsive Design**: Mobile-first approach with touch-optimized interactions
- **Filter Integration**: Advanced filtering directly within map interface

### Search & Discovery

- **Unified Search**: Single search interface across all content types
- **Fuzzy Matching**: Intelligent search with relevance scoring
- **Geographic Discovery**: Location-based content discovery
- **Advanced Filtering**: Multi-dimensional filtering capabilities

### Content Management

- **Rich Media**: Photo and video support with cloud storage
- **Dive Profiles**: Interactive dive profile visualizations with export capabilities
- **Tag System**: Flexible tagging for enhanced categorization
- **Rating & Reviews**: Community-driven content quality assessment
- **Privacy Controls**: Granular privacy settings for user content

### Dive Profile Visualization

- **Interactive Charts**: Real-time dive profile visualization with depth, temperature, and gas data
- **Mobile Touch Support**: Pan and zoom functionality optimized for mobile devices
- **Smart Sampling**: Automatic performance optimization for large dive datasets (1000+ samples)
- **Export Functionality**: PNG and PDF export capabilities for dive profiles
- **Accessibility**: High contrast mode and keyboard navigation support
- **Data Import**: XML import from Subsurface and other dive computer software
- **Gas Change Markers**: Visual indicators for gas changes during dives
- **Decompression Status**: Clear visualization of decompression requirements

### Admin Dashboard

- **System Monitoring**: Real-time platform statistics and health monitoring
- **User Management**: Comprehensive user administration tools
- **Content Moderation**: Tools for managing user-generated content
- **Analytics**: Platform usage and engagement metrics

## Development Workflow

### Code Organization

- **Frontend**: Component-based architecture with custom hooks
- **Backend**: RESTful API with FastAPI and SQLAlchemy
- **Database**: Migrated schema management with Alembic
- **Testing**: Comprehensive test coverage with automated validation

### Quality Assurance

- **Linting**: ESLint with Prettier for consistent code formatting
- **Type Safety**: PropTypes validation for React components
- **Testing**: Automated testing for both frontend and backend
- **Documentation**: Comprehensive documentation for all features

### Deployment

- **Containerization**: Docker-based deployment with optimized builds
- **Cloud Platform**: Fly.io for production deployment
- **Environment Management**: Separate development and production configurations
- **Monitoring**: Real-time system health and performance monitoring

## File Structure

```text
divemap/
├── backend/                 # Python FastAPI backend
│   ├── app/                # Main application code
│   ├── migrations/         # Database migrations
│   └── tests/              # Backend tests
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── utils/          # Utility functions
│   └── tests/              # Frontend tests
├── docs/                   # Comprehensive documentation
└── docker-compose.yml      # Development environment
```

## Available Commands

### Development

```bash
# Start development environment
docker-compose up -d

# Frontend development
cd frontend && npm start

# Backend development
cd backend && python -m uvicorn app.main:app --reload
```

### Testing

```bash
# Backend tests
docker-compose exec backend python -m pytest

# Frontend validation
node validate_frontend.js

# Comprehensive testing
node test_regressions.js
```

### Database

```bash
# Create migration
python create_migration.py "Description"

# Run migrations
python run_migrations.py

# Check status
alembic current
```

## Current Status

The project is in active development with a focus on:

- Enhanced user experience with mobile optimization
- Advanced search and discovery capabilities
- Comprehensive dive logging and visualization
- **NEW**: Dive buddies functionality - add registered users as dive buddies
- **NEW**: User profile statistics with comprehensive activity metrics
- **NEW**: Buddy filtering in dive lists
- **NEW**: Interactive dive profile visualizations with mobile touch support
- **NEW**: Dive profile import from Subsurface XML format
- **NEW**: Chart export functionality (PNG/PDF)
- **NEW**: Smart sampling for large dive datasets
- **NEW**: Accessibility features and high contrast mode
- Community features and content management
- Performance optimization and scalability

## Future Roadmap

- **Mobile Application**: Native mobile app development
- **Advanced Analytics**: Enhanced user and content analytics
- **Social Features**: Enhanced community interaction and sharing
- **API Expansion**: Public API for third-party integrations
- **Advanced Dive Analysis**: AI-powered dive analysis and recommendations
