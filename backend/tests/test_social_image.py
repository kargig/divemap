import pytest
from unittest.mock import patch, MagicMock
from PIL import Image
import io

def test_generate_social_image_endpoint(client, user_token, test_dive):
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
        # Now test our new route in dives_social.py
        response = client.post(
            f"/api/v1/dives/{test_dive.id}/social-image",
            json={"media_url": "https://example.com/test.jpg", "crop": {"x": 0, "y": 0, "width": 100, "height": 100}},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # The route is now implemented, it should return 200 (skeleton)
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"

def test_generate_social_image_with_string_data(client, user_token, test_dive):
    """Test handling of profile data where numbers are strings (common in JSON)."""
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

