#!/bin/bash

# Docker-based test script that exactly replicates GitHub Actions environment
# This uses Docker containers to match the GitHub Actions environment precisely

set -e  # Exit on any error

echo "🚀 Starting Docker-based GitHub Actions test environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

if [ ! -f "test.db" ]; then
    sudo rm -f test.db
fi


# Stop any existing test containers and networks
print_status "Cleaning up any existing test containers..."
docker stop divemap-test-mysql divemap-test-backend 2>/dev/null || true
docker rm divemap-test-mysql divemap-test-backend 2>/dev/null || true
docker network rm divemap-test-network 2>/dev/null || true

# Create test network
print_status "Creating test network..."
docker network create divemap-test-network

# Start MySQL test database (exactly like GitHub Actions)
print_status "Starting MySQL test database (GitHub Actions style)..."
docker run -d \
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

# Wait for MySQL to be ready
print_status "Waiting for MySQL to be ready..."
timeout=20
counter=0
while ! docker exec divemap-test-mysql mysqladmin ping -h localhost; do
    if [ $counter -ge $timeout ]; then
        print_error "MySQL failed to start within $timeout seconds"
        docker logs divemap-test-mysql
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
done
print_success "MySQL is ready"

# Create a temporary Dockerfile for testing
print_status "Creating test Dockerfile..."
cat > Dockerfile.test << 'EOF'
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    netcat-openbsd \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Make migration scripts executable
RUN chmod +x /app/run_migrations.py
RUN chmod +x /app/run_migrations_docker.sh
RUN chmod +x /app/test_netcat_ipv6.sh
RUN chmod +x /app/startup.sh

# Set environment variables exactly like GitHub Actions
ENV GITHUB_ACTIONS=true
ENV DATABASE_URL=mysql+pymysql://root:password@divemap-test-mysql:3306/divemap_test
ENV SECRET_KEY=test-secret-key-for-ci
ENV ENVIRONMENT=ci
ENV PYTHONPATH=/app/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH
ENV GOOGLE_CLIENT_ID=dummy-client-id-for-testing

# Expose port
EXPOSE 8000
EOF

# Build test image
print_status "Building test Docker image..."
docker build -f Dockerfile.test -t divemap-test-backend .

# Run the test container with GitHub Actions environment
print_status "Running tests in Docker container (GitHub Actions environment)..."
docker run --rm \
    --name divemap-test-runner \
    --network divemap-test-network \
    -v "$(pwd)/.pytest_cache:/app/.pytest_cache" \
    divemap-test-backend \
    bash -c "
        # Create virtual environment (like GitHub Actions)
        python -m venv divemap_venv
        source divemap_venv/bin/activate
        
        # Install dependencies in virtual environment
        pip install --upgrade pip
        pip install -r requirements.txt
        
        # Set PYTHONPATH
        export PYTHONPATH=\"/app/divemap_venv/lib/python3.11/site-packages:\$PYTHONPATH\"
        
        # Wait for database to be ready
        echo 'Waiting for database connection...'
        until mysql -h divemap-test-mysql -u root -ppassword -e 'SELECT 1;' ; do
            echo 'Waiting for MySQL...'
            sleep 2
        done
        
        # Create test database
        mysql -h divemap-test-mysql -u root -ppassword -e 'CREATE DATABASE IF NOT EXISTS divemap_test;'
        
        # Run migrations
        echo 'Running database migrations...'
        alembic upgrade head
        
        # Run tests with exact GitHub Actions command
        echo 'Running tests...'
        python -m pytest tests/ -v --cov=app --cov-report=term-missing -x --maxfail=5 --tb=short
    "

# Check exit code
if [ $? -eq 0 ]; then
    print_success "All tests passed! 🎉"
    print_status "Coverage information displayed in terminal output"
else
    print_error "Tests failed! Check the output above for details."
fi

# Cleanup
print_status "Cleaning up test containers..."
docker stop divemap-test-mysql 2>/dev/null || true
docker rm divemap-test-mysql 2>/dev/null || true
docker rmi divemap-test-backend 2>/dev/null || true
docker network rm divemap-test-network 2>/dev/null || true
rm -f Dockerfile.test

print_success "GitHub Actions-like test run completed!"
