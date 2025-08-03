from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request, Depends
from typing import Optional
from functools import wraps
from app.auth import get_current_user_optional
from app.database import get_db

def custom_key_func(request: Request) -> str:
    """
    Custom key function for rate limiting that skips rate limiting for:
    1. Localhost requests (127.0.0.1, ::1, localhost)
    """
    # Get client IP address
    client_ip = get_remote_address(request)
    
    # Skip rate limiting for localhost
    if client_ip in ["127.0.0.1", "::1", "localhost"]:
        return "localhost"  # Special key that won't be rate limited
    
    # For non-localhost requests, use IP address as key
    return client_ip

# Initialize rate limiter with custom key function
limiter = Limiter(key_func=custom_key_func)

def skip_rate_limit_for_admin(limit_string: str):
    """
    Custom decorator that applies rate limiting but skips it for admin users
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get the request object from the function arguments
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if request:
                # Check if it's localhost
                client_ip = get_remote_address(request)
                if client_ip in ["127.0.0.1", "::1", "localhost"]:
                    # Skip rate limiting for localhost
                    return await func(*args, **kwargs)
                
                # Try to get current user and check if admin
                try:
                    # Extract authorization header
                    auth_header = request.headers.get("authorization")
                    token = None
                    if auth_header and auth_header.startswith("Bearer "):
                        token = auth_header[7:]  # Remove "Bearer " prefix
                    
                    if token:
                        # Import here to avoid circular imports
                        from app.auth import verify_token
                        from app.models import User
                        
                        # Verify token and get user
                        token_data = verify_token(token)
                        if token_data:
                            # Get database session
                            db = next(get_db())
                            user = db.query(User).filter(User.username == token_data.username).first()
                            
                            # Skip rate limiting for admin users
                            if user and user.is_admin:
                                return await func(*args, **kwargs)
                except Exception:
                    # If there's any error, continue with normal rate limiting
                    pass
            
            # Apply normal rate limiting using the limiter
            # We need to create a new function that applies the rate limit
            rate_limited_func = limiter.limit(limit_string)(func)
            return await rate_limited_func(*args, **kwargs)
        
        return wrapper
    return decorator 