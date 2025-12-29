"""
Cloudflare R2 Storage Service

Provides S3-compatible storage for dive profile data with local filesystem fallback.
Automatically detects R2 credentials and falls back to local storage when unavailable.
"""

import os
import logging
from typing import Optional, List
from datetime import datetime
import json

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

logger = logging.getLogger(__name__)


class R2StorageService:
    """Service for storing dive profile data in Cloudflare R2 with local fallback."""
    
    def __init__(self):
        """Initialize R2 storage service with credential checking."""
        self.r2_available = self._check_r2_credentials() and BOTO3_AVAILABLE
        self.s3_client = self._create_s3_client() if self.r2_available else None
        self.local_storage_base = "uploads/dive-profiles"
        
        if self.r2_available:
            logger.info("R2 storage service initialized successfully")
        else:
            logger.info("R2 storage unavailable, using local filesystem fallback")
    
    def _check_r2_credentials(self) -> bool:
        """Check if all required R2 environment variables are present."""
        required_vars = [
            'R2_ACCOUNT_ID', 
            'R2_ACCESS_KEY_ID', 
            'R2_SECRET_ACCESS_KEY', 
            'R2_BUCKET_NAME'
        ]
        return all(os.getenv(var) for var in required_vars)
    
    def _create_s3_client(self):
        """Create S3-compatible client for R2."""
        try:
            return boto3.client(
                's3',
                endpoint_url=f'https://{os.getenv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com',
                aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
                region_name='auto'
            )
        except Exception as e:
            logger.error(f"Failed to create R2 client: {e}")
            return None
    
    def _get_user_path(self, user_id: int, filename: str) -> str:
        """Generate user-specific path for storage."""
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        return f"user_{user_id}/dive_profiles/{year}/{month}/{filename}"
    
    def _get_photo_path(self, user_id: int, dive_id: int, filename: str) -> str:
        """Generate photo-specific path for storage: user_{user_id}/photos/dive_{dive_id}/{filename}"""
        return f"user_{user_id}/photos/dive_{dive_id}/{filename}"
    
    def _ensure_local_directory(self, file_path: str) -> None:
        """Ensure local directory exists for file path."""
        directory = os.path.dirname(file_path)
        os.makedirs(directory, exist_ok=True)
    
    def upload_profile(self, user_id: int, filename: str, content: bytes) -> str:
        """
        Upload dive profile to R2 with user-specific path.
        
        Args:
            user_id: User ID for path organization
            filename: Name of the file to store
            content: File content as bytes
            
        Returns:
            str: Path where file was stored (R2 key or local path)
        """
        if not self.r2_available:
            return self._upload_local(user_id, filename, content)
        
        r2_path = self._get_user_path(user_id, filename)
        try:
            self.s3_client.put_object(
                Bucket=os.getenv('R2_BUCKET_NAME'),
                Key=r2_path,
                Body=content
            )
            logger.info(f"Successfully uploaded profile to R2: {r2_path}")
            return r2_path
        except Exception as e:
            logger.warning(f"R2 upload failed, falling back to local: {e}")
            return self._upload_local(user_id, filename, content)
    
    def _upload_local(self, user_id: int, filename: str, content: bytes) -> str:
        """Upload profile to local filesystem."""
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        local_path = os.path.join(
            self.local_storage_base, 
            f"user_{user_id}", 
            "dive_profiles",
            year, 
            month, 
            filename
        )
        
        self._ensure_local_directory(local_path)
        
        with open(local_path, 'wb') as f:
            f.write(content)
        
        logger.info(f"Successfully uploaded profile to local storage: {local_path}")
        return local_path
    
    def download_profile(self, user_id: int, file_path: str) -> Optional[bytes]:
        """
        Download dive profile from R2 or local filesystem.
        
        Args:
            user_id: User ID for path organization
            file_path: Path to the file (R2 key or local path)
            
        Returns:
            bytes: File content or None if not found
        """
        if not self.r2_available or not file_path.startswith('user_'):
            return self._download_local(user_id, file_path)
        
        try:
            response = self.s3_client.get_object(
                Bucket=os.getenv('R2_BUCKET_NAME'),
                Key=file_path
            )
            content = response['Body'].read()
            logger.info(f"Successfully downloaded profile from R2: {file_path}")
            return content
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logger.warning(f"Profile not found in R2: {file_path}")
                return None
            else:
                logger.warning(f"R2 download failed, falling back to local: {e}")
                return self._download_local(user_id, file_path)
        except Exception as e:
            logger.warning(f"R2 download failed, falling back to local: {e}")
            return self._download_local(user_id, file_path)
    
    def _download_local(self, user_id: int, file_path: str) -> Optional[bytes]:
        """Download profile from local filesystem."""
        # Handle both R2-style paths and local paths
        if file_path.startswith('user_'):
            # Convert R2 path to local path
            local_path = os.path.join(self.local_storage_base, file_path)
        else:
            # Already a local path
            local_path = file_path
        
        try:
            with open(local_path, 'rb') as f:
                content = f.read()
            logger.info(f"Successfully downloaded profile from local storage: {local_path}")
            return content
        except FileNotFoundError:
            logger.warning(f"Profile not found in local storage: {local_path}")
            return None
        except Exception as e:
            logger.error(f"Failed to download profile from local storage: {e}")
            return None
    
    def delete_profile(self, user_id: int, file_path: str) -> bool:
        """
        Delete dive profile from R2 or local filesystem.
        
        Args:
            user_id: User ID for path organization
            file_path: Path to the file (R2 key or local path)
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        if not self.r2_available or not file_path.startswith('user_'):
            return self._delete_local(user_id, file_path)
        
        try:
            self.s3_client.delete_object(
                Bucket=os.getenv('R2_BUCKET_NAME'),
                Key=file_path
            )
            logger.info(f"Successfully deleted profile from R2: {file_path}")
            return True
        except Exception as e:
            logger.warning(f"R2 delete failed, falling back to local: {e}")
            return self._delete_local(user_id, file_path)
    
    def _delete_local(self, user_id: int, file_path: str) -> bool:
        """Delete profile from local filesystem."""
        # Handle both R2-style paths and local paths
        if file_path.startswith('user_'):
            # Convert R2 path to local path
            local_path = os.path.join(self.local_storage_base, file_path)
        else:
            # Already a local path
            local_path = file_path
        
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Successfully deleted profile from local storage: {local_path}")
                return True
            else:
                logger.warning(f"Profile not found in local storage: {local_path}")
                return False
        except Exception as e:
            logger.error(f"Failed to delete profile from local storage: {e}")
            return False
    
    def delete_user_profiles(self, user_id: int) -> bool:
        """
        Delete all profiles for a specific user.
        
        Args:
            user_id: User ID whose profiles should be deleted
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        if not self.r2_available:
            return self._delete_user_local(user_id)
        
        try:
            # List all objects with user dive_profiles prefix
            response = self.s3_client.list_objects_v2(
                Bucket=os.getenv('R2_BUCKET_NAME'),
                Prefix=f"user_{user_id}/dive_profiles/"
            )
            
            # Delete all objects
            deleted_count = 0
            for obj in response.get('Contents', []):
                try:
                    self.s3_client.delete_object(
                        Bucket=os.getenv('R2_BUCKET_NAME'),
                        Key=obj['Key']
                    )
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete object {obj['Key']}: {e}")
            
            logger.info(f"Successfully deleted {deleted_count} profiles from R2 for user {user_id}")
            return True
        except Exception as e:
            logger.warning(f"R2 user delete failed, falling back to local: {e}")
            return self._delete_user_local(user_id)
    
    def _delete_user_local(self, user_id: int) -> bool:
        """Delete all profiles for a user from local filesystem."""
        import shutil
        
        user_dive_profiles_dir = os.path.join(self.local_storage_base, f"user_{user_id}", "dive_profiles")
        
        try:
            if os.path.exists(user_dive_profiles_dir):
                shutil.rmtree(user_dive_profiles_dir)
                logger.info(f"Successfully deleted all profiles from local storage for user {user_id}")
                return True
            else:
                logger.warning(f"No profiles found in local storage for user {user_id}")
                return True  # Consider this success since goal is achieved
        except Exception as e:
            logger.error(f"Failed to delete user profiles from local storage: {e}")
            return False
    
    def health_check(self) -> dict:
        """
        Perform health check on R2 storage.
        
        Returns:
            dict: Health status information
        """
        status = {
            "r2_available": self.r2_available,
            "boto3_available": BOTO3_AVAILABLE,
            "credentials_present": self._check_r2_credentials(),
            "local_storage_available": True
        }
        
        if self.r2_available:
            try:
                # Test R2 connectivity
                self.s3_client.head_bucket(Bucket=os.getenv('R2_BUCKET_NAME'))
                status["r2_connectivity"] = True
                status["bucket_accessible"] = True
            except Exception as e:
                status["r2_connectivity"] = False
                status["bucket_accessible"] = False
                status["error"] = str(e)
        else:
            status["r2_connectivity"] = False
            status["bucket_accessible"] = False
        
        # Test local storage
        try:
            test_dir = os.path.join(self.local_storage_base, "health_check")
            os.makedirs(test_dir, exist_ok=True)
            test_file = os.path.join(test_dir, "test.txt")
            with open(test_file, 'w') as f:
                f.write("health check")
            os.remove(test_file)
            os.rmdir(test_dir)
            status["local_storage_writable"] = True
        except Exception as e:
            status["local_storage_writable"] = False
            status["local_storage_error"] = str(e)
        
        return status
    
    def upload_photo(self, user_id: int, dive_id: int, filename: str, content: bytes) -> str:
        """
        Upload dive photo to R2 with user/dive-specific path.
        
        Args:
            user_id: User ID for path organization
            dive_id: Dive ID for path organization
            filename: Name of the file to store
            content: File content as bytes
            
        Returns:
            str: Path where file was stored (R2 key or local path)
        """
        if not self.r2_available:
            return self._upload_photo_local(user_id, dive_id, filename, content)
        
        r2_path = self._get_photo_path(user_id, dive_id, filename)
        try:
            self.s3_client.put_object(
                Bucket=os.getenv('R2_BUCKET_NAME'),
                Key=r2_path,
                Body=content
            )
            logger.info(f"Successfully uploaded photo to R2: {r2_path}")
            return r2_path
        except Exception as e:
            logger.warning(f"R2 photo upload failed, falling back to local: {e}")
            return self._upload_photo_local(user_id, dive_id, filename, content)
    
    def _upload_photo_local(self, user_id: int, dive_id: int, filename: str, content: bytes) -> str:
        """Upload photo to local filesystem."""
        local_path = os.path.join(
            "uploads",
            f"user_{user_id}",
            "photos",
            f"dive_{dive_id}",
            filename
        )
        
        self._ensure_local_directory(local_path)
        
        with open(local_path, 'wb') as f:
            f.write(content)
        
        logger.info(f"Successfully uploaded photo to local storage: {local_path}")
        return local_path
    
    def delete_photo(self, photo_path: str) -> bool:
        """
        Delete a photo from R2 or local storage.
        
        Args:
            photo_path: Path to the photo (R2 key or local path)
            
        Returns:
            bool: True if deletion was successful, False otherwise
        """
        if not self.r2_available or not photo_path.startswith('user_'):
            # Local storage deletion
            if photo_path.startswith('uploads/'):
                local_path = photo_path
            else:
                local_path = f"uploads/{photo_path}"
            
            try:
                if os.path.exists(local_path):
                    os.remove(local_path)
                    logger.info(f"Successfully deleted photo from local storage: {local_path}")
                    return True
                else:
                    logger.warning(f"Photo not found in local storage: {local_path}")
                    return False
            except Exception as e:
                logger.error(f"Failed to delete photo from local storage {local_path}: {e}")
                return False
        
        # R2 deletion
        bucket_name = os.getenv('R2_BUCKET_NAME')
        try:
            self.s3_client.delete_object(
                Bucket=bucket_name,
                Key=photo_path
            )
            logger.info(f"Successfully deleted photo from R2: {photo_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete photo from R2 {photo_path}: {e}")
            return False
    
    def get_photo_url(self, photo_path: str, expires_in: int = 3600) -> str:
        """
        Get URL for a photo stored in R2 or local storage.
        For R2, generates a presigned URL for secure access to private buckets.
        
        Args:
            photo_path: Path to the photo (R2 key or local path)
            expires_in: Expiration time in seconds for presigned URLs (default: 1 hour)
            
        Returns:
            str: URL to access the photo (presigned URL for R2, static URL for local)
        """
        if not self.r2_available or not photo_path.startswith('user_'):
            # For local storage, return a URL that uses the static file mount
            # The backend mounts /uploads as static files
            # photo_path is already relative like "uploads/user_1/dive_7/photo/file.jpg"
            # So we just need to ensure it starts with /uploads
            if photo_path.startswith('uploads/'):
                return f"/{photo_path}"
            return f"/uploads/{photo_path}"
        
        # For R2, generate a presigned URL for secure access
        # This allows access to private buckets without making them public
        bucket_name = os.getenv('R2_BUCKET_NAME')
        
        try:
            # Check if custom domain is configured (for public buckets)
            custom_domain = os.getenv('R2_PUBLIC_DOMAIN')
            if custom_domain:
                # If custom domain is set, assume bucket is public
                return f"https://{custom_domain}/{photo_path}"
            
            # Generate presigned URL for private bucket access
            # Presigned URLs are temporary and secure, allowing access without exposing credentials
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': photo_path},
                ExpiresIn=expires_in
            )
            logger.debug(f"Generated presigned URL for {photo_path} (expires in {expires_in}s)")
            return presigned_url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {photo_path}: {e}")
            # Fallback: try public URL format (may fail if bucket is private)
            account_id = os.getenv('R2_ACCOUNT_ID')
            return f"https://pub-{account_id}.r2.dev/{bucket_name}/{photo_path}"


# Lazy-loaded global instance
_r2_storage_instance = None

def get_r2_storage():
    """Get R2 storage service instance with lazy loading."""
    global _r2_storage_instance
    if _r2_storage_instance is None:
        logger.info("🔧 Loading R2 storage service lazily...")
        _r2_storage_instance = R2StorageService()
    return _r2_storage_instance

# Backward compatibility - keep the old name for existing imports
# This will be lazy-loaded when first accessed
class LazyR2Storage:
    """Lazy-loaded wrapper for R2 storage service."""
    
    def __getattr__(self, name):
        """Delegate all attribute access to the actual R2 storage service."""
        return getattr(get_r2_storage(), name)
    
    def __dir__(self):
        """Delegate dir() to the actual R2 storage service."""
        return dir(get_r2_storage())

r2_storage = LazyR2Storage()
