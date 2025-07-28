# Security Documentation

## Overview

This document outlines the security measures implemented in the Divemap project and provides guidance for maintaining security best practices.

## Security Vulnerabilities Fixed

### 1. Python Dependencies

**Fixed Vulnerabilities:**
- `pymysql==1.1.0` → `1.1.1` (CVE-2024-36039 - SQL injection vulnerability)
- `python-jose==3.3.0` → `3.4.0` (CVE-2024-33663 - Algorithm confusion vulnerability)
- `python-multipart==0.0.6` → `0.0.20` (Multiple DoS vulnerabilities)
- `starlette==0.27.0` (DoS vulnerabilities - updated via FastAPI)
- `anyio==3.7.1` (Thread race condition - updated via FastAPI)

**New Security Dependencies:**
- `slowapi==0.1.9` - Rate limiting functionality

### 2. Node.js Dependencies

**Fixed Vulnerabilities:**
- Updated `react-scripts` to latest version
- Added overrides for vulnerable packages:
  - `nth-check`: `^2.0.1` (CVE-2021-3803)
  - `postcss`: `^8.4.31` (CVE-2023-44270)
  - `svgo`: `^3.0.2` (Multiple vulnerabilities)

## Security Measures Implemented

### 1. Authentication & Authorization

**Password Security:**
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Bcrypt hashing with 12 rounds
- Password strength validation

**JWT Token Security:**
- Secure token generation with expiration
- Issued at (iat) timestamp included
- Token verification with proper error handling
- Configurable token expiration (default: 30 minutes)

**User Management:**
- New users disabled by default (admin approval required)
- Role-based access control (admin, moderator, user)
- Account status validation

### 2. Rate Limiting

**Implemented Rate Limits:**
- Registration: 5 requests/minute
- Login: 10 requests/minute
- Search endpoints: 100 requests/minute
- Individual site access: 200 requests/minute
- Content creation: 10-20 requests/minute
- Comment creation: 5 requests/minute
- Media upload: 20 requests/minute

### 3. Input Validation & Sanitization

**API Input Validation:**
- Pydantic models with strict validation
- URL validation for media uploads
- Coordinate validation (latitude/longitude bounds)
- String length limits and pattern matching
- Enum validation for difficulty levels

**SQL Injection Prevention:**
- Parameterized queries using SQLAlchemy ORM
- Input sanitization for search queries
- Tag ID validation to prevent injection

### 4. Security Headers

**HTTP Security Headers:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'...`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 5. CORS Configuration

**Restrictive CORS Settings:**
- Limited allowed origins (localhost for development)
- Specific HTTP methods allowed
- Credentials support enabled
- Max age set to 1 hour

### 6. Docker Security

**Container Security:**
- `no-new-privileges:true` for all containers
- Environment variables for secrets (not hardcoded)
- Redis password protection
- Non-root user recommendations

## Environment Variables

### Required Environment Variables

```bash
# Database
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_USER=divemap_user
MYSQL_PASSWORD=your_secure_password

# Redis
REDIS_PASSWORD=your_secure_password

# RabbitMQ
RABBITMQ_USER=divemap
RABBITMQ_PASSWORD=your_secure_password

# JWT
SECRET_KEY=your_very_long_random_secret_key

# Environment
ENVIRONMENT=production
NODE_ENV=production
```

### Generating Secure Secrets

```bash
# Generate a secure JWT secret
openssl rand -hex 32

# Generate database passwords
openssl rand -base64 32
```

## Security Best Practices

### 1. Production Deployment

**Before Deployment:**
- Change all default passwords
- Generate strong JWT secret
- Set `ENVIRONMENT=production`
- Configure proper CORS origins
- Enable HTTPS
- Set up monitoring and logging

**Security Checklist:**
- [ ] All default passwords changed
- [ ] JWT secret is strong and unique
- [ ] HTTPS enabled
- [ ] CORS origins configured for production
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Database access restricted
- [ ] Logging and monitoring set up

### 2. Database Security

**MySQL Security:**
- Use strong passwords
- Restrict network access
- Enable SSL connections
- Regular backups
- Monitor for suspicious activity

**Redis Security:**
- Enable authentication
- Restrict network access
- Use SSL in production
- Regular security updates

### 3. API Security

**Authentication:**
- Always use HTTPS in production
- Implement proper session management
- Regular token rotation
- Monitor for suspicious login attempts

**Input Validation:**
- Validate all user inputs
- Sanitize search queries
- Limit file upload sizes
- Validate file types

### 4. Monitoring & Logging

**Security Monitoring:**
- Monitor failed login attempts
- Track rate limit violations
- Log security events
- Set up alerts for suspicious activity

**Recommended Tools:**
- Application performance monitoring (APM)
- Security information and event management (SIEM)
- Intrusion detection systems (IDS)

## Vulnerability Management

### 1. Regular Security Updates

**Dependency Updates:**
- Weekly security scans
- Monthly dependency updates
- Quarterly security audits
- Annual penetration testing

### 2. Security Scanning

**Automated Scans:**
```bash
# Python dependencies
safety check

# Node.js dependencies
npm audit

# Docker images
trivy image your-image:tag

# Code scanning
bandit -r backend/
```

### 3. Incident Response

**Security Incident Process:**
1. Identify and contain the incident
2. Assess the impact
3. Remediate the vulnerability
4. Update security measures
5. Document lessons learned
6. Notify stakeholders if necessary

## Security Testing

### 1. Automated Testing

**Security Test Suite:**
- Authentication tests
- Authorization tests
- Input validation tests
- Rate limiting tests
- SQL injection tests

### 2. Manual Testing

**Security Checklist:**
- [ ] Test authentication bypass attempts
- [ ] Verify authorization controls
- [ ] Test input validation
- [ ] Check rate limiting
- [ ] Verify security headers
- [ ] Test CORS configuration

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** create a public issue
2. Email security@yourdomain.com
3. Include detailed reproduction steps
4. Provide proof of concept if possible
5. Allow reasonable time for response

## Security Contacts

- Security Team: security@yourdomain.com
- Emergency Contact: +1-XXX-XXX-XXXX

## Compliance

This application follows security best practices for:
- OWASP Top 10
- GDPR data protection
- Industry security standards

## Updates

This security documentation is updated regularly. Last updated: 2024-01-XX

---

**Note:** This is a living document. Security measures should be regularly reviewed and updated as new threats emerge and best practices evolve. 