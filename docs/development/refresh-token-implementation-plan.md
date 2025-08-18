# Refresh Token Implementation Plan

## Overview

This document outlines a comprehensive plan to implement refresh tokens, background token renewal, and silent renewal in the Divemap application. This will eliminate the need for users to re-authenticate every 30 minutes and provide a seamless user experience.

## Current State Analysis

### Existing Authentication System
- **JWT Access Tokens**: 30-minute expiration
- **No Refresh Tokens**: Users must re-login after expiration
- **Frontend Storage**: localStorage for access tokens
- **Backend**: Stateless JWT validation
- **User Experience**: Frequent interruptions due to token expiration

### Problems with Current System
1. Users get logged out every 30 minutes
2. No warning before session expiration
3. Poor user experience for long browsing sessions
4. No automatic token renewal
5. Security risk of storing long-lived tokens

## Proposed Solution Architecture

### 1. Dual Token System
- **Access Token**: Short-lived (15-30 minutes) for API requests
- **Refresh Token**: Long-lived (7-30 days) for token renewal
- **Secure Storage**: HTTP-only cookies for refresh tokens

### 2. Background Token Renewal
- **Automatic Renewal**: Renew access tokens before expiration
- **Silent Renewal**: No user interruption during renewal
- **Fallback Handling**: Graceful degradation on renewal failure

### 3. Enhanced Security
- **Token Rotation**: New refresh token with each renewal
- **Revocation Support**: Ability to invalidate refresh tokens
- **Audit Logging**: Track token usage and renewals

## Implementation Plan

### Phase 1: Backend Infrastructure

#### 1.1 Database Schema Updates
```sql
-- New table for refresh tokens
CREATE TABLE refresh_tokens (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    device_info TEXT,
    ip_address VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_revoked (is_revoked)
);
```

#### 1.2 Environment Configuration
```bash
# Add to .env
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_TOKEN_COOKIE_SECURE=true
REFRESH_TOKEN_COOKIE_HTTPONLY=true
REFRESH_TOKEN_COOKIE_SAMESITE=strict
```

#### 1.3 Backend Models
```python
# backend/app/models.py
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    id = Column(String(255), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.utcnow)
    is_revoked = Column(Boolean, default=False)
    device_info = Column(Text)
    ip_address = Column(String(45))
    
    user = relationship("User", back_populates="refresh_tokens")
```

#### 1.4 Authentication Service Updates
```python
# backend/app/auth.py
class TokenService:
    def __init__(self):
        self.access_token_expire = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")))
        self.refresh_token_expire = timedelta(days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30")))
    
    def create_token_pair(self, user: User, request: Request) -> dict:
        """Create both access and refresh tokens"""
        access_token = self.create_access_token({"sub": user.username})
        refresh_token = self.create_refresh_token(user, request)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(self.access_token_expire.total_seconds())
        }
    
    def create_access_token(self, data: dict) -> str:
        """Create short-lived access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + self.access_token_expire
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    def create_refresh_token(self, user: User, request: Request) -> str:
        """Create long-lived refresh token"""
        token_id = str(uuid.uuid4())
        token_data = f"{user.username}:{token_id}:{datetime.utcnow().timestamp()}"
        
        # Hash the token for storage
        token_hash = hashlib.sha256(token_data.encode()).hexdigest()
        
        # Store in database
        refresh_token = RefreshToken(
            id=token_id,
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + self.refresh_token_expire,
            device_info=request.headers.get("User-Agent", ""),
            ip_address=request.client.host
        )
        
        db.add(refresh_token)
        db.commit()
        
        return token_data
    
    def refresh_access_token(self, refresh_token: str, db: Session) -> Optional[str]:
        """Renew access token using refresh token"""
        try:
            # Parse refresh token
            parts = refresh_token.split(":")
            if len(parts) != 3:
                return None
            
            username, token_id, timestamp = parts
            token_timestamp = float(timestamp)
            
            # Check if token is too old (prevent replay attacks)
            if datetime.utcnow().timestamp() - token_timestamp > 300:  # 5 minutes
                return None
            
            # Find token in database
            db_token = db.query(RefreshToken).filter(
                RefreshToken.id == token_id,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            ).first()
            
            if not db_token:
                return None
            
            # Verify user
            user = db.query(User).filter(User.username == username).first()
            if not user or user.id != db_token.user_id:
                return None
            
            # Update last used timestamp
            db_token.last_used_at = datetime.utcnow()
            db.commit()
            
            # Create new access token
            return self.create_access_token({"sub": username})
            
        except Exception:
            return None
```

