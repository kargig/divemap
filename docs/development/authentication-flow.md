# Authentication Flow: Client-Server Interaction

## Overview

The application uses a **dual-token authentication system**:
- **Access Token** (JWT): Short-lived (15 minutes), stored in localStorage
- **Refresh Token**: Long-lived (30 days), stored as HTTP-only cookie

## Client Storage

### localStorage (JavaScript Accessible)

| Key | Value | Purpose | Expiration |
|-----|-------|---------|------------|
| `access_token` | JWT token string | Sent in `Authorization: Bearer <token>` header | 15 minutes (default) |
| `tokenExpiry` | Timestamp (milliseconds) | Calculated expiry time for reference | Same as access_token |

**Security Note**: localStorage is accessible to JavaScript, so access tokens can be read by any script on the page. This is acceptable for short-lived tokens.

### HTTP-Only Cookie (Not JavaScript Accessible)

| Cookie Name | Value | Purpose | Expiration |
|-------------|-------|---------|------------|
| `refresh_token` | `username:token_id:timestamp` | Used to get new access tokens | 30 days (default) |

**Security Features**:
- `httponly=True`: JavaScript cannot access this cookie (XSS protection)
- `secure`: Only sent over HTTPS (if configured)
- `samesite=strict`: CSRF protection

**Security Note**: Refresh tokens are stored in cookies that JavaScript cannot access, providing better security for long-lived tokens.

## Authentication Flows

### 1. Login Flow

```
┌─────────┐                    ┌──────────┐
│ Client  │                    │ Backend  │
└────┬────┘                    └────┬─────┘
     │                               │
     │ 1. POST /auth/login           │
     │    {username, password}       │
     ├──────────────────────────────>│
     │                               │
     │                               │ 2. Validate credentials
     │                               │    Create token pair
     │                               │    - access_token (JWT, 15min)
     │                               │    - refresh_token (30 days)
     │                               │
     │                               │ 3. Set refresh_token cookie
     │                               │    (HTTP-only, secure)
     │                               │
     │ 4. Response:                  │
     │    {                          │
     │      access_token: "jwt...",  │
     │      expires_in: 900          │
     │    }                          │
     │<──────────────────────────────┤
     │                               │
     │ 5. Store access_token in      │
     │    localStorage               │
     │                               │
```

**Client Code** (`AuthContext.js`):
```javascript
const response = await api.post('/api/v1/auth/login', {username, password});
const { access_token, expires_in } = response.data;

// Store in localStorage
localStorage.setItem('access_token', access_token);
localStorage.setItem('tokenExpiry', (Date.now() + expires_in * 1000).toString());
```

**Backend Code** (`auth.py`):
```python
# Create token pair
token_data = token_service.create_token_pair(user, request, db)

# Set refresh_token as HTTP-only cookie
response.set_cookie(
    "refresh_token",
    token_data["refresh_token"],
    max_age=30 days,
    httponly=True,
    secure=False,  # Set to True in production with HTTPS
    samesite="strict"
)

# Return access_token in response body
return {"access_token": token_data["access_token"], "expires_in": 900}
```

### 2. Making Authenticated Requests

```
┌─────────┐                    ┌──────────┐
│ Client  │                    │ Backend  │
└────┬────┘                    └────┬─────┘
     │                               │
     │ 1. GET /api/v1/dives          │
     │    Authorization: Bearer <access_token>
     ├──────────────────────────────>│
     │                               │
     │                               │ 2. Verify JWT token
     │                               │    - Check signature (SECRET_KEY)
     │                               │    - Check expiration
     │                               │    - Extract username
     │                               │
     │ 3. Response: 200 OK            │
     │    {dives: [...]}             │
     │<──────────────────────────────┤
```

