import pytest
from fastapi import status
from datetime import date, datetime
from app.models import Dive, DifficultyLevel

class TestSuitTypeOptional:
    """Test that suit_type is optional and handles empty strings."""

    def test_create_dive_with_empty_suit_type(self, client, auth_headers, test_dive_site, db_session):
        """Test creating a dive with an empty suit_type string."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15",
            "dive_time": "10:30:00",
            "suit_type": "",
            "max_depth": 18.5,
            "duration": 45
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["suit_type"] is None

    def test_update_dive_to_empty_suit_type(self, client, auth_headers, test_dive_site, db_session, test_user):
        """Test updating a dive's suit_type to an empty string."""
        # Create a dive with a suit type
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Original Dive",
            suit_type="wet_suit",
            dive_date=date(2025, 1, 15),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        update_data = {
            "suit_type": ""
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["suit_type"] is None

    def test_filter_dives_by_empty_suit_type(self, client, auth_headers, test_dive_site, db_session, test_user):
        """Test that filtering with suit_type='' doesn't crash and returns all (as no filter)."""
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            suit_type="wet_suit",
            dive_date=date(2025, 1, 15),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        # suit_type="" in query should be ignored or allow all
        response = client.get("/api/v1/dives/?suit_type=", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["total"] >= 1
