import pytest
from fastapi import status

class TestUsers:
    """Test users endpoints."""
    
    def test_get_user_success(self, client, auth_headers, test_user):
        """Test getting user profile with valid authentication."""
        response = client.get(f"/api/v1/users/{test_user.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["is_admin"] == test_user.is_admin
    
    def test_get_user_unauthorized(self, client, test_user):
        """Test getting user profile without authentication."""
        response = client.get(f"/api/v1/users/{test_user.id}")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_user_not_found(self, client, auth_headers):
        """Test getting non-existent user."""
        response = client.get("/api/v1/users/999", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_get_user_wrong_user(self, client, auth_headers, test_admin_user):
        """Test getting another user's profile (should be forbidden)."""
        response = client.get(f"/api/v1/users/{test_admin_user.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_update_user_success(self, client, auth_headers, test_user):
        """Test updating user profile successfully."""
        update_data = {
            "username": "updateduser",
            "email": "updated@example.com"
        }
        
        response = client.put(f"/api/v1/users/{test_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "updateduser"
        assert data["email"] == "updated@example.com"
    
    def test_update_user_unauthorized(self, client, test_user):
        """Test updating user profile without authentication."""
        update_data = {"username": "updateduser"}
        
        response = client.put(f"/api/v1/users/{test_user.id}", json=update_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_update_user_wrong_user(self, client, auth_headers, test_admin_user):
        """Test updating another user's profile (should be forbidden)."""
        update_data = {"username": "updateduser"}
        
        response = client.put(f"/api/v1/users/{test_admin_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_update_user_invalid_data(self, client, auth_headers, test_user):
        """Test updating user with invalid data."""
        update_data = {
            "username": "a",  # Too short
            "email": "invalid-email"
        }
        
        response = client.put(f"/api/v1/users/{test_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_update_user_duplicate_username(self, client, auth_headers, test_user, test_admin_user):
        """Test updating user with duplicate username."""
        update_data = {"username": test_admin_user.username}
        
        response = client.put(f"/api/v1/users/{test_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "username already registered" in response.json()["detail"]
    
    def test_update_user_duplicate_email(self, client, auth_headers, test_user, test_admin_user):
        """Test updating user with duplicate email."""
        update_data = {"email": test_admin_user.email}
        
        response = client.put(f"/api/v1/users/{test_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email already registered" in response.json()["detail"]
    
    def test_update_user_partial(self, client, auth_headers, test_user):
        """Test updating user with partial data."""
        update_data = {"username": "partialupdate"}
        
        response = client.put(f"/api/v1/users/{test_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "partialupdate"
        assert data["email"] == test_user.email  # Should remain unchanged
    
    def test_update_user_not_found(self, client, auth_headers):
        """Test updating non-existent user."""
        update_data = {"username": "updateduser"}
        
        response = client.put("/api/v1/users/999", json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND 