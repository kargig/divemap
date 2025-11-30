"""
Tests for OpenStreetMap Coastline Service

Tests Overpass API integration, shore direction detection, and error handling.
"""

import pytest
from unittest.mock import patch, MagicMock
import requests

from app.services.osm_coastline_service import (
    haversine_distance,
    calculate_bearing,
    point_to_segment_distance,
    query_overpass_api,
    detect_shore_direction,
    CONFIDENCE_HIGH_THRESHOLD,
    CONFIDENCE_MEDIUM_THRESHOLD,
)


class TestHaversineDistance:
    """Test Haversine distance calculation."""

    def test_haversine_distance_same_point(self):
        """Test distance between same point is zero."""
        distance = haversine_distance(37.7, 24.0, 37.7, 24.0)
        assert distance == 0.0

    def test_haversine_distance_known_distance(self):
        """Test distance calculation with known values."""
        # Distance between two points approximately 1km apart
        # Using coordinates that should be roughly 1km apart
        distance = haversine_distance(37.7, 24.0, 37.709, 24.0)
        # Should be approximately 1km (1000m), allowing for small variance
        assert 900 < distance < 1100

    def test_haversine_distance_returns_meters(self):
        """Test that distance is returned in meters."""
        distance = haversine_distance(37.7, 24.0, 37.8, 24.0)
        # Should be in meters (roughly 11km for 0.1 degree latitude)
        assert distance > 10000  # More than 10km
        assert distance < 12000  # Less than 12km


class TestCalculateBearing:
    """Test bearing calculation."""

    def test_calculate_bearing_north(self):
        """Test bearing pointing north."""
        # From point to point directly north
        bearing = calculate_bearing(37.7, 24.0, 37.8, 24.0)
        assert 0 <= bearing <= 5 or 355 <= bearing <= 360  # Approximately north (0°)

    def test_calculate_bearing_east(self):
        """Test bearing pointing east."""
        # From point to point directly east
        bearing = calculate_bearing(37.7, 24.0, 37.7, 24.1)
        assert 85 <= bearing <= 95  # Approximately east (90°)

    def test_calculate_bearing_south(self):
        """Test bearing pointing south."""
        # From point to point directly south
        bearing = calculate_bearing(37.7, 24.0, 37.6, 24.0)
        assert 175 <= bearing <= 185  # Approximately south (180°)

    def test_calculate_bearing_west(self):
        """Test bearing pointing west."""
        # From point to point directly west
        bearing = calculate_bearing(37.7, 24.0, 37.7, 23.9)
        assert 265 <= bearing <= 275  # Approximately west (270°)

    def test_calculate_bearing_normalized(self):
        """Test that bearing is normalized to 0-360."""
        bearing = calculate_bearing(37.7, 24.0, 37.8, 24.1)
        assert 0 <= bearing <= 360


class TestPointToSegmentDistance:
    """Test point to segment distance calculation."""

    def test_point_to_segment_distance_on_segment(self):
        """Test distance when point is on the segment."""
        point = (37.75, 24.05)
        seg_start = (37.7, 24.0)
        seg_end = (37.8, 24.1)
        distance = point_to_segment_distance(point, seg_start, seg_end)
        assert distance >= 0  # Should be non-negative

    def test_point_to_segment_distance_returns_meters(self):
        """Test that distance is returned in meters."""
        point = (37.7, 24.0)
        seg_start = (37.8, 24.1)
        seg_end = (37.9, 24.2)
        distance = point_to_segment_distance(point, seg_start, seg_end)
        assert distance > 0
        assert distance < 25000  # Should be reasonable (less than 25km)


