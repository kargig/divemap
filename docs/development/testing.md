# Testing Guide

This document provides essential testing information for the Divemap application. For comprehensive testing strategy and detailed procedures, see [TESTING_STRATEGY.md](../TESTING_STRATEGY.md).

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Categories](#test-categories)
3. [Running Tests](#running-tests)
4. [Docker-Based Testing](#docker-based-testing)
5. [Troubleshooting](#troubleshooting)

## Quick Start

### Backend Tests
```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python -m pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm test
node tests/validate_frontend.js
```

### All Tests
```bash
node run_all_tests.js
```

## Test Categories

### Backend Tests (`backend/tests/`)
- **test_auth.py** - Authentication and authorization
- **test_dive_sites.py** - Dive sites API endpoints (includes aliases functionality)
- **test_diving_centers.py** - Diving centers API endpoints
- **test_dives.py** - Dive logging and management (includes dive-diving center relationship tests)
- **test_tags.py** - Tags management
- **test_users.py** - User management and profiles

### Frontend Tests (`frontend/tests/`)
- **test_frontend.js** - React component tests
- **validate_frontend.js** - Accessibility and performance
- **run_frontend_tests.js** - Frontend test runner
- **run_all_tests.js** - Comprehensive test suite runner
- **test_regressions.js** - API endpoint validation and regression tests

### Regression Tests
- **test_regressions.js** - API endpoint validation and data type consistency
- **run_all_tests.js** - Comprehensive test suite runner

## Running Tests

### Backend Testing
```bash
# Run all backend tests
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_auth.py -v

# Run dive center functionality tests
python -m pytest tests/test_dives.py -k "diving_center" -v

# Run with coverage
python -m pytest tests/ --cov=app --cov-report=html
```

### Frontend Testing
```bash
# Run React tests
cd frontend
npm test

# Run validation tests
node tests/validate_frontend.js

# Run frontend test suite
node tests/run_frontend_tests.js
```

### Comprehensive Testing
```bash
# Run all tests (backend + frontend + regression)
node frontend/tests/run_all_tests.js

# Run regression tests only
node frontend/tests/test_regressions.js
```

## Docker-Based Testing

The project now uses optimized Docker configurations for different testing environments.

### Development Testing (Full Test Suite)
```bash
# Build development image with all dependencies
cd frontend
docker build -f Dockerfile.dev -t divemap_frontend_dev .

# Run tests in development container
docker run divemap_frontend_dev npm run test:frontend
docker run divemap_frontend_dev npm run test:validation
docker run divemap_frontend_dev npm run test:e2e

# Run development server
docker run -p 3000:3000 divemap_frontend_dev
```

### Production Testing (Optimized)
```bash
# Build production image (no testing tools)
cd frontend
docker build -t divemap_frontend_prod .

# Run production server
docker run -p 8080:8080 divemap_frontend_prod
```

### Testing Environment Comparison

| Environment | Dependencies | Testing | Size | Use Case |
|-------------|--------------|---------|------|----------|
| **Development** | All dependencies | ✅ Full suite | ~200MB | Development & testing |
| **Production** | Production only | ❌ No testing | 144MB | Production deployment |

### CI/CD Integration
```yaml
# Development testing
- name: Test Frontend
  run: |
    docker build -f Dockerfile.dev -t divemap_frontend_test .
    docker run divemap_frontend_test npm run test:e2e

# Production deployment
- name: Deploy Frontend
  run: |
    docker build -t divemap_frontend_prod .
    docker push divemap_frontend_prod
```

### Dependency Optimization

**Production Dependencies:**
- React, React DOM, React Router
- React Query, Axios
- OpenLayers, Tailwind CSS
- Lucide React icons

**Development Dependencies:**
- Puppeteer (testing only)
- Testing libraries

**Benefits:**
- **82% image size reduction** (797MB → 144MB)
- **Enhanced security** (production excludes dev tools)
- **Optimized testing** (development includes full test suite)

## Troubleshooting

### Common Issues

**ModuleNotFoundError:**
```bash
# Ensure virtual environment is activated
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
```

**Database Connection Errors:**
```bash
# Ensure database is running
docker-compose up -d db
```

**Frontend Test Failures:**
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Docker Testing Issues:**
```bash
# Use development Dockerfile for testing
docker build -f Dockerfile.dev -t divemap_frontend_test .
docker run divemap_frontend_test npm run test:frontend

# Check image contents
docker run --rm divemap_frontend_prod ls -la /app
```

**Puppeteer Issues:**
```bash
# Ensure Puppeteer is in devDependencies
cat package.json | grep -A 5 "devDependencies"

# Use development environment for Puppeteer tests
docker build -f Dockerfile.dev -t divemap_frontend_dev .
docker run divemap_frontend_dev npm run test:frontend
```

For detailed testing strategy, latest features, and comprehensive procedures, see [TESTING_STRATEGY.md](../TESTING_STRATEGY.md).