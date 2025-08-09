import pytest
from fastapi import status
from sqlalchemy.orm import Session

from app.models import UserCertification, DivingOrganization


class TestUserCertifications:
    """Test user certifications endpoints."""

    def test_get_my_certifications(self, client, auth_headers, test_user_certification):
        """Test getting current user's certifications."""
        response = client.get("/api/v1/user-certifications/my-certifications",
                            headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

        # Check that the certification belongs to the current user
        for cert in data:
            assert cert["user_id"] == test_user_certification.user_id
            assert "diving_organization" in cert
            assert "certification_level" in cert
            assert "is_active" in cert
            assert "created_at" in cert
            assert "updated_at" in cert

    def test_get_my_certifications_unauthorized(self, client):
        """Test getting certifications without authentication."""
        response = client.get("/api/v1/user-certifications/my-certifications")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_user_certifications_public(self, client, test_user_certification):
        """Test getting public certifications for a specific user."""
        response = client.get(f"/api/v1/user-certifications/users/{test_user_certification.user_id}/certifications")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

        # Check that only active certifications are returned
        for cert in data:
            assert cert["user_id"] == test_user_certification.user_id
            assert cert["is_active"] is True
            assert "diving_organization" in cert
            assert "certification_level" in cert

    def test_get_user_certifications_user_not_found(self, client):
        """Test getting certifications for a user that doesn't exist."""
        response = client.get("/api/v1/user-certifications/users/999/certifications")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "User not found" in response.json()["detail"]

    def test_create_my_certification(self, client, auth_headers, test_diving_organization):
        """Test creating a new certification for current user."""
        certification_data = {
            "diving_organization_id": test_diving_organization.id,
            "certification_level": "Open Water Diver",
            "is_active": True
        }

        response = client.post("/api/v1/user-certifications/my-certifications",
                             json=certification_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["diving_organization_id"] == test_diving_organization.id
        assert data["certification_level"] == certification_data["certification_level"]
        assert data["is_active"] == certification_data["is_active"]
        assert "id" in data
        assert "user_id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "diving_organization" in data

    def test_create_my_certification_unauthorized(self, client, test_diving_organization):
        """Test creating a certification without authentication."""
        certification_data = {
            "diving_organization_id": test_diving_organization.id,
            "certification_level": "Open Water Diver"
        }

        response = client.post("/api/v1/user-certifications/my-certifications",
                             json=certification_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_my_certification_organization_not_found(self, client, auth_headers):
        """Test creating a certification with non-existent organization."""
        certification_data = {
            "diving_organization_id": 999,
            "certification_level": "Open Water Diver"
        }

        response = client.post("/api/v1/user-certifications/my-certifications",
                             json=certification_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving organization not found" in response.json()["detail"]

    def test_create_my_certification_duplicate(self, client, auth_headers, test_user_certification):
        """Test creating a duplicate certification."""
        certification_data = {
            "diving_organization_id": test_user_certification.diving_organization_id,
            "certification_level": test_user_certification.certification_level,
            "is_active": True
        }

        response = client.post("/api/v1/user-certifications/my-certifications",
                             json=certification_data, headers=auth_headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Certification already exists" in response.json()["detail"]

    def test_create_my_certification_invalid_data(self, client, auth_headers, test_diving_organization):
        """Test creating a certification with invalid data."""
        certification_data = {
            "diving_organization_id": test_diving_organization.id,
            "certification_level": "",  # Empty level
            "is_active": True
        }

        response = client.post("/api/v1/user-certifications/my-certifications",
                             json=certification_data, headers=auth_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_my_certification(self, client, auth_headers, test_user_certification):
        """Test updating a certification for current user."""
        update_data = {
            "certification_level": "Advanced Open Water Diver",
            "is_active": False
        }

        response = client.put(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["certification_level"] == update_data["certification_level"]
        assert data["is_active"] == update_data["is_active"]
        assert data["diving_organization_id"] == test_user_certification.diving_organization_id

    def test_update_my_certification_unauthorized(self, client, test_user_certification):
        """Test updating a certification without authentication."""
        update_data = {"certification_level": "Advanced Open Water Diver"}

        response = client.put(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}",
                            json=update_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_my_certification_not_found(self, client, auth_headers):
        """Test updating a certification that doesn't exist."""
        update_data = {"certification_level": "Advanced Open Water Diver"}

        response = client.put("/api/v1/user-certifications/my-certifications/999",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Certification not found" in response.json()["detail"]

    def test_update_my_certification_other_user(self, client, auth_headers, test_user_certification, db_session):
        """Test updating a certification that belongs to another user."""
        # Create another user and certification
        from app.models import User
        from app.auth import create_access_token

        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",
            is_admin=False,
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()

        other_cert = UserCertification(
            user_id=other_user.id,
            diving_organization_id=test_user_certification.diving_organization_id,
            certification_level="Rescue Diver",
            is_active=True
        )
        db_session.add(other_cert)
        db_session.commit()

        update_data = {"certification_level": "Master Diver"}

        response = client.put(f"/api/v1/user-certifications/my-certifications/{other_cert.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Certification not found" in response.json()["detail"]

    def test_update_my_certification_organization_not_found(self, client, auth_headers, test_user_certification):
        """Test updating a certification with non-existent organization."""
        update_data = {"diving_organization_id": 999}

        response = client.put(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving organization not found" in response.json()["detail"]

    def test_delete_my_certification(self, client, auth_headers, test_user_certification):
        """Test deleting a certification for current user."""
        response = client.delete(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}",
                               headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        assert "Certification deleted successfully" in response.json()["message"]

        # Verify it's actually deleted
        get_response = client.get("/api/v1/user-certifications/my-certifications", headers=auth_headers)
        assert get_response.status_code == status.HTTP_200_OK
        data = get_response.json()
        cert_ids = [cert["id"] for cert in data]
        assert test_user_certification.id not in cert_ids

    def test_delete_my_certification_unauthorized(self, client, test_user_certification):
        """Test deleting a certification without authentication."""
        response = client.delete(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_my_certification_not_found(self, client, auth_headers):
        """Test deleting a certification that doesn't exist."""
        response = client.delete("/api/v1/user-certifications/my-certifications/999",
                               headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Certification not found" in response.json()["detail"]

    def test_toggle_certification_status(self, client, auth_headers, test_user_certification):
        """Test toggling certification active status."""
        original_status = test_user_certification.is_active

        response = client.patch(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}/toggle",
                              headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] == (not original_status)
        assert "activated" in data["message"] or "deactivated" in data["message"]

        # Toggle again to verify it works both ways
        response2 = client.patch(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}/toggle",
                               headers=auth_headers)

        assert response2.status_code == status.HTTP_200_OK
        data2 = response2.json()
        assert data2["is_active"] == original_status

    def test_toggle_certification_status_unauthorized(self, client, test_user_certification):
        """Test toggling certification status without authentication."""
        response = client.patch(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}/toggle")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_certification_status_not_found(self, client, auth_headers):
        """Test toggling certification status for non-existent certification."""
        response = client.patch("/api/v1/user-certifications/my-certifications/999/toggle",
                              headers=auth_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Certification not found" in response.json()["detail"]

    def test_create_certification_minimal_data(self, client, auth_headers, test_diving_organization):
        """Test creating a certification with minimal required data."""
        certification_data = {
            "diving_organization_id": test_diving_organization.id,
            "certification_level": "Basic Diver"
        }

        response = client.post("/api/v1/user-certifications/my-certifications",
                             json=certification_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["diving_organization_id"] == test_diving_organization.id
        assert data["certification_level"] == certification_data["certification_level"]
        assert data["is_active"] is True  # Default value

    def test_update_certification_partial(self, client, auth_headers, test_user_certification):
        """Test updating a certification with partial data."""
        original_level = test_user_certification.certification_level
        update_data = {"is_active": False}

        response = client.put(f"/api/v1/user-certifications/my-certifications/{test_user_certification.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] == update_data["is_active"]
        assert data["certification_level"] == original_level  # Should remain unchanged
        assert data["diving_organization_id"] == test_user_certification.diving_organization_id  # Should remain unchanged

    def test_get_certifications_empty(self, client, auth_headers, db_session):
        """Test getting certifications when user has none."""
        # Create a new user with no certifications
        from app.models import User
        from app.auth import create_access_token

        new_user = User(
            username="newuser",
            email="new@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",
            is_admin=False,
            enabled=True
        )

        # Add user to database
        db_session.add(new_user)
        db_session.commit()
        db_session.refresh(new_user)

        # Create token for new user
        token = create_access_token(data={"sub": new_user.username})
        headers = {"Authorization": f"Bearer {token}"}

        response = client.get("/api/v1/user-certifications/my-certifications", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_public_certifications_only_active(self, client, test_user_certification, db_session):
        """Test that public endpoint only returns active certifications."""
        # Create an inactive certification
        inactive_cert = UserCertification(
            user_id=test_user_certification.user_id,
            diving_organization_id=test_user_certification.diving_organization_id,
            certification_level="Inactive Certification",
            is_active=False
        )
        db_session.add(inactive_cert)
        db_session.commit()

        response = client.get(f"/api/v1/user-certifications/users/{test_user_certification.user_id}/certifications")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Check that only active certifications are returned
        for cert in data:
            assert cert["is_active"] is True

        # Verify inactive certification is not in the list
        cert_ids = [cert["id"] for cert in data]
        assert inactive_cert.id not in cert_ids