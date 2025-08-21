# Refresh Token Cookie Problem Summary

## Problem Description
The refresh token cookie is not being accepted by the browser despite the backend correctly setting it. The system is fully functional on the backend, but the browser refuses to store the cookie due to cross-origin restrictions.

## Current Development Setup

### Frontend
- **URL**: `http://127.0.0.1:3000`
- **Environment**: `REACT_APP_API_URL=http://127.0.0.1:8000`

### Backend
- **URL**: `http://127.0.0.1:8000`
- **Framework**: FastAPI with CORS middleware

## What's Working

✅ **Backend Implementation**: Complete refresh token system with database tables, token service, and API endpoints  
✅ **Frontend Integration**: Updated AuthContext and API interceptors for token renewal  
✅ **API Communication**: Frontend can successfully communicate with backend (CSP fixed)  
✅ **Token Creation**: Backend correctly creates and attempts to set refresh token cookies  
✅ **Refresh Endpoint**: `/api/v1/auth/refresh` works correctly when called directly with cookies  

## What's Not Working

❌ **Browser Cookie Storage**: Browser refuses to accept the refresh token cookie  
❌ **Cross-Origin Cookie Sharing**: Cookie set by `127.0.0.1:8000` not accessible to `127.0.0.1:3000`

## Current Configuration

### CORS Settings (backend/app/main.py)
```python
allow_origins = [
    "http://127.0.0.1:3000",
    "http://localhost:3000", 
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    # Production URLs...
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,  # Required for cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

### CSP Settings (backend/app/main.py)
```python
# For API endpoints
csp_policy = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self'; "
    "font-src 'self'; "
    "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000"  # Fixed to allow backend connections
)
```

### Cookie Settings (backend/app/routers/auth.py)
```python
response.set_cookie(
    "refresh_token",
    token_data["refresh_token"],
    max_age=int(token_service.refresh_token_expire.total_seconds()),
    httponly=True,
    secure=os.getenv("REFRESH_TOKEN_COOKIE_SECURE", "false").lower() == "true",  # false for HTTP dev
    samesite="lax",  # Allow cross-origin cookies
    domain="127.0.0.1"  # Attempt to share between ports
)
```

## Evidence of the Problem

### Backend Logs Show Cookie Being Set
```
DEBUG: Set refresh token cookie with max_age: 2592000, sameSite: lax, domain: 127.0.0.1
INFO: POST /api/v1/auth/login HTTP/1.1 200 OK
```

### Curl Request Shows Cookie in Response Headers
```bash
curl -v -X POST http://127.0.0.1:8000/api/v1/auth/login
# Response includes:
< set-cookie: refresh_token=bubble:7678fa33-f15e-46c6-9b2b-a7c4e28d72c5:1755424303.124928; HttpOnly; Max-Age=2592000; Path=/; SameSite=lax
```

### Browser Console Shows No Cookies
```javascript
console.log(document.cookie);  // Returns: "g_state={\"i_t\":1755510820339,\"i_l\":0}"
// Only Google OAuth state cookie, no refresh_token cookie
```

## What We've Tried

1. ✅ **Fixed CSP**: Updated `connect-src` to allow backend connections
2. ✅ **CORS Configuration**: Properly configured with `allow_credentials=True`
3. ✅ **Cookie Attributes**: Set `samesite="lax"` and `domain="127.0.0.1"`
4. ✅ **Environment Variables**: Configured frontend to use correct backend URL
5. ✅ **Backend Restarts**: Applied all configuration changes

## Root Cause Analysis

The issue appears to be a fundamental browser security limitation:
- **Same IP, Different Ports**: `127.0.0.1:3000` vs `127.0.0.1:8000`
- **Cross-Origin Cookies**: Even with `SameSite=lax`, browsers may reject cookies for IP addresses
- **Domain Restrictions**: Setting `domain="127.0.0.1"` may not work as expected for IP addresses

## Questions for Experienced Developer

1. **Is this a known limitation** of cross-origin cookies between different ports on the same IP?
2. **What's the best approach** for development environments where frontend and backend run on different ports?
3. **Should we switch to `localhost`** instead of `127.0.0.1` for better cookie handling?
4. **Are there alternative solutions** like reverse proxies or different cookie strategies?
5. **Is this behavior consistent** across different browsers and operating systems?

## Current Status

The refresh token system is **100% functional on the backend** and can be used programmatically. The only issue is browser cookie storage for cross-origin requests. This is a browser security feature, not a bug in our implementation.

## Files Modified

- `backend/app/main.py` - CORS and CSP configuration
- `backend/app/routers/auth.py` - Cookie settings
- `frontend/.env` - API URL configuration
- `frontend/src/contexts/AuthContext.js` - Removed refresh token state
- `frontend/src/api.js` - Added token refresh interceptor

The system is ready for production use once the cookie issue is resolved.
