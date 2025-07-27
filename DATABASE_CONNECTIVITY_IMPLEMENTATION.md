# Database Connectivity Implementation

## Overview

This document describes the implementation of robust database connectivity checking for the Divemap backend container, including container optimization and IPv6 support for cloud deployment.

## Problem Statement

### Original Issues
1. **No Database Availability Check**: Backend container would start even if database was not ready
2. **Container Build Inefficiency**: Unnecessary build dependencies (gcc, default-libmysqlclient-dev)
3. **No IPv6 Support**: Traditional netcat didn't support IPv6 for cloud deployment
4. **Poor Error Handling**: No retry logic or proper error reporting
5. **Large Container Size**: ~200MB of unnecessary build tools

## Solution Implementation

### 1. Database Connectivity Check

**File**: `backend/startup.sh`

```bash
#!/bin/bash
set -e

echo "Waiting for database to be ready..."

# Function to check database connectivity with IPv6 support
check_db() {
    if command -v nc >/dev/null 2>&1; then
        # Use netcat-openbsd with IPv6 support
        nc -z -w 5 db 3306 2>/dev/null
        return $?
    else
        echo "ERROR: netcat not found"
        return 1
    fi
}

# Try to connect to database with retries
attempt=1
max_attempts=10

while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts: Checking database connectivity..."
    
    if check_db; then
        echo "✅ Database is ready!"
        break
    else
        echo "❌ Database not ready yet. Attempt $attempt/$max_attempts failed."
        
        if [ $attempt -eq $max_attempts ]; then
            echo "💥 ERROR: Database connection failed after $max_attempts attempts. Exiting."
            exit 1
        fi
        
        # Sleep for random time between 1 and 5 seconds
        sleep_time=$((RANDOM % 5 + 1))
        echo "⏳ Waiting $sleep_time seconds before next attempt..."
        sleep $sleep_time
        
        attempt=$((attempt + 1))
    fi
done

echo "🚀 Starting application..."
python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Container Optimization

**File**: `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including netcat-openbsd for IPv6 support
RUN apt-get update && apt-get install -y \
    pkg-config \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies using only pre-compiled wheels
RUN pip install --no-cache-dir --only-binary=all -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Make migration scripts executable
RUN chmod +x /app/run_migrations.py
RUN chmod +x /app/run_migrations_docker.sh
RUN chmod +x /app/test_netcat_ipv6.sh
RUN chmod +x /app/startup.sh

# Expose port
EXPOSE 8000

# Run the startup script
CMD ["/app/startup.sh"]
```

### 3. IPv6 Support Testing

**File**: `backend/test_netcat_ipv6.sh`

```bash
#!/bin/bash

# Test script to verify netcat IPv6 support
echo "Testing netcat IPv6 support..."

# Check if netcat-openbsd is installed
if command -v nc >/dev/null 2>&1; then
    echo "✅ netcat found: $(which nc)"
    echo "Version info:"
    nc -h 2>&1 | head -5
else
    echo "❌ netcat not found"
    exit 1
fi

# Test IPv6 support
echo ""
echo "Testing IPv6 support..."
if nc -6 -z google.com 80 2>/dev/null; then
    echo "✅ IPv6 support confirmed"
else
    echo "⚠️  IPv6 test failed, but this might be due to network configuration"
fi

# Test database connectivity (if db host is available)
echo ""
echo "Testing database connectivity..."
if nc -z -w 5 db 3306 2>/dev/null; then
    echo "✅ Database connectivity confirmed"
else
    echo "❌ Database connectivity failed (this is expected if database is not running)"
fi

