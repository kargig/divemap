# Testing Strategy for Divemap

## Overview

This document outlines the comprehensive testing strategy to prevent regressions and ensure code quality.

## 1. Immediate Fixes Applied

### ✅ Fixed: `center.latitude.toFixed is not a function` Error

**Root Cause:** API returns latitude/longitude as strings, but frontend was calling `.toFixed()` directly.

**Solution:** Added `Number()` conversion before `.toFixed()`:
```javascript
// Before (causing error)
<span>{center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}</span>

// After (fixed)
<span>
  {Number(center.latitude).toFixed(4)}, {Number(center.longitude).toFixed(4)}
</span>
```

**Files Fixed:**
- `frontend/src/pages/DivingCenters.js` - Line 225

### ✅ Fixed: Dive Sites API Serialization Issues

**Root Cause:** AvailableTag model objects were being returned directly instead of being serialized to dictionaries.

**Solution:** Updated tag serialization in dive sites router:
```python
# Before (causing 500 errors)
"tags": tags  # SQLAlchemy model objects

# After (fixed)
tags_dict = [
    {
        "id": tag.id,
        "name": tag.name,
        "description": tag.description,
        "created_by": tag.created_by,
        "created_at": tag.created_at
    }
    for tag in tags
]
"tags": tags_dict  # Properly serialized dictionaries
```

**Files Fixed:**
- `backend/app/routers/dive_sites.py` - Tag serialization in get_dive_sites, get_dive_site, update_dive_site
- `backend/app/schemas.py` - Updated difficulty level patterns to include 'expert'

### ✅ Fixed: Frontend Create Pages

**Root Cause:** Admin pages had "Add" buttons that navigated to `/admin/dive-sites/create` and `/admin/diving-centers/create`, but these routes didn't exist in React Router.

**Solution:** Created comprehensive create forms and added proper routes:
```javascript
// Added routes in App.js
<Route path="/admin/dive-sites/create" element={<CreateDiveSite />} />
<Route path="/admin/diving-centers/create" element={<CreateDivingCenter />} />
```

**Features Implemented:**
- **CreateDiveSite.js**: Comprehensive form with all dive site fields
- **CreateDivingCenter.js**: Comprehensive form with all diving center fields
- **Form Validation**: Client-side validation with required fields
- **API Integration**: Proper POST requests with error handling
- **User Experience**: Responsive design with proper navigation

**Files Created/Fixed:**
- `frontend/src/pages/CreateDiveSite.js` - New comprehensive create form
- `frontend/src/pages/CreateDivingCenter.js` - New comprehensive create form
- `frontend/src/App.js` - Added routes and imports

### ✅ Fixed: Difficulty Level Validation

**Root Cause:** Database had dive sites with 'expert' difficulty level, but schema only allowed 'beginner', 'intermediate', 'advanced'.

**Solution:** Updated all difficulty level patterns to include 'expert':
```python
# Before
difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced)$")

# After
difficulty_level: Optional[str] = Field(None, pattern=r"^(beginner|intermediate|advanced|expert)$")
```

**Files Fixed:**
- `backend/app/schemas.py` - DiveSiteBase, DiveSiteUpdate, DiveSiteSearchParams
- `backend/app/routers/dive_sites.py` - Query parameter validation

## 2. Testing Infrastructure

### 2.1 Database Migration Testing

#### Alembic Migration Testing
- **Purpose:** Ensure database migrations work correctly
- **Usage:** `python run_migrations.py`
- **Environment:** Must use virtual environment with proper PYTHONPATH

**Migration Test Commands:**
```bash
# Test migration system
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Run migrations
python run_migrations.py

# Create test migration
python create_migration.py "Test migration"

# Check migration status
alembic current
alembic history
```

**Migration Testing Checklist:**
- [ ] Virtual environment activated
- [ ] PYTHONPATH set correctly
- [ ] Database connection working
- [ ] Migrations run without errors
- [ ] Rollback functionality works
- [ ] Auto-generation creates valid migrations

### 2.2 Validation Scripts

#### `validate_frontend.js`
- **Purpose:** Basic connectivity and API health checks
- **Usage:** `node validate_frontend.js`
- **Tests:**
  - Frontend accessibility
  - Backend API endpoints
  - Data type validation

#### `test_regressions.js`
- **Purpose:** Comprehensive regression testing
- **Usage:** `node test_regressions.js`
- **Tests:**
  - Data type validation (lat/lng as strings)
  - Numeric conversion safety
  - API endpoint functionality
  - Common frontend issues

### 2.2 Test Categories

#### A. Data Type Testing
```javascript
// Test that API returns expected types
if (typeof center.latitude !== 'string') {
  throw new Error(`Expected latitude to be string, got ${typeof center.latitude}`);
}

// Test numeric conversion
const latNum = Number(center.latitude);
if (isNaN(latNum)) {
  throw new Error(`Cannot convert latitude "${center.latitude}" to number`);
}
```

#### B. API Endpoint Testing
- All CRUD endpoints
- Media endpoints
- Gear rental endpoints
- Authentication endpoints

