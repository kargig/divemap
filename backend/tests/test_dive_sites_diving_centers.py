"""
Tests for Dive Sites Diving Centers Associations

Tests the diving center association functionality for dive sites endpoints.

Note: These tests require MySQL (not SQLite) due to the location POINT column
in the diving_centers table. Run via docker-test-github-actions.sh script.
"""

import pytest
import os
from fastapi import status
from app.models import CenterDiveSite

# Skip all tests in this file if not using MySQL
pytestmark = pytest.mark.skipif(
    os.getenv("DATABASE_URL", "sqlite:///./test.db").startswith("sqlite"),
    reason="These tests require MySQL (run via docker-test-github-actions.sh)"
)


class TestDiveSitesDivingCenters:
    """Test diving center associations for dive sites."""

    def test_get_dive_site_diving_centers_success(self, client, test_dive_site, db_session):
        response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_get_dive_site_diving_centers_not_found(self, client):
        response = client.get("/api/v1/dive-sites/999/diving-centers")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_add_diving_center_to_dive_site_admin(self, client, admin_headers, test_dive_site, test_diving_center):
        """Test adding diving center to dive site as admin."""
        center_assignment_data = {
            "diving_center_id": test_diving_center.id,
            "dive_site_id": test_dive_site.id,  # Add required field
            "dive_cost": 50.0
        }

        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers",
                             json=center_assignment_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 201
        data = response.json()
        assert data["diving_center_id"] == test_diving_center.id
        assert data["dive_site_id"] == test_dive_site.id
        assert data["dive_cost"] == 50.0

    def test_add_diving_center_to_dive_site_unauthorized(self, client, test_dive_site, test_diving_center):
        """Test adding diving center to dive site without authentication."""
        center_assignment_data = {
            "diving_center_id": test_diving_center.id,
            "dive_site_id": test_dive_site.id,  # Add required field
            "dive_cost": 50.0
        }

        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers",
                             json=center_assignment_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_add_diving_center_to_dive_site_not_admin(self, client, auth_headers, test_dive_site, test_diving_center):
        """Test adding diving center to dive site as non-admin user."""
        center_assignment_data = {
            "diving_center_id": test_diving_center.id,
            "dive_site_id": test_dive_site.id,  # Add required field
            "dive_cost": 50.0
        }

        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers",
                             json=center_assignment_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_add_diving_center_to_dive_site_not_found(self, client, admin_headers, test_diving_center):
        """Test adding diving center to non-existent dive site."""
        center_assignment_data = {
            "diving_center_id": test_diving_center.id,
            "dive_site_id": 999,  # Add required field
            "dive_cost": 50.0
        }

        response = client.post("/api/v1/dive-sites/999/diving-centers",
                             json=center_assignment_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_add_diving_center_to_dive_site_center_not_found(self, client, admin_headers, test_dive_site):
        """Test adding non-existent diving center to dive site."""
        center_assignment_data = {
            "diving_center_id": 999,
            "dive_site_id": test_dive_site.id,  # Add required field
            "dive_cost": 50.0
        }

        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers",
                             json=center_assignment_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_add_diving_center_to_dive_site_duplicate(self, client, admin_headers, test_dive_site, test_diving_center, db_session):
        """Test adding diving center that's already associated with dive site."""
        # Create existing association
        existing_association = CenterDiveSite(
            dive_site_id=test_dive_site.id,
            diving_center_id=test_diving_center.id,
            dive_cost=30.0
        )
        db_session.add(existing_association)
        db_session.commit()

        # Try to add the same association again
        center_assignment_data = {
            "diving_center_id": test_diving_center.id,
            "dive_site_id": test_dive_site.id,  # Add required field
            "dive_cost": 50.0
        }

        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers",
                             json=center_assignment_data, headers=admin_headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_remove_diving_center_from_dive_site_admin(self, client, admin_headers, test_dive_site, test_diving_center, db_session):
        assoc = CenterDiveSite(dive_site_id=test_dive_site.id, diving_center_id=test_diving_center.id, dive_cost=100)
        db_session.add(assoc)
        db_session.commit()
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers/{test_diving_center.id}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert "removed" in response.json()["message"]  # Changed from "deleted"

    def test_remove_diving_center_from_dive_site_unauthorized(self, client, test_dive_site, test_diving_center, db_session):
        assoc = CenterDiveSite(dive_site_id=test_dive_site.id, diving_center_id=test_diving_center.id, dive_cost=100)
        db_session.add(assoc)
        db_session.commit()
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers/{test_diving_center.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_remove_diving_center_from_dive_site_not_admin(self, client, auth_headers, test_dive_site, test_diving_center, db_session):
        assoc = CenterDiveSite(dive_site_id=test_dive_site.id, diving_center_id=test_diving_center.id, dive_cost=100)
        db_session.add(assoc)
        db_session.commit()
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers/{test_diving_center.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_remove_diving_center_from_dive_site_not_found(self, client, admin_headers, test_dive_site):
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}/diving-centers/9999", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_remove_diving_center_from_dive_site_site_not_found(self, client, admin_headers, test_diving_center):
        response = client.delete(f"/api/v1/dive-sites/9999/diving-centers/{test_diving_center.id}", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

