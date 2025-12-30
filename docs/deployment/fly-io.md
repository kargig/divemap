# Fly.io Deployment and Infrastructure Guide

## Overview

This comprehensive guide covers the complete Fly.io deployment and infrastructure setup for the Divemap application, including database connectivity, private IPv6 allocation, and deployment procedures.

## 🚀 Deployment Status

**Current Status:** ✅ **DEPLOYED AND LIVE**

**Production URLs:**
- **Frontend:** https://divemap.fly.dev
- **Backend API:** https://divemap-backend.fly.dev
- **Database:** Internal network only (`divemap-db.flycast`)

**Application Status:**
- ✅ **Database:** Deployed with persistent storage and private IPv6
- ✅ **Backend:** Deployed with automatic migrations and IPv6 connectivity
- ✅ **Frontend:** Deployed with optimized build
- ✅ **Authentication:** Working with JWT tokens
- ✅ **Admin Interface:** Functional with proper access control
- ✅ **API Communication:** All endpoints working correctly
- ✅ **CORS Configuration:** Properly configured for production domains

**Recent Infrastructure Enhancements:**
- ✅ Private IPv6 allocation for database security
- ✅ Flycast connectivity (`divemap-db.flycast`)
- ✅ IPv6 support in startup scripts
- ✅ Optimized container builds with pre-compiled wheels
- ✅ Robust database connectivity checking

## Infrastructure Architecture

### Network Architecture

```
Internet
    │
    ▼
┌─────────────────┐
│  Fly.io Proxy   │
└─────────────────┘
    │
    ▼
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │
│ (Public IPv4)   │◄──►│ (Public IPv4)   │
└─────────────────┘    └─────────────────┘
                              │
                              ▼ (Private IPv6)
                       ┌─────────────────┐
                       │    Database     │
                       │ (Private IPv6)  │
                       └─────────────────┘
```

### Private IPv6 Configuration

**Private IPv6 Allocation:**
```bash
# Allocate private IPv6 address for database
flyctl ips allocate-v6 --private

# This creates a private IPv6 address accessible via flycast
# Database hostname: divemap-db.flycast
```

**Flycast Connectivity:**
- **Database Host**: `divemap-db.flycast` (Fly.io private network)
- **Database Port**: `3306` (MySQL default)
- **Network**: Private IPv6 network within Fly.io
- **Security**: Isolated from public internet

**Benefits of Private IPv6:**
- **Security**: Database not exposed to public internet
- **Performance**: Direct private network communication
- **Reliability**: Stable internal network connectivity
- **Cost**: No additional bandwidth charges for internal traffic

## Database Connectivity Implementation

### Problem Statement

**Original Issues:**
1. **No Database Availability Check**: Backend container would start even if database was not ready
2. **Container Build Inefficiency**: Unnecessary build dependencies (gcc, default-libmysqlclient-dev)
3. **No IPv6 Support**: Traditional netcat didn't support IPv6 for cloud deployment
4. **Poor Error Handling**: No retry logic or proper error reporting
5. **Large Container Size**: ~200MB of unnecessary build tools

### Solution Implementation

#### 1. Database Connectivity Check

**File**: `backend/startup.sh`

```bash
#!/bin/bash
set -e

echo "Waiting for database to be ready..."

# Function to check database connectivity with IPv6 support
check_db() {
    if command -v nc >/dev/null 2>&1; then
        # Use netcat-openbsd with IPv6 support
        nc -z -w 5 divemap-db.flycast 3306 2>/dev/null
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

#### 2. Container Optimization

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

#### 3. IPv6 Support Testing

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
if nc -z -w 5 divemap-db.flycast 3306 2>/dev/null; then
    echo "✅ Database connectivity confirmed"
else
    echo "❌ Database connectivity failed (this is expected if database is not running)"
fi

echo ""
echo "Netcat test completed."
```

### Key Features

#### 1. Robust Retry Logic
- **10 retry attempts** with proper error handling
- **Random delays** (1-5 seconds) to prevent thundering herd
- **Timeout handling** (5 seconds per attempt) to prevent hanging
- **Visual indicators** for clear status reporting

#### 2. IPv6 Support for Cloud Deployment
- **netcat-openbsd** instead of netcat-traditional
- **IPv6 compatibility** for Fly.io and other cloud platforms
- **Proper error redirection** to suppress unnecessary messages

