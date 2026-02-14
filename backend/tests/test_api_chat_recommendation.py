import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas.chat import SearchIntent, IntentType
from app.models import DiveSite, DivingOrganization, CertificationLevel, UserCertification, Dive
from datetime import date

@pytest.fixture
def setup_api_data(db_session, test_user):
    # 1. Certifications
    test_org_name = "TEST_API_ORG"
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

    # 2. Dive Sites
    # Site A: Visited
    s1 = DiveSite(name="API Site A", difficulty_id=1, access_instructions="Shore dive", latitude=37.0, longitude=23.0)
    # Site B: Too Hard (Deep)
    s2 = DiveSite(name="API Site B", difficulty_id=3, access_instructions="Shore", latitude=37.1, longitude=23.1) 
    # Site C: Suitable (Recommended)
    s3 = DiveSite(name="API Site C", difficulty_id=2, access_instructions="Easy shore access", latitude=37.05, longitude=23.05) 

    db_session.add_all([s1, s2, s3])
    db_session.flush()

    # 3. Past Dives
    dive = Dive(user_id=test_user.id, dive_site_id=s1.id, dive_date=date(2023, 1, 1), max_depth=10.0, duration=40)
    db_session.add(dive)
    db_session.commit()
    
    return {"user": test_user}

@pytest.mark.asyncio
async def test_chat_personal_recommendation_api(client, auth_headers, setup_api_data):
    # Mock OpenAI Service
    with patch("app.services.openai_service.openai_service.get_chat_completion", new_callable=AsyncMock) as mock_openai:
        # Mock responses for the two calls:
        # 1. Intent Extraction
        intent_response = SearchIntent(
            intent_type=IntentType.PERSONAL_RECOMMENDATION,
            keywords=["weekend"],
            latitude=37.0,
            longitude=23.0,
            location=None  # Use coordinates instead of non-matching location name
        )
        
        # 2. Final Response Generation
        final_text = "I recommend API Site C."
        
        mock_openai.side_effect = [
            (intent_response, {"prompt_tokens": 10, "completion_tokens": 5}),
            (final_text, {"prompt_tokens": 20, "completion_tokens": 10})
        ]
        
        # Make Request
        response = client.post(
            "/api/v1/chat/message",
            json={
                "message": "Where should I go diving next weekend?",
                "history": []
            },
            headers=auth_headers
        )
        
        # Verify Response
        assert response.status_code == 200, f"Response: {response.text}"
        data = response.json()
        
        # Check Intent
        assert data["intent"]["intent_type"] == "personal_recommendation"
        
        # Check Sources (The Recommendation Logic)
        # Should contain Site C
        source_names = [s["name"] for s in data["sources"] if s["entity_type"] == "dive_site"]
        assert "API Site C" in source_names
        
        # Should NOT contain Site A (Visited)
        assert "API Site A" not in source_names
        
        # Should NOT contain Site B (Too Hard)
        assert "API Site B" not in source_names
        
        # Check Response Text
        assert data["response"] == final_text
