#!/usr/bin/env python3
"""
Test script for R2 storage service.

This script tests the R2StorageService functionality including:
- Health check
- Upload/download/delete operations
- Fallback to local storage when R2 unavailable
"""

import os
import sys
import json
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.r2_storage_service import r2_storage


def test_health_check():
    """Test R2 storage health check."""
    print("=== Testing R2 Storage Health Check ===")
    health = r2_storage.health_check()
    print(json.dumps(health, indent=2))
    return health


def test_upload_download():
    """Test upload and download operations."""
    print("\n=== Testing Upload/Download Operations ===")
    
    # Test data
    test_user_id = 1
    test_filename = "test_profile.json"
    test_content = json.dumps({
        "samples": [
            {"time": "0:00", "depth": 0.0},
            {"time": "0:10", "depth": 5.0},
            {"time": "0:20", "depth": 10.0}
        ],
        "max_depth": 10.0,
        "duration": 20
    }).encode('utf-8')
    
    try:
        # Upload
        print(f"Uploading test profile for user {test_user_id}...")
        stored_path = r2_storage.upload_profile(test_user_id, test_filename, test_content)
        print(f"Upload successful: {stored_path}")
        
        # Download
        print(f"Downloading test profile...")
        downloaded_content = r2_storage.download_profile(test_user_id, stored_path)
        if downloaded_content:
            print(f"Download successful: {len(downloaded_content)} bytes")
            downloaded_data = json.loads(downloaded_content.decode('utf-8'))
            print(f"Downloaded data: {downloaded_data}")
        else:
            print("Download failed: No content returned")
            return False
        
        # Delete
        print(f"Deleting test profile...")
        delete_success = r2_storage.delete_profile(test_user_id, stored_path)
        print(f"Delete successful: {delete_success}")
        
        return True
        
    except Exception as e:
        print(f"Test failed: {e}")
        return False


def test_user_deletion():
    """Test user profile deletion."""
    print("\n=== Testing User Profile Deletion ===")
    
    test_user_id = 999  # Use a test user ID that won't conflict
    
    try:
        # Upload multiple test files
        for i in range(3):
            filename = f"test_profile_{i}.json"
            content = json.dumps({"test": f"profile_{i}"}).encode('utf-8')
            stored_path = r2_storage.upload_profile(test_user_id, filename, content)
            print(f"Uploaded {filename}: {stored_path}")
        
        # Delete all user profiles
        print(f"Deleting all profiles for user {test_user_id}...")
        delete_success = r2_storage.delete_user_profiles(test_user_id)
        print(f"User deletion successful: {delete_success}")
        
        return True
        
    except Exception as e:
        print(f"User deletion test failed: {e}")
        return False


def main():
    """Run all tests."""
    print("R2 Storage Service Test Suite")
    print("=" * 50)
    
    # Test 1: Health check
    health = test_health_check()
    
    # Test 2: Upload/Download/Delete
    upload_test = test_upload_download()
    
    # Test 3: User deletion
    user_deletion_test = test_user_deletion()
    
    # Summary
    print("\n=== Test Summary ===")
    print(f"Health Check: {'PASS' if health.get('r2_available') or health.get('local_storage_available') else 'FAIL'}")
    print(f"Upload/Download: {'PASS' if upload_test else 'FAIL'}")
    print(f"User Deletion: {'PASS' if user_deletion_test else 'FAIL'}")
    
    all_passed = (health.get('r2_available') or health.get('local_storage_available')) and upload_test and user_deletion_test
    print(f"\nOverall: {'PASS' if all_passed else 'FAIL'}")
    
    return all_passed


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
