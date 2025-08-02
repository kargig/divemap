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