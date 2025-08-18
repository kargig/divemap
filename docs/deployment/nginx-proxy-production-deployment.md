# Nginx Proxy Production Deployment Guide for Fly.io

## Overview

This guide covers the production deployment of the Divemap nginx proxy on Fly.io. The nginx proxy acts as a unified entry point for both frontend and backend services, providing SSL termination, security headers, rate limiting, and proper client IP handling.

## 🏗️ Architecture

```
Internet (HTTPS)
    │
    ▼
┌─────────────────────────┐
│  divemap-nginx-proxy    │  ← SSL termination, security, rate limiting
│  (divemap.gr:443)       │
└─────────────────────────┘
    │
    ├─── Frontend (divemap-frontend.flycast:8080)
    └─── Backend (divemap-backend.flycast:8000)
```

## 📋 Prerequisites

1. **Fly.io CLI installed and authenticated**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **SSL certificates for divemap.gr**
   - Certificate file: `cert.pem`
   - Private key file: `key.pem`

3. **Existing Fly.io apps running**
   - `divemap-db` (database)
   - `divemap-backend` (API)
   - `divemap-frontend` (React app)

4. **Domain DNS configured**
   - Point `divemap.gr` and `www.divemap.gr` to Fly.io

## 🚀 Deployment Steps

### Step 1: Create the Nginx Proxy App

```bash
cd nginx

# Launch the nginx proxy app (don't deploy yet)
fly launch --no-deploy

# This will create the app and ask for configuration
# App name: divemap-nginx-proxy
# Region: fra (Frankfurt)
# No database needed
```

### Step 2: Configure SSL Certificates

```bash
# Set SSL certificate as secret
fly secrets set SSL_CERT="$(cat /path/to/your/cert.pem)" -a divemap-nginx-proxy

# Set SSL private key as secret
fly secrets set SSL_KEY="$(cat /path/to/your/key.pem)" -a divemap-nginx-proxy
```

**Note**: Replace `/path/to/your/` with the actual path to your SSL certificate files.

### Step 3: Deploy the Nginx Proxy

```bash
# Deploy the nginx proxy
fly deploy -a divemap-nginx-proxy
```

### Step 4: Configure Domain Routing

```bash
# Add your domain to the app
fly domains add divemap.gr -a divemap-nginx-proxy

# Add www subdomain
fly domains add www.divemap.gr -a divemap-nginx-proxy
```

### Step 5: Verify Deployment

```bash
# Check app status
fly status -a divemap-nginx-proxy

# Check logs
fly logs -a divemap-nginx-proxy

# Test health endpoint
curl https://divemap.gr/health
```

## 🔧 Configuration Details

### SSL Certificate Setup

The nginx proxy expects SSL certificates in the following format:

```bash
# Certificate file (cert.pem)
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
...
-----END CERTIFICATE-----

# Private key file (key.pem)
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9QFi67K6/tXDa
...
-----END PRIVATE KEY-----
```

### Environment Variables

The following environment variables can be set:

```bash
# Set via fly secrets set
fly secrets set SSL_CERT="$(cat cert.pem)" -a divemap-nginx-proxy
fly secrets set SSL_KEY="$(cat key.pem)" -a divemap-nginx-proxy

# Or set via fly.toml [env] section
[env]
  NGINX_ENV = 'production'
  SSL_CERT = 'your-cert-content'
  SSL_KEY = 'your-key-content'
```

## 🔒 Security Features

### Rate Limiting

- **API endpoints**: 10 requests per second with 20 burst
- **Login endpoint**: 5 requests per minute with 5 burst
- **Frontend**: No rate limiting (static content)

### Security Headers

- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **X-XSS-Protection**: 1; mode=block (XSS protection)
- **Strict-Transport-Security**: max-age=31536000 (HTTPS enforcement)
- **Content-Security-Policy**: Restrictive CSP for security

### Client IP Handling

- **Fly-Client-IP**: Primary header for client IP
- **X-Forwarded-For**: Chain of proxy IPs
- **X-Real-IP**: Direct client IP
- **X-Forwarded-Proto**: Protocol (http/https)

## 📊 Monitoring and Health Checks

### Health Check Endpoint

```bash
# Health check URL
GET https://divemap.gr/health

# Expected response
HTTP/1.1 200 OK
Content-Type: text/plain

healthy
```

### Logging

```bash
# View nginx logs
fly logs -a divemap-nginx-proxy

# View specific log types
fly logs -a divemap-nginx-proxy | grep "ERROR"
fly logs -a divemap-nginx-proxy | grep "WARN"
```

### Metrics

The nginx proxy provides:
- Access logs with client IP information
- Error logs for debugging
- Health check status
- Rate limiting statistics

