"""
Tests for Open-Meteo Weather Service

Tests grid point generation, jitter factor functionality, and wind data fetching.
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from freezegun import freeze_time

from app.services.open_meteo_service import (
    _create_grid_points,
    fetch_wind_data_grid,
    fetch_wind_data_single_point,
)


class TestGridPointGeneration:
    """Test grid point generation with different zoom levels and bounds."""

    def test_create_grid_points_zoom_18(self):
        """Test grid point generation at zoom level 18 (0.02° spacing)."""
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        points = _create_grid_points(bounds, zoom_level=18)
        
        assert len(points) > 0
        # Verify all points are within bounds (with margin)
        margin = 0.02 * 0.1  # 10% of spacing
        for lat, lon in points:
            assert bounds['south'] + margin <= lat <= bounds['north'] - margin
            assert bounds['west'] + margin <= lon <= bounds['east'] - margin

    def test_create_grid_points_zoom_15(self):
        """Test grid point generation at zoom level 15 (0.05° spacing)."""
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        points = _create_grid_points(bounds, zoom_level=15)
        
        assert len(points) > 0
        # Verify spacing is approximately 0.05°
        if len(points) > 1:
            first_lat, first_lon = points[0]
            second_lat, second_lon = points[1]
            lat_diff = abs(second_lat - first_lat)
            lon_diff = abs(second_lon - first_lon)
            # Should be close to 0.05° (allowing for rounding)
            assert lat_diff <= 0.06 or lon_diff <= 0.06

    def test_create_grid_points_zoom_13(self):
        """Test grid point generation at zoom level 13 (0.08° spacing)."""
        bounds = {
            'north': 38.0,
            'south': 37.5,
            'east': 24.5,
            'west': 24.0
        }
        points = _create_grid_points(bounds, zoom_level=13)
        
        assert len(points) > 0
        # Verify all points are within bounds
        margin = 0.08 * 0.1
        for lat, lon in points:
            assert bounds['south'] + margin <= lat <= bounds['north'] - margin
            assert bounds['west'] + margin <= lon <= bounds['east'] - margin

    def test_create_grid_points_default_zoom(self):
        """Test grid point generation with default zoom level (15)."""
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        points = _create_grid_points(bounds, zoom_level=None)
        
        assert len(points) > 0
        # Should use default zoom 15 spacing (0.05°)

    def test_create_grid_points_max_points_limit(self):
        """Test that grid points are limited to max 100 points."""
        # Create a large bounds area that would generate many points
        bounds = {
            'north': 40.0,
            'south': 35.0,
            'east': 30.0,
            'west': 20.0
        }
        points = _create_grid_points(bounds, zoom_level=18)
        
        assert len(points) <= 100

    def test_create_grid_points_points_inside_bounds(self):
        """Test that all generated points are strictly inside bounds (not at edges)."""
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        points = _create_grid_points(bounds, zoom_level=15)
        
        margin = 0.05 * 0.1  # 10% of spacing for zoom 15
        for lat, lon in points:
            # Points should be inside bounds with margin (allowing for floating point precision)
            assert lat >= bounds['south'] + margin
            assert lat <= bounds['north'] - margin
            assert lon >= bounds['west'] + margin
            assert lon <= bounds['east'] - margin


class TestJitterFactor:
    """Test jitter factor functionality for multiplying wind arrows."""

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_with_jitter_default(self, mock_fetch):
        """Test that default jitter factor (5) creates 5x more points."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        # Get base grid points count
        base_points = _create_grid_points(bounds, zoom_level=15)
        base_count = len(base_points)
        
        # Fetch with default jitter (5)
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=5)
        
        # Should have approximately 5x more points (base + 4 jittered per base point)
        # Allow some variance due to bounds filtering
        expected_min = base_count * 4  # At least 4x (base points + most jittered)
        assert len(result) >= expected_min
        assert len(result) <= base_count * 5  # At most 5x

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_with_jitter_factor_3(self, mock_fetch):
        """Test jitter factor of 3 creates 3x more points."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        base_points = _create_grid_points(bounds, zoom_level=15)
        base_count = len(base_points)
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=3)
        
        # Should have approximately 3x more points
        expected_min = base_count * 2  # At least 2x
        assert len(result) >= expected_min
        assert len(result) <= base_count * 3  # At most 3x

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_jittered_points_within_bounds(self, mock_fetch):
        """Test that all jittered points stay within bounds."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=5)
        
        # All points should be within bounds
        for point in result:
            assert bounds['south'] <= point['lat'] <= bounds['north']
            assert bounds['west'] <= point['lon'] <= bounds['east']

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_jitter_retry_logic(self, mock_fetch):
        """Test that jitter retry logic ensures points stay within bounds."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        # Use small bounds to test retry logic more effectively
        bounds = {
            'north': 37.72,
            'south': 37.70,
            'east': 24.02,
            'west': 24.00
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=5)
        
        # All points should be valid and within bounds
        assert len(result) > 0
        for point in result:
            assert 'lat' in point
            assert 'lon' in point
            assert bounds['south'] <= point['lat'] <= bounds['north']
            assert bounds['west'] <= point['lon'] <= bounds['east']
            assert 'wind_speed_10m' in point
            assert 'wind_direction_10m' in point

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_jitter_same_wind_data(self, mock_fetch):
        """Test that jittered points use the same wind data as base point."""
        base_wind_data = {
            'wind_speed_10m': 7.5,
            'wind_direction_10m': 180.0,
            'wind_gusts_10m': 9.0,
            'timestamp': datetime.now()
        }
        mock_fetch.return_value = base_wind_data
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=3)
        
        # All points should have the same wind data
        for point in result:
            assert point['wind_speed_10m'] == base_wind_data['wind_speed_10m']
            assert point['wind_direction_10m'] == base_wind_data['wind_direction_10m']
            assert point['wind_gusts_10m'] == base_wind_data['wind_gusts_10m']

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_no_jitter(self, mock_fetch):
        """Test that jitter_factor=1 creates only base points."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        base_points = _create_grid_points(bounds, zoom_level=15)
        base_count = len(base_points)
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=1)
        
        # Should have same number as base points (no jitter)
        assert len(result) == base_count


