#!/bin/bash

# Docker-based test script that exactly replicates GitHub Actions environment
#
# Usage:
#   ./docker-test-github-actions.sh                                    # Run all tests (silent by default)
#   ./docker-test-github-actions.sh -v                                 # Run all tests with verbose output
#   ./docker-test-github-actions.sh tests/test_file.py                 # Run specific test file

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
VERBOSE=false
TEST_PATHS=()

for arg in "$@"; do
    if [ "$arg" == "-v" ]; then
        VERBOSE=true
    else
        TEST_PATHS+=("$arg")
    fi
done

if [ "$VERBOSE" = true ]; then
    echo "🔊 Verbose mode enabled"
else
    echo "P Silent mode enabled (failures saved to test-failures.txt)"
    > test-failures.txt
fi

# Helper functions
run_silent() {
    if [ "$VERBOSE" = true ]; then "$@"; else "$@" > /dev/null 2>&1; fi
}

run_cleanup() {
    if [ "$VERBOSE" = true ]; then "$@" || true; else "$@" > /dev/null 2>&1 || true; fi
}

# Check requirements
[ -f "requirements.txt" ] || { print_error "Run from backend directory"; exit 1; }
[ -f "test.db" ] && sudo rm -f test.db

# Cleanup
print_status "Cleaning up existing containers..."
run_cleanup docker stop divemap-test-mysql divemap-test-backend
run_cleanup docker rm divemap-test-mysql divemap-test-backend
run_cleanup docker network rm divemap-test-network

# Setup
print_status "Setting up environment..."
run_silent docker network create divemap-test-network
run_silent docker run -d \
    --name divemap-test-mysql \
    --network divemap-test-network \
    -e MYSQL_ROOT_PASSWORD=password \
    -e MYSQL_DATABASE=divemap_test \
    -p 3307:3306 \
    --health-cmd="mysqladmin ping" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-retries=3 \
    mysql:8.0

print_status "Waiting for MySQL..."
timeout=20; counter=0
while ! docker exec divemap-test-mysql mysqladmin ping -h localhost >/dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        print_error "MySQL failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
done

# Dockerfile
cat > Dockerfile.test << 'EOF'
FROM python:3.11-slim
RUN apt-get update && apt-get install -y pkg-config netcat-openbsd default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY . .
RUN mkdir -p uploads && chmod +x /app/run_migrations.py /app/startup.sh
ENV GITHUB_ACTIONS=true \
    DATABASE_URL=mysql+pymysql://root:password@divemap-test-mysql:3306/divemap_test \
    SECRET_KEY=test-secret-key-for-ci \
    ENVIRONMENT=ci \
    GOOGLE_CLIENT_ID=dummy-client-id-for-testing
EXPOSE 8000
EOF

print_status "Building test image..."
run_silent docker build -f Dockerfile.test -t divemap-test-backend .

# Prepare Container Script
cat << 'EOF' > container_test.sh
#!/bin/bash
set -e
run_internal() {
    if [ "$VERBOSE" = "true" ]; then "$@"; else "$@" > /dev/null 2>&1; fi
}
run_internal python -m venv divemap_venv
source divemap_venv/bin/activate
run_internal pip install --upgrade pip
run_internal pip install -r requirements.txt
export PYTHONPATH="/app/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
until mysql -h divemap-test-mysql -u root -ppassword -e 'SELECT 1;' >/dev/null 2>&1; do sleep 1; done
run_internal mysql -h divemap-test-mysql -u root -ppassword -e 'CREATE DATABASE IF NOT EXISTS divemap_test;'
run_internal alembic upgrade head
echo "Running tests..."
EOF

if [ ${#TEST_PATHS[@]} -eq 0 ]; then
    echo "python -m pytest tests/ -v --cov=app --cov-report=term-missing -x --maxfail=5 --tb=short" >> container_test.sh
else
    echo -n "python -m pytest " >> container_test.sh
    for path in "${TEST_PATHS[@]}"; do echo -n "${path} " >> container_test.sh; done
    echo "-v --cov=app --cov-report=term-missing -x --maxfail=5 --tb=short" >> container_test.sh
fi
chmod +x container_test.sh

print_status "Running tests..."
set +e
if [ "$VERBOSE" = true ]; then
    docker run --rm --name divemap-test-runner --network divemap-test-network \
        -e VERBOSE=true \
        -v "$(pwd)/container_test.sh:/app/container_test.sh" \
        -v "$(pwd)/.pytest_cache:/app/.pytest_cache" \
        divemap-test-backend bash /app/container_test.sh
    TEST_EXIT_CODE=$?
else
    docker run --rm --name divemap-test-runner --network divemap-test-network \
        -e VERBOSE=false \
        -v "$(pwd)/container_test.sh:/app/container_test.sh" \
        -v "$(pwd)/.pytest_cache:/app/.pytest_cache" \
        divemap-test-backend bash /app/container_test.sh > test-failures.txt 2>&1
    TEST_EXIT_CODE=$?
fi
set -e

# Result
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "All tests passed! 🎉"
    [ "$VERBOSE" != true ] && echo "Test results saved to test-failures.txt"
else
    print_error "Tests failed! (Exit code: $TEST_EXIT_CODE)"
    [ "$VERBOSE" != true ] && { print_error "Check test-failures.txt"; tail -n 20 test-failures.txt; }
fi

# Cleanup
print_status "Cleaning up..."
run_cleanup docker stop divemap-test-mysql
run_cleanup docker rm divemap-test-mysql divemap-test-backend
run_cleanup docker network rm divemap-test-network
rm -f Dockerfile.test container_test.sh

exit $TEST_EXIT_CODE