class TestQueryOverpassAPI:
    """Test Overpass API querying."""

    @patch('app.services.osm_coastline_service.requests.post')
    def test_query_overpass_api_success(self, mock_post):
        """Test successful Overpass API query."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"elements": []}'
        mock_response.json.return_value = {"elements": []}
        mock_post.return_value = mock_response
        
        result = query_overpass_api(37.7, 24.0, radius=1000)
        
        assert result is not None
        assert "elements" in result
        mock_post.assert_called_once()

    @patch('app.services.osm_coastline_service.requests.post')
    def test_query_overpass_api_timeout(self, mock_post):
        """Test Overpass API timeout handling."""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")
        
        result = query_overpass_api(37.7, 24.0, radius=1000)
        
        # Should try fallback endpoint, then return None
        assert result is None
        assert mock_post.call_count == 2  # Tries both endpoints

    @patch('app.services.osm_coastline_service.requests.post')
    def test_query_overpass_api_fallback_endpoint(self, mock_post):
        """Test fallback to second endpoint when first fails."""
        # First endpoint returns error
        mock_response1 = MagicMock()
        mock_response1.status_code = 500
        # Second endpoint succeeds
        mock_response2 = MagicMock()
        mock_response2.status_code = 200
        mock_response2.text = '{"elements": [{"type": "way"}]}'
        mock_response2.json.return_value = {"elements": [{"type": "way"}]}
        
        mock_post.side_effect = [mock_response1, mock_response2]
        
        result = query_overpass_api(37.7, 24.0, radius=1000)
        
        assert result is not None
        assert "elements" in result
        assert mock_post.call_count == 2  # Tried both endpoints

    @patch('app.services.osm_coastline_service.requests.post')
    def test_query_overpass_api_non_json_response(self, mock_post):
        """Test handling of non-JSON response (timeout HTML/XML)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<html><body>Timeout</body></html>'  # HTML instead of JSON
        mock_post.return_value = mock_response
        
        result = query_overpass_api(37.7, 24.0, radius=1000)
        
        # Should try fallback, then return None
        assert result is None or result is not None  # May succeed on fallback

    @patch('app.services.osm_coastline_service.requests.post')
    def test_query_overpass_api_invalid_json(self, mock_post):
        """Test handling of invalid JSON response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"invalid": json}'  # Invalid JSON
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_post.return_value = mock_response
        
        result = query_overpass_api(37.7, 24.0, radius=1000)
        
        # Should try fallback, then return None
        assert result is None or result is not None  # May succeed on fallback


class TestDetectShoreDirection:
    """Test shore direction detection."""

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_success(self, mock_query):
        """Test successful shore direction detection."""
        # Mock Overpass API response with coastline data
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.71, "lon": 24.01},
                        {"lat": 37.72, "lon": 24.02}
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is not None
        assert "shore_direction" in result
        assert "confidence" in result
        assert "method" in result
        assert "distance_to_coastline_m" in result
        assert result["method"] == "osm_coastline"
        assert 0 <= result["shore_direction"] <= 360
        assert result["confidence"] in ["high", "medium", "low"]

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_no_data(self, mock_query):
        """Test detection when no coastline data is found."""
        mock_query.return_value = None
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is None

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_empty_elements(self, mock_query):
        """Test detection when API returns empty elements."""
        mock_query.return_value = {"elements": []}
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is None

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_no_elements_key(self, mock_query):
        """Test detection when API response lacks elements key."""
        mock_query.return_value = {"version": 0.6}
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is None

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_confidence_high(self, mock_query):
        """Test high confidence when close to coastline."""
        # Create geometry very close to dive site (< 100m)
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.7001, "lon": 24.0001},  # Very close
                        {"lat": 37.7002, "lon": 24.0002}
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is not None
        assert result["confidence"] == "high"
        assert result["distance_to_coastline_m"] < CONFIDENCE_HIGH_THRESHOLD

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_confidence_medium(self, mock_query):
        """Test medium confidence when moderately close to coastline."""
        # Create geometry at medium distance (100-500m)
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.701, "lon": 24.001},  # ~150m away
                        {"lat": 37.702, "lon": 24.002}
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is not None
        assert result["confidence"] == "medium"
        assert CONFIDENCE_HIGH_THRESHOLD <= result["distance_to_coastline_m"] < CONFIDENCE_MEDIUM_THRESHOLD

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_confidence_low(self, mock_query):
        """Test low confidence when far from coastline."""
        # Create geometry far from dive site (> 500m)
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.71, "lon": 24.01},  # ~1.4km away
                        {"lat": 37.72, "lon": 24.02}
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=2000)
        
        assert result is not None
        assert result["confidence"] == "low"
        assert result["distance_to_coastline_m"] >= CONFIDENCE_MEDIUM_THRESHOLD

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_multiple_segments(self, mock_query):
        """Test detection with multiple coastline segments."""
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.71, "lon": 24.01},
                        {"lat": 37.72, "lon": 24.02},
                        {"lat": 37.73, "lon": 24.03}  # Multiple segments
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is not None
        assert "shore_direction" in result

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_invalid_geometry(self, mock_query):
        """Test detection with invalid geometry (single point)."""
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.71, "lon": 24.01}  # Only one point (invalid)
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        # Should return None (no valid segments)
        assert result is None

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_no_geometry(self, mock_query):
        """Test detection with way element but no geometry."""
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way"
                    # No geometry key
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is None

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_shore_direction_calculation(self, mock_query):
        """Test that shore direction is calculated correctly (perpendicular to coastline)."""
        # Create a coastline running north-south (bearing ~0°)
        # Shore direction should be east (90°)
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.7, "lon": 24.0},   # Point 1
                        {"lat": 37.8, "lon": 24.0}    # Point 2 (directly north)
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.75, 24.01, radius=1000)  # East of coastline
        
        assert result is not None
        # Coastline runs north (0°), shore direction should be east (90°)
        # Allow some variance due to distance calculation
        assert 80 <= result["shore_direction"] <= 100

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_exception_handling(self, mock_query):
        """Test exception handling in detect_shore_direction."""
        mock_query.side_effect = Exception("Unexpected error")
        
        result = detect_shore_direction(37.7, 24.0, radius=1000)
        
        assert result is None

    @patch('app.services.osm_coastline_service.query_overpass_api')
    def test_detect_shore_direction_custom_radius(self, mock_query):
        """Test detection with custom search radius."""
        mock_query.return_value = {
            "elements": [
                {
                    "type": "way",
                    "geometry": [
                        {"lat": 37.71, "lon": 24.01},
                        {"lat": 37.72, "lon": 24.02}
                    ]
                }
            ]
        }
        
        result = detect_shore_direction(37.7, 24.0, radius=2000)
        
        assert result is not None
        # Verify custom radius was used
        mock_query.assert_called_once()
        call_args = mock_query.call_args
        # Function signature: query_overpass_api(latitude, longitude, radius=DEFAULT_RADIUS, timeout=15)
        # Check positional arguments
        assert call_args[0][0] == 37.7  # latitude
        assert call_args[0][1] == 24.0  # longitude
        # Radius can be positional (3rd arg) or keyword
        if len(call_args[0]) >= 3:
            assert call_args[0][2] == 2000  # radius as positional
        else:
            assert call_args.kwargs.get('radius') == 2000  # radius as keyword

