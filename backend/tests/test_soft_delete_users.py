import pytest
from fastapi import status
from app.models import User

def test_archive_self(client, auth_headers, test_user, db_session):
    """User can archive their own account."""
    response = client.delete("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Account archived successfully"
    
    db_session.refresh(test_user)
    assert test_user.deleted_at is not None
    assert test_user.enabled is False

def test_login_after_archive_fails(client, test_user, db_session):
    """Archived user cannot log in."""
    from datetime import datetime, timezone
    test_user.deleted_at = datetime.now(timezone.utc)
    test_user.enabled = False
    db_session.commit()
    
    login_data = {
        "username": test_user.username,
        "password": "TestPassword123!"
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    # The current auth system returns 401/403 for disabled users
    assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

def test_admin_soft_delete_user(client, admin_headers, test_user, db_session):
    """Admin can soft delete (archive) a user."""
    response = client.delete(f"/api/v1/users/admin/users/{test_user.id}", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "User archived successfully"
    
    db_session.refresh(test_user)
    assert test_user.deleted_at is not None
    assert test_user.enabled is False

def test_admin_hard_delete_user(client, admin_headers, test_user, db_session):
    """Admin can hard delete a user with force=true."""
    user_id = test_user.id
    response = client.delete(f"/api/v1/users/admin/users/{user_id}?force=true", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "User permanently deleted"
    
    # Verify user is gone from DB
    deleted_user = db_session.query(User).filter(User.id == user_id).first()
    assert deleted_user is None

def test_admin_restore_user(client, admin_headers, test_user, db_session):
    """Admin can restore an archived user."""
    from datetime import datetime, timezone
    test_user.deleted_at = datetime.now(timezone.utc)
    test_user.enabled = False
    db_session.commit()
    
    response = client.post(f"/api/v1/users/admin/users/{test_user.id}/restore", headers=admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "User restored successfully"
    
    db_session.refresh(test_user)
    assert test_user.deleted_at is None
    assert test_user.enabled is True

def test_restore_user_unauthorized(client, auth_headers, test_user, db_session):
    """Regular user cannot restore accounts."""
    from datetime import datetime, timezone
    test_user.deleted_at = datetime.now(timezone.utc)
    test_user.enabled = False
    db_session.commit()
    
    response = client.post(f"/api/v1/users/admin/users/{test_user.id}/restore", headers=auth_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_public_profile_hidden_after_archive(client, test_user, db_session):
    """Archived user profile is not visible to public."""
    username = test_user.username
    from datetime import datetime, timezone
    test_user.deleted_at = datetime.now(timezone.utc)
    test_user.enabled = False
    db_session.commit()
    
    response = client.get(f"/api/v1/users/{username}/public")
    assert response.status_code == status.HTTP_404_NOT_FOUND
