import pytest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace
import json
from datetime import date as py_date

from app.services.chat import ChatService
from app.services.chat.context_resolver import resolve_page_context
from app.services.chat.executors.discovery import execute_discovery
from app.schemas.chat import ChatRequest, IntentType
from app.models import (
    DiveSite, DivingCenter, ParsedDiveTrip, User, UserCertification, 
    CertificationLevel, DivingOrganization
)

@pytest.fixture
def setup_agent_data(db_session, test_user):
    # Setup Organization
    org = DivingOrganization(name="AGENT_ORG", acronym="AORG")
    db_session.add(org)
    db_session.flush()

    # Setup Cert Levels
    ow = CertificationLevel(name="Open Water", diving_organization_id=org.id, category="Beginner", max_depth="18m")
    aow = CertificationLevel(name="Advanced Open Water", diving_organization_id=org.id, category="Intermediate", max_depth="30m")
    db_session.add_all([ow, aow])
    db_session.flush()

    # Setup Dive Site
    site = DiveSite(name="Agent Site", region="Attica", country="Greece", latitude=37.8, longitude=23.8, difficulty_id=1)
    db_session.add(site)
    db_session.flush()

    # Setup Diving Center
    center = DivingCenter(name="Agent Center", city="Athens", region="Attica", country="Greece", latitude=37.9, longitude=23.7)
    db_session.add(center)
    db_session.flush()

    # Setup Trip
    trip = ParsedDiveTrip(trip_date=py_date(2026, 3, 10), diving_center_id=center.id, trip_description="Agent Trip")
    db_session.add(trip)
    
    db_session.commit()
    return site, center, trip

@pytest.mark.asyncio
class TestChatAgent:
    """Tests the agentic loop, tool mapping, and ReAct logic."""

    @patch("app.services.chat.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_physics_tool_integration(self, mock_openai, db_session, test_user):
        service = ChatService(db_session)
        tool_call = SimpleNamespace(
            id="call_physics",
            function=SimpleNamespace(
                name="calculate_diving_physics",
                arguments='{"calculation_type": "mod", "o2_percent": 32.0}'
            )
        )
        mock_openai.side_effect = [
            ([tool_call], {"prompt_tokens": 10, "completion_tokens": 5}),
            ("MOD is 33.8m", {"prompt_tokens": 20, "completion_tokens": 10})
        ]
        request = ChatRequest(message="MOD for 32%?", history=[])
        response = await service.process_message(request, test_user)
        assert response.response == "MOD is 33.8m"
        assert response.intermediate_steps[0].tool_name == "calculate_diving_physics"

    @patch("app.services.chat.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_weather_tool_integration(self, mock_openai, db_session, test_user):
        service = ChatService(db_session)
        tool_call = SimpleNamespace(
            id="call_weather",
            function=SimpleNamespace(
                name="get_weather_suitability",
                arguments='{"location": "Athens", "latitude": 37.9, "longitude": 23.7, "date": "2026-03-09"}'
            )
        )
        mock_openai.side_effect = [
            ([tool_call], {"prompt_tokens": 10, "completion_tokens": 5}),
            ("Weather looks good.", {"prompt_tokens": 20, "completion_tokens": 10})
        ]
        request = ChatRequest(message="Weather in Athens?", history=[])
        response = await service.process_message(request, test_user)
        assert response.intermediate_steps[0].tool_name == "get_weather_suitability"

def test_context_resolver(db_session, setup_agent_data):
    site, center, _ = setup_agent_data
    # Site Context
    summary = resolve_page_context(db_session, {"path": f"/dive-sites/{site.id}"})
    assert "Agent Site" in summary
    # Center Context
    summary = resolve_page_context(db_session, {"path": f"/diving-centers/{center.id}"})
    assert "Agent Center" in summary

def test_discovery_extended(db_session, setup_agent_data):
    # Fuzzy match
    results = execute_discovery(db_session, location="agent site")
    assert results[0]["name"] == "Agent Site"
    # Date range trip search
    results = execute_discovery(db_session, date_range=["2026-03-01", "2026-03-20"], entity_type_filter="dive_trip")
    assert any(r["entity_type"] == "dive_trip" for r in results)
