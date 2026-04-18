import pytest
from fastapi import status
from datetime import date, time, datetime
from app.models import Newsletter, ParsedDiveTrip, DivingCenter, TripStatus, DifficultyLevel
from decimal import Decimal

class TestGetTripDetails:
    def test_get_parsed_trip_details_regular_user_success(self, client, auth_headers, db_session):
        """
        Test that a regular authenticated user can view trip details.
        This specifically tests the 'get_parsed_trip' endpoint which had a NameError.
        """
        # 1. Setup: Create a diving center
        diving_center = DivingCenter(
            name="Test Center for Details",
            email="details@center.com"
        )
        db_session.add(diving_center)
        db_session.commit()

        # 2. Setup: Create a newsletter
        newsletter = Newsletter(content="Original Newsletter Content")
        db_session.add(newsletter)
        db_session.commit()

        # 3. Setup: Create a trip for this center
        difficulty = db_session.query(DifficultyLevel).filter(DifficultyLevel.code == "OPEN_WATER").first()
        trip = ParsedDiveTrip(
            diving_center_id=diving_center.id,
            trip_date=date(2024, 6, 20),
            trip_time=time(10, 0),
            trip_description="A wonderful dive trip",
            trip_status=TripStatus.scheduled,
            source_newsletter_id=newsletter.id,
            trip_difficulty_id=difficulty.id if difficulty else 1,
            extracted_at=datetime.now(),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        db_session.add(trip)
        db_session.commit()

        # 4. Act: Get trip details as a regular authenticated user
        # Note: auth_headers belongs to a regular user (not owner, not admin)
        response = client.get(
            f"/api/v1/newsletters/trips/{trip.id}",
            headers=auth_headers
        )

        # 5. Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == trip.id
        assert data["trip_description"] == "A wonderful dive trip"
        # Regular users should NOT see newsletter_content
        assert data["newsletter_content"] is None
        assert data["diving_center_name"] == "Test Center for Details"

    def test_get_parsed_trip_details_owner_sees_content(self, client, auth_headers, db_session, test_user):
        """
        Test that a diving center owner can see the newsletter content in trip details.
        """
        # 1. Setup: Create a diving center owned by test_user
        diving_center = DivingCenter(
            name="Owner Center",
            email="owner@center.com",
            owner_id=test_user.id
        )
        db_session.add(diving_center)
        db_session.commit()

        # 2. Setup: Create a newsletter
        newsletter = Newsletter(content="Secret Newsletter Content")
        db_session.add(newsletter)
        db_session.commit()

        # 3. Setup: Create a trip
        trip = ParsedDiveTrip(
            diving_center_id=diving_center.id,
            trip_date=date(2024, 6, 20),
            source_newsletter_id=newsletter.id,
            trip_status=TripStatus.scheduled,
            extracted_at=datetime.now()
        )
        db_session.add(trip)
        db_session.commit()

        # 4. Act: Get trip details as the owner
        response = client.get(
            f"/api/v1/newsletters/trips/{trip.id}",
            headers=auth_headers
        )

        # 5. Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Owner SHOULD see newsletter_content
        assert data["newsletter_content"] == "Secret Newsletter Content"
