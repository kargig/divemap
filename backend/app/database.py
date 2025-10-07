from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://divemap_user:divemap_password@localhost:3306/divemap")

def get_database_url():
    """Get database URL for Alembic migrations"""
    return DATABASE_URL

# Create SQLAlchemy engine with optimized configuration for faster startup
if DATABASE_URL.startswith("sqlite"):
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False  # Set to True for SQL query logging
    )
else:
    # MySQL configuration optimized for faster startup and better performance
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,  # Smaller initial pool size for faster startup
        max_overflow=10,  # Allow overflow for peak usage
        pool_timeout=30,  # Faster timeout for connection acquisition
        echo=False  # Set to True for SQL query logging
    )

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()