#### 1.5 New API Endpoints
```python
# backend/app/routers/auth.py
@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    new_access_token = token_service.refresh_access_token(refresh_token, db)
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": int(token_service.access_token_expire.total_seconds())
    }

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Logout and revoke refresh token"""
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        # Revoke refresh token
        parts = refresh_token.split(":")
        if len(parts) == 3:
            token_id = parts[1]
            db_token = db.query(RefreshToken).filter(RefreshToken.id == token_id).first()
            if db_token:
                db_token.is_revoked = True
                db.commit()
    
    # Clear refresh token cookie
    response.delete_cookie("refresh_token", httponly=True, secure=True, samesite="strict")
    
    return {"message": "Logged out successfully"}

@router.get("/tokens")
async def list_active_tokens(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List user's active refresh tokens"""
    tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).all()
    
    return [
        {
            "id": token.id,
            "created_at": token.created_at,
            "last_used_at": token.last_used_at,
            "expires_at": token.expires_at,
            "device_info": token.device_info,
            "ip_address": token.ip_address
        }
        for token in tokens
    ]

@router.delete("/tokens/{token_id}")
async def revoke_token(
    token_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific refresh token"""
    token = db.query(RefreshToken).filter(
        RefreshToken.id == token_id,
        RefreshToken.user_id == current_user.id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    token.is_revoked = True
    db.commit()
    
    return {"message": "Token revoked successfully"}
```

### Phase 2: Frontend Implementation

#### 2.1 Enhanced AuthContext
```javascript
// frontend/src/contexts/AuthContext.js
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [refreshTimer, setRefreshTimer] = useState(null);

  // Token renewal logic
  const scheduleTokenRenewal = useCallback((expiresIn) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    
    // Renew token 2 minutes before expiration
    const renewalTime = (expiresIn - 120) * 1000;
    const timer = setTimeout(() => {
      renewToken();
    }, renewalTime);
    
    setRefreshTimer(timer);
  }, [refreshTimer]);

  const renewToken = async () => {
    try {
      const response = await api.post('/api/v1/auth/refresh');
      const { access_token, expires_in } = response.data;
      
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
      // Schedule next renewal
      scheduleTokenRenewal(expires_in);
      
      console.log('Token renewed successfully');
    } catch (error) {
      console.error('Token renewal failed:', error);
      // Fallback to logout
      logout();
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/v1/auth/login', {
        username,
        password,
      });

      const { access_token, expires_in } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
      // Schedule token renewal
      scheduleTokenRenewal(expires_in);

      await fetchUser();
      toast.success('Login successful!');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Login failed';
      toast.error(message);
      return false;
    }
  };

  const logout = () => {
    // Clear timers
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      setRefreshTimer(null);
    }
    
    // Revoke refresh token on backend
    api.post('/api/v1/auth/logout').catch(console.error);
    
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
    setTokenExpiry(null);
    
    googleAuth.signOut();
    toast.success('Logged out successfully');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [refreshTimer]);
};
```

