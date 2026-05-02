import pytest
from fastapi import status
from sqlalchemy.orm import Session
from unittest.mock import MagicMock, patch
import io
import uuid

from app.models import DivingCenter, User, OwnershipStatus, DivingCenterManager, CenterMedia, MediaType

@pytest.fixture
def fake_image_file():
    """Create a mock image file for testing."""
    file_content = b"fake-image-content"
    return {"file": ("test_image.jpg", file_content, "image/jpeg")}

def test_unauthorized_user_cannot_upload_logo(client, test_diving_center, auth_headers_other_user):
    """Test that an unauthorized user cannot upload a logo."""
    files = {"file": ("logo.jpg", b"fake-logo", "image/jpeg")}
    response = client.post(
        f"/api/v1/diving-centers/{test_diving_center.id}/logo",
        headers=auth_headers_other_user,
        files=files
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN

def test_approved_owner_can_upload_logo(client, test_diving_center, test_user, auth_headers, db_session):
    """Test that an approved owner CAN upload a logo."""
    # Set user as approved owner
    test_diving_center.owner_id = test_user.id
    test_diving_center.ownership_status = OwnershipStatus.approved
    db_session.commit()
    
    with patch("app.routers.diving_centers.image_processing") as mock_proc, \
         patch("app.routers.diving_centers.r2_storage") as mock_storage:
        
        # Mock image processing
        mock_stream = MagicMock()
        mock_stream.read.return_value = b"processed-webp"
        mock_proc.process_avatar.return_value = mock_stream
        
        # Mock storage
        fake_url = f"centers/{test_diving_center.id}/logo.webp"
        mock_storage.upload_center_logo.return_value = fake_url
        mock_storage.get_photo_url.return_value = f"https://r2.com/{fake_url}"
        
        files = {"file": ("logo.jpg", b"fake-logo", "image/jpeg")}
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/logo",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["logo_url"] == fake_url
        assert data["logo_full_url"] == f"https://r2.com/{fake_url}"

        # Verify DB update
        db_session.refresh(test_diving_center)
        assert test_diving_center.logo_url == fake_url

def test_manager_can_upload_media(client, test_diving_center, test_user_other, auth_headers_other_user, db_session):
    """Test that a manager CAN upload media."""
    # Add user_other as manager
    manager = DivingCenterManager(diving_center_id=test_diving_center.id, user_id=test_user_other.id)
    db_session.add(manager)
    db_session.commit()
    
    with patch("app.routers.diving_centers.image_processing") as mock_proc, \
         patch("app.routers.diving_centers.r2_storage") as mock_storage, \
         patch("app.routers.diving_centers.populate_center_media_urls") as mock_populate:
        
        # Mock image processing
        mock_proc.process_image.return_value = {"original": b"orig", "medium": b"med", "thumbnail": b"thumb"}
        
        # Mock storage
        mock_paths = {
            "original": f"centers/{test_diving_center.id}/media/orig.jpg",
            "medium": f"centers/{test_diving_center.id}/media/med.jpg",
            "thumbnail": f"centers/{test_diving_center.id}/media/thumb.jpg"
        }
        mock_storage.upload_photo_set.return_value = mock_paths
        
        files = {"file": ("photo.jpg", b"fake-photo", "image/jpeg")}
        response = client.post(
            f"/api/v1/diving-centers/{test_diving_center.id}/media",
            headers=auth_headers_other_user,
            files=files
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify DB insert
        media = db_session.query(CenterMedia).filter(CenterMedia.diving_center_id == test_diving_center.id).first()
        assert media is not None
        assert media.user_id == test_user_other.id
        assert media.url == mock_paths["original"]

def test_deleting_media_removes_from_r2_and_db(client, test_diving_center, test_user, auth_headers, db_session):
    """Test that deleting a media item removes the file from R2 (mocked) and the row from DB."""
    # Set user as admin (admin is also center manager)
    test_user.is_admin = True
    db_session.commit()
    
    # Create media
    media = CenterMedia(
        diving_center_id=test_diving_center.id,
        user_id=test_user.id,
        media_type=MediaType.photo,
        url="centers/1/media/orig.jpg",
        medium_url="centers/1/media/med.jpg",
        thumbnail_url="centers/1/media/thumb.jpg"
    )
    db_session.add(media)
    db_session.commit()
    db_session.refresh(media)
    
    with patch("app.routers.diving_centers.r2_storage") as mock_storage:
        response = client.delete(
            f"/api/v1/diving-centers/{test_diving_center.id}/media/{media.id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify R2 deletions were called 3 times (orig, med, thumb)
        assert mock_storage.delete_photo.call_count == 3
        
        # Verify DB deletion
        deleted_media = db_session.query(CenterMedia).filter(CenterMedia.id == media.id).first()
        assert deleted_media is None
