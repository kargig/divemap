import pytest
from fastapi import status
from app.models import User
from app.schemas import AvatarType
import io
from unittest.mock import MagicMock, patch

@pytest.fixture
def avatar_file():
    """Create a mock image file for testing."""
    file_content = b"fake-image-content"
    file = io.BytesIO(file_content)
    file.name = "test_avatar.jpg"
    return file

def test_get_library_avatars(client, auth_headers):
    """Test listing available library avatars."""
    # We need to mock r2_storage.list_objects and get_library_avatar_url
    with patch("app.routers.users.r2_storage") as mock_storage:
        mock_storage.list_objects.return_value = ["library/avatars/eel.webp", "library/avatars/shark.webp"]
        mock_storage.get_library_avatar_url.side_effect = lambda x: f"https://r2.com/{x}"
        
        response = client.get("/api/v1/users/avatars/library", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["path"] == "library/avatars/eel.webp"
        assert "https://r2.com/library/avatars/eel.webp" in data[0]["full_url"]

def test_set_library_avatar(client, db_session, test_user, auth_headers):
    """Test selecting an avatar from the library."""
    avatar_path = "library/avatars/eel.webp"
    
    response = client.post(
        "/api/v1/users/me/avatar/library",
        json={"avatar_url": avatar_path, "avatar_type": "library"},
        headers=auth_headers
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["avatar_url"] == avatar_path
    assert data["avatar_type"] == "library"
    
    # Verify in DB
    db_session.refresh(test_user)
    assert test_user.avatar_url == avatar_path
    assert test_user.avatar_type == "library"

def test_set_library_avatar_invalid_path(client, auth_headers):
    """Test error handling for invalid library path."""
    response = client.post(
        "/api/v1/users/me/avatar/library",
        json={"avatar_url": "malicious/path.png", "avatar_type": "library"},
        headers=auth_headers
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_upload_custom_avatar(client, db_session, test_user, auth_headers):
    """Test uploading a custom avatar."""
    with patch("app.routers.users.image_processing") as mock_proc, \
         patch("app.routers.users.r2_storage") as mock_storage:
        
        # Mock image processing
        mock_stream = MagicMock()
        mock_stream.getvalue.return_value = b"processed-webp"
        mock_proc.process_avatar.return_value = mock_stream
        
        # Mock storage
        mock_storage.upload_avatar.return_value = "avatars/user_1/uuid.webp"
        mock_storage.get_photo_url.return_value = "https://r2.com/avatars/user_1/uuid.webp"
        
        files = {"file": ("avatar.jpg", b"raw-content", "image/jpeg")}
        response = client.post("/api/v1/users/me/avatar/upload", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["avatar_type"] == "custom"
        assert "uuid.webp" in data["avatar_url"]
        assert "avatar_full_url" in data
        
        # Verify in DB
        db_session.refresh(test_user)
        assert test_user.avatar_type == "custom"
        assert "uuid.webp" in test_user.avatar_url

def test_remove_avatar_reset_to_google(client, db_session, test_user, auth_headers):
    """Test resetting avatar to Google default when google_avatar_url exists."""
    google_url = "https://google.com/photo.jpg"
    test_user.google_avatar_url = google_url
    test_user.avatar_url = "library/avatars/eel.webp"
    test_user.avatar_type = "library"
    db_session.commit()
    
    response = client.delete("/api/v1/users/me/avatar", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    assert data["avatar_url"] == google_url
    assert data["avatar_type"] == "google"
    
    # Verify in DB
    db_session.refresh(test_user)
    assert test_user.avatar_url == google_url
    assert test_user.avatar_type == "google"

def test_remove_avatar_no_google(client, db_session, test_user, auth_headers):
    """Test resetting avatar to None when no Google backup exists."""
    test_user.google_avatar_url = None
    test_user.avatar_url = "library/avatars/eel.webp"
    test_user.avatar_type = "library"
    db_session.commit()
    
    response = client.delete("/api/v1/users/me/avatar", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    assert data["avatar_url"] is None
    assert data["avatar_type"] is None

def test_populate_avatar_full_url_utility(db_session, test_user):
    """Test the populate_avatar_full_url helper utility directly."""
    from app.utils import populate_avatar_full_url
    
    with patch("app.services.r2_storage_service.r2_storage") as mock_storage:
        # Case 1: Custom Avatar
        test_user.avatar_url = "avatars/user_1/test.webp"
        test_user.avatar_type = "custom"
        mock_storage.get_photo_url.return_value = "https://presigned-url.com"
        
        result = populate_avatar_full_url(test_user, {})
        assert result["avatar_full_url"] == "https://presigned-url.com"
        
        # Case 2: Library Avatar
        test_user.avatar_url = "library/avatars/unique_eel.webp"
        test_user.avatar_type = "library"
        mock_storage.get_library_avatar_url.return_value = "https://library-url.com"
        
        result = populate_avatar_full_url(test_user, {})
        assert result["avatar_full_url"] == "https://library-url.com"
        
        # Case 3: Google Avatar (should return as is)
        test_user.avatar_url = "https://google.com/photo.jpg"
        test_user.avatar_type = "google"
        
        result = populate_avatar_full_url(test_user, {})
        assert result["avatar_full_url"] == "https://google.com/photo.jpg"
