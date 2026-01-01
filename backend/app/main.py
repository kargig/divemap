from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta, timezone
import os
import logging
import time
from sqlalchemy.orm import Session
from sqlalchemy import func

# Lazy imports for faster startup - only import when needed
from app.database import engine, get_db
from app.models import Base, Dive, DiveSite, SiteRating, CenterRating, DivingCenter, ParsedDiveTrip
from app.limiter import limiter
from app.utils import get_client_ip, format_ip_for_logging, is_private_ip

# Startup timing for performance monitoring
startup_start_time = time.time()

# Configure logging based on environment variable
log_level = os.getenv("LOG_LEVEL", "WARNING").upper()
numeric_level = getattr(logging, log_level, logging.WARNING)

# Configure security settings based on environment variable
# In production with Cloudflare + Fly.io + nginx + frontend + backend, 
# we expect ~6 proxy hops, so we set a higher threshold
suspicious_proxy_chain_length = int(os.getenv("SUSPICIOUS_PROXY_CHAIN_LENGTH", "3"))

DOCS_PATHS = {"/docs", "/redoc", "/openapi.json"}

# Configure root logger
logging.basicConfig(
    level=numeric_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Set specific logger levels
logging.getLogger("uvicorn").setLevel(numeric_level)
logging.getLogger("app").setLevel(numeric_level)
logging.getLogger("app.routers").setLevel(numeric_level)

# Force set the root logger level
logging.getLogger().setLevel(numeric_level)

print(f"🔧 Logging level set to: {log_level} (numeric: {numeric_level})")
print(f"🔧 Root logger level: {logging.getLogger().getEffectiveLevel()}")
print(f"🔧 Uvicorn logger level: {logging.getLogger('uvicorn').getEffectiveLevel()}")
print(f"🔧 Suspicious proxy chain length threshold: {suspicious_proxy_chain_length}")

# Create database tables (skip during testing)
# Check if we're running tests by looking for pytest in sys.argv or test environment
import sys
is_testing = (
    "pytest" in sys.modules or 
    "pytest" in sys.argv[0] or 
    any("pytest" in arg for arg in sys.argv) or
    os.getenv("PYTEST_CURRENT_TEST") or
    os.getenv("TESTING") == "true"
)

# Only create tables if not testing and if tables don't exist (optimization)
if not is_testing:
    try:
        # Check if tables already exist to avoid unnecessary creation
        with engine.connect() as conn:
            # Quick check if any tables exist
            result = conn.execute(func.count().select().select_from(Base.metadata.tables.get('dives', None)))
            tables_exist = True
    except:
        tables_exist = False
    
    if not tables_exist:
        print("🔧 Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created")
    else:
        print("✅ Database tables already exist, skipping creation")

app = FastAPI(
    title="Divemap API",
    description="Scuba diving site and center review platform",
    version="1.0.0"
)

# Add rate limiter to app state
app.state.limiter = limiter

# Custom rate limit exception handler with reset time information
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom rate limit handler that includes reset time information.
    For general rate limits, calculates reset time based on the limit string.
    For "3/day" limit, reset time is 24 hours from now.
    """
    # Try to extract limit information from the exception
    limit_detail = str(exc.detail) if hasattr(exc, 'detail') else "rate limit exceeded"
    
    # Calculate reset time (default to 1 minute for most limits, 24 hours for daily limits)
    # This is a best-effort calculation - slowapi doesn't expose the exact reset time
    reset_time = datetime.now(timezone.utc) + timedelta(minutes=1)
    
    # Check if this is a daily limit (contains "day" or "/d")
    if "day" in limit_detail.lower() or "/d" in limit_detail.lower():
        reset_time = datetime.now(timezone.utc) + timedelta(days=1)
    
    reset_timestamp = int(reset_time.timestamp())
    now = datetime.now(timezone.utc)
    retry_after_seconds = int((reset_time - now).total_seconds())
    
    # Special handling for resend verification endpoint
    if "/resend-verification" in str(request.url.path):
        from app.routers.auth import RESEND_VERIFICATION_RATE_LIMIT
        response = JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests. You have exceeded the rate limit for resending verification emails.",
                "error": "rate_limit_exceeded",
                "limit": f"{RESEND_VERIFICATION_RATE_LIMIT} requests per day",
                "reset_at": reset_timestamp,
                "reset_at_iso": reset_time.isoformat(),
                "message": f"You have reached the maximum number of verification email requests ({RESEND_VERIFICATION_RATE_LIMIT} per day). Please try again after {reset_time.strftime('%Y-%m-%d %H:%M:%S UTC')}."
            },
            headers={
                "X-RateLimit-Limit": str(RESEND_VERIFICATION_RATE_LIMIT),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_timestamp),
                "Retry-After": str(retry_after_seconds)
            }
        )
    else:
        # General rate limit response
        response = JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please try again later.",
                "error": "rate_limit_exceeded",
                "message": limit_detail
            },
            headers={
                "X-RateLimit-Reset": str(reset_timestamp),
                "Retry-After": str(retry_after_seconds)
            }
        )
    return response

app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

# Configure CORS with more restrictive settings
# Get allowed origins from environment variable or use defaults
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    # Parse comma-separated origins from environment variable
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",")]
else:
    # Default origins for development
    allow_origins = [
        "http://localhost",  # Allow nginx proxy
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=[
        "X-Total-Count",
        "X-Total-Pages",
        "X-Current-Page",
        "X-Page-Size",
        "X-Has-Next-Page",
        "X-Has-Prev-Page",
        "X-Match-Types"
    ],
    max_age=3600,
)

# Fix request URL scheme based on X-Forwarded-Proto header
# This ensures FastAPI generates correct HTTPS URLs for redirects
@app.middleware("http")
async def fix_request_scheme(request: Request, call_next):
    """Fix request URL scheme to use X-Forwarded-Proto header"""
    # Check X-Forwarded-Proto header (set by nginx/Cloudflare)
    forwarded_proto = request.headers.get("X-Forwarded-Proto", "").lower()
    if forwarded_proto == "https":
        # Replace the request URL with HTTPS scheme
        # This ensures FastAPI redirects use HTTPS
        request.scope["scheme"] = "https"
    elif not forwarded_proto and request.headers.get("host", "").endswith(".gr"):
        # If no header but domain suggests production, default to HTTPS
        request.scope["scheme"] = "https"
    
    response = await call_next(request)
    return response

# Security middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    # Get client IP for security monitoring (but don't log every request)
    client_ip = get_client_ip(request)
    formatted_ip = format_ip_for_logging(client_ip, include_private=False)
    
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Check if this is a documentation endpoint
    if request.url.path in DOCS_PATHS:
        # More permissive CSP for documentation endpoints
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; "
            "img-src 'self' https://fastapi.tiangolo.com https://cdn.jsdelivr.net https://unpkg.com data:; "
            "font-src 'self' https://cdn.jsdelivr.net https://unpkg.com; "
            "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com; "
            "frame-src 'self'; "
            "worker-src 'self' blob:; "
            "child-src 'self' blob:; "
            "object-src 'self'"
        )
    else:
        # Stricter CSP for API endpoints
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self'; "
            "font-src 'self'; "
            "connect-src 'self'"
        )

    response.headers["Content-Security-Policy"] = csp_policy
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# Enhanced security logging middleware
@app.middleware("http")
async def enhanced_security_logging(request, call_next):
    """Enhanced security logging with detailed client IP analysis"""
    
    # Get client IP for logging (this already extracts only the first IP)
    client_ip = get_client_ip(request)
    formatted_ip = format_ip_for_logging(client_ip)
    
    # Check for truly suspicious patterns (not just normal proxy chains)
    suspicious_activity = False
    suspicious_details = []
    
    # Check X-Forwarded-For for unusual patterns (not just multiple IPs)
    if 'X-Forwarded-For' in request.headers:
        forwarded_for = request.headers['X-Forwarded-For']
        ips = [ip.strip() for ip in forwarded_for.split(',')]
        suspicious_details.append(f"Suspicious IPs: {(ips)}")
        
        # Only log if there are more than the configured threshold (unusual proxy chain)
        # or if the first IP looks suspicious
        if len(ips) > suspicious_proxy_chain_length:
            suspicious_activity = True
            suspicious_details.append(f"Unusual proxy chain length: {len(ips)} IPs (threshold: {suspicious_proxy_chain_length})")
        
        # Check if first IP is private but others are public (potential spoofing)
        if len(ips) >= 2:
            first_ip = ips[0]
            second_ip = ips[1]
            if is_private_ip(first_ip) and not is_private_ip(second_ip):
                suspicious_activity = True
                suspicious_details.append("Private IP followed by public IP in chain")
    
    # Check for other suspicious patterns
    suspicious_headers = ['X-Real-IP', 'X-Forwarded-Host', 'X-Forwarded-Proto']
    for header in suspicious_headers:
        if header in request.headers:
            header_value = request.headers[header]
            # Only log if header contains multiple values (unusual)
            if ',' in str(header_value):
                suspicious_activity = True
                suspicious_details.append(f"Multiple values in {header}")
    
    # Log suspicious activity only once per request
    if suspicious_activity:
        print(f"[SECURITY] Suspicious activity detected from IP: {formatted_ip}")
        for detail in suspicious_details:
            print(f"[SECURITY] Detail: {detail}")
    
    # Process the request
    response = await call_next(request)
    
    # Only log failed requests or truly suspicious activity
    if response.status_code >= 400 or suspicious_activity:
        print(f"[SECURITY] {request.method} {request.url.path} - Status: {response.status_code} - Client IP: {formatted_ip}")
    
    return response

# Mount static files for uploads with security restrictions
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Lazy router loading for faster startup
def load_routers():
    """Load routers lazily to improve startup time"""
    print("🔧 Loading API routers...")
    router_start = time.time()
    
    # Import only the most essential routers for startup
    from app.routers import auth, users, settings, notifications
    
    # Include only the most critical routers (others moved to lazy loading)
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
    app.include_router(settings.router, prefix="/api/v1/settings", tags=["Settings"])
    app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
    
    # Import unsubscribe router
    from app.routers import unsubscribe
    app.include_router(unsubscribe.router, prefix="/api/v1", tags=["Unsubscribe"])
    
    # Moved to lazy loading:
    # - dive_sites (already implemented)
    # - newsletters (heavy AI/ML dependencies)
    # - system (admin-only, not needed for regular users)
    # - privacy (less frequently accessed)
    # - diving_organizations (reference data, not critical)
    # - user_certifications (user-specific, not needed for homepage)
    # - diving_centers (can be lazy loaded, not critical for homepage)
    # - tags (can be lazy loaded, not critical for homepage)
    # - dives (can be lazy loaded, not critical for homepage)
    # - dive_routes (can be lazy loaded, not critical for homepage)
    
    router_time = time.time() - router_start
    print(f"✅ Essential routers loaded in {router_time:.2f}s")

def load_dive_sites_router():
    """Load dive-sites router lazily when first accessed"""
    if not hasattr(app, '_dive_sites_router_loaded'):
        print("🔧 Loading dive-sites router lazily...")
        router_start = time.time()
        
        from app.routers import dive_sites
        app.include_router(dive_sites.router, prefix="/api/v1/dive-sites", tags=["Dive Sites"])
        
        app._dive_sites_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Dive-sites router loaded lazily in {router_time:.2f}s")

def load_newsletters_router():
    """Load newsletters router lazily when first accessed"""
    if not hasattr(app, '_newsletters_router_loaded'):
        print("🔧 Loading newsletters router lazily...")
        router_start = time.time()
        
        from app.routers import newsletters
        app.include_router(newsletters.router, prefix="/api/v1/newsletters", tags=["Newsletters"])
        
        app._newsletters_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Newsletters router loaded lazily in {router_time:.2f}s")

def load_system_router():
    """Load system router lazily when first accessed"""
    if not hasattr(app, '_system_router_loaded'):
        print("🔧 Loading system router lazily...")
        router_start = time.time()
        
        from app.routers import system
        app.include_router(system.router, prefix="/api/v1/admin/system", tags=["System"])
        
        app._system_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ System router loaded lazily in {router_time:.2f}s")

def load_privacy_router():
    """Load privacy router lazily when first accessed"""
    if not hasattr(app, '_privacy_router_loaded'):
        print("🔧 Loading privacy router lazily...")
        router_start = time.time()
        
        from app.routers import privacy
        app.include_router(privacy.router, prefix="/api/v1/privacy", tags=["Privacy"])
        
        app._privacy_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Privacy router loaded lazily in {router_time:.2f}s")

def load_diving_organizations_router():
    """Load diving organizations router lazily when first accessed"""
    if not hasattr(app, '_diving_organizations_router_loaded'):
        print("🔧 Loading diving organizations router lazily...")
        router_start = time.time()
        
        from app.routers import diving_organizations
        app.include_router(diving_organizations.router, prefix="/api/v1/diving-organizations", tags=["Diving Organizations"])
        
        app._diving_organizations_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Diving organizations router loaded lazily in {router_time:.2f}s")

def load_user_certifications_router():
    """Load user certifications router lazily when first accessed"""
    if not hasattr(app, '_user_certifications_router_loaded'):
        print("🔧 Loading user certifications router lazily...")
        router_start = time.time()
        
        from app.routers import user_certifications
        app.include_router(user_certifications.router, prefix="/api/v1/user-certifications", tags=["User Certifications"])
        
        app._user_certifications_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ User certifications router loaded lazily in {router_time:.2f}s")

def load_diving_centers_router():
    """Load diving centers router lazily when first accessed"""
    if not hasattr(app, '_diving_centers_router_loaded'):
        print("🔧 Loading diving centers router lazily...")
        router_start = time.time()
        
        from app.routers import diving_centers
        app.include_router(diving_centers.router, prefix="/api/v1/diving-centers", tags=["Diving Centers"])
        
        app._diving_centers_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Diving centers router loaded lazily in {router_time:.2f}s")

def load_tags_router():
    """Load tags router lazily when first accessed"""
    if not hasattr(app, '_tags_router_loaded'):
        print("🔧 Loading tags router lazily...")
        router_start = time.time()
        
        from app.routers import tags
        app.include_router(tags.router, prefix="/api/v1/tags", tags=["Tags"])
        
        app._tags_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Tags router loaded lazily in {router_time:.2f}s")

def load_dives_router():
    """Load dives router lazily when first accessed"""
    if not hasattr(app, '_dives_router_loaded'):
        print("🔧 Loading dives router lazily...")
        router_start = time.time()
        
        from app.routers.dives import router as dives_router
        app.include_router(dives_router, prefix="/api/v1/dives", tags=["Dives"])
        
        app._dives_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Dives router loaded lazily in {router_time:.2f}s")

def load_dive_routes_router():
    """Load dive routes router lazily when first accessed"""
    if not hasattr(app, '_dive_routes_router_loaded'):
        print("🔧 Loading dive routes router lazily...")
        router_start = time.time()
        
        from app.routers import dive_routes
        app.include_router(dive_routes.router, prefix="/api/v1/dive-routes", tags=["Dive Routes"])
        
        app._dive_routes_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Dive routes router loaded lazily in {router_time:.2f}s")

def load_search_router():
    """Load search router lazily when first accessed"""
    if not hasattr(app, '_search_router_loaded'):
        print("🔧 Loading search router lazily...")
        router_start = time.time()
        
        from app.routers import search
        app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
        
        app._search_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Search router loaded lazily in {router_time:.2f}s")

def load_share_router():
    """Load share router lazily when first accessed"""
    if not hasattr(app, '_share_router_loaded'):
        print("🔧 Loading share router lazily...")
        router_start = time.time()
        
        from app.routers import share
        app.include_router(share.router, prefix="/api/v1/share", tags=["Share"])
        
        app._share_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Share router loaded lazily in {router_time:.2f}s")

def load_weather_router():
    """Load weather router lazily when first accessed"""
    if not hasattr(app, '_weather_router_loaded'):
        print("🔧 Loading weather router lazily...")
        router_start = time.time()
        
        from app.routers import weather
        app.include_router(weather.router, prefix="/api/v1/weather", tags=["Weather"])
        
        app._weather_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Weather router loaded lazily in {router_time:.2f}s")

# Load routers
load_routers()

# Middleware for lazy loading routers
@app.middleware("http")
async def lazy_router_loading(request: Request, call_next):
    """Load routers lazily when first accessed"""
    path = request.url.path
    
    # Check if we need to load all routers for documentation
    is_docs = path in DOCS_PATHS
    
    # Load dive-sites router
    if (path.startswith("/api/v1/dive-sites") or is_docs) and not hasattr(app, '_dive_sites_router_loaded'):
        load_dive_sites_router()
    
    # Load newsletters router
    if (path.startswith("/api/v1/newsletters") or is_docs) and not hasattr(app, '_newsletters_router_loaded'):
        load_newsletters_router()
    
    # Load system router
    if (path.startswith("/api/v1/admin/system") or is_docs) and not hasattr(app, '_system_router_loaded'):
        load_system_router()
    
    # Load privacy router
    if (path.startswith("/api/v1/privacy") or is_docs) and not hasattr(app, '_privacy_router_loaded'):
        load_privacy_router()
    
    # Load diving organizations router
    if (path.startswith("/api/v1/diving-organizations") or is_docs) and not hasattr(app, '_diving_organizations_router_loaded'):
        load_diving_organizations_router()
    
    # Load user certifications router
    if (path.startswith("/api/v1/user-certifications") or is_docs) and not hasattr(app, '_user_certifications_router_loaded'):
        load_user_certifications_router()
    
    # Load diving centers router
    if (path.startswith("/api/v1/diving-centers") or is_docs) and not hasattr(app, '_diving_centers_router_loaded'):
        load_diving_centers_router()
    
    # Load tags router
    if (path.startswith("/api/v1/tags") or is_docs) and not hasattr(app, '_tags_router_loaded'):
        load_tags_router()
    
    # Load dives router
    if (path.startswith("/api/v1/dives") or is_docs) and not hasattr(app, '_dives_router_loaded'):
        load_dives_router()
    
    # Load dive routes router
    if (path.startswith("/api/v1/dive-routes") or is_docs) and not hasattr(app, '_dive_routes_router_loaded'):
        load_dive_routes_router()
    
    # Load search router
    if (path.startswith("/api/v1/search") or is_docs) and not hasattr(app, '_search_router_loaded'):
        load_search_router()
    
    # Load share router
    if (path.startswith("/api/v1/share") or is_docs) and not hasattr(app, '_share_router_loaded'):
        load_share_router()
    
    # Load weather router
    if (path.startswith("/api/v1/weather") or is_docs) and not hasattr(app, '_weather_router_loaded'):
        load_weather_router()
    
    response = await call_next(request)
    return response

@app.get("/")
async def root():
    return {"message": "Welcome to Divemap API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/v1/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get platform statistics"""
    try:
        # Count dives (only public ones for unauthenticated users)
        dive_count = db.query(func.count(Dive.id)).filter(Dive.is_private == False).scalar()

        # Count dive sites
        dive_site_count = db.query(func.count(DiveSite.id)).scalar()

        # Count reviews (site ratings + center ratings)
        site_review_count = db.query(func.count(SiteRating.id)).scalar()
        center_review_count = db.query(func.count(CenterRating.id)).scalar()
        total_review_count = site_review_count + center_review_count

        # Count diving centers
        diving_center_count = db.query(func.count(DivingCenter.id)).scalar()

        # Count dive trips
        dive_trips_count = db.query(func.count(ParsedDiveTrip.id)).scalar()

        return {
            "dives": dive_count,
            "dive_sites": dive_site_count,
            "reviews": total_review_count,
            "diving_centers": diving_center_count,
            "dive_trips": dive_trips_count
        }
    except Exception as e:
        return {
            "dives": 0,
            "dive_sites": 0,
            "reviews": 0,
            "diving_centers": 0,
            "dive_trips": 0
        }

# Add startup performance monitoring
startup_end_time = time.time()
total_startup_time = startup_end_time - startup_start_time
print(f"🚀 Application startup completed in {total_startup_time:.2f}s")

# Add startup event handler for additional monitoring
@app.on_event("startup")
async def startup_event():
    """Log startup completion with timing and warm database connections"""
    print(f"🎯 FastAPI application fully started in {total_startup_time:.2f}s")
    print(f"🔧 Environment: {os.getenv('ENVIRONMENT', 'production')}")
    print(f"🔧 Log level: {log_level}")
    print(f"🔧 Database URL configured: {'Yes' if os.getenv('DATABASE_URL') else 'No'}")
    
    # Warm database connections for better performance
    from app.database import warm_database_connections
    warm_database_connections()
