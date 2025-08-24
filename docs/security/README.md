# Security Overview

This document provides comprehensive security information for the Divemap project, including security measures, audit results, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Security Measures](#security-measures)
3. [Security Audit Results](#security-audit-results)
4. [Vulnerabilities Fixed](#vulnerabilities-fixed)
5. [Current Security Status](#current-security-status)
6. [OAuth Setup](#oauth-setup)
7. [Refresh Token System](#refresh-token-system)
8. [Best Practices](#best-practices)

## Overview

Security is a critical aspect of the Divemap application. This document outlines the security measures implemented, audit results, and guidelines for maintaining security best practices.

### Security Objectives

- **Data Protection**: Secure user data and sensitive information
- **Authentication**: Robust user authentication and authorization
- **Input Validation**: Prevent malicious input and injection attacks
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Secure Headers**: Implement proper HTTP security headers
- **Dependency Management**: Keep dependencies updated and secure

## Security Measures

### 1. Authentication & Authorization

**Password Security:**
- Minimum 8 characters with uppercase, lowercase, number, and special character
- Bcrypt hashing with 12 rounds
- Password strength validation and secure change functionality

**JWT Token Security:**
- Secure token generation with expiration (default: 30 minutes)
- Issued at (iat) timestamp included
- Token verification with proper error handling

**User Management:**
- New users disabled by default (admin approval required)
- Role-based access control (admin, moderator, user)
- Account status validation

**Google OAuth Integration:**
- Backend verification with Google's servers
- Account linking for existing users
- Automatic user creation from verified Google data
- Rate limiting protection

**Refresh Token System:**
- **Automatic token renewal** with 15-minute access tokens and 30-day refresh tokens
- **Token rotation and revocation** for enhanced security
- **Comprehensive audit logging** with AuthAuditLog model for compliance and monitoring
- **Session management** with configurable limits (default: 5 active sessions per user)
- **Security features** including device tracking, IP address logging, and token expiration
- **Cross-origin cookie resolution** through nginx proxy integration
- **Request queuing** to prevent multiple simultaneous refresh attempts

### 2. Rate Limiting

**Implemented Rate Limits:**
- Registration: 8 requests/minute
- Login: 30 requests/minute
- Search endpoints: 150 requests/minute
- Individual site access: 300 requests/minute
- Content creation: 15-30 requests/minute
- Comment creation: 8 requests/minute
- Media upload: 30 requests/minute

**Rate Limiting Exemptions:**
- **Localhost Requests**: All requests from localhost IPs (127.0.0.1, ::1, localhost) are exempt from rate limiting to facilitate development and testing
- **Admin Users**: Users with `is_admin=True` are exempt from rate limiting on authenticated endpoints, allowing administrators to perform bulk operations without being blocked

**Implementation Details:**
- Custom rate limiting decorator `@skip_rate_limit_for_admin()` with intelligent exemption logic
- JWT token extraction and verification for admin user detection
- Database queries to verify admin privileges
- Robust error handling with fallback to normal rate limiting
- Protection against API abuse while maintaining administrative functionality

**Client IP Detection System:**
- Robust client IP detection from various proxy headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
- Intelligent proxy chain analysis to distinguish normal proxy patterns from suspicious activity
- Configurable suspicious proxy chain length threshold via `SUSPICIOUS_PROXY_CHAIN_LENGTH` environment variable
- Production: Set to 6 for Cloudflare + Fly.io + nginx + frontend + backend proxy chain
- Development: Set to 3 for stricter monitoring in local environments
- Enhanced security logging for truly suspicious IP patterns while reducing production log noise
- Support for various CDN configurations (Cloudflare, Fly.io, etc.)
- Localhost and private IP detection for development and internal network support
- Secure IP formatting for logging to prevent information disclosure

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
- Environment-driven allowed origins configuration
- Limited to trusted domains only (no wildcards)
- Specific HTTP methods allowed
- Credentials support enabled
- Max age set to 1 hour

### 6. Environment Configuration

**Security Environment Variables:**
- `SUSPICIOUS_PROXY_CHAIN_LENGTH`: Configurable threshold for proxy chain monitoring
  - Production: Set to 6 (Cloudflare + Fly.io + nginx + frontend + backend)
  - Development: Set to 3 (stricter monitoring for local development)
- `SECRET_KEY`: JWT signing secret (minimum 32 characters)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Short-lived access token duration
- `REFRESH_TOKEN_EXPIRE_DAYS`: Long-lived refresh token duration
- `ENABLE_AUDIT_LOGGING`: Enable comprehensive authentication audit logging
- `MAX_ACTIVE_SESSIONS_PER_USER`: Limit concurrent user sessions

### 7. Container Security

**Docker Security:**
- `no-new-privileges:true` for all containers
- Environment variables for secrets (not hardcoded)
- Redis password protection
- Non-root user recommendations

### 7. Data Protection

**Encryption:**
- HTTPS enforcement for all production traffic
- Encrypted database connections
- Secure storage of sensitive configuration
- Encrypted session data

**Data Validation:**
- Input sanitization for all user inputs
- Strict type checking for all inputs
- Appropriate length limits on all fields
- Proper format validation for emails, URLs, etc.

## Security Audit Results

### ✅ Passed Security Checks

**Authentication & Authorization:**
- ✅ JWT token security implementation
- ✅ Password hashing with bcrypt
- ✅ Role-based access control
- ✅ Google OAuth integration
- ✅ Session management

**Input Validation:**
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Input sanitization
- ✅ Type validation
- ✅ Length limits

**Network Security:**
- ✅ CORS configuration
- ✅ Rate limiting implementation
- ✅ HTTPS enforcement
- ✅ Security headers

**Container Security:**
- ✅ Docker security best practices
- ✅ Environment variable usage
- ✅ Non-root user configuration
- ✅ Resource limits

### ⚠️ Areas for Improvement

**Monitoring & Logging:**
- ⚠️ Enhanced security event logging
- ⚠️ Real-time security monitoring
- ⚠️ Automated security alerts

**Dependency Management:**
- ⚠️ Regular security updates
- ⚠️ Vulnerability scanning
- ⚠️ Dependency monitoring

## Vulnerabilities Fixed

### 1. SQL Injection Prevention

**Issue:** Potential SQL injection in search queries
**Fix:** Implemented parameterized queries and input validation
```python
# Before (vulnerable)
query = f"SELECT * FROM dive_sites WHERE name LIKE '%{search_term}%'"

# After (secure)
query = "SELECT * FROM dive_sites WHERE name LIKE :search_term"
params = {"search_term": f"%{search_term}%"}
```

### 2. XSS Protection

**Issue:** Potential XSS in user-generated content
**Fix:** Implemented content sanitization and CSP headers
```python
# Content sanitization
import html
cleaned_content = html.escape(user_content)
```

### 3. Rate Limiting

**Issue:** Potential DoS attacks
**Fix:** Implemented comprehensive rate limiting
```python
# Rate limiting configuration
RATE_LIMITS = {
    "registration": "5/minute",
    "login": "10/minute",
    "search": "100/minute"
}
```

### 4. CORS Configuration

**Issue:** Overly permissive CORS settings
**Fix:** Implemented restrictive CORS configuration with environment-driven origins
```python
# Environment-driven CORS configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",")]
else:
    # Default development origins
    allow_origins = [
        "http://localhost",
        "http://127.0.0.1"
    ]
```

## Current Security Status

### ✅ Production Security

**Authentication:**
- ✅ JWT-based authentication
- ✅ Google OAuth integration
- ✅ Role-based access control
- ✅ Secure password management

**Data Protection:**
- ✅ HTTPS enforcement
- ✅ Encrypted database connections
- ✅ Secure session management
- ✅ Input validation and sanitization

**Network Security:**
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Security headers
- ✅ Container security

### 🔄 Ongoing Improvements

**Monitoring:**
- 🔄 Enhanced logging implementation
- 🔄 Security event monitoring
- 🔄 Automated alerting

**Dependencies:**
- 🔄 Regular security updates
- 🔄 Vulnerability scanning
- 🔄 Dependency monitoring

## OAuth Setup

### Google OAuth Configuration

**1. Create Google OAuth Credentials:**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select existing
- Enable Google+ API
- Create OAuth 2.0 credentials

**2. Configure OAuth Settings:**
```bash
# Environment variables
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

**3. Frontend Configuration:**
```javascript
// Google Identity Services
google.accounts.id.initialize({
  client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
  callback: handleCredentialResponse
});
```

**4. Backend Verification:**
```python
# Verify Google token
async def verify_google_token(token: str):
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )
        return idinfo
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token")
```

For detailed OAuth setup instructions, see:
- [Google OAuth Credentials Setup Guide](./google-oauth-credentials.md) - Step-by-step instructions for generating credentials
- [OAuth Setup Guide](./oauth-setup.md) - General OAuth configuration

## Refresh Token System

### Overview

The refresh token system provides secure, long-term authentication while maintaining high security standards. It automatically renews access tokens and provides comprehensive audit logging for compliance and security monitoring.

### Architecture

**Token Types:**
- **Access Tokens**: Short-lived (15 minutes) for API requests
- **Refresh Tokens**: Long-lived (30 days) for token renewal
- **Audit Logs**: Comprehensive tracking of all authentication events

**Security Features:**
- **Token Rotation**: New refresh tokens issued on each renewal
- **Session Limits**: Configurable maximum active sessions per user (default: 5)
- **Device Tracking**: Logs device information and IP addresses
- **Automatic Cleanup**: Expired and revoked tokens are automatically removed

### Configuration

**Environment Variables:**
```bash
# Token Configuration
SECRET_KEY=your-secure-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
ENABLE_TOKEN_ROTATION=true
ENABLE_AUDIT_LOGGING=true
MAX_ACTIVE_SESSIONS_PER_USER=5
```

**Database Tables:**
- `refresh_tokens`: Stores active refresh tokens with metadata
- `auth_audit_logs`: Comprehensive audit trail of authentication events

### Testing

**Manual Testing (Recommended for Development):**
```bash
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Set test environment variables
export SECRET_KEY='test-secret-key-for-testing-only'
export ALGORITHM='HS256'
export ACCESS_TOKEN_EXPIRE_MINUTES='15'
export REFRESH_TOKEN_EXPIRE_DAYS='30'
export ENABLE_TOKEN_ROTATION='true'
export ENABLE_AUDIT_LOGGING='true'
export MAX_ACTIVE_SESSIONS_PER_USER='5'

# Test token service
python -c "
from app.token_service import token_service
print('✅ Token service initialized successfully')
print(f'   - Access token expiry: {token_service.access_token_expire}')
print(f'   - Refresh token expiry: {token_service.refresh_token_expire}')
print(f'   - Token rotation: {token_service.enable_token_rotation}')
print(f'   - Audit logging: {token_service.enable_audit_logging}')
print(f'   - Max sessions: {token_service.max_active_sessions}')
"
```

**Automated Testing:**
```bash
# Run all refresh token tests
python -m pytest tests/test_refresh_tokens.py -v

# Run specific test categories
python -m pytest tests/test_refresh_tokens.py::TestTokenService -v
python -m pytest tests/test_refresh_tokens.py::TestAuthEndpoints -v
```

### Security Considerations

**Token Security:**
- Refresh tokens are stored as secure HTTP-only cookies
- SameSite=strict prevents CSRF attacks
- Automatic token rotation on each renewal
- Comprehensive audit logging for security monitoring

**Session Management:**
- Configurable session limits prevent abuse
- Automatic cleanup of expired tokens
- Device and IP tracking for suspicious activity detection
- Revocation capability for compromised sessions

**Production Deployment:**
- Use strong, unique secret keys
- Enable token rotation and audit logging
- Monitor audit logs for suspicious activity
- Regular security reviews and updates

## Best Practices

### 1. Development Security

**Code Review:**
- Review all security-related changes
- Test authentication flows
- Verify input validation
- Check authorization logic

**Testing:**
- Run security tests regularly
- Test authentication flows
- Verify rate limiting
- Check input validation

### 2. Deployment Security

**Environment Variables:**
- Never commit secrets to git
- Use environment variables for configuration
- Rotate secrets regularly
- Use secure secret management

**Container Security:**
- Use non-root users
- Implement resource limits
- Regular security updates
- Vulnerability scanning

### 3. Monitoring Security

**Logging:**
- Log security events
- Monitor authentication attempts
- Track rate limit violations
- Alert on suspicious activity

**Updates:**
- Regular dependency updates
- Security patch management
- Vulnerability monitoring
- Automated security scanning

### 4. User Security

**Password Policies:**
- Strong password requirements
- Regular password changes
- Account lockout policies
- Multi-factor authentication

**Session Management:**
- Secure session handling
- Session timeout
- Secure logout
- Token invalidation

## Security Checklist

### ✅ Implemented
- [x] JWT authentication
- [x] Google OAuth integration
- [x] Password hashing
- [x] Input validation
- [x] SQL injection prevention
- [x] XSS protection
- [x] CORS configuration
- [x] Rate limiting
- [x] Security headers
- [x] HTTPS enforcement
- [x] Container security

### 🔄 In Progress
- [ ] Enhanced logging
- [ ] Security monitoring
- [ ] Automated alerts
- [ ] Dependency scanning

### 📋 Planned
- [ ] Multi-factor authentication
- [ ] Advanced rate limiting
- [ ] Security event correlation
- [ ] Penetration testing

## Support

For security issues or questions:
1. Review this documentation
2. Check security audit results
3. Test authentication flows
4. Verify input validation
5. Contact development team

## Conclusion

The Divemap application implements comprehensive security measures to protect user data and prevent common web application vulnerabilities. Regular security audits and updates ensure ongoing protection against emerging threats.