#### 3. Container Optimization
- **Removed gcc** (~100MB reduction)
- **Removed default-libmysqlclient-dev** (~100MB reduction)
- **Pre-compiled wheels** for all Python packages
- **Faster build times** with no compilation step

#### 4. Error Handling
- **set -e** for strict error handling
- **Proper exit codes** for container orchestration
- **Clear error messages** for debugging
- **Graceful degradation** when netcat is not available

## Deployment Process

### Prerequisites

1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Authenticate with Fly: `fly auth login`
3. Create a Fly account if you don't have one

### Application Structure

The application consists of three components:
- **Database**: MySQL database (`divemap-db`) with private IPv6
- **Backend**: FastAPI application (`divemap-backend`) with IPv6 connectivity
- **Frontend**: React application (`divemap-frontend`)

### Deployment Order

Deploy the applications in this order:
1. Database first (with private IPv6)
2. Backend second (with IPv6 connectivity)
3. Frontend last

### Step 1: Deploy Database

```bash
cd database
fly launch --no-deploy
fly volumes create divemap_mysql_data --size 10 --region fra

# Set database secrets
fly secrets set MYSQL_ROOT_PASSWORD="your-secure-root-password" -a divemap-db
fly secrets set MYSQL_PASSWORD="your-secure-password" -a divemap-db

# Deploy database
fly deploy

# Allocate private IPv6 for database
flyctl ips allocate-v6 --private -a divemap-db
```

### Step 2: Deploy Backend

```bash
cd backend
fly launch --no-deploy
fly volumes create divemap_uploads --size 5 --region fra

# Set backend secrets with flycast hostname
fly secrets set DATABASE_URL="mysql+pymysql://divemap_user:divemap_password@divemap-db.flycast:3306/divemap" -a divemap-backend
fly secrets set SECRET_KEY="your-secure-secret-key-here" -a divemap-backend
fly secrets set GOOGLE_CLIENT_ID="your-google-client-id" -a divemap-backend
fly secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret" -a divemap-backend

# Deploy backend
fly deploy
```

### Step 3: Deploy Frontend

```bash
cd frontend

# Create production environment file
cp env.example .env.production

# Edit production environment file
nano .env.production
```

**Update `.env.production` with production values:**
```bash
# API Configuration
VITE_API_URL=https://divemap-backend.fly.dev

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Production Settings
VITE_ENVIRONMENT=production
```

```bash
# Launch Fly.io app (don't deploy yet)
fly launch --no-deploy

# Deploy frontend using production environment
make deploy-frontend
```

**Note**: The `make deploy-frontend` command automatically uses the `.env.production` file for deployment.

## Environment Variables and Secrets

### Backend Secrets

Set these secrets for the backend application:

```bash
# Database connection with flycast hostname
fly secrets set DATABASE_URL="mysql+pymysql://divemap_user:divemap_password@divemap-db.flycast:3306/divemap" -a divemap-backend

# Authentication
fly secrets set SECRET_KEY="your-secure-secret-key-here" -a divemap-backend

# Google OAuth
fly secrets set GOOGLE_CLIENT_ID="your-google-client-id" -a divemap-backend
fly secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret" -a divemap-backend

# CORS Configuration
# Set allowed origins for your frontend domains
fly secrets set ALLOWED_ORIGINS="https://divemap-domain.com" -a divemap-backend

# Redis (if using)
fly secrets set REDIS_URL="redis://divemap-redis.internal:6379" -a divemap-backend
```

### Frontend Environment Configuration

The frontend deployment uses a `.env.production` file instead of Fly.io secrets for better development workflow.

#### Create Production Environment File

```bash
cd frontend

# Copy from template
cp env.example .env.production

# Edit with production values
nano .env.production
```

#### Required Production Variables

```bash
# API Configuration
VITE_API_URL=https://divemap-backend.fly.dev

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Production Settings
VITE_ENVIRONMENT=production
```

#### Deployment

```bash
# Deploy using production environment file
make deploy-frontend

# Or deploy directly from frontend directory
cd frontend
./deploy.sh .env.production
```

**Benefits of `.env.production` approach:**
- ✅ Easier local testing of production configuration
- ✅ Version control friendly (file is gitignored)
- ✅ Consistent with development workflow
- ✅ No need to manage Fly.io secrets for frontend

### Database Secrets

Set these secrets for the database:

```bash
# Database passwords
fly secrets set MYSQL_ROOT_PASSWORD="your-secure-root-password" -a divemap-db
fly secrets set MYSQL_PASSWORD="your-secure-password" -a divemap-db
```

