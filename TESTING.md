# Divemap Testing Overview

This document provides an overview of the testing structure for the Divemap project.

## Test Organization

The project uses a modular testing approach with tests organized by component:

```
divemap/
├── frontend/
│   ├── tests/                    # Frontend-specific tests
│   │   ├── test_frontend.js      # React component tests
│   │   ├── validate_frontend.js  # Accessibility & performance tests
│   │   ├── run_frontend_tests.js # Frontend test runner
│   │   └── TESTING_README.md     # Frontend testing documentation
│   └── package.json              # Frontend dependencies & scripts
├── backend/
│   ├── tests/                    # Backend-specific tests (existing)
│   └── ...
├── test_regressions.js           # API & data integrity tests
├── run_all_tests.js             # Comprehensive test runner
└── TESTING.md                   # This overview document
```

## Test Categories

### Frontend Tests (`frontend/tests/`)
- **Component Tests**: React component functionality and user interactions
- **Accessibility Tests**: WCAG compliance, keyboard navigation, screen reader support
- **Performance Tests**: Page load times, memory usage, resource optimization
- **Integration Tests**: API connectivity, data loading, error handling

### Backend Tests (`backend/tests/`)
- **Unit Tests**: Individual function and class testing
- **API Tests**: Endpoint functionality and response validation
- **Database Tests**: Data persistence and migration testing

### Regression Tests (`test_regressions.js`)
- **API Endpoint Tests**: All backend API endpoints
- **Data Type Tests**: Validation of data structures and types
- **Authentication Tests**: Login/logout flows and security
- **Performance Tests**: Response times and concurrent request handling
- **Security Tests**: SQL injection, XSS, and unauthorized access attempts

## Running Tests

### Quick Start

**Run All Tests:**
```bash
# From project root
node run_all_tests.js
```

**Run Frontend Tests Only:**
```bash
# From project root
node frontend/tests/run_frontend_tests.js

# Or from frontend directory
cd frontend
npm run test:e2e
```

**Run Backend Tests Only:**
```bash
cd backend
source divemap_venv/bin/activate
python -m pytest tests/ -v
```

**Run Regression Tests Only:**
```bash
# From project root
node test_regressions.js
```

### Frontend-Specific Commands

```bash
cd frontend

# Run all frontend tests
npm run test:e2e

# Run component tests only
npm run test:frontend

# Run validation tests only
npm run test:validation

# Run React unit tests
npm test
```

### Backend-Specific Commands

```bash
cd backend
source divemap_venv/bin/activate

# Run all backend tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_auth.py -v

# Run with coverage
python -m pytest tests/ --cov=app --cov-report=html
```

## Prerequisites

### Frontend Testing
- Node.js 16+ installed
- Frontend dependencies installed: `cd frontend && npm install`
- Frontend service running: `npm start`
- Backend service running (for integration tests)

### Backend Testing
- Python 3.11+ installed
- Virtual environment activated
- Backend dependencies installed: `pip install -r requirements.txt`
- Database running and accessible

## Test Results

### Success Indicators
- ✅ **All Tests Passed**: Application is working correctly
- ⚠️ **Tests with Warnings**: Minor issues detected, functionality intact
- ❌ **Tests Failed**: Critical issues requiring attention

### Common Issues
- **Service Not Available**: Ensure frontend/backend services are running
- **Database Connection**: Check database connectivity and migrations
- **Network Timeouts**: Verify service ports and firewall settings
- **JavaScript Errors**: Check browser console and React component errors

## Continuous Integration

The test suite is designed to work with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd frontend && npm install
          cd ../backend && pip install -r requirements.txt
      - name: Start services
        run: |
          cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
          cd frontend && npm start &
          sleep 30
      - name: Run tests
        run: node run_all_tests.js
```

## Documentation

- **Frontend Testing**: See `frontend/tests/TESTING_README.md`
- **Backend Testing**: See `backend/tests/` for existing documentation
- **API Testing**: See `test_regressions.js` for API test details

## Contributing

When adding new tests:

1. **Frontend Tests**: Add to `frontend/tests/` directory
2. **Backend Tests**: Add to `backend/tests/` directory
3. **API Tests**: Add to `test_regressions.js`
4. **Update Documentation**: Modify relevant README files
5. **Update CI**: Ensure tests work in automated environments

## Support

For test-related issues:
1. Check service availability (frontend/backend running)
2. Review test logs for specific error messages
3. Verify dependencies are installed correctly
4. Test manually to isolate issues
5. Check documentation for troubleshooting steps 