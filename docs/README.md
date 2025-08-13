# Divemap Documentation

Welcome to the Divemap documentation. This directory contains comprehensive documentation for the Divemap scuba diving platform.

## 📚 Documentation Index

### 🚀 Getting Started
- **[README.md](./getting-started/README.md)** - User onboarding and application usage guide

### 🔧 Development
- **[README.md](./development/README.md)** - Development overview, setup, and workflow
- **[Architecture.md](./development/architecture.md)** - System architecture and design
- **[Database.md](./development/database.md)** - Database documentation and migrations
- **[API.md](./development/api.md)** - API documentation and endpoints
- **[Testing.md](./development/testing.md)** - Testing guide (see [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for comprehensive details)
- **[Docker.md](./development/docker.md)** - Docker configuration and containerization guide
- **[Frontend Rate Limiting Error Handling](./development/frontend-rate-limiting-error-handling.md)** - Comprehensive frontend error handling for API rate limits
- **[Sorting Implementation Plan](./development/sorting-implementation-plan.md)** - Comprehensive sorting functionality implementation
- **Newsletter Management** - Newsletter parsing and trip management (see [Development README](./development/README.md#newsletter-management-system))
- **Phase 2: Map Integration** - Interactive map visualization for dive trips (see [Development README](./development/README.md#phase-2-map-integration-and-visualization--complete))
- **Import Scripts** - Dive site import utilities with smart conflict resolution (see [Development README](./development/README.md#import-scripts))
- **[Importing Data](./IMPORTING_DATA.md)** - Comprehensive guide for importing dive sites and dives from Subsurface
- **[Subsurface Import Plan](./development/subsurface-import-plan.md)** - Comprehensive plan for importing dives from Subsurface
- **[Subsurface XML Import](./import-subsurface-xml.md)** - Import dive data from Subsurface XML files

### 🚀 Deployment
- **[README.md](./deployment/README.md)** - Comprehensive deployment guide (includes all deployment strategies, Docker, Fly.io, and infrastructure)
- **[Fly.io.md](./deployment/fly-io.md)** - Detailed Fly.io deployment guide with advanced features

### 🛡️ Security
- **[README.md](./security/README.md)** - Security overview, measures, and best practices
- **[OAuth Setup.md](./security/oauth-setup.md)** - Google OAuth configuration
- **Rate Limiting** - Enhanced rate limiting with localhost and admin exemptions, plus comprehensive frontend error handling (see [API.md](./development/api.md#rate-limiting), [Security README](./security/README.md#rate-limiting), and [Development README](./development/README.md#frontend-rate-limiting-error-handling))

### 🔧 Maintenance
- **[README.md](./maintenance/README.md)** - Maintenance overview and troubleshooting
- **[Migrations.md](./maintenance/migrations.md)** - Database migrations guide
- **[Changelog.md](./maintenance/changelog.md)** - Complete change history and API changes

### 📋 Testing Strategy
- **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** - Comprehensive testing strategy and procedures

## 📋 Quick Reference

### For New Users
1. Start with **[Getting Started](./getting-started/README.md)** for application usage and features

### For Developers
1. **[Development Overview](./development/README.md)** - Development setup and workflow
2. **[Architecture Documentation](./development/architecture.md)** - System design and components
3. **[API Documentation](./development/api.md)** - API endpoints and usage
4. **[Testing Guide](./development/testing.md)** - Testing procedures (see [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for details)
5. **[Docker Configuration](./development/docker.md)** - Container setup and optimization
6. **[Phase 2: Map Integration](./development/README.md#phase-2-map-integration-and-visualization--complete)** - Interactive map visualization for dive trips
7. **[Importing Data](./IMPORTING_DATA.md)** - Guide for importing dive sites and dives from Subsurface
8. **[Rate Limiting Error Handling](./development/README.md#frontend-rate-limiting-error-handling)** - Frontend error handling for API rate limits
9. **[Sorting Implementation](./development/sorting-implementation-plan.md)** - Comprehensive sorting functionality and admin restrictions

### For Deployment
1. **[Deployment Overview](./deployment/README.md)** - Comprehensive deployment guide (includes Docker, Fly.io, and infrastructure)
2. **[Fly.io Guide](./deployment/fly-io.md)** - Advanced Fly.io deployment features and configuration
3. **[Development Docker Guide](./development/docker.md)** - Development container configuration

### For Security
1. **[Security Overview](./security/README.md)** - Security measures and best practices
2. **[OAuth Setup](./security/oauth-setup.md)** - Authentication configuration

### For Maintenance
1. **[Maintenance Overview](./maintenance/README.md)** - Maintenance procedures and troubleshooting
2. **[Database Migrations](./maintenance/migrations.md)** - Schema change management
3. **[Changelog](./maintenance/changelog.md)** - Complete version history and API changes

## 🔗 Related Files

- `../README.md` - Main project overview
- `../CHANGELOG.md` - Application changelog

## 📝 Documentation Standards

All documentation should:
- Include clear problem statements
- Provide step-by-step solutions
- Include testing procedures
- Document security considerations
- List all affected files
- Include troubleshooting sections
- Use consistent markdown formatting
- Include table of contents for files > 100 lines

## 🚀 Current Status

**Production URLs:**
- **Frontend:** https://divemap.fly.dev
- **Backend API:** https://divemap-backend.fly.dev
- **Database:** Internal network only (`divemap-db.flycast`)

**Recent Updates:**
- ✅ Phase 2: Map Integration and Visualization completed
- ✅ Interactive map component for dive trips implemented
- ✅ Database migration 0027: trip_difficulty_level nullable constraint fixed
- ✅ Newsletter content enhancement in API responses
- ✅ **Documentation consolidation completed** - Eliminated duplication between deployment and getting-started sections
- ✅ **Streamlined deployment documentation** - Consolidated Docker, infrastructure, and deployment into single comprehensive guide
- ✅ **Refocused getting-started guide** - Now focuses on user onboarding and application usage
- ✅ **Reduced deployment files** - From 4 files to 2 files (main README + Fly.io guide)
- ✅ Removed duplicate content across files
- ✅ Streamlined testing documentation
- ✅ Consolidated security measures
- ✅ **Sorting Implementation Complete** - Comprehensive sorting across all entity types with admin restrictions
- ✅ **Difficulty Level System Converted** - From ENUM strings to integers for better performance
- ✅ **Database Migration 0024** - Applied with comprehensive sorting indexes
- ✅ Merged troubleshooting into maintenance guide
- ✅ Reduced total documentation files from 22 to 16
- ✅ Added comprehensive frontend rate limiting error handling documentation
- ✅ Added diving organizations and user certifications documentation
- ✅ Updated API documentation with new endpoints
- ✅ Enhanced database documentation with new schema
- ✅ Updated changelog with latest features
- ✅ Added newsletter management system documentation
- ✅ Integrated newsletter parsing and trip management features
- ✅ Updated API docs with newsletter endpoints
- ✅ Added ParsedDive and ParsedDiveTrip models to database docs
- ✅ Enhanced rate limiting documentation with localhost and admin exemptions
- ✅ Added count endpoints for dive sites, dives, and diving centers
- ✅ Implemented random selection for dive sites with total count display
- ✅ Updated security documentation with new rate limiting implementation
- ✅ Added rate limiting section to development documentation
- ✅ Implemented dive site aliases system with full CRUD operations
- ✅ Enhanced newsletter parsing with aliases-based dive site matching
- ✅ Updated database schema with dive_site_aliases table
- ✅ Added comprehensive aliases documentation and testing coverage

## 📊 Documentation Categories

### **Getting Started (1 file)**
- User onboarding and application usage guide

### **Development (7 files)**
- Architecture, API, database, testing, newsletter management, development workflow, and Subsurface import plan

### **Deployment (2 files)**
- Comprehensive deployment guide and advanced Fly.io features

### **Security (2 files)**
- Security measures and OAuth setup (consolidated)

### **Maintenance (3 files)**
- Migrations, changelog, and consolidated maintenance/troubleshooting

### **Testing Strategy (1 file)**
- Comprehensive testing strategy and procedures

**Total Documentation Files: 16** (reduced from 18)

## 🔄 Consolidation Summary

### Files Removed
- `docs/deployment/docker.md` - Content merged into deployment README
- `docs/deployment/infrastructure.md` - Content merged into deployment README
- `docs/security/measures.md` - Content merged into security README
- `docs/maintenance/troubleshooting.md` - Content merged into maintenance README

### Files Streamlined
- `docs/development/testing.md` - Now references comprehensive TESTING_STRATEGY.md
- `docs/getting-started/README.md` - Focused on user onboarding, technical details moved to deployment
- `docs/security/README.md` - Consolidated security measures and audit results
- `docs/maintenance/README.md` - Merged troubleshooting procedures
- `docs/deployment/README.md` - Consolidated Docker, infrastructure, and deployment information

### Benefits Achieved
- **Reduced Redundancy**: Eliminated duplicate content across files
- **Improved Clarity**: Each file now has a clear, focused purpose
- **Better Organization**: Related content grouped logically
- **Easier Maintenance**: Fewer files to update and maintain
- **Clearer Navigation**: Users can find information more quickly
- **Streamlined Deployment**: Single comprehensive deployment guide
- **User-Focused Getting Started**: Clear separation between user onboarding and technical deployment