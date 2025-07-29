import pytest
from fastapi import status
from sqlalchemy.orm import Session

from app.models import DivingOrganization


class TestDivingOrganizations:
    """Test diving organizations endpoints."""
    
    def test_get_all_diving_organizations(self, client):
        """Test getting all diving organizations."""
        response = client.get("/api/v1/diving-organizations/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_diving_organizations_with_pagination(self, client):
        """Test getting diving organizations with pagination."""
        response = client.get("/api/v1/diving-organizations/?skip=0&limit=5")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5
    
    def test_get_diving_organization_by_id(self, client, test_diving_organization):
        """Test getting a specific diving organization by ID."""
        response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == test_diving_organization.id
        assert data["name"] == test_diving_organization.name
        assert data["acronym"] == test_diving_organization.acronym
        assert "created_at" in data
        assert "updated_at" in data
    
    def test_get_diving_organization_not_found(self, client):
        """Test getting a diving organization that doesn't exist."""
        response = client.get("/api/v1/diving-organizations/999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving organization not found" in response.json()["detail"]
    
    def test_create_diving_organization_admin(self, client, admin_headers):
        """Test creating a diving organization as admin."""
        organization_data = {
            "name": "Test Diving Organization",
            "acronym": "TDO",
            "website": "https://testdiving.org",
            "logo_url": "https://testdiving.org/logo.png",
            "description": "A test diving organization",
            "country": "Test Country",
            "founded_year": 2020
        }
        
        response = client.post("/api/v1/diving-organizations/", 
                             json=organization_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == organization_data["name"]
        assert data["acronym"] == organization_data["acronym"]
        assert data["website"] == organization_data["website"]
        assert data["country"] == organization_data["country"]
        assert data["founded_year"] == organization_data["founded_year"]
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
    
    def test_create_diving_organization_non_admin(self, client, auth_headers):
        """Test creating a diving organization as non-admin user."""
        organization_data = {
            "name": "Test Diving Organization",
            "acronym": "TDO",
            "website": "https://testdiving.org"
        }
        
        response = client.post("/api/v1/diving-organizations/", 
                             json=organization_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_create_diving_organization_unauthorized(self, client):
        """Test creating a diving organization without authentication."""
        organization_data = {
            "name": "Test Diving Organization",
            "acronym": "TDO"
        }
        
        response = client.post("/api/v1/diving-organizations/", json=organization_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_create_diving_organization_duplicate_acronym(self, client, admin_headers, test_diving_organization):
        """Test creating a diving organization with duplicate acronym."""
        organization_data = {
            "name": "Different Name",
            "acronym": test_diving_organization.acronym,  # Same acronym
            "website": "https://different.org"
        }
        
        response = client.post("/api/v1/diving-organizations/", 
                             json=organization_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Organization with this acronym already exists" in response.json()["detail"]
    
    def test_create_diving_organization_duplicate_name(self, client, admin_headers, test_diving_organization):
        """Test creating a diving organization with duplicate name."""
        organization_data = {
            "name": test_diving_organization.name,  # Same name
            "acronym": "DIFF",
            "website": "https://different.org"
        }
        
        response = client.post("/api/v1/diving-organizations/", 
                             json=organization_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Organization with this name already exists" in response.json()["detail"]
    
    def test_create_diving_organization_invalid_data(self, client, admin_headers):
        """Test creating a diving organization with invalid data."""
        organization_data = {
            "name": "",  # Empty name
            "acronym": "T",  # Too short
            "founded_year": 1800  # Too old
        }
        
        response = client.post("/api/v1/diving-organizations/", 
                             json=organization_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_update_diving_organization_admin(self, client, admin_headers, test_diving_organization):
        """Test updating a diving organization as admin."""
        update_data = {
            "name": "Updated Diving Organization",
            "description": "Updated description",
            "website": "https://updated.org"
        }
        
        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["website"] == update_data["website"]
        assert data["acronym"] == test_diving_organization.acronym  # Should remain unchanged
    
    def test_update_diving_organization_non_admin(self, client, auth_headers, test_diving_organization):
        """Test updating a diving organization as non-admin user."""
        update_data = {"name": "Updated Name"}
        
        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_update_diving_organization_not_found(self, client, admin_headers):
        """Test updating a diving organization that doesn't exist."""
        update_data = {"name": "Updated Name"}
        
        response = client.put("/api/v1/diving-organizations/999", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving organization not found" in response.json()["detail"]
    
    def test_update_diving_organization_conflict_acronym(self, client, admin_headers, test_diving_organization, db_session):
        """Test updating a diving organization with conflicting acronym."""
        # Create another organization
        other_org = DivingOrganization(
            name="Other Organization",
            acronym="OTHER",
            website="https://other.org"
        )
        db_session.add(other_org)
        db_session.commit()
        
        update_data = {"acronym": other_org.acronym}  # Same acronym as other org
        
        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Organization with this acronym already exists" in response.json()["detail"]
    
    def test_update_diving_organization_conflict_name(self, client, admin_headers, test_diving_organization, db_session):
        """Test updating a diving organization with conflicting name."""
        # Create another organization
        other_org = DivingOrganization(
            name="Other Organization",
            acronym="OTHER",
            website="https://other.org"
        )
        db_session.add(other_org)
        db_session.commit()
        
        update_data = {"name": other_org.name}  # Same name as other org
        
        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Organization with this name already exists" in response.json()["detail"]
    
    def test_delete_diving_organization_admin(self, client, admin_headers, test_diving_organization):
        """Test deleting a diving organization as admin."""
        response = client.delete(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "Diving organization deleted successfully" in response.json()["message"]
        
        # Verify it's actually deleted
        get_response = client.get(f"/api/v1/diving-organizations/{test_diving_organization.id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_delete_diving_organization_non_admin(self, client, auth_headers, test_diving_organization):
        """Test deleting a diving organization as non-admin user."""
        response = client.delete(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_delete_diving_organization_not_found(self, client, admin_headers):
        """Test deleting a diving organization that doesn't exist."""
        response = client.delete("/api/v1/diving-organizations/999", headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Diving organization not found" in response.json()["detail"]
    
    def test_create_diving_organization_minimal_data(self, client, admin_headers):
        """Test creating a diving organization with minimal required data."""
        organization_data = {
            "name": "Minimal Organization",
            "acronym": "MIN"
        }
        
        response = client.post("/api/v1/diving-organizations/", 
                             json=organization_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == organization_data["name"]
        assert data["acronym"] == organization_data["acronym"]
        assert data["website"] is None
        assert data["logo_url"] is None
        assert data["description"] is None
        assert data["country"] is None
        assert data["founded_year"] is None
    
    def test_update_diving_organization_partial(self, client, admin_headers, test_diving_organization):
        """Test updating a diving organization with partial data."""
        original_name = test_diving_organization.name
        update_data = {"website": "https://newwebsite.org"}
        
        response = client.put(f"/api/v1/diving-organizations/{test_diving_organization.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["website"] == update_data["website"]
        assert data["name"] == original_name  # Should remain unchanged
        assert data["acronym"] == test_diving_organization.acronym  # Should remain unchanged 