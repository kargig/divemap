from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging
import time
from sqlalchemy.orm import Session
from sqlalchemy import func

# Lazy imports for faster startup - only import when needed
from app.database import engine, get_db
from app.models import Base, Dive, DiveSite, SiteRating, CenterRating, DivingCenter
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
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
    if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
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
    from app.routers import auth, users
    
    # Include only the most critical routers (others moved to lazy loading)
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
    
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

# Load routers
load_routers()

# Middleware for lazy loading routers
@app.middleware("http")
async def lazy_router_loading(request: Request, call_next):
    """Load routers lazily when first accessed"""
    path = request.url.path
    
    # Load dive-sites router
    if path.startswith("/api/v1/dive-sites") and not hasattr(app, '_dive_sites_router_loaded'):
        load_dive_sites_router()
    
    # Load newsletters router
    elif path.startswith("/api/v1/newsletters") and not hasattr(app, '_newsletters_router_loaded'):
        load_newsletters_router()
    
    # Load system router
    elif path.startswith("/api/v1/admin/system") and not hasattr(app, '_system_router_loaded'):
        load_system_router()
    
    # Load privacy router
    elif path.startswith("/api/v1/privacy") and not hasattr(app, '_privacy_router_loaded'):
        load_privacy_router()
    
    # Load diving organizations router
    elif path.startswith("/api/v1/diving-organizations") and not hasattr(app, '_diving_organizations_router_loaded'):
        load_diving_organizations_router()
    
    # Load user certifications router
    elif path.startswith("/api/v1/user-certifications") and not hasattr(app, '_user_certifications_router_loaded'):
        load_user_certifications_router()
    
    # Load diving centers router
    elif path.startswith("/api/v1/diving-centers") and not hasattr(app, '_diving_centers_router_loaded'):
        load_diving_centers_router()
    
    # Load tags router
    elif path.startswith("/api/v1/tags") and not hasattr(app, '_tags_router_loaded'):
        load_tags_router()
    
    # Load dives router
    elif path.startswith("/api/v1/dives") and not hasattr(app, '_dives_router_loaded'):
        load_dives_router()
    
    # Load dive routes router
    elif path.startswith("/api/v1/dive-routes") and not hasattr(app, '_dive_routes_router_loaded'):
        load_dive_routes_router()
    
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

        return {
            "dives": dive_count,
            "dive_sites": dive_site_count,
            "reviews": total_review_count,
            "diving_centers": diving_center_count
        }
    except Exception as e:
        return {
            "dives": 0,
            "dive_sites": 0,
            "reviews": 0,
            "diving_centers": 0
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
