import pytest
from fastapi import status
from app.models import CertificationLevel

class TestDivingOrganizationCertifications:
    """Test diving organization certification endpoints."""

    @pytest.fixture
    def test_certification_level(self, db_session, test_diving_organization):
        """Create a test certification level."""
        cert_level = CertificationLevel(
            diving_organization_id=test_diving_organization.id,
            name="Open Water Diver",
            category="Recreational",
            max_depth="18m",
            gases="Air",
            tanks="Single",
            prerequisites="None"
        )
        db_session.add(cert_level)
        db_session.commit()
        db_session.refresh(cert_level)
        return cert_level

    def test_get_organization_certification_levels_by_id(self, client, test_diving_organization, test_certification_level):
        """Test getting certification levels by Organization ID."""
        response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == test_certification_level.name
        assert data[0]["diving_organization_id"] == test_diving_organization.id

    def test_get_organization_certification_levels_by_name(self, client, test_diving_organization, test_certification_level):
        """Test getting certification levels by Organization Name."""
        response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.name}/levels")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == test_certification_level.name

    def test_get_organization_certification_levels_by_acronym(self, client, test_diving_organization, test_certification_level):
        """Test getting certification levels by Organization Acronym."""
        response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.acronym}/levels")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == test_certification_level.name

    def test_get_organization_certification_levels_not_found(self, client):
        """Test getting certification levels for a non-existent organization."""
        response = client.get("/api/v1/diving-organizations/NonExistentOrg/levels")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving organization not found" in response.json()["detail"]

    def test_create_certification_level_admin(self, client, admin_headers, test_diving_organization):
        """Test creating a certification level as admin."""
        cert_data = {
            "name": "Advanced Open Water",
            "category": "Recreational",
            "max_depth": "30m",
            "diving_organization_id": test_diving_organization.id
        }

        response = client.post(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels",
                             json=cert_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == cert_data["name"]
        assert data["category"] == cert_data["category"]
        assert data["max_depth"] == cert_data["max_depth"]
        assert data["diving_organization_id"] == test_diving_organization.id
        assert "id" in data

    def test_create_certification_level_moderator(self, client, moderator_headers, test_diving_organization):
        """Test creating a certification level as moderator."""
        cert_data = {
            "name": "Rescue Diver",
            "diving_organization_id": test_diving_organization.id
        }

        response = client.post(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels",
                             json=cert_data, headers=moderator_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == cert_data["name"]

    def test_create_certification_level_unauthorized(self, client, test_diving_organization):
        """Test creating a certification level without authentication."""
        cert_data = {
            "name": "Unauthorized Level",
            "diving_organization_id": test_diving_organization.id
        }

        response = client.post(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels",
                             json=cert_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_certification_level_admin(self, client, admin_headers, test_diving_organization, test_certification_level):
        """Test updating a certification level as admin."""
        update_data = {
            "name": "Updated Level Name",
            "max_depth": "40m"
        }

        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels/{test_certification_level.id}",
                            json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["max_depth"] == update_data["max_depth"]
        assert data["id"] == test_certification_level.id

    def test_update_certification_level_not_found(self, client, admin_headers, test_diving_organization):
        """Test updating a non-existent certification level."""
        update_data = {"name": "New Name"}

        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels/999",
                            json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Certification level not found" in response.json()["detail"]

    def test_delete_certification_level_admin(self, client, admin_headers, test_diving_organization, test_certification_level):
        """Test deleting a certification level as admin."""
        response = client.delete(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels/{test_certification_level.id}",
                               headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        assert "Certification level deleted successfully" in response.json()["message"]

        # Verify deletion
        get_response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels")
        levels = get_response.json()
        assert not any(l["id"] == test_certification_level.id for l in levels)

    def test_delete_certification_level_unauthorized(self, client, test_diving_organization, test_certification_level):
        """Test deleting a certification level without authentication."""
        response = client.delete(f"/api/v1/diving-organizations/{test_diving_organization.id}/levels/{test_certification_level.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN
