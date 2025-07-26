import pytest
from fastapi import status

class TestUsers:
    """Test users endpoints."""
    
    def test_get_current_user_success(self, client, auth_headers, test_user):
        """Test getting current user profile with valid authentication."""
        response = client.get("/api/v1/users/me", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["is_admin"] == test_user.is_admin
        assert "enabled" in data
    
    def test_get_current_user_unauthorized(self, client):
        """Test getting current user profile without authentication."""
        response = client.get("/api/v1/users/me")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_update_current_user_success(self, client, auth_headers, test_user):
        """Test updating current user profile successfully."""
        update_data = {
            "username": "updateduser",
            "email": "updated@example.com"
        }
        
        response = client.put("/api/v1/users/me", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "updateduser"
        assert data["email"] == "updated@example.com"
    
    def test_update_current_user_unauthorized(self, client):
        """Test updating current user profile without authentication."""
        update_data = {"username": "updateduser"}
        
        response = client.put("/api/v1/users/me", json=update_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_update_current_user_invalid_data(self, client, auth_headers):
        """Test updating current user with invalid data."""
        update_data = {
            "username": "a",  # Too short
            "email": "invalid-email"
        }
        
        response = client.put("/api/v1/users/me", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_update_current_user_partial(self, client, auth_headers, test_user):
        """Test updating current user with partial data."""
        update_data = {"username": "partialupdate"}
        
        response = client.put("/api/v1/users/me", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "partialupdate"
        assert data["email"] == test_user.email  # Should remain unchanged


class TestAdminUserManagement:
    """Test admin user management endpoints."""
    
    def test_list_all_users_admin(self, client, admin_headers):
        """Test listing all users as admin."""
        response = client.get("/api/v1/users/admin/users", headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check that all required fields are present
        for user in data:
            assert "id" in user
            assert "username" in user
            assert "email" in user
            assert "is_admin" in user
            assert "is_moderator" in user
            assert "enabled" in user
            assert "created_at" in user
    
    def test_list_all_users_non_admin(self, client, auth_headers):
        """Test listing all users as non-admin user."""
        response = client.get("/api/v1/users/admin/users", headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_list_all_users_unauthorized(self, client):
        """Test listing all users without authentication."""
        response = client.get("/api/v1/users/admin/users")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_create_user_admin(self, client, admin_headers):
        """Test creating a new user as admin."""
        user_data = {
            "username": "newadminuser",
            "email": "newadmin@example.com",
            "password": "password123",
            "is_admin": False,
            "is_moderator": True,
            "enabled": True
        }
        
        response = client.post("/api/v1/users/admin/users", 
                             json=user_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "newadminuser"
        assert data["email"] == "newadmin@example.com"
        assert data["is_admin"] is False
        assert data["is_moderator"] is True
        assert data["enabled"] is True
    
    def test_create_user_non_admin(self, client, auth_headers):
        """Test creating a new user as non-admin user."""
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123"
        }
        
        response = client.post("/api/v1/users/admin/users", 
                             json=user_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_create_user_duplicate_username(self, client, admin_headers, test_user):
        """Test creating user with duplicate username."""
        user_data = {
            "username": "testuser",  # Already exists
            "email": "different@example.com",
            "password": "password123"
        }
        
        response = client.post("/api/v1/users/admin/users", 
                             json=user_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username or email already registered" in response.json()["detail"]
    
    def test_create_user_duplicate_email(self, client, admin_headers, test_user):
        """Test creating user with duplicate email."""
        user_data = {
            "username": "differentuser",
            "email": "test@example.com",  # Already exists
            "password": "password123"
        }
        
        response = client.post("/api/v1/users/admin/users", 
                             json=user_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username or email already registered" in response.json()["detail"]
    
    def test_create_user_invalid_data(self, client, admin_headers):
        """Test creating user with invalid data."""
        user_data = {
            "username": "a",  # Too short
            "email": "invalid-email",
            "password": "123"  # Too short
        }
        
        response = client.post("/api/v1/users/admin/users", 
                             json=user_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_update_user_admin(self, client, admin_headers, test_user):
        """Test updating user as admin."""
        update_data = {
            "username": "updatedbyadmin",
            "email": "updatedbyadmin@example.com",
            "is_admin": True,
            "is_moderator": False,
            "enabled": False
        }
        
        response = client.put(f"/api/v1/users/admin/users/{test_user.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "updatedbyadmin"
        assert data["email"] == "updatedbyadmin@example.com"
        assert data["is_admin"] is True
        assert data["is_moderator"] is False
        assert data["enabled"] is False
    
    def test_update_user_non_admin(self, client, auth_headers, test_user):
        """Test updating user as non-admin user."""
        update_data = {"username": "updatedbyuser"}
        
        response = client.put(f"/api/v1/users/admin/users/{test_user.id}", 
                            json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_update_user_not_found(self, client, admin_headers):
        """Test updating non-existent user."""
        update_data = {"username": "updateduser"}
        
        response = client.put("/api/v1/users/admin/users/999", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "User not found" in response.json()["detail"]
    
    def test_update_user_partial(self, client, admin_headers, test_user):
        """Test updating user with partial data."""
        update_data = {"enabled": False}
        
        response = client.put(f"/api/v1/users/admin/users/{test_user.id}", 
                            json=update_data, headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enabled"] is False
        # Other fields should remain unchanged
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
    
    def test_delete_user_admin(self, client, admin_headers, test_user):
        """Test deleting user as admin."""
        response = client.delete(f"/api/v1/users/admin/users/{test_user.id}", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "User deleted successfully" in response.json()["message"]
    
    def test_delete_user_non_admin(self, client, auth_headers, test_user):
        """Test deleting user as non-admin user."""
        response = client.delete(f"/api/v1/users/admin/users/{test_user.id}", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_delete_user_not_found(self, client, admin_headers):
        """Test deleting non-existent user."""
        response = client.delete("/api/v1/users/admin/users/999", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "User not found" in response.json()["detail"]
    
    def test_delete_own_account(self, client, admin_headers, test_admin_user):
        """Test admin trying to delete their own account."""
        response = client.delete(f"/api/v1/users/admin/users/{test_admin_user.id}", 
                               headers=admin_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot delete your own account" in response.json()["detail"] 