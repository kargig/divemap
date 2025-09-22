import pytest
import json
import tempfile
import os
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient

from app.models import Dive, DiveSite, User
from app.database import get_db
from app.auth import create_access_token


class TestDiveProfileAPI:
    """Test dive profile API endpoints."""

    @pytest.fixture
    def sample_profile_data(self):
        """Sample dive profile data for testing."""
        return {
            "samples": [
                {"time_minutes": 0, "depth": 0, "temperature": 20},
                {"time_minutes": 1, "depth": 10, "temperature": 19},
                {"time_minutes": 2, "depth": 20, "temperature": 18},
                {"time_minutes": 3, "depth": 15, "temperature": 17},
                {"time_minutes": 4, "depth": 5, "temperature": 16},
                {"time_minutes": 5, "depth": 0, "temperature": 15}
            ],
            "calculated_max_depth": 20,
            "calculated_avg_depth": 8.33,
            "calculated_duration_minutes": 5,
            "temperature_range": {"min": 15, "max": 20}
        }

    @pytest.fixture
    def sample_xml_content(self):
        """Sample XML content for testing."""
        return """<?xml version="1.0" encoding="UTF-8"?>
<dives>
    <dive>
        <diveid>test_dive_123</diveid>
        <number>1</number>
        <date>2024-09-27</date>
        <time>12:11:13</time>
        <duration>82:30</duration>
        <maxdepth>48.7</maxdepth>
        <meandepth>22.068</meandepth>
        <watertemp>24</watertemp>
        <samples>
            <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
            <sample time='1:00 min' depth='4.8 m' />
        </samples>
    </dive>
</dives>"""

    def test_get_dive_profile_success(self, client, auth_headers, test_dive, sample_profile_data):
        """Test successful dive profile retrieval."""
        # Set up dive with profile data
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        test_dive.profile_sample_count = 6
        test_dive.profile_max_depth = 20
        test_dive.profile_duration_minutes = 5
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile_data).encode('utf-8')
            
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile", headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['calculated_max_depth'] == 20
            assert data['calculated_avg_depth'] == 8.33
            assert len(data['samples']) == 6

    def test_get_dive_profile_not_found(self, client, auth_headers, test_dive):
        """Test dive profile retrieval when profile doesn't exist."""
        # Dive without profile data
        test_dive.profile_xml_path = None
        
        response = client.get(f"/api/v1/dives/{test_dive.id}/profile", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "No profile uploaded" in response.json()["detail"]

    def test_get_dive_profile_public_unauthenticated_success(self, client, test_dive, sample_profile_data, db_session):
        """Unauthenticated users can view public dive profiles (200)."""
        from app.database import get_db
        client.app.dependency_overrides[get_db] = lambda: db_session
        # Public dive with existing profile
        test_dive.is_private = False
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        db_session.commit()
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile_data).encode('utf-8')
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['calculated_max_depth'] == 20
            assert len(data['samples']) == 6

    def test_get_dive_profile_file_not_found(self, client, auth_headers, test_dive, db_session):
        """Test dive profile retrieval when file doesn't exist in storage."""
        test_dive.profile_xml_path = "user_1/2025/09/nonexistent.json"
        db_session.commit()
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = None
            
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile", headers=auth_headers)
            
            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "Profile file not found" in response.json()["detail"]

    def test_get_dive_profile_private_authenticated_non_owner_forbidden(self, client, test_dive, db_session):
        """Authenticated user who is not owner cannot view private profile (403)."""
        from app.database import get_db
        from app.auth import create_access_token
        from app.models import User
        client.app.dependency_overrides[get_db] = lambda: db_session
        # Make dive private and ensure profile exists
        test_dive.is_private = True
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        db_session.commit()
        # Create another enabled user
        other_user = User(
            username="otheruser2",
            email="other2@example.com",
            password_hash="hash",
            is_admin=False,
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()
        token = create_access_token(data={"sub": other_user.username})
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get(f"/api/v1/dives/{test_dive.id}/profile", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_dive_profile_private_admin_success(self, client, admin_headers, test_dive, sample_profile_data, db_session):
        """Admin can view private profile (200)."""
        from app.database import get_db
        client.app.dependency_overrides[get_db] = lambda: db_session
        test_dive.is_private = True
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        db_session.commit()
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile_data).encode('utf-8')
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile", headers=admin_headers)
            assert response.status_code == status.HTTP_200_OK

    def test_get_dive_profile_disabled_user_forbidden(self, client, test_dive, db_session):
        """Disabled authenticated user gets 403 for profile access."""
        from app.database import get_db
        from app.auth import create_access_token
        from app.models import User
        client.app.dependency_overrides[get_db] = lambda: db_session
        # Public dive with profile
        test_dive.is_private = False
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        db_session.commit()
        # Create disabled user
        disabled_user = User(
            username="disableduser",
            email="disabled@example.com",
            password_hash="hash",
            is_admin=False,
            enabled=False
        )
        db_session.add(disabled_user)
        db_session.commit()
        token = create_access_token(data={"sub": disabled_user.username})
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get(f"/api/v1/dives/{test_dive.id}/profile", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_dive_profile_unauthorized_private(self, client, test_dive, sample_profile_data):
        """Unauthenticated users cannot view private dive profiles (expect 403)."""
        # Make the dive private and ensure a profile exists to avoid 404
        test_dive.is_private = True
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"

        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile_data).encode('utf-8')
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile")
            assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_dive_profile_dive_not_found(self, client, auth_headers):
        """Test dive profile retrieval for non-existent dive."""
        response = client.get("/api/v1/dives/99999/profile", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Dive not found" in response.json()["detail"]

    def test_upload_dive_profile_success(self, client, auth_headers, test_dive, sample_xml_content):
        """Test successful dive profile upload."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.return_value = "user_1/2025/09/test_profile.xml"
            
            with patch('app.services.dive_profile_parser.DiveProfileParser') as mock_parser:
                mock_parser_instance = MagicMock()
                mock_parser_instance.parse_xml_file.return_value = {
                    "samples": [{"time_minutes": 0, "depth": 0}],
                    "calculated_max_depth": 20,
                    "calculated_duration_minutes": 5
                }
                mock_parser.return_value = mock_parser_instance
                
                files = {"file": ("test.xml", sample_xml_content, "application/xml")}
                response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
                                     files=files, headers=auth_headers)
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert "Dive profile uploaded successfully" in data["message"]
                assert "profile_data" in data

    def test_upload_dive_profile_invalid_file_type(self, client, auth_headers, test_dive):
        """Test dive profile upload with invalid file type."""
        files = {"file": ("test.txt", "invalid content", "text/plain")}
        response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
                             files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only XML files are allowed" in response.json()["detail"]

    def test_upload_dive_profile_invalid_xml(self, client, auth_headers, test_dive):
        """Test dive profile upload with invalid XML content."""
        files = {"file": ("test.xml", "invalid xml", "application/xml")}
        response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
                             files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid dive profile data" in response.json()["detail"]

    def test_upload_dive_profile_unauthorized(self, client, test_dive, sample_xml_content):
        """Test dive profile upload without authentication."""
        files = {"file": ("test.xml", sample_xml_content, "application/xml")}
        response = client.post(f"/api/v1/dives/{test_dive.id}/profile", files=files)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_upload_dive_profile_dive_not_found(self, client, auth_headers, sample_xml_content):
        """Test dive profile upload for non-existent dive."""
        files = {"file": ("test.xml", sample_xml_content, "application/xml")}
        response = client.post("/api/v1/dives/99999/profile", 
                             files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Dive not found" in response.json()["detail"]

    def test_upload_dive_profile_forbidden(self, client, test_dive, sample_xml_content, db_session):
        """Test dive profile upload for dive owned by different user."""
        # Create another user
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="hash",
            is_admin=False,
            enabled=True
        )
        client.app.dependency_overrides[get_db] = lambda: db_session
        db_session.add(other_user)
        db_session.commit()
        
        # Create token for other user
        other_token = create_access_token(data={"sub": "otheruser"})
        other_headers = {"Authorization": f"Bearer {other_token}"}
        
        files = {"file": ("test.xml", sample_xml_content, "application/xml")}
        response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
                             files=files, headers=other_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized" in response.json()["detail"]

    def test_delete_dive_profile_success(self, client, auth_headers, test_dive):
        """Test successful dive profile deletion."""
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.delete_profile.return_value = True
            
            response = client.delete(f"/api/v1/dives/{test_dive.id}/profile", 
                                   headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            assert "Dive profile deleted successfully" in response.json()["message"]
            
            # Verify dive record was updated
            assert test_dive.profile_xml_path is None
            assert test_dive.profile_sample_count is None
            assert test_dive.profile_max_depth is None
            assert test_dive.profile_duration_minutes is None

    def test_delete_dive_profile_not_found(self, client, auth_headers, test_dive):
        """Test dive profile deletion when no profile exists."""
        test_dive.profile_xml_path = None
        
        response = client.delete(f"/api/v1/dives/{test_dive.id}/profile", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "No profile found" in response.json()["detail"]

    def test_delete_dive_profile_unauthorized(self, client, test_dive):
        """Test dive profile deletion without authentication."""
        response = client.delete(f"/api/v1/dives/{test_dive.id}/profile")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_dive_profile_dive_not_found(self, client, auth_headers):
        """Test dive profile deletion for non-existent dive."""
        response = client.delete("/api/v1/dives/99999/profile", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Dive not found" in response.json()["detail"]

    def test_delete_user_profiles_admin_success(self, client, admin_headers):
        """Test successful deletion of all user profiles by admin."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.delete_user_profiles.return_value = True
            
            response = client.delete("/api/v1/dives/profiles/user/1", 
                                   headers=admin_headers)
            
            assert response.status_code == status.HTTP_200_OK
            assert "All profiles for user 1 deleted successfully" in response.json()["message"]

    def test_delete_user_profiles_non_admin(self, client, auth_headers):
        """Test deletion of user profiles by non-admin user."""
        response = client.delete("/api/v1/dives/profiles/user/1", headers=auth_headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in response.json()["detail"]

    def test_delete_user_profiles_unauthorized(self, client):
        """Test deletion of user profiles without authentication."""
        response = client.delete("/api/v1/dives/profiles/user/1")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_storage_health_check_success(self, client):
        """Test storage health check endpoint."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.health_check.return_value = {
                "r2_available": True,
                "bucket_accessible": True,
                "local_storage_available": True,
                "local_storage_writable": True
            }
            
            response = client.get("/api/v1/dives/storage/health")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["r2_available"] == True
            assert data["bucket_accessible"] == True
            assert data["local_storage_available"] == True
            assert data["local_storage_writable"] == True

    def test_storage_health_check_error(self, client):
        """Test storage health check endpoint with error."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.health_check.side_effect = Exception("Storage error")
            
            response = client.get("/api/v1/dives/storage/health")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "error" in data
            assert data["r2_available"] == False
            assert data["local_storage_available"] == False

    def test_parse_dive_profile_samples_success(self, client, auth_headers, test_dive):
        """Test dive profile samples parsing during import."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples>
            <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
            <sample time='1:00 min' depth='4.8 m' />
        </samples>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is not None
        assert len(result['samples']) == 3
        assert result['sample_count'] == 3
        assert result['calculated_max_depth'] == 4.8
        assert result['calculated_avg_depth'] > 0
        assert result['calculated_duration_minutes'] == 1.0

    def test_parse_dive_profile_samples_empty(self, client, auth_headers, test_dive):
        """Test dive profile samples parsing with empty samples."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples></samples>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is None

    def test_parse_dive_profile_samples_invalid_xml(self, client, auth_headers, test_dive):
        """Test dive profile samples parsing with invalid XML."""
        from app.routers.dives import parse_dive_profile_samples
        
        sample_xml = """<samples>
            <sample time='invalid' depth='invalid' />
        </samples>"""
        
        result = parse_dive_profile_samples(sample_xml)
        
        assert result is not None
        assert len(result['samples']) == 1
        assert result['samples'][0]['time_minutes'] == 0
        assert result['samples'][0]['depth'] == 0

    def test_save_dive_profile_data_success(self, client, auth_headers, test_dive, sample_profile_data, db_session):
        """Test saving dive profile data to storage."""
        from app.routers.dives import save_dive_profile_data
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.return_value = "user_1/2025/09/test_profile.json"
            
            save_dive_profile_data(test_dive, sample_profile_data, db_session)
            
            assert test_dive.profile_xml_path == "user_1/2025/09/test_profile.json"
            assert test_dive.profile_sample_count == 6
            assert test_dive.profile_max_depth == 20
            assert test_dive.profile_duration_minutes == 5

    def test_save_dive_profile_data_error(self, client, auth_headers, test_dive, sample_profile_data):
        """Test saving dive profile data with error."""
        from app.routers.dives import save_dive_profile_data
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.upload_profile.side_effect = Exception("Storage error")
            
            with pytest.raises(Exception):
                save_dive_profile_data(test_dive, sample_profile_data, test_dive.__class__.query.session)
