import pytest
from datetime import date
from unittest.mock import MagicMock
from sqlalchemy.orm import Session
from urllib.parse import quote

from app.models import (
    DiveSite, DivingCenter, Dive, User, UserCertification, 
    CertificationLevel, DivingOrganization, SiteRating, GearRentalCost,
    ParsedDiveTrip
)
from app.geo_utils import calculate_directional_bounds, get_empirical_region_bounds
from app.schemas.chat import SearchIntent, IntentType
from app.services.chat.executors.dispatcher import execute_search_intent
from app.services.chat.utils import get_user_difficulty_level

@pytest.fixture
def setup_executor_data(db_session: Session, test_user):
    # Setup Organization
    org = DivingOrganization(name="EXEC_ORG", acronym="EORG")
    db_session.add(org)
    db_session.flush()

    # Setup Cert Levels
    ow = CertificationLevel(name="Open Water", diving_organization_id=org.id, category="Beginner", max_depth="18m")
    aow = CertificationLevel(name="Advanced Open Water", diving_organization_id=org.id, category="Intermediate", max_depth="30m")
    tec = CertificationLevel(name="Tec 45", diving_organization_id=org.id, category="Technical", max_depth="45m")
    db_session.add_all([ow, aow, tec])
    db_session.flush()

    # Setup Dive Sites
    s1 = DiveSite(
        name="North Site", 
        region="Attica", 
        latitude=38.2, 
        longitude=23.8, 
        difficulty_id=1, 
        marine_life="Turtles",
        access_instructions="Easy shore access"
    )
    s2 = DiveSite(
        name="South Site", 
        region="Attica", 
        latitude=37.7, 
        longitude=23.8, 
        difficulty_id=2, 
        marine_life="Octopus",
        access_instructions="Walk to the beach"
    )
    db_session.add_all([s1, s2])
    db_session.flush()

    # Setup Diving Centers
    c1 = DivingCenter(name="Cheap Center", city="Athens", region="Attica", latitude=37.9, longitude=23.7)
    db_session.add(c1)
    db_session.flush()

    # Setup Gear
    g1 = GearRentalCost(diving_center_id=c1.id, item_name="12L Tank", cost=10.00, currency="EUR")
    db_session.add(g1)
    db_session.flush()

    # Setup Ratings
    r1 = SiteRating(dive_site_id=s1.id, user_id=test_user.id, score=10)
    db_session.add(r1)
    db_session.flush()

    # Setup User Cert
    user_cert = UserCertification(user_id=test_user.id, diving_organization_id=org.id, certification_level="AOW", certification_level_id=aow.id)
    db_session.add(user_cert)
    
    db_session.commit()
    return {"s1": s1, "s2": s2, "c1": c1, "org": org}

# --- GEO & DIRECTION TESTS ---

def test_calculate_directional_bounds():
    n, s, e, w = 38.0, 37.0, 24.0, 23.0
    mid_lat = 37.5
    
    res_n, res_s, _, _ = calculate_directional_bounds(n, s, e, w, "south")
    assert res_n == mid_lat
    assert res_s == s

def test_get_empirical_region_bounds(db_session, setup_executor_data):
    bounds = get_empirical_region_bounds(db_session, "Attica")
    assert bounds is not None
    n, s, e, w = bounds
    assert n >= 38.2
    assert s <= 37.7

# --- DISCOVERY TESTS ---

def test_execute_search_with_direction(db_session, setup_executor_data, monkeypatch):
    from app.services.chat.executors import discovery as discovery_mod
    monkeypatch.setattr(discovery_mod, "get_external_region_bounds", lambda x: ((38.4, 37.5, 24.2, 22.8), "Attica, Greece"))
    
    intent = SearchIntent(intent_type=IntentType.DISCOVERY, location="Attica", direction="south")
    results = execute_search_intent(db_session, intent)
    
    names = [r["name"] for r in results if r["entity_type"] == "dive_site"]
    assert "South Site" in names
    assert "North Site" not in names

def test_highest_rated_search(db_session, setup_executor_data):
    intent = SearchIntent(intent_type=IntentType.DISCOVERY, keywords=["highest_rated"])
    results = execute_search_intent(db_session, intent)
    assert results[0]["name"] == "North Site" # Has the 10/10 rating

# --- GEAR & MARINE LIFE TESTS ---

def test_gear_rental_search(db_session, setup_executor_data):
    intent = SearchIntent(intent_type=IntentType.GEAR_RENTAL, keywords=["tank"], location="Attica")
    results = execute_search_intent(db_session, intent)
    assert any(r["entity_type"] == "gear_rental" and r["cost"] == 10.0 for r in results)

def test_marine_life_search(db_session, setup_executor_data):
    intent = SearchIntent(intent_type=IntentType.MARINE_LIFE, keywords=["Turtles"])
    results = execute_search_intent(db_session, intent)
    assert any(r["name"] == "North Site" for r in results)

# --- CAREER & COMPARISON TESTS ---

def test_career_path_search(db_session, setup_executor_data):
    intent = SearchIntent(intent_type=IntentType.CAREER_PATH, keywords=["EORG"])
    results = execute_search_intent(db_session, intent)
    path = next(r for r in results if r["entity_type"] == "career_path")
    assert "Open Water" in path["courses"]

def test_comparison_logic(db_session, setup_executor_data):
    intent = SearchIntent(intent_type=IntentType.COMPARISON, keywords=["Open", "Water", "Tec", "45"])
    results = execute_search_intent(db_session, intent)
    names = [r["name"] for r in results if r["entity_type"] == "certification"]
    assert "Open Water" in names
    assert "Tec 45" in names

# --- RECOMMENDATION & UTILS ---

def test_user_difficulty_level_util(db_session, setup_executor_data, test_user):
    level = get_user_difficulty_level(db_session, test_user.id)
    assert level == 2 # User has AOW

def test_personal_recommendation_logic(db_session, setup_executor_data, test_user):
    # Site 1 (North) is level 1, Site 2 (South) is level 2. User is level 2.
    # Both are accessible, but recommendation often filters for shore etc.
    intent = SearchIntent(intent_type=IntentType.PERSONAL_RECOMMENDATION, latitude=38.0, longitude=23.8)
    results = execute_search_intent(db_session, intent, current_user=test_user)
    # Just verify it doesn't crash and returns sites
    assert any(r["entity_type"] == "dive_site" for r in results)
