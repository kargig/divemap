from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os

from app.routers import auth, dive_sites, users, diving_centers, tags
from app.database import engine
from app.models import Base
from app.limiter import limiter

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://divemap.fly.dev",
        "https://divemap-frontend.fly.dev",
        # Add production domains here
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)

# Security middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
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
            "frame-src 'self'"
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

# Mount static files for uploads with security restrictions
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(dive_sites.router, prefix="/api/v1/dive-sites", tags=["Dive Sites"])
app.include_router(diving_centers.router, prefix="/api/v1/diving-centers", tags=["Diving Centers"])
app.include_router(tags.router, tags=["Tags"])

@app.get("/")
async def root():
    return {"message": "Welcome to Divemap API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 