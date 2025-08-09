import pytest
from fastapi import status
from datetime import date, time
from app.models import Newsletter, ParsedDiveTrip, ParsedDive, DivingCenter, DiveSite


class TestNewsletters:
    """Test newsletter endpoints with permission changes."""

    def test_get_newsletters_admin_success(self, client, admin_headers, db_session):
        """Test getting newsletters as admin."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test newsletter content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.get("/api/v1/newsletters/", headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["content"] == "Test newsletter content"
        assert "trips_count" in data[0]

    def test_get_newsletters_moderator_success(self, client, moderator_headers, db_session):
        """Test getting newsletters as moderator."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test newsletter content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.get("/api/v1/newsletters/", headers=moderator_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["content"] == "Test newsletter content"
        assert "trips_count" in data[0]

    def test_get_newsletters_regular_user_forbidden(self, client, auth_headers):
        """Test getting newsletters as regular user."""
        response = client.get("/api/v1/newsletters/", headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can view newsletters" in response.json()["detail"]

    def test_get_newsletters_unauthorized(self, client):
        """Test getting newsletters without authentication."""
        response = client.get("/api/v1/newsletters/")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_upload_newsletter_admin_success(self, client, admin_headers):
        """Test uploading newsletter as admin."""
        # Create a simple text file content
        content = "Test newsletter content for parsing"

        response = client.post(
            "/api/v1/newsletters/upload",
            files={"file": ("test.txt", content, "text/plain")},
            data={"use_openai": "false"},
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "newsletter_id" in data
        assert "trips_created" in data
        assert "message" in data

    def test_upload_newsletter_moderator_success(self, client, moderator_headers):
        """Test uploading newsletter as moderator."""
        # Create a simple text file content
        content = "Test newsletter content for parsing"

        response = client.post(
            "/api/v1/newsletters/upload",
            files={"file": ("test.txt", content, "text/plain")},
            data={"use_openai": "false"},
            headers=moderator_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "newsletter_id" in data
        assert "trips_created" in data
        assert "message" in data

    def test_upload_newsletter_regular_user_forbidden(self, client, auth_headers):
        """Test uploading newsletter as regular user."""
        content = "Test newsletter content for parsing"

        response = client.post(
            "/api/v1/newsletters/upload",
            files={"file": ("test.txt", content, "text/plain")},
            data={"use_openai": "false"},
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can upload newsletters" in response.json()["detail"]

    def test_update_newsletter_admin_success(self, client, admin_headers, db_session):
        """Test updating newsletter as admin."""
        # Create a test newsletter
        newsletter = Newsletter(content="Original content")
        db_session.add(newsletter)
        db_session.commit()

        update_data = {"content": "Updated content"}

        response = client.put(
            f"/api/v1/newsletters/{newsletter.id}",
            json=update_data,
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["content"] == "Updated content"

    def test_update_newsletter_moderator_success(self, client, moderator_headers, db_session):
        """Test updating newsletter as moderator."""
        # Create a test newsletter
        newsletter = Newsletter(content="Original content")
        db_session.add(newsletter)
        db_session.commit()

        update_data = {"content": "Updated content"}

        response = client.put(
            f"/api/v1/newsletters/{newsletter.id}",
            json=update_data,
            headers=moderator_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["content"] == "Updated content"

    def test_update_newsletter_regular_user_forbidden(self, client, auth_headers, db_session):
        """Test updating newsletter as regular user."""
        # Create a test newsletter
        newsletter = Newsletter(content="Original content")
        db_session.add(newsletter)
        db_session.commit()

        update_data = {"content": "Updated content"}

        response = client.put(
            f"/api/v1/newsletters/{newsletter.id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can update newsletters" in response.json()["detail"]

    def test_delete_newsletter_admin_success(self, client, admin_headers, db_session):
        """Test deleting newsletter as admin."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.delete(
            f"/api/v1/newsletters/{newsletter.id}",
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert "Newsletter and" in response.json()["message"]
        assert "deleted successfully" in response.json()["message"]

    def test_delete_newsletter_moderator_success(self, client, moderator_headers, db_session):
        """Test deleting newsletter as moderator."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.delete(
            f"/api/v1/newsletters/{newsletter.id}",
            headers=moderator_headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert "Newsletter and" in response.json()["message"]
        assert "deleted successfully" in response.json()["message"]

    def test_delete_newsletter_regular_user_forbidden(self, client, auth_headers, db_session):
        """Test deleting newsletter as regular user."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.delete(
            f"/api/v1/newsletters/{newsletter.id}",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can delete newsletters" in response.json()["detail"]

    def test_create_parsed_trip_admin_success(self, client, admin_headers, db_session):
        """Test creating parsed trip as admin."""
        # Create required dependencies
        diving_center = DivingCenter(name="Test Center", email="test@center.com")
        db_session.add(diving_center)
        db_session.commit()

        trip_data = {
            "diving_center_id": diving_center.id,
            "trip_date": "2024-01-15",
            "trip_time": "09:00:00",
            "trip_duration": 480,
            "trip_difficulty_level": "intermediate",
            "trip_price": 100.0,
            "trip_currency": "EUR",
            "group_size_limit": 8,
            "trip_description": "Test trip",
            "trip_status": "scheduled",
            "dives": []
        }

        response = client.post(
            "/api/v1/newsletters/trips",
            json=trip_data,
            headers=admin_headers
        )

        # Check if it's a validation error, print details for debugging
        if response.status_code == 422:
            print(f"Validation error: {response.json()}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["diving_center_id"] == diving_center.id
        assert data["trip_date"] == "2024-01-15"
        assert len(data["dives"]) == 0

    def test_create_parsed_trip_moderator_success(self, client, moderator_headers, db_session):
        """Test creating parsed trip as moderator."""
        # Create required dependencies
        diving_center = DivingCenter(name="Test Center", email="test@center.com")
        db_session.add(diving_center)
        db_session.commit()

        trip_data = {
            "diving_center_id": diving_center.id,
            "trip_date": "2024-01-15",
            "trip_time": "09:00:00",
            "trip_duration": 480,
            "trip_difficulty_level": "intermediate",
            "trip_price": 100.0,
            "trip_currency": "EUR",
            "group_size_limit": 8,
            "trip_description": "Test trip",
            "trip_status": "scheduled",
            "dives": []
        }

        response = client.post(
            "/api/v1/newsletters/trips",
            json=trip_data,
            headers=moderator_headers
        )

        # Check if it's a validation error, print details for debugging
        if response.status_code == 422:
            print(f"Validation error: {response.json()}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["diving_center_id"] == diving_center.id
        assert data["trip_date"] == "2024-01-15"
        assert len(data["dives"]) == 0

    def test_create_parsed_trip_regular_user_forbidden(self, client, auth_headers, db_session):
        """Test creating parsed trip as regular user."""
        trip_data = {
            "trip_date": "2024-01-15",
            "trip_description": "Test trip"
        }

        response = client.post(
            "/api/v1/newsletters/trips",
            json=trip_data,
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can create dive trips" in response.json()["detail"]

    def test_update_parsed_trip_admin_success(self, client, admin_headers, db_session):
        """Test updating parsed trip as admin."""
        # Create a test trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 1, 15),
            trip_description="Original description",
            trip_status="scheduled"
        )
        db_session.add(trip)
        db_session.commit()

        update_data = {
            "trip_description": "Updated description",
            "trip_status": "confirmed"
        }

        response = client.put(
            f"/api/v1/newsletters/trips/{trip.id}",
            json=update_data,
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["trip_description"] == "Updated description"
        assert data["trip_status"] == "confirmed"

    def test_update_parsed_trip_moderator_success(self, client, moderator_headers, db_session):
        """Test updating parsed trip as moderator."""
        # Create a test trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 1, 15),
            trip_description="Original description",
            trip_status="scheduled"
        )
        db_session.add(trip)
        db_session.commit()

        update_data = {
            "trip_description": "Updated description",
            "trip_status": "confirmed"
        }

        response = client.put(
            f"/api/v1/newsletters/trips/{trip.id}",
            json=update_data,
            headers=moderator_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["trip_description"] == "Updated description"
        assert data["trip_status"] == "confirmed"

    def test_update_parsed_trip_regular_user_forbidden(self, client, auth_headers, db_session):
        """Test updating parsed trip as regular user."""
        # Create a test trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 1, 15),
            trip_description="Original description",
            trip_status="scheduled"
        )
        db_session.add(trip)
        db_session.commit()

        update_data = {
            "trip_description": "Updated description",
            "trip_status": "confirmed"
        }

        response = client.put(
            f"/api/v1/newsletters/trips/{trip.id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can update dive trips" in response.json()["detail"]

    def test_delete_parsed_trip_admin_success(self, client, admin_headers, db_session):
        """Test deleting parsed trip as admin."""
        # Create a test trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 1, 15),
            trip_description="Test trip"
        )
        db_session.add(trip)
        db_session.commit()

        response = client.delete(
            f"/api/v1/newsletters/trips/{trip.id}",
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert "Trip deleted successfully" in response.json()["message"]

    def test_delete_parsed_trip_moderator_success(self, client, moderator_headers, db_session):
        """Test deleting parsed trip as moderator."""
        # Create a test trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 1, 15),
            trip_description="Test trip"
        )
        db_session.add(trip)
        db_session.commit()

        response = client.delete(
            f"/api/v1/newsletters/trips/{trip.id}",
            headers=moderator_headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert "Trip deleted successfully" in response.json()["message"]

    def test_delete_parsed_trip_regular_user_forbidden(self, client, auth_headers, db_session):
        """Test deleting parsed trip as regular user."""
        # Create a test trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 1, 15),
            trip_description="Test trip"
        )
        db_session.add(trip)
        db_session.commit()

        response = client.delete(
            f"/api/v1/newsletters/trips/{trip.id}",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can delete dive trips" in response.json()["detail"]

    def test_reparse_newsletter_admin_success(self, client, admin_headers, db_session):
        """Test re-parsing newsletter as admin."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test newsletter content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.post(
            f"/api/v1/newsletters/{newsletter.id}/reparse",
            data={"use_openai": "false"},
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "Newsletter re-parsed successfully" in data["message"]

    def test_reparse_newsletter_moderator_success(self, client, moderator_headers, db_session):
        """Test re-parsing newsletter as moderator."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test newsletter content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.post(
            f"/api/v1/newsletters/{newsletter.id}/reparse",
            data={"use_openai": "false"},
            headers=moderator_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "Newsletter re-parsed successfully" in data["message"]

    def test_reparse_newsletter_regular_user_forbidden(self, client, auth_headers, db_session):
        """Test re-parsing newsletter as regular user."""
        # Create a test newsletter
        newsletter = Newsletter(content="Test newsletter content")
        db_session.add(newsletter)
        db_session.commit()

        response = client.post(
            f"/api/v1/newsletters/{newsletter.id}/reparse",
            data={"use_openai": "false"},
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only admins and moderators can reparse newsletters" in response.json()["detail"]
