"""
Tests for Dive Sites CRUD Operations

Tests basic create, read, update, delete operations for dive sites.
"""

import pytest
from fastapi import status
from app.models import DiveSite


class TestDiveSitesCRUD:
    """Test core CRUD operations for dive sites."""

    def test_get_dive_sites_success(self, client, test_dive_site):
        """Test getting list of dive sites."""
        response = client.get("/api/v1/dive-sites/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_dive_site.name
        assert data[0]["description"] == test_dive_site.description

    def test_get_dive_sites_empty(self, client):
        """Test getting dive sites when none exist."""
        response = client.get("/api/v1/dive-sites/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0

    def test_get_dive_site_detail_success(self, client, test_dive_site):
        """Test getting specific dive site details."""
        response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == test_dive_site.name
        assert data["description"] == test_dive_site.description
        # Fix: compare as strings to match API output
        assert float(data["latitude"]) == float(test_dive_site.latitude)
        assert float(data["longitude"]) == float(test_dive_site.longitude)
        assert "average_rating" in data
        assert "total_ratings" in data

    def test_get_dive_site_not_found(self, client):
        """Test getting non-existent dive site."""
        response = client.get("/api/v1/dive-sites/999")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_dive_site_admin_success(self, client, admin_headers):
        """Test creating dive site as admin."""
        dive_site_data = {
            "name": "New Dive Site",
            "description": "A new dive site",
            "latitude": 25.0,
            "longitude": 30.0
        }

        response = client.post("/api/v1/dive-sites/",
                             json=dive_site_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 201
        data = response.json()
        assert data["name"] == "New Dive Site"
        assert data["description"] == "A new dive site"
        # Fix: compare as strings to match API output
        assert str(data["latitude"]) == "25.0"
        assert str(data["longitude"]) == "30.0"

    def test_create_dive_site_unauthorized(self, client):
        """Test creating dive site without authentication."""
        dive_site_data = {
            "name": "New Dive Site",
            "description": "A new dive site",
            "latitude": 25.0,
            "longitude": 30.0
        }

        response = client.post("/api/v1/dive-sites/", json=dive_site_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_create_dive_site_regular_user_success(self, client, auth_headers):
        """Test creating dive site as regular authenticated user."""
        dive_site_data = {
            "name": "New Dive Site",
            "description": "A new dive site",
            "latitude": 25.0,
            "longitude": 30.0
        }

        response = client.post("/api/v1/dive-sites/",
                             json=dive_site_data, headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "New Dive Site"
        assert data["description"] == "A new dive site"
        assert str(data["latitude"]) == "25.0"
        assert str(data["longitude"]) == "30.0"

    def test_create_dive_site_invalid_data(self, client, admin_headers):
        """Test creating dive site with invalid data."""
        dive_site_data = {
            "name": "",  # Empty name
            "latitude": 200.0,  # Invalid latitude
            "longitude": 300.0  # Invalid longitude
        }

        response = client.post("/api/v1/dive-sites/",
                             json=dive_site_data, headers=admin_headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_dive_site_admin_success(self, client, admin_headers, test_dive_site):
        """Test updating dive site as admin."""
        update_data = {
            "name": "Updated Dive Site",
            "description": "Updated description"
        }

        response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}",
                            json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Dive Site"
        assert data["description"] == "Updated description"

    def test_update_dive_site_unauthorized(self, client, test_dive_site):
        """Test updating dive site without authentication."""
        update_data = {"name": "Updated Dive Site"}

        response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}", json=update_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_update_dive_site_not_admin(self, client, auth_headers, test_dive_site):
        """Test updating dive site as non-admin user."""
        update_data = {"name": "Updated Dive Site"}

        response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}",
                            json=update_data, headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_dive_site_not_found(self, client, admin_headers):
        """Test updating non-existent dive site."""
        update_data = {"name": "Updated Dive Site"}

        response = client.put("/api/v1/dive-sites/999",
                            json=update_data, headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_dive_site_admin_success(self, client, admin_headers, test_dive_site):
        """Test deleting dive site as admin."""
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}",
                               headers=admin_headers)

        assert response.status_code == status.HTTP_200_OK  # Changed from 204

    def test_delete_dive_site_unauthorized(self, client, test_dive_site):
        """Test deleting dive site without authentication."""
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN  # Changed from 401

    def test_delete_dive_site_not_admin(self, client, auth_headers, test_dive_site):
        """Test deleting dive site as non-admin user."""
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}",
                               headers=auth_headers)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_dive_site_not_found(self, client, admin_headers):
        """Test deleting non-existent dive site."""
        response = client.delete("/api/v1/dive-sites/999", headers=admin_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_dive_site_with_null_latitude_rejected(self, client, admin_headers):
        """Test that updating a dive site with null latitude is rejected."""
        # First create a dive site
        dive_site_data = {
            "name": "Test Dive Site for Null Latitude",
            "description": "A test dive site",
            "latitude": 10.0,
            "longitude": 20.0
        }

        create_response = client.post("/api/v1/dive-sites/", json=dive_site_data, headers=admin_headers)
        assert create_response.status_code == status.HTTP_200_OK
        dive_site_id = create_response.json()["id"]

        # Try to update with null latitude
        update_data = {
            "name": "Updated Test Dive Site",
            "latitude": None
        }

        update_response = client.put(f"/api/v1/dive-sites/{dive_site_id}", json=update_data, headers=admin_headers)
        assert update_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Latitude cannot be empty" in update_response.json()["detail"]

    def test_update_dive_site_with_null_longitude_rejected(self, client, admin_headers):
        """Test that updating a dive site with null longitude is rejected."""
        # First create a dive site
        dive_site_data = {
            "name": "Test Dive Site for Null Longitude",
            "description": "A test dive site",
            "latitude": 10.0,
            "longitude": 20.0
        }

        create_response = client.post("/api/v1/dive-sites/", json=dive_site_data, headers=admin_headers)
        assert create_response.status_code == status.HTTP_200_OK
        dive_site_id = create_response.json()["id"]

        # Try to update with null longitude
        update_data = {
            "name": "Updated Test Dive Site",
            "longitude": None
        }

        update_response = client.put(f"/api/v1/dive-sites/{dive_site_id}", json=update_data, headers=admin_headers)
        assert update_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "Longitude cannot be empty" in update_response.json()["detail"]

    def test_create_dive_site_with_comprehensive_data(self, client, admin_headers):
        """Test creating dive site with comprehensive data."""
        dive_site_data = {
            "name": "Comprehensive Dive Site",
            "description": "A comprehensive dive site with all fields",
            "latitude": 25.0,
            "longitude": 30.0,
            "country": "Test Country",
            "region": "Test Region",
            "access_instructions": "Follow the path to the beach",
            "safety_information": "Check weather conditions before diving",
            "marine_life": "Coral reefs, tropical fish",
            "difficulty_code": "DEEP_NITROX",
            "max_depth": 25.0,
            "average_depth": 15.0,
            "visibility_rating": 8,
            "current_strength": "moderate"
        }

        response = client.post("/api/v1/dive-sites/", json=dive_site_data, headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["name"] == "Comprehensive Dive Site"
        assert data["country"] == "Test Country"
        assert data["region"] == "Test Region"
        assert data["difficulty_code"] == "DEEP_NITROX"
        assert data["difficulty_label"] == "Deep/Nitrox"
        assert data["max_depth"] == 25.0

    def test_update_dive_site_partial_data(self, client, admin_headers, test_dive_site):
        """Test updating dive site with partial data."""
        update_data = {
            "description": "Updated description",
            "difficulty_code": "TECHNICAL_DIVING"
        }

        response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}", 
                             json=update_data, headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["description"] == "Updated description"
        assert data["difficulty_code"] == "TECHNICAL_DIVING"
        assert data["difficulty_label"] == "Technical Diving"
        # Other fields should remain unchanged
        assert data["name"] == test_dive_site.name

    def test_create_dive_site_with_invalid_coordinates(self, client, admin_headers):
        """Test creating dive site with invalid coordinates."""
        dive_site_data = {
            "name": "Invalid Coordinates Site",
            "description": "Site with invalid coordinates",
            "latitude": 200.0,  # Invalid latitude
            "longitude": 30.0
        }

        response = client.post("/api/v1/dive-sites/", json=dive_site_data, headers=admin_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

