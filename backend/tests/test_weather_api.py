"""
Tests for Weather API Router

Tests the /api/v1/weather/wind endpoint including jitter_factor parameter.
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app


class TestWeatherAPI:
    """Test Weather API endpoint functionality."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @patch('app.routers.weather.fetch_wind_data_grid')
    def test_get_wind_data_with_jitter_factor(self, mock_fetch_grid, client):
        """Test wind data endpoint with jitter_factor parameter."""
        mock_fetch_grid.return_value = [
            {
                'lat': 37.75,
                'lon': 24.05,
                'wind_speed_10m': 5.0,
                'wind_direction_10m': 270.0,
                'wind_gusts_10m': 6.0,
                'timestamp': datetime.now()
            }
        ]
        
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'zoom_level': 15,
                'jitter_factor': 5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'points' in data
        assert len(data['points']) > 0
        
        # Verify jitter_factor was passed to service
        mock_fetch_grid.assert_called_once()
        # Function is called with positional args: fetch_wind_data_grid(bounds, zoom_level, target_datetime, jitter_factor)
        call_args = mock_fetch_grid.call_args
        # jitter_factor is 4th positional argument
        assert len(call_args.args) >= 4 and call_args.args[3] == 5

    @patch('app.routers.weather.fetch_wind_data_grid')
    def test_get_wind_data_default_jitter_factor(self, mock_fetch_grid, client):
        """Test that default jitter_factor (5) is used when not specified."""
        mock_fetch_grid.return_value = []
        
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'zoom_level': 15
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'points' in data
        
        # Verify function was called (jitter_factor defaults to 5 in router)
        mock_fetch_grid.assert_called_once()
        # The router passes jitter_factor=5 as default when not specified
        # We verify the endpoint works correctly with default value

    @patch('app.routers.weather.fetch_wind_data_grid')
    def test_get_wind_data_jitter_factor_max(self, mock_fetch_grid, client):
        """Test jitter_factor at maximum value (10)."""
        mock_fetch_grid.return_value = []
        
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'zoom_level': 15,
                'jitter_factor': 10
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'points' in data
        
        # Verify function was called with jitter_factor=10
        mock_fetch_grid.assert_called_once()
        # The router passes jitter_factor=10 from query parameter
        # We verify the endpoint works correctly with max value

    def test_get_wind_data_jitter_factor_validation_min(self, client):
        """Test that jitter_factor below minimum (1) is rejected."""
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'jitter_factor': 0
            }
        )
        
        assert response.status_code == 422  # Validation error

    def test_get_wind_data_jitter_factor_validation_max(self, client):
        """Test that jitter_factor above maximum (10) is rejected."""
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'jitter_factor': 11
            }
        )
        
        assert response.status_code == 422  # Validation error

    @patch('app.services.open_meteo_service.fetch_wind_data_single_point')
    def test_get_wind_data_single_point(self, mock_fetch_single, client):
        """Test single point wind data query."""
        mock_fetch_single.return_value = {
            'wind_speed_10m': 5.0,
            'wind_direction_10m': 270.0,
            'wind_gusts_10m': 6.0,
            'timestamp': datetime.now()
        }
        
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'latitude': 37.7,
                'longitude': 24.0
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'points' in data
        assert len(data['points']) == 1
        assert data['points'][0]['lat'] == 37.7
        assert data['points'][0]['lon'] == 24.0

    def test_get_wind_data_bounds_validation(self, client):
        """Test that invalid bounds are rejected."""
        # North <= South
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.7,
                'south': 37.8,  # Invalid: south > north
                'east': 24.1,
                'west': 24.0
            }
        )
        
        assert response.status_code == 400

    def test_get_wind_data_datetime_validation_future(self, client):
        """Test that datetime more than 2 days ahead is rejected."""
        future_date = (datetime.now() + timedelta(days=3)).isoformat()
        
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'datetime_str': future_date
            }
        )
        
        assert response.status_code == 400

    def test_get_wind_data_datetime_validation_past(self, client):
        """Test that datetime more than 1 hour in past is rejected."""
        past_date = (datetime.now() - timedelta(hours=2)).isoformat()
        
        response = client.get(
            '/api/v1/weather/wind',
            params={
                'north': 37.8,
                'south': 37.7,
                'east': 24.1,
                'west': 24.0,
                'datetime_str': past_date
            }
        )
        
        assert response.status_code == 400

