import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.models import User, DiveSite, DivingCenter, SiteRating, CenterRating, SiteComment, CenterComment
from app.auth import create_access_token

# Test database URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

# Create test engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Create test session
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop tables after test
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with a fresh database."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash="$2b$12$GDFsVWKY8LXDG9o4EIgvr.g5V2tSkrMD9QcZl0JKxVVSRbh.skEoe",  # "password"
        is_admin=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_admin_user(db_session):
    """Create a test admin user."""
    admin = User(
        username="admin",
        email="admin@example.com",
        password_hash="$2b$12$GDFsVWKY8LXDG9o4EIgvr.g5V2tSkrMD9QcZl0JKxVVSRbh.skEoe",  # "password"
        is_admin=True
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin

@pytest.fixture
def test_dive_site(db_session):
    """Create a test dive site."""
    dive_site = DiveSite(
        name="Test Dive Site",
        description="A test dive site for testing",
        latitude=10.0,
        longitude=20.0,
        access_instructions="Shore access",
        difficulty_level="intermediate"
    )
    db_session.add(dive_site)
    db_session.commit()
    db_session.refresh(dive_site)
    return dive_site

@pytest.fixture
def test_diving_center(db_session):
    """Create a test diving center."""
    diving_center = DivingCenter(
        name="Test Diving Center",
        description="A test diving center for testing",
        email="test@divingcenter.com",
        phone="+1234567890",
        website="www.testdivingcenter.com",
        latitude=15.0,
        longitude=25.0
    )
    db_session.add(diving_center)
    db_session.commit()
    db_session.refresh(diving_center)
    return diving_center

@pytest.fixture
def user_token(test_user):
    """Create an access token for the test user."""
    return create_access_token(data={"sub": test_user.username})

@pytest.fixture
def admin_token(test_admin_user):
    """Create an access token for the test admin user."""
    return create_access_token(data={"sub": test_admin_user.username})

@pytest.fixture
def auth_headers(user_token):
    """Return headers with user authentication."""
    return {"Authorization": f"Bearer {user_token}"}

@pytest.fixture
def admin_headers(admin_token):
    """Return headers with admin authentication."""
    return {"Authorization": f"Bearer {admin_token}"} 