**Client Code** (`api.js`):
```javascript
// Request interceptor automatically adds token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 3. Token Refresh Flow (Automatic)

When access token expires (401 error):

```
┌─────────┐                    ┌──────────┐
│ Client  │                    │ Backend  │
└────┬────┘                    └────┬─────┘
     │                               │
     │ 1. GET /api/v1/dives          │
     │    Authorization: Bearer <expired_token>
     ├──────────────────────────────>│
     │                               │
     │                               │ 2. Verify token → EXPIRED
     │                               │
     │ 3. Response: 401 Unauthorized │
     │<──────────────────────────────┤
     │                               │
     │ 4. API Interceptor catches 401│
     │    POST /api/v1/auth/refresh  │
     │    Cookie: refresh_token=...  │
     │    (withCredentials: true)    │
     ├──────────────────────────────>│
     │                               │
     │                               │ 5. Validate refresh_token
     │                               │    - Check database
     │                               │    - Check expiration
     │                               │    - Check not revoked
     │                               │
     │                               │ 6. Create new token pair
     │                               │    - New access_token (15min)
     │                               │    - New refresh_token (30 days)
     │                               │
     │                               │ 7. Revoke old refresh_token
     │                               │    Set new refresh_token cookie
     │                               │
     │ 8. Response:                  │
     │    {                          │
     │      access_token: "new...", │
     │      expires_in: 900          │
     │    }                          │
     │<──────────────────────────────┤
     │                               │
     │ 9. Update localStorage        │
     │    localStorage.setItem(      │
     │      'access_token',          │
     │      new_access_token          │
     │    )                          │
     │                               │
     │ 10. Retry original request    │
     │     GET /api/v1/dives         │
     │     Authorization: Bearer <new_token>
     ├──────────────────────────────>│
     │                               │
     │                               │ 11. Verify new token → OK
     │                               │
     │ 12. Response: 200 OK          │
     │     {dives: [...]}            │
     │<──────────────────────────────┤
```

**Client Code** (`api.js`):
```javascript
// Response interceptor handles 401 errors
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Refresh token using cookie
      const response = await api.post('/api/v1/auth/refresh', {}, {
        withCredentials: true  // Include cookies
      });
      
      const { access_token } = response.data;
      
      // Update localStorage
      localStorage.setItem('access_token', access_token);
      
      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return api(originalRequest);
    }
  }
);
```

**Backend Code** (`auth.py`):
```python
@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: Session):
    # Get refresh_token from HTTP-only cookie
    refresh_token = request.cookies.get("refresh_token")
    
    # Validate and rotate token
    token_data = token_service.rotate_refresh_token(refresh_token, request, db)
    
    # Set new refresh_token cookie
    response.set_cookie("refresh_token", token_data["refresh_token"], ...)
    
    # Return new access_token
    return {"access_token": token_data["access_token"], "expires_in": 900}
```

### 4. Logout Flow

```
┌─────────┐                    ┌──────────┐
│ Client  │                    │ Backend  │
└────┬────┘                    └────┬─────┘
     │                              │
     │ 1. POST /api/v1/auth/logout  │
     │    Cookie: refresh_token=... │
     ├─────────────────────────────>│
     │                              │
     │                              │ 2. Revoke refresh_token
     │                              │    (mark as revoked in DB)
     │                              │
     │                              │ 3. Delete refresh_token cookie
     │                              │
     │ 4. Response: 200 OK          │
     │<─────────────────────────────┤
     │                              │
     │ 5. Clear localStorage        │
     │    - access_token            │
     │    - tokenExpiry             │
     │                              │