## CORS Configuration

### Overview
CORS (Cross-Origin Resource Sharing) is configured to allow your frontend domains to communicate with the backend API. This is essential for the application to function properly.

### Configuration
The `ALLOWED_ORIGINS` environment variable controls which domains can access your API:

```bash
# Set allowed origins (comma-separated)
fly secrets set ALLOWED_ORIGINS="https://divemap.fly.dev" -a divemap-backend
```

## Security Benefits

### 1. Database Isolation
- **No Public Exposure**: Database not accessible from internet
- **Private Network**: Only accessible via Fly.io private IPv6
- **Internal Communication**: Backend ↔ Database via private network

### 2. Network Security
- **Private IPv6**: Isolated network segment
- **No Public IP**: Database has no public internet access
- **Controlled Access**: Only backend can connect to database

### 3. Data Protection
- **Encrypted Communication**: MySQL connections over private network
- **No External Access**: Database completely isolated
- **Internal Only**: All database traffic stays within Fly.io network

## Performance Benefits

### 1. Network Performance
- **Direct Communication**: Backend ↔ Database via private network
- **Low Latency**: Internal network communication
- **High Bandwidth**: Private network capacity

### 2. Cost Optimization
- **No Bandwidth Charges**: Internal traffic is free
- **Efficient Resource Usage**: Optimized network paths
- **Reduced Load**: No public internet traffic to database

### 3. Reliability
- **Stable Connectivity**: Private network is more reliable
- **No External Dependencies**: Internal communication only
- **Consistent Performance**: Predictable network behavior

## Monitoring and Troubleshooting

### 1. Database Connectivity
```bash
# Check database connectivity from backend
flyctl ssh console -a divemap-backend
nc -z -w 5 divemap-db.flycast 3306

# Check database logs
flyctl logs -a divemap-db
```

### 2. Network Configuration
```bash
# List allocated IPs
flyctl ips list -a divemap-db

# Check private network
flyctl ips list -a divemap-db --private
```

### 3. Application Logs
```bash
# Backend logs
flyctl logs -a divemap-backend

# Frontend logs
flyctl logs -a divemap-frontend
```

### 4. Common Issues

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

### 5. Debug Commands

```bash
# Test netcat functionality
docker exec divemap_backend ./test_netcat_ipv6.sh

# Check container logs
docker logs divemap_backend

# Test database connectivity manually
docker exec divemap_backend nc -z -w 5 divemap-db.flycast 3306

# Check if database container is running
docker ps | grep divemap_db
```

## Managing Secrets

View current secrets:
```bash
fly secrets list -a divemap-backend
fly secrets list -a divemap
fly secrets list -a divemap-db
```

Update a secret:
```bash
fly secrets set SECRET_NAME="new-value" -a app-name
```

Remove a secret:
```bash
fly secrets unset SECRET_NAME -a app-name
```

## Scaling

Scale applications as needed:
```bash
fly scale count 2 -a divemap-backend
fly scale count 1 -a divemap-frontend
```

## Cost Optimization

- Applications are configured with `auto_stop_machines = 'stop'` to save costs
- `min_machines_running = 0` allows complete shutdown when not in use
- Scale down during low-traffic periods
- Private IPv6 traffic is free (no bandwidth charges)

## Custom Domains

To use custom domains:

```bash
fly certs add your-domain.com -a divemap-frontend
fly certs add api.your-domain.com -a divemap-backend
```

## Backup Strategy

- Database data is persisted in Fly volumes
- Consider setting up automated backups
- Test restore procedures regularly

## Performance Monitoring

Monitor application performance:
```bash
fly status
fly logs -n
```

Use Fly's built-in monitoring dashboard for detailed metrics.

## Nginx Proxy Production Deployment

### Overview

The nginx proxy provides a unified entry point for both frontend and backend services, solving cross-origin cookie issues and providing enterprise-grade security features. **Fly.io handles TLS termination at the edge proxy, so no SSL certificates are needed in the nginx application.**

### Architecture

```
Internet (HTTPS)
    │
    ▼
┌─────────────────┐
│  Fly.io Proxy   │  ← TLS termination happens here
│  (divemap.gr)   │
└─────────────────┘
    │ (HTTP internally)
    ▼
┌─────────────────────────┐
│  divemap-nginx-proxy    │  ← HTTP only, no SSL needed
│  (internal HTTP)        │
└─────────────────────────┘
    │ (HTTP internally)
    ├─── Frontend (divemap-frontend.flycast:8080)
    └─── Backend (divemap-backend.flycast:8000)
```

