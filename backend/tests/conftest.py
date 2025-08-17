import pytest
import os
from unittest.mock import Mock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import User, RefreshToken, AuthAuditLog
from app.auth import get_password_hash


# Test database configuration
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        # Drop tables
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create a test client with database dependency override"""
    # Import app here to avoid database connection issues
    from app.main import app
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Create and return a TestClient
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    """Create a test user for testing"""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("TestPass123!"),
        enabled=True,
        is_admin=False,
        is_moderator=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_admin_user(db):
    """Create a test admin user for testing"""
    user = User(
        username="adminuser",
        email="admin@example.com",
        password_hash=get_password_hash("AdminPass123!"),
        enabled=True,
        is_admin=True,
        is_moderator=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def mock_request():
    """Mock request object for testing"""
    request = Mock()
    request.headers = {"User-Agent": "Test Browser/1.0"}
    request.client = Mock()
    request.client.host = "127.0.0.1"
    return request


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Set up test environment variables"""
    # Set test environment variables
    os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
    os.environ["ALGORITHM"] = "HS256"
    os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "15"
    os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "30"
    os.environ["ENABLE_TOKEN_ROTATION"] = "true"
    os.environ["ENABLE_AUDIT_LOGGING"] = "true"
    os.environ["MAX_ACTIVE_SESSIONS_PER_USER"] = "5"
    
    yield
    
    # Clean up environment variables
    for key in ["SECRET_KEY", "ALGORITHM", "ACCESS_TOKEN_EXPIRE_MINUTES", 
                "REFRESH_TOKEN_EXPIRE_DAYS", "ENABLE_TOKEN_ROTATION", 
                "ENABLE_AUDIT_LOGGING", "MAX_ACTIVE_SESSIONS_PER_USER"]:
        if key in os.environ:
            del os.environ[key]
