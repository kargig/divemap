import pytest
from fastapi import status
from app.models import AvailableTag, DiveSiteTag, DiveSite

class TestTags:
    """Test tag management endpoints."""
    
    def test_get_all_tags(self, client):
        """Test getting all available tags."""
        response = client.get("/api/v1/tags/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # Check that all required fields are present
        for tag in data:
            assert "id" in tag
            assert "name" in tag
            assert "description" in tag
            assert "created_by" in tag
            assert "created_at" in tag
    
    def test_get_tags_with_counts(self, client):
        """Test getting all tags with dive site counts."""
        response = client.get("/api/v1/tags/with-counts")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # Check that all required fields are present including dive_site_count
        for tag in data:
            assert "id" in tag
            assert "name" in tag
            assert "description" in tag
            assert "created_by" in tag
            assert "created_at" in tag
            assert "dive_site_count" in tag
            assert isinstance(tag["dive_site_count"], int)
    
    def test_create_tag_admin(self, client, admin_headers):
        """Test creating a new tag as admin."""
        tag_data = {
            "name": "New Test Tag",
            "description": "A test tag created by admin"
        }
        
        response = client.post("/api/v1/tags/", 
                             json=tag_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "New Test Tag"
        assert data["description"] == "A test tag created by admin"
        assert "id" in data
        assert "created_at" in data
    
    def test_create_tag_moderator(self, client, moderator_headers):
        """Test creating a new tag as moderator."""
        tag_data = {
            "name": "Moderator Tag",
            "description": "A test tag created by moderator"
        }
        
        response = client.post("/api/v1/tags/", 
                             json=tag_data, headers=moderator_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Moderator Tag"
        assert data["description"] == "A test tag created by moderator"
    
    def test_create_tag_regular_user(self, client, auth_headers):
        """Test creating a new tag as regular user (should be forbidden)."""
        tag_data = {
            "name": "User Tag",
            "description": "A test tag created by regular user"
        }
        
        response = client.post("/api/v1/tags/", 
                             json=tag_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_create_tag_unauthorized(self, client):
        """Test creating a new tag without authentication."""
        tag_data = {
            "name": "Unauthorized Tag",
            "description": "A test tag created without auth"
        }
        
        response = client.post("/api/v1/tags/", json=tag_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_create_tag_duplicate_name(self, client, admin_headers, db_session):
        """Test creating tag with duplicate name."""
        # Create a tag first
        existing_tag = AvailableTag(name="Existing Tag", description="Test")
        db_session.add(existing_tag)
        db_session.commit()
        
        tag_data = {
            "name": "Existing Tag",  # Duplicate name
            "description": "Another description"
        }
        
        response = client.post("/api/v1/tags/", 
                             json=tag_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.json()["detail"]
    
    def test_create_tag_invalid_data(self, client, admin_headers):
        """Test creating tag with invalid data."""
        tag_data = {
            "name": "",  # Empty name
            "description": "Test description"
        }
        
        response = client.post("/api/v1/tags/", 
                             json=tag_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_update_tag_admin(self, client, admin_headers, db_session):
        """Test updating a tag as admin."""
        # Create a tag first
        tag = AvailableTag(name="Original Tag", description="Original description")
        db_session.add(tag)
        db_session.commit()
        
        update_data = {
            "name": "Updated Tag",
            "description": "Updated description"
        }
        
        response = client.put(f"/api/v1/tags/{tag.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Tag"
        assert data["description"] == "Updated description"
    
    def test_update_tag_non_admin(self, client, auth_headers, db_session):
        """Test updating a tag as non-admin user."""
        # Create a tag first
        tag = AvailableTag(name="Test Tag", description="Test description")
        db_session.add(tag)
        db_session.commit()
        
        update_data = {"name": "Updated by user"}
        
        response = client.put(f"/api/v1/tags/{tag.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_update_tag_not_found(self, client, admin_headers):
        """Test updating non-existent tag."""
        update_data = {"name": "Updated Tag"}
        
        response = client.put("/api/v1/tags/999", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Tag not found" in response.json()["detail"]
    
    def test_delete_tag_admin(self, client, admin_headers, db_session):
        """Test deleting a tag as admin."""
        # Create a tag first
        tag = AvailableTag(name="Tag to Delete", description="Will be deleted")
        db_session.add(tag)
        db_session.commit()
        
        response = client.delete(f"/api/v1/tags/{tag.id}", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "Tag deleted successfully" in response.json()["message"]
    
    def test_delete_tag_non_admin(self, client, auth_headers, db_session):
        """Test deleting a tag as non-admin user."""
        # Create a tag first
        tag = AvailableTag(name="Tag to Delete", description="Will be deleted")
        db_session.add(tag)
        db_session.commit()
        
        response = client.delete(f"/api/v1/tags/{tag.id}", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_delete_tag_not_found(self, client, admin_headers):
        """Test deleting non-existent tag."""
        response = client.delete("/api/v1/tags/999", headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Tag not found" in response.json()["detail"]
    
    def test_add_tag_to_dive_site(self, client, admin_headers, db_session):
        """Test adding a tag to a dive site."""
        # Create a tag and dive site
        tag = AvailableTag(name="Test Tag", description="Test")
        dive_site = DiveSite(name="Test Site", description="Test")
        db_session.add(tag)
        db_session.add(dive_site)
        db_session.commit()
        
        tag_data = {"tag_id": tag.id}
        
        response = client.post(f"/api/v1/tags/dive-sites/{dive_site.id}/tags", 
                             json=tag_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["dive_site_id"] == dive_site.id
        assert data["tag_id"] == tag.id
    
    def test_add_tag_to_dive_site_non_admin(self, client, auth_headers, db_session):
        """Test adding a tag to a dive site as non-admin user."""
        # Create a tag and dive site
        tag = AvailableTag(name="Test Tag", description="Test")
        dive_site = DiveSite(name="Test Site", description="Test")
        db_session.add(tag)
        db_session.add(dive_site)
        db_session.commit()
        
        tag_data = {"tag_id": tag.id}
        
        response = client.post(f"/api/v1/tags/dive-sites/{dive_site.id}/tags", 
                             json=tag_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_add_tag_to_dive_site_invalid_data(self, client, admin_headers, db_session):
        """Test adding a tag to a dive site with invalid data."""
        # Create a dive site
        dive_site = DiveSite(name="Test Site", description="Test")
        db_session.add(dive_site)
        db_session.commit()
        
        tag_data = {"tag_id": 999}  # Non-existent tag
        
        response = client.post(f"/api/v1/tags/dive-sites/{dive_site.id}/tags", 
                             json=tag_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Tag not found" in response.json()["detail"]
    
    def test_remove_tag_from_dive_site(self, client, admin_headers, db_session):
        """Test removing a tag from a dive site."""
        # Create a tag and dive site with association
        tag = AvailableTag(name="Test Tag", description="Test")
        dive_site = DiveSite(name="Test Site", description="Test")
        db_session.add(tag)
        db_session.add(dive_site)
        db_session.commit()
        
        # Add the association
        dive_site_tag = DiveSiteTag(dive_site_id=dive_site.id, tag_id=tag.id)
        db_session.add(dive_site_tag)
        db_session.commit()
        
        response = client.delete(f"/api/v1/tags/dive-sites/{dive_site.id}/tags/{tag.id}", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "Tag removed from dive site" in response.json()["message"]
    
    def test_remove_tag_from_dive_site_non_admin(self, client, auth_headers, db_session):
        """Test removing a tag from a dive site as non-admin user."""
        # Create a tag and dive site with association
        tag = AvailableTag(name="Test Tag", description="Test")
        dive_site = DiveSite(name="Test Site", description="Test")
        db_session.add(tag)
        db_session.add(dive_site)
        db_session.commit()
        
        # Add the association
        dive_site_tag = DiveSiteTag(dive_site_id=dive_site.id, tag_id=tag.id)
        db_session.add(dive_site_tag)
        db_session.commit()
        
        response = client.delete(f"/api/v1/tags/dive-sites/{dive_site.id}/tags/{tag.id}", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_remove_tag_from_dive_site_not_found(self, client, admin_headers, db_session):
        """Test removing a non-existent tag association."""
        # Create a dive site
        dive_site = DiveSite(name="Test Site", description="Test")
        db_session.add(dive_site)
        db_session.commit()
        
        response = client.delete(f"/api/v1/tags/dive-sites/{dive_site.id}/tags/999", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Tag assignment not found" in response.json()["detail"] 