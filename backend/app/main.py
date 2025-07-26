from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.routers import auth, dive_sites, users, diving_centers
from app.database import engine
from app.models import Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Divemap API",
    description="Scuba diving site and center review platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(dive_sites.router, prefix="/api/v1/dive-sites", tags=["Dive Sites"])
app.include_router(diving_centers.router, prefix="/api/v1/diving-centers", tags=["Diving Centers"])

@app.get("/")
async def root():
    return {"message": "Welcome to Divemap API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 