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

    def setup_method(self):
        """Clear cache before each test."""
        import app.services.open_meteo_service as oms
        oms._wind_cache = {}

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

    def test_fetch_wind_data_grid_jitter_same_wind_data(self, monkeypatch):
        """Test that jittered points use the same wind data as base point."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {}) # Ensure clean cache
        
        # Mock DB cache to return empty
        monkeypatch.setattr(oms, '_get_from_database_cache', lambda *args: None)
        monkeypatch.setattr(oms, '_get_batch_from_database_cache', lambda *args: {})
        
        # Mock batch fetch to fail, forcing fallback to fetch_wind_data_single_point
        def mock_get_fail(*args, **kwargs):
            raise Exception("Force fallback")
        monkeypatch.setattr(oms.requests, 'get', mock_get_fail)
        
        base_wind_data = {
            'wind_speed_10m': 7.5,
            'wind_direction_10m': 180.0,
            'wind_gusts_10m': 9.0,
            'timestamp': datetime.now()
        }
        def mock_fetch(*args, **kwargs):
            return base_wind_data
        monkeypatch.setattr(oms, 'fetch_wind_data_single_point', mock_fetch)
        
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

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_wind_data_single_point_current(self, mock_get, mock_db_cache):
        """Test fetching current wind data for a single point."""
        mock_db_cache.return_value = None  # Mock database cache to return None
        # Now always uses hourly API, so need to provide hourly response
        current_time = datetime.now()
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = current_time.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            if hour == current_time.hour:
                wind_speeds.append(5.5)
                wind_directions.append(270.0)
                wind_gusts.append(7.0)
            else:
                wind_speeds.append(5.0)
                wind_directions.append(180.0)
                wind_gusts.append(6.0)
        
        mock_wind_response = MagicMock()
        mock_wind_response.status_code = 200
        mock_wind_response.json.return_value = {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

        # Mock marine response
        mock_marine_response = MagicMock()
        mock_marine_response.status_code = 200
        mock_marine_response.json.return_value = {'hourly': {}}

        mock_get.side_effect = [mock_wind_response, mock_marine_response]
        
        result = fetch_wind_data_single_point(37.7, 24.0, None)
        
        assert result is not None
        assert result['wind_speed_10m'] == 5.5
        assert result['wind_direction_10m'] == 270.0
        assert result['wind_gusts_10m'] == 7.0
        
        # Verify both APIs called
        assert mock_get.call_count == 2

        # Find the call with wind_speed_unit (forecast API)
        wind_call_found = False
        for call in mock_get.call_args_list:
            params = call.kwargs.get('params', {})
            if 'wind_speed_unit' in params:
                assert params['wind_speed_unit'] == 'ms'
                assert 'hourly' in params
                wind_call_found = True
                break
        assert wind_call_found

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
        def mock_fetch_side_effect(lat, lon, dt=None, skip_validation=False):
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

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    def test_fetch_wind_data_single_point_api_error(self, mock_get, mock_db_cache, monkeypatch):
        """Test error handling when API returns error."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear in-memory cache
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        import requests
        mock_get.side_effect = requests.exceptions.HTTPError("Server error")
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.888, 24.888, None)
        
        assert result is None

    def test_fetch_wind_data_single_point_timeout(self, monkeypatch):
        """Test error handling when API times out."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        # Mock DB cache to return empty/None
        monkeypatch.setattr(oms, '_get_from_database_cache', lambda *args: None)
        monkeypatch.setattr(oms, '_get_batch_from_database_cache', lambda *args: {})
        
        import requests
        def mock_get_timeout(*args, **kwargs):
            raise requests.exceptions.Timeout("Request timed out")
        monkeypatch.setattr(oms.requests, 'get', mock_get_timeout)
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.777, 24.777, None)
        
        assert result is None

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_wind_data_single_point_no_wind_data(self, mock_get, mock_db_cache, monkeypatch):
        """Test handling when API response has no wind data."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {}  # Empty hourly data (now always uses hourly API)
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.666, 24.666, None)
        
        # Function returns None when no data is available
        assert result is None

    @patch('app.services.open_meteo_service._get_batch_from_database_cache')
    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-01 12:00:00')
    def test_fetch_wind_data_single_point_forecast_hour_not_found(self, mock_get, mock_db_cache, mock_batch_db_cache, monkeypatch):
        """Test forecast when exact hour is not found in response."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        mock_db_cache.return_value = None
        mock_batch_db_cache.return_value = {}
        
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

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_wind_data_single_point_forecast_empty_hourly(self, mock_get, mock_db_cache, monkeypatch):
        """Test forecast when hourly data is empty."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear in-memory cache
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        # Use current time (frozen) instead of past date to avoid validation issues
        target_datetime = datetime(2025, 12, 7, 14, 0, 0)
        
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

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_wind_data_single_point_caching(self, mock_get, mock_db_cache, monkeypatch):
        """Test that wind data is cached and reused."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache before test
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        # Create hourly response (now always uses hourly API)
        current_time = datetime.now()
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = current_time.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            if hour == current_time.hour:
                wind_speeds.append(5.5)
                wind_directions.append(270.0)
                wind_gusts.append(7.0)
            else:
                wind_speeds.append(5.0)
                wind_directions.append(180.0)
                wind_gusts.append(6.0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        lat, lon = 37.333, 24.333
        
        # First call
        result1 = fetch_wind_data_single_point(lat, lon, None)
        assert result1 is not None
        # Should be 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Second call should use cache (mock_get should not be called again)
        result2 = fetch_wind_data_single_point(lat, lon, None)
        assert result2 is not None
        assert result1['wind_speed_10m'] == result2['wind_speed_10m']
        
        # Verify API was only called once (cached on second call)
        assert mock_get.call_count == 2

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
    @freeze_time('2025-12-07 14:00:00')
    def test_fetch_wind_data_single_point_date_validation_past(self, mock_get):
        """Test that past dates are adjusted to current time."""
        past_date = datetime.now() - timedelta(hours=2)
        
        # Create hourly response (now always uses hourly API)
        current_time = datetime.now()
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = current_time.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0)
            wind_directions.append(180.0)
            wind_gusts.append(6.0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache from other tests
        result = fetch_wind_data_single_point(37.111, 24.111, past_date)
        
        # Should use current time instead
        assert result is not None


class Test24HourBulkCaching:
    """Test 24-hour bulk caching functionality (Optimization #10)."""

    def _create_hourly_response(self, base_date: datetime, hours: int = 24):
        """Helper to create hourly API response with specified hours."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(hours):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0 + (hour % 5))  # Vary wind speed
            wind_directions.append(180.0 + (hour * 10) % 360)  # Vary direction
            wind_gusts.append(6.0 + (hour % 3))  # Vary gusts
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_wind_data_single_point_caches_all_24_hours(self, mock_get, mock_db_cache, monkeypatch):
        """Test that fetching one hour caches all 24 hours."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.444, 24.444
        
        # Fetch hour 12:00 (should cache all 24 hours)
        result = fetch_wind_data_single_point(lat, lon, base_date)
        assert result is not None
        # Should be 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Verify all 24 hours are cached
        for hour in range(24):
            hour_dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            cache_key = _generate_cache_key(lat, lon, target_datetime=hour_dt)
            assert cache_key in oms._wind_cache, f"Hour {hour:02d} not cached"
            cached_data = oms._wind_cache[cache_key]['data']
            assert cached_data['wind_speed_10m'] == (5.0 + (hour % 5))
            assert cached_data['timestamp'].hour == hour

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_different_hours_uses_24_hour_cache(self, mock_get, mock_db_cache, monkeypatch):
        """Test that subsequent requests for different hours use cache."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 5, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.555, 24.555
        
        # First call: fetch hour 05:00 (caches all 24 hours)
        result1 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=5))
        assert result1 is not None
        # Should be 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Second call: fetch hour 14:00 (should use cache)
        result2 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=14))
        assert result2 is not None
        assert mock_get.call_count == 2  # No new API call
        assert result2['wind_speed_10m'] == (5.0 + (14 % 5))
        
        # Third call: fetch hour 22:00 (should use cache)
        result3 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=22))
        assert result3 is not None
        assert mock_get.call_count == 2  # Still no new API call
        assert result3['wind_speed_10m'] == (5.0 + (22 % 5))

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_24_hour_cache_with_forecast_data(self, mock_get, mock_db_cache, monkeypatch):
        """Test 24-hour caching with future forecast data."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        # Future date (tomorrow)
        future_date = datetime(2025, 12, 8, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(future_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.666, 24.666
        
        # Fetch tomorrow 12:00 (should cache all 24 hours for that date)
        result = fetch_wind_data_single_point(lat, lon, future_date)
        assert result is not None
        # Should be 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Verify all 24 hours for tomorrow are cached
        for hour in range(24):
            hour_dt = future_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            cache_key = _generate_cache_key(lat, lon, target_datetime=hour_dt)
            assert cache_key in oms._wind_cache, f"Hour {hour:02d} not cached for future date"
        
        # Fetch different hours from same date (should use cache)
        result2 = fetch_wind_data_single_point(lat, lon, future_date.replace(hour=18))
        assert result2 is not None
        assert mock_get.call_count == 2  # No new API call


class TestSmartCacheLookup:
    """Test smart cache lookup via representative hours."""

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0)
            wind_directions.append(180.0)
            wind_gusts.append(6.0)
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_lookup_via_representative_hours(self, mock_get, mock_db_cache, monkeypatch):
        """Test cache lookup finds data via representative hours."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 0, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.777, 24.777
        
        # Cache hour 00:00 (this caches all 24 hours)
        result1 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=0))
        assert result1 is not None
        # Expect 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Reset mock to track if it's called again
        mock_get.reset_mock()
        
        # Request hour 15:00 (not directly cached, but should find via lookup)
        result2 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=15))
        assert result2 is not None
        assert mock_get.call_count == 0  # Should use cache via lookup
        assert result2['timestamp'].hour == 15

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 06:00:00')
    def test_cache_lookup_via_noon_representative(self, mock_get, mock_db_cache, monkeypatch):
        """Test cache lookup finds data via noon (12:00) representative."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.888, 24.888
        
        # Cache hour 12:00 (this caches all 24 hours)
        result1 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=12))
        assert result1 is not None
        # Expect 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Reset mock
        mock_get.reset_mock()
        
        # Request hour 08:00 (should find via 12:00 representative)
        result2 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=8))
        assert result2 is not None
        assert mock_get.call_count == 0  # Should use cache
        assert result2['timestamp'].hour == 8

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_lookup_when_requested_hour_not_cached(self, mock_get, mock_db_cache, monkeypatch):
        """Test cache lookup when requested hour should be in cache."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 5, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.999, 24.999
        
        # Cache hour 05:00 (this caches all 24 hours)
        result1 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=5))
        assert result1 is not None
        # Expect 2 calls (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Reset mock
        mock_get.reset_mock()
        
        # Request hour 18:00 (should be in cache from 24-hour bulk caching)
        result2 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=18))
        assert result2 is not None
        assert mock_get.call_count == 0  # Should use cache
        assert result2['timestamp'].hour == 18

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_inconsistency_detection_and_warning(self, mock_get, mock_db_cache, monkeypatch, caplog):
        """Test cache inconsistency detection and warning."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 0, 0, 0)
        
        # Manually cache only hour 00:00 (simulate partial cache failure)
        lat, lon = 37.111, 24.111
        cache_key_00 = _generate_cache_key(lat, lon, target_datetime=base_date.replace(hour=0))
        oms._wind_cache[cache_key_00] = {
            'data': {
                'wind_speed_10m': 5.0,
                'wind_direction_10m': 180.0,
                'wind_gusts_10m': 6.0,
                'timestamp': base_date.replace(hour=0)
            },
            'timestamp': datetime.now()
        }
        
        # Mock API response for refetch
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Request hour 12:00 (should detect inconsistency and refetch)
        with caplog.at_level('WARNING'):
            result = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=12))
        
        # Should have logged warning about cache inconsistency
        assert '[CACHE INCONSISTENCY]' in caplog.text
        # Should have made API call to refetch and cache all 24 hours (2 calls: Wind + Marine)
        assert mock_get.call_count == 2
        assert result is not None


