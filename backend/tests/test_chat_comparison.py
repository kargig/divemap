import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.chat_service import ChatService
from app.schemas.chat import SearchIntent, IntentType
from app.models import DivingOrganization, CertificationLevel

@pytest.fixture
def chat_service(db_session):
    return ChatService(db_session)

@pytest.fixture
def setup_comparison_data(db_session):
    # Org 1
    org1 = db_session.query(DivingOrganization).filter(DivingOrganization.acronym == "TEST_COMP_PADI").first()
    if not org1:
        org1 = DivingOrganization(name="TEST_COMP_PADI", acronym="TEST_COMP_PADI")
        db_session.add(org1)
        db_session.flush()
    
    # Org 2
    org2 = db_session.query(DivingOrganization).filter(DivingOrganization.acronym == "TEST_COMP_SSI").first()
    if not org2:
        org2 = DivingOrganization(name="TEST_COMP_SSI", acronym="TEST_COMP_SSI")
        db_session.add(org2)
        db_session.flush()

    # Levels
    # PADI Tec 45
    l1 = CertificationLevel(
        name="TEST_Tec 45", 
        max_depth="45m", 
        category="Technical", 
        diving_organization_id=org1.id,
        gases="100% O2",
        tanks="Double + Stage"
    )
    
    # SSI XR Extended Range
    l2 = CertificationLevel(
        name="TEST_XR Extended Range", 
        max_depth="45m", 
        category="Technical", 
        diving_organization_id=org2.id,
        gases="100% O2",
        tanks="Double + Stage"
    )
    
    # Irrelevant
    l3 = CertificationLevel(name="TEST_Open Water", max_depth="18m", diving_organization_id=org1.id)

    db_session.add_all([l1, l2, l3])
    db_session.commit()
    
    return {"org1": org1, "org2": org2, "l1": l1, "l2": l2}

def test_comparison_logic(chat_service, setup_comparison_data):
    intent = SearchIntent(
        intent_type=IntentType.COMPARISON,
        keywords=["TEST_Tec", "45", "TEST_XR"]
    )
    
    results = chat_service.execute_search(intent)
    
    # Should find at least the two relevant certs
    names = [r["name"] for r in results if r["entity_type"] == "certification"]
    
    assert "TEST_Tec 45" in names
    assert "TEST_XR Extended Range" in names
    
    # Check metadata
    tec45 = next(r for r in results if r["name"] == "TEST_Tec 45")
    assert tec45["metadata"]["max_depth"] == "45m"
    assert tec45["metadata"]["organization"] == "TEST_COMP_PADI"
