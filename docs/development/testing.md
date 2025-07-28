# Testing Guide

This document provides essential testing information for the Divemap application. For comprehensive testing strategy and detailed procedures, see [TESTING_STRATEGY.md](../TESTING_STRATEGY.md).

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Categories](#test-categories)
3. [Running Tests](#running-tests)
4. [Troubleshooting](#troubleshooting)

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
- **test_dive_sites.py** - Dive sites API endpoints
- **test_diving_centers.py** - Diving centers API endpoints
- **test_tags.py** - Tags management
- **test_users.py** - User management and profiles

### Frontend Tests (`frontend/tests/`)
- **test_frontend.js** - React component tests
- **validate_frontend.js** - Accessibility and performance
- **run_frontend_tests.js** - Frontend test runner

### Regression Tests
- **test_regressions.js** - API endpoint validation
- **run_all_tests.js** - Comprehensive test suite

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
node run_all_tests.js

# Run regression tests only
node test_regressions.js
```

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

For detailed testing strategy, latest features, and comprehensive procedures, see [TESTING_STRATEGY.md](../TESTING_STRATEGY.md). 