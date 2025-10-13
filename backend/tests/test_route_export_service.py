"""
Tests for RouteExportService
"""

import pytest
from datetime import datetime

from app.models import DiveRoute, DiveSite, User
from app.services.route_export_service import RouteExportService


class TestRouteExportService:
    """Test cases for RouteExportService"""

    def test_export_to_gpx_success(self, test_route):
        """Test successful GPX export."""
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        assert gpx_content is not None
        assert "<?xml" in gpx_content
        assert "<gpx" in gpx_content
        assert test_route.name in gpx_content

    def test_export_to_gpx_with_waypoints(self, test_route):
        """Test GPX export with waypoint geometry."""
        # Modify route to include waypoints
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [23.5, 37.5]
                    },
                    "properties": {"route_type": "scuba", "name": "Start Point"}
                },
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
        
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        assert gpx_content is not None
        assert "<wpt" in gpx_content
        assert "Start Point" in gpx_content

    def test_export_to_gpx_with_polygon(self, test_route):
        """Test GPX export with polygon geometry."""
        # Modify route to include polygon
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[23.5, 37.5], [23.6, 37.5], [23.6, 37.6], [23.5, 37.6], [23.5, 37.5]]]
                    },
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        assert gpx_content is not None
        assert "<trk" in gpx_content

    def test_export_to_gpx_empty_route(self, test_route):
        """Test GPX export with empty route data."""
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": []
        }
        
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        assert gpx_content is not None
        assert "<gpx" in gpx_content

    def test_export_to_kml_success(self, test_route):
        """Test successful KML export."""
        service = RouteExportService()
        
        kml_content = service.export_to_kml(test_route)
        
        assert kml_content is not None
        assert "<?xml" in kml_content
        assert "<kml" in kml_content
        assert test_route.name in kml_content

    def test_export_to_kml_with_waypoints(self, test_route):
        """Test KML export with waypoint geometry."""
        # Modify route to include waypoints
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [23.5, 37.5]
                    },
                    "properties": {"route_type": "scuba", "name": "Start Point"}
                },
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
        
        service = RouteExportService()
        
        kml_content = service.export_to_kml(test_route)
        
        assert kml_content is not None
        assert "placemark" in kml_content.lower()
        assert "Start Point" in kml_content

    def test_export_to_kml_with_polygon(self, test_route):
        """Test KML export with polygon geometry."""
        # Modify route to include polygon
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[23.5, 37.5], [23.6, 37.5], [23.6, 37.6], [23.5, 37.6], [23.5, 37.5]]]
                    },
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        service = RouteExportService()
        
        kml_content = service.export_to_kml(test_route)
        
        assert kml_content is not None
        assert "polygon" in kml_content.lower()

    def test_export_to_kml_empty_route(self, test_route):
        """Test KML export with empty route data."""
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": []
        }
        
        service = RouteExportService()
        
        kml_content = service.export_to_kml(test_route)
        
        assert kml_content is not None
        assert "kml" in kml_content.lower()

    def test_get_export_formats(self):
        """Test getting available export formats."""
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
        assert gpx_format["file_extension"] == ".gpx"
        assert "GPS Exchange Format" in gpx_format["description"]
        
        assert kml_format["mime_type"] == "application/vnd.google-earth.kml+xml"
        assert kml_format["file_extension"] == ".kml"
        assert "Keyhole Markup Language" in kml_format["description"]

    def test_export_with_metadata(self, test_route):
        """Test export with route metadata."""
        test_route.description = "Test route description"
        test_route.route_type = "scuba"
        
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        assert test_route.description in gpx_content
        # The GPX includes the route name and description, not the route_type field
        assert test_route.name in gpx_content

    def test_export_with_multiple_route_types(self, test_route):
        """Test export with mixed route types."""
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                    },
                    "properties": {"segmentType": "scuba"}
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.6, 37.6], [23.7, 37.7]]
                    },
                    "properties": {"segmentType": "swim"}
                }
            ]
        }
        
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        assert gpx_content is not None
        # The service should include route type information in the output
        assert "scuba" in gpx_content or "swim" in gpx_content

    def test_export_coordinate_precision(self, test_route):
        """Test coordinate precision in export."""
        # Use coordinates with high precision
        test_route.route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.123456789, 37.987654321], [23.234567890, 37.876543210]]
                    },
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        service = RouteExportService()
        
        gpx_content = service.export_to_gpx(test_route)
        
        # Check that coordinates are included with reasonable precision
        assert "23.123" in gpx_content
        assert "37.987" in gpx_content