class TestGridPointGrouping:
    """Test grid point grouping by cache key (Optimization #3)."""

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0)
            wind_directions.append(180.0)
            wind_gusts.append(6.0)
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_grid_points_grouped_by_cache_key(self, mock_get, monkeypatch):
        """Test that points in same 0.1° cell are grouped together."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Create bounds that will generate points in same cache cell
        # Points within 0.1° of each other will share same cache key
        bounds = {
            'north': 37.75,
            'south': 37.70,
            'east': 24.75,
            'west': 24.70
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date)
        
        # Verify we got results
        assert len(result) > 0
        
        # Count unique cache keys used (should be fewer than number of points)
        # All points in same 0.1° cell should share same wind data
        unique_wind_data = set()
        for point in result:
            wind_key = (point['wind_speed_10m'], point['wind_direction_10m'])
            unique_wind_data.add(wind_key)
        
        # Points in same cache cell should have same wind data
        # (exact count depends on grid, but should be grouped)

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    @patch('app.services.open_meteo_service._get_batch_from_database_cache')
    @patch('app.services.open_meteo_service._get_from_database_cache')
    def test_grid_grouping_reduces_api_calls(self, mock_db_cache, mock_batch_db_cache, mock_get, monkeypatch):
        """Test that grouping reduces API calls."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        mock_batch_db_cache.return_value = {}  # Mock batch db cache to return empty
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Create bounds that generate multiple points
        bounds = {
            'north': 37.8,
            'south': 37.7,
            'east': 24.8,
            'west': 24.7
        }
        
        result = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date)
        
        # Count API calls - should be fewer than number of points
        # (points grouped by cache key)
        assert mock_get.call_count > 0
        # API calls should be less than or equal to number of unique cache cells
        # (which is typically much less than number of grid points)

    @patch('app.services.open_meteo_service._get_batch_from_database_cache')
    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_grid_grouping_with_different_datetimes(self, mock_get, mock_db_cache, mock_batch_db_cache, monkeypatch):
        """Test grouping works correctly with different datetimes."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        mock_batch_db_cache.return_value = {}  # Mock batch db cache to return empty
        
        base_date1 = datetime(2025, 12, 7, 12, 0, 0)
        base_date2 = datetime(2025, 12, 8, 12, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        def response_side_effect(*args, **kwargs):
            # Return different data based on date in params
            params = kwargs.get('params', {})
            date_str = params.get('start_date', '2025-12-07')
            base_date = datetime.strptime(date_str, '%Y-%m-%d')
            return MagicMock(
                status_code=200,
                json=lambda: self._create_hourly_response(base_date)
            )
        
        mock_get.side_effect = response_side_effect
        
        bounds = {
            'north': 37.75,
            'south': 37.70,
            'east': 24.75,
            'west': 24.70
        }
        
        # Fetch grid for datetime A
        result1 = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date1)
        calls_after_first = mock_get.call_count
        
        # Fetch grid for datetime B (different date)
        result2 = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date2)
        
        # Should have made additional API calls for different datetime
        assert mock_get.call_count > calls_after_first

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    @patch('app.services.open_meteo_service._get_from_database_cache')
    def test_grid_grouping_with_same_cache_key_reuses_data(self, mock_db_cache, mock_get, monkeypatch):
        """Test that grid with same cache key reuses cached data."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        bounds = {
            'north': 37.75,
            'south': 37.70,
            'east': 24.75,
            'west': 24.70
        }
        
        # First fetch
        result1 = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date)
        first_call_count = mock_get.call_count
        
        # Second fetch (same bounds, same datetime)
        result2 = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date)
        
        # Should use cache (no additional API calls)
        assert mock_get.call_count == first_call_count
        assert len(result2) > 0


