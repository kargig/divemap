import pytest
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.chat_service import ChatService
from app.schemas.chat import SearchIntent, IntentType
from app.models import User, UserCertification, CertificationLevel, Dive, DiveSite, DifficultyLevel, DivingOrganization

@pytest.fixture
def chat_service(db_session):
    return ChatService(db_session)

@pytest.fixture
def setup_recommendation_data(db_session, test_user):
    # 1. Certifications
    # Org
    test_org_name = "TEST_REC_ORG"
    org = db_session.query(DivingOrganization).filter(DivingOrganization.acronym == test_org_name).first()
    if not org:
        org = DivingOrganization(name=test_org_name, acronym=test_org_name)
        db_session.add(org)
        db_session.flush()

    # Levels
    l1 = CertificationLevel(name="Open Water", max_depth="18m", diving_organization_id=org.id)
    l2 = CertificationLevel(name="Advanced Open Water", max_depth="30m", diving_organization_id=org.id)
    l3 = CertificationLevel(name="Deep Diver", max_depth="40m", diving_organization_id=org.id)
    db_session.add_all([l1, l2, l3])
    db_session.flush()

    # User Cert (AOW)
    uc = UserCertification(user_id=test_user.id, diving_organization_id=org.id, certification_level="AOW", certification_level_id=l2.id)
    db_session.add(uc)

    # 2. Difficulty Levels (Assuming fixture populated them: 1=OW, 2=AOW, 3=Deep, 4=Tech)
    # They are populated by 'populate_difficulty_levels' fixture in conftest.

    # 3. Dive Sites
    # Site A: Easy, Shore, Visited
    s1 = DiveSite(name="Site A", difficulty_id=1, access_instructions="Shore dive", latitude=37.0, longitude=23.0)
    # Site B: Hard (Deep), Shore, Not Visited
    s2 = DiveSite(name="Site B", difficulty_id=3, access_instructions="Shore", latitude=37.1, longitude=23.1) # Too hard for AOW? No, wait. AOW is level 2. Deep is level 3. So filtered out.
    # Site C: Medium (AOW), Boat, Not Visited
    s3 = DiveSite(name="Site C", difficulty_id=2, access_instructions="Boat only", latitude=37.2, longitude=23.2) # Boat -> filtered out by shore filter?
    # Site D: Easy, Shore, Not Visited
    s4 = DiveSite(name="Site D", difficulty_id=1, access_instructions="Easy shore access", latitude=37.05, longitude=23.05) # Should be recommended.

    db_session.add_all([s1, s2, s3, s4])
    db_session.flush()

    # 4. Past Dives
    dive = Dive(user_id=test_user.id, dive_site_id=s1.id, dive_date=date(2023, 1, 1), max_depth=10.0, duration=40)
    db_session.add(dive)
    db_session.commit()
    
    return {"user": test_user, "sites": [s1, s2, s3, s4]}

def test_get_user_difficulty_level(chat_service, setup_recommendation_data):
    user = setup_recommendation_data["user"]
    # User has AOW -> Level 2
    level = chat_service._get_user_difficulty_level(user.id)
    assert level == 2

def test_personal_recommendation_logic(chat_service, setup_recommendation_data):
    user = setup_recommendation_data["user"]
    
    intent = SearchIntent(
        intent_type=IntentType.PERSONAL_RECOMMENDATION,
        latitude=37.0,
        longitude=23.0
    )
    
    results = chat_service.execute_search(intent, current_user=user)
    
    # Analysis:
    # Site A: Visited -> Exclude
    # Site B: Difficulty 3 > User 2 -> Exclude
    # Site C: Boat -> Exclude (shore filter)
    # Site D: Diff 1 <= 2, Shore, Not Visited -> Include
    
    site_names = [r["name"] for r in results if r["entity_type"] == "dive_site"]
    assert "Site D" in site_names
    assert "Site A" not in site_names
    assert "Site B" not in site_names
    assert "Site C" not in site_names # Assuming shore filter works
