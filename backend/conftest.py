import pytest
from datetime import date
import asyncio
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import Mock

from app.main import app
from app.database import get_db, Base
from app.models import User, DiveSite, DivingCenter, SiteRating, CenterRating, SiteComment, CenterComment, DivingOrganization, UserCertification, RefreshToken, AuthAuditLog, Dive, DiveRoute, RouteAnalytics, DifficultyLevel, Setting
from app.auth import create_access_token

# Test database URL - use environment variable if available, otherwise default to SQLite
# For GitHub Actions, ensure we use the test database
if os.getenv("GITHUB_ACTIONS") == "true":
    # In GitHub Actions, use the test database URL
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/divemap_test")
    print(f"🔧 GitHub Actions detected - Using database URL: {SQLALCHEMY_DATABASE_URL}")
else:
    # For local development, use environment variable or default to SQLite
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    print(f"🔧 Local development - Using database URL: {SQLALCHEMY_DATABASE_URL}")

# Create test engine with appropriate configuration for SQLite or MySQL
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # MySQL configuration
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create test session
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def db_engine():
    """Create database engine and tables once per test session."""
    # Create tables once at session start
    Base.metadata.create_all(bind=engine)
    yield engine
    # Clean up tables at session end
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not drop tables at session end: {e}")

@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a fresh database session for each test."""
    # Use transactions instead of dropping/recreating tables
    connection = db_engine.connect()
    transaction = connection.begin()
    
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()  # Rollback instead of dropping tables
        connection.close()

@pytest.fixture
def client(db_session):
    """Create a test client with a fresh database."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Reset rate limiter cache before each test
    try:
        from app.limiter import limiter
        limiter.reset()
    except Exception:
        pass  # Ignore if reset fails

    app.dependency_overrides[get_db] = override_get_db
    
    # Create TestClient with specific configuration to handle anyio issues
    test_client = TestClient(app, raise_server_exceptions=False)
    
    # Set headers to simulate localhost request (exempts from rate limiting)
    test_client.headers.update({
        "X-Forwarded-For": "127.0.0.1",
        "X-Real-IP": "127.0.0.1",
        "Host": "localhost"
    })
    
    try:
        yield test_client
    finally:
        # Ensure proper cleanup
        app.dependency_overrides.clear()
        
        # Reset rate limiter cache after each test as well
        try:
            from app.limiter import limiter
            limiter.reset()
        except Exception:
            pass  # Ignore if reset fails

@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash="$2b$12$bkh2s0S1uAXrAMa5CewBwubJhyiZJTs1jEwy7I4R2Sn9q9cXW2BxO",  # "TestPass123!"
        is_admin=False,
        is_moderator=False,
        enabled=True
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
        password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",  # "password"
        is_admin=True,
        is_moderator=False,
        enabled=True
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin

@pytest.fixture
def test_moderator_user(db_session):
    """Create a test moderator user."""
    moderator = User(
        username="moderator",
        email="moderator@example.com",
        password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",  # "password"
        is_admin=False,
        is_moderator=True,
        enabled=True
    )
    db_session.add(moderator)
    db_session.commit()
    db_session.refresh(moderator)
    return moderator