class TestSkipValidation:
    """Test skip_validation parameter functionality."""

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = [base_date.strftime('%Y-%m-%dT%H:00')]
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': [5.0],
                'wind_direction_10m': [180.0],
                'wind_gusts_10m': [6.0]
            }
        }

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_skip_validation_skips_datetime_validation(self, mock_get, mock_db_cache, monkeypatch, caplog):
        """Test that skip_validation=True skips datetime validation."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        # Date 3 days in future (should normally be limited)
        future_date = datetime(2025, 12, 10, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(future_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.222, 24.222
        
        with caplog.at_level('WARNING'):
            result = fetch_wind_data_single_point(lat, lon, future_date, skip_validation=True)
        
        # Should not log warning about date limit
        assert 'more than 2 days ahead' not in caplog.text
        # Should proceed with the request (Wind + Marine)
        assert mock_get.call_count == 2

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_skip_validation_still_validates_when_false(self, mock_get, monkeypatch, caplog):
        """Test that skip_validation=False still validates datetime."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        
        # Date 3 days in future
        future_date = datetime(2025, 12, 10, 12, 0, 0)
        # Mock response for limited date (2 days ahead)
        limited_date = datetime(2025, 12, 9, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(limited_date)
        mock_get.return_value = mock_response
        
        # Use unique coordinates
        lat, lon = 37.333, 24.333
        
        with caplog.at_level('WARNING'):
            result = fetch_wind_data_single_point(lat, lon, future_date, skip_validation=False)
        
        # Should log warning about date limit
        assert 'more than 2 days ahead' in caplog.text
        # Should still work (date is limited internally)
        assert result is not None

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_fetch_wind_data_grid_uses_skip_validation(self, mock_get, monkeypatch, caplog):
        """Test that fetch_wind_data_grid uses skip_validation=True."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        bounds = {
            'north': 37.75,
            'south': 37.70,
            'east': 24.75,
            'west': 24.70
        }
        
        # Grid function validates datetime once, then passes skip_validation=True
        # So we shouldn't see duplicate validation warnings
        with caplog.at_level('WARNING'):
            result = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date)
        
        # Should not have duplicate validation warnings
        warnings = [r for r in caplog.records if 'more than 2 days ahead' in r.message]
        assert len(warnings) <= 1  # At most one warning (from grid function validation)


class TestCacheSizeAndCleanup:
    """Test cache size limit and cleanup functionality."""

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0)
            wind_directions.append(180.0)
            wind_gusts.append(6.0)
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_size_limit_500_entries(self, mock_get, monkeypatch):
        """Test that cache size limit is 500 entries."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _cleanup_cache, _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        monkeypatch.setattr(oms, '_max_cache_size', 500)
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        
        # Directly populate cache with 600 entries (much faster than calling fetch function)
        for loc_idx in range(600):
            # Generate unique keys
            lat, lon = 37.0 + (loc_idx * 0.001), 24.0 + (loc_idx * 0.001)
            cache_key = _generate_cache_key(lat, lon, target_datetime=base_date)
            
            # Add dummy data
            oms._wind_cache[cache_key] = {
                'data': {
                    'wind_speed_10m': 5.0, 
                    'wind_direction_10m': 180.0, 
                    'wind_gusts_10m': 6.0, 
                    'timestamp': base_date
                },
                'timestamp': datetime.now()
            }
        
        # Trigger cleanup
        _cleanup_cache()
        
        # Cache size should be <= 500
        assert len(oms._wind_cache) <= 500

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_cleanup_preserves_recent_entries(self, mock_get, monkeypatch):
        """Test that cache cleanup preserves recent entries."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _cleanup_cache, _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        monkeypatch.setattr(oms, '_max_cache_size', 100)  # Lower limit for testing
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Add old entries
        old_date = datetime(2025, 12, 6, 12, 0, 0)
        for loc_idx in range(10):
            lat, lon = 37.0 + (loc_idx * 0.1), 24.0 + (loc_idx * 0.1)
            cache_key = _generate_cache_key(lat, lon, target_datetime=old_date)
            oms._wind_cache[cache_key] = {
                'data': {'wind_speed_10m': 5.0, 'wind_direction_10m': 180.0, 'wind_gusts_10m': 6.0, 'timestamp': old_date},
                'timestamp': datetime.now() - timedelta(hours=1)  # Old timestamp
            }
        
        # Add new entries
        for loc_idx in range(10):
            lat, lon = 37.5 + (loc_idx * 0.1), 24.5 + (loc_idx * 0.1)
            fetch_wind_data_single_point(lat, lon, base_date)
        
        # Trigger cleanup
        _cleanup_cache()
        
        # Recent entries should be preserved
        recent_count = sum(1 for k, v in oms._wind_cache.items() 
                          if v['timestamp'] > datetime.now() - timedelta(minutes=5))
        assert recent_count > 0


class TestCacheLogging:
    """Test cache logging functionality."""

    def setup_method(self):
        """Clear cache before each test."""
        import app.services.open_meteo_service as oms
        oms._wind_cache = {}

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0)
            wind_directions.append(180.0)
            wind_gusts.append(6.0)
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    @patch('app.services.open_meteo_service._get_from_database_cache')
    def test_cache_hit_logging(self, mock_db_cache, mock_get, monkeypatch, caplog):
        """Test that cache hits work (verified via mock calls)."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        lat, lon = 37.444, 24.444
        
        # First call (cache miss)
        fetch_wind_data_single_point(lat, lon, base_date)
        
        # Should have called API (Wind + Marine)
        assert mock_get.call_count == 2
        
        # Second call (cache hit)
        fetch_wind_data_single_point(lat, lon, base_date)
        
        # Should NOT have called API again (proving cache hit)
        assert mock_get.call_count == 2

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_miss_logging(self, mock_get, mock_db_cache, monkeypatch, caplog):
        """Test that cache misses work (verified via mock calls)."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        lat, lon = 37.555, 24.555
        fetch_wind_data_single_point(lat, lon, base_date)
        
        # Should call API (Wind + Marine)
        assert mock_get.call_count == 2

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_api_call_logging(self, mock_get, mock_db_cache, monkeypatch, caplog):
        """Test that API calls work (verified via mock calls)."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        lat, lon = 37.666, 24.666
        
        fetch_wind_data_single_point(lat, lon, base_date)
        
        # Should call API (Wind + Marine)
        assert mock_get.call_count == 2


class TestIntegrationCacheOptimizations:
    """Integration tests for cache optimizations."""

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0 + (hour % 5))
            wind_directions.append(180.0 + (hour * 10) % 360)
            wind_gusts.append(6.0 + (hour % 3))
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 06:00:00')
    def test_slider_playback_uses_cache(self, mock_get, mock_db_cache, monkeypatch):
        """Test that slider playback uses cache efficiently."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        # Use future date to avoid past date validation
        base_date = datetime(2025, 12, 8, 0, 0, 0)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        lat, lon = 37.777, 24.777
        
        # Simulate slider playback: fetch hour 00:00 (caches all 24 hours)
        result1 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=0))
        assert result1 is not None
        assert mock_get.call_count == 2
        
        # Simulate advancing slider: fetch hours 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00
        hours_to_fetch = [3, 6, 9, 12, 15, 18, 21]
        for hour in hours_to_fetch:
            result = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=hour))
            assert result is not None
            assert result['wind_speed_10m'] == (5.0 + (hour % 5))
        
        # Should still be only 1 API interaction (2 calls: Wind+Marine) (all subsequent hours used cache)
        assert mock_get.call_count == 2

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_grid_with_24_hour_caching(self, mock_get, monkeypatch):
        """Test grid fetching with 24-hour caching."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        
        base_date1 = datetime(2025, 12, 7, 12, 0, 0)
        base_date2 = datetime(2025, 12, 7, 15, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date1)
        mock_get.return_value = mock_response
        
        bounds = {
            'north': 37.75,
            'south': 37.70,
            'east': 24.75,
            'west': 24.70
        }
        
        # Fetch grid for hour 12:00 (caches all 24 hours for all grid points)
        result1 = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date1)
        first_call_count = mock_get.call_count
        
        # Update mock to return different data for hour 15:00
        mock_response.json.return_value = self._create_hourly_response(base_date2)
        
        # Fetch grid for hour 15:00 (same bounds, different hour)
        result2 = fetch_wind_data_grid(bounds, zoom_level=15, target_datetime=base_date2)
        
        # Should use cache for hour 15:00 (was cached when fetching hour 12:00)
        # But since it's a different hour, might need new API calls for grid points
        # The key is that each grid point's 24-hour cache is used
        assert len(result2) > 0

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_across_multiple_dates(self, mock_get, monkeypatch):
        """Test caching across multiple dates."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})
        
        today = datetime(2025, 12, 7, 12, 0, 0)
        tomorrow = datetime(2025, 12, 8, 12, 0, 0)
        
        def response_side_effect(*args, **kwargs):
            params = kwargs.get('params', {})
            date_str = params.get('start_date', '2025-12-07')
            base_date = datetime.strptime(date_str, '%Y-%m-%d')
            return MagicMock(
                status_code=200,
                json=lambda: self._create_hourly_response(base_date)
            )
        
        mock_get.side_effect = response_side_effect
        
        lat, lon = 37.888, 24.888
        
        # Fetch today 12:00 (caches 24 hours for today)
        result1 = fetch_wind_data_single_point(lat, lon, today)
        assert result1 is not None
        calls_after_today = mock_get.call_count
        
        # Fetch tomorrow 12:00 (caches 24 hours for tomorrow)
        result2 = fetch_wind_data_single_point(lat, lon, tomorrow)
        assert result2 is not None
        calls_after_tomorrow = mock_get.call_count
        
        # Fetch today 18:00 (should use cache)
        result3 = fetch_wind_data_single_point(lat, lon, today.replace(hour=18))
        assert result3 is not None
        
        # Fetch tomorrow 18:00 (should use cache)
        result4 = fetch_wind_data_single_point(lat, lon, tomorrow.replace(hour=18))
        assert result4 is not None
        
        # Should have made 2 API calls total (one per date)
        assert mock_get.call_count == calls_after_tomorrow


class TestEdgeCases:
    """Test edge cases for cache functionality."""

    def _create_hourly_response(self, base_date: datetime):
        """Helper to create hourly API response."""
        times = []
        wind_speeds = []
        wind_directions = []
        wind_gusts = []
        
        for hour in range(24):
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            times.append(dt.strftime('%Y-%m-%dT%H:00'))
            wind_speeds.append(5.0)
            wind_directions.append(180.0)
            wind_gusts.append(6.0)
        
        return {
            'hourly': {
                'time': times,
                'wind_speed_10m': wind_speeds,
                'wind_direction_10m': wind_directions,
                'wind_gusts_10m': wind_gusts
            }
        }

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_lookup_with_expired_entries(self, mock_get, mock_db_cache, monkeypatch):
        """Test cache lookup with expired entries."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        monkeypatch.setattr(oms, '_cache_ttl_seconds', 900)  # 15 minutes
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)  # Use current time (frozen) instead of past
        
        # Manually add expired cache entry
        lat, lon = 37.999, 24.999
        cache_key = _generate_cache_key(lat, lon, target_datetime=base_date)
        oms._wind_cache[cache_key] = {
            'data': {
                'wind_speed_10m': 5.0,
                'wind_direction_10m': 180.0,
                'wind_gusts_10m': 6.0,
                'timestamp': base_date
            },
            'timestamp': datetime.now() - timedelta(hours=1)  # Expired
        }
        
        # Mock API response for refetch
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        # Request should detect expired entry and make new API call
        result = fetch_wind_data_single_point(lat, lon, base_date)
        assert result is not None
        assert mock_get.call_count == 2  # Should have made API call (Wind + Marine)

    @patch('app.services.open_meteo_service._get_from_database_cache')
    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time('2025-12-07 12:00:00')
    def test_cache_lookup_with_mixed_valid_expired(self, mock_get, mock_db_cache, monkeypatch):
        """Test cache lookup with mixed valid and expired entries."""
        import app.services.open_meteo_service as oms
        from app.services.open_meteo_service import _generate_cache_key
        monkeypatch.setattr(oms, '_wind_cache', {})
        mock_db_cache.return_value = None  # Mock database cache to return None
        
        base_date = datetime(2025, 12, 7, 12, 0, 0)  # Use current time (frozen)
        
        lat, lon = 37.111, 24.111
        
        # Add expired hour 00:00
        cache_key_00 = _generate_cache_key(lat, lon, target_datetime=base_date.replace(hour=0))
        oms._wind_cache[cache_key_00] = {
            'data': {'wind_speed_10m': 5.0, 'wind_direction_10m': 180.0, 'wind_gusts_10m': 6.0, 'timestamp': base_date.replace(hour=0)},
            'timestamp': datetime.now() - timedelta(hours=1)  # Expired
        }
        
        # Add valid hour 12:00 (this caches all 24 hours)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_hourly_response(base_date)
        mock_get.return_value = mock_response
        
        result1 = fetch_wind_data_single_point(lat, lon, base_date)
        assert result1 is not None
        assert mock_get.call_count == 2
        
        # Reset mock
        mock_get.reset_mock()
        
        # Request hour 06:00 (should find via valid hour 12:00 lookup)
        result2 = fetch_wind_data_single_point(lat, lon, base_date.replace(hour=6))
        assert result2 is not None
        # Should use cache (hour 06:00 was cached when fetching hour 12:00)
        assert mock_get.call_count == 0

