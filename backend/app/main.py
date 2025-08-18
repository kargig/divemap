from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.routers import auth, dive_sites, users, diving_centers, tags, diving_organizations, user_certifications, dives, newsletters, system, privacy
from app.database import engine, get_db
from app.models import Base, Dive, DiveSite, SiteRating, CenterRating, DivingCenter
from app.limiter import limiter
from app.utils import get_client_ip, format_ip_for_logging, is_private_ip

# Create database tables
Base.metadata.create_all(bind=engine)

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
    # Default origins for development and production
    allow_origins = [
        # Development
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        # Production
        "https://divemap.gr",
        "https://divemap.fly.dev",
        "https://divemap-backend.fly.dev"
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
        "X-Match-Types",
        "Set-Cookie",  # Expose Set-Cookie header to frontend
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
            "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000"
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
        
        # Only log if there are more than 3 IPs (unusual proxy chain)
        # or if the first IP looks suspicious
        if len(ips) > 3:
            suspicious_activity = True
            suspicious_details.append(f"Unusual proxy chain length: {len(ips)} IPs")
        
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

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(dive_sites.router, prefix="/api/v1/dive-sites", tags=["Dive Sites"])
app.include_router(diving_centers.router, prefix="/api/v1/diving-centers", tags=["Diving Centers"])
app.include_router(tags.router, prefix="/api/v1/tags", tags=["Tags"])
app.include_router(diving_organizations.router, prefix="/api/v1/diving-organizations", tags=["Diving Organizations"])
app.include_router(user_certifications.router, prefix="/api/v1/user-certifications", tags=["User Certifications"])
app.include_router(dives.router, prefix="/api/v1/dives", tags=["Dives"])
app.include_router(newsletters.router, prefix="/api/v1/newsletters", tags=["Newsletters"])
app.include_router(system.router, prefix="/api/v1/admin/system", tags=["System"])
app.include_router(privacy.router, prefix="/api/v1/privacy", tags=["Privacy"])

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