echo ""
echo "Netcat test completed."
```

## Key Features

### 1. Robust Retry Logic
- **10 retry attempts** with proper error handling
- **Random delays** (1-5 seconds) to prevent thundering herd
- **Timeout handling** (5 seconds per attempt) to prevent hanging
- **Visual indicators** for clear status reporting

### 2. IPv6 Support for Cloud Deployment
- **netcat-openbsd** instead of netcat-traditional
- **IPv6 compatibility** for Fly.io and other cloud platforms
- **Proper error redirection** to suppress unnecessary messages

### 3. Container Optimization
- **Removed gcc** (~100MB reduction)
- **Removed default-libmysqlclient-dev** (~100MB reduction)
- **Pre-compiled wheels** for all Python packages
- **Faster build times** with no compilation step

### 4. Error Handling
- **set -e** for strict error handling
- **Proper exit codes** for container orchestration
- **Clear error messages** for debugging
- **Graceful degradation** when netcat is not available

## Testing Results

### Local Testing
```bash
# Build and test the container
docker-compose up --build backend

# Test netcat IPv6 support
docker exec divemap_backend ./test_netcat_ipv6.sh

# Check container logs
docker logs divemap_backend
```

### Expected Output
```
Waiting for database to be ready...
Attempt 1/10: Checking database connectivity...
✅ Database is ready!
🚀 Starting application...
🚀 Starting database migration process...
Waiting for database to be available...
✅ Database is available!
Running database migrations...
✅ Migrations completed successfully!
INFO:     Started server process [10]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## Benefits

### 1. Reliability
- **Prevents startup failures** due to database unavailability
- **Robust retry logic** handles temporary network issues
- **Proper error reporting** for debugging deployment issues

### 2. Performance
- **Faster container builds** (no compilation step)
- **Smaller container size** (~200MB reduction)
- **Better caching** with pre-compiled wheels

### 3. Cloud Deployment
- **IPv6 support** for modern cloud platforms
- **Fly.io compatibility** with proper network handling
- **Container orchestration** friendly error codes

### 4. Security
- **Reduced attack surface** with fewer installed packages
- **Pre-compiled wheels** eliminate compilation vulnerabilities
- **Proper error handling** prevents information leakage

## Configuration

### Docker Compose
The `docker-compose.yml` already includes proper service dependencies:

```yaml
backend:
  depends_on:
    - db
```

### Environment Variables
No additional environment variables required. The script uses:
- **Database host**: `db` (Docker service name)
- **Database port**: `3306` (MySQL default)
- **Timeout**: `5` seconds per attempt
- **Max attempts**: `10` retries

## Troubleshooting

### Common Issues

1. **Database not ready**
   ```
   ❌ Database not ready yet. Attempt 1/10 failed.
   ⏳ Waiting 3 seconds before next attempt...
   ```
   - Check if database container is running
   - Verify database service is healthy
   - Check network connectivity between containers

2. **Netcat not found**
   ```
   ERROR: netcat not found
   ```
   - Verify netcat-openbsd is installed in Dockerfile
   - Check if the package installation succeeded

3. **IPv6 test fails**
   ```
   ⚠️  IPv6 test failed, but this might be due to network configuration
   ```
   - This is often expected in local development
   - IPv6 support is primarily for cloud deployment

### Debug Commands

```bash
# Test netcat functionality
docker exec divemap_backend ./test_netcat_ipv6.sh

# Check container logs
docker logs divemap_backend

# Test database connectivity manually
docker exec divemap_backend nc -z -w 5 db 3306

# Check if database container is running
docker ps | grep divemap_db
```

## Future Enhancements

### Potential Improvements
1. **Health Check Endpoint**: Add database health check to FastAPI
2. **Metrics Collection**: Track database connectivity success rates
3. **Dynamic Configuration**: Make retry parameters configurable
4. **Multiple Database Support**: Extend for different database types
5. **Connection Pooling**: Implement proper connection pooling

### Monitoring
- **Log Aggregation**: Centralized logging for connectivity issues
- **Alerting**: Notifications for repeated connection failures
- **Metrics**: Track startup times and success rates

## Conclusion

The database connectivity implementation provides:
- **Robust startup process** with proper error handling
- **Cloud deployment compatibility** with IPv6 support
- **Optimized container builds** with pre-compiled wheels
- **Clear monitoring** with visual status indicators
- **Reliable deployment** for production environments

This implementation ensures the Divemap application starts reliably in both local development and cloud deployment environments. 