```

**Client Code** (`AuthContext.js`):
```javascript
const logout = () => {
  // Revoke refresh token on backend
  api.post('/api/v1/auth/logout').catch(console.error);
  
  // Clear localStorage
  localStorage.removeItem('access_token');
  localStorage.removeItem('tokenExpiry');
  setToken(null);
  setUser(null);
};
```

## Token Lifecycle

### Access Token (JWT)
- **Created**: On login, registration, or token refresh
- **Stored**: localStorage (client-side)
- **Used**: In `Authorization: Bearer <token>` header for all API requests
- **Expires**: 15 minutes (default, configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Refresh**: Automatically via refresh token when expired (401 error)

### Refresh Token
- **Created**: On login, registration, or token refresh (rotation)
- **Stored**: HTTP-only cookie (server-set, not accessible to JavaScript)
- **Used**: Automatically sent in cookie header when calling `/auth/refresh`
- **Expires**: 30 days (default, configurable via `REFRESH_TOKEN_EXPIRE_DAYS`)
- **Rotation**: New refresh token issued on each refresh (old one revoked)
- **Revocation**: Marked as `is_revoked=True` in database on logout or rotation

## Handling Backend Downtime and Gateway Timeouts (504)

### What Happens When Backend Is Down
- Cloudflare returns `504 Gateway Timeout` when backend is cold/stopped
- Access token may still be valid, but `/api/v1/auth/me` cannot be fetched
- User should not be logged out solely because the backend is temporarily unavailable

### Frontend Behavior (Recent Changes)
- **Automatic retries** for 504/5xx with exponential backoff (1s, 2s, 4s; max 3 tries) in `api.js`
- **Session preservation** in `AuthContext.js`: do not log out on 504/5xx; only log out on 401
- **Loading state preserved**: when a token exists but `/me` fails with 504, `loading` stays `true` to avoid showing a false "logged out" state
- **Automatic recovery**: when any API call succeeds, `backendOnline` event triggers a retry of `/me`; a periodic retry (every 10s) also runs when token exists but user data is missing
- **Keepalive**: `SessionManager` pings `/health` every 4 minutes when logged in to reduce Fly.io cold starts

### UX and Security Considerations
- If backend is down longer than access token lifetime (15 minutes), the token expires; first request after recovery returns 401 and logs out (correct behavior)
- No unauthorized access: all requests still require valid tokens and backend validation
- Users may see a loading state during downtime; once backend recovers, session auto-recovers if token is still valid, otherwise user is logged out on 401

## Security Features

### 1. HTTP-Only Cookies for Refresh Tokens
- **Protection**: Prevents XSS attacks from stealing refresh tokens
- **Implementation**: `httponly=True` in cookie settings
- **Result**: JavaScript cannot access refresh token, only server can read it

### 2. Token Rotation
- **Protection**: Limits damage if refresh token is compromised
- **Implementation**: New refresh token issued on each refresh, old one revoked
- **Result**: Stolen refresh tokens become invalid after first use

### 3. Short-Lived Access Tokens
- **Protection**: Limits exposure if access token is stolen
- **Implementation**: 15-minute expiration
- **Result**: Stolen tokens become invalid quickly

### 4. Automatic Token Refresh
- **User Experience**: Seamless token renewal without user interaction
- **Implementation**: API interceptor automatically refreshes on 401 errors
- **Result**: Users stay logged in for 30 days (refresh token lifetime)

## Why Tokens Fail After Backend Restart

### The Problem

If `SECRET_KEY` is not set or changes:

1. **JWT tokens are signed** with `SECRET_KEY`
2. **Token verification** requires the same `SECRET_KEY`
3. **If SECRET_KEY changes**, all existing tokens become invalid

### What Happens

```
Before Restart:
- SECRET_KEY = "default-key-1"
- User logs in → token signed with "default-key-1"
- Token stored: JWT signed with "default-key-1"

After Restart:
- SECRET_KEY = "default-key-2" (or missing, uses different default)
- User makes request → backend tries to verify with "default-key-2"
- Verification fails → 401 Unauthorized
- Frontend tries to refresh → refresh token also invalid
- User logged out
```

### Solution

Set `SECRET_KEY` in environment variables (`.env` or Fly.io secrets) to ensure consistency across restarts.

## Request Flow Diagram

```
User Action
    │
    ├─> API Request
    │   │
    │   ├─> Request Interceptor
    │   │   └─> Add: Authorization: Bearer <access_token>
    │   │
    │   ├─> Backend
    │   │   ├─> Verify JWT token
    │   │   │   ├─> Valid → Process request → 200 OK
    │   │   │   └─> Invalid/Expired → 401 Unauthorized
    │   │
    │   └─> Response Interceptor
    │       ├─> 200 OK → Return response
    │       └─> 401 Unauthorized
    │           ├─> Call /auth/refresh (with cookie)
    │           ├─> Get new access_token
    │           ├─> Update localStorage
    │           └─> Retry original request
    │
    └─> Success or Redirect to Login
```

## Key Points

1. **Access tokens** are in localStorage (JavaScript accessible, short-lived)
2. **Refresh tokens** are in HTTP-only cookies (JavaScript cannot access, long-lived)
3. **Automatic refresh** happens transparently via API interceptor
4. **Token rotation** provides additional security
5. **SECRET_KEY consistency** is critical for tokens to work across restarts
6. **504 handling**: retries + session preservation + auto-recovery to avoid false logouts during temporary backend downtime