#### 2.2 API Interceptor for Token Renewal
```javascript
// frontend/src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 10000,
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token renewal
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to renew token
        const response = await api.post('/api/v1/auth/refresh');
        const { access_token } = response.data;
        
        localStorage.setItem('access_token', access_token);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

#### 2.3 Session Management Component
```javascript
// frontend/src/components/SessionManager.js
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const SessionManager = () => {
  const { user, token } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!user || !token) return;

    const checkSessionStatus = () => {
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = tokenData.exp * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // Show warning 5 minutes before expiry
        if (timeUntilExpiry <= 300000 && timeUntilExpiry > 0) {
          setShowWarning(true);
          setTimeLeft(Math.ceil(timeUntilExpiry / 1000));
        } else {
          setShowWarning(false);
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    };

    const interval = setInterval(checkSessionStatus, 1000);
    checkSessionStatus();

    return () => clearInterval(interval);
  }, [user, token]);

  if (!showWarning) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded shadow-lg z-50">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">
            Your session will expire in {timeLeft} seconds
          </p>
          <p className="text-sm mt-1">
            Please save your work. Your session will be automatically renewed if you're active.
          </p>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={() => setShowWarning(false)}
            className="text-yellow-400 hover:text-yellow-600"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Phase 3: Security Enhancements

#### 3.1 Token Rotation
```python
# backend/app/auth.py
def rotate_refresh_token(self, old_refresh_token: str, db: Session) -> Optional[dict]:
    """Rotate refresh token for security"""
    try:
        # Validate old token
        new_access_token = self.refresh_access_token(old_refresh_token, db)
        if not new_access_token:
            return None
        
        # Revoke old refresh token
        parts = old_refresh_token.split(":")
        if len(parts) == 3:
            token_id = parts[1]
            db_token = db.query(RefreshToken).filter(RefreshToken.id == token_id).first()
            if db_token:
                db_token.is_revoked = True
                db.commit()
        
        # Create new refresh token
        user = db.query(User).filter(User.username == parts[0]).first()
        new_refresh_token = self.create_refresh_token(user, request)
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": int(self.access_token_expire.total_seconds())
        }
    except Exception:
        return None
```

#### 3.2 Rate Limiting for Token Endpoints
```python
# backend/app/routers/auth.py
@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")  # Prevent abuse
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    # ... existing code
```

#### 3.3 Audit Logging
```python
# backend/app/models.py
class AuthAuditLog(Base):
    __tablename__ = "auth_audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # login, logout, token_refresh, etc.
    ip_address = Column(String(45))
    user_agent = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    success = Column(Boolean, default=True)
    details = Column(Text)
    
    user = relationship("User")
```

### Phase 4: Testing and Validation

#### 4.1 Unit Tests
```python
# backend/tests/test_refresh_tokens.py
def test_token_creation():
    """Test access and refresh token creation"""
    pass

def test_token_refresh():
    """Test token renewal process"""
    pass

def test_token_rotation():
    """Test refresh token rotation"""
    pass

def test_token_revocation():
    """Test token revocation"""
    pass

def test_expired_token_handling():
    """Test expired token scenarios"""
    pass
```

#### 4.2 Integration Tests
```python
# backend/tests/test_auth_integration.py
def test_complete_auth_flow():
    """Test complete authentication flow with refresh"""
    pass

def test_background_token_renewal():
    """Test automatic token renewal"""
    pass

def test_multiple_device_sessions():
    """Test multiple device sessions"""
    pass
```

#### 4.3 Frontend Tests
```javascript
// frontend/tests/test_auth_context.js
describe('AuthContext with Refresh Tokens', () => {
  test('should automatically renew tokens', () => {
    // Test implementation
  });
  
  test('should handle renewal failures gracefully', () => {
    // Test implementation
  });
  
  test('should show session warnings', () => {
    // Test implementation
  });
});
```

### Phase 5: Deployment and Monitoring

#### 5.1 Database Migration
```python
# backend/migrations/versions/0029_add_refresh_tokens_system.py
"""Add refresh tokens system

Revision ID: 0029_add_refresh_tokens_system
Revises: 0028_add_geographic_fields_to_diving_centers
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Create refresh_tokens table
    op.create_table('refresh_tokens',
        sa.Column('id', sa.String(255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), nullable=True),
        sa.Column('device_info', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('idx_refresh_tokens_expires_at', 'refresh_tokens', ['expires_at'])
    op.create_index('idx_refresh_tokens_revoked', 'refresh_tokens', ['is_revoked'])
    
    # Create auth_audit_logs table
    op.create_table('auth_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('auth_audit_logs')
    op.drop_table('refresh_tokens')
```

