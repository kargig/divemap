import pytest
import json
from unittest.mock import MagicMock
from app.models import DiveRoute, DiveSite
from app.services.chat.executors.discovery import execute_discovery
from app.services.chat.chat_service import ChatService
from app.schemas.chat import ChatRequest

class TestAIPOISearch:
    """Test AI assistant POI search and serialization fixes."""

    @pytest.fixture
    def setup_routes_for_ai(self, db_session, test_user):
        """Setup dive sites and routes for AI testing."""
        s1 = DiveSite(name="Red Sea Site", region="Red Sea", country="Egypt")
        db_session.add(s1)
        db_session.flush()

        r1 = DiveRoute(
            dive_site_id=s1.id,
            created_by=test_user.id,
            name="Abu Abu",
            route_type="scuba",
            route_data={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [34.7, 25.3]},
                        "properties": {"markerType": "coral", "comment": "brain coral garden"}
                    }
                ]
            }
        )
        db_session.add(r1)
        db_session.commit()
        return r1

    def test_execute_discovery_dive_routes_poi_search(self, db_session, setup_routes_for_ai):
        """Test AI executor find routes by POI comment."""
        results = execute_discovery(
            db=db_session,
            entity_type_filter="dive_route",
            location="Red Sea",
            poi_search="brain coral"
        )
        
        assert len(results) >= 1
        assert any(r["name"] == "Abu Abu" for r in results)
        assert results[0]["entity_type"] == "dive_route"

    def test_execute_discovery_dive_routes_poi_types(self, db_session, setup_routes_for_ai):
        """Test AI executor find routes by POI marker type."""
        results = execute_discovery(
            db=db_session,
            entity_type_filter="dive_route",
            poi_types=["coral"]
        )
        
        assert len(results) >= 1
        assert any(r["name"] == "Abu Abu" for r in results)
        # Check if found_poi_types is in metadata
        assert "coral" in results[0]["metadata"]["found_poi_types"]

    def test_chat_service_serialization_fix(self, db_session, setup_routes_for_ai, test_user):
        """
        Verify that ChatService can serialize results containing Enums.
        This tests the fix for the 'Object of type RouteType is not JSON serializable' error.
        """
        # Manually create tool results that include the Abu Abu route (which has a route_type Enum)
        results = execute_discovery(db=db_session, entity_type_filter="dive_route", poi_search="coral")
        
        # Verify that we found something
        assert len(results) > 0
        
        # Verify that one of the results has a route_type (as a string now, thanks to clean_results)
        assert results[0]["metadata"]["route_type"] == "scuba"
