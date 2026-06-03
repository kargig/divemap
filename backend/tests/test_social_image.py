import pytest
from unittest.mock import patch, MagicMock
from PIL import Image
import io
from app.services.social_image_service import SocialImageService
from app.models import DiveMedia, SiteMedia

def test_social_image_service_parsing():
    """Unit test for SocialImageService internal parsing helpers."""
    service = SocialImageService()

    # Test _parse_time
    assert service._parse_time(10) == 10.0
    assert service._parse_time("54:00 min") == 54.0
    assert service._parse_time("1:30") == 1.5
    assert service._parse_time("0:01:30") == 1.5
    assert service._parse_time(None) is None
    assert service._parse_time("invalid") is None

    # Test _parse_depth
    assert service._parse_depth(20.5) == 20.5
    assert service._parse_depth("30.2 m") == 30.2
    assert service._parse_depth("15.0m") == 15.0
    assert service._parse_depth(None) is None
    assert service._parse_depth("invalid") is None

def test_generate_social_image_endpoint(client, user_token, test_dive, db_session):
    # Add media record for this dive
    media = DiveMedia(dive_id=test_dive.id, url="https://example.com/test.jpg", media_type="photo")
    db_session.add(media)
    db_session.commit()

    # Create a small valid JPEG image
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    valid_jpeg_bytes = img_byte_arr.getvalue()

    # Mock httpx.AsyncClient.get to return a dummy image
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = valid_jpeg_bytes

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        with patch("os.getenv", side_effect=lambda k, d=None: "example.com" if k == "R2_PUBLIC_DOMAIN" else d):
            # Now test our new route in dives_social.py
            response = client.post(
            f"/api/v1/dives/{test_dive.id}/social-image",
            json={"media_url": "https://example.com/test.jpg", "crop": {"x": 0, "y": 0, "width": 100, "height": 100}},
            headers={"Authorization": f"Bearer {user_token}"}
        )

        # The route is now implemented, it should return 200 (skeleton)
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.headers["Content-Disposition"].startswith(f"attachment; filename=divemap_dive_{test_dive.id}_social.jpg")

def test_generate_social_image_with_string_data(client, user_token, test_dive, db_session):
    """Test handling of profile data where numbers are strings (common in JSON)."""
    # Add media record for this dive
    media = DiveMedia(dive_id=test_dive.id, url="https://example.com/test.jpg", media_type="photo")
    db_session.add(media)
    db_session.commit()

    from unittest.mock import patch, MagicMock
    from PIL import Image
    import io

    img = Image.new('RGB', (100, 100), color = 'blue')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    valid_jpeg_bytes = img_byte_arr.getvalue()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = valid_jpeg_bytes

    # Sample data with strings for time and depth, including units and colons
    string_profile_data = {
        "samples": [
            {"time": "0:00 min", "depth": "0.0 m"},
            {"time": "30:00 min", "depth": "10.5 m"},
            {"time": "54:30 min", "depth": "0.0 m"}
        ]
    }

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        with patch("os.getenv", side_effect=lambda k, d=None: "example.com" if k == "R2_PUBLIC_DOMAIN" else d):
            with patch("app.services.r2_storage_service.r2_storage.download_profile", return_value=io.BytesIO(b"{}").getvalue()):
                # We mock orjson.loads to return our string-based data
                with patch("orjson.loads", return_value=string_profile_data):
                    # Update dive to have a .json path
                    test_dive.profile_xml_path = "test.json"

                    response = client.post(
                        f"/api/v1/dives/{test_dive.id}/social-image",
                        json={"media_url": "https://example.com/test.jpg", "crop": {"x": 0, "y": 0, "width": 50, "height": 50}},
                        headers={"Authorization": f"Bearer {user_token}"}
                    )

                assert response.status_code == 200
                assert response.headers["content-type"] == "image/jpeg"

def test_generate_social_image_unauthorized(client, user_token, test_dive, db_session, test_user_other):
    """Test that a user cannot generate an image for someone else's private dive."""
    # Make the dive private and change owner to another valid user
    test_dive.is_private = True
    test_dive.user_id = test_user_other.id
    db_session.commit()

    with patch("os.getenv", side_effect=lambda k, d=None: "example.com" if k == "R2_PUBLIC_DOMAIN" else d):
        response = client.post(
            f"/api/v1/dives/{test_dive.id}/social-image",
            json={"media_url": "https://example.com/test.jpg"},
            headers={"Authorization": f"Bearer {user_token}"}
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized"

def test_generate_social_image_missing_media_url(client, user_token, test_dive):
    """Test validation when media_url is missing."""
    response = client.post(
        f"/api/v1/dives/{test_dive.id}/social-image",
        json={"crop": {"x": 0, "y": 0, "width": 100, "height": 100}},
        headers={"Authorization": f"Bearer {user_token}"}
    )

    assert response.status_code == 400
    assert "media_url or media_id is required" in response.json()["detail"]

def test_generate_social_image_with_media_id(client, user_token, test_dive, db_session):
    """Test generating an image using media_id instead of raw URL."""
    # Add media record for this dive
    media = DiveMedia(dive_id=test_dive.id, url="https://example.com/test.jpg", media_type="photo")
    db_session.add(media)
    db_session.commit()

    # Create a small valid JPEG image
    img = Image.new('RGB', (100, 100), color = 'green')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    valid_jpeg_bytes = img_byte_arr.getvalue()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = valid_jpeg_bytes
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        with patch("os.getenv", side_effect=lambda k, d=None: "example.com" if k == "R2_PUBLIC_DOMAIN" else d):
            response = client.post(
                f"/api/v1/dives/{test_dive.id}/social-image",
                json={"media_id": media.id, "crop": {"x": 0, "y": 0, "width": 100, "height": 100}},
                headers={"Authorization": f"Bearer {user_token}"}
            )
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "image/jpeg"


def test_generate_social_image_not_found(client, user_token):
    """Test response for non-existent dive."""
    with patch("os.getenv", side_effect=lambda k, d=None: "example.com" if k == "R2_PUBLIC_DOMAIN" else d):
        response = client.post(
            "/api/v1/dives/99999/social-image",
            json={"media_url": "https://example.com/test.jpg"},
            headers={"Authorization": f"Bearer {user_token}"}
        )

    assert response.status_code == 404
    assert "Dive not found" in response.json()["detail"]

def test_generate_social_image_ssrf_protection(client, user_token, test_dive):
    """Test that requests to untrusted domains are rejected (SSRF protection)."""
    response = client.post(
        f"/api/v1/dives/{test_dive.id}/social-image",
        json={"media_url": "https://malicious.com/attack.jpg"},
        headers={"Authorization": f"Bearer {user_token}"}
    )

    assert response.status_code == 400
    assert "Invalid media_url: untrusted domain" in response.json()["detail"]

def test_generate_social_image_media_association_failure(client, user_token, test_dive, db_session):
    """Test that requests for media not belonging to the dive/site are rejected (IDOR protection)."""
    # We DON'T add the media record for this dive

    with patch("os.getenv", side_effect=lambda k, d=None: "example.com" if k == "R2_PUBLIC_DOMAIN" else d):
        response = client.post(
            f"/api/v1/dives/{test_dive.id}/social-image",
            json={"media_url": "https://example.com/other-users-photo.jpg"},
            headers={"Authorization": f"Bearer {user_token}"}
        )

    assert response.status_code == 403
    assert "media does not belong to this dive or site" in response.json()["detail"]