#### 5.2 Environment Configuration Updates
```bash
# Update .env.example
# JWT Configuration
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_TOKEN_COOKIE_SECURE=true
REFRESH_TOKEN_COOKIE_HTTPONLY=true
REFRESH_TOKEN_COOKIE_SAMESITE=strict

# Security Configuration
ENABLE_TOKEN_ROTATION=true
ENABLE_AUDIT_LOGGING=true
MAX_ACTIVE_SESSIONS_PER_USER=5
```

#### 5.3 Monitoring and Alerting
```python
# backend/app/monitoring.py
class TokenMonitoring:
    def __init__(self):
        self.metrics = {}
    
    def track_token_usage(self, user_id: int, action: str, success: bool):
        """Track token usage metrics"""
        pass
    
    def alert_suspicious_activity(self, user_id: int, pattern: str):
        """Alert on suspicious authentication patterns"""
        pass
    
    def generate_token_report(self) -> dict:
        """Generate token usage report"""
        pass
```

## Implementation Timeline

### ✅ Week 1-2: Backend Infrastructure - **COMPLETED**
- ✅ Database schema updates
- ✅ Token service implementation
- ✅ New API endpoints
- ✅ Environment configuration

### ✅ Week 3-4: Frontend Implementation - **COMPLETED**
- ✅ Enhanced AuthContext
- ✅ API interceptors
- ✅ Session management components
- ✅ Component integration

### ✅ Week 5: Security and Testing - **COMPLETED**
- ✅ Security enhancements
- ✅ Database migration testing
- ✅ Model validation
- ✅ Token service validation

### 🔄 Week 6: Deployment - **IN PROGRESS**
- 🔄 Database migrations (ready for production)
- 🔄 Environment configuration (ready for production)
- 🔄 Monitoring setup (ready for production)
- 🔄 Production deployment (pending)

## Success Metrics

### User Experience
- **Session Interruptions**: Reduce from every 30 minutes to once per 30 days
- **User Satisfaction**: Measure via user feedback and surveys
- **Session Duration**: Track average session length

### Security
- **Token Compromise Detection**: Monitor for suspicious patterns
- **Session Hijacking Prevention**: Track failed authentication attempts
- **Token Rotation Effectiveness**: Measure successful rotations

### Performance
- **API Response Time**: Ensure token renewal doesn't impact performance
- **Background Process Efficiency**: Monitor token renewal success rate
- **Memory Usage**: Track memory impact of background processes

## Risk Mitigation

### Security Risks
1. **Refresh Token Theft**: Mitigated by HTTP-only cookies and secure flags
2. **Token Replay Attacks**: Mitigated by timestamp validation and rotation
3. **Session Hijacking**: Mitigated by IP tracking and device fingerprinting

### Performance Risks
1. **Token Renewal Failures**: Mitigated by fallback mechanisms and retry logic
2. **Memory Leaks**: Mitigated by proper cleanup and timer management
3. **API Latency**: Mitigated by background renewal and caching

### User Experience Risks
1. **Silent Failures**: Mitigated by user notifications and fallback actions
2. **Unexpected Logouts**: Mitigated by comprehensive error handling
3. **Session Loss**: Mitigated by automatic renewal and user warnings

## Conclusion

This comprehensive plan provides a robust foundation for implementing refresh tokens, background token renewal, and silent renewal in the Divemap application. The phased approach ensures smooth implementation while maintaining security and performance standards.

The solution addresses the current user experience issues while introducing enterprise-grade security features. The implementation includes comprehensive testing, monitoring, and fallback mechanisms to ensure reliability in production environments.

## Next Steps

1. **Review and Approve**: Get stakeholder approval for the implementation plan
2. **Resource Allocation**: Assign development resources and timeline
3. **Development Start**: Begin with Phase 1 (Backend Infrastructure)
4. **Regular Reviews**: Conduct weekly progress reviews and adjustments
5. **User Testing**: Involve users in testing the new authentication flow
6. **Production Rollout**: Gradual rollout with monitoring and feedback collection
