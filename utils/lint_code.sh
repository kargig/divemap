#!/bin/bash
# Comprehensive linting script for the divemap project
# This script runs various linting and code quality checks

set -e

echo "🔍 Running comprehensive code linting..."

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
print_status $BLUE "=== 1. Checking for trailing whitespace ==="
if ./utils/check_whitespace.sh; then
    print_status $GREEN "✅ Trailing whitespace check passed"
else
    print_status $RED "❌ Trailing whitespace check failed"
    ERRORS=$((ERRORS + 1))
fi

echo ""
print_status $BLUE "=== 2. Checking Python code formatting ==="
if command_exists python; then
    cd backend
    if [ -d "divemap_venv" ]; then
        source divemap_venv/bin/activate
        export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
        
        # Check if flake8 is available
        if command_exists flake8; then
            echo "Running flake8..."
            if flake8 app/ tests/ --max-line-length=120 --ignore=E501,W503; then
                print_status $GREEN "✅ Python linting (flake8) passed"
            else
                print_status $RED "❌ Python linting (flake8) failed"
                ERRORS=$((ERRORS + 1))
            fi
        else
            print_status $YELLOW "⚠️  flake8 not installed, skipping Python linting"
        fi
        
        # Check if black is available
        if command_exists black; then
            echo "Checking code formatting with black..."
            if black --check --line-length=120 app/ tests/; then
                print_status $GREEN "✅ Python code formatting (black) passed"
            else
                print_status $RED "❌ Python code formatting (black) failed"
                print_status $YELLOW "Run 'black --line-length=120 app/ tests/' to fix formatting"
                ERRORS=$((ERRORS + 1))
            fi
        else
            print_status $YELLOW "⚠️  black not installed, skipping Python formatting check"
        fi
        
        deactivate
    else
        print_status $YELLOW "⚠️  Virtual environment not found, skipping Python checks"
    fi
    cd ..
else
    print_status $YELLOW "⚠️  Python not found, skipping Python checks"
fi

echo ""
print_status $BLUE "=== 3. Checking JavaScript/JSX code formatting ==="
if command_exists node; then
    cd frontend
    if [ -f "package.json" ]; then
        # Check if eslint is available
        if [ -f "node_modules/.bin/eslint" ]; then
            echo "Running ESLint..."
            if npm run lint 2>/dev/null || npx eslint src/ --ext .js,.jsx; then
                print_status $GREEN "✅ JavaScript linting (ESLint) passed"
            else
                print_status $RED "❌ JavaScript linting (ESLint) failed"
                ERRORS=$((ERRORS + 1))
            fi
        else
            print_status $YELLOW "⚠️  ESLint not installed, skipping JavaScript linting"
        fi
        
        # Check if prettier is available
        if [ -f "node_modules/.bin/prettier" ]; then
            echo "Checking code formatting with Prettier..."
            if npx prettier --check src/; then
                print_status $GREEN "✅ JavaScript code formatting (Prettier) passed"
            else
                print_status $RED "❌ JavaScript code formatting (Prettier) failed"
                print_status $YELLOW "Run 'npx prettier --write src/' to fix formatting"
                ERRORS=$((ERRORS + 1))
            fi
        else
            print_status $YELLOW "⚠️  Prettier not installed, skipping JavaScript formatting check"
        fi
    else
        print_status $YELLOW "⚠️  package.json not found, skipping JavaScript checks"
    fi
    cd ..
else
    print_status $YELLOW "⚠️  Node.js not found, skipping JavaScript checks"
fi

echo ""
print_status $BLUE "=== 4. Checking file permissions ==="
# Check if scripts are executable
if [ -x "./utils/check_whitespace.sh" ] && [ -x "./utils/fix_whitespace.sh" ] && [ -x "./utils/lint_code.sh" ]; then
    print_status $GREEN "✅ Script permissions are correct"
else
    print_status $YELLOW "⚠️  Making scripts executable..."
    chmod +x utils/*.sh
    print_status $GREEN "✅ Script permissions fixed"
fi

echo ""
print_status $BLUE "=== 5. Checking for common issues ==="

# Check for TODO/FIXME comments
echo "Checking for TODO/FIXME comments..."
TODO_COUNT=$(grep -r "TODO\|FIXME" --include="*.py" --include="*.js" --include="*.jsx" --include="*.md" . | grep -v node_modules | grep -v venv | grep -v .git | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    print_status $YELLOW "⚠️  Found $TODO_COUNT TODO/FIXME comments"
    grep -r "TODO\|FIXME" --include="*.py" --include="*.js" --include="*.jsx" --include="*.md" . | grep -v node_modules | grep -v .git | head -5
    if [ "$TODO_COUNT" -gt 5 ]; then
        echo "... and $((TODO_COUNT - 5)) more"
    fi
else
    print_status $GREEN "✅ No TODO/FIXME comments found"
fi

# Check for hardcoded passwords/secrets
echo "Checking for potential hardcoded secrets..."
SECRET_COUNT=$(grep -r "password\|secret\|key\|token" --include="*.py" --include="*.js" --include="*.jsx" . | grep -v node_modules | grep -v .git | grep -v "import\|from\|require" | grep -v "password.*=" | grep -v "secret.*=" | grep -v "key.*=" | grep -v "token.*=" | wc -l)
if [ "$SECRET_COUNT" -gt 0 ]; then
    print_status $YELLOW "⚠️  Found $SECRET_COUNT potential hardcoded secrets (review manually)"
else
    print_status $GREEN "✅ No obvious hardcoded secrets found"
fi

echo ""
print_status $BLUE "=== Linting Summary ==="
if [ "$ERRORS" -eq 0 ]; then
    print_status $GREEN "🎉 All linting checks passed!"
    exit 0
else
    print_status $RED "❌ $ERRORS linting check(s) failed"
    echo ""
    print_status $YELLOW "To fix issues:"
    echo "  - Run './utils/fix_whitespace.sh' to fix trailing whitespace"
    echo "  - Run 'black --line-length=120 app/ tests/' to fix Python formatting"
    echo "  - Run 'npx prettier --write src/' to fix JavaScript formatting"
    echo "  - Install missing linting tools if needed"
    exit 1
fi
