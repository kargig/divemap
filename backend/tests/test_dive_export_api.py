import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi import status
from app.models import Dive

class TestDiveExportAPI:
    def test_export_dive_profile_xml_success(self, client, auth_headers, test_dive):
        # Set up dive with profile data
        test_dive.profile_xml_path = "user_1/dive_profiles/2026/04/test.json"
        
        sample_profile = {
            "samples": [{"time_minutes": 0, "depth": 0}, {"time_minutes": 1, "depth": 10}]
        }
        
        with patch('app.routers.dives.dives_profiles.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile).encode('utf-8')
            
            response = client.get(f"/api/v1/dives/{test_dive.id}/export/xml", headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            assert response.headers["content-type"] == "application/xml"
            assert "attachment; filename=dive_" in response.headers["content-disposition"]
            assert "<divelog" in response.text

    def test_export_dive_profile_fit_success(self, client, auth_headers, test_dive):
        test_dive.profile_xml_path = "user_1/dive_profiles/2026/04/test.json"
        sample_profile = {
            "samples": [{"time_minutes": 0, "depth": 0}, {"time_minutes": 1, "depth": 10}]
        }
        
        with patch('app.routers.dives.dives_profiles.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile).encode('utf-8')
            
            with patch('app.routers.dives.dives_profiles.DiveExportService') as mock_service_class:
                mock_service = mock_service_class.return_value
                mock_service.export_to_garmin_fit.return_value = b'.FIT header and data'
                
                response = client.get(f"/api/v1/dives/{test_dive.id}/export/fit", headers=auth_headers)
                
                assert response.status_code == status.HTTP_200_OK
                assert response.headers["content-type"] == "application/x-fit"
                assert response.content == b'.FIT header and data'

    def test_export_dive_profile_json_success(self, client, auth_headers, test_dive):
        test_dive.profile_xml_path = "user_1/dive_profiles/2026/04/test.json"
        sample_profile = {
            "samples": [{"time_minutes": 0, "depth": 0}, {"time_minutes": 1, "depth": 10}]
        }
        
        with patch('app.routers.dives.dives_profiles.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile).encode('utf-8')
            
            response = client.get(f"/api/v1/dives/{test_dive.id}/export/json", headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            assert response.headers["content-type"] == "application/json"
            data = response.json()
            assert "header" in data
            assert "samples" in data

    def test_export_dive_profile_unauthenticated(self, client, test_dive):
        # Any dive, no auth
        test_dive.is_private = False
        test_dive.profile_xml_path = "some/path.json"
        
        response = client.get(f"/api/v1/dives/{test_dive.id}/export/xml")
        # FastAPI HTTPBearer returns 403 when Authorization header is missing
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_export_dive_profile_forbidden(self, client, auth_headers_other_user, test_dive):
        # Private dive, authenticated as different user
        test_dive.is_private = True
        test_dive.profile_xml_path = "some/path.json"
        
        response = client.get(f"/api/v1/dives/{test_dive.id}/export/xml", headers=auth_headers_other_user)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_export_dive_profile_not_found(self, client, auth_headers):
        response = client.get("/api/v1/dives/999999/export/xml", headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_export_dive_profile_invalid_format(self, client, auth_headers, test_dive):
        test_dive.profile_xml_path = "some/path.json"
        with patch('app.routers.dives.dives_profiles.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = b'{"samples": []}'
            response = client.get(f"/api/v1/dives/{test_dive.id}/export/invalid", headers=auth_headers)
            assert response.status_code == status.HTTP_400_BAD_REQUEST
