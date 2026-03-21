import pytest
from fastapi import status
from app.models import DiveRoute

class TestPOISearchAPI:
    """Test Points of Interest (POI) search and filtering in dive routes API."""

    @pytest.fixture
    def setup_poi_routes(self, db_session, test_user, test_dive_site):
        """Create multiple routes with different POI markers."""
        # Route 1: Wreck marker
        r1 = DiveRoute(
            dive_site_id=test_dive_site.id,
            created_by=test_user.id,
            name="Wreck Route",
            description="Route with a wreck",
            route_type="scuba",
            route_data={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [23.5, 37.5]},
                        "properties": {"markerType": "wreck", "comment": "Beautiful ancient wreck"}
                    }
                ]
            }
        )
        
        # Route 2: Coral marker
        r2 = DiveRoute(
            dive_site_id=test_dive_site.id,
            created_by=test_user.id,
            name="Coral Garden",
            description="Route with corals",
            route_type="scuba",
            route_data={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [23.6, 37.6]},
                        "properties": {"markerType": "coral", "comment": "Large brain coral"}
                    }
                ]
            }
        )
        
        # Route 3: Mixed markers
        r3 = DiveRoute(
            dive_site_id=test_dive_site.id,
            created_by=test_user.id,
            name="Mixed Route",
            description="Route with wreck and cave",
            route_type="scuba",
            route_data={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [23.7, 37.7]},
                        "properties": {"markerType": "wreck", "comment": "Modern wreck"}
                    },
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [23.8, 37.8]},
                        "properties": {"markerType": "cave", "comment": "Dark cave"}
                    }
                ]
            }
        )
        
        db_session.add_all([r1, r2, r3])
        db_session.commit()
        return [r1, r2, r3]

    def test_list_routes_filter_by_single_poi_type(self, client, setup_poi_routes):
        """Test filtering routes by a single POI type."""
        response = client.get("/api/v1/dive-routes/?poi_types=coral")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["routes"][0]["name"] == "Coral Garden"

    def test_list_routes_filter_by_multiple_poi_types(self, client, setup_poi_routes):
        """Test filtering routes by multiple POI types (OR logic)."""
        # Should match "Coral Garden" (coral) and "Mixed Route" (cave)
        response = client.get("/api/v1/dive-routes/?poi_types=coral&poi_types=cave")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2
        names = [item["name"] for item in data["routes"]]
        assert "Coral Garden" in names
        assert "Mixed Route" in names

    def test_list_routes_poi_search_case_insensitive(self, client, setup_poi_routes):
        """Test robust case-insensitive text search in POI comments."""
        # Search for "BRAIN" (uppercase) should find "Large brain coral"
        response = client.get("/api/v1/dive-routes/?poi_search=BRAIN")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["routes"][0]["name"] == "Coral Garden"

    def test_list_routes_poi_search_substring(self, client, setup_poi_routes):
        """Test substring search in POI comments."""
        # Search for "wreck" should find "Modern wreck" and "Beautiful ancient wreck"
        response = client.get("/api/v1/dive-routes/?poi_search=wreck")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2
        names = [item["name"] for item in data["routes"]]
        assert "Wreck Route" in names
        assert "Mixed Route" in names

    def test_list_routes_combined_poi_filters(self, client, setup_poi_routes):
        """Test combining POI type and POI search filters."""
        # Filter for type='wreck' AND search='Modern'
        response = client.get("/api/v1/dive-routes/?poi_types=wreck&poi_search=Modern")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["routes"][0]["name"] == "Mixed Route"
