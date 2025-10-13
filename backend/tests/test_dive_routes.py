import pytest
from fastapi import status
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import json

from app.models import User, DiveSite, DiveRoute, RouteAnalytics, Dive
from app.schemas import DiveRouteCreate, DiveRouteUpdate


class TestDiveRoutesAPI:
    """Test dive routes API endpoints."""

    def test_create_route_success(self, client, test_user, test_dive_site, auth_headers):
        """Test successful route creation."""
        route_data = {
            "dive_site_id": test_dive_site.id,
            "name": "Test Route",
            "description": "A test route",
            "route_data": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                        },
                        "properties": {"route_type": "scuba"}
                    }
                ]
            },
            "route_type": "scuba"
        }
        
        response = client.post(
            "/api/v1/dive-routes/",
            json=route_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Test Route"
        assert data["description"] == "A test route"
        assert data["route_type"] == "scuba"
        assert data["created_by"] == test_user.id
        assert data["dive_site_id"] == test_dive_site.id

    def test_create_route_invalid_geometry(self, client, test_user, test_dive_site, auth_headers):
        """Test route creation with invalid geometry."""
        route_data = {
            "dive_site_id": test_dive_site.id,
            "name": "Invalid Route",
            "description": "A route with invalid geometry",
            "route_data": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[23.5, 37.5, 10.0]]  # Invalid - 3D coordinates
                        },
                        "properties": {"route_type": "scuba"}
                    }
                ]
            },
            "route_type": "scuba"
        }
        
        response = client.post(
            "/api/v1/dive-routes/",
            json=route_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_route_unauthorized(self, client, test_dive_site):
        """Test route creation without authentication."""
        route_data = {
            "dive_site_id": test_dive_site.id,
            "name": "Test Route",
            "description": "A test route",
            "route_data": {
                "type": "FeatureCollection",
                "features": []
            },
            "route_type": "scuba"
        }
        
        response = client.post("/api/v1/dive-routes/", json=route_data)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_routes_by_dive_site(self, client, test_user, test_dive_site, test_route):
        """Test getting routes for a specific dive site."""
        response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}/routes")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == test_route.id
        assert data[0]["name"] == test_route.name

    def test_get_route_by_id(self, client, test_route):
        """Test getting a specific route by ID."""
        response = client.get(f"/api/v1/dive-routes/{test_route.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == test_route.id
        assert data["name"] == test_route.name

    def test_get_route_not_found(self, client):
        """Test getting a non-existent route."""
        response = client.get("/api/v1/dive-routes/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_route_success(self, client, test_user, test_route, auth_headers):
        """Test successful route update."""
        update_data = {
            "name": "Updated Route Name",
            "description": "Updated description"
        }
        
        response = client.put(
            f"/api/v1/dive-routes/{test_route.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Route Name"
        assert data["description"] == "Updated description"

    def test_update_route_unauthorized(self, client, test_route):
        """Test route update without authentication."""
        update_data = {"name": "Unauthorized Update"}
        
        response = client.put(
            f"/api/v1/dive-routes/{test_route.id}",
            json=update_data
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_route_forbidden(self, client, test_route, auth_headers_other_user):
        """Test route update by non-owner."""
        update_data = {"name": "Forbidden Update"}
        
        response = client.put(
            f"/api/v1/dive-routes/{test_route.id}",
            json=update_data,
            headers=auth_headers_other_user
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_soft_delete_route(self, client, test_user, test_route, auth_headers):
        """Test soft deleting a route."""
        response = client.delete(
            f"/api/v1/dive-routes/{test_route.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Route deleted successfully"

    def test_hard_delete_route(self, client, test_user, test_route, auth_headers):
        """Test hard deleting a route."""
        response = client.delete(
            f"/api/v1/dive-routes/{test_route.id}?permanent=true",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Route deleted successfully"

    def test_delete_route_with_associated_dives(self, client, test_user, test_route, test_dive, auth_headers):
        """Test deleting a route that has associated dives."""
        # Associate the dive with the route
        test_dive.selected_route_id = test_route.id
        
        response = client.delete(
            f"/api/v1/dive-routes/{test_route.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Route deleted successfully"

    def test_get_popular_routes(self, client, test_user, test_route, test_dive, db_session):
        """Test getting popular routes."""
        # Associate dive with route to make it popular
        test_dive.selected_route_id = test_route.id
        db_session.commit()  # Commit the association
        
        response = client.get("/api/v1/dive-routes/popular?limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["routes"]) == 1
        assert data["routes"][0]["id"] == test_route.id

    def test_track_route_view(self, client, test_user, test_route, auth_headers):
        """Test tracking route view."""
        response = client.post(
            f"/api/v1/dive-routes/{test_route.id}/view",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Route view tracked successfully"

    def test_copy_route(self, client, test_user, test_route, auth_headers):
        """Test copying a route."""
        new_name = "Copied Route"
        response = client.post(
            f"/api/v1/dive-routes/{test_route.id}/copy?new_name={new_name}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["new_route_name"] == new_name
        assert "new_route_id" in data

    def test_share_route(self, client, test_user, test_route, auth_headers):
        """Test sharing a route."""
        response = client.post(
            f"/api/v1/dive-routes/{test_route.id}/share?share_type=public",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "share_url" in data
        assert str(test_route.id) in data["share_url"]

    def test_get_export_formats(self, client):
        """Test getting available export formats."""
        response = client.get("/api/v1/dive-routes/export-formats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2  # Should have GPX and KML formats
        formats = [item["format"] for item in data]
        assert "gpx" in formats
        assert "kml" in formats

    def test_export_route_gpx(self, client, test_route):
        """Test exporting a route as GPX."""
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/export/gpx")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"].startswith("application/gpx+xml")
        assert "gpx" in response.text.lower()

    def test_export_route_kml(self, client, test_route):
        """Test exporting a route as KML."""
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/export/kml")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"].startswith("application/vnd.google-earth.kml+xml")
        assert "kml" in response.text.lower()

    def test_export_route_invalid_format(self, client, test_route):
        """Test exporting a route with invalid format."""
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/export/invalid")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_community_stats(self, client, test_route, test_dive):
        """Test getting community statistics for a route."""
        # Associate dive with route
        test_dive.selected_route_id = test_route.id
        
        response = client.get(f"/api/v1/dive-routes/{test_route.id}/community-stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "community_stats" in data
        community_stats = data["community_stats"]
        assert "total_dives_using_route" in community_stats
        # Note: total_waypoints is not returned by the API


class TestRouteAnalyticsService:
    """Test route analytics service functionality."""

    def test_track_route_interaction(self, db_session, test_user, test_route):
        """Test tracking route interactions."""
        from app.services.route_analytics_service import RouteAnalyticsService
        
        service = RouteAnalyticsService(db_session)
        
        # Track a view
        result = service.track_interaction(
            route_id=test_route.id,
            interaction_type="view",
            user_id=test_user.id
        )
        
        assert result.route_id == test_route.id
        assert result.user_id == test_user.id
        assert result.interaction_type == "view"
        
        # Verify the interaction was recorded
        analytics = db_session.query(RouteAnalytics).filter(
            RouteAnalytics.route_id == test_route.id,
            RouteAnalytics.user_id == test_user.id,
            RouteAnalytics.interaction_type == "view"
        ).first()
        
        assert analytics is not None
        assert analytics.route_id == test_route.id
        assert analytics.user_id == test_user.id
        assert analytics.interaction_type == "view"

    def test_get_route_analytics(self, db_session, test_user, test_route):
        """Test getting route analytics."""
        from app.services.route_analytics_service import RouteAnalyticsService
        
        service = RouteAnalyticsService(db_session)
        
        # Track some interactions
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "copy", user_id=test_user.id)
        
        # Get analytics
        analytics = service.get_route_analytics(test_route.id)
        
        assert analytics["total_interactions"] == 2
        assert analytics["unique_users"] == 1
        assert "interaction_types" in analytics
        assert analytics["interaction_types"]["view"] == 1
        assert analytics["interaction_types"]["copy"] == 1

    def test_get_user_analytics(self, db_session, test_user, test_route):
        """Test getting user analytics."""
        from app.services.route_analytics_service import RouteAnalyticsService
        
        service = RouteAnalyticsService(db_session)
        
        # Track some interactions
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "share", user_id=test_user.id)
        
        # Get user analytics
        analytics = service.get_user_analytics(test_user.id)
        
        assert analytics["total_interactions"] == 2
        assert analytics["unique_routes"] == 1
        assert "interaction_types" in analytics
        assert analytics["interaction_types"]["view"] == 1
        assert analytics["interaction_types"]["share"] == 1


class TestRouteExportService:
    """Test route export service functionality."""

    def test_export_to_gpx(self, test_route):
        """Test exporting route to GPX format."""
        from app.services.route_export_service import RouteExportService
        
        service = RouteExportService()
        gpx_content = service.export_to_gpx(test_route)
        
        assert gpx_content is not None
        assert "gpx" in gpx_content.lower()
        assert test_route.name in gpx_content

    def test_export_to_kml(self, test_route):
        """Test exporting route to KML format."""
        from app.services.route_export_service import RouteExportService
        
        service = RouteExportService()
        kml_content = service.export_to_kml(test_route)
        
        assert kml_content is not None
        assert "kml" in kml_content.lower()
        assert test_route.name in kml_content

    def test_get_export_formats(self):
        """Test getting available export formats."""
        from app.services.route_export_service import RouteExportService
        
        service = RouteExportService()
        formats = service.get_export_formats()
        
        assert len(formats) == 2
        format_names = [f["format"] for f in formats]
        assert "gpx" in format_names
        assert "kml" in format_names
        
        # Check format details
        gpx_format = next(f for f in formats if f["format"] == "gpx")
        kml_format = next(f for f in formats if f["format"] == "kml")
        assert gpx_format["mime_type"] == "application/gpx+xml"
        assert kml_format["mime_type"] == "application/vnd.google-earth.kml+xml"


class TestDiveRouteModel:
    """Test DiveRoute model functionality."""

    def test_route_creation(self, db_session, test_user, test_dive_site):
        """Test creating a route in the database."""
        route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                    },
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        route = DiveRoute(
            dive_site_id=test_dive_site.id,
            created_by=test_user.id,
            name="Test Route",
            description="A test route",
            route_data=route_data,
            route_type="scuba"
        )
        
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)
        
        assert route.id is not None
        assert route.name == "Test Route"
        assert route.route_type.value == "scuba"
        assert route.deleted_at is None

    def test_soft_delete(self, db_session, test_route, test_user):
        """Test soft deleting a route."""
        test_route.soft_delete(test_user.id)
        db_session.commit()
        
        assert test_route.deleted_at is not None
        assert test_route.deleted_by == test_user.id

    def test_is_deleted(self, db_session, test_route, test_user):
        """Test checking if a route is deleted."""
        assert not test_route.is_deleted
        
        test_route.soft_delete(test_user.id)
        db_session.commit()
        
        assert test_route.is_deleted

    def test_restore(self, db_session, test_route, test_user):
        """Test restoring a soft-deleted route."""
        test_route.soft_delete(test_user.id)
        db_session.commit()
        
        assert test_route.is_deleted
        
        test_route.restore()
        db_session.commit()
        
        assert not test_route.is_deleted
        assert test_route.deleted_at is None
        assert test_route.deleted_by is None



class TestRouteIntegration:
    """Test route integration with other components."""

    def test_route_with_dive_site_relationship(self, test_route, test_dive_site):
        """Test route relationship with dive site."""
        assert test_route.dive_site_id == test_dive_site.id
        assert test_route.dive_site == test_dive_site

    def test_route_with_creator_relationship(self, test_route, test_user):
        """Test route relationship with creator."""
        assert test_route.created_by == test_user.id
        assert test_route.creator == test_user

    def test_dive_with_selected_route(self, test_dive, test_route):
        """Test dive relationship with selected route."""
        test_dive.selected_route_id = test_route.id
        
        assert test_dive.selected_route_id == test_route.id
        assert test_dive.selected_route == test_route

    def test_route_analytics_integration(self, db_session, test_route, test_user):
        """Test route analytics integration."""
        from app.services.route_analytics_service import RouteAnalyticsService
        
        service = RouteAnalyticsService(db_session)
        
        # Track multiple interactions
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "copy", user_id=test_user.id)
        service.track_interaction(test_route.id, "share", user_id=test_user.id)
        
        # Get analytics
        analytics = service.get_route_analytics(test_route.id)
        
        assert analytics["total_interactions"] == 3
        assert analytics["unique_users"] == 1
        assert "interaction_types" in analytics
        assert analytics["interaction_types"]["view"] == 1
        assert analytics["interaction_types"]["copy"] == 1
        assert analytics["interaction_types"]["share"] == 1
