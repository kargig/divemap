# Nginx Proxy Implementation Plan for Divemap

## Overview

This document outlines the plan to implement nginx as a reverse proxy for both development and production environments. This approach will solve the cross-origin cookie issues currently preventing refresh tokens from working properly.

## Problem Statement

**Current Issue**: Refresh token cookies are not being sent with cross-origin requests between frontend (`127.0.0.1:3000`) and backend (`127.0.0.1:8000`) in development, and between `https://divemap.gr` and `https://divemap-backend.fly.dev` in production.

**Root Cause**: Browsers fundamentally do not allow cookies to be sent across different origins, even with proper CORS configuration and `SameSite=lax` settings.

## Solution Architecture

### Development Environment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Nginx Proxy   │    │   Services      │
│                 │    │                 │    │                 │
│ localhost:80    │───▶│ localhost:80    │───▶│ Frontend       │
│                 │    │                 │    │ localhost:3001  │
│                 │    │                 │    │ Backend        │
│                 │    │                 │    │ localhost:8001  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Production Environment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Nginx Proxy   │    │   Services      │
│                 │    │                 │    │                 │
│ divemap.gr      │───▶│ divemap.gr      │───▶│ Frontend       │
│                 │    │                 │    │ Backend        │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implementation Phases

### Phase 1: Development Environment Setup

#### 1.1 Create Nginx Configuration
- **File**: `nginx/dev.conf`
- **Port**: 80 (standard HTTP)
- **Features**:
  - Frontend proxy (`/` → `divemap_frontend:3001`)
  - Backend API proxy (`/api/` → `divemap_backend:8001`)
  - Backend docs proxy (`/docs`, `/openapi.json` → `divemap_backend:8001`)

#### 1.2 Update Docker Compose
- **File**: `docker-compose.dev.yml`
- **Changes**:
  - Add nginx service
  - Change frontend port from `3000:3000` to `3001:3000`
  - Change backend port from `8000:8000` to `8001:8000`
  - Add nginx dependency

#### 1.3 Update Environment Variables
- **Frontend**: `REACT_APP_API_URL=http://localhost/api`
- **Backend**: `CORS_ORIGINS=http://localhost`, `ALLOWED_ORIGINS=http://localhost`

#### 1.4 Update Backend CORS Configuration
- Modify `backend/app/main.py` to only allow `http://localhost` in development
- Remove production origins from development CORS

### Phase 2: Production Environment Setup

#### 2.1 Create Production Nginx Configuration
- **File**: `nginx/prod.conf`
- **Ports**: 80 (HTTP) and 443 (HTTPS)
- **Features**:
  - SSL/TLS termination
  - Security headers
  - Rate limiting
  - Gzip compression
  - Static file caching

#### 2.2 Update Production Docker Compose
- **File**: `docker-compose.prod.yml`
- **Changes**:
  - Add nginx service with SSL support
  - Expose internal ports only (no external port mapping)
  - Add SSL certificate volumes

#### 2.3 Update Production Environment Variables
- **Frontend**: `REACT_APP_API_URL=https://divemap.gr/api`
- **Backend**: `CORS_ORIGINS=https://divemap.gr`, `ALLOWED_ORIGINS=https://divemap.gr`

#### 2.4 SSL Certificate Setup
- Obtain SSL certificates for `divemap.gr`
- Configure nginx to use SSL certificates
- Set up automatic HTTP to HTTPS redirect

### Phase 3: Frontend Configuration Updates

#### 3.1 Update API Configuration
- **File**: `frontend/src/api.js`
- **Changes**:
  - Dynamic API base URL based on environment
  - Development: `http://localhost/api`
  - Production: `https://divemap.gr/api`

#### 3.2 Update Authentication Context
- **File**: `frontend/src/contexts/AuthContext.js`
- **Changes**:
  - Ensure all API calls use the new base URLs
  - Update any hardcoded backend URLs

### Phase 4: Backend Configuration Updates

#### 4.1 Update CORS Configuration
- **File**: `backend/app/main.py`
- **Changes**:
  - Environment-based CORS origins
  - Development: `http://localhost`
  - Production: `https://divemap.gr`

#### 4.2 Update Cookie Settings
- **File**: `backend/app/routers/auth.py`
- **Changes**:
  - Remove domain parameter (let nginx handle it)
  - Ensure `SameSite=lax` for cross-origin compatibility
  - Set `secure=true` in production

## Detailed Configuration Files

### Development Nginx Configuration
```nginx
# nginx/dev.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server divemap_frontend:3001;
    }
    
    upstream backend {
        server divemap_backend:8001;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API routes
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend documentation
        location /docs {
            proxy_pass http://backend;
            proxy_set_header Host $host;
        }
        
        location /openapi.json {
            proxy_pass http://backend;
            proxy_set_header Host $host;
        }
    }
}
```

### Production Nginx Configuration
```nginx
# nginx/prod.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server divemap_frontend:3000;
    }
    
    upstream backend {
        server divemap_backend:8000;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
    
    server {
        listen 80;
        server_name divemap.gr;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name divemap.gr;
        
        # SSL configuration
        ssl_certificate /etc/nginx/ssl/divemap.gr.crt;
        ssl_certificate_key /etc/nginx/ssl/divemap.gr.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
        
        # Frontend with caching
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Caching for static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
        
        # Backend API with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Auth endpoints with stricter rate limiting
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend documentation
        location /docs {
            proxy_pass http://backend;
            proxy_set_header Host $host;
        }
        
        location /openapi.json {
            proxy_pass http://backend;
            proxy_set_header Host $host;
        }
    }
}
```