#### C. Frontend Error Prevention
- Type conversion safety
- Null/undefined checks
- Array safety checks

### **C. Regression Prevention**
* Automated testing for common frontend errors
* Data type safety validation
* API parameter filtering testing
* Cross-browser compatibility testing
* Tag management system testing
* Bulk operations testing (tag selection, form submission)

### **D. Tag Management Testing**
* Tag display in dive site details
* Multiple tag selection in edit forms
* Tag creation and assignment
* Bulk tag operations (add/remove)
* Tag validation and error handling
* Tag state management and persistence

#### **E. Map UI Testing**
* Zoom level tracking and display
* Map counter positioning and content
* Zoom behavior for single vs multiple site selection
* Maximum zoom level configuration
* Map fit behavior and constraints
* Real-time zoom level updates

## 3. Pre-Release Checklist

### 3.1 Code Changes
- [ ] Run `node validate_frontend.js`
- [ ] Run `node test_regressions.js`
- [ ] Test all affected pages manually
- [ ] Check browser console for errors

### 3.2 Common Issues to Check

#### Data Type Issues
- **Latitude/Longitude:** Always strings from API, convert with `Number()`
- **Ratings:** Can be `null` or `number`
- **Arrays:** Check `Array.isArray()` before `.map()`

#### API Parameter Issues
- **Empty Parameters:** Filter out empty strings before API calls
- **Trailing Slashes:** Some endpoints require trailing slashes
- **Authentication:** Check token presence for protected routes

#### Frontend Display Issues
- **Rating Display:** Use numeric format `X.X/10` instead of stars
- **Coordinate Display:** Convert strings to numbers before formatting
- **Loading States:** Show spinners during API calls

## 4. Regression Prevention

### 4.1 Before Making Changes
1. **Run existing tests:** `node test_regressions.js`
2. **Note current state:** Document what's working
3. **Plan changes:** Identify potential impact areas

### 4.2 After Making Changes
1. **Run validation:** `node validate_frontend.js`
2. **Run regression tests:** `node test_regressions.js`
3. **Manual testing:** Visit affected pages
4. **Check console:** Look for JavaScript errors

### 4.3 Common Regression Points

#### Frontend Data Handling
```javascript
// ❌ Risky - assumes number
value.toFixed(2)

// ✅ Safe - handles strings
Number(value).toFixed(2)

// ❌ Risky - assumes array
items.map(item => ...)

// ✅ Safe - checks array
Array.isArray(items) && items.map(item => ...)
```

#### API Calls
```javascript
// ❌ Risky - sends empty strings
api.get('/endpoint', { params: { name: '', rating: '' } })

// ✅ Safe - filters empty values
const filteredParams = Object.fromEntries(
  Object.entries(params).filter(([_, v]) => v !== '')
)
```

## 5. Environment Requirements

### 5.1 Virtual Environment Requirements
- **NEVER install Python packages in system Python**
- **ALWAYS use virtual environments for Python development**
- **ALWAYS activate virtual environment before installing packages**
- **NEVER install npm packages globally**
- **ALWAYS use project-specific node_modules**

### 5.2 Python Environment Setup
```bash
# ✅ CORRECT - Always use virtual environment
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
pip install package_name

# ❌ WRONG - Never install in system Python
pip install package_name  # This is forbidden
```

### 5.3 Node.js Environment Setup
```bash
# ✅ CORRECT - Use local node_modules
npm install package_name

# ❌ WRONG - Never install globally
npm install -g package_name  # This is forbidden
```

## 6. Testing Commands

### 6.1 Backend Testing

#### Run All Backend Tests
```bash
# Navigate to backend directory
cd backend

# Activate virtual environment (if using venv)
source divemap_venv/bin/activate

# Set PYTHONPATH for virtual environment (if needed)
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Run all tests with verbose output
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_dive_sites.py -v

# Run tests with coverage
python -m pytest tests/ --cov=app --cov-report=html
```

#### Backend Test Categories
```bash
# Authentication tests
python -m pytest tests/test_auth.py -v

# Dive sites tests
python -m pytest tests/test_dive_sites.py -v

# Diving centers tests
python -m pytest tests/test_diving_centers.py -v

# Tags tests
python -m pytest tests/test_tags.py -v

# Users tests
python -m pytest tests/test_users.py -v

# Migration tests
python run_migrations.py
alembic current
alembic history
```

### 5.2 Frontend Testing

#### Quick Health Check
```bash
# Basic connectivity and API health checks
node validate_frontend.js
```

#### Full Regression Test
```bash
# Comprehensive regression testing
node test_regressions.js
```

#### Frontend Validation Scripts
```bash
# Test frontend accessibility and backend APIs
node validate_frontend.js

# Test data types, API endpoints, and common issues
node test_regressions.js
```

### 5.3 Docker Testing

#### Check Container Status
```bash
# Check if all containers are running
docker-compose ps

# View container logs
docker-compose logs backend
docker-compose logs frontend
```

#### Restart Services (if needed)
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### 5.4 API Testing

