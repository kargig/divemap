import pytest
from unittest.mock import patch, MagicMock

from app.schemas import DiveRouteCreate, DiveRouteUpdate
from app.models import DiveRoute


class TestRouteValidation:
    """Test route validation functionality."""

    def test_validate_route_data_valid(self):
        """Test validation of valid route data."""
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
        
        # Should not raise an exception when creating DiveRouteCreate
        dive_route = DiveRouteCreate(
            dive_site_id=1,
            name="Test Route",
            description="A test route",
            route_data=route_data,
            route_type="scuba"
        )
        assert dive_route.route_data == route_data

    def test_validate_route_data_invalid_geometry(self):
        """Test validation of invalid route data."""
        route_data = {
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
        }
        
        with pytest.raises(ValueError, match="coordinates must be 2D only"):
            DiveRouteCreate(
                dive_site_id=1,
                name="Test Route",
                description="A test route",
                route_data=route_data,
                route_type="scuba"
            )

    def test_validate_route_data_empty_features(self):
        """Test validation of route data with empty features."""
        route_data = {
            "type": "FeatureCollection",
            "features": []
        }
        
        with pytest.raises(ValueError):
            DiveRouteCreate(
                dive_site_id=1,
                name="Test Route",
                description="A test route",
                route_data=route_data,
                route_type="scuba"
            )

    def test_validate_route_data_multiple_features(self):
        """Test validation of route data with multiple features."""
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
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [23.7, 37.7]
                    },
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        # Should not raise an exception when creating DiveRouteCreate
        dive_route = DiveRouteCreate(
            dive_site_id=1,
            name="Test Route",
            description="A test route",
            route_data=route_data,
            route_type="scuba"
        )
        assert dive_route.route_data == route_data

    def test_validate_route_data_mixed_route_types(self):
        """Test validation of route data with mixed route types."""
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
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.6, 37.6], [23.7, 37.7]]
                    },
                    "properties": {"route_type": "swim"}
                }
            ]
        }
        
        # Should not raise an exception when creating DiveRouteCreate
        dive_route = DiveRouteCreate(
            dive_site_id=1,
            name="Test Route",
            description="A test route",
            route_data=route_data,
            route_type="scuba"
        )
        assert dive_route.route_data == route_data

    def test_validate_route_data_missing_type(self):
        """Test validation of route data missing type."""
        route_data = {
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
        
        with pytest.raises(ValueError):
            DiveRouteCreate(
                dive_site_id=1,
                name="Test Route",
                description="A test route",
                route_data=route_data,
                route_type="scuba"
            )

    def test_validate_route_data_invalid_feature_type(self):
        """Test validation of route data with invalid feature type."""
        route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "InvalidFeature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                    },
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        with pytest.raises(ValueError):
            DiveRouteCreate(
                dive_site_id=1,
                name="Test Route",
                description="A test route",
                route_data=route_data,
                route_type="scuba"
            )

    def test_validate_route_data_missing_geometry(self):
        """Test validation of route data with missing geometry."""
        route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"route_type": "scuba"}
                }
            ]
        }
        
        with pytest.raises(ValueError):
            DiveRouteCreate(
                dive_site_id=1,
                name="Test Route",
                description="A test route",
                route_data=route_data,
                route_type="scuba"
            )

    def test_validate_route_data_missing_properties(self):
        """Test validation of route data with missing properties - should pass."""
        route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                    }
                }
            ]
        }
        
        # Should not raise an exception - properties are not validated
        dive_route = DiveRouteCreate(
            dive_site_id=1,
            name="Test Route",
            description="A test route",
            route_data=route_data,
            route_type="scuba"
        )
        assert dive_route.route_data == route_data

    def test_validate_route_data_invalid_route_type(self):
        """Test validation of route data with invalid route type - should pass."""
        route_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[23.5, 37.5], [23.6, 37.6]]
                    },
                    "properties": {"route_type": "invalid_type"}
                }
            ]
        }
        
        # Should not raise an exception - route_type in properties is not validated
        dive_route = DiveRouteCreate(
            dive_site_id=1,
            name="Test Route",
            description="A test route",
            route_data=route_data,
            route_type="scuba"
        )
        assert dive_route.route_data == route_data

    def test_validate_route_update_valid(self):
        """Test validation of valid route update data."""
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
        
        # Should not raise an exception when creating DiveRouteUpdate
        dive_route_update = DiveRouteUpdate(
            name="Updated Route",
            description="An updated route",
            route_data=route_data,
            route_type="scuba"
        )
        assert dive_route_update.route_data == route_data

    def test_validate_route_update_partial(self):
        """Test validation of partial route update data."""
        # Should not raise an exception when creating DiveRouteUpdate with only name
        dive_route_update = DiveRouteUpdate(
            name="Updated Route Name"
        )
        assert dive_route_update.name == "Updated Route Name"
        assert dive_route_update.description is None
        assert dive_route_update.route_data is None
        assert dive_route_update.route_type is None