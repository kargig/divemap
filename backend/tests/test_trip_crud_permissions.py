import pytest
from datetime import date
from fastapi import status
from app.models import ParsedDiveTrip, DivingCenter, DivingCenterManager, OwnershipStatus

class TestTripCRUDPermissions:

    def test_owner_can_update_trip(self, client, auth_headers, db_session, test_diving_center, test_user):
        """Test that a center owner can update a trip belonging to their center."""
        # Setup: Current user (test_user) owns the center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()

        # Create a trip for this center
        trip = ParsedDiveTrip(
            trip_date=date(2024, 5, 20),
            diving_center_id=test_diving_center.id,
            trip_description="Original"
        )
        db_session.add(trip)
        db_session.commit()

        # Update as owner
        update_data = {"trip_description": "Updated by Owner"}
        response = client.put(
            f"/api/v1/newsletters/trips/{trip.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["trip_description"] == "Updated by Owner"

    def test_manager_can_delete_trip(self, client, auth_headers, db_session, test_diving_center, test_user):
        """Test that a center manager can delete a trip belonging to their center."""
        # Setup: Current user is a manager (but not owner)
        test_diving_center.owner_id = None
        db_session.add(DivingCenterManager(diving_center_id=test_diving_center.id, user_id=test_user.id))
        db_session.commit()

        # Create a trip for this center
        trip = ParsedDiveTrip(
            trip_date=date(2024, 5, 20),
            diving_center_id=test_diving_center.id
        )
        db_session.add(trip)
        db_session.commit()

        # Delete as manager
        response = client.delete(
            f"/api/v1/newsletters/trips/{trip.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert db_session.query(ParsedDiveTrip).filter_by(id=trip.id).first() is None

    def test_unauthorized_user_cannot_update_trip(self, client, auth_headers_other_user, db_session, test_diving_center):
        """Test that a user who isn't owner/manager/admin cannot update the trip."""
        # Create a trip
        trip = ParsedDiveTrip(
            trip_date=date(2024, 5, 20),
            diving_center_id=test_diving_center.id
        )
        db_session.add(trip)
        db_session.commit()

        # Attempt update as other user
        response = client.put(
            f"/api/v1/newsletters/trips/{trip.id}",
            json={"trip_description": "Hacked"},
            headers=auth_headers_other_user
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized" in response.json()["detail"]
