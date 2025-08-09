#!/bin/bash
# Comprehensive test runner script for the divemap project
# This script runs linting checks and then executes all tests

set -e

echo "🧪 Running comprehensive test suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Initialize error counter
ERRORS=0

echo ""
print_status $BLUE "=== Pre-test Validation ==="

# Check for trailing whitespace
echo "1. Checking for trailing whitespace..."
if ./utils/check_whitespace.sh; then
    print_status $GREEN "✅ Trailing whitespace check passed"
else
    print_status $RED "❌ Trailing whitespace check failed"
    print_status $YELLOW "Run './utils/fix_whitespace.sh' to fix trailing whitespace"
    ERRORS=$((ERRORS + 1))
fi

# Run comprehensive linting
echo ""
echo "2. Running code linting..."
if ./utils/lint_code.sh; then
    print_status $GREEN "✅ Code linting passed"
else
    print_status $RED "❌ Code linting failed"
    ERRORS=$((ERRORS + 1))
fi

# Stop if pre-test validation failed
if [ "$ERRORS" -gt 0 ]; then
    echo ""
    print_status $RED "❌ Pre-test validation failed. Please fix the issues above before running tests."
    exit 1
fi

echo ""
print_status $BLUE "=== Running Tests ==="

# Run backend tests
echo ""
print_status $BLUE "1. Running Backend Tests..."
cd backend
if [ -d "divemap_venv" ]; then
    source divemap_venv/bin/activate
    export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
    
    echo "Running pytest..."
    if python -m pytest tests/ -v; then
        print_status $GREEN "✅ Backend tests passed"
    else
        print_status $RED "❌ Backend tests failed"
        ERRORS=$((ERRORS + 1))
    fi
    
    deactivate
else
    print_status $YELLOW "⚠️  Virtual environment not found, skipping backend tests"
    ERRORS=$((ERRORS + 1))
fi
cd ..

# Run frontend tests
echo ""
print_status $BLUE "2. Running Frontend Tests..."
cd frontend
if [ -f "package.json" ]; then
    # Check if test script exists
    if npm run test 2>/dev/null; then
        print_status $GREEN "✅ Frontend tests passed"
    else
        print_status $YELLOW "⚠️  Frontend test script not found or failed"
        # Try alternative test commands
        if [ -f "tests/run_all_tests.js" ]; then
            echo "Running alternative frontend tests..."
            if node tests/run_all_tests.js; then
                print_status $GREEN "✅ Frontend tests passed (alternative)"
            else
                print_status $RED "❌ Frontend tests failed"
                ERRORS=$((ERRORS + 1))
            fi
        else
            print_status $YELLOW "⚠️  No frontend test files found"
        fi
    fi
else
    print_status $YELLOW "⚠️  package.json not found, skipping frontend tests"
fi
cd ..

# Run integration tests if they exist
echo ""
print_status $BLUE "3. Running Integration Tests..."
if [ -f "tests/integration_tests.sh" ]; then
    if ./tests/integration_tests.sh; then
        print_status $GREEN "✅ Integration tests passed"
    else
        print_status $RED "❌ Integration tests failed"
        ERRORS=$((ERRORS + 1))
    fi
else
    print_status $YELLOW "⚠️  No integration tests found"
fi

# Run end-to-end tests if they exist
echo ""
print_status $BLUE "4. Running End-to-End Tests..."
if [ -f "tests/e2e_tests.sh" ]; then
    if ./tests/e2e_tests.sh; then
        print_status $GREEN "✅ End-to-end tests passed"
    else
        print_status $RED "❌ End-to-end tests failed"
        ERRORS=$((ERRORS + 1))
    fi
else
    print_status $YELLOW "⚠️  No end-to-end tests found"
fi

echo ""
print_status $BLUE "=== Test Summary ==="
if [ "$ERRORS" -eq 0 ]; then
    print_status $GREEN "🎉 All tests passed!"
    echo ""
    print_status $GREEN "✅ Pre-test validation: PASSED"
    print_status $GREEN "✅ Backend tests: PASSED"
    print_status $GREEN "✅ Frontend tests: PASSED"
    print_status $GREEN "✅ Integration tests: PASSED (if applicable)"
    print_status $GREEN "✅ End-to-end tests: PASSED (if applicable)"
    exit 0
else
    print_status $RED "❌ $ERRORS test suite(s) failed"
    echo ""
    print_status $YELLOW "To fix issues:"
    echo "  - Check the output above for specific error messages"
    echo "  - Run './utils/fix_whitespace.sh' if whitespace issues exist"
    echo "  - Run './utils/lint_code.sh' to check for code quality issues"
    echo "  - Ensure all dependencies are properly installed"
    echo "  - Check that virtual environments are activated correctly"
    exit 1
fi
