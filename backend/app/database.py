from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import time

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
        pool_pre_ping=True,  # Validate connections before use
        pool_recycle=3600,   # Recycle connections every hour
        pool_size=10,        # Increased pool size for better performance
        max_overflow=20,     # Increased overflow for peak usage
        pool_timeout=30,     # Connection acquisition timeout
        pool_reset_on_return='commit',  # Reset connections on return
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

def warm_database_connections():
    """Pre-warm database connections for faster startup"""
    try:
        print("🔧 Warming database connections...")
        warm_start = time.time()
        
        # Import sqlalchemy for proper text execution
        from sqlalchemy import text
        
        # Create a few connections to warm up the pool
        connections = []
        for i in range(min(3, engine.pool.size())):
            try:
                conn = engine.connect()
                # Test the connection with a simple query using proper SQLAlchemy text
                conn.execute(text("SELECT 1"))
                connections.append(conn)
            except Exception as e:
                print(f"⚠️ Failed to warm connection {i+1}: {e}")
        
        # Close the warmed connections
        for conn in connections:
            conn.close()
        
        warm_time = time.time() - warm_start
        print(f"✅ Database connections warmed in {warm_time:.2f}s")
        return True
    except Exception as e:
        print(f"⚠️ Failed to warm database connections: {e}")
        return False