#### Manual API Testing
```bash
# Test dive sites endpoint
curl -s http://localhost:8000/api/v1/dive-sites/ | jq 'length'

# Test diving centers endpoint
curl -s http://localhost:8000/api/v1/diving-centers/ | jq 'length'

# Test specific dive site
curl -s http://localhost:8000/api/v1/dive-sites/1 | jq '.name'

# Test authentication
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}' | jq '.access_token'
```

### 5.5 Complete Test Suite

#### Run All Tests (Recommended)
```bash
# 1. Start services
docker-compose up -d

# 2. Wait for services to be ready
sleep 10

# 3. Run backend tests
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python -m pytest tests/ -v

# 4. Run frontend validation
cd ..
node validate_frontend.js

# 5. Run regression tests
node test_regressions.js

# 6. Check container status
docker-compose ps
```

#### One-Command Test Runner
```bash
# Create a test runner script
cat > run_all_tests.sh << 'EOF'
#!/bin/bash
echo "🚀 Running Complete Test Suite..."

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "📦 Starting services..."
    docker-compose up -d
    sleep 10
fi

# Run backend tests
echo "🧪 Running backend tests..."
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
python -m pytest tests/ -v
BACKEND_RESULT=$?

# Run frontend tests
echo "🎨 Running frontend tests..."
cd ..
node validate_frontend.js
FRONTEND_RESULT=$?

node test_regressions.js
REGRESSION_RESULT=$?

# Summary
echo ""
echo "📊 Test Results Summary:"
echo "Backend Tests: $([ $BACKEND_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Frontend Tests: $([ $FRONTEND_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Regression Tests: $([ $REGRESSION_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"

if [ $BACKEND_RESULT -eq 0 ] && [ $FRONTEND_RESULT -eq 0 ] && [ $REGRESSION_RESULT -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    exit 0
else
    echo "⚠️  Some tests failed. Check output above."
    exit 1
fi
EOF

chmod +x run_all_tests.sh

# Run all tests
./run_all_tests.sh
```

### 5.6 Manual Testing Checklist
- [ ] Home page loads
- [ ] Dive sites page loads
- [ ] Diving centers page loads
- [ ] Detail pages load without errors
- [ ] Edit pages work for admin users
- [ ] Create pages work for admin users (new)
- [ ] Search functionality works
- [ ] No console errors
- [ ] Admin login works (admin/Admin123!)
- [ ] API endpoints return expected data types

## 6. Future Improvements

### 6.1 Automated Testing
- **Puppeteer Integration:** Full browser testing
- **Visual Regression:** Screenshot comparison
- **Performance Testing:** Load time monitoring

### 6.2 Enhanced Validation
- **TypeScript:** Static type checking
- **PropTypes:** React component validation
- **ESLint Rules:** Enforce best practices

### 6.3 Continuous Integration
- **Git Hooks:** Pre-commit testing
- **CI/CD Pipeline:** Automated testing on push
- **Deployment Validation:** Post-deploy health checks

## 7. Error Prevention Guidelines

### 7.1 Data Type Safety
```javascript
// Always convert API strings to numbers when needed
const lat = Number(center.latitude);
const lng = Number(center.longitude);

// Check for valid numbers
if (!isNaN(lat) && !isNaN(lng)) {
  // Safe to use lat/lng
}
```

### 7.2 Array Safety
```javascript
// Always check if array before mapping
if (Array.isArray(items)) {
  items.map(item => ...)
}
```

### 7.3 API Parameter Safety
```javascript
// Filter out empty parameters
const cleanParams = Object.fromEntries(
  Object.entries(params).filter(([_, v]) => v !== '')
);
```

### 7.4 Error Boundaries
```javascript
// Wrap components in error boundaries
<ErrorBoundary>
  <Component />
</ErrorBoundary>
```

## 8. Git Commit Rules

### 8.1 Git Commit Requirements
- **NEVER commit to git automatically**
- **ONLY commit when explicitly requested by the user**
- **ALWAYS ask for permission before committing**
- **ALWAYS provide clear commit messages when requested**

### 8.2 Git Workflow
```bash
# ✅ CORRECT - Only commit when user requests
# Wait for user to say: "commit these changes"

# ❌ WRONG - Never commit automatically
git add . && git commit -m "auto commit"  # This is forbidden
```

### 8.3 Commit Guidelines (when user requests)
- Use descriptive commit messages
- Include affected files in commit message
- Reference issue numbers if applicable
- Test changes before committing

## 9. Monitoring and Alerting

### 9.1 Error Tracking
- **Console Errors:** Monitor browser console
- **API Errors:** Track 4xx/5xx responses
- **User Reports:** Collect user feedback

### 8.2 Performance Monitoring
- **Page Load Times:** Track loading performance
- **API Response Times:** Monitor backend performance
- **User Experience:** Track user interactions

## Conclusion

This testing strategy ensures that:
1. **Regressions are caught early** through automated testing
2. **Common issues are prevented** through guidelines
3. **Code quality is maintained** through validation
4. **User experience is protected** through comprehensive testing

**Remember:** Always run tests before and after making changes to prevent regressions! 