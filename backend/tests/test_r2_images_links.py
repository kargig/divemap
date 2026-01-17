import pytest
import os
import tempfile
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError

from app.services.r2_storage_service import R2StorageService

class TestR2ImagesLinks:
    """Test R2StorageService functionality specifically for image links and photos."""

    @pytest.fixture
    def r2_service(self):
        """Create R2StorageService instance for testing."""
        return R2StorageService()

    def test_get_photo_url_local_storage(self, r2_service):
        """Test URL generation for local storage photos."""
        # Case 1: Path starts with uploads/
        local_path = "uploads/user_123/photos/dive_1/test.jpg"
        url = r2_service.get_photo_url(local_path)
        assert url == "/uploads/user_123/photos/dive_1/test.jpg"
        
        # Case 2: Relative path without uploads/ prefix (should prepend /uploads/)
        # Note: implementation prepends /uploads/ if it doesn't start with uploads/
        # but relies on "not startswith user_" check first.
        relative_path = "some/local/path/image.jpg"
        url = r2_service.get_photo_url(relative_path)
        assert url == "/uploads/some/local/path/image.jpg"

    def test_get_photo_url_r2_presigned(self, r2_service):
        """Test presigned URL generation for R2 photos."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_client.generate_presigned_url.return_value = "https://presigned-url.com/xyz"
                mock_boto.return_value = mock_client
                
                service = R2StorageService()
                r2_path = "user_123/photos/dive_1/test.jpg"
                
                url = service.get_photo_url(r2_path)
                
                mock_client.generate_presigned_url.assert_called_once_with(
                    'get_object',
                    Params={'Bucket': 'test_bucket', 'Key': r2_path},
                    ExpiresIn=3600
                )
                assert url == "https://presigned-url.com/xyz"

    def test_get_photo_url_r2_public_domain(self, r2_service):
        """Test URL generation when R2_PUBLIC_DOMAIN is set."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket',
            'R2_PUBLIC_DOMAIN': 'images.example.com'
        }):
            with patch('boto3.client') as mock_boto:
                service = R2StorageService()
                r2_path = "user_123/photos/dive_1/test.jpg"
                
                url = service.get_photo_url(r2_path)
                
                # Should not generate presigned URL
                assert service.s3_client is not None # Ensure client exists but isn't used for URL
                assert url == "https://images.example.com/user_123/photos/dive_1/test.jpg"

    def test_get_photo_url_r2_failure_fallback(self, r2_service):
        """Test fallback URL when presigned generation fails."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_client.generate_presigned_url.side_effect = Exception("Generation failed")
                mock_boto.return_value = mock_client
                
                service = R2StorageService()
                r2_path = "user_123/photos/dive_1/test.jpg"
                
                url = service.get_photo_url(r2_path)
                
                # Should fallback to standard public endpoint format
                expected_fallback = "https://pub-test_account.r2.dev/test_bucket/user_123/photos/dive_1/test.jpg"
                assert url == expected_fallback

    def test_upload_photo_r2(self, r2_service):
        """Test uploading photo to R2."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_boto.return_value = mock_client
                
                service = R2StorageService()
                content = b"fake image content"
                
                path = service.upload_photo(123, "img.jpg", content, dive_id=456)
                
                assert "user_123/photos/dive_456/" in path
                assert path.endswith("img.jpg")
                mock_client.put_object.assert_called_once()

    def test_upload_photo_local_fallback(self, r2_service):
        """Test local fallback when R2 upload fails."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_client.put_object.side_effect = Exception("Upload failed")
                mock_boto.return_value = mock_client
                
                with tempfile.TemporaryDirectory() as temp_dir:
                    # Mock os.path.join to return path within temp_dir for write verification
                    # But we need _upload_photo_local to actually run.
                    # Instead, we can just let it run and check the return value which will be the relative path
                    # We need to mock 'open' only if we don't want real file IO, but tempfile handles that.
                    # The issue is `_upload_photo_local` uses hardcoded "uploads/..." path.
                    # We'll just verify the return path and that it falls back.
                    
                    # We can mock `_upload_photo_local` to verify it's called
                    with patch.object(R2StorageService, '_upload_photo_local') as mock_local_upload:
                        mock_local_upload.return_value = "uploads/local/path.jpg"
                        
                        service = R2StorageService()
                        content = b"fake image content"
                        
                        path = service.upload_photo(123, "img.jpg", content, dive_id=456)
                        
                        mock_local_upload.assert_called_once()
                        assert path == "uploads/local/path.jpg"

    def test_delete_photo_r2(self, r2_service):
        """Test deleting photo from R2."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_boto.return_value = mock_client
                
                service = R2StorageService()
                r2_path = "user_123/photos/dive_1/img.jpg"
                
                result = service.delete_photo(r2_path)
                
                # Should attempt to delete original and variants
                assert mock_client.delete_object.call_count == 3
                
                # Check calls (order matters in implementation, but we can verify any order)
                # Implementation deletes original, then medium, then thumbnail
                from unittest.mock import call
                expected_calls = [
                    call(Bucket='test_bucket', Key='user_123/photos/dive_1/img.jpg'),
                    call(Bucket='test_bucket', Key='user_123/photos/dive_1/img_medium.webp'),
                    call(Bucket='test_bucket', Key='user_123/photos/dive_1/img_thumbnail.webp')
                ]
                mock_client.delete_object.assert_has_calls(expected_calls)
                assert result is True

    def test_delete_photo_local(self, r2_service):
        """Test deleting photo from local storage."""
        # Should detect local path (not starting with user_)
        local_path = "uploads/user_123/photos/img.jpg"
        
        with patch('os.path.exists', return_value=True), \
             patch('os.remove') as mock_remove:
            
            result = r2_service.delete_photo(local_path)
            
            assert result is True
            assert mock_remove.call_count == 3
            
            from unittest.mock import call
            expected_calls = [
                call('uploads/user_123/photos/img.jpg'),
                call('uploads/user_123/photos/img_medium.webp'),
                call('uploads/user_123/photos/img_thumbnail.webp')
            ]
            mock_remove.assert_has_calls(expected_calls)
