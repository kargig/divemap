import time
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request, Depends
from typing import Optional
from functools import wraps
from app.auth import get_current_user_optional, get_current_admin_user, verify_token
from app.database import get_db
from app.models import User
from app.utils import get_client_ip, is_localhost_ip, format_ip_for_logging

# Track logged requests to avoid spam
_logged_requests = set()
_last_cleanup = time.time()

def _cleanup_logged_requests():
    """Clean up old logged requests to prevent memory growth"""
    global _last_cleanup
    current_time = time.time()
    # Clean up every 5 minutes
    if current_time - _last_cleanup > 300:
        _logged_requests.clear()
        _last_cleanup = current_time

def custom_key_func(request: Request) -> str:
    """
    Custom key function for rate limiting that skips rate limiting for:
    1. Localhost requests (127.0.0.1, ::1, localhost)
    """
    # Clean up old logged requests periodically
    _cleanup_logged_requests()
    
    # Get client IP address using our enhanced detection
    client_ip = get_client_ip(request)
    formatted_ip = format_ip_for_logging(client_ip, include_private=True)
    
    # Get endpoint info from request
    endpoint = f"{request.method} {request.url.path}"
    
    # Create a unique key for this request to avoid duplicate logging
    request_key = f"{endpoint}:{formatted_ip}"
    
    # Skip rate limiting for localhost only
    if is_localhost_ip(client_ip):
        if request_key not in _logged_requests:
            print(f"[RATE_LIMIT] {endpoint} - Skipping rate limiting for localhost IP: {formatted_ip}")
            _logged_requests.add(request_key)
        return "localhost"  # Special key that won't be rate limited

    # For all other requests, use IP address as key
    # Only log once per request to avoid spam
    if request_key not in _logged_requests:
        print(f"[RATE_LIMIT] {endpoint} - Applying rate limiting for IP: {formatted_ip}")
        _logged_requests.add(request_key)
    
    return client_ip

# Initialize rate limiter with custom key function
# Note: The app will be set in main.py via app.state.limiter
# slowapi will access it via request.app.state.limiter at runtime
limiter = Limiter(key_func=custom_key_func)

def skip_rate_limit_for_admin(limit_string: str):
    """
    Custom decorator that applies rate limiting but skips it for admin users and localhost requests
    """
    def decorator(func):
        # Create the rate limited function once when the decorator is applied
        # slowapi will access app.state.limiter at runtime via request.app.state.limiter
        rate_limited_func = limiter.limit(limit_string)(func)
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # Get function name and endpoint info
            func_name = func.__name__
            endpoint_info = f"{func_name}"
            
            # Get the request object from the function arguments
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            # Also check kwargs for request
            if not request and 'request' in kwargs:
                request = kwargs['request']
            
            if request:
                client_ip = get_client_ip(request)
                formatted_ip = format_ip_for_logging(client_ip, include_private=True)
                
                # Skip rate limiting for localhost requests
                if is_localhost_ip(client_ip):
                    print(f"[RATE_LIMIT] {endpoint_info} - Skipping rate limiting for localhost IP: {formatted_ip}")
                    return await func(*args, **kwargs)
                
                # Try to get current user by extracting token from headers
                try:
                    # Extract authorization header
                    auth_header = request.headers.get("authorization")
                    
                    if auth_header and auth_header.startswith("Bearer "):
                        token = auth_header[7:]  # Remove "Bearer " prefix
                        
                        # Verify token and get user
                        token_data = verify_token(token)
                        
                        if token_data:
                            # Get database session
                            db = None
                            try:
                                db = next(get_db())
                                user = db.query(User).filter(User.username == token_data.username).first()
                                
                                if user and user.is_admin:
                                    print(f"[RATE_LIMIT] {endpoint_info} - Skipping rate limiting for admin user: {user.username}")
                                    return await func(*args, **kwargs)
                            finally:
                                # Always close the database session
                                if db:
                                    db.close()
                except Exception:
                    # If there's any error, continue with normal rate limiting
                    pass
            
            # Apply normal rate limiting using the pre-created rate limited function
            # Ensure limiter has access to app via request.app.state.limiter
            if request and hasattr(request, 'app') and hasattr(request.app, 'state'):
                request.app.state.limiter = limiter
            print(f"[RATE_LIMIT] {endpoint_info} - Applying rate limiting: {limit_string}")
            return await rate_limited_func(*args, **kwargs)
        
        return wrapper
    return decorator