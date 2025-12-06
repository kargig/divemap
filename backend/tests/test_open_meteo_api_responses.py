"""
Tests for Open-Meteo API Response Parsing

Tests actual API response structure parsing, edge cases, and data extraction.
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from freezegun import freeze_time

from app.services.open_meteo_service import fetch_wind_data_single_point


class TestMeteoAPICurrentResponse:
    """Test parsing of current weather API responses."""

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_current_response_complete(self, mock_get):
        """Test parsing complete current weather response."""
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
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.999, 24.999, None)
        
        assert result is not None
        assert result['wind_speed_10m'] == 5.5
        assert result['wind_direction_10m'] == 270.0
        assert result['wind_gusts_10m'] == 7.0
        assert isinstance(result['timestamp'], datetime)

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_current_response_missing_gusts(self, mock_get):
        """Test parsing current response with missing wind gusts."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': 5.5,
                'wind_direction_10m': 270.0,
                # wind_gusts_10m missing
                'time': '2025-11-30T12:00:00Z'
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.888, 24.888, None)
        
        assert result is not None
        assert result['wind_speed_10m'] == 5.5
        assert result['wind_direction_10m'] == 270.0
        assert result['wind_gusts_10m'] is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_current_response_zero_values(self, mock_get):
        """Test parsing current response with zero wind values."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': 0.0,
                'wind_direction_10m': 0.0,
                'wind_gusts_10m': 0.0,
                'time': '2025-11-30T12:00:00Z'
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.777, 24.777, None)
        
        assert result is not None
        assert result['wind_speed_10m'] == 0.0
        assert result['wind_direction_10m'] == 0.0
        assert result['wind_gusts_10m'] == 0.0

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_current_response_high_wind_values(self, mock_get):
        """Test parsing current response with high wind values."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': 25.5,  # Strong wind
                'wind_direction_10m': 180.0,
                'wind_gusts_10m': 30.0,
                'time': '2025-11-30T12:00:00Z'
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.666, 24.666, None)
        
        assert result is not None
        assert result['wind_speed_10m'] == 25.5
        assert result['wind_direction_10m'] == 180.0
        assert result['wind_gusts_10m'] == 30.0


class TestMeteoAPIForecastResponse:
    """Test parsing of hourly forecast API responses."""

    @patch('app.services.open_meteo_service.requests.get')
    @freeze_time("2025-12-01 12:00:00")  # Freeze time to 2 hours before target
    def test_parse_forecast_response_exact_hour(self, mock_get):
        """Test parsing forecast response with exact hour match."""
        # Target datetime is now in the future relative to frozen time
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T12:00', '2025-12-01T13:00', '2025-12-01T14:00', '2025-12-01T15:00'],
                'wind_speed_10m': [5.0, 5.5, 6.0, 6.5],
                'wind_direction_10m': [270.0, 275.0, 280.0, 285.0],
                'wind_gusts_10m': [7.0, 7.5, 8.0, 8.5]
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.555, 24.555, target_datetime)
        
        assert result is not None
        assert result['wind_speed_10m'] == 6.0  # Index 2 (14:00)
        assert result['wind_direction_10m'] == 280.0
        assert result['wind_gusts_10m'] == 8.0

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_forecast_response_hour_not_found(self, mock_get):
        """Test parsing forecast when exact hour is not in response."""
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T12:00', '2025-12-01T15:00'],  # Missing 14:00
                'wind_speed_10m': [5.0, 6.5],
                'wind_direction_10m': [270.0, 285.0],
                'wind_gusts_10m': [7.0, 8.5]
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.444, 24.444, target_datetime)
        
        # Should use first available hour (12:00)
        assert result is not None
        assert result['wind_speed_10m'] == 5.0

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_forecast_response_mismatched_array_lengths(self, mock_get):
        """Test parsing forecast with mismatched array lengths."""
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T14:00'],
                'wind_speed_10m': [6.0, 7.0],  # More values than time
                'wind_direction_10m': [280.0],
                'wind_gusts_10m': [8.0]
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.333, 24.333, target_datetime)
        
        assert result is not None
        assert result['wind_speed_10m'] == 6.0  # First value
        assert result['wind_direction_10m'] == 280.0

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_forecast_response_missing_arrays(self, mock_get):
        """Test parsing forecast with missing wind data arrays."""
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T14:00'],
                # Missing wind_speed_10m, wind_direction_10m, wind_gusts_10m
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.222, 24.222, target_datetime)
        
        assert result is not None
        assert result['wind_speed_10m'] is None
        assert result['wind_direction_10m'] is None
        assert result['wind_gusts_10m'] is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_forecast_response_empty_arrays(self, mock_get):
        """Test parsing forecast with empty wind data arrays."""
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': [],
                'wind_speed_10m': [],
                'wind_direction_10m': [],
                'wind_gusts_10m': []
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.111, 24.111, target_datetime)
        
        assert result is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_parse_forecast_response_index_out_of_bounds(self, mock_get):
        """Test parsing forecast when hour index is out of bounds."""
        target_datetime = datetime(2025, 12, 1, 14, 0, 0)
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'hourly': {
                'time': ['2025-12-01T14:00'],
                'wind_speed_10m': [],  # Empty array
                'wind_direction_10m': [280.0],
                'wind_gusts_10m': [8.0]
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.000, 24.000, target_datetime)
        
        assert result is not None
        assert result['wind_speed_10m'] is None  # Index out of bounds
        assert result['wind_direction_10m'] == 280.0


