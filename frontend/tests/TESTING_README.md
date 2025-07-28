# Enhanced Testing Suite Documentation

This document describes the comprehensive testing suite for the Divemap frontend, which includes frontend tests and validation tests.

## Overview

The frontend testing suite consists of three main components:

1. **Frontend Tests** (`test_frontend.js`) - Tests React components and user interactions
2. **Frontend Validation** (`validate_frontend.js`) - Tests accessibility, performance, and integration
3. **Frontend Test Runner** (`run_frontend_tests.js`) - Runs all frontend tests and provides unified reporting

## Directory Structure

```
frontend/
├── tests/
│   ├── test_frontend.js          # Frontend component and interaction tests
│   ├── validate_frontend.js      # Accessibility and performance tests
│   ├── run_frontend_tests.js     # Frontend test runner
│   └── TESTING_README.md         # This documentation
├── src/                          # React source code
├── package.json                  # Dependencies and scripts
└── ...
```

## Test Categories

### 1. Frontend Tests (`test_frontend.js`)

Tests React components and user interactions using Puppeteer.

**Coverage:**
- Page loading and navigation
- Form validation and submission
- Component functionality
- Responsive design testing
- Error handling
- User interactions (search, filtering, sorting)

**Pages Tested:**
- `/` - Home page
- `/dive-sites` - Dive sites listing
- `/diving-centers` - Diving centers listing
- `/login` - Login form
- `/register` - Registration form
- `/profile` - User profile
- `/admin` - Admin dashboard
- `/admin/dive-sites` - Admin dive sites management
- `/admin/diving-centers` - Admin diving centers management
- `/admin/users` - Admin user management
- `/admin/tags` - Admin tag management
- `/create-dive-site` - Create dive site form
- `/create-diving-center` - Create diving center form

**Features Tested:**
- JavaScript error detection
- Network error handling
- Form validation
- Search functionality
- Filtering and sorting
- Pagination
- Modal interactions
- Responsive design across devices

### 2. Frontend Validation (`validate_frontend.js`)

Tests accessibility, performance, and integration using Puppeteer.

**Coverage:**
- Accessibility compliance
- Navigation testing
- Form functionality
- Responsive design
- Error handling
- Performance metrics
- Backend integration
- User interactions

**Accessibility Tests:**
- Alt attributes on images
- Form labels and ARIA attributes
- Heading hierarchy
- Keyboard navigation
- Focus management

**Performance Tests:**
- Page load times
- Resource loading
- Memory usage
- Network performance

**Integration Tests:**
- API call detection
- Data loading verification
- Backend connectivity

## Running Tests

### Prerequisites

1. **Install Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Frontend Service:**
   ```bash
   npm start
   ```

3. **Start Backend Service (in another terminal):**
   ```bash
   cd ../backend
   source divemap_venv/bin/activate
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Running Tests from Frontend Directory

**Run All Frontend Tests:**
```bash
cd frontend
npm run test:e2e
```

**Run Individual Test Suites:**
```bash
# Frontend component tests
npm run test:frontend

# Frontend validation tests
npm run test:validation
```

**Run Tests Directly:**
```bash
cd frontend/tests
node run_frontend_tests.js
node test_frontend.js
node validate_frontend.js
```

### Running Tests from Project Root

**Run All Tests (including backend):**
```bash
# From project root
node run_all_tests.js
```

**Run Frontend Tests Only:**
```bash
# From project root
node frontend/tests/run_frontend_tests.js
```

## Test Configuration

### Environment Variables

Set these environment variables for testing:

```bash
export TEST_ADMIN_EMAIL="admin@example.com"
export TEST_ADMIN_PASSWORD="adminpassword"
```

### Test Data

The tests use predefined test data for consistent testing:

```javascript
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

const TEST_DIVE_SITE = {
  name: 'Test Dive Site',
  description: 'A test dive site for testing',
  latitude: '10.0000',
  longitude: '20.0000',
  difficulty_level: 'beginner',
  access_instructions: 'Test access instructions'
};
```

## Test Results Interpretation

### Success Indicators

**✅ All Tests Passed:**
- No JavaScript errors
- All pages load correctly
- User interactions working
- Accessibility standards met
- Performance acceptable

**⚠️ Tests with Warnings:**
- Some non-critical issues detected
- Performance slightly degraded
- Minor accessibility issues
- Console warnings present

**❌ Tests Failed:**
- Critical functionality broken
- Pages not loading
- User interactions failing
- JavaScript errors

### Common Issues and Solutions

**Frontend Not Loading:**
```bash
# Check if frontend is running
curl http://localhost:3000

# Restart frontend
cd frontend
npm start
```

**Puppeteer Issues:**
```bash
# Install Puppeteer dependencies (Ubuntu/Debian)
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

**Backend Not Responding:**
```bash
# Check if backend is running
curl http://localhost:8000/api/v1/dive-sites/

# Restart backend
cd backend
source divemap_venv/bin/activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Frontend Tests

on: [push, pull_request]

jobs:
  frontend-test:
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
    
    - name: Run frontend tests
      run: |
        cd frontend
        npm run test:e2e
```

## Test Maintenance

### Adding New Tests

1. **Frontend Tests:** Add new page tests to `test_frontend.js`
2. **Validation Tests:** Add new validation tests to `validate_frontend.js`

### Updating Test Data

Modify the test data objects in the test files to include new test scenarios.

### Customizing Test Scenarios

Update the test scenarios in the test files to test new user flows.

## Performance Benchmarks

### Expected Performance

- **Page Load Time:** < 5 seconds
- **JavaScript Memory Usage:** < 50MB
- **Resource Loading:** < 2 seconds per resource

### Performance Monitoring

The tests automatically monitor:
- Page load times
- Memory usage
- Resource loading performance
- JavaScript error rates

## Accessibility Testing

### WCAG Compliance

Tests check for:
- Alt attributes on images
- Proper form labels
- ARIA attributes
- Keyboard navigation
- Heading hierarchy
- Color contrast (basic)

### Accessibility Improvements

If accessibility issues are found:
1. Add alt attributes to images
2. Ensure form inputs have labels
3. Add ARIA attributes where needed
4. Test keyboard navigation
5. Verify heading structure

## Troubleshooting

### Common Error Messages

**"Service not available":**
- Ensure frontend is running on port 3000
- Check network connectivity
- Verify service startup

**"Puppeteer timeout":**
- Increase timeout values in test scripts
- Check system resources
- Verify page load times

**"JavaScript errors":**
- Check browser console
- Review React component errors
- Verify API responses

### Debug Mode

Run tests with verbose output:
```bash
DEBUG=* npm run test:frontend
```

### Manual Testing

For manual verification:
1. Open browser developer tools
2. Check console for errors
3. Test user interactions manually
4. Verify responsive design
5. Test accessibility features

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add comprehensive error handling
3. Include both positive and negative test cases
4. Document new test scenarios
5. Update this documentation

## Support

For issues with the test suite:
1. Check the troubleshooting section
2. Review test logs for specific errors
3. Verify service availability
4. Test manually to isolate issues
5. Update test configuration if needed 