## Docker Compose Updates

### Development Docker Compose
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/dev.conf:/etc/nginx/nginx.conf
    depends_on:
      - divemap_frontend
      - divemap_backend
    networks:
      - divemap_network

  divemap_frontend:
    # ... existing config
    ports:
      - "3001:3000"  # Changed from 3000:3000
    environment:
      - REACT_APP_API_URL=http://localhost/api
    networks:
      - divemap_network

  divemap_backend:
    # ... existing config
    ports:
      - "8001:8000"  # Changed from 8000:8000
    environment:
      - CORS_ORIGINS=http://localhost
      - ALLOWED_ORIGINS=http://localhost
    networks:
      - divemap_network

  divemap_db:
    # ... existing config (unchanged)
    networks:
      - divemap_network

networks:
  divemap_network:
    driver: bridge
```

### Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - divemap_frontend
      - divemap_backend
    networks:
      - divemap_network

  divemap_frontend:
    # ... existing config
    expose:
      - "3000"  # Only expose to internal network
    environment:
      - REACT_APP_API_URL=https://divemap.gr/api
    networks:
      - divemap_network

  divemap_backend:
    # ... existing config
    expose:
      - "8000"  # Only expose to internal network
    environment:
      - CORS_ORIGINS=https://divemap.gr
      - ALLOWED_ORIGINS=https://divemap.gr
    networks:
      - divemap_network

  divemap_db:
    # ... existing config (unchanged)
    networks:
      - divemap_network

networks:
  divemap_network:
    driver: bridge
```

## Environment Variables

### Development Environment
```bash
# Frontend (.env)
REACT_APP_API_URL=http://localhost/api

# Backend (.env)
CORS_ORIGINS=http://localhost
ALLOWED_ORIGINS=http://localhost
ENVIRONMENT=development
```

### Production Environment
```bash
# Frontend (.env)
REACT_APP_API_URL=https://divemap.gr/api

# Backend (.env)
CORS_ORIGINS=https://divemap.gr
ALLOWED_ORIGINS=https://divemap.gr
ENVIRONMENT=production
```

## Benefits

### Development Benefits
1. **Solves Cookie Issues**: No more cross-origin cookie problems
2. **Unified Access**: Single entry point (`localhost:80`) for all services
3. **Consistent Architecture**: Mirrors production setup
4. **Easy Testing**: All services accessible from same origin

### Production Benefits
1. **Enhanced Security**: Unified security headers and rate limiting
2. **Better Performance**: Gzip compression, caching, HTTP/2
3. **Simplified CORS**: Only one origin to manage
4. **Professional Setup**: Industry-standard reverse proxy architecture
5. **Scalability**: Easy to add more services behind nginx

## Implementation Checklist

### Phase 1: Development Setup
- [ ] Create `nginx/dev.conf` configuration
- [ ] Update `docker-compose.dev.yml`
- [ ] Update frontend environment variables
- [ ] Update backend CORS configuration
- [ ] Test nginx proxy functionality
- [ ] Verify refresh token cookies work

### Phase 2: Production Setup
- [ ] Create `nginx/prod.conf` configuration
- [ ] Update `docker-compose.prod.yml`
- [ ] Obtain SSL certificates
- [ ] Update production environment variables
- [ ] Test production deployment
- [ ] Verify HTTPS and security headers

### Phase 3: Testing & Validation
- [ ] Test development environment
- [ ] Test production environment
- [ ] Verify refresh token functionality
- [ ] Test rate limiting
- [ ] Validate security headers
- [ ] Performance testing

## Risks & Mitigation

### Risks
1. **Additional Complexity**: Adding nginx container
2. **Port Conflicts**: Port 80 might be in use
3. **SSL Certificate Management**: Need to handle certificate renewal

### Mitigation
1. **Documentation**: Comprehensive setup and troubleshooting guides
2. **Port Planning**: Check for port conflicts before implementation
3. **Automation**: Use Let's Encrypt for automatic certificate renewal

## Timeline Estimate

- **Phase 1 (Development)**: 2-3 days
- **Phase 2 (Production)**: 3-4 days
- **Phase 3 (Testing)**: 1-2 days
- **Total**: 6-9 days

## Success Criteria

1. **Development**: Refresh token cookies work perfectly at `localhost:80`
2. **Production**: All services accessible via `https://divemap.gr`
3. **Security**: Proper rate limiting and security headers implemented
4. **Performance**: Gzip compression and caching working
5. **Monitoring**: Access logs and error logs properly configured

## Next Steps

1. **Review and approve** this implementation plan
2. **Check port availability** on development machine
3. **Obtain SSL certificates** for production domain
4. **Begin Phase 1** implementation
5. **Test thoroughly** before moving to production

---

*This plan provides a comprehensive solution to the current cookie issues while establishing a professional, scalable architecture for both development and production environments.*