## 🔄 Updating the Proxy

### Update Configuration

```bash
# Make changes to prod.conf
# Then redeploy
fly deploy -a divemap-nginx-proxy
```

### Update SSL Certificates

```bash
# Update certificates
fly secrets set SSL_CERT="$(cat new-cert.pem)" -a divemap-nginx-proxy
fly secrets set SSL_KEY="$(cat new-key.pem)" -a divemap-nginx-proxy

# Redeploy to apply new certificates
fly deploy -a divemap-nginx-proxy
```

## 🚨 Troubleshooting

### Common Issues

#### 1. SSL Certificate Errors

```bash
# Check if certificates are set
fly secrets list -a divemap-nginx-proxy

# Verify certificate format
fly ssh console -a divemap-nginx-proxy
ls -la /etc/nginx/ssl/
cat /etc/nginx/ssl/cert.pem | head -1
```

#### 2. Connection Refused

```bash
# Check if backend/frontend are running
fly status -a divemap-backend
fly status -a divemap-frontend

# Verify internal addresses
fly ssh console -a divemap-nginx-proxy
ping divemap-backend.flycast
ping divemap-frontend.flycast
```

#### 3. Rate Limiting Issues

```bash
# Check nginx logs for rate limiting
fly logs -a divemap-nginx-proxy | grep "limiting"

# Adjust rate limits in prod.conf if needed
```

### Debug Commands

```bash
# SSH into the nginx container
fly ssh console -a divemap-nginx-proxy

# Test nginx configuration
nginx -t

# Check nginx process
ps aux | grep nginx

# View nginx error log
tail -f /var/log/nginx/error.log
```

## 📈 Performance Optimization

### Gzip Compression

Enabled for:
- Text files (HTML, CSS, JavaScript)
- JSON responses
- XML documents
- SVG images

### Caching

- **Static assets**: 1 year cache with immutable flag
- **API responses**: No caching (dynamic content)
- **Documentation**: No caching (development tool)

### Connection Pooling

- **Keepalive**: 65 seconds
- **Upstream connections**: 32 keepalive connections
- **Buffer optimization**: 4KB buffers for API responses

## 🔗 Integration with Existing Apps

### Backend Integration

The backend app (`divemap-backend`) should be configured with:

```bash
# CORS origins
fly secrets set ALLOWED_ORIGINS="https://divemap.gr" -a divemap-backend

# Trust proxy headers
# (Already configured in the backend code)
```

### Frontend Integration

The frontend app (`divemap-frontend`) should be configured with:

```bash
# API URL pointing to nginx proxy
fly secrets set REACT_APP_API_URL="https://divemap.gr/api" -a divemap-frontend
```

## 📝 Maintenance

### Regular Tasks

1. **SSL Certificate Renewal**
   - Monitor certificate expiration
   - Update certificates before expiration
   - Test new certificates in staging

2. **Security Updates**
   - Keep nginx base image updated
   - Monitor security advisories
   - Update security headers as needed

3. **Performance Monitoring**
   - Monitor response times
   - Check rate limiting effectiveness
   - Optimize configuration based on usage

### Backup and Recovery

```bash
# Backup nginx configuration
fly ssh console -a divemap-nginx-proxy
cp /etc/nginx/nginx.conf /tmp/nginx.conf.backup

# Restore configuration if needed
cp /tmp/nginx.conf.backup /etc/nginx/nginx.conf
nginx -s reload
```

## ✅ Deployment Checklist

- [ ] Fly.io CLI installed and authenticated
- [ ] SSL certificates obtained and ready
- [ ] Existing apps (db, backend, frontend) running
- [ ] Domain DNS configured
- [ ] Nginx proxy app created
- [ ] SSL certificates set as secrets
- [ ] App deployed successfully
- [ ] Domain routing configured
- [ ] Health checks passing
- [ ] SSL working correctly
- [ ] Frontend accessible via HTTPS
- [ ] Backend API accessible via HTTPS
- [ ] Client IP headers working
- [ ] Rate limiting functional
- [ ] Security headers present
- [ ] Monitoring and logging working

## 🆘 Support

If you encounter issues:

1. **Check logs**: `fly logs -a divemap-nginx-proxy`
2. **Verify configuration**: SSH into container and test nginx config
3. **Check dependencies**: Ensure backend/frontend apps are running
4. **Review SSL certificates**: Verify certificate format and validity
5. **Check DNS**: Ensure domain points to Fly.io

## 📚 Additional Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [SSL/TLS Best Practices](https://ssl-config.mozilla.org/)
- [Security Headers Guide](https://owasp.org/www-project-secure-headers/)