### Key Features

- **Unified Domain**: Single domain (divemap.gr) for frontend and backend
- **No CORS Issues**: Same-origin requests eliminate cross-origin cookie problems
- **Security Headers**: Comprehensive security protection
- **Rate Limiting**: API protection and abuse prevention
- **Client IP Handling**: Proper Fly-Client-IP forwarding
- **Performance**: Gzip compression and caching

### Deployment Steps

#### Step 1: Create the Nginx Proxy App

```bash
cd nginx

# Launch the nginx proxy app (don't deploy yet)
fly launch --no-deploy

# This will create the app and ask for configuration
# App name: divemap-nginx-proxy
# Region: fra (Frankfurt)
# No database needed
```

#### Step 2: Deploy the Nginx Proxy

```bash
# Deploy the nginx proxy (no SSL setup needed)
fly deploy -a divemap-nginx-proxy
```

#### Step 3: Configure Domain Routing

```bash
# Add your domain to the app
fly domains add divemap.gr -a divemap-nginx-proxy

# Add www subdomain
fly domains add www.divemap.gr -a divemap-nginx-proxy
```

#### Step 4: Verify Deployment

```bash
# Check app status
fly status -a divemap-nginx-proxy

# Check logs
fly logs -a divemap-nginx-proxy

# Test health endpoint
curl https://divemap.gr/health
```

### Configuration Details

#### **No SSL Certificate Setup Required** ✅

Fly.io automatically handles:
- **TLS termination** at the edge proxy
- **SSL certificate management** and renewal
- **HTTP to HTTPS redirects**
- **Modern TLS protocols** and cipher suites

Your nginx app only needs to handle HTTP traffic internally.

#### Environment Variables

No special environment variables are needed for SSL:

```bash
# The nginx app runs with default environment
# Fly.io handles all TLS/SSL configuration automatically
```

### Security Features

#### **Rate Limiting**
- **API endpoints**: 15 requests per second with 20 burst
- **Login endpoint**: 8 requests per minute with 5 burst
- **Frontend**: No rate limiting (static content)

#### **Security Headers**
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **X-XSS-Protection**: 1; mode=block (XSS protection)
- **Content-Security-Policy**: Restrictive CSP for security
- **Referrer-Policy**: strict-origin-when-cross-origin

**Note**: HSTS is handled by Fly.io at the edge proxy level.

#### **Client IP Handling**
- **Fly-Client-IP**: Primary header for client IP
- **X-Forwarded-For**: Chain of proxy IPs
- **X-Real-IP**: Direct client IP
- **X-Forwarded-Proto**: Protocol (http/https)

#### **Proxy Chain Configuration**
- **Production proxy chain**: Cloudflare → Fly.io → nginx → frontend → Fly.io → backend
- **Expected proxy hops**: 6 IPs in X-Forwarded-For header
- **Security threshold**: Configured via `SUSPICIOUS_PROXY_CHAIN_LENGTH=6`
- **Development threshold**: Default 3 IPs for stricter monitoring

### Integration with Existing Apps

#### **Backend Integration**

The backend app (`divemap-backend`) should be configured with:

```bash
# CORS origins
fly secrets set ALLOWED_ORIGINS="https://divemap.gr" -a divemap-backend

# Security configuration for production proxy chain
fly secrets set SUSPICIOUS_PROXY_CHAIN_LENGTH="6" -a divemap-backend

# Trust proxy headers
# (Already configured in the backend code)
```

#### **Frontend Integration**

The frontend app (`divemap-frontend`) should be configured with:

```bash
# API URL pointing to nginx proxy
fly secrets set VITE_API_URL="https://divemap.gr/api" -a divemap-frontend
```

### Monitoring and Health Checks

#### **Health Check Endpoint**

```bash
# Health check URL
GET https://divemap.gr/health

# Expected response
HTTP/1.1 200 OK
Content-Type: text/plain

healthy
```

#### **Logging**

```bash
# View nginx logs
fly logs -a divemap-nginx-proxy

# View specific log types
fly logs -a divemap-nginx-proxy | grep "ERROR"
fly logs -a divemap-nginx-proxy | grep "WARN"
```

### Performance Features

#### **Compression and Caching**
- **Gzip compression**: Enabled for text-based content
- **Static asset caching**: 1 year with immutable flag
- **Connection pooling**: 32 keepalive connections
- **Buffer optimization**: 4KB buffers for API responses

