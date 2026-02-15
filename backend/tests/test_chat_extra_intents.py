import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import or_, and_
from app.services.chat_service import ChatService
from app.schemas.chat import SearchIntent, IntentType
from app.models import DivingOrganization, CertificationLevel, DiveSite

@pytest.fixture
def chat_service(db_session):
    return ChatService(db_session)

@pytest.fixture
def setup_career_data(db_session):
    # Org
    org = db_session.query(DivingOrganization).filter(DivingOrganization.acronym == "TEST_CAREER_ORG").first()
    if not org:
        org = DivingOrganization(name="TEST_CAREER_ORG", acronym="TEST_CAREER_ORG")
        db_session.add(org)
        db_session.flush()

    # Levels
    l1 = CertificationLevel(
        name="Level 1", 
        diving_organization_id=org.id,
        category="Recreational",
        max_depth="18m",
        prerequisites="None"
    )
    l2 = CertificationLevel(
        name="Level 2", 
        diving_organization_id=org.id,
        category="Recreational",
        max_depth="30m",
        prerequisites="Level 1"
    )
    l3 = CertificationLevel(
        name="Pro Level", 
        diving_organization_id=org.id,
        category="Professional",
        max_depth="Unlimited",
        prerequisites="Level 2"
    )
    db_session.add_all([l1, l2, l3])
    db_session.commit()
    return {"org": org}

@pytest.fixture
def setup_marine_data(db_session):
    s1 = DiveSite(name="Turtle Site", marine_life="You can see many turtles here.", latitude=10.0, longitude=10.0)
    s2 = DiveSite(name="Shark Site", marine_life="Famous for reef sharks.", latitude=10.1, longitude=10.1)
    s3 = DiveSite(name="Mixed Site", marine_life="Turtles and Sharks together.", latitude=10.2, longitude=10.2)
    s4 = DiveSite(name="Empty Site", marine_life="Just rocks.", latitude=10.3, longitude=10.3)
    db_session.add_all([s1, s2, s3, s4])
    db_session.commit()
    return {"s1": s1}

def test_career_path_search(chat_service, setup_career_data):
    intent = SearchIntent(
        intent_type=IntentType.CAREER_PATH,
        keywords=["TEST_CAREER_ORG"]
    )
    results = chat_service.execute_search(intent)
    
    assert len(results) > 0
    path = next(r for r in results if r["entity_type"] == "career_path")
    assert path["organization"] == "TEST_CAREER_ORG"
    assert "Level 1" in path["courses"]
    assert "Pro Level" in path["courses"]
    
    # Check details presence and structure
    assert "details" in path
    details = path["details"]
    l1_detail = next(d for d in details if d["name"] == "Level 1")
    assert l1_detail["max_depth"] == "18m"
    assert l1_detail["category"] == "Recreational"

def test_marine_life_search_strict(chat_service, setup_marine_data):
    # Search for "turtles" - should match sites with turtles
    intent = SearchIntent(
        intent_type=IntentType.MARINE_LIFE,
        keywords=["turtles"],
        location=None
    )
    results = chat_service.execute_search(intent)
    
    site_names = [r["name"] for r in results if r["entity_type"] == "dive_site"]
    assert "Turtle Site" in site_names
    assert "Mixed Site" in site_names
    assert "Shark Site" not in site_names

def test_marine_life_search_and_logic_fallback(chat_service, setup_marine_data):
    # Search for "turtles" AND "sharks"
    # Strict AND: Mixed Site
    # Fallback OR: Turtle Site, Shark Site
    intent = SearchIntent(
        intent_type=IntentType.MARINE_LIFE,
        keywords=["turtles", "sharks"],
        location=None
    )
    results = chat_service.execute_search(intent)
    
    site_names = [r["name"] for r in results if r["entity_type"] == "dive_site"]
    
    # Check strict match is present
    assert "Mixed Site" in site_names
    
    # Check fallback results are present (because 1 strict result < 3 threshold)
    assert "Turtle Site" in site_names
    assert "Shark Site" in site_names
    
    # Empty site should not be there
    assert "Empty Site" not in site_names
