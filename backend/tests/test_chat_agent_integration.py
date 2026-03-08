import pytest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace
import json
from app.services.chat import ChatService
from app.schemas.chat import ChatRequest, IntentType
from app.models import ChatSession

@pytest.mark.asyncio
class TestChatAgentIntegration:
    """
    Integration tests for the Agentic Loop. 
    These verify that tool calls from the LLM correctly map to backend functions.
    """

    @patch("app.services.chat.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_physics_tool_integration(self, mock_openai, db_session, test_user):
        """Verify the physics tool mapping and Pydantic validation fix."""
        service = ChatService(db_session)
        
        # Simulate LLM calling the physics tool
        tool_call = SimpleNamespace(
            id="call_physics_123",
            function=SimpleNamespace(
                name="calculate_diving_physics",
                # Note the 'calculation_type' which caused the previous crash
                arguments=json.dumps({
                    "calculation_type": "mod", 
                    "o2_percent": 32.0,
                    "pp_o2_max": 1.4
                })
            )
        )
        
        mock_openai.side_effect = [
            ([tool_call], {"prompt_tokens": 10, "completion_tokens": 5}),
            ("The MOD is 33.8m", {"prompt_tokens": 20, "completion_tokens": 10})
        ]
        
        request = ChatRequest(message="What is the MOD for 32%?", history=[])
        response = await service.process_message(request, test_user)
        
        assert response.response == "The MOD is 33.8m"
        assert len(response.intermediate_steps) > 0
        assert response.intermediate_steps[0].tool_name == "calculate_diving_physics"
        # Verify the intent object was populated without Pydantic crashing
        assert response.intent.calculator_params["calculation_type"] == "mod"

    @patch("app.services.chat.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_weather_tool_integration(self, mock_openai, db_session, test_user):
        """Verify the weather tool mapping (fixed intent_location bug)."""
        service = ChatService(db_session)
        
        tool_call = SimpleNamespace(
            id="call_weather_123",
            function=SimpleNamespace(
                name="get_weather_suitability",
                arguments=json.dumps({
                    "location": "Athens",
                    "latitude": 37.9,
                    "longitude": 23.7,
                    "date": "2026-03-09"
                })
            )
        )
        
        mock_openai.side_effect = [
            ([tool_call], {"prompt_tokens": 10, "completion_tokens": 5}),
            ("Weather looks good.", {"prompt_tokens": 20, "completion_tokens": 10})
        ]
        
        request = ChatRequest(message="Weather in Athens tomorrow?", history=[])
        # This would have raised TypeError: enrich_results_with_weather() missing 1 required positional argument
        response = await service.process_message(request, test_user)
        
        assert "Weather" in response.response
        assert response.intermediate_steps[0].tool_name == "get_weather_suitability"

    @patch("app.services.chat.chat_service.openai_service.get_chat_completion", new_callable=AsyncMock)
    async def test_multi_step_agent_loop(self, mock_openai, db_session, test_user):
        """Verify the agent can take multiple steps (e.g. search then answer)."""
        service = ChatService(db_session)
        
        # Step 1: Search
        call_1 = SimpleNamespace(
            id="c1",
            function=SimpleNamespace(name="search_dive_sites", arguments='{"location": "Naxos"}')
        )
        # Step 2: Another tool or final answer
        
        mock_openai.side_effect = [
            ([call_1], {"prompt_tokens": 10, "completion_tokens": 5}),
            ("I found Naxos sites.", {"prompt_tokens": 20, "completion_tokens": 10})
        ]
        
        request = ChatRequest(message="Diving in Naxos", history=[])
        response = await service.process_message(request, test_user)
        
        # Verify both steps were captured in the new Tool History format
        assert len(response.intermediate_steps) == 1
        assert response.intermediate_steps[0].action_type == "tool_call"
        assert response.intermediate_steps[0].tool_result is not None
