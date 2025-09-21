import pytest
import os
import tempfile
import json
from unittest.mock import patch, MagicMock, mock_open
from botocore.exceptions import ClientError, NoCredentialsError

from app.services.r2_storage_service import R2StorageService


class TestR2StorageService:
    """Test R2StorageService functionality."""

    @pytest.fixture
    def r2_service(self):
        """Create R2StorageService instance for testing."""
        return R2StorageService()

    @pytest.fixture
    def sample_profile_data(self):
        """Sample dive profile data for testing."""
        return {
            "samples": [
                {"time_minutes": 0, "depth": 0, "temperature": 20},
                {"time_minutes": 1, "depth": 5, "temperature": 19},
                {"time_minutes": 2, "depth": 10, "temperature": 18}
            ],
            "calculated_max_depth": 10,
            "calculated_avg_depth": 5,
            "calculated_duration_minutes": 2
        }

    def test_check_r2_credentials_missing(self, r2_service):
        """Test R2 credentials check when credentials are missing."""
        with patch.dict(os.environ, {}, clear=True):
            service = R2StorageService()
            assert service.r2_available == False
            assert service.s3_client is None

    def test_check_r2_credentials_present(self, r2_service):
        """Test R2 credentials check when credentials are present."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                service = R2StorageService()
                assert service.r2_available == True
                mock_boto.assert_called_once()

    def test_create_s3_client_success(self, r2_service):
        """Test successful S3 client creation."""
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
                
                mock_boto.assert_called_once_with(
                    's3',
                    endpoint_url='https://test_account.r2.cloudflarestorage.com',
                    aws_access_key_id='test_key',
                    aws_secret_access_key='test_secret',
                    region_name='auto'
                )

    def test_create_s3_client_failure(self, r2_service):
        """Test S3 client creation failure."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client', side_effect=Exception("Connection failed")):
                service = R2StorageService()
                assert service.r2_available == True
                assert service.s3_client is None

    def test_get_user_path(self, r2_service):
        """Test user-specific path generation."""
        path = r2_service._get_user_path(123, "test_file.json")
        assert path.startswith("user_123/dive_profiles/")
        assert "test_file.json" in path
        assert "/2025/" in path  # Current year
        assert "/09/" in path or "/10/" in path  # Current month

    def test_upload_profile_r2_success(self, r2_service, sample_profile_data):
        """Test successful profile upload to R2."""
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
                content = json.dumps(sample_profile_data).encode('utf-8')
                
                result = service.upload_profile(123, "test_file.json", content)
                
                mock_client.put_object.assert_called_once()
                assert result.startswith("user_123/")
                assert "test_file.json" in result

    def test_upload_profile_r2_failure_fallback(self, r2_service, sample_profile_data):
        """Test R2 upload failure with local fallback."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_client.put_object.side_effect = ClientError(
                    {'Error': {'Code': 'NoSuchBucket'}}, 'PutObject'
                )
                mock_boto.return_value = mock_client
                
                with tempfile.TemporaryDirectory() as temp_dir:
                    with patch.object(r2_service, 'local_storage_base', temp_dir):
                        service = R2StorageService()
                        content = json.dumps(sample_profile_data).encode('utf-8')
                        
                        result = service.upload_profile(123, "test_file.json", content)
                        
                        assert result.startswith("uploads/dive-profiles/user_123/dive_profiles/")
                        assert "test_file.json" in result

    def test_upload_profile_local_only(self, r2_service, sample_profile_data):
        """Test profile upload with local storage only."""
        with patch.dict(os.environ, {}, clear=True):
            with tempfile.TemporaryDirectory() as temp_dir:
                with patch.object(r2_service, 'local_storage_base', temp_dir):
                    service = R2StorageService()
                    content = json.dumps(sample_profile_data).encode('utf-8')
                    
                    result = service.upload_profile(123, "test_file.json", content)
                    
                    assert result.startswith("uploads/dive-profiles/user_123/dive_profiles/")
                    assert "test_file.json" in result
                    
                    # Verify file was created
                    assert os.path.exists(result)

    def test_download_profile_r2_success(self, r2_service):
        """Test successful profile download from R2."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_response = {'Body': MagicMock()}
                mock_response['Body'].read.return_value = b'{"test": "data"}'
                mock_client.get_object.return_value = mock_response
                mock_boto.return_value = mock_client
                
                service = R2StorageService()
                result = service.download_profile(123, "user_123/dive_profiles/2025/09/test_file.json")
                
                mock_client.get_object.assert_called_once_with(
                    Bucket='test_bucket',
                    Key='user_123/dive_profiles/2025/09/test_file.json'
                )
                assert result == b'{"test": "data"}'

    def test_download_profile_r2_not_found_fallback(self, r2_service):
        """Test R2 download with file not found, fallback to local."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_client.get_object.side_effect = ClientError(
                    {'Error': {'Code': 'NoSuchKey'}}, 'GetObject'
                )
                mock_boto.return_value = mock_client
                
                with tempfile.TemporaryDirectory() as temp_dir:
                    with patch.dict(os.environ, {}, clear=True):
                        service = R2StorageService()
                        service.local_storage_base = temp_dir
                        
                        # Create local file
                        local_file_path = os.path.join(temp_dir, "user_123/dive_profiles/2025/09/test_file.json")
                        os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
                        with open(local_file_path, 'wb') as f:
                            f.write(b'{"test": "local_data"}')
                        
                        result = service.download_profile(123, "user_123/dive_profiles/2025/09/test_file.json")
                        
                        assert result == b'{"test": "local_data"}'

    def test_download_profile_not_found(self, r2_service):
        """Test profile download when file not found anywhere."""
        with patch.dict(os.environ, {}, clear=True):
            with tempfile.TemporaryDirectory() as temp_dir:
                with patch.object(r2_service, 'local_storage_base', temp_dir):
                    service = R2StorageService()
                    result = service.download_profile(123, "nonexistent_file.json")
                    
                    assert result is None

    def test_delete_profile_r2_success(self, r2_service):
        """Test successful profile deletion from R2."""
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
                result = service.delete_profile(123, "user_123/dive_profiles/2025/09/test_file.json")
                
                mock_client.delete_object.assert_called_once_with(
                    Bucket='test_bucket',
                    Key='user_123/dive_profiles/2025/09/test_file.json'
                )
                assert result == True

    def test_delete_profile_local_success(self, r2_service):
        """Test successful profile deletion from local storage."""
        with patch.dict(os.environ, {}, clear=True):
            with tempfile.TemporaryDirectory() as temp_dir:
                service = R2StorageService()
                service.local_storage_base = temp_dir
                
                # Create local file
                local_file_path = os.path.join(temp_dir, "user_123/dive_profiles/2025/09/test_file.json")
                os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
                with open(local_file_path, 'wb') as f:
                    f.write(b'{"test": "data"}')
                
                result = service.delete_profile(123, "user_123/dive_profiles/2025/09/test_file.json")
                
                assert result == True
                assert not os.path.exists(local_file_path)

    def test_delete_user_profiles_r2_success(self, r2_service):
        """Test successful deletion of all user profiles from R2."""
        with patch.dict(os.environ, {
            'R2_ACCOUNT_ID': 'test_account',
            'R2_ACCESS_KEY_ID': 'test_key',
            'R2_SECRET_ACCESS_KEY': 'test_secret',
            'R2_BUCKET_NAME': 'test_bucket'
        }):
            with patch('boto3.client') as mock_boto:
                mock_client = MagicMock()
                mock_client.list_objects_v2.return_value = {
                    'Contents': [
                        {'Key': 'user_123/dive_profiles/2025/09/file1.json'},
                        {'Key': 'user_123/dive_profiles/2025/09/file2.json'}
                    ]
                }
                mock_boto.return_value = mock_client
                
                service = R2StorageService()
                result = service.delete_user_profiles(123)
                
                mock_client.list_objects_v2.assert_called_once_with(
                    Bucket='test_bucket',
                    Prefix='user_123/dive_profiles/'
                )
                # delete_object should be called for each object
                assert mock_client.delete_object.call_count == 2  # Two objects in mock data
                assert result == True

    def test_delete_user_profiles_local_success(self, r2_service):
        """Test successful deletion of all user profiles from local storage."""
        with patch.dict(os.environ, {}, clear=True):
            with tempfile.TemporaryDirectory() as temp_dir:
                service = R2StorageService()
                service.local_storage_base = temp_dir
                
                # Create user dive_profiles directory with files
                user_dive_profiles_dir = os.path.join(temp_dir, "user_123", "dive_profiles")
                os.makedirs(user_dive_profiles_dir, exist_ok=True)
                with open(os.path.join(user_dive_profiles_dir, "file1.json"), 'w') as f:
                    f.write('{"test": "data1"}')
                with open(os.path.join(user_dive_profiles_dir, "file2.json"), 'w') as f:
                    f.write('{"test": "data2"}')
                
                result = service.delete_user_profiles(123)
                
                assert result == True
                assert not os.path.exists(user_dive_profiles_dir)

    def test_health_check_r2_available(self, r2_service):
        """Test health check when R2 is available."""
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
                result = service.health_check()
                
                assert result['r2_available'] == True
                assert result['boto3_available'] == True
                assert result['credentials_present'] == True
                assert result['local_storage_available'] == True

    def test_health_check_r2_unavailable(self, r2_service):
        """Test health check when R2 is unavailable."""
        with patch.dict(os.environ, {}, clear=True):
            with tempfile.TemporaryDirectory() as temp_dir:
                service = R2StorageService()
                service.local_storage_base = temp_dir
                result = service.health_check()
                
                assert result['r2_available'] == False
                assert result['boto3_available'] == True  # boto3 is available in container
                assert result['credentials_present'] == False
                assert result['local_storage_available'] == True
                assert result['local_storage_writable'] == True

    def test_health_check_local_storage_not_writable(self, r2_service):
        """Test health check when local storage is not writable."""
        with patch.dict(os.environ, {}, clear=True):
            service = R2StorageService()
            service.local_storage_base = '/dev/null'  # Use a path that definitely won't work
            result = service.health_check()
            
            assert result['local_storage_available'] == True
            assert result['local_storage_writable'] == False
