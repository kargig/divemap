#!/bin/bash

# Intelligent script to identify changed code and run only relevant tests
# Uses multiple strategies: import analysis, code references, semantic search, and optional AI
#
# Usage:
#   ./run-changed-tests.sh                    # Run tests for all changed files
#   ./run-changed-tests.sh --base main         # Compare against main branch (default)
#   ./run-changed-tests.sh --base origin/main  # Compare against remote main
#   ./run-changed-tests.sh --all               # Run all tests (ignore changes)
#   ./run-changed-tests.sh --use-ai            # Use AI analysis (requires AI tool)

set -e  # Exit on any error

# Default base branch
BASE_BRANCH="${BASE_BRANCH:-main}"
RUN_ALL=false
USE_AI=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --base)
            BASE_BRANCH="$2"
            shift 2
            ;;
        --all)
            RUN_ALL=true
            shift
            ;;
        --use-ai)
            USE_AI=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--base BRANCH] [--all] [--use-ai]"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the backend directory
if [ ! -f "requirements.txt" ]; then
    print_error "This script must be run from the backend directory"
    exit 1
fi

# Check if docker-test-github-actions.sh exists
if [ ! -f "docker-test-github-actions.sh" ]; then
    print_error "docker-test-github-actions.sh not found in current directory"
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "git is not installed"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
print_status "Current branch: ${CURRENT_BRANCH}"

# Check if base branch exists
if ! git rev-parse --verify "${BASE_BRANCH}" >/dev/null 2>&1; then
    print_warning "Base branch '${BASE_BRANCH}' not found. Trying 'master'..."
    if git rev-parse --verify "master" >/dev/null 2>&1; then
        BASE_BRANCH="master"
    else
        print_error "Neither 'main' nor 'master' branch found. Please specify with --base"
        exit 1
    fi
fi

print_status "Base branch: ${BASE_BRANCH}"

# If --all flag is set, run all tests
if [ "$RUN_ALL" = true ]; then
    print_status "Running all tests (--all flag set)"
    ./docker-test-github-actions.sh "tests/"
    exit $?
fi

# Get changed files compared to base branch
print_status "Identifying changed files..."
CHANGED_FILES=$(git diff --name-only "${BASE_BRANCH}"...HEAD 2>/dev/null || git diff --name-only "${BASE_BRANCH}" 2>/dev/null)

if [ -z "$CHANGED_FILES" ]; then
    print_warning "No changes detected compared to ${BASE_BRANCH}"
    print_status "Running all tests as fallback..."
    ./docker-test-github-actions.sh "tests/"
    exit $?
fi

print_status "Changed files detected:"
echo "$CHANGED_FILES" | sed 's/^/  - /'

# Use intelligent Python script to find relevant tests
print_status "Analyzing code changes to find relevant tests..."

# Check if Python script exists
if [ ! -f "find-relevant-tests.py" ]; then
    print_error "find-relevant-tests.py not found"
    exit 1
fi

# Build command for Python script
PYTHON_CMD="python3 find-relevant-tests.py --base ${BASE_BRANCH} --test-dir tests --output list"
if [ "$USE_AI" = true ]; then
    PYTHON_CMD="${PYTHON_CMD} --use-ai"
fi

# Run Python script to find relevant tests
TEST_FILES_SET=$(eval "$PYTHON_CMD" 2>&1 | tee /dev/stderr | tail -1)

# Check if we got results
if [ -z "$TEST_FILES_SET" ] || [ "$TEST_FILES_SET" = "tests/" ]; then
    print_warning "No specific test files identified"
    print_status "This might mean:"
    print_status "  1. Changed files don't have corresponding tests"
    print_status "  2. Only non-code files were changed"
    print_status "  3. Tests are not directly importing changed modules"
    print_status ""
    read -p "Run all tests anyway? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        TEST_FILES_SET="tests/"
    else
        print_status "Exiting without running tests"
        exit 0
    fi
fi

print_success "Test files to run:"
for test_file in $TEST_FILES_SET; do
    echo "  - $test_file"
done

# Run tests
# Pass test files as separate arguments (unquoted to allow word splitting)
print_status "Running tests..."
./docker-test-github-actions.sh $TEST_FILES_SET

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    print_success "All relevant tests passed! 🎉"
else
    print_error "Some tests failed. Check the output above for details."
fi

exit $EXIT_CODE

