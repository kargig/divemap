"""
Tests for dive buddies functionality.

Tests cover:
- User search endpoint
- Dive creation with buddies
- Dive update with buddies
- Buddy management endpoints (add, remove, replace)
- Buddy filtering in dive list
- Permission enforcement
- Visibility settings
"""
import pytest
from fastapi import status
from datetime import datetime, date
from decimal import Decimal

from app.models import Dive, User, DiveBuddy, DiveSite, DifficultyLevel


class TestUserSearch:
    """Test user search endpoint for buddy selection."""

    def test_search_users_returns_public_users_only(self, client, auth_headers, db_session):
        """Test that user search only returns users with buddy_visibility='public'."""
        # Create a public user
        public_user = User(
            username="publicuser",
            email="public@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(public_user)
        
        # Create a private user
        private_user = User(
            username="privateuser",
            email="private@example.com",
            password_hash="hashed_password",
            buddy_visibility="private",
            enabled=True
        )
        db_session.add(private_user)
        db_session.commit()

        response = client.get("/api/v1/users/search?query=user", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        usernames = [user["username"] for user in data]
        assert "publicuser" in usernames
        assert "privateuser" not in usernames

    def test_search_users_excludes_current_user(self, client, auth_headers, test_user, db_session):
        """Test that user search excludes the current user."""
        # Create another public user
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        response = client.get("/api/v1/users/search?query=user", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        usernames = [user["username"] for user in data]
        assert test_user.username not in usernames
        assert "otheruser" in usernames

    def test_search_users_by_username(self, client, auth_headers, db_session):
        """Test searching users by username."""
        user = User(
            username="searchtest",
            email="search@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True,
            name="Search Test User"
        )
        db_session.add(user)
        db_session.commit()

        response = client.get("/api/v1/users/search?query=searchtest", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 1
        assert data[0]["username"] == "searchtest"
        assert data[0]["name"] == "Search Test User"

    def test_search_users_by_name(self, client, auth_headers, db_session):
        """Test searching users by name."""
        user = User(
            username="nametest",
            email="name@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True,
            name="John Doe"
        )
        db_session.add(user)
        db_session.commit()

        response = client.get("/api/v1/users/search?query=John", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data) == 1
        assert data[0]["username"] == "nametest"
        assert data[0]["name"] == "John Doe"

    def test_search_users_requires_authentication(self, client):
        """Test that user search requires authentication."""
        response = client.get("/api/v1/users/search?query=test")
        # Can be either 401 or 403 depending on auth middleware
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    def test_search_users_excludes_disabled_users(self, client, auth_headers, db_session):
        """Test that disabled users are not returned in search."""
        disabled_user = User(
            username="disableduser",
            email="disabled@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=False
        )
        db_session.add(disabled_user)
        db_session.commit()

        response = client.get("/api/v1/users/search?query=disabled", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        usernames = [user["username"] for user in data]
        assert "disableduser" not in usernames


class TestDiveCreationWithBuddies:
    """Test dive creation with buddies."""

    def test_create_dive_with_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test creating a dive with buddies."""
        # Create buddy users
        buddy1 = User(
            username="buddy1",
            email="buddy1@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        buddy2 = User(
            username="buddy2",
            email="buddy2@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy1)
        db_session.add(buddy2)
        db_session.commit()

        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15",
            "buddies": [buddy1.id, buddy2.id]
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert "buddies" in data
        assert len(data["buddies"]) == 2
        buddy_ids = [b["id"] for b in data["buddies"]]
        assert buddy1.id in buddy_ids
        assert buddy2.id in buddy_ids

    def test_create_dive_with_private_buddy_fails(self, client, auth_headers, test_dive_site, db_session):
        """Test that creating a dive with a private visibility user fails."""
        private_buddy = User(
            username="privatebuddy",
            email="private@example.com",
            password_hash="hashed_password",
            buddy_visibility="private",
            enabled=True
        )
        db_session.add(private_buddy)
        db_session.commit()

        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15",
            "buddies": [private_buddy.id]
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "private visibility" in response.json()["detail"].lower()

    def test_create_dive_with_self_as_buddy_fails(self, client, auth_headers, test_user, test_dive_site):
        """Test that adding yourself as a buddy fails."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15",
            "buddies": [test_user.id]
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "yourself" in response.json()["detail"].lower()

    def test_create_dive_with_invalid_buddy_id_fails(self, client, auth_headers, test_dive_site):
        """Test that creating a dive with invalid buddy ID fails."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15",
            "buddies": [99999]  # Non-existent user ID
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_dive_without_buddies(self, client, auth_headers, test_dive_site):
        """Test creating a dive without buddies returns empty buddies list."""
        dive_data = {
            "dive_site_id": test_dive_site.id,
            "dive_date": "2025-01-15"
        }

        response = client.post("/api/v1/dives/", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert "buddies" in data
        assert data["buddies"] == []


class TestDiveUpdateWithBuddies:
    """Test dive update with buddies."""

    def test_update_dive_add_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test updating a dive to add buddies."""
        # Create dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        # Create buddy
        buddy = User(
            username="updatebuddy",
            email="update@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        update_data = {
            "buddies": [buddy.id]
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data["buddies"]) == 1
        assert data["buddies"][0]["id"] == buddy.id

    def test_update_dive_replace_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test updating a dive to replace buddies."""
        # Create dive with one buddy
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        buddy1 = User(
            username="buddy1",
            email="buddy1@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        buddy2 = User(
            username="buddy2",
            email="buddy2@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy1)
        db_session.add(buddy2)
        db_session.commit()

        # Add first buddy
        dive_buddy1 = DiveBuddy(dive_id=dive.id, user_id=buddy1.id)
        db_session.add(dive_buddy1)
        db_session.commit()

        # Replace with second buddy
        update_data = {
            "buddies": [buddy2.id]
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data["buddies"]) == 1
        assert data["buddies"][0]["id"] == buddy2.id

    def test_update_dive_remove_all_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test updating a dive to remove all buddies."""
        # Create dive with buddy
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        buddy = User(
            username="removebuddy",
            email="remove@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        dive_buddy = DiveBuddy(dive_id=dive.id, user_id=buddy.id)
        db_session.add(dive_buddy)
        db_session.commit()

        # Remove all buddies
        update_data = {
            "buddies": []
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["buddies"] == []


class TestBuddyManagementEndpoints:
    """Test buddy management endpoints (POST, PUT, DELETE)."""

    def test_add_buddies_to_dive(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test adding buddies to a dive via POST endpoint."""
        # Create dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        # Create buddies
        buddy1 = User(
            username="addbuddy1",
            email="add1@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        buddy2 = User(
            username="addbuddy2",
            email="add2@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy1)
        db_session.add(buddy2)
        db_session.commit()

        response = client.post(
            f"/api/v1/dives/{dive.id}/buddies",
            json={"buddy_ids": [buddy1.id, buddy2.id]},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["added_count"] == 2

        # Verify buddies were added
        get_response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert get_response.status_code == status.HTTP_200_OK
        dive_data = get_response.json()
        assert len(dive_data["buddies"]) == 2

    def test_add_buddies_non_owner_fails(self, client, auth_headers, test_dive_site, db_session, test_user_other):
        """Test that non-owner cannot add buddies."""
        # Use test_user_other fixture instead of creating new user
        other_user = test_user_other

        dive = Dive(
            user_id=other_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Other User's Dive"
        )
        db_session.add(dive)
        db_session.commit()

        buddy = User(
            username="testbuddy",
            email="testbuddy@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        response = client.post(
            f"/api/v1/dives/{dive.id}/buddies",
            json={"buddy_ids": [buddy.id]},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_replace_dive_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test replacing all buddies via PUT endpoint."""
        # Create dive with one buddy
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        buddy1 = User(
            username="replacebuddy1",
            email="replace1@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        buddy2 = User(
            username="replacebuddy2",
            email="replace2@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy1)
        db_session.add(buddy2)
        db_session.commit()

        # Add first buddy
        dive_buddy1 = DiveBuddy(dive_id=dive.id, user_id=buddy1.id)
        db_session.add(dive_buddy1)
        db_session.commit()

        # Replace with second buddy
        response = client.put(
            f"/api/v1/dives/{dive.id}/buddies",
            json={"buddy_ids": [buddy2.id]},
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        # Verify replacement
        get_response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        dive_data = get_response.json()
        assert len(dive_data["buddies"]) == 1
        assert dive_data["buddies"][0]["id"] == buddy2.id

    def test_remove_buddy_as_owner(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test removing a buddy as dive owner."""
        # Create dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        buddy = User(
            username="removebuddy",
            email="remove@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        # Add buddy
        dive_buddy = DiveBuddy(dive_id=dive.id, user_id=buddy.id)
        db_session.add(dive_buddy)
        db_session.commit()

        # Remove buddy
        response = client.delete(
            f"/api/v1/dives/{dive.id}/buddies/{buddy.id}",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        # Verify removal
        get_response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        dive_data = get_response.json()
        assert len(dive_data["buddies"]) == 0

    def test_remove_self_as_buddy(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test that a buddy can remove themselves."""
        # Create another user and dive
        dive_owner = User(
            username="diveowner",
            email="owner@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(dive_owner)
        db_session.commit()

        dive = Dive(
            user_id=dive_owner.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Owner's Dive"
        )
        db_session.add(dive)
        db_session.commit()

        # Add test_user as buddy
        dive_buddy = DiveBuddy(dive_id=dive.id, user_id=test_user.id)
        db_session.add(dive_buddy)
        db_session.commit()

        # Test user removes themselves
        response = client.delete(
            f"/api/v1/dives/{dive.id}/buddies/{test_user.id}",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        # Verify removal
        get_response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        dive_data = get_response.json()
        assert len(dive_data["buddies"]) == 0

    def test_remove_buddy_non_owner_non_buddy_fails(self, client, auth_headers, test_dive_site, db_session):
        """Test that a user who is neither owner nor buddy cannot remove buddies."""
        # Create users
        owner = User(
            username="owner",
            email="owner@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        buddy = User(
            username="buddy",
            email="buddy@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(owner)
        db_session.add(buddy)
        db_session.commit()

        dive = Dive(
            user_id=owner.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Owner's Dive"
        )
        db_session.add(dive)
        db_session.commit()

        # Add buddy
        dive_buddy = DiveBuddy(dive_id=dive.id, user_id=buddy.id)
        db_session.add(dive_buddy)
        db_session.commit()

        # Test user (not owner, not buddy) tries to remove
        response = client.delete(
            f"/api/v1/dives/{dive.id}/buddies/{buddy.id}",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestBuddyFiltering:
    """Test buddy filtering in dive list endpoints."""

    def test_filter_dives_by_buddy_id(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test filtering dives by buddy_id."""
        # Create buddy
        buddy = User(
            username="filterbuddy",
            email="filter@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        # Create two dives
        dive1 = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Dive with Buddy"
        )
        dive2 = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 16),
            name="Dive without Buddy"
        )
        db_session.add(dive1)
        db_session.add(dive2)
        db_session.commit()

        # Add buddy only to dive1
        dive_buddy = DiveBuddy(dive_id=dive1.id, user_id=buddy.id)
        db_session.add(dive_buddy)
        db_session.commit()

        # Filter by buddy_id
        response = client.get(f"/api/v1/dives/?buddy_id={buddy.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive1.id

    def test_filter_dives_by_buddy_username(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test filtering dives by buddy_username."""
        # Create buddy
        buddy = User(
            username="usernamebuddy",
            email="username@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        # Create dive with buddy
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Dive with Username Buddy"
        )
        db_session.add(dive)
        db_session.commit()

        dive_buddy = DiveBuddy(dive_id=dive.id, user_id=buddy.id)
        db_session.add(dive_buddy)
        db_session.commit()

        # Filter by buddy_username
        response = client.get(
            f"/api/v1/dives/?buddy_username=usernamebuddy",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == dive.id

    def test_filter_dives_by_invalid_buddy_username_returns_empty(self, client, auth_headers):
        """Test filtering by non-existent buddy username returns empty results (prevents username enumeration)."""
        response = client.get(
            "/api/v1/dives/?buddy_username=nonexistent",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []  # Should return empty list, not error

    def test_filter_dives_count_by_buddy(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test filtering dive count by buddy."""
        # Create buddy
        buddy = User(
            username="countbuddy",
            email="count@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()

        # Create dives
        for i in range(3):
            dive = Dive(
                user_id=test_user.id,
                dive_site_id=test_dive_site.id,
                dive_date=date(2025, 1, 15 + i),
                name=f"Dive {i+1}"
            )
            db_session.add(dive)
            db_session.commit()

            # Add buddy to first two dives
            if i < 2:
                dive_buddy = DiveBuddy(dive_id=dive.id, user_id=buddy.id)
                db_session.add(dive_buddy)
        db_session.commit()

        # Count dives with buddy
        response = client.get(f"/api/v1/dives/count?buddy_id={buddy.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # Should count only dives with this buddy (2 dives)
        assert data["total"] == 2


class TestBuddyVisibility:
    """Test buddy visibility settings."""

    def test_update_buddy_visibility_to_private(self, client, auth_headers, test_user, db_session):
        """Test updating buddy visibility to private."""
        update_data = {
            "buddy_visibility": "private"
        }

        response = client.put("/api/v1/users/me", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # Note: UserResponse might not include buddy_visibility, but it should be updated in DB
        db_session.refresh(test_user)
        assert test_user.buddy_visibility == "private"

    def test_update_buddy_visibility_to_public(self, client, auth_headers, test_user, db_session):
        """Test updating buddy visibility to public."""
        # First set to private
        test_user.buddy_visibility = "private"
        db_session.commit()

        update_data = {
            "buddy_visibility": "public"
        }

        response = client.put("/api/v1/users/me", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        db_session.refresh(test_user)
        assert test_user.buddy_visibility == "public"

    def test_update_buddy_visibility_invalid_value_fails(self, client, auth_headers):
        """Test that invalid buddy_visibility value is rejected."""
        update_data = {
            "buddy_visibility": "invalid"
        }

        response = client.put("/api/v1/users/me", json=update_data, headers=auth_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetDiveWithBuddies:
    """Test GET dive endpoint includes buddies."""

    def test_get_dive_with_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test that GET dive endpoint includes buddies in response."""
        # Create dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        # Create and add buddies
        buddy1 = User(
            username="getbuddy1",
            email="get1@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True,
            name="Buddy One"
        )
        buddy2 = User(
            username="getbuddy2",
            email="get2@example.com",
            password_hash="hashed_password",
            buddy_visibility="public",
            enabled=True,
            name="Buddy Two"
        )
        db_session.add(buddy1)
        db_session.add(buddy2)
        db_session.commit()

        dive_buddy1 = DiveBuddy(dive_id=dive.id, user_id=buddy1.id)
        dive_buddy2 = DiveBuddy(dive_id=dive.id, user_id=buddy2.id)
        db_session.add(dive_buddy1)
        db_session.add(dive_buddy2)
        db_session.commit()

        # Get dive
        response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert "buddies" in data
        assert len(data["buddies"]) == 2
        
        # Verify buddy details
        buddy_ids = [b["id"] for b in data["buddies"]]
        assert buddy1.id in buddy_ids
        assert buddy2.id in buddy_ids
        
        # Check buddy details structure
        for buddy in data["buddies"]:
            assert "id" in buddy
            assert "username" in buddy
            assert "name" in buddy
            assert "avatar_url" in buddy

    def test_get_dive_without_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test that GET dive endpoint returns empty buddies list when no buddies."""
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Test Dive"
        )
        db_session.add(dive)
        db_session.commit()

        response = client.get(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert "buddies" in data
        assert data["buddies"] == []


class TestMultipleBuddies:
    """Test multiple buddies per dive."""

    def test_dive_with_multiple_buddies(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test that a dive can have multiple buddies."""
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Multi-Buddy Dive"
        )
        db_session.add(dive)
        db_session.commit()

        # Create multiple buddies
        buddies = []
        for i in range(5):
            buddy = User(
                username=f"multibuddy{i}",
                email=f"multi{i}@example.com",
                password_hash="hashed_password",
                buddy_visibility="public",
                enabled=True
            )
            db_session.add(buddy)
            buddies.append(buddy)
        db_session.commit()

        # Add all buddies
        buddy_ids = [b.id for b in buddies]
        dive_data = {
            "buddies": buddy_ids
        }

        response = client.put(f"/api/v1/dives/{dive.id}", json=dive_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data["buddies"]) == 5

    def test_add_too_many_buddies_fails_validation(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test that adding more than 20 buddies fails validation."""
        # Create a dive first
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            dive_date=date(2025, 1, 15),
            name="Max buddies test"
        )
        db_session.add(dive)
        db_session.commit()

        # Create 21 buddies
        buddies = []
        for i in range(21):
            buddy = User(
                username=f"maxbuddy{i}",
                email=f"maxbuddy{i}@example.com",
                password_hash="hashed_password",
                buddy_visibility="public",
                enabled=True
            )
            db_session.add(buddy)
            buddies.append(buddy)
        db_session.commit()

        # Try to add 21 buddies via POST endpoint
        response = client.post(
            f"/api/v1/dives/{dive.id}/buddies",
            json={"buddy_ids": [b.id for b in buddies]},
            headers=auth_headers
        )
        # Should fail validation due to max_items=20 constraint
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_add_too_many_buddies_fails_validation(self, client, auth_headers, test_user, test_dive_site, db_session):
        """Test that adding more than 20 buddies fails validation."""
        # Create 21 buddies
        buddies = []
        for i in range(21):
            buddy = User(
                username=f"maxbuddy{i}",
                email=f"maxbuddy{i}@example.com",
                password_hash="hashed_password",
                buddy_visibility="public",
                enabled=True
            )
            db_session.add(buddy)
            buddies.append(buddy)
        db_session.commit()

        # Try to add 21 buddies via POST endpoint
        response = client.post(
            f"/api/v1/dives/{test_dive_site.id}/buddies",
            json={"buddy_ids": [b.id for b in buddies]},
            headers=auth_headers
        )
        # Should fail validation due to max_items=20 constraint
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
