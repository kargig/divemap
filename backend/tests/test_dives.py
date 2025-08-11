import pytest
from fastapi import status
from datetime import datetime, date
from decimal import Decimal

from app.models import Dive, DiveSite, DiveMedia, DiveTag, AvailableTag


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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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

        response = client.get(f"/api/v1/dives/?user_id={test_user.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive.id

    def test_filter_dives_by_date_range(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test filtering dives by date range."""
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

        response = client.get("/api/v1/dives/?start_date=2025-01-01&end_date=2025-01-31", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive.id

    def test_filter_dives_by_depth(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test filtering dives by depth range."""
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Test Dive",
            is_private=False,
            max_depth=Decimal("18.5"),
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
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
        # Create another dive site with a different name
        from app.models import DiveSite
        other_dive_site = DiveSite(
            name="Another Test Site",
            description="Another test dive site",
            latitude=Decimal("25.7617"),
            longitude=Decimal("-80.1918"),
            address="123 Other Street, Miami, FL",
            country="USA",
            region="Florida"
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
            duration=45
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
            duration=50
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
            difficulty_level="intermediate",
            visibility_rating=8,
            user_rating=9,
            dive_date=date(2025, 1, 15),
            dive_time=datetime.strptime("10:30:00", "%H:%M:%S").time(),
            duration=45
        )
        db_session.add(public_dive)

        # Create a private dive by the other user
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
            difficulty_level="advanced",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="advanced",
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
            difficulty_level="intermediate",
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
            difficulty_level="intermediate",
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
            difficulty_level="beginner",
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

        for i, name in enumerate(dive_names):
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
                difficulty_level="beginner",
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
        assert "page_size must be one of: 25, 50, 100" in response.json()["detail"]

    def test_get_dives_pagination_with_filters(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test pagination with filters applied."""
        # Create dives with different difficulty levels
        dive_names = [
            "Advanced Dive - 2025/01/01",
            "Beginner Dive - 2025/01/02",
            "Expert Dive - 2025/01/03",
            "Intermediate Dive - 2025/01/04"
        ]

        difficulty_levels = ["advanced", "beginner", "expert", "intermediate"]

        for i, (name, difficulty) in enumerate(zip(dive_names, difficulty_levels)):
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
                difficulty_level=difficulty,
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
            "/api/v1/dives/?page=1&page_size=25&difficulty_level=beginner",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1  # Only one beginner dive
        assert data[0]["name"] == "Beginner Dive - 2025/01/02"
        assert data[0]["difficulty_level"] == "beginner"

        # Check pagination headers reflect filtered results
        assert response.headers["x-total-count"] == "1"
        assert response.headers["x-total-pages"] == "1"
        assert response.headers["x-has-next-page"] == "false"