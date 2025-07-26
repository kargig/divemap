import pytest
from fastapi import status
from app.models import SiteRating, SiteComment

class TestDiveSites:
    """Test dive sites endpoints."""
    
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
    
    def test_get_dive_sites_with_search(self, client, test_dive_site):
        """Test getting dive sites with search parameter."""
        response = client.get("/api/v1/dive-sites/?search=Test")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == test_dive_site.name
    
    def test_get_dive_sites_with_filter(self, client, test_dive_site):
        """Test getting dive sites with difficulty filter."""
        response = client.get("/api/v1/dive-sites/?difficulty=intermediate")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["difficulty_level"] == "intermediate"
    
    def test_get_dive_site_detail_success(self, client, test_dive_site):
        """Test getting specific dive site details."""
        response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == test_dive_site.name
        assert data["description"] == test_dive_site.description
        assert data["latitude"] == test_dive_site.latitude
        assert data["longitude"] == test_dive_site.longitude
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
            "longitude": 30.0,
            "access_instructions": "Boat access",
            "difficulty_level": "advanced"
        }
        
        response = client.post("/api/v1/dive-sites/", 
                             json=dive_site_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "New Dive Site"
        assert data["description"] == "A new dive site"
        assert data["latitude"] == 25.0
        assert data["longitude"] == 30.0
    
    def test_create_dive_site_unauthorized(self, client):
        """Test creating dive site without authentication."""
        dive_site_data = {
            "name": "New Dive Site",
            "description": "A new dive site",
            "latitude": 25.0,
            "longitude": 30.0
        }
        
        response = client.post("/api/v1/dive-sites/", json=dive_site_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_dive_site_not_admin(self, client, auth_headers):
        """Test creating dive site as non-admin user."""
        dive_site_data = {
            "name": "New Dive Site",
            "description": "A new dive site",
            "latitude": 25.0,
            "longitude": 30.0
        }
        
        response = client.post("/api/v1/dive-sites/", 
                             json=dive_site_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
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
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
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
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
    
    def test_delete_dive_site_unauthorized(self, client, test_dive_site):
        """Test deleting dive site without authentication."""
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_delete_dive_site_not_admin(self, client, auth_headers, test_dive_site):
        """Test deleting dive site as non-admin user."""
        response = client.delete(f"/api/v1/dive-sites/{test_dive_site.id}", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_delete_dive_site_not_found(self, client, admin_headers):
        """Test deleting non-existent dive site."""
        response = client.delete("/api/v1/dive-sites/999", headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_rate_dive_site_success(self, client, auth_headers, test_dive_site):
        """Test rating a dive site."""
        rating_data = {"score": 8}
        
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/rate", 
                             json=rating_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["score"] == 8
        assert data["dive_site_id"] == test_dive_site.id
    
    def test_rate_dive_site_unauthorized(self, client, test_dive_site):
        """Test rating dive site without authentication."""
        rating_data = {"score": 8}
        
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/rate", 
                             json=rating_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_rate_dive_site_invalid_score(self, client, auth_headers, test_dive_site):
        """Test rating dive site with invalid score."""
        rating_data = {"score": 15}  # Invalid score
        
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/rate", 
                             json=rating_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_rate_dive_site_not_found(self, client, auth_headers):
        """Test rating non-existent dive site."""
        rating_data = {"score": 8}
        
        response = client.post("/api/v1/dive-sites/999/rate", 
                             json=rating_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_rate_dive_site_update_existing(self, client, auth_headers, test_dive_site, test_user, db_session):
        """Test updating existing rating."""
        # Create initial rating
        initial_rating = SiteRating(
            dive_site_id=test_dive_site.id,
            user_id=test_user.id,
            score=5
        )
        db_session.add(initial_rating)
        db_session.commit()
        
        # Update rating
        rating_data = {"score": 9}
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/rate", 
                             json=rating_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["score"] == 9
    
    def test_get_dive_site_comments_success(self, client, test_dive_site):
        """Test getting dive site comments."""
        response = client.get(f"/api/v1/dive-sites/{test_dive_site.id}/comments")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_dive_site_comments_not_found(self, client):
        """Test getting comments for non-existent dive site."""
        response = client.get("/api/v1/dive-sites/999/comments")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_create_dive_site_comment_success(self, client, auth_headers, test_dive_site):
        """Test creating a comment on dive site."""
        comment_data = {"comment_text": "Great dive site!"}
        
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/comments", 
                             json=comment_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["comment_text"] == "Great dive site!"
        assert data["dive_site_id"] == test_dive_site.id
    
    def test_create_dive_site_comment_unauthorized(self, client, test_dive_site):
        """Test creating comment without authentication."""
        comment_data = {"comment_text": "Great dive site!"}
        
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/comments", 
                             json=comment_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_dive_site_comment_empty(self, client, auth_headers, test_dive_site):
        """Test creating comment with empty text."""
        comment_data = {"comment_text": ""}
        
        response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/comments", 
                             json=comment_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_create_dive_site_comment_not_found(self, client, auth_headers):
        """Test creating comment on non-existent dive site."""
        comment_data = {"comment_text": "Great dive site!"}
        
        response = client.post("/api/v1/dive-sites/999/comments", 
                             json=comment_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND 