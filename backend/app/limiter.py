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

def custom_key_func(request: Request) -> str:
    """
    Custom key function for rate limiting that skips rate limiting for:
    1. Localhost requests (127.0.0.1, ::1, localhost)
    """
    start_time = time.time()
    # Get client IP address using our enhanced detection
    client_ip = get_client_ip(request)
    formatted_ip = format_ip_for_logging(client_ip, include_private=True)
    print(f"[RATE_LIMIT] Key function - Client IP: {formatted_ip}")

    # Skip rate limiting for localhost only
    if is_localhost_ip(client_ip):
        print(f"[RATE_LIMIT] Skipping rate limiting for IP: {formatted_ip}")
        elapsed = time.time() - start_time
        print(f"[RATE_LIMIT] Key function completed in {elapsed:.4f}s")
        return "localhost"  # Special key that won't be rate limited

    # For all other requests, use IP address as key
    print(f"[RATE_LIMIT] Applying rate limiting for IP: {formatted_ip}")
    elapsed = time.time() - start_time
    print(f"[RATE_LIMIT] Key function completed in {elapsed:.4f}s")
    return client_ip

# Initialize rate limiter with custom key function
limiter = Limiter(key_func=custom_key_func)

def skip_rate_limit_for_admin(limit_string: str):
    """
    Custom decorator that applies rate limiting but skips it for admin users and localhost requests
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()

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

                # Skip rate limiting for localhost requests
                if is_localhost_ip(client_ip):
                    print(f"[RATE_LIMIT] Skipping rate limiting for localhost IP: {client_ip}")
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

                            # Properly manage database session
                            db = None
                            try:
                                db = next(get_db())

                                user = db.query(User).filter(User.username == token_data.username).first()

                                if user:
                                    # Skip rate limiting for admin users
                                    if user.is_admin:
                                        return await func(*args, **kwargs)
                                    else:
                                        pass
                                else:
                                    pass
                            finally:
                                # Always close the database session
                                if db:
                                    db.close()
                        else:
                            pass
                    else:
                        pass
                except Exception as e:
                    # If there's any error, continue with normal rate limiting
                    pass

            # Apply normal rate limiting using the limiter
            rate_limited_func = limiter.limit(limit_string)(func)
            return await rate_limited_func(*args, **kwargs)

        return wrapper
    return decorator