class TestMeteoAPIResponseEdgeCases:
    """Test edge cases in API response parsing."""

    @patch('app.services.open_meteo_service.requests.get')
    def test_response_neither_current_nor_hourly(self, mock_get, monkeypatch):
        """Test response with neither current nor hourly data."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'latitude': 37.7,
            'longitude': 24.0
            # No 'current' or 'hourly' keys
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.989, 24.989, None)
        
        assert result is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_response_null_values(self, mock_get, monkeypatch):
        """Test response with null/None values."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'current': {
                'wind_speed_10m': None,
                'wind_direction_10m': None,
                'wind_gusts_10m': None,
                'time': '2025-11-30T12:00:00Z'
            }
        }
        mock_get.return_value = mock_response
        
        # Use unique coordinates to avoid cache
        result = fetch_wind_data_single_point(37.878, 24.878, None)
        
        assert result is not None
        assert result['wind_speed_10m'] is None
        assert result['wind_direction_10m'] is None
        assert result['wind_gusts_10m'] is None

    @patch('app.services.open_meteo_service.requests.get')
    def test_response_wind_speed_unit_parameter(self, mock_get, monkeypatch):
        """Test that wind_speed_unit=ms parameter is included in request."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
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
        
        # Use unique coordinates to avoid cache
        fetch_wind_data_single_point(37.767, 24.767, None)
        
        # Verify wind_speed_unit=ms was requested
        assert mock_get.called
        call_args = mock_get.call_args
        assert call_args is not None
        assert 'params' in call_args.kwargs
        assert call_args.kwargs['params']['wind_speed_unit'] == 'ms'

    @patch('app.services.open_meteo_service.requests.get')
    def test_response_timezone_parameter(self, mock_get, monkeypatch):
        """Test that timezone=auto parameter is included in request."""
        import app.services.open_meteo_service as oms
        monkeypatch.setattr(oms, '_wind_cache', {})  # Clear cache
        
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
        
        # Use unique coordinates to avoid cache
        fetch_wind_data_single_point(37.656, 24.656, None)
        
        # Verify timezone=auto was requested
        assert mock_get.called
        call_args = mock_get.call_args
        assert call_args is not None
        assert 'params' in call_args.kwargs
        assert call_args.kwargs['params']['timezone'] == 'auto'

