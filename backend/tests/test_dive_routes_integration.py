import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

from app.models import User, DiveSite, DiveRoute, Dive
from app.routers.dives.dives_crud import get_dives, create_dive, update_dive
from app.schemas import DiveCreate, DiveUpdate


class TestDiveRoutesIntegration:
    """Test integration between dives and dive routes."""

    def test_create_dive_with_route(self, client, test_user, test_dive_site, test_route, auth_headers):
        """Test creating a dive with an associated route."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route.id,
            "name": "Test Dive with Route",
            "dive_date": "2025-01-01",
            "max_depth": 20.0,
            "duration": 45,
            "difficulty_code": "ADVANCED_OPEN_WATER",
            "visibility_rating": 8,
            "user_rating": 9
        }
        
        response = client.post(
            "/api/v1/dives/",
            json=dive_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["selected_route_id"] == test_route.id
        assert data["name"] == "Test Dive with Route"

    def test_create_dive_with_invalid_route(self, client, test_user, test_dive_site, auth_headers):
        """Test creating a dive with non-existent route."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": 99999,  # Non-existent route
            "name": "Test Dive with Invalid Route",
            "dive_date": "2025-01-01",
            "max_depth": 20.0,
            "duration": 45
        }
        
        response = client.post(
            "/api/v1/dives/",
            json=dive_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert "Selected route not found" in response.json()["detail"]

    def test_create_dive_with_route_from_different_site(self, client, test_user, test_dive_site, test_route_other_user, auth_headers):
        """Test creating a dive with route from different dive site."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route_other_user.id,  # Route from different site
            "name": "Test Dive with Wrong Route",
            "dive_date": "2025-01-01",
            "max_depth": 20.0,
            "duration": 45
        }
        
        response = client.post(
            "/api/v1/dives/",
            json=dive_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        # Note: API currently allows routes from different sites

    def test_update_dive_route(self, client, test_user, test_dive_with_route, test_route_other_user, auth_headers):
        """Test updating a dive's associated route."""
        update_data = {
            "selected_route_id": test_route_other_user.id
        }
        
        response = client.put(
            f"/api/v1/dives/{test_dive_with_route.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["selected_route_id"] == test_route_other_user.id

    def test_update_dive_remove_route(self, client, test_user, test_dive_with_route, auth_headers):
        """Test removing route association from a dive."""
        update_data = {
            "selected_route_id": None
        }
        
        response = client.put(
            f"/api/v1/dives/{test_dive_with_route.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["selected_route_id"] is None

    def test_get_dives_with_route_info(self, client, test_dive_with_route):
        """Test getting dives with route information."""
        response = client.get("/api/v1/dives/")
        
        assert response.status_code == 200
        data = response.json()
        
        # Find the dive with route
        dive_with_route = next((d for d in data if d["id"] == test_dive_with_route.id), None)
        assert dive_with_route is not None
        assert dive_with_route["selected_route_id"] == test_dive_with_route.selected_route_id

    def test_get_dive_with_route_details(self, client, test_dive_with_route):
        """Test getting a specific dive with route details."""
        response = client.get(f"/api/v1/dives/{test_dive_with_route.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["selected_route_id"] == test_dive_with_route.selected_route_id
        
        # Should include route information if available
        if "selected_route" in data:
            assert data["selected_route"]["id"] == test_dive_with_route.selected_route_id

    def test_dive_route_statistics(self, client, test_route, test_dive_with_route):
        """Test getting route statistics including dive usage."""
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/community-stats")
        
        assert response.status_code == 200
        data = response.json()
        community_stats = data["community_stats"]
        assert community_stats["total_dives_using_route"] == 1

    def test_dive_route_statistics_multiple_dives(self, client, test_user, test_route, test_dive_site, auth_headers):
        """Test route statistics with multiple dives."""
        # Create additional dives with the same route
        dive_data_2 = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route.id,
            "name": "Second Dive with Route",
            "dive_date": "2025-01-02",
            "max_depth": 15.0,
            "duration": 30
        }
        
        dive_data_3 = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route.id,
            "name": "Third Dive with Route",
            "dive_date": "2025-01-03",
            "max_depth": 25.0,
            "duration": 60
        }
        
        # Create the additional dives
        client.post("/api/v1/dives/", json=dive_data_2, headers=auth_headers)
        client.post("/api/v1/dives/", json=dive_data_3, headers=auth_headers)
        
        # Get route statistics
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/community-stats")
        
        assert response.status_code == 200
        data = response.json()
        community_stats = data["community_stats"]
        assert community_stats["total_dives_using_route"] == 2  # Only the 2 dives we just created

    def test_dive_route_statistics_multiple_users(self, client, test_user, test_user_other, test_route, test_dive_site, auth_headers_other_user):
        """Test route statistics with multiple users."""
        # Create dive by another user
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route.id,
            "name": "Other User Dive with Route",
            "dive_date": "2025-01-02",
            "max_depth": 18.0,
            "duration": 40
        }
        
        client.post("/api/v1/dives/", json=dive_data, headers=auth_headers_other_user)
        
        # Get route statistics
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/community-stats")
        
        assert response.status_code == 200
        data = response.json()
        community_stats = data["community_stats"]
        assert community_stats["total_dives_using_route"] == 1  # Only the 1 dive we just created

    def test_popular_routes_based_on_dive_usage(self, client, test_user, test_route, test_route_other_user, test_dive_site, auth_headers):
        """Test getting popular routes based on dive usage."""
        # Create multiple dives with one route to make it more popular
        dive_data_1 = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route.id,
            "name": "Dive 1 with Popular Route",
            "dive_date": "2025-01-01",
            "max_depth": 20.0,
            "duration": 45
        }
        
        dive_data_2 = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route.id,
            "name": "Dive 2 with Popular Route",
            "dive_date": "2025-01-02",
            "max_depth": 15.0,
            "duration": 30
        }
        
        dive_data_3 = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route_other_user.id,
            "name": "Dive 3 with Less Popular Route",
            "dive_date": "2025-01-03",
            "max_depth": 25.0,
            "duration": 60
        }
        
        # Create the dives
        client.post("/api/v1/dives/", json=dive_data_1, headers=auth_headers)
        client.post("/api/v1/dives/", json=dive_data_2, headers=auth_headers)
        client.post("/api/v1/dives/", json=dive_data_3, headers=auth_headers)
        
        # Get popular routes
        response = client.get("/api/v1/dive-routes/popular?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["routes"]) == 2
        
        # First route should be the more popular one
        assert data["routes"][0]["id"] == test_route.id
        assert data["routes"][1]["id"] == test_route_other_user.id

    def test_dive_route_validation_on_update(self, client, test_user, test_dive_with_route, auth_headers):
        """Test route validation when updating dive."""
        # Try to update with invalid route
        update_data = {
            "selected_route_id": 99999
        }
        
        response = client.put(
            f"/api/v1/dives/{test_dive_with_route.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404  # Dive not found, not route validation error
        assert "Selected route not found" in response.json()["detail"]

    def test_dive_route_cascade_on_route_deletion(self, client, test_user, test_dive_with_route, auth_headers):
        """Test cascade behavior when route is deleted."""
        route_id = test_dive_with_route.selected_route_id
        
        # Soft delete the route
        response = client.delete(
            f"/api/v1/dive-routes/{route_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Check that dive still exists but route is soft deleted
        response = client.get(f"/api/v1/dives/{test_dive_with_route.id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["selected_route_id"] is None  # Route ID should be cleared after soft delete

    def test_dive_route_hard_delete_with_associated_dives(self, client, test_user, test_dive_with_route, auth_headers):
        """Test hard deletion of route with associated dives."""
        route_id = test_dive_with_route.selected_route_id
        
        # Try to hard delete the route
        response = client.delete(
            f"/api/v1/dive-routes/{route_id}?permanent=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200  # API allows hard deletion of user's own route
        assert "Route deleted successfully" in response.json()["message"]

    def test_dive_route_migration_on_deletion(self, client, test_user, test_dive_with_route, test_route_other_user, auth_headers):
        """Test migrating dives to alternative route before deletion."""
        route_id = test_dive_with_route.selected_route_id
        alternative_route_id = test_route_other_user.id
        
        # Update dive to use alternative route (migration simulation)
        response = client.put(
            f"/api/v1/dives/{test_dive_with_route.id}",
            json={"selected_route_id": alternative_route_id},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify dive is migrated
        response = client.get(f"/api/v1/dives/{test_dive_with_route.id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["selected_route_id"] == alternative_route_id

    def test_dive_route_export_with_dive_context(self, client, test_route, test_dive_with_route):
        """Test exporting route with dive context."""
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/export/gpx")
        
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/gpx+xml")
        
        # GPX should include route information
        gpx_content = response.text
        assert test_route.name in gpx_content

    def test_dive_route_analytics_integration(self, client, test_user, test_route, test_dive_with_route, auth_headers):
        """Test route analytics integration with dives."""
        # Track route view
        response = client.post(
            f"/api/v1/dive-routes/{test_route.id}/view",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Get route analytics
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/community-stats")
        
        assert response.status_code == 200
        data = response.json()
        community_stats = data["community_stats"]
        assert community_stats["total_dives_using_route"] == 1

    def test_dive_route_permissions_integration(self, client, test_user, test_route_other_user, test_dive_site, auth_headers):
        """Test route permissions integration with dives."""
        # Try to create dive with route owned by another user
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "selected_route_id": test_route_other_user.id,
            "name": "Dive with Other User's Route",
            "dive_date": "2025-01-01",
            "max_depth": 20.0,
            "duration": 45
        }
        
        response = client.post(
            "/api/v1/dives/",
            json=dive_data,
            headers=auth_headers
        )
        
        # Should be allowed - users can use any route for their dives
        assert response.status_code == 200  # API returns 200 for route creation

    def test_dive_route_search_integration(self, client, test_user, test_route, test_dive_with_route, auth_headers):
        """Test search integration with dive routes."""
        # Search for dives with specific route
        response = client.get(
            f"/api/v1/dives/?search={test_route.name}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should find the dive with the route
        dive_found = any(d["id"] == test_dive_with_route.id for d in data)
        assert dive_found

    def test_dive_route_filtering_integration(self, client, test_user, test_route, test_dive_with_route, auth_headers):
        """Test filtering integration with dive routes."""
        # Filter dives by route
        response = client.get(
            f"/api/v1/dives/?route_id={test_route.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should find the dive with the route
        dive_found = any(d["id"] == test_dive_with_route.id for d in data)
        assert dive_found
        
        # All returned dives should have the specified route
        for dive in data:
            assert dive["selected_route_id"] == test_route.id
