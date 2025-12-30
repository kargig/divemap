# Deployment Overview

This document provides comprehensive information about deploying the Divemap application, including different deployment strategies, infrastructure setup, and operational considerations.

## Table of Contents

1. [Overview](#overview)
2. [Production Readiness Status](#production-readiness-status)
3. [Deployment Strategies](#deployment-strategies)
   - [Nginx Proxy Production Deployment](#1-nginx-proxy-production-deployment-recommended-for-production)
   - [Makefile Deployment](#2-makefile-deployment-legacy-separate-apps)
   - [Docker Compose](#3-docker-compose-development)
   - [Fly.io](#4-flyio-production)
   - [Kubernetes](#5-kubernetes-enterprise)
4. [Infrastructure Components](#infrastructure-components)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Process](#deployment-process)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Overview

Divemap is designed for cloud deployment with containerized services, automated migrations, and robust health checks. The application supports multiple deployment environments and can be scaled according to demand.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  Load Balancer / CDN                                      │
│  ├── SSL Termination                                       │
│  ├── Static Asset Caching                                  │
│  └── Geographic Distribution                               │
├─────────────────────────────────────────────────────────────┤
│  Application Services                                      │
│  ├── Frontend Container (React)                           │
│  ├── Backend Container (FastAPI)                          │
│  └── Database Container (MySQL)                           │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Services                                   │
│  ├── Container Orchestration                               │
│  ├── Service Discovery                                     │
│  ├── Health Monitoring                                     │
│  └── Log Aggregation                                       │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                │
│  ├── Primary Database (MySQL)                              │
│  ├── Database Replicas                                     │
│  ├── Backup Storage                                        │
│  └── Cache Layer (Redis)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **Containerized Deployment**: Docker-based deployment for consistency
- **Automated Migrations**: Database migrations run automatically
- **Health Checks**: Comprehensive health monitoring
- **SSL/TLS Support**: Secure HTTPS connections
- **Scalability**: Horizontal scaling capabilities
- **Monitoring**: Real-time application monitoring
- **Backup Strategy**: Automated database backups

## Production Readiness Status

### 🎯 **Current Status: READY FOR PRODUCTION DEPLOYMENT**

The `feature/nginx-proxy-implementation` branch is now **100% production-ready** with all necessary components implemented for Fly.io deployment. **No SSL certificates are needed as Fly.io handles TLS termination automatically.**

#### **What Has Been Implemented** ✅

1. **Production Nginx Configuration** - HTTP-only with security headers and rate limiting
2. **Production Dockerfile** - Alpine-based with proper security practices
3. **Fly.io Configuration** - Optimized for production with health checks
4. **No SSL Management** - Fly.io handles TLS termination automatically
5. **Comprehensive Documentation** - Complete deployment and troubleshooting guides

#### **Key Benefits** 🚀

- **Unified Domain**: Single domain (divemap.gr) for frontend and backend
- **No CORS Issues**: Same-origin requests eliminate cross-origin cookie problems
- **Enterprise Security**: Comprehensive security headers and rate limiting
- **Simplified Deployment**: No SSL certificate management required
- **Performance Optimized**: Gzip compression, caching, and connection pooling

#### **Architecture** 🏗️

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

**This implementation can be deployed to production immediately** following the deployment guide in the [Fly.io guide](./fly-io.md#nginx-proxy-production-deployment).

---

## Deployment Strategies

### 1. Nginx Proxy Production Deployment (Recommended for Production)

#### Unified Entry Point
The nginx proxy provides a unified entry point for both frontend and backend services, solving cross-origin cookie issues and providing enterprise-grade security features.

```bash
# Deploy nginx proxy (handles both frontend and backend)
cd nginx
fly launch --no-deploy
fly deploy -a divemap-nginx-proxy
```

#### Nginx Proxy Features
- **SSL Termination**: Handles HTTPS for divemap.gr
- **Unified Domain**: Single domain for frontend and backend
- **Security Headers**: Comprehensive security protection
- **Rate Limiting**: API protection and abuse prevention
- **Client IP Handling**: Proper Fly-Client-IP forwarding
- **Performance**: Gzip compression and caching

#### Production URLs
- **Main Application**: https://divemap.gr/
- **API Endpoints**: https://divemap.gr/api/
- **Documentation**: https://divemap.gr/docs

#### Prerequisites
- SSL certificates for divemap.gr
- Existing Fly.io apps (db, backend, frontend) running
- Domain DNS configured

**For detailed instructions, see the [Nginx Proxy Production Deployment section](./fly-io.md#nginx-proxy-production-deployment) in the Fly.io guide.**

### 2. Makefile Deployment (Legacy Separate Apps)

#### Streamlined Deployment
The project includes a Makefile that provides simplified deployment commands for both backend and frontend components.

```bash
# Deploy both backend and frontend
make deploy

# Deploy only backend
make deploy-backend

# Deploy only frontend
make deploy-frontend

# Show help and available commands
make help
```

#### Makefile Features
- **Sequential Deployment**: Backend deploys first, then frontend
- **Individual Targets**: Deploy specific components as needed
- **Clear Feedback**: Status messages and deployment URLs
- **Error Handling**: Proper error reporting and exit codes

#### Deployment URLs
- **Frontend**: https://divemap.fly.dev/
- **Backend**: https://divemap-backend.fly.dev/

#### Prerequisites
- Fly.io CLI installed and authenticated
- Frontend `.env` file configured with `VITE_GOOGLE_CLIENT_ID`
- Backend environment variables configured

### 3. Docker Compose (Development)

#### Local Development
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### Container Configuration

**Frontend Container**
- **Port**: 3000 (dev) / 80 (prod)
- **Hot Reloading**: Enabled in development
- **Build**: Optimized for production

**Backend Container**
- **Port**: 8000
- **Health Checks**: Built-in monitoring
- **Database Migrations**: Run automatically
- **IPv6 Support**: Enabled

**Database Container**
- **Port**: 3306
- **Data Persistence**: Volume mounted
- **Backup Support**: Automated backups

#### Development Workflow
```bash
# Hot reloading
docker-compose logs -f frontend
docker-compose logs -f backend

# Database access
docker-compose exec db mysql -u divemap_user -p divemap

# Run migrations
docker-compose exec backend python run_migrations.py

# Testing
docker-compose exec backend python -m pytest
docker-compose exec frontend npm test
```

#### Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=mysql+pymysql://divemap_user:divemap_password@db:3306/divemap
    depends_on:
      - db

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=divemap
      - MYSQL_USER=divemap_user
      - MYSQL_PASSWORD=divemap_password
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
```

#### Docker Quick Reference

##### 🐳 Dockerfile Types

| Dockerfile | Purpose | Size | Use Case |
|------------|---------|------|----------|
| `frontend/Dockerfile` | Production | 144MB | Production deployment |
| `frontend/Dockerfile.dev` | Development | ~200MB | Development & testing |

##### 🚀 Quick Commands

**Production Build**
```bash
cd frontend
docker build -t divemap_frontend_prod .
docker run -p 8080:8080 divemap_frontend_prod
```

**Development Build**
```bash
cd frontend
docker build -f Dockerfile.dev -t divemap_frontend_dev .
docker run -p 3000:3000 divemap_frontend_dev
```

**Testing**
```bash
# Run tests in development container
docker run divemap_frontend_dev npm run test:frontend
docker run divemap_frontend_dev npm run test:validation
docker run divemap_frontend_dev npm run test:e2e
```

##### 📦 Dependency Management

**Production Dependencies**
- React, React DOM, React Router
- React Query, Axios
- OpenLayers, Tailwind CSS
- Lucide React icons

**Development Dependencies**
- Puppeteer (testing)
- Testing libraries

##### 🔧 Key Differences

| Feature | Production | Development |
|---------|------------|-------------|
| **Dependencies** | Production only | All dependencies |
| **Testing** | ❌ No | ✅ Full suite |
| **Size** | 144MB | ~200MB |
| **Security** | ✅ Optimized | ⚠️ Dev tools |
| **Hot Reload** | ❌ No | ✅ Yes |

##### 🐛 Troubleshooting

**Common Issues**

1. **Tests failing in production**
   ```bash
   # Use development Dockerfile for testing
   docker build -f Dockerfile.dev -t divemap_frontend_test .
   docker run divemap_frontend_test npm run test:frontend
   ```

2. **Large image size**
   ```bash
   # Use production Dockerfile
   docker build -t divemap_frontend_prod .
   ```

3. **Missing dependencies**
   ```bash
   # Check package.json structure
   cat package.json | grep -A 10 "dependencies"
   cat package.json | grep -A 10 "devDependencies"
   ```

##### 📊 Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Image Size** | 797MB | 144MB | 82% reduction |
| **Build Time** | Slower | Faster | Optimized |
| **Security** | ⚠️ Dev tools | ✅ Clean | Enhanced |

**💡 Tip**: Use `Dockerfile.dev` for development and testing, `Dockerfile` for production deployment.

### 4. Fly.io (Production)

#### Cloud Deployment
```bash
# Deploy to Fly.io
fly deploy

# Check deployment status
fly status

# View logs (oneshot)
fly logs -n

# View logs (tail/follow)
fly logs
```

**Note**: The `-n` flag is required for oneshot commands. Without it, `fly logs` will tail the logs continuously.

#### Fly.io Configuration

**Frontend (`frontend/fly.toml`)**
```toml
app = "divemap"
primary_region = "iad"

[env]
  NODE_ENV = "production"
  VITE_API_URL = "https://divemap-backend.fly.dev"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  min_machines_running = 0
```

**Backend (`backend/fly.toml`)**
```toml
app = "divemap-backend"
primary_region = "iad"

[env]
  DATABASE_URL = "mysql+pymysql://divemap_user:divemap_password@divemap-db.flycast:3306/divemap"
  SECRET_KEY = "your-secret-key"

[http_service]
  internal_port = 8000
  force_https = true
  min_machines_running = 1

[[http_service.checks]]
  path = "/health"
```

**Database (`database/fly.toml`)**
```toml
app = "divemap-db"
primary_region = "iad"

[env]
  MYSQL_ROOT_PASSWORD = "your-root-password"
  MYSQL_DATABASE = "divemap"
  MYSQL_USER = "divemap_user"
  MYSQL_PASSWORD = "divemap_password"

[mounts]
  source = "divemap_data"
  destination = "/var/lib/mysql"
```

#### Initial Setup
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh
fly auth login

# Create applications
fly apps create divemap
fly apps create divemap-backend
fly apps create divemap-db

# Create volume
fly volumes create divemap_data --size 10 --region iad
```

#### Deploy Applications
```bash
# Deploy database
cd database && fly deploy

# Deploy backend
cd ../backend && fly deploy

# Deploy frontend
cd ../frontend && fly deploy
```

### 5. Kubernetes (Enterprise)

#### Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: divemap-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: divemap-backend
  template:
    metadata:
      labels:
        app: divemap-backend
    spec:
      containers:
      - name: backend
        image: divemap-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: divemap-secrets
              key: database-url
```

## Infrastructure Components

### 1. Application Services

#### Frontend Service
- **Technology**: React with Node.js
- **Port**: 3000 (development), 80 (production)
- **Build Process**: Webpack with optimization
- **Static Assets**: CDN distribution
- **Health Check**: `/health` endpoint

#### Backend Service
- **Technology**: FastAPI with Python
- **Port**: 8000
- **API Documentation**: Automatic OpenAPI generation
- **Health Check**: `/health` endpoint
- **Database Migrations**: Automatic execution

#### Database Service
- **Technology**: MySQL 8.0
- **Port**: 3306
- **Persistence**: Volume mounts for data
- **Backup**: Automated daily backups
- **Replication**: Read replicas for scaling

### 2. Infrastructure Services

#### Load Balancer
- **SSL Termination**: Automatic SSL certificate management
- **Health Checks**: Regular service health monitoring
- **Rate Limiting**: DDoS protection
- **Caching**: Static asset caching

#### Monitoring
- **Application Metrics**: Response times, error rates
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Database Metrics**: Query performance, connection counts
- **Alerting**: Automated alerts for issues

#### Logging
- **Centralized Logging**: All service logs aggregated
- **Log Rotation**: Automatic log file management
- **Search and Analysis**: Log querying and analysis tools
- **Retention**: Configurable log retention periods

### 3. Security Components

#### Network Security
- **Firewall**: Network-level access controls
- **SSL/TLS**: Encrypted communication
- **VPN**: Secure administrative access
- **DDoS Protection**: Traffic filtering and rate limiting

#### Application Security
- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API abuse prevention

## Environment Configuration

### Environment Variables

#### Required Variables
```bash
# Application
SECRET_KEY=your-secure-secret-key
DEBUG=false
ENVIRONMENT=production

# Database
DATABASE_URL=mysql+pymysql://user:password@host:3306/database
DATABASE_PASSWORD=your-database-password

# JWT
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Optional Variables
```bash
# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# CORS Configuration
# Comma-separated list of allowed origins for CORS
# This controls which domains can make requests to your API
# Example: ALLOWED_ORIGINS=https://divemap.fly.dev
ALLOWED_ORIGINS=https://divemap.fly.dev,https://divemap-frontend.fly.dev

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
```

### CORS Configuration

The application uses CORS (Cross-Origin Resource Sharing) to control which domains can access your API. This is crucial for security and proper frontend-backend communication.

#### Environment Variable
```bash
# Set allowed origins (comma-separated)
ALLOWED_ORIGINS=https://divemap.fly.dev,https://divemap-frontend.fly.dev
```

#### Docker Compose Setup
The `docker-compose.yml` files automatically handle CORS configuration:

```yaml
environment:
  - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost,http://127.0.0.1}
```

### Configuration Management

#### Development Environment
```bash
# .env (development)
DEBUG=true
DATABASE_URL=mysql+pymysql://divemap_user:divemap_password@localhost:3306/divemap
LOG_LEVEL=DEBUG
VITE_API_URL=http://localhost:8000
VITE_ENVIRONMENT=development
```

#### Production Environment
```bash
# .env.production
DEBUG=false
DATABASE_URL=mysql+pymysql://prod_user:prod_password@prod-host:3306/divemap
LOG_LEVEL=WARNING
VITE_API_URL=https://divemap-backend.fly.dev
VITE_ENVIRONMENT=production
```

#### Environment File Setup

1. **Copy from template**: `cp env.example .env.production`
2. **Edit production values**: Update URLs, credentials, and settings
3. **Deploy with production config**: `make deploy-frontend` automatically uses `.env.production`
4. **Keep separate**: Never commit `.env.production` to version control

## Environment File Management

### Overview
The project uses separate environment files for different deployment scenarios to maintain clean separation between development and production configurations.

### Environment Files

| File | Purpose | Usage | Git Status |
|------|---------|-------|------------|
| `env.example` | Template with example values | Copy to create new env files | ✅ Committed |
| `.env` | Development environment | Local development, Docker Compose | ❌ Gitignored |
| `.env.production` | Production environment | Production deployment | ❌ Gitignored |

### Creating Environment Files

#### Development Environment
```bash
# Copy template for development
cp env.example .env

# Edit with development values
nano .env
```

#### Production Environment
```bash
# Copy template for production
cp env.example .env.production

# Edit with production values
nano .env.production
```

### Environment File Contents

#### Development (`.env`)
```bash
# Frontend
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_ENVIRONMENT=development

# Backend
DATABASE_URL=mysql+pymysql://divemap_user:divemap_password@db:3306/divemap
SECRET_KEY=your_development_secret_key
DEBUG=true
ENVIRONMENT=development
```

#### Production (`.env.production`)
```bash
# Frontend
VITE_API_URL=https://divemap-backend.fly.dev
VITE_GOOGLE_CLIENT_ID=your_production_google_client_id
VITE_ENVIRONMENT=production

# Backend
DATABASE_URL=mysql+pymysql://prod_user:prod_password@prod_host:3306/divemap
SECRET_KEY=your_production_secret_key
DEBUG=false
ENVIRONMENT=production
```

### Deployment Commands

```bash
# Deploy frontend with production environment
make deploy-frontend

# Deploy backend with production environment
make deploy-backend

# Deploy both with production environment
make deploy
```

## Deployment Process

### 1. Pre-Deployment Checklist

#### Code Quality
- [ ] All tests passing
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Performance benchmarks met
- [ ] Documentation updated

#### Infrastructure
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Monitoring configured
- [ ] Backup procedures tested

#### Security
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Authentication tested
- [ ] Authorization verified
- [ ] Input validation tested

### 2. Deployment Steps

#### Step 1: Build and Test
```bash
# Build containers
docker-compose build

# Run tests
docker-compose exec backend python -m pytest
node test_regressions.js
```

#### Step 2: Database Migration
```bash
# Run migrations
docker-compose exec backend python run_migrations.py

# Verify migration status
docker-compose exec backend alembic current
```

#### Step 3: Deploy Application
```bash
# Deploy to production
fly deploy

# Check deployment status
fly status
```

#### Step 4: Verify Deployment
```bash
# Check application health
curl https://divemap.fly.dev/health

# Check API endpoints
curl https://divemap-backend.fly.dev/api/v1/dive-sites/

# Check database connectivity
docker-compose exec backend python -c "from app.database import engine; print(engine.connect())"
```

### 3. Post-Deployment Verification

#### Health Checks
```bash
# Application health
curl -f https://divemap.fly.dev/health

# API health
curl -f https://divemap-backend.fly.dev/health

# Database health
docker-compose exec db mysql -u divemap_user -p -e "SELECT 1"
```

#### Functional Tests
```bash
# Run regression tests
node test_regressions.js

# Test user flows
npm run test:e2e
```

#### Performance Tests
```bash
# Load testing
ab -n 1000 -c 10 https://divemap.fly.dev/

# Response time testing
curl -w "@curl-format.txt" -o /dev/null -s https://divemap.fly.dev/
```

## Monitoring and Maintenance

### 1. Application Monitoring

#### Health Monitoring
- **Endpoint Monitoring**: Regular health check requests
- **Response Time**: Track API response times
- **Error Rates**: Monitor error percentages
- **Availability**: Track uptime and availability

#### Performance Monitoring
- **CPU Usage**: Monitor CPU utilization
- **Memory Usage**: Track memory consumption
- **Disk Usage**: Monitor disk space
- **Network I/O**: Track network traffic

### 2. Database Monitoring

#### Database Metrics
- **Connection Count**: Monitor active connections
- **Query Performance**: Track slow queries
- **Lock Contention**: Monitor database locks
- **Replication Lag**: Track replication delays

#### Backup Monitoring
- **Backup Success**: Monitor backup completion
- **Backup Size**: Track backup file sizes
- **Restore Testing**: Regular restore testing
- **Retention Policy**: Monitor backup retention

### 3. Infrastructure Monitoring

#### Container Monitoring
- **Container Health**: Monitor container status
- **Resource Usage**: Track CPU and memory
- **Restart Count**: Monitor container restarts
- **Log Analysis**: Analyze container logs

#### Network Monitoring
- **Traffic Patterns**: Monitor network traffic
- **Latency**: Track network latency
- **Bandwidth**: Monitor bandwidth usage
- **Security Events**: Monitor security alerts

### 4. Alerting

#### Alert Configuration
```yaml
# alerting.yaml
alerts:
  - name: "High CPU Usage"
    condition: "cpu_usage > 80%"
    duration: "5m"
    severity: "warning"

  - name: "Database Connection Errors"
    condition: "db_connection_errors > 10"
    duration: "1m"
    severity: "critical"

  - name: "Application Errors"
    condition: "error_rate > 5%"
    duration: "2m"
    severity: "warning"
```

#### Notification Channels
- **Email**: Critical alerts sent via email
- **Slack**: Team notifications via Slack
- **SMS**: Emergency alerts via SMS
- **PagerDuty**: On-call notifications

## Troubleshooting

### Logs Usage

When troubleshooting, use the appropriate `fly logs` command:

- **Quick Checks**: Use `fly logs -n` for one-time log viewing
- **Continuous Monitoring**: Use `fly logs` (without `-n`) to follow logs in real-time

### Common Issues

#### 1. Deployment Failures

**Problem**: Application fails to deploy

**Solution**:
```bash
# Check deployment logs
fly logs -n

# Verify configuration
fly config show

# Check resource limits
fly status
```

#### 2. Database Connection Issues

**Problem**: Application can't connect to database

**Solution**:
```bash
# Check database status
docker-compose exec db mysql -u root -p -e "SHOW PROCESSLIST"

# Verify connection string
echo $DATABASE_URL

# Test connectivity
docker-compose exec backend python -c "from app.database import engine; print(engine.connect())"
```

#### 3. Performance Issues

**Problem**: Application is slow or unresponsive

**Solution**:
```bash
# Check resource usage
docker stats

# Monitor application logs
docker-compose logs -f backend

# Check database performance
docker-compose exec db mysql -u divemap_user -p -e "SHOW PROCESSLIST"
```

#### 4. SSL Certificate Issues

**Problem**: SSL certificate errors

**Solution**:
```bash
# Check certificate status
fly certs

# Renew certificates
fly certs renew

# Verify HTTPS configuration
curl -I https://divemap.fly.dev/
```

### Debug Commands

#### Application Debugging
```bash
# Check application logs
fly logs -n

# Connect to application shell
fly ssh console

# Check environment variables
fly ssh console -C "env | grep DATABASE"
```

#### Database Debugging
```bash
# Connect to database
docker-compose exec db mysql -u divemap_user -p divemap

# Check database status
SHOW STATUS;

# Check slow queries
SHOW PROCESSLIST;
```

#### Network Debugging
```bash
# Test connectivity
curl -v https://divemap.fly.dev/

# Check DNS resolution
nslookup divemap.fly.dev

# Test SSL certificate
openssl s_client -connect divemap.fly.dev:443
```

## Best Practices

### 1. Deployment Best Practices

#### Version Control
- **Tagged Releases**: Use semantic versioning
- **Rollback Strategy**: Maintain rollback procedures
- **Change Documentation**: Document all changes
- **Testing**: Comprehensive testing before deployment

#### Configuration Management
- **Environment Separation**: Separate dev/staging/prod configs
- **Secret Management**: Secure secret storage
- **Configuration Validation**: Validate all configurations
- **Documentation**: Document all configuration options

### 2. Monitoring Best Practices

#### Metrics Collection
- **Comprehensive Coverage**: Monitor all critical components
- **Alert Thresholds**: Set appropriate alert thresholds
- **Historical Data**: Maintain historical metrics
- **Trend Analysis**: Analyze trends and patterns

#### Incident Response
- **Runbooks**: Maintain detailed runbooks
- **Escalation Procedures**: Clear escalation paths
- **Post-Incident Reviews**: Learn from incidents
- **Continuous Improvement**: Regular process updates

### 3. Security Best Practices

#### Access Control
- **Principle of Least Privilege**: Minimal access required
- **Regular Access Reviews**: Periodic access audits
- **Multi-factor Authentication**: Where possible, implement MFA
- **Session Management**: Secure session handling

#### Data Protection
- **Encryption at Rest**: Encrypt sensitive data
- **Encryption in Transit**: Use HTTPS everywhere
- **Backup Security**: Secure backup procedures
- **Data Retention**: Appropriate data retention policies

## Conclusion

This deployment guide provides comprehensive information for deploying and maintaining the Divemap application. The deployment strategy is designed to be:

1. **Scalable**: Can grow with application needs
2. **Reliable**: Robust error handling and monitoring
3. **Secure**: Comprehensive security measures
4. **Maintainable**: Clear procedures and documentation

For specific deployment platforms, see the individual deployment guides in this directory.