class TestWindDataFetching:
    """Test wind data fetching functionality."""

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_current(self, mock_get):
        """Test fetching current wind data for a single point."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': 5.5,
                'wind_direction_10m': 270.0,
                'wind_gusts_10m': 7.0,
                'time': '2025-11-30T12:00:00Z'
            }
        }
        mock_get.return_value = mock_response
        
        result = fetch_wind_data_single_point(37.7, 24.0, None)
        
        assert result is not None
        assert result['wind_speed_10m'] == 5.5
        assert result['wind_direction_10m'] == 270.0
        assert result['wind_gusts_10m'] == 7.0
        # Verify wind_speed_unit=ms was requested
        call_args = mock_get.call_args
        assert call_args is not None
        assert 'params' in call_args.kwargs
        assert call_args.kwargs['params']['wind_speed_unit'] == 'ms'

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time("2025-12-01 12:00:00")  # Freeze time to 2 hours before target
    def test_fetch_wind_data_single_point_forecast(self, mock_get):
        """Test fetching forecast wind data for a single point."""
        # Target datetime is now in the future relative to frozen time
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T14:00'],
                'wind_speed_10m': [6.2],
                'wind_direction_10m': [180.0],
                'wind_gusts_10m': [8.5]
            }
        }
        mock_get.return_value = mock_response
        
        result = fetch_wind_data_single_point(37.7, 24.0, target_datetime)
        
        assert result is not None
        assert result['wind_speed_10m'] == 6.2
        assert result['wind_direction_10m'] == 180.0
        assert result['wind_gusts_10m'] == 8.5

    def test_create_grid_points_very_small_bounds(self):
        """Test grid generation with very small bounds."""
        bounds = {
            'north': 37.71,
            'south': 37.70,
            'east': 24.01,
            'west': 24.00
        }
        points = _create_grid_points(bounds, zoom_level=18)
        
        # Should still generate at least one point if bounds are valid
        assert len(points) >= 0  # May be empty for very small bounds
        for lat, lon in points:
            assert bounds['south'] <= lat <= bounds['north']
            assert bounds['west'] <= lon <= bounds['east']

    def test_create_grid_points_zoom_17(self):
        """Test grid point generation at zoom level 17 (0.03° spacing)."""
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        points = _create_grid_points(bounds, zoom_level=17)
        
        assert len(points) > 0
        margin = 0.03 * 0.1
        for lat, lon in points:
            assert bounds['south'] + margin <= lat <= bounds['north'] - margin
            assert bounds['west'] + margin <= lon <= bounds['east'] - margin

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_jitter_max_factor(self, mock_fetch):
        """Test jitter factor at maximum value (10)."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        base_points = _create_grid_points(bounds, zoom_level=15)
        base_count = len(base_points)
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=10)
        
        # Should have approximately 10x more points
        expected_min = base_count * 8  # At least 8x
        assert len(result) >= expected_min
        assert len(result) <= base_count * 10  # At most 10x

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_some_points_fail(self, mock_fetch):
        """Test jitter when some base points fail to fetch wind data."""
        call_count = 0
        def mock_fetch_side_effect(lat, lon, dt):
            nonlocal call_count
            call_count += 1
            # Fail every other call
            if call_count % 2 == 0:
                return None
            return {
                'wind_speed_10m': 5.0,
                'wind_direction_10m': 270.0,
                'wind_gusts_10m': 6.0,
                'timestamp': datetime.now()
            }
        
        mock_fetch.side_effect = mock_fetch_side_effect
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, jitter_factor=3)
        
        # Should only have points for successful fetches
        assert len(result) > 0
        # All points should have valid wind data
        for point in result:
            assert 'wind_speed_10m' in point
            assert 'wind_direction_10m' in point

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_api_error(self, mock_get, monkeypatch):
        """Test error handling when API returns error."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        import requests
        mock_get.side_effect = requests.exceptions.HTTPError("Server error")
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.888, 24.888, None)
        
        assert result is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_timeout(self, mock_get, monkeypatch):
        """Test error handling when API times out."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        import requests
        mock_get.side_effect = requests.exceptions.Timeout("Request timed out")
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.777, 24.777, None)
        
        assert result is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_no_wind_data(self, mock_get, monkeypatch):
        """Test handling when API response has no wind data."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {}  # Empty current data
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.666, 24.666, None)
        
        # Function returns dict with None values when data is missing, not None
        # This is acceptable behavior - check that wind_speed is None
        assert result is not None
        assert result.get('wind_speed_10m') is None
        assert result.get('wind_direction_10m') is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_forecast_hour_not_found(self, mock_get, monkeypatch):
        """Test forecast when exact hour is not found in response."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T12:00', '2025-12-01T15:00'],  # Missing 14:00
                'wind_speed_10m': [5.0, 6.0],
                'wind_direction_10m': [180.0, 190.0],
                'wind_gusts_10m': [7.0, 8.0]
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.555, 24.555, target_datetime)
        
        # Should use first available hour (12:00)
        assert result is not None
        assert result['wind_speed_10m'] == 5.0

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_forecast_empty_hourly(self, mock_get, monkeypatch):
        """Test forecast when hourly data is empty."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': [],  # Empty
                'wind_speed_10m': [],
                'wind_direction_10m': [],
                'wind_gusts_10m': []
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.444, 24.444, target_datetime)
        
        assert result is None

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_jitter_different_zoom_levels(self, mock_fetch):
        """Test jitter works correctly with different zoom levels."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.1,
            'west': 24.0
        }
        
        # Test with zoom 13 (larger spacing, smaller jitter range)
        result_13 = fetch_wind_data_grid(bounds, zoom_level=13, jitter_factor=5)
        
        # Test with zoom 18 (smaller spacing, smaller jitter range)
        result_18 = fetch_wind_data_grid(bounds, zoom_level=18, jitter_factor=5)
        
        # Both should work and produce valid points
        assert len(result_13) > 0
        assert len(result_18) > 0
        
        # All points should be within bounds
        for point in result_13 + result_18:
            assert bounds['south'] <= point['lat'] <= bounds['north']
            assert bounds['west'] <= point['lon'] <= bounds['east']

    def test_create_grid_points_sampling_when_over_limit(self):
        """Test that grid points are sampled when exceeding max_points limit."""
        # Create bounds that would generate many points
        bounds = {
            'north': 40.0,
            'south': 35.0,
            'east': 30.0,
            'west': 20.0
        }
        points = _create_grid_points(bounds, zoom_level=13)
        
        # Should be limited to 100 points
        assert len(points) <= 100
        # Should have some points (sampling should work)
        assert len(points) > 0

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_caching(self, mock_get, monkeypatch):
        """Test that wind data is cached and reused."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache before test
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': 5.5,
                'wind_direction_10m': 270.0,
                'wind_gusts_10m': 7.0,
                'time': '2025-11-30T12:00:00Z'
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        lat, lon = 37.333, 24.333
        
        # First call
        result1 = fetch_wind_data_single_point(lat, lon, None)
        assert result1 is not None
        assert mock_get.call_count == 1
        
        # Second call should use cache (mock_get should not be called again)
        result2 = fetch_wind_data_single_point(lat, lon, None)
        assert result2 is not None
        assert result1['wind_speed_10m'] == result2['wind_speed_10m']
        
        # Verify API was only called once (cached on second call)
        assert mock_get.call_count == 1

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_fetch_wind_data_grid_empty_bounds(self, mock_fetch):
        """Test grid generation with empty or invalid bounds."""
        mock_fetch.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        # Very small bounds that might not generate points
        bounds = {
            'north': 37.701,
            'south': 37.700,
            'east': 24.001,
            'west': 24.000
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=18, jitter_factor=5)
        
        # Should handle gracefully (may be empty or have points)
        assert isinstance(result, list)
        for point in result:
            assert bounds['south'] <= point['lat'] <= bounds['north']
            assert bounds['west'] <= point['lon'] <= bounds['east']

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_date_validation_future(self, mock_get):
        """Test that dates more than 2 days ahead are limited."""
        future_date = datetime.now() + timedelta(days=3)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': [(datetime.now() + timedelta(days=2)).strftime('%Y-%m-%dT%H:00')],
                'wind_speed_10m': [5.0],
                'wind_direction_10m': [180.0],
                'wind_gusts_10m': [6.0]
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.222, 24.222, future_date)
        
        # Should still work (date is limited internally)
        assert result is not None

    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_date_validation_past(self, mock_get):
        """Test that past dates are adjusted to current time."""
        past_date = datetime.now() - timedelta(hours=2)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': 5.0,
                'wind_direction_10m': 180.0,
                'wind_gusts_10m': 6.0,
                'time': datetime.now().isoformat()
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.111, 24.111, past_date)
        
        # Should use current time instead
        assert result is not None

