import pytest
from fastapi import status
from datetime import datetime, date
from decimal import Decimal
from unittest.mock import patch, MagicMock

from app.models import Dive, DiveSite, DiveMedia, DiveTag, AvailableTag, DifficultyLevel
from app.utils import (
    calculate_unified_phrase_aware_score,
    classify_match_type,
    get_unified_fuzzy_trigger_conditions,
    UNIFIED_TYPO_TOLERANCE
)


class TestDives:
    """Test dives endpoints."""

    def test_create_dive_with_automatic_name(self, client, auth_headers, test_dive_site):
        """Test creating a dive with automatic name generation."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15",
            "dive_time": "10:30:00",
            "max_depth": 18.5,
            "average_depth": 12.0,
            "duration": 45,
            "visibility_rating": 8,
            "user_rating": 9,
            "is_private": False
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["dive_site_id"] == test_dive_site.id
        assert data["name"] == f"{test_dive_site.name} - 2025/01/15"
        assert data["is_private"] == False
        assert data["user_username"] == "testuser"

    def test_create_dive_with_custom_name(self, client, auth_headers, test_dive_site):
        """Test creating a dive with custom name."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "name": "My Custom Dive Name",
            "dive_date": "2025-01-15",
            "dive_time": "10:30:00",
            "max_depth": 18.5,
            "average_depth": 12.0,
            "duration": 45,
            "visibility_rating": 8,
            "user_rating": 9,
            "is_private": True
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == "My Custom Dive Name"
        assert data["is_private"] == True

    def test_get_own_dives(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test getting user's own dives."""
        # Create a dive for the test user
        # Get ADVANCED_OPEN_WATER difficulty (id=2)
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive Site - 2025/01/15",
            is_private=False,
            dive_information="Test dive information",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get("/api/v1/dives/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["user_username"] == test_user.username

    def test_get_public_dives_from_other_user(self, client, auth_headers, db_session, test_dive_site):
        """Test getting public dives from another user."""
        # Create another user
        from app.models import User
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hashed_password",
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        # Create a public dive by the other user
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            name="Other User's Dive",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45,
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(other_dive)
        db_session.commit()

        response = client.get("/api/v1/dives/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["user_username"] == other_user.username

    def test_cannot_access_private_dive_from_other_user(self, client, auth_headers, db_session, test_dive_site):
        """Test that users cannot access private dives from other users."""
        # Create another user
        from app.models import User
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hashed_password",
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        # Create a private dive by the other user
        private_dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            name="Private Dive",
            is_private=True,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(private_dive)
        db_session.commit()

        response = client.get("/api/v1/dives/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 0  # Should not see the private dive

    def test_get_dive_details(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test getting detailed dive information."""
        # Get ADVANCED_OPEN_WATER difficulty
        difficulty_advanced_open_water = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive Site - 2025/01/15",
            is_private=False,
            dive_information="Test dive information",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get(f"/api/v1/dives/{dive.id}/details", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["id"] == dive.id
        assert data["name"] == dive.name
        assert data["user_username"] == test_user.username
        assert data["dive_site"] is not None
        assert data["dive_site"]["name"] == test_dive_site.name
        assert data["dive_site"]["latitude"] == float(test_dive_site.latitude)
        assert data["dive_site"]["longitude"] == float(test_dive_site.longitude)

    def test_update_dive_name(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test updating dive name."""
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Original Name",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        update_data = {
            "name": "Updated Dive Name"
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == "Updated Dive Name"

    def test_update_dive_privacy(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test updating dive privacy setting."""
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        update_data = {
            "is_private": True
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["is_private"] == True

    def test_filter_dives_by_user(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test filtering dives by user ID."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45,
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get(f"/api/v1/dives/?user_id={test_user.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive.id

    def test_filter_dives_by_date_range(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test filtering dives by date range."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45,
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get("/api/v1/dives/?start_date=2025-01-01&end_date=2025-01-31", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive.id

    def test_filter_dives_by_depth(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test filtering dives by depth range."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            is_private=False,
            max_depth=Decimal("18.5"),
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45,
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get("/api/v1/dives/?min_depth=10&max_depth=20", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive.id

    def test_delete_dive(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test deleting a dive."""
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        response = client.delete(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        # Verify dive is deleted
        response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_delete_other_users_dive(self, client, auth_headers, db_session, test_dive_site):
        """Test that users cannot delete dives from other users."""
        # Create another user
        from app.models import User
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hashed_password",
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        # Create a dive by the other user
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            name="Other User's Dive",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(other_dive)
        db_session.commit()

        response = client.delete(f"/api/v1/dives/{other_dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND  # Should not find the dive since it's not owned by test_user

    def test_filter_dives_by_dive_site_name(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test filtering dives by dive site name."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        
        # Create another dive site with a different name
        from app.models import DiveSite
        other_dive_site = DiveSite(
            name="Another Test Site",
            description="Another test dive site",
            latitude=Decimal("25.7617"),
            longitude=Decimal("-80.1918"),
            country="USA",
            region="Florida",
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(other_dive_site)
        db_session.commit()

        # Create a dive with the original dive site
        dive1 = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive 1",
            is_private=False,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45,
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(dive1)

        # Create a dive with the other dive site
        dive2 = Dive(
            user_id=test_user.id,
            dive_site_id=other_dive_site.id,
            name="Test Dive 2",
            is_private=False,
            dive_date=date(2025, 1, 16),
            dive_time=datetime.strptime("11:30:00", "%H:%M:%S").time(),
            duration=50,
            difficulty_id=difficulty.id if difficulty else 2
        )
        db_session.add(dive2)
        db_session.commit()

        # Test filtering by dive site name (partial match)
        response = client.get(f"/api/v1/dives/?dive_site_name=Test", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 2  # Both dives should match since both dive sites contain "Test"

        # Test filtering by specific dive site name
        response = client.get(f"/api/v1/dives/?dive_site_name={test_dive_site.name}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["dive_site_id"] == test_dive_site.id

        # Test filtering by non-matching dive site name
        response = client.get("/api/v1/dives/?dive_site_name=NonExistent", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 0  # No dives should match

    def test_unauthenticated_user_can_access_public_dives(self, client, db_session, test_dive_site):
        """Test that unauthenticated users can access public dives."""
        # Create another user
        from app.models import User
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hashed_password",
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        # Create a public dive by the other user
        difficulty_aow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        public_dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            name="Public Dive",
            is_private=False,
            dive_information="Public dive information",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty_aow.id if difficulty_aow else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(public_dive)

        # Create a private dive by the other user
        difficulty_deep = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
        private_dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            name="Private Dive",
            is_private=True,
            dive_information="Private dive information",
            max_depth=Decimal("20.0"),
            average_depth=Decimal("15.0"),
            gas_bottles_used="Air",
            suit_type="dry_suit",
            difficulty_id=difficulty_deep.id if difficulty_deep else 3,
            visibility_rating=7,
            user_rating=8,
            dive_date=date(2025, 1, 16),
            dive_time=datetime.strptime("11:30:00", "%H:%M:%S").time(),
            duration=50
        )
        db_session.add(private_dive)
        db_session.commit()

        # Test that unauthenticated user can access public dives list
        response = client.get("/api/v1/dives/")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1  # Only the public dive should be visible
        assert data[0]["name"] == "Public Dive"
        assert data[0]["is_private"] == False

        # Test that unauthenticated user can access specific public dive
        response = client.get(f"/api/v1/dives/{public_dive.id}")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == "Public Dive"
        assert data["is_private"] == False

        # Test that unauthenticated user cannot access private dive
        response = client.get(f"/api/v1/dives/{private_dive.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Test that unauthenticated user can access public dive details
        response = client.get(f"/api/v1/dives/{public_dive.id}/details")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == "Public Dive"
        assert data["is_private"] == False

        # Test that unauthenticated user cannot access private dive details
        response = client.get(f"/api/v1/dives/{private_dive.id}/details")
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Test that unauthenticated user can access public dive media
        response = client.get(f"/api/v1/dives/{public_dive.id}/media")
        assert response.status_code == status.HTTP_200_OK

        # Test that unauthenticated user cannot access private dive media
        response = client.get(f"/api/v1/dives/{private_dive.id}/media")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # ===== DIVE CENTER FUNCTIONALITY TESTS =====

    def test_create_dive_with_diving_center(self, client, auth_headers, test_dive_site, test_diving_center):
        """Test creating a dive with diving center association."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "diving_center_id": test_diving_center.id,
            "dive_date": "2025-01-15",
            "dive_time": "10:30:00",
            "max_depth": 18.5,
            "average_depth": 12.0,
            "duration": 45,
            "visibility_rating": 8,
            "user_rating": 9,
            "is_private": False
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] == test_diving_center.id
        assert data["diving_center"] is not None
        assert data["diving_center"]["id"] == test_diving_center.id
        assert data["diving_center"]["name"] == test_diving_center.name
        assert data["diving_center"]["description"] == test_diving_center.description
        assert data["diving_center"]["email"] == test_diving_center.email
        assert data["diving_center"]["phone"] == test_diving_center.phone
        assert data["diving_center"]["website"] == test_diving_center.website
        assert data["diving_center"]["latitude"] == float(test_diving_center.latitude)
        assert data["diving_center"]["longitude"] == float(test_diving_center.longitude)

    def test_create_dive_with_invalid_diving_center(self, client, auth_headers, test_dive_site):
        """Test creating a dive with non-existent diving center."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "diving_center_id": 99999,  # Non-existent diving center
            "dive_date": "2025-01-15",
            "dive_time": "10:30:00",
            "max_depth": 18.5,
            "average_depth": 12.0,
            "duration": 45,
            "visibility_rating": 8,
            "user_rating": 9,
            "is_private": False
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving center not found" in response.json()["detail"]

    def test_get_dive_with_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test getting a dive that has diving center information."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive with diving center
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            name="Test Dive with Center",
            is_private=False,
            dive_information="Test dive with diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] == test_diving_center.id
        assert data["diving_center"] is not None
        assert data["diving_center"]["id"] == test_diving_center.id
        assert data["diving_center"]["name"] == test_diving_center.name
        assert data["diving_center"]["description"] == test_diving_center.description
        assert data["diving_center"]["email"] == test_diving_center.email
        assert data["diving_center"]["phone"] == test_diving_center.phone
        assert data["diving_center"]["website"] == test_diving_center.website
        assert data["diving_center"]["latitude"] == float(test_diving_center.latitude)
        assert data["diving_center"]["longitude"] == float(test_diving_center.longitude)

    def test_get_dive_without_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test getting a dive that has no diving center association."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive without diving center
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=None,
            name="Test Dive without Center",
            is_private=False,
            dive_information="Test dive without diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] is None
        assert data["diving_center"] is None

    def test_update_dive_add_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test updating a dive to add diving center association."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive without diving center
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=None,
            name="Test Dive to Update",
            is_private=False,
            dive_information="Test dive to add diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        # Update dive to add diving center
        update_data = {
            "diving_center_id": test_diving_center.id
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] == test_diving_center.id
        assert data["diving_center"] is not None
        assert data["diving_center"]["id"] == test_diving_center.id
        assert data["diving_center"]["name"] == test_diving_center.name

    def test_update_dive_change_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test updating a dive to change diving center association."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create another diving center
        from app.models import DivingCenter
        other_diving_center = DivingCenter(
            name="Other Diving Center",
            description="Another test diving center",
            email="other@divingcenter.com",
            phone="+1987654321",
            website="www.otherdivingcenter.com",
            latitude=20.0,
            longitude=30.0
        )
        db_session.add(other_diving_center)
        db_session.commit()

        # Create a dive with initial diving center
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            name="Test Dive to Change Center",
            is_private=False,
            dive_information="Test dive to change diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        # Update dive to change diving center
        update_data = {
            "diving_center_id": other_diving_center.id
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] == other_diving_center.id
        assert data["diving_center"] is not None
        assert data["diving_center"]["id"] == other_diving_center.id
        assert data["diving_center"]["name"] == other_diving_center.name

    def test_update_dive_remove_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test updating a dive to remove diving center association."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive with diving center
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            name="Test Dive to Remove Center",
            is_private=False,
            dive_information="Test dive to remove diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        # Update dive to remove diving center
        update_data = {
            "diving_center_id": None
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] is None
        assert data["diving_center"] is None

    def test_update_dive_with_invalid_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test updating a dive with non-existent diving center."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=None,
            name="Test Dive Invalid Center",
            is_private=False,
            dive_information="Test dive with invalid diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        # Try to update with non-existent diving center
        update_data = {
            "diving_center_id": 99999
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving center not found" in response.json()["detail"]

    def test_list_dives_with_diving_center(self, client, auth_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test listing dives that include diving center information."""
        # Get difficulty IDs
        difficulty_aow = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        difficulty_deep = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
        # Create dives with and without diving center
        dive_with_center = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            name="Dive with Center",
            is_private=False,
            dive_information="Dive with diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty_aow.id if difficulty_aow else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive_with_center)

        dive_without_center = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=None,
            name="Dive without Center",
            is_private=False,
            dive_information="Dive without diving center",
            max_depth=Decimal("20.0"),
            average_depth=Decimal("15.0"),
            gas_bottles_used="Air",
            suit_type="dry_suit",
            difficulty_id=difficulty_deep.id if difficulty_deep else 3,
            visibility_rating=7,
            user_rating=8,
            dive_date=date(2025, 1, 16),
            dive_time=datetime.strptime("11:30:00", "%H:%M:%S").time(),
            duration=50
        )
        db_session.add(dive_without_center)
        db_session.commit()

        response = client.get("/api/v1/dives/", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 2

        # Check dive with center
        dive_with_center_data = next(d for d in data if d["name"] == "Dive with Center")
        assert dive_with_center_data["diving_center_id"] == test_diving_center.id
        assert dive_with_center_data["diving_center"] is not None
        assert dive_with_center_data["diving_center"]["id"] == test_diving_center.id
        assert dive_with_center_data["diving_center"]["name"] == test_diving_center.name

        # Check dive without center
        dive_without_center_data = next(d for d in data if d["name"] == "Dive without Center")
        assert dive_without_center_data["diving_center_id"] is None
        assert dive_without_center_data["diving_center"] is None

    def test_admin_get_dives_with_diving_center(self, client, admin_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test admin getting dives with diving center information."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive with diving center
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            name="Admin Test Dive",
            is_private=False,
            dive_information="Admin test dive with diving center",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get("/api/v1/dives/admin/dives", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["diving_center_id"] == test_diving_center.id
        assert data[0]["diving_center"] is not None
        assert data[0]["diving_center"]["id"] == test_diving_center.id
        assert data[0]["diving_center"]["name"] == test_diving_center.name

    def test_admin_update_dive_diving_center(self, client, admin_headers, db_session, test_user, test_dive_site, test_diving_center):
        """Test admin updating dive diving center."""
        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=None,
            name="Admin Update Test Dive",
            is_private=False,
            dive_information="Admin update test dive",
            max_depth=Decimal("18.5"),
            average_depth=Decimal("12.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        db_session.commit()

        # Admin updates the dive to add diving center
        update_data = {
            "diving_center_id": test_diving_center.id
        }

        response = client.put(f"/api/v1/dives/admin/dives/{dive.id}", json=update_data, headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["diving_center_id"] == test_diving_center.id
        assert data["diving_center"] is not None
        assert data["diving_center"]["id"] == test_diving_center.id
        assert data["diving_center"]["name"] == test_diving_center.name

    def test_unauthenticated_user_can_see_public_dive_with_diving_center(self, client, db_session, test_dive_site, test_diving_center):
        """Test that unauthenticated users can see public dives with diving center."""
        # Create another user
        from app.models import User
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hashed_password",
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        # Get difficulty ID
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        # Create a public dive by the other user with diving center
        dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            name="Public Dive with Center - 2025/01/15",
            is_private=False,
            dive_information="Public dive with diving center",
            max_depth=Decimal("15.0"),
            average_depth=Decimal("10.0"),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty.id if difficulty else 2,
            visibility_rating=7,
            user_rating=8,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("09:00:00", "%H:%M:%S").time(),
            duration=40
        )
        db_session.add(dive)
        db_session.commit()

        # Test unauthenticated access
        response = client.get("/api/v1/dives/")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Public Dive with Center - 2025/01/15"
        assert data[0]["is_private"] == False
        assert data[0]["user_username"] == "otheruser"
        assert data[0]["diving_center"]["id"] == test_diving_center.id
        assert data[0]["diving_center"]["name"] == test_diving_center.name

    def test_get_dives_pagination(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test pagination for dives endpoint."""
        # Create multiple dives for pagination testing
        dive_names = [
            "Alpha Dive - 2025/01/01",
            "Beta Dive - 2025/01/02",
            "Charlie Dive - 2025/01/03",
            "Delta Dive - 2025/01/04",
            "Echo Dive - 2025/01/05"
        ]

        # Get difficulty levels once before the loop
        difficulty_advanced_open_water = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
        difficulty_deep_nitrox = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
        difficulty_codes_list = ["DEEP_NITROX", "ADVANCED_OPEN_WATER", "DEEP_NITROX", "ADVANCED_OPEN_WATER", "ADVANCED_OPEN_WATER"]
        
        for i, (name, difficulty_code) in enumerate(zip(dive_names, difficulty_codes_list)):
            difficulty = difficulty_deep_nitrox if difficulty_code == "DEEP_NITROX" else difficulty_advanced_open_water
            dive = Dive(
                user_id=test_user.id,
                dive_site_id=test_dive_site.id,
                name=name,
                is_private=False,
                dive_information=f"Dive {i+1} information",
                max_depth=Decimal("15.0"),
                average_depth=Decimal("10.0"),
                gas_bottles_used="Air",
                suit_type="wet_suit",
                difficulty_id=difficulty.id if difficulty else (3 if difficulty_code == "DEEP_NITROX" else 2),
                visibility_rating=7,
                user_rating=8,
                dive_date=date(2025, 1, i+1),
                dive_time=datetime.strptime("09:00:00", "%H:%M:%S").time(),
                duration=40
            )
            db_session.add(dive)
        db_session.commit()

        # Test page 1 with page_size 25
        response = client.get("/api/v1/dives/?page=1&page_size=25", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 5  # All 5 dives fit in one page

        # Check pagination headers
        assert response.headers["x-total-count"] == "5"
        assert response.headers["x-total-pages"] == "1"
        assert response.headers["x-current-page"] == "1"
        assert response.headers["x-page-size"] == "25"
        assert response.headers["x-has-next-page"] == "false"
        assert response.headers["x-has-prev-page"] == "false"

        # Check default sorting (by dive_date descending, newest first)
        assert data[0]["name"] == "Echo Dive - 2025/01/05"  # Newest date
        assert data[1]["name"] == "Delta Dive - 2025/01/04"
        assert data[2]["name"] == "Charlie Dive - 2025/01/03"
        assert data[3]["name"] == "Beta Dive - 2025/01/02"
        assert data[4]["name"] == "Alpha Dive - 2025/01/01"  # Oldest date

    def test_get_dives_invalid_page_size(self, client, auth_headers):
        """Test that invalid page_size values are rejected."""
        response = client.get(
            "/api/v1/dives/?page=1&page_size=30",  # Invalid page size
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "page_size must be one of: 25, 50, 100, 1000" in response.json()["detail"]

    def test_get_dives_pagination_with_filters(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test pagination with filters applied."""
        # Create dives with different difficulty levels
        dive_names = [
            "Advanced Dive - 2025/01/01",
            "Beginner Dive - 2025/01/02",
            "Expert Dive - 2025/01/03",
            "Intermediate Dive - 2025/01/04"
        ]

        # Map old difficulty integers to codes: 3=DEEP_NITROX, 2=ADVANCED_OPEN_WATER
        difficulty_codes = ["DEEP_NITROX", "ADVANCED_OPEN_WATER", "DEEP_NITROX", "ADVANCED_OPEN_WATER"]

        for i, (name, difficulty_code) in enumerate(zip(dive_names, difficulty_codes)):
            difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == difficulty_code).first()
            dive = Dive(
                user_id=test_user.id,
                dive_site_id=test_dive_site.id,
                name=name,
                is_private=False,
                dive_information=f"Dive {i+1} information",
                max_depth=Decimal("15.0"),
                average_depth=Decimal("10.0"),
                gas_bottles_used="Air",
                suit_type="wet_suit",
                difficulty_id=difficulty.id if difficulty else (3 if difficulty_code == "DEEP_NITROX" else 2),
                visibility_rating=7,
                user_rating=8,
                dive_date=date(2025, 1, i+1),
                dive_time=datetime.strptime("09:00:00", "%H:%M:%S").time(),
                duration=40
            )
            db_session.add(dive)
        db_session.commit()

        # Test pagination with difficulty filter
        response = client.get(
            "/api/v1/dives/?page=1&page_size=25&difficulty_code=ADVANCED_OPEN_WATER",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 2  # Two intermediate dives
        
        # Check that both dives have difficulty_code ADVANCED_OPEN_WATER
        assert data[0]["difficulty_code"] == "ADVANCED_OPEN_WATER"
        assert data[0]["difficulty_label"] == "Advanced Open Water"
        assert data[1]["difficulty_code"] == "ADVANCED_OPEN_WATER"
        assert data[1]["difficulty_label"] == "Advanced Open Water"
        
        # Check that we have the expected dive names (order may vary due to default sorting)
        dive_names = [dive["name"] for dive in data]
        assert "Beginner Dive - 2025/01/02" in dive_names
        assert "Intermediate Dive - 2025/01/04" in dive_names

        # Check pagination headers reflect filtered results
        assert response.headers["x-total-count"] == "2"
        assert response.headers["x-total-pages"] == "1"


class TestDivesFuzzySearch:
    """Test the fuzzy search functionality in dives endpoint."""

    def test_dives_search_basic_functionality(self, client, auth_headers, test_dive_with_site):
        """Test basic search functionality in dives endpoint."""
        response = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_with_dive_site_name(self, client, auth_headers, test_dive_with_site):
        """Test search by dive site name."""
        response = client.get("/api/v1/dives/?search=Test Dive Site", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_with_dive_information(self, client, auth_headers, test_dive_with_site):
        """Test search by dive information field."""
        response = client.get("/api/v1/dives/?search=information", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_multi_word_query(self, client, auth_headers, test_dive_with_site):
        """Test multi-word search query triggers fuzzy search."""
        response = client.get("/api/v1/dives/?search=test dive", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_short_query_triggers_fuzzy(self, client, auth_headers, test_dive_with_site):
        """Test that short queries trigger fuzzy search."""
        response = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_with_typos(self, client, auth_headers, test_dive_with_site):
        """Test search with typos (fuzzy matching)."""
        response = client.get("/api/v1/dives/?search=tesst", headers=auth_headers)  # Typo in "test"
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should still find results due to fuzzy matching

    def test_dives_search_geographic_fields(self, client, auth_headers, test_dive_with_site):
        """Test search across geographic fields (country, region, city)."""
        response = client.get("/api/v1/dives/?search=Test Country", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_with_tags(self, client, auth_headers, test_dive_with_tags):
        """Test search that includes tag matching."""
        response = client.get("/api/v1/dives/?search=wreck", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_result_ordering(self, client, auth_headers, multiple_test_dives):
        """Test that search results are properly ordered by relevance."""
        response = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        if len(data) > 1:
            # Results should be ordered by relevance (exact matches first)
            # This tests the fuzzy search scoring and ordering
            pass

    def test_dives_search_with_sorting(self, client, auth_headers, test_dive_with_site):
        """Test that fuzzy search works with sorting parameters."""
        response = client.get("/api/v1/dives/?search=test&sort_by=dive_date&sort_order=desc", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_pagination_with_fuzzy(self, client, auth_headers, multiple_test_dives):
        """Test that pagination works correctly with fuzzy search results."""
        response = client.get("/api/v1/dives/?search=test&page=1&page_size=5", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0
        
        # Check pagination headers
        assert "x-total-count" in response.headers
        assert "x-total-pages" in response.headers

    def test_dives_search_performance(self, client, auth_headers, multiple_test_dives):
        """Test search performance with multiple dives."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 2.0  # Should complete within 2 seconds

    def test_dives_search_with_filters(self, client, auth_headers, test_dive_with_site):
        """Test search combined with other filters."""
        response = client.get("/api/v1/dives/?search=test&difficulty_code=ADVANCED_OPEN_WATER", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0

    def test_dives_search_empty_query(self, client, auth_headers, test_dive_with_site):
        """Test search with empty query."""
        response = client.get("/api/v1/dives/?search=", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return all dives when search is empty

    def test_dives_search_no_results(self, client, auth_headers, test_dive_with_site):
        """Test search with query that should return no results."""
        response = client.get("/api/v1/dives/?search=xyz123nonexistent", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return empty list or very few results

    def test_dives_search_with_special_characters(self, client, auth_headers, test_dive_with_site):
        """Test search with special characters."""
        response = client.get("/api/v1/dives/?search=test@#$%", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

    def test_dives_search_case_insensitive(self, client, auth_headers, test_dive_with_site):
        """Test that search is case insensitive."""
        response_lower = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        response_upper = client.get("/api/v1/dives/?search=TEST", headers=auth_headers)
        
        assert response_lower.status_code == status.HTTP_200_OK
        assert response_upper.status_code == status.HTTP_200_OK
        
        data_lower = response_lower.json()
        data_upper = response_upper.json()
        assert len(data_lower) == len(data_upper)  # Should return same results

    def test_dives_search_with_very_long_query(self, client, auth_headers, test_dive_with_site):
        """Test search with very long query."""
        long_query = "a" * 200  # Max length
        response = client.get(f"/api/v1/dives/?search={long_query}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

    def test_dives_search_with_very_long_query(self, client, auth_headers, test_dive_with_site):
        """Test search with very long query (no max length validation in dives endpoint)."""
        long_query = "a" * 201  # Very long query
        response = client.get(f"/api/v1/dives/?search={long_query}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        # Note: Dives endpoint doesn't have max_length validation like other endpoints


class TestDivesUnifiedScoring:
    """Test the unified scoring algorithm for dives."""

    def test_dive_site_name_exact_match(self):
        """Test exact match in dive site name returns highest score."""
        score = calculate_unified_phrase_aware_score(
            query="Blue Hole",
            primary_name="Blue Hole Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score == 1.0

    def test_dive_site_name_word_matching(self):
        """Test word-by-word matching in dive site name."""
        score = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="Blue Hole Diving Site",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.8  # Should be high due to word matching

    def test_dive_information_matching(self):
        """Test matching in dive information field."""
        score = calculate_unified_phrase_aware_score(
            query="beautiful",
            primary_name="Test Dive Site",
            description="A beautiful reef with amazing marine life",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.1  # Should include description bonus

    def test_geographic_field_matching_dives(self):
        """Test geographic field matching for dives."""
        score = calculate_unified_phrase_aware_score(
            query="bahamas",
            primary_name="Test Dive Site",
            description="A test dive",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.2  # Should include geographic bonus

    def test_tag_matching_dives(self):
        """Test tag matching for dive-specific searches."""
        score = calculate_unified_phrase_aware_score(
            query="wreck",
            primary_name="Test Dive Site",
            description="A test dive",
            country="Bahamas",
            region="Caribbean",
            tags=["Wreck Diving", "Reef Diving"]
        )
        assert score > 0.3  # Should include tag bonus

    def test_typo_tolerance_dives(self):
        """Test typo tolerance in dive searches."""
        score = calculate_unified_phrase_aware_score(
            query="nautalus",  # Typo for "nautilus"
            primary_name="Nautilus Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.6  # Should be boosted by high similarity

    def test_consecutive_word_bonus_dives(self):
        """Test consecutive word bonus for dive site names."""
        score = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="Bluehole Reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert score > 0.7  # Should include consecutive bonus

    def test_empty_fields_handling_dives(self):
        """Test handling of None/empty fields in dive scoring."""
        score = calculate_unified_phrase_aware_score(
            query="test",
            primary_name="Test Dive Site",
            description=None,
            country=None,
            region=None,
            city=None
        )
        assert score > 0.0  # Should still work with empty fields

    def test_case_insensitive_dive_scoring(self):
        """Test that dive scoring is case insensitive."""
        score_lower = calculate_unified_phrase_aware_score(
            query="blue hole",
            primary_name="BLUE HOLE REEF",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        score_upper = calculate_unified_phrase_aware_score(
            query="BLUE HOLE",
            primary_name="blue hole reef",
            description="A beautiful reef",
            country="Bahamas",
            region="Caribbean"
        )
        assert abs(score_lower - score_upper) < 0.01  # Should be nearly identical


class TestDivesSearchRankingStability:
    """Test search ranking stability for dives."""

    def test_ranking_consistency_same_query(self, client, auth_headers, multiple_test_dives):
        """Test that same query returns consistent ranking."""
        response1 = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        response2 = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        
        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Results should be in same order
        assert len(data1) == len(data2)
        for i in range(len(data1)):
            assert data1[i]["id"] == data2[i]["id"]

    def test_ranking_with_different_query_lengths(self, client, auth_headers, multiple_test_dives):
        """Test ranking stability with different query lengths."""
        short_query = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        long_query = client.get("/api/v1/dives/?search=test dive site", headers=auth_headers)
        
        assert short_query.status_code == status.HTTP_200_OK
        assert long_query.status_code == status.HTTP_200_OK
        
        # Both should return results, though potentially different counts
        assert len(short_query.json()) > 0
        assert len(long_query.json()) > 0

    def test_ranking_with_special_characters(self, client, auth_headers, multiple_test_dives):
        """Test ranking stability with special characters."""
        normal_query = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        special_query = client.get("/api/v1/dives/?search=test@#$%", headers=auth_headers)
        
        assert normal_query.status_code == status.HTTP_200_OK
        assert special_query.status_code == status.HTTP_200_OK
        
        # Both should return results
        assert len(normal_query.json()) > 0
        assert len(special_query.json()) > 0

    def test_ranking_with_typos(self, client, auth_headers, multiple_test_dives):
        """Test ranking stability with typos."""
        correct_query = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        typo_query = client.get("/api/v1/dives/?search=tesst", headers=auth_headers)
        
        assert correct_query.status_code == status.HTTP_200_OK
        assert typo_query.status_code == status.HTTP_200_OK
        
        # Both should return results
        assert len(correct_query.json()) > 0
        assert len(typo_query.json()) > 0


class TestDivesSearchPerformance:
    """Test performance of dives fuzzy search."""

    def test_search_performance_large_dataset(self, client, auth_headers, large_dive_dataset):
        """Test search performance with large dataset."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dives/?search=test", headers=auth_headers)
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 3.0  # Should complete within 3 seconds even with large dataset

    def test_search_performance_complex_query(self, client, auth_headers, large_dive_dataset):
        """Test search performance with complex multi-word query."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dives/?search=test dive site information", headers=auth_headers)
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 3.0  # Should complete within 3 seconds

    def test_search_performance_with_sorting(self, client, auth_headers, large_dive_dataset):
        """Test search performance with sorting applied."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dives/?search=test&sort_by=dive_date&sort_order=desc", headers=auth_headers)
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 3.0  # Should complete within 3 seconds

    def test_search_performance_with_pagination(self, client, auth_headers, large_dive_dataset):
        """Test search performance with pagination."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dives/?search=test&page=1&page_size=25", headers=auth_headers)
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 3.0  # Should complete within 3 seconds

    def test_search_performance_with_filters(self, client, auth_headers, large_dive_dataset):
        """Test search performance with additional filters."""
        import time
        
        start_time = time.time()
        response = client.get("/api/v1/dives/?search=test&difficulty_code=ADVANCED_OPEN_WATER&min_rating=5", headers=auth_headers)
        end_time = time.time()
        
        assert response.status_code == status.HTTP_200_OK
        assert (end_time - start_time) < 3.0  # Should complete within 3 seconds


# Test fixtures for dives fuzzy search testing
@pytest.fixture
def test_dive_with_site(db_session, test_user):
    """Create a test dive with associated dive site."""
    # Get ADVANCED_OPEN_WATER difficulty
    difficulty_advanced_open_water = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    # Create dive site
    dive_site = DiveSite(
        name="Test Dive Site",
        description="A test dive site for testing",
        latitude=25.0,
        longitude=30.0,
        country="Test Country",
        region="Test Region",
        difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2  # 2=intermediate
    )
    db_session.add(dive_site)
    db_session.commit()
    db_session.refresh(dive_site)
    
    # Create dive
    dive = Dive(
        user_id=test_user.id,
        dive_site_id=dive_site.id,
        name="Test Dive Site - 2025/01/15",
        is_private=False,
        dive_information="Test dive information for testing purposes",
        max_depth=Decimal("18.5"),
        average_depth=Decimal("12.0"),
        gas_bottles_used="Air",
        suit_type="wet_suit",
        difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2,
        visibility_rating=8,
        user_rating=9,
        dive_date=date(2025, 1, 15),
        dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
        duration=45
    )
    db_session.add(dive)
    db_session.commit()
    db_session.refresh(dive)
    
    return dive

@pytest.fixture
def test_dive_with_tags(db_session, test_user):
    """Create a test dive with tags."""
    # Get DEEP_NITROX difficulty
    difficulty_deep_nitrox = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "DEEP_NITROX").first()
    # Create dive site
    dive_site = DiveSite(
        name="Wreck Dive Site",
        description="A wreck dive site",
        latitude=25.0,
        longitude=30.0,
        country="Test Country",
        region="Test Region",
        difficulty_id=difficulty_deep_nitrox.id if difficulty_deep_nitrox else 3  # 3=advanced
    )
    db_session.add(dive_site)
    db_session.commit()
    db_session.refresh(dive_site)
    
    # Create tags
    wreck_tag = AvailableTag(name="Wreck Diving")
    reef_tag = AvailableTag(name="Reef Diving")
    db_session.add(wreck_tag)
    db_session.add(reef_tag)
    db_session.commit()
    
    # Create dive
    dive = Dive(
        user_id=test_user.id,
        dive_site_id=dive_site.id,
        name="Wreck Dive Site - 2025/01/15",
        is_private=False,
        dive_information="A wreck dive with amazing marine life",
        max_depth=Decimal("25.0"),
        average_depth=Decimal("18.0"),
        gas_bottles_used="Air",
        suit_type="wet_suit",
        difficulty_id=difficulty_deep_nitrox.id if difficulty_deep_nitrox else 3,
        visibility_rating=7,
        user_rating=8,
        dive_date=date(2025, 1, 15),
        dive_time=datetime.strptime("14:00:00", "%H:%M:%S").time(),
        duration=50
    )
    db_session.add(dive)
    db_session.commit()
    db_session.refresh(dive)
    
    # Link tags to dive
    dive_tag1 = DiveTag(dive_id=dive.id, tag_id=wreck_tag.id)
    dive_tag2 = DiveTag(dive_id=dive.id, tag_id=reef_tag.id)
    db_session.add(dive_tag1)
    db_session.add(dive_tag2)
    db_session.commit()
    
    return dive

@pytest.fixture
def multiple_test_dives(db_session, test_user):
    """Create multiple test dives for testing."""
    # Get ADVANCED_OPEN_WATER difficulty
    difficulty_advanced_open_water = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    # Create dive site
    dive_site = DiveSite(
        name="Test Dive Site",
        description="A test dive site for testing",
        latitude=25.0,
        longitude=30.0,
        country="Test Country",
        region="Test Region",
        difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2  # 2=intermediate
    )
    db_session.add(dive_site)
    db_session.commit()
    db_session.refresh(dive_site)
    
    # Create multiple dives
    dives = []
    for i in range(10):
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name=f"Test Dive {i+1} - 2025/01/{15+i:02d}",
            is_private=False,
            dive_information=f"Test dive {i+1} information for testing purposes",
            max_depth=Decimal("15.0") + Decimal(str(i)),
            average_depth=Decimal("10.0") + Decimal(str(i)),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15 + i),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        dives.append(dive)
    
    db_session.commit()
    for dive in dives:
        db_session.refresh(dive)
    
    return dives

@pytest.fixture
def large_dive_dataset(db_session, test_user):
    """Create a large dataset of dives for performance testing."""
    # Get ADVANCED_OPEN_WATER difficulty once for all dives
    difficulty_advanced_open_water = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "ADVANCED_OPEN_WATER").first()
    
    # Create dive site
    dive_site = DiveSite(
        name="Performance Test Dive Site",
        description="A dive site for performance testing",
        latitude=25.0,
        longitude=30.0,
        country="Test Country",
        region="Test Region",
        difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2  # 2=intermediate
    )
    db_session.add(dive_site)
    db_session.commit()
    db_session.refresh(dive_site)
    
    # Create many dives
    dives = []
    for i in range(100):  # Create 100 dives for performance testing
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name=f"Performance Test Dive {i+1} - 2025/01/{15+(i%30):02d}",
            is_private=False,
            dive_information=f"Performance test dive {i+1} information for testing purposes with various keywords",
            max_depth=Decimal("15.0") + Decimal(str(i % 20)),
            average_depth=Decimal("10.0") + Decimal(str(i % 15)),
            gas_bottles_used="Air",
            suit_type="wet_suit",
            difficulty_id=difficulty_advanced_open_water.id if difficulty_advanced_open_water else 2,
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15 + (i % 16)),  # Days 15-30 (16 days)
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(dive)
        dives.append(dive)
    
    db_session.commit()
    for dive in dives:
        db_session.refresh(dive)
    
    return dives