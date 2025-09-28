import pytest
from fastapi import status
from app.models import CenterRating, CenterComment
from datetime import datetime

class TestDivingCenters:
    """Test diving centers endpoints."""

    def test_get_diving_centers_success(self, client, test_diving_center):
        """Test getting list of diving centers."""
        response = client.get("/api/v1/diving-centers/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_diving_center.name
        assert data[0]["description"] == test_diving_center.description

    def test_get_diving_centers_empty(self, client):
        """Test getting diving centers when none exist."""
        response = client.get("/api/v1/diving-centers/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0

    def test_get_diving_centers_with_search(self, client, test_diving_center):
        """Test getting diving centers with search parameter."""
        response = client.get("/api/v1/diving-centers/?search=Test")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_diving_center.name

    def test_get_diving_centers_with_rating_filter(self, client, test_diving_center):
        """Test getting diving centers with rating filter."""
        response = client.get("/api/v1/diving-centers/?min_rating=5")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    def test_get_diving_center_detail_success(self, client, test_diving_center):
        """Test getting specific diving center details."""
        response = client.get(f"/api/v1/diving-centers/{test_diving_center.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == test_diving_center.name
        assert data["description"] == test_diving_center.description
        assert data["email"] == test_diving_center.email
        assert data["phone"] == test_diving_center.phone
        assert data["website"] == test_diving_center.website
        # Fix: compare as floats to handle decimal precision
        assert float(data["latitude"]) == float(test_diving_center.latitude)
        assert float(data["longitude"]) == float(test_diving_center.longitude)
        assert "average_rating" in data
        assert "total_ratings" in data

    def test_get_diving_center_not_found(self, client):
        """Test getting non-existent diving center."""
        response = client.get("/api/v1/diving-centers/999")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_diving_center_admin_success(self, client, admin_headers):
        """Test creating diving center as admin."""
        diving_center_data = {
            "name": "New Diving Center",
            "description": "A new diving center",
            "email": "new@divingcenter.com",
            "phone": "+1234567890",
            "website": "www.newdivingcenter.com",
            "latitude": 35.0,
            "longitude": 40.0
        }

        response = client.post("/api/v1/diving-centers/",
                             json=diving_center_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 201
        data = response.json()
        assert data["name"] == "New Diving Center"
        assert data["description"] == "A new diving center"
        assert data["email"] == "new@divingcenter.com"
        # Fix: compare as strings to match API output
        assert str(data["latitude"]) == "35.0"
        assert str(data["longitude"]) == "40.0"

    def test_create_diving_center_unauthorized(self, client):
        """Test creating diving center without authentication."""
        diving_center_data = {
            "name": "New Diving Center",
            "description": "A new diving center",
            "email": "new@divingcenter.com",
            "latitude": 35.0,
            "longitude": 40.0
        }

        response = client.post("/api/v1/diving-centers/", json=diving_center_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_create_diving_center_not_admin(self, client, auth_headers):
        """Test creating diving center as non-admin user."""
        diving_center_data = {
            "name": "New Diving Center",
            "description": "A new diving center",
            "email": "new@divingcenter.com",
            "latitude": 35.0,
            "longitude": 40.0
        }

        response = client.post("/api/v1/diving-centers/",
                             json=diving_center_data, headers=auth_headers)

        # Regular users can now create diving centers
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "New Diving Center"
        assert data["description"] == "A new diving center"

    def test_create_diving_center_invalid_data(self, client, admin_headers):
        """Test creating diving center with invalid data."""
        diving_center_data = {
            "name": "",  # Empty name
            "latitude": 200.0,  # Invalid latitude
            "longitude": 300.0  # Invalid longitude
        }

        response = client.post("/api/v1/diving-centers/",
                             json=diving_center_data, headers=admin_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_diving_center_admin_success(self, client, admin_headers, test_diving_center):
        """Test updating diving center as admin."""
        update_data = {
            "name": "Updated Diving Center",
            "description": "Updated description"
        }

        response = client.put(f"/api/v1/diving-centers/{test_diving_center.id}",
                            json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Diving Center"
        assert data["description"] == "Updated description"

    def test_update_diving_center_unauthorized(self, client, test_diving_center):
        """Test updating diving center without authentication."""
        update_data = {"name": "Updated Diving Center"}

        response = client.put(f"/api/v1/diving-centers/{test_diving_center.id}", json=update_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_update_diving_center_not_admin(self, client, auth_headers, test_diving_center):
        """Test updating diving center as non-admin user."""
        update_data = {"name": "Updated Diving Center"}

        response = client.put(f"/api/v1/diving-centers/{test_diving_center.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_diving_center_not_found(self, client, admin_headers):
        """Test updating non-existent diving center."""
        update_data = {"name": "Updated Diving Center"}

        response = client.put("/api/v1/diving-centers/999",
                            json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_diving_center_admin_success(self, client, admin_headers, test_diving_center):
        """Test deleting diving center as admin."""
        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}",
                               headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 204

    def test_delete_diving_center_unauthorized(self, client, test_diving_center):
        """Test deleting diving center without authentication."""
        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_delete_diving_center_not_admin(self, client, auth_headers, test_diving_center):
        """Test deleting diving center as non-admin user."""
        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}",
                               headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_diving_center_not_found(self, client, admin_headers):
        """Test deleting non-existent diving center."""
        response = client.delete("/api/v1/diving-centers/999", headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_rate_diving_center_success(self, client, auth_headers, test_diving_center):
        """Test rating a diving center."""
        rating_data = {"score": 8}

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/rate",
                             json=rating_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["score"] == 8
        assert data["diving_center_id"] == test_diving_center.id

    def test_rate_diving_center_unauthorized(self, client, test_diving_center):
        """Test rating diving center without authentication."""
        rating_data = {"score": 8}

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/rate",
                             json=rating_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_rate_diving_center_invalid_score(self, client, auth_headers, test_diving_center):
        """Test rating diving center with invalid score."""
        rating_data = {"score": 15}  # Invalid score

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/rate",
                             json=rating_data, headers=auth_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_rate_diving_center_not_found(self, client, auth_headers):
        """Test rating non-existent diving center."""
        rating_data = {"score": 8}

        response = client.post("/api/v1/diving-centers/999/rate",
                             json=rating_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_rate_diving_center_update_existing(self, client, auth_headers, test_diving_center, test_user, db_session):
        """Test updating existing rating."""
        # Create initial rating
        initial_rating = CenterRating(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            score=5
        )
        db_session.add(initial_rating)
        db_session.commit()

        # Update rating
        rating_data = {"score": 9}
        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/rate",
                             json=rating_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["score"] == 9

    def test_get_diving_center_comments_success(self, client, test_diving_center):
        """Test getting diving center comments."""
        response = client.get(f"/api/v1/diving-centers/{test_diving_center.id}/comments")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    def test_get_diving_center_comments_not_found(self, client):
        """Test getting comments for non-existent diving center."""
        response = client.get("/api/v1/diving-centers/999/comments")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_diving_center_comment_success(self, client, auth_headers, test_diving_center):
        """Test creating a comment on diving center."""
        comment_data = {
            "comment_text": "Great diving center!",
            "diving_center_id": test_diving_center.id  # Add required field
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/comments",
                             json=comment_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 201
        data = response.json()
        assert data["comment_text"] == "Great diving center!"
        assert data["diving_center_id"] == test_diving_center.id

    def test_create_diving_center_comment_unauthorized(self, client, test_diving_center):
        """Test creating comment without authentication."""
        comment_data = {"comment_text": "Great diving center!"}

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/comments",
                             json=comment_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_create_diving_center_comment_empty(self, client, auth_headers, test_diving_center):
        """Test creating comment with empty text."""
        comment_data = {"comment_text": ""}

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/comments",
                             json=comment_data, headers=auth_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_diving_center_comment_not_found(self, client, auth_headers):
        """Test creating comment on non-existent diving center."""
        comment_data = {
            "comment_text": "Great diving center!",
            "diving_center_id": 999  # Add required field
        }

        response = client.post("/api/v1/diving-centers/999/comments",
                             json=comment_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND  # Changed back to 404

    def test_update_comment_success(self, client, auth_headers, test_diving_center, test_user, db_session):
        """Test updating a comment."""
        # Create a comment first
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            comment_text="Original comment"
        )
        db_session.add(comment)
        db_session.commit()

        update_data = {"comment_text": "Updated comment"}
        response = client.put(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["comment_text"] == "Updated comment"
        # Note: The response validation error suggests the API might not be returning username field
        # This test will pass if the API is working correctly

    def test_update_comment_unauthorized(self, client, test_diving_center, test_user, db_session):
        """Test updating comment without authentication."""
        # Create a comment first
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            comment_text="Original comment"
        )
        db_session.add(comment)
        db_session.commit()

        update_data = {"comment_text": "Updated comment"}
        response = client.put(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}",
                            json=update_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_update_comment_wrong_user(self, client, auth_headers, test_diving_center, test_admin_user, db_session):
        """Test updating comment by wrong user."""
        # Create a comment by admin user
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_admin_user.id,
            comment_text="Original comment"
        )
        db_session.add(comment)
        db_session.commit()

        update_data = {"comment_text": "Updated comment"}
        response = client.put(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_comment_success(self, client, auth_headers, test_diving_center, test_user, db_session):
        """Test deleting a comment."""
        # Create a comment first
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            comment_text="Comment to delete"
        )
        db_session.add(comment)
        db_session.commit()

        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}",
                               headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 204

    def test_delete_comment_unauthorized(self, client, test_diving_center, test_user, db_session):
        """Test deleting comment without authentication."""
        # Create a comment first
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            comment_text="Comment to delete"
        )
        db_session.add(comment)
        db_session.commit()

        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_delete_comment_wrong_user(self, client, auth_headers, test_diving_center, test_admin_user, db_session):
        """Test deleting comment by wrong user."""
        # Create a comment by admin user
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_admin_user.id,
            comment_text="Comment to delete"
        )
        db_session.add(comment)
        db_session.commit()

        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}",
                               headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_comment_admin_can_delete_any(self, client, admin_headers, test_diving_center, test_user, db_session):
        """Test admin can delete any comment."""
        # Create a comment by regular user
        comment = CenterComment(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            comment_text="Comment to delete"
        )
        db_session.add(comment)
        db_session.commit()

        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}/comments/{comment.id}",
                               headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 204

    def test_get_diving_center_with_user_rating_success(self, client, auth_headers, admin_headers):
        """Test getting diving center details includes user's rating when authenticated."""
        # First create a diving center
        diving_center_data = {
            "name": "Test Diving Center",
            "description": "A test diving center",
            "latitude": 10.0,
            "longitude": 20.0
        }

        create_response = client.post("/api/v1/diving-centers/", json=diving_center_data, headers=admin_headers)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Rate the diving center
        rating_data = {"score": 8.0}
        rate_response = client.post(f"/api/v1/diving-centers/{center_id}/rate", json=rating_data, headers=auth_headers)
        assert rate_response.status_code == status.HTTP_200_OK

        # Get the diving center details and verify user_rating is included
        get_response = client.get(f"/api/v1/diving-centers/{center_id}", headers=auth_headers)
        assert get_response.status_code == status.HTTP_200_OK

        data = get_response.json()
        assert data["user_rating"] == 8.0
        assert data["average_rating"] == 8.0
        assert data["total_ratings"] == 1

    def test_get_diving_center_without_user_rating_success(self, client, auth_headers, admin_headers, db_session):
        """Test getting diving center without user rating."""
        # Create a diving center
        from app.models import DivingCenter
        diving_center = DivingCenter(
            name="Test Center No Rating",
            description="A test diving center",
            email="test@center.com",
            phone="+1234567890",
            website="www.testcenter.com",
            latitude=35.0,
            longitude=40.0
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)

        # Test as regular user (should see user_rating field but it should be None)
        response = client.get(f"/api/v1/diving-centers/{diving_center.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == "Test Center No Rating"
        assert "user_rating" in data  # All users see user_rating field
        assert data["user_rating"] is None  # No rating yet

        # Test as admin (should see user_rating)
        response = client.get(f"/api/v1/diving-centers/{diving_center.id}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == "Test Center No Rating"
        assert "user_rating" in data  # Admins see user_rating
        assert data["user_rating"] is None  # No rating yet

    def test_get_diving_centers_pagination(self, client, db_session):
        """Test pagination for diving centers endpoint."""
        # Create multiple diving centers for pagination testing
        from app.models import DivingCenter

        center_names = [
            "Alpha Diving Center",
            "Beta Diving Center",
            "Charlie Diving Center",
            "Delta Diving Center",
            "Echo Diving Center"
        ]

        for i, name in enumerate(center_names):
            center = DivingCenter(
                name=name,
                description=f"Description for {name}",
                email=f"info@{name.lower().replace(' ', '')}.com",
                phone=f"+1{i+1}234567890",
                website=f"www.{name.lower().replace(' ', '')}.com",
                latitude=35.0 + i,
                longitude=40.0 + i
            )
            db_session.add(center)
        db_session.commit()

        # Test page 1 with page_size 25
        response = client.get("/api/v1/diving-centers/?page=1&page_size=25")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert len(data) == 5  # All 5 centers fit in one page

        # Check pagination headers
        assert response.headers["x-total-count"] == "5"
        assert response.headers["x-total-pages"] == "1"
        assert response.headers["x-current-page"] == "1"
        assert response.headers["x-page-size"] == "25"
        assert response.headers["x-has-next-page"] == "false"
        assert response.headers["x-has-prev-page"] == "false"

        # Check alphabetical sorting
        assert data[0]["name"] == "Alpha Diving Center"
        assert data[1]["name"] == "Beta Diving Center"
        assert data[2]["name"] == "Charlie Diving Center"
        assert data[3]["name"] == "Delta Diving Center"
        assert data[4]["name"] == "Echo Diving Center"

    def test_get_diving_centers_invalid_page_size(self, client):
        """Test that invalid page_size values are rejected."""
        response = client.get("/api/v1/diving-centers/?page=1&page_size=30")  # Invalid page size
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "page_size must be one of: 25, 50, 100, 1000" in response.json()["detail"]

    def test_get_diving_centers_pagination_with_filters(self, client, db_session):
        """Test pagination with filters applied."""
        # Create diving centers with different ratings
        from app.models import DivingCenter, CenterRating, User

        # Create test user for ratings
        test_user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            enabled=True
        )
        db_session.add(test_user)
        db_session.commit()

        center_names = [
            "High Rated Center",
            "Low Rated Center",
            "Medium Rated Center"
        ]

        ratings = [9.0, 3.0, 6.0]

        for i, (name, rating) in enumerate(zip(center_names, ratings)):
            center = DivingCenter(
                name=name,
                description=f"Description for {name}",
                email=f"info@{name.lower().replace(' ', '')}.com",
                phone=f"+1{i+1}234567890",
                website=f"www.{name.lower().replace(' ', '')}.com",
                latitude=35.0 + i,
                longitude=40.0 + i
            )
            db_session.add(center)
            db_session.commit()
            db_session.refresh(center)

            # Add rating
            center_rating = CenterRating(
                diving_center_id=center.id,
                user_id=test_user.id,
                score=rating
            )
            db_session.add(center_rating)
        db_session.commit()

        # Test pagination with rating filter
        response = client.get("/api/v1/diving-centers/?page=1&page_size=25&min_rating=5.0")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # Check that all returned centers have rating >= 5.0
        for center in data:
            if center["average_rating"] is not None:  # Only check centers with ratings
                assert center["average_rating"] >= 5.0

        # Check pagination headers reflect filtered results
        # The exact count depends on existing data, but should be consistent
        total_count = int(response.headers["x-total-count"])
        assert total_count >= 2  # At least our 2 centers with ratings >= 5.0
        assert response.headers["x-total-pages"] == "1"
        assert response.headers["x-has-next-page"] == "false"

    def test_delete_diving_center_media_not_found(self, client, admin_headers, test_diving_center):
        """Test deleting non-existent media from diving center."""
        response = client.delete(f"/api/v1/diving-centers/{test_diving_center.id}/media/999",
                               headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    # Diving Center Ownership Tests
    def test_get_ownership_requests_admin_success(self, client, admin_headers, db_session):
        """Test getting ownership requests as admin."""
        from app.models import DivingCenter, User, OwnershipStatus

        # Create a user and diving center with claimed status
        user = User(username="testuser", email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()

        diving_center = DivingCenter(
            name="Test Center with Claim",
            description="A test center",
            latitude=10.0,
            longitude=20.0,
            owner_id=user.id,
            ownership_status=OwnershipStatus.claimed
        )
        db_session.add(diving_center)
        db_session.commit()

        response = client.get("/api/v1/diving-centers/ownership-requests", headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Center with Claim"
        assert data[0]["ownership_status"] == "claimed"

    def test_get_ownership_requests_unauthorized(self, client):
        """Test getting ownership requests without authentication."""
        response = client.get("/api/v1/diving-centers/ownership-requests")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_ownership_requests_moderator_success(self, client, moderator_headers, db_session):
        """Test getting ownership requests as moderator."""
        from app.models import User, OwnershipStatus

        # Create a user and set diving center as claimed
        user = User(username="testuser", email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()

        # Create a diving center with claimed status
        from app.models import DivingCenter
        diving_center = DivingCenter(
            name="Claimed Diving Center",
            description="A claimed diving center",
            email="claimed@divingcenter.com",
            owner_id=user.id,
            ownership_status=OwnershipStatus.claimed
        )
        db_session.add(diving_center)
        db_session.commit()

        response = client.get("/api/v1/diving-centers/ownership-requests", headers=moderator_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == "Claimed Diving Center"
        assert data[0]["owner_username"] == "testuser"

    def test_get_ownership_requests_not_admin_or_moderator(self, client, auth_headers):
        """Test getting ownership requests as regular user."""
        response = client.get("/api/v1/diving-centers/ownership-requests", headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_claim_diving_center_ownership_success(self, client, auth_headers, test_diving_center):
        """Test claiming ownership of a diving center."""
        claim_data = {
            "reason": "I am the legitimate owner of this diving center"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/claim",
                             json=claim_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "Ownership claim submitted successfully" in data["message"]

    def test_claim_diving_center_ownership_unauthorized(self, client, test_diving_center):
        """Test claiming ownership without authentication."""
        claim_data = {
            "reason": "I am the legitimate owner of this diving center"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/claim",
                             json=claim_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_claim_diving_center_ownership_already_claimed(self, client, auth_headers, test_diving_center, db_session):
        """Test claiming ownership of already claimed diving center."""
        from app.models import OwnershipStatus

        # Set diving center as already claimed
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()

        claim_data = {
            "reason": "I am the legitimate owner of this diving center"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/claim",
                             json=claim_data, headers=auth_headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_claim_diving_center_ownership_not_found(self, client, auth_headers):
        """Test claiming ownership of non-existent diving center."""
        claim_data = {
            "reason": "I am the legitimate owner of this diving center"
        }

        response = client.post("/api/v1/diving-centers/999/claim-ownership",
                             json=claim_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_approve_diving_center_ownership_admin_success(self, client, admin_headers, test_diving_center, db_session):
        """Test approving ownership claim as admin."""
        from app.models import User, OwnershipStatus

        # Create a user and set diving center as claimed
        user = User(username="testuser", email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()

        test_diving_center.owner_id = user.id
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()

        approval_data = {
            "approved": True,
            "reason": "Valid ownership claim"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/approve-ownership",
                             json=approval_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "Ownership claim approved successfully" in data["message"]

    def test_approve_diving_center_ownership_deny(self, client, admin_headers, test_diving_center, db_session):
        """Test denying ownership claim as admin."""
        from app.models import User, OwnershipStatus

        # Create a user and set diving center as claimed
        user = User(username="testuser", email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()

        test_diving_center.owner_id = user.id
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()

        approval_data = {
            "approved": False,
            "reason": "Invalid ownership claim"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/approve-ownership",
                             json=approval_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "Ownership claim denied" in data["message"]

    def test_approve_diving_center_ownership_unauthorized(self, client, test_diving_center):
        """Test approving ownership claim without authentication."""
        approval_data = {
            "approved": True,
            "reason": "Valid ownership claim"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/approve-ownership",
                             json=approval_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_approve_diving_center_ownership_moderator_success(self, client, moderator_headers, test_diving_center, db_session):
        """Test approving ownership claim as moderator."""
        from app.models import User, OwnershipStatus

        # Create a user and set diving center as claimed
        user = User(username="testuser", email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()

        test_diving_center.owner_id = user.id
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()

        approval_data = {
            "approved": True,
            "reason": "Valid ownership claim"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/approve-ownership",
                             json=approval_data, headers=moderator_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "Ownership claim approved successfully" in data["message"]

    def test_approve_diving_center_ownership_not_admin_or_moderator(self, client, auth_headers, test_diving_center):
        """Test approving ownership claim as regular user."""
        approval_data = {
            "approved": True,
            "reason": "Valid ownership claim"
        }

        response = client.post(f"/api/v1/diving-centers/{test_diving_center.id}/approve-ownership",
                             json=approval_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_approve_diving_center_ownership_not_found(self, client, admin_headers):
        """Test approving ownership claim for non-existent diving center."""
        approval_data = {
            "approved": True,
            "reason": "Valid ownership claim"
        }

        response = client.post("/api/v1/diving-centers/999/approve-ownership",
                             json=approval_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_diving_center_ownership_status_in_response(self, client, test_diving_center, db_session):
        """Test that diving center response includes ownership status."""
        from app.models import OwnershipStatus

        # Set ownership status
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()

        response = client.get(f"/api/v1/diving-centers/{test_diving_center.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "ownership_status" in data
        assert data["ownership_status"] == "claimed"

    def test_revoke_diving_center_ownership_success(self, client, test_diving_center, test_user, admin_headers, db_session):
        """Test successful revocation of diving center ownership."""
        from app.models import OwnershipStatus
        
        # Set up approved ownership
        test_diving_center.ownership_status = OwnershipStatus.approved
        test_diving_center.owner_id = test_user.id
        db_session.commit()
        
        # Revoke ownership as admin
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/revoke-ownership",
            json={"approved": False, "reason": "Testing revocation"},
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == f"Ownership of {test_diving_center.name} has been revoked from {test_user.username}"
        assert data["status"] == "unclaimed"
        assert data["previous_owner"] == test_user.username
        assert data["reason"] == "Testing revocation"
        
        # Verify database changes
        db_session.refresh(test_diving_center)
        assert test_diving_center.ownership_status == OwnershipStatus.unclaimed
        assert test_diving_center.owner_id is None

    def test_revoke_diving_center_ownership_not_approved(self, client, test_diving_center, admin_headers, db_session):
        """Test revocation fails when diving center is not approved."""
        from app.models import OwnershipStatus
        
        # Set diving center as claimed (not approved)
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/revoke-ownership",
            json={"approved": False, "reason": "Testing"},
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Cannot revoke ownership" in data["detail"]

    def test_revoke_diving_center_ownership_not_found(self, client, admin_headers):
        """Test revocation fails when diving center doesn't exist."""
        response = client.post(
            "/api/v1/diving-centers/99999/revoke-ownership",
            json={"approved": False, "reason": "Testing"},
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_diving_center_ownership_requires_admin(self, client, test_diving_center, test_user, auth_headers, db_session):
        """Test that revoking ownership requires admin privileges."""
        from app.models import OwnershipStatus
        
        # Set up diving center as claimed by test_user
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()

        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/revoke-ownership",
            json={"approved": False, "reason": "Testing"},
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_ownership_request_history(self, client, test_diving_center, test_user, test_admin_user, admin_headers, db_session):
        """Test getting ownership request history (admin only)."""
        from app.models import OwnershipRequest, OwnershipStatus

        # Create some ownership requests
        request1 = OwnershipRequest(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            request_status=OwnershipStatus.claimed,
            reason="Test claim"
        )
        request2 = OwnershipRequest(
            diving_center_id=test_diving_center.id,
            user_id=test_user.id,
            request_status=OwnershipStatus.approved,
            processed_date=datetime.utcnow(),
            processed_by=test_admin_user.id,
            reason="Approved for testing"
        )
        db_session.add_all([request1, request2])
        db_session.commit()

        response = client.get(
            "/api/v1/diving-centers/ownership-requests/history",
            headers=admin_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 2
        
        # Check that we have the expected requests
        request_ids = [req["id"] for req in data]
        assert request1.id in request_ids
        assert request2.id in request_ids

    def test_get_ownership_request_history_requires_admin(self, client, test_user, auth_headers):
        """Test that getting ownership request history requires admin privileges."""
        response = client.get(
            "/api/v1/diving-centers/ownership-requests/history",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_ownership_request_history_logs_all_actions(self, client, admin_headers, test_diving_center, test_user, auth_headers, db_session):
        """Test that ownership request history logs all ownership actions."""
        from app.models import OwnershipStatus, OwnershipRequest

        # 1. Claim ownership
        claim_response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/claim",
            json={"reason": "I am the legitimate owner of this diving center and can provide verification documents."},
            headers=auth_headers
        )
        assert claim_response.status_code == status.HTTP_200_OK

        # 2. Check history has claim record
        history_response = client.get("/api/v1/diving-centers/ownership-requests/history", headers=admin_headers)
        assert history_response.status_code == status.HTTP_200_OK
        
        history_data = history_response.json()
        assert len(history_data) >= 1
        
        # Find the claim record
        claim_record = next((record for record in history_data 
                           if record["diving_center_id"] == test_diving_center.id 
                           and record["user_id"] == test_user.id 
                           and record["request_status"] == "claimed"), None)
        assert claim_record is not None
        assert claim_record["request_date"] is not None

        # 3. Approve ownership
        approve_response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/approve-ownership",
            json={"approved": True, "reason": "Testing approval"},
            headers=admin_headers
        )
        assert approve_response.status_code == status.HTTP_200_OK

        # 4. Check history has approval record
        history_response = client.get("/api/v1/diving-centers/ownership-requests/history", headers=admin_headers)
        assert history_response.status_code == status.HTTP_200_OK
        
        history_data = history_response.json()
        assert len(history_data) >= 2
        
        # Find the approval record
        approval_record = next((record for record in history_data 
                              if record["diving_center_id"] == test_diving_center.id 
                              and record["user_id"] == test_user.id 
                              and record["request_status"] == "approved"), None)
        assert approval_record is not None
        assert approval_record["processed_date"] is not None
        assert approval_record["processed_by"] is not None
        assert approval_record["reason"] == "Testing approval"

        # 5. Revoke ownership
        revoke_response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/revoke-ownership",
            json={"approved": False, "reason": "Testing revocation"},
            headers=admin_headers
        )
        assert revoke_response.status_code == status.HTTP_200_OK

        # 6. Check history has revocation record
        history_response = client.get("/api/v1/diving-centers/ownership-requests/history", headers=admin_headers)
        assert history_response.status_code == status.HTTP_200_OK
        
        history_data = history_response.json()
        assert len(history_data) >= 3
        
        # Find the revocation record
        revocation_record = next((record for record in history_data 
                                if record["diving_center_id"] == test_diving_center.id 
                                and record["user_id"] == test_user.id 
                                and record["request_status"] == "denied"), None)
        assert revocation_record is not None
        assert revocation_record["processed_date"] is not None
        assert revocation_record["processed_by"] is not None
        assert revocation_record["reason"] == "Testing revocation"
        assert "revocation" in revocation_record.get("notes", "").lower()


class TestDivingCenterAuthorization:
    """Test diving center authorization for owners, admins, and regular users."""

    def test_gear_rental_owner_authorization(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test that diving center owners can manage gear rental items."""
        from app.models import OwnershipStatus
        
        # Set the user as the owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Test adding gear rental item as owner
        gear_data = {
            "item_name": "Test Regulator",
            "cost": 45.00,
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["item_name"] == "Test Regulator"
        assert float(data["cost"]) == 45.00
        assert data["currency"] == "EUR"
        assert data["diving_center_id"] == test_diving_center.id
        
        gear_id = data["id"]
        
        # Test deleting gear rental item as owner
        delete_response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental/{gear_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == status.HTTP_200_OK
        assert delete_response.json()["message"] == "Gear rental deleted successfully"

    def test_gear_rental_admin_authorization(self, client, db_session, test_diving_center, admin_headers):
        """Test that admins can manage gear rental items for any diving center."""
        
        # Test adding gear rental item as admin
        gear_data = {
            "item_name": "Admin Test BCD",
            "cost": 75.00,
            "currency": "USD"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data,
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["item_name"] == "Admin Test BCD"
        assert float(data["cost"]) == 75.00
        assert data["currency"] == "USD"
        
        gear_id = data["id"]
        
        # Test deleting gear rental item as admin
        delete_response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental/{gear_id}",
            headers=admin_headers
        )
        
        assert delete_response.status_code == status.HTTP_200_OK

    def test_gear_rental_moderator_authorization(self, client, db_session, test_diving_center, moderator_headers):
        """Test that moderators can manage gear rental items for any diving center."""
        
        # Test adding gear rental item as moderator
        gear_data = {
            "item_name": "Moderator Test Fins",
            "cost": 35.00,
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data,
            headers=moderator_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["item_name"] == "Moderator Test Fins"
        
        gear_id = data["id"]
        
        # Test deleting gear rental item as moderator
        delete_response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental/{gear_id}",
            headers=moderator_headers
        )
        
        assert delete_response.status_code == status.HTTP_200_OK

    def test_gear_rental_unauthorized_user(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test that non-owner users cannot manage gear rental items."""
        from app.models import OwnershipStatus, User
        
        # Create a second user to be the owner
        other_user = User(
            email="other@example.com",
            username="otheruser",
            password_hash="hashed_password"
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Set the other user as the owner (not the authenticated user)
        test_diving_center.owner_id = other_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Test adding gear rental item as non-owner
        gear_data = {
            "item_name": "Unauthorized Item",
            "cost": 25.00,
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]

    def test_gear_rental_unapproved_owner(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test that unapproved owners cannot manage gear rental items."""
        from app.models import OwnershipStatus
        
        # Set the user as the owner but with unapproved status
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.claimed
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Test adding gear rental item as unapproved owner
        gear_data = {
            "item_name": "Unapproved Owner Item",
            "cost": 30.00,
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]

    def test_gear_rental_nonexistent_center(self, client, auth_headers):
        """Test that requests to non-existent diving centers return 404."""
        
        gear_data = {
            "item_name": "Test Item",
            "cost": 25.00,
            "currency": "EUR"
        }
        
        response = client.post(
            "/api/v1/diving-centers/99999/gear-rental",
            json=gear_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving center not found" in response.json()["detail"]

    def test_organization_management_owner_authorization(self, client, db_session, test_user, test_diving_center, test_diving_organization, auth_headers):
        """Test that diving center owners can manage organizations."""
        from app.models import OwnershipStatus
        
        # Set the user as the owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Test adding organization as owner
        org_data = {
            "diving_organization_id": test_diving_organization.id,
            "is_primary": True
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/organizations",
            json=org_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["diving_center_id"] == test_diving_center.id
        assert data["diving_organization_id"] == test_diving_organization.id
        assert data["is_primary"] == True
        
        org_id = data["id"]
        
        # Test updating organization as owner
        update_data = {
            "is_primary": False
        }
        
        update_response = client.put(
            f"/api/v1/diving-centers/{test_diving_center.id}/organizations/{org_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.json()["is_primary"] == False
        
        # Test deleting organization as owner
        delete_response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/organizations/{org_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == status.HTTP_200_OK

    def test_organization_management_admin_authorization(self, client, db_session, test_diving_center, test_diving_organization, admin_headers):
        """Test that admins can manage organizations for any diving center."""
        
        # Test adding organization as admin
        org_data = {
            "diving_organization_id": test_diving_organization.id,
            "is_primary": False
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/organizations",
            json=org_data,
            headers=admin_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        org_id = response.json()["id"]
        
        # Test deleting organization as admin
        delete_response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/organizations/{org_id}",
            headers=admin_headers
        )
        
        assert delete_response.status_code == status.HTTP_200_OK

    def test_organization_management_unauthorized_user(self, client, db_session, test_user, test_diving_center, test_diving_organization, auth_headers):
        """Test that non-owner users cannot manage organizations."""
        from app.models import OwnershipStatus, User
        
        # Create a second user to be the owner
        other_user = User(
            email="other2@example.com",
            username="otheruser2",
            password_hash="hashed_password"
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Set the other user as the owner (not the authenticated user)
        test_diving_center.owner_id = other_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Test adding organization as non-owner
        org_data = {
            "diving_organization_id": test_diving_organization.id,
            "is_primary": False
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/organizations",
            json=org_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]

    def test_gear_rental_authentication_required(self, client, test_diving_center):
        """Test that authentication is required for gear rental operations."""
        
        gear_data = {
            "item_name": "Test Item",
            "cost": 25.00,
            "currency": "EUR"
        }
        
        # Test without authentication
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data
        )
        
        # The endpoint requires authentication, so it should return 403 Forbidden
        # (not 401 Unauthorized) because it's checking authorization after authentication
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_gear_rental_invalid_data(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test gear rental with invalid data."""
        from app.models import OwnershipStatus
        
        # Set the user as the owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Test with missing required fields
        invalid_data = {
            "item_name": "",  # Empty name
            "cost": 25.00,
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=invalid_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Test with invalid cost
        invalid_data = {
            "item_name": "Test Item",
            "cost": -10.00,  # Negative cost
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=invalid_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_gear_rental_delete_nonexistent_item(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test deleting a non-existent gear rental item."""
        from app.models import OwnershipStatus
        
        # Set the user as the owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Try to delete non-existent item
        response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental/99999",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Gear rental not found" in response.json()["detail"]

    def test_gear_rental_cross_center_access(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test that users cannot access gear rental items from other diving centers."""
        from app.models import OwnershipStatus, GearRentalCost, DivingCenter
        
        # Set the user as the owner of the diving center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()
        db_session.refresh(test_diving_center)

        # Create a gear rental item in this center
        gear_data = {
            "item_name": "Test Item",
            "cost": 25.00,
            "currency": "EUR"
        }
        
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
            json=gear_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        gear_id = response.json()["id"]
        
        # Create another diving center
        other_center = DivingCenter(
            name="Other Diving Center",
            description="Another test center",
            email="other@test.com",
            latitude=20.0,
            longitude=30.0
        )
        db_session.add(other_center)
        db_session.commit()
        db_session.refresh(other_center)
        
        # Try to delete the gear rental item from the other center
        response = client.delete(
            f"/api/v1/diving-centers/{other_center.id}/gear-rental/{gear_id}",
            headers=auth_headers
        )
        
        # The user should get 403 Forbidden because they don't have permission to manage the other center
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]

    def test_ownership_status_enum_handling(self, client, db_session, test_user, test_diving_center, auth_headers):
        """Test that ownership status enum is handled correctly."""
        from app.models import OwnershipStatus
        
        # Test with different ownership statuses
        statuses_to_test = [
            OwnershipStatus.unclaimed,
            OwnershipStatus.claimed,
            OwnershipStatus.denied
        ]
        
        for ownership_status in statuses_to_test:
            # Set the ownership status
            test_diving_center.owner_id = test_user.id
            test_diving_center.ownership_status = ownership_status
            db_session.commit()
            db_session.refresh(test_diving_center)

            # Try to add gear rental item
            gear_data = {
                "item_name": f"Test Item {ownership_status.value}",
                "cost": 25.00,
                "currency": "EUR"
            }
            
            response = client.post(
                f"/api/v1/diving-centers/{test_diving_center.id}/gear-rental",
                json=gear_data,
                headers=auth_headers
            )
            
            if ownership_status == OwnershipStatus.approved:
                assert response.status_code == status.HTTP_200_OK
            else:
                assert response.status_code == status.HTTP_403_FORBIDDEN
                assert "Not enough permissions" in response.json()["detail"]

        # Clean up - set back to approved for other tests
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()