### Troubleshooting

#### **Common Issues**

1. **Permission Denied Errors**
   ```bash
   # If you see: "open() /etc/nginx/nginx.conf failed (13: Permission denied)"
   # This is fixed in the current Dockerfile, but if it persists:
   
   fly ssh console -a divemap-nginx-proxy
   ls -la /etc/nginx/nginx.conf
   # Should show: -rw-r--r-- 1 nginx nginx
   
   # If permissions are wrong, redeploy:
   fly deploy -a divemap-nginx-proxy
   ```

2. **Connection Refused**
   ```bash
   # Check if backend/frontend are running
   fly status -a divemap-backend
   fly status -a divemap-frontend
   
   # Verify internal addresses
   fly ssh console -a divemap-nginx-proxy
   ping divemap-backend.flycast
   ping divemap-frontend.flycast
   ```

3. **Rate Limiting Issues**
   ```bash
   # Check nginx logs for rate limiting
   fly logs -a divemap-nginx-proxy | grep "limiting"
   ```

#### **Debug Commands**

```bash
# SSH into the nginx container
fly ssh console -a divemap-nginx-proxy

# Test nginx configuration
nginx -t

# Check nginx process
ps aux | grep nginx

# View nginx error log
tail -f /var/log/nginx/error.log

# Check file permissions
ls -la /etc/nginx/nginx.conf
ls -la /etc/nginx/
```

### Benefits

#### **For Users**
- **Single domain**: No more cross-origin issues
- **Faster authentication**: Refresh tokens work seamlessly
- **Better security**: HTTPS enforcement and security headers
- **Improved performance**: Gzip compression and caching

#### **For Developers**
- **Unified deployment**: Single app to manage
- **Better monitoring**: Centralized logging and health checks
- **Easier debugging**: Single entry point for all traffic
- **Scalability**: Easy to scale and optimize

#### **For Operations**
- **Centralized security**: Single point for security headers
- **Better monitoring**: Unified access logs and metrics
- **Easier maintenance**: Single service to update
- **Cost optimization**: Efficient resource usage
- **No SSL maintenance**: Fly.io handles everything automatically

### Deployment Checklist

- [ ] Fly.io CLI installed and authenticated
- [ ] Existing apps (db, backend, frontend) running
- [ ] Domain DNS configured
- [ ] Nginx proxy app created
- [ ] App deployed successfully
- [ ] Domain routing configured
- [ ] Health checks passing
- [ ] Frontend accessible via HTTPS
- [ ] Backend API accessible via HTTPS
- [ ] Client IP headers working
- [ ] Rate limiting functional
- [ ] Security headers present
- [ ] Monitoring and logging working

**Note**: SSL/TLS setup is handled automatically by Fly.io - no manual configuration needed.

## Future Enhancements

### 1. Multi-Region Deployment
- **Global Distribution**: Deploy to multiple Fly.io regions
- **Database Replication**: Implement database replication across regions
- **Load Balancing**: Distribute traffic across regions

### 2. Advanced Security
- **Encryption**: Implement end-to-end encryption for all communications
- **Access Control**: Implement role-based access control
- **Audit Logging**: Comprehensive logging of all database access

### 3. Performance Optimization
- **Connection Pooling**: Implement database connection pooling
- **Caching**: Add Redis caching layer
- **CDN**: Implement content delivery network for static assets

### 4. Monitoring Improvements
- **Health Check Endpoint**: Add database health check to FastAPI
- **Metrics Collection**: Track database connectivity success rates
- **Dynamic Configuration**: Make retry parameters configurable
- **Multiple Database Support**: Extend for different database types

## Conclusion

The Fly.io deployment and infrastructure configuration provides:
- **Secure Database Access**: Private IPv6 network isolation
- **High Performance**: Direct private network communication
- **Cost Optimization**: Free internal network traffic
- **Reliable Deployment**: Robust connectivity and startup processes
- **Scalable Architecture**: Foundation for future enhancements
- **Robust Startup Process**: Proper error handling and retry logic
- **Cloud Deployment Compatibility**: IPv6 support for modern platforms
- **Optimized Container Builds**: Pre-compiled wheels for faster builds
- **Clear Monitoring**: Visual status indicators and comprehensive logging

This configuration ensures the Divemap application runs securely and efficiently in the Fly.io cloud environment with proper database connectivity, private networking, and reliable deployment processes.
