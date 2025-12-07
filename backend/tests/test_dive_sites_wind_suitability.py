"""
Tests for Dive Sites Wind Suitability Filtering

Tests the wind suitability filtering functionality in the get_dive_sites endpoint.
"""

import pytest
from fastapi import status
from unittest.mock import patch
from app.models import DiveSite


class TestDiveSitesWindSuitabilityFilter:
    """Test wind suitability filtering in get_dive_sites endpoint."""

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_suitability_filter_valid_good(self, mock_fetch_wind, client, db_session):
        """Test filtering by wind_suitability='good'."""
        # Create dive sites with different shore directions
        site1 = DiveSite(
            name="Site Good Conditions",
            description="Site with good wind conditions",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0  # East-facing shore
        )
        site2 = DiveSite(
            name="Site Bad Conditions",
            description="Site with bad wind conditions",
            latitude=37.8,
            longitude=24.1,
            shore_direction=270.0  # West-facing shore
        )
        db_session.add_all([site1, site2])
        db_session.commit()

        # Mock wind data: wind from west (270°), speed 5 m/s (good conditions)
        # For east-facing shore (90°), wind from west is favorable (good)
        # For west-facing shore (270°), wind from west is unfavorable (avoid)
        mock_fetch_wind.return_value = {
            "wind_direction_10m": 270.0,  # Wind from west
            "wind_speed_10m": 5.0,  # Below 6.2 m/s threshold (good)
            "wind_gusts_10m": 6.0
        }

        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "good"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should only return site1 (good conditions)
        assert len(data) == 1
        assert data[0]["name"] == "Site Good Conditions"
        # Verify wind data was fetched for center point
        assert mock_fetch_wind.called
        call_args = mock_fetch_wind.call_args
        # Check that it was called with average coordinates
        # Convert Decimal to float for comparison (SQLAlchemy returns Decimal for DECIMAL columns)
        from decimal import Decimal
        lat = float(call_args[0][0]) if isinstance(call_args[0][0], Decimal) else call_args[0][0]
        lon = float(call_args[0][1]) if isinstance(call_args[0][1], Decimal) else call_args[0][1]
        assert 37.7 <= lat <= 37.8  # lat
        assert 24.0 <= lon <= 24.1  # lon

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_suitability_filter_valid_avoid(self, mock_fetch_wind, client, db_session):
        """Test filtering by wind_suitability='avoid'."""
        # Create dive sites with different shore directions
        site1 = DiveSite(
            name="Site Good Conditions",
            description="Site with good wind conditions",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0  # East-facing shore
        )
        site2 = DiveSite(
            name="Site Bad Conditions",
            description="Site with bad wind conditions",
            latitude=37.8,
            longitude=24.1,
            shore_direction=270.0  # West-facing shore
        )
        db_session.add_all([site1, site2])
        db_session.commit()

        # Mock wind data: wind from west (270°), speed 8.0 m/s (>= 7.7 m/s threshold)
        # For west-facing shore (270°), wind from west is unfavorable
        # With speed >= 7.7 m/s and unfavorable direction = avoid
        mock_fetch_wind.return_value = {
            "wind_direction_10m": 270.0,  # Wind from west
            "wind_speed_10m": 8.0,  # >= 7.7 m/s threshold with unfavorable direction = avoid
            "wind_gusts_10m": 9.0
        }

        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "avoid"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # With range-based filtering, "avoid" includes all conditions (good, caution, difficult, avoid)
        # So both sites are returned: site1 (good) and site2 (avoid)
        assert len(data) == 2
        # Verify both sites are present
        site_names = [site["name"] for site in data]
        assert "Site Good Conditions" in site_names
        assert "Site Bad Conditions" in site_names

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_suitability_filter_unknown(self, mock_fetch_wind, client, db_session):
        """Test filtering with include_unknown_wind parameter (sites without shore_direction)."""
        # Create dive sites: one with shore_direction, one without
        site1 = DiveSite(
            name="Site With Shore Direction",
            description="Site with shore direction",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        site2 = DiveSite(
            name="Site Without Shore Direction",
            description="Site without shore direction",
            latitude=37.8,
            longitude=24.1,
            shore_direction=None
        )
        db_session.add_all([site1, site2])
        db_session.commit()

        mock_fetch_wind.return_value = {
            "wind_direction_10m": 270.0,
            "wind_speed_10m": 5.0,
            "wind_gusts_10m": 6.0
        }

        # Use include_unknown_wind=true with a range filter (e.g., "good")
        # This should return site1 (good conditions) + site2 (unknown conditions)
        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "good", "include_unknown_wind": "true"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return site1 (good conditions) and site2 (unknown conditions)
        assert len(data) == 2
        site_names = [site["name"] for site in data]
        assert "Site With Shore Direction" in site_names
        assert "Site Without Shore Direction" in site_names

    def test_wind_suitability_filter_invalid_value(self, client):
        """Test filtering with invalid wind_suitability value."""
        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "invalid"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "wind_suitability must be one of" in response.json()["detail"]

    def test_wind_suitability_filter_case_insensitive(self, client, db_session):
        """Test that wind_suitability parameter is case-insensitive."""
        site = DiveSite(
            name="Test Site",
            description="Test site",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        db_session.add(site)
        db_session.commit()

        with patch('app.routers.dive_sites.fetch_wind_data_single_point') as mock_fetch_wind:
            mock_fetch_wind.return_value = {
                "wind_direction_10m": 270.0,
                "wind_speed_10m": 5.0,
                "wind_gusts_10m": 6.0
            }

            # Test uppercase
            response = client.get(
                "/api/v1/dive-sites/",
                params={"wind_suitability": "GOOD"}
            )
            assert response.status_code == status.HTTP_200_OK

            # Test mixed case
            response = client.get(
                "/api/v1/dive-sites/",
                params={"wind_suitability": "GoOd"}
            )
            assert response.status_code == status.HTTP_200_OK

    def test_datetime_str_validation_future_too_far(self, client):
        """Test datetime_str validation - date too far in future."""
        from datetime import datetime, timedelta
        future_date = (datetime.utcnow() + timedelta(days=3)).isoformat()

        response = client.get(
            "/api/v1/dive-sites/",
            params={
                "wind_suitability": "good",
                "datetime_str": future_date
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cannot be more than 2 days ahead" in response.json()["detail"]

    def test_datetime_str_validation_past_date(self, client):
        """Test datetime_str validation - date in past."""
        from datetime import datetime, timedelta
        past_date = (datetime.utcnow() - timedelta(hours=2)).isoformat()

        response = client.get(
            "/api/v1/dive-sites/",
            params={
                "wind_suitability": "good",
                "datetime_str": past_date
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cannot be more than 1 hour in the past" in response.json()["detail"]

    def test_datetime_str_validation_invalid_format(self, client):
        """Test datetime_str validation - invalid format."""
        response = client.get(
            "/api/v1/dive-sites/",
            params={
                "wind_suitability": "good",
                "datetime_str": "invalid-date"
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid datetime format" in response.json()["detail"]

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_datetime_str_with_valid_forecast(self, mock_fetch_wind, client, db_session):
        """Test datetime_str with valid forecast date."""
        from datetime import datetime, timedelta
        site = DiveSite(
            name="Test Site",
            description="Test site",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        db_session.add(site)
        db_session.commit()

        # Valid future date (within 2 days)
        future_date = (datetime.utcnow() + timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
        future_date_str = future_date.isoformat()

        mock_fetch_wind.return_value = {
            "wind_direction_10m": 270.0,
            "wind_speed_10m": 5.0,
            "wind_gusts_10m": 6.0
        }

        response = client.get(
            "/api/v1/dive-sites/",
            params={
                "wind_suitability": "good",
                "datetime_str": future_date_str
            }
        )

        assert response.status_code == status.HTTP_200_OK
        # Verify datetime was passed to fetch_wind_data_single_point
        assert mock_fetch_wind.called
        call_args = mock_fetch_wind.call_args
        assert call_args[0][2] is not None  # target_datetime parameter

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_data_fetch_failure(self, mock_fetch_wind, client, db_session):
        """Test handling of wind data fetch failure."""
        site = DiveSite(
            name="Test Site",
            description="Test site",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        db_session.add(site)
        db_session.commit()

        # Mock wind data fetch failure
        mock_fetch_wind.return_value = None

        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "good"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return empty result when wind data fetch fails
        assert len(data) == 0

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_data_fetch_exception(self, mock_fetch_wind, client, db_session):
        """Test handling of wind data fetch exception."""
        site = DiveSite(
            name="Test Site",
            description="Test site",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        db_session.add(site)
        db_session.commit()

        # Mock wind data fetch exception
        mock_fetch_wind.side_effect = Exception("API Error")

        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "good"}
        )

        # Exception should be caught and return empty result (200 OK)
        # The implementation should gracefully handle exceptions and return empty result
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return empty result when wind data fetch fails
        assert len(data) == 0

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_suitability_filter_no_sites_with_coords(self, mock_fetch_wind, client, db_session):
        """Test filtering when no sites have valid coordinates."""
        # Create site without coordinates
        site = DiveSite(
            name="Site No Coords",
            description="Site without coordinates",
            latitude=None,
            longitude=None,
            shore_direction=90.0
        )
        db_session.add(site)
        db_session.commit()

        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "good"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return empty result when no sites have coordinates
        assert len(data) == 0
        # Should not call fetch_wind_data_single_point
        assert not mock_fetch_wind.called

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_suitability_filter_with_other_filters(self, mock_fetch_wind, client, db_session):
        """Test wind_suitability filter combined with other filters."""
        # Create sites with different names and shore directions
        site1 = DiveSite(
            name="Good Wind Site",
            description="Site with good wind",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        site2 = DiveSite(
            name="Bad Wind Site",
            description="Site with bad wind",
            latitude=37.8,
            longitude=24.1,
            shore_direction=270.0
        )
        db_session.add_all([site1, site2])
        db_session.commit()

        mock_fetch_wind.return_value = {
            "wind_direction_10m": 270.0,
            "wind_speed_10m": 5.0,
            "wind_gusts_10m": 6.0
        }

        # Combine wind_suitability filter with search filter
        response = client.get(
            "/api/v1/dive-sites/",
            params={
                "wind_suitability": "good",
                "search": "Good"
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return only site1 (matches both filters)
        assert len(data) == 1
        assert data[0]["name"] == "Good Wind Site"

    @patch('app.routers.dive_sites.fetch_wind_data_single_point')
    def test_wind_suitability_filter_high_wind_speed(self, mock_fetch_wind, client, db_session):
        """Test filtering with high wind speed (should result in avoid/difficult)."""
        site = DiveSite(
            name="High Wind Site",
            description="Site with high wind",
            latitude=37.7,
            longitude=24.0,
            shore_direction=90.0
        )
        db_session.add(site)
        db_session.commit()

        # Mock high wind speed (> 10 m/s = avoid)
        mock_fetch_wind.return_value = {
            "wind_direction_10m": 270.0,
            "wind_speed_10m": 12.0,  # Above 10 m/s threshold
            "wind_gusts_10m": 13.0
        }

        # Filter for avoid (high wind speed should result in avoid)
        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "avoid"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return site (high wind = avoid)
        assert len(data) == 1
        assert data[0]["name"] == "High Wind Site"

        # Filter for good (should return empty)
        response = client.get(
            "/api/v1/dive-sites/",
            params={"wind_suitability": "good"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return empty (high wind != good)
        assert len(data) == 0

