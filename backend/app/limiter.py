import time
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request, Depends
from typing import Optional
from functools import wraps
from app.auth import get_current_user_optional, get_current_admin_user, verify_token
from app.database import get_db
from app.models import User

def custom_key_func(request: Request) -> str:
    """
    Custom key function for rate limiting that skips rate limiting for:
    1. Localhost requests (127.0.0.1, ::1, localhost)
    """
    start_time = time.time()
    # Get client IP address
    client_ip = get_remote_address(request)
    print(f"[RATE_LIMIT] Key function - Client IP: {client_ip}")
    
    # Skip rate limiting for localhost only
    if client_ip in ["127.0.0.1", "::1", "localhost"]:
        print(f"[RATE_LIMIT] Skipping rate limiting for localhost IP: {client_ip}")
        elapsed = time.time() - start_time
        print(f"[RATE_LIMIT] Key function completed in {elapsed:.4f}s")
        return "localhost"  # Special key that won't be rate limited
    
    # For all other requests, use IP address as key
    print(f"[RATE_LIMIT] Applying rate limiting for IP: {client_ip}")
    elapsed = time.time() - start_time
    print(f"[RATE_LIMIT] Key function completed in {elapsed:.4f}s")
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
            start_time = time.time()
            print(f"[ADMIN_RATE_LIMIT] Starting admin rate limit check at {time.strftime('%H:%M:%S')}")
            
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
                client_ip = get_remote_address(request)
                print(f"[ADMIN_RATE_LIMIT] Admin check - Client IP: {client_ip}")
                
                # Try to get current user by extracting token from headers
                try:
                    # Extract authorization header
                    auth_header = request.headers.get("authorization")
                    
                    if auth_header and auth_header.startswith("Bearer "):
                        token = auth_header[7:]  # Remove "Bearer " prefix
                        print(f"[ADMIN_RATE_LIMIT] Checking token for admin status...")
                        
                        # Verify token and get user
                        token_start = time.time()
                        token_data = verify_token(token)
                        token_elapsed = time.time() - token_start
                        print(f"[ADMIN_RATE_LIMIT] Token verification took {token_elapsed:.4f}s")
                        
                        if token_data:
                            print(f"[ADMIN_RATE_LIMIT] Token verified for user: {token_data.username}")
                            # Get database session
                            print(f"[ADMIN_RATE_LIMIT] Getting database session...")
                            db_start = time.time()
                            
                            # Properly manage database session
                            db = None
                            try:
                                db = next(get_db())
                                db_elapsed = time.time() - db_start
                                print(f"[ADMIN_RATE_LIMIT] Database session obtained in {db_elapsed:.4f}s, querying user...")
                                
                                query_start = time.time()
                                user = db.query(User).filter(User.username == token_data.username).first()
                                query_elapsed = time.time() - query_start
                                print(f"[ADMIN_RATE_LIMIT] User query took {query_elapsed:.4f}s")
                                
                                if user:
                                    print(f"[ADMIN_RATE_LIMIT] User found: {user.username}, admin: {user.is_admin}")
                                    # Skip rate limiting for admin users
                                    if user.is_admin:
                                        elapsed = time.time() - start_time
                                        print(f"[ADMIN_RATE_LIMIT] Skipping rate limiting for admin user: {user.username} (total time: {elapsed:.4f}s)")
                                        return await func(*args, **kwargs)
                                    else:
                                        print(f"[ADMIN_RATE_LIMIT] Applying rate limiting for non-admin user: {user.username}")
                                else:
                                    print(f"[ADMIN_RATE_LIMIT] User not found in database: {token_data.username}")
                            finally:
                                # Always close the database session
                                if db:
                                    db.close()
                                    print(f"[ADMIN_RATE_LIMIT] Database session closed")
                        else:
                            print(f"[ADMIN_RATE_LIMIT] Token verification failed")
                    else:
                        print(f"[ADMIN_RATE_LIMIT] No authorization header found")
                except Exception as e:
                    print(f"[ADMIN_RATE_LIMIT] Error checking admin status: {e}")
                    # If there's any error, continue with normal rate limiting
                    pass
                
                print(f"[ADMIN_RATE_LIMIT] Applying rate limiting for IP: {client_ip}")
            else:
                print("[ADMIN_RATE_LIMIT] No request object found, applying rate limiting")
            
            # Apply normal rate limiting using the limiter
            print(f"[ADMIN_RATE_LIMIT] Creating rate limited function with limit: {limit_string}")
            rate_limited_func = limiter.limit(limit_string)(func)
            elapsed = time.time() - start_time
            print(f"[ADMIN_RATE_LIMIT] Admin rate limit check completed in {elapsed:.4f}s")
            return await rate_limited_func(*args, **kwargs)
        
        return wrapper
    return decorator 