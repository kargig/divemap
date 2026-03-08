import pytest
from datetime import date
from sqlalchemy.orm import Session
from app.models import DiveSite, DivingCenter, Dive, DiveRoute, User, UserCertification, CertificationLevel, DivingOrganization, ParsedDiveTrip
from app.services.chat.context_resolver import resolve_page_context
from app.services.chat.executors.discovery import execute_discovery
from app.services.chat.executors.others import execute_other_intents
from app.services.chat.utils import get_user_difficulty_level
from app.schemas.chat import IntentType

@pytest.fixture
def setup_comp_data(db_session: Session, test_user):
    # Setup Organization
    org = DivingOrganization(name="COMP_PADI", acronym="CPADI")
    db_session.add(org)
    db_session.flush()

    # Setup Cert Levels
    # Column is diving_organization_id
    ow = CertificationLevel(name="Open Water", diving_organization_id=org.id, category="Beginner", max_depth="18m")
    aow = CertificationLevel(name="Advanced Open Water", diving_organization_id=org.id, category="Intermediate", max_depth="30m")
    tec = CertificationLevel(name="Tec 45", diving_organization_id=org.id, category="Technical", max_depth="45m")
    db_session.add_all([ow, aow, tec])
    db_session.flush()

    # Setup Dive Site
    site = DiveSite(
        name="Comp Site A", 
        region="Attica", 
        country="Greece", 
        latitude=37.8, 
        longitude=23.8,
        difficulty_id=1,
        max_depth=15
    )
    db_session.add(site)
    db_session.flush()

    # Setup Diving Center
    center = DivingCenter(name="Comp Center", city="Athens", region="Attica", country="Greece", latitude=37.9, longitude=23.7)
    db_session.add(center)
    db_session.flush()

    # Setup Trip
    trip = ParsedDiveTrip(trip_date=date(2026, 3, 10), diving_center_id=center.id, trip_description="Integration Trip")
    db_session.add(trip)
    db_session.flush()

    # Setup User Cert
    # Columns are diving_organization_id and certification_level_id
    user_cert = UserCertification(
        user_id=test_user.id, 
        diving_organization_id=org.id,
        certification_level="Advanced Open Water", 
        certification_level_id=aow.id
    )
    db_session.add(user_cert)
    db_session.commit()

    return site, center, trip

def test_context_resolver_variations(db_session, setup_comp_data):
    site, center, trip = setup_comp_data
    
    # 1. Site Context
    ctx_site = {"path": f"/dive-sites/{site.id}"}
    summary = resolve_page_context(db_session, ctx_site)
    assert f"Current Dive Site: '{site.name}'" in summary
    
    # 2. Center Context
    ctx_center = {"path": f"/diving-centers/{center.id}"}
    summary = resolve_page_context(db_session, ctx_center)
    assert f"Current Diving Center: '{center.name}'" in summary
    
    # 3. Tools Context
    ctx_tools = {"path": "/resources/tools", "params": {"tab": "mod"}}
    summary = resolve_page_context(db_session, ctx_tools)
    assert "Active Tool Tab: mod" in summary

    # 4. List views
    assert "Dive Sites directory" in resolve_page_context(db_session, {"path": "/dive-sites"})
    assert "Diving Centers directory" in resolve_page_context(db_session, {"path": "/diving-centers"})

def test_discovery_fuzzy_and_region_promotion(db_session, setup_comp_data):
    site, _, _ = setup_comp_data
    
    # Fuzzy Site Name Resolution
    # Exact match first
    results = execute_discovery(db_session, location="Comp Site A")
    assert len(results) > 0
    
    # Fuzzy match (lowercase and partial)
    results = execute_discovery(db_session, location="comp site")
    assert len(results) > 0
    assert results[0]["name"] == "Comp Site A"

    # Trip search with date range
    results = execute_discovery(db_session, date_range=["2026-03-01", "2026-03-20"], entity_type_filter="dive_trip")
    assert any(r["entity_type"] == "dive_trip" for r in results)

def test_others_physics_edge_cases(db_session):
    # EAD/END Calculation
    params = {"depth": 30, "o2": 32, "he": 0}
    results = execute_other_intents(db_session, intent_type=IntentType.CALCULATOR, calculator_params=params)
    assert any("ead" in r for r in results)

    # Best Mix
    params = {"depth": 40, "pp_o2_max": 1.4}
    results = execute_other_intents(db_session, intent_type=IntentType.CALCULATOR, calculator_params=params)
    assert any("best_mix" in r for r in results)

def test_user_difficulty_logic(db_session, test_user, setup_comp_data):
    # Use setup_comp_data fixture to ensure the user has the cert
    level = get_user_difficulty_level(db_session, test_user.id)
    # Our test user has AOW which should be level 2
    assert level == 2

    # Add a technical cert
    org = db_session.query(DivingOrganization).filter(DivingOrganization.name == "COMP_PADI").first()
    tec = CertificationLevel(name="Full Cave", diving_organization_id=org.id, category="Technical")
    db_session.add(tec)
    db_session.flush()
    
    user_cert = UserCertification(
        user_id=test_user.id, 
        diving_organization_id=org.id,
        certification_level="Full Cave", 
        certification_level_id=tec.id
    )
    db_session.add(user_cert)
    db_session.commit()
    
    assert get_user_difficulty_level(db_session, test_user.id) == 4