@pytest.fixture
def test_user_other(db_session):
    """Create another test user for permission testing."""
    user = User(
        username="otheruser",
        email="other@example.com",
        password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",  # "password"
        is_admin=False,
        is_moderator=False,
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_dive_site(db_session):
    """Create a test dive site."""
    # Get ADVANCED_OPEN_WATER difficulty (id=2, order_index=2)
    difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    dive_site = DiveSite(
        name="Test Dive Site",
        description="A test dive site for testing",
        latitude=10.0,
        longitude=20.0,
        access_instructions="Shore access",
        difficulty_id=difficulty.id if difficulty else 2  # Default to id=2 if lookup fails
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
def test_dive(db_session, test_user, test_dive_site):
    """Create a test dive."""
    # Get ADVANCED_OPEN_WATER difficulty (id=2, order_index=2)
    difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    dive = Dive(
        user_id=test_user.id,
        dive_site_id=test_dive_site.id,
        name="Test Dive",
        dive_date=date(2024, 1, 15),
        max_depth=30.0,
        duration=45,
        difficulty_id=difficulty.id if difficulty else 2,  # Default to id=2 if lookup fails
        user_rating=8,
        dive_information="Test dive notes",
        visibility_rating=4,
        is_private=False
    )
    db_session.add(dive)
    db_session.commit()
    db_session.refresh(dive)
    return dive

@pytest.fixture
def user_token(test_user):
    """Create an access token for the test user."""
    return create_access_token(data={"sub": test_user.username})

@pytest.fixture
def admin_token(test_admin_user):
    """Create an access token for the test admin user."""
    return create_access_token(data={"sub": test_admin_user.username})

@pytest.fixture
def moderator_token(test_moderator_user):
    """Create an access token for the test moderator user."""
    return create_access_token(data={"sub": test_moderator_user.username})

@pytest.fixture
def auth_headers(user_token):
    """Return headers with user authentication."""
    return {"Authorization": f"Bearer {user_token}"}

@pytest.fixture
def admin_headers(admin_token):
    """Return headers with admin authentication."""
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture
def moderator_headers(moderator_token):
    """Return headers with moderator authentication."""
    return {"Authorization": f"Bearer {moderator_token}"}

@pytest.fixture
def auth_headers_other_user(test_user_other):
    """Return headers with authentication for another user."""
    other_user_token = create_access_token(data={"sub": test_user_other.username})
    return {"Authorization": f"Bearer {other_user_token}"}


@pytest.fixture
def mock_request():
    """Mock request object for testing"""
    request = Mock()
    request.headers = {"User-Agent": "Test Browser/1.0"}
    request.client = Mock()
    request.client.host = "127.0.0.1"
    return request

@pytest.fixture
def test_diving_organization(db_session):
    """Create a test diving organization."""
    organization = DivingOrganization(
        name="Test Diving Organization",
        acronym="TDO",
        website="https://testdiving.org",
        logo_url="https://testdiving.org/logo.png",
        description="A test diving organization for testing",
        country="Test Country",
        founded_year=2020
    )
    db_session.add(organization)
    db_session.commit()
    db_session.refresh(organization)
    return organization

@pytest.fixture
def test_user_certification(db_session, test_user, test_diving_organization):
    """Create a test user certification."""
    certification = UserCertification(
        user_id=test_user.id,
        diving_organization_id=test_diving_organization.id,
        certification_level="Open Water Diver",
        is_active=True
    )
    db_session.add(certification)
    db_session.commit()
    db_session.refresh(certification)
    return certification


# Dive Routes Test Fixtures

@pytest.fixture
def test_route(db_session, test_user, test_dive_site):
    """Create a test dive route."""
    route_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                },
                "properties": {"route_type": "scuba"}
            }
        ]
    }
    
    route = DiveRoute(
        dive_site_id=test_dive_site.id,
        created_by=test_user.id,
        name="Test Route",
        description="A test route for testing",
        route_data=route_data,
        route_type="scuba"
    )
    db_session.add(route)
    db_session.commit()
    db_session.refresh(route)
    return route


@pytest.fixture
def test_route_other_user(db_session, test_user_other, test_dive_site):
    """Create a test dive route by another user."""
    route_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[23.7, 37.7], [23.8, 37.8]]
                },
                "properties": {"route_type": "swim"}
            }
        ]
    }
    
    route = DiveRoute(
        dive_site_id=test_dive_site.id,
        created_by=test_user_other.id,
        name="Other User Route",
        description="A route by another user",
        route_data=route_data,
        route_type="swim"
    )
    db_session.add(route)
    db_session.commit()
    db_session.refresh(route)
    return route


@pytest.fixture
def test_route_analytics(db_session, test_user, test_route):
    """Create test route analytics."""
    analytics = RouteAnalytics(
        route_id=test_route.id,
        user_id=test_user.id,
        interaction_type="view",
        metadata={"ip_address": "127.0.0.1"}
    )
    db_session.add(analytics)
    db_session.commit()
    db_session.refresh(analytics)
    return analytics


def pytest_collection_modifyitems(config, items):
    """Automatically skip spatial tests when using SQLite."""
    import os
    database_url = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    is_sqlite = database_url.startswith("sqlite")
    
    if is_sqlite:
        skip_spatial = pytest.mark.skip(reason="Requires MySQL/PostGIS - skipped on SQLite")
        for item in items:
            if "spatial" in item.keywords:
                item.add_marker(skip_spatial)


@pytest.fixture
def test_dive_with_route(db_session, test_user, test_dive_site, test_route):
    """Create a test dive with an associated route."""
    # Get ADVANCED_OPEN_WATER difficulty (id=2, order_index=2)
    difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    dive = Dive(
        user_id=test_user.id,
        dive_site_id=test_dive_site.id,
        selected_route_id=test_route.id,
        name="Test Dive with Route",
        dive_date=date.today(),
        max_depth=20.0,
        duration=45,
        difficulty_id=difficulty.id if difficulty else 2,  # Default to id=2 if lookup fails
        visibility_rating=8,
        user_rating=9
    )
    db_session.add(dive)
    db_session.commit()
    db_session.refresh(dive)
    return dive
