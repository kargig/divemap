import pytest
import json
import tempfile
import os
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient

from app.models import Dive, DiveSite, User


class TestDiveProfileIntegration:
    """Integration tests for dive profile functionality."""

    @pytest.fixture
    def sample_subsurface_xml(self):
        """Sample Subsurface XML content for integration testing."""
        return """<?xml version="1.0" encoding="UTF-8"?>
<divelog>
    <dive number="1" rating="4" date="2024-09-27" time="12:11:13" duration="82:30">
        <diveid>integration_test_123</diveid>
        <tags>Wreck</tags>
        <divesiteid>5520dc00</divesiteid>
        <buddy>Nikos Vardakas</buddy>
        <suit>DrySuit Rofos</suit>
        <cylinder size="24.0" workpressure="232.0" description="D12 232 bar" o2="22.0" start="210.0" end="100.0" depth="62.551" />
        <weightsystem weight="3.2" description="weight" />
        <computer model="Shearwater Perdix AI" deviceid="8a66df8d" />
        <extradata key="Logversion" value="14(PNF)" />
        <extradata key="Serial" value="206352f8" />
        <extradata key="FWVersion" value="93" />
        <extradata key="Decomodel" value="GF 30/85" />
        <extradata key="Batterytype" value="1.5V Lithium" />
        <extradata key="Batteryatend" value="1.7 V" />
        <divecomputer>
            <depth>48.7</depth>
            <temperature>24</temperature>
            <sample time='0:10 min' depth='2.7 m' temp='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
            <sample time='0:30 min' depth='3.8 m' />
            <sample time='0:40 min' depth='4.1 m' />
            <sample time='0:50 min' depth='5.5 m' temp='33 C' />
            <sample time='1:00 min' depth='4.8 m' />
            <sample time='2:00 min' depth='12.2 m' temp='31 C' />
            <sample time='3:00 min' depth='28.4 m' ndl='15 min' />
            <sample time='4:00 min' depth='33.6 m' />
            <sample time='5:00 min' depth='38.0 m' ndl='5 min' />
            <sample time='6:00 min' depth='42.4 m' />
            <sample time='7:00 min' depth='43.2 m' temp='26 C' />
            <sample time='8:00 min' depth='42.1 m' />
            <sample time='9:00 min' depth='44.2 m' ndl='0 min' cns='3%' />
            <sample time='10:20 min' depth='45.6 m' in_deco='1' stoptime='1:00 min' stopdepth='3.0 m' />
            <sample time='11:00 min' depth='46.8 m' />
            <sample time='12:00 min' depth='48.1 m' />
            <sample time='13:00 min' depth='48.5 m' cns='5%' />
            <sample time='14:00 min' depth='44.3 m' />
            <sample time='15:00 min' depth='45.0 m' cns='6%' />
            <sample time='20:00 min' depth='43.6 m' />
            <sample time='25:00 min' depth='44.8 m' temp='25 C' />
            <sample time='30:00 min' depth='41.3 m' cns='13%' />
            <sample time='35:00 min' depth='20.5 m' />
            <sample time='40:00 min' depth='4.3 m' cns='18%' />
            <sample time='45:00 min' depth='12.8 m' cns='21%' />
            <sample time='50:00 min' depth='9.4 m' temp='26 C' />
            <sample time='55:00 min' depth='7.4 m' />
            <sample time='60:00 min' depth='6.4 m' cns='25%' />
            <sample time='65:00 min' depth='5.7 m' cns='26%' />
            <sample time='70:00 min' depth='5.9 m' />
            <sample time='75:00 min' depth='7.2 m' />
            <sample time='75:10 min' depth='6.8 m' ndl='99:00 min' in_deco='0' stopdepth='0.0 m' />
            <sample time='76:00 min' depth='6.3 m' />
            <sample time='77:00 min' depth='5.7 m' />
            <sample time='78:00 min' depth='5.5 m' cns='29%' />
            <sample time='79:00 min' depth='5.5 m' />
            <sample time='80:00 min' depth='4.3 m' />
            <sample time='81:00 min' depth='3.4 m' />
            <sample time='82:00 min' depth='1.4 m' />
            <sample time='82:30 min' depth='0.0 m' />
            <event time='0:10 min' type='25' flags='1' name='gaschange' cylinder='0' o2='22.0%' />
            <event time='36:00 min' type='25' flags='2' name='gaschange' cylinder='1' o2='49.0%' />
        </divecomputer>
    </dive>
</divelog>"""

    # TODO: Commented out due to SQLite compatibility issues - needs MySQL for proper testing
    # def test_complete_dive_import_workflow(self, client, auth_headers, test_dive_site, sample_subsurface_xml):
    #     """Test complete dive import workflow from XML to database."""
    #     with patch('app.routers.dives.r2_storage') as mock_r2:
    #         mock_r2.upload_profile.return_value = "user_1/2025/09/dive_profile.json"
    #         
    #         # Step 1: Import XML file
    #         files = {"file": ("test.xml", sample_subsurface_xml, "application/xml")}
    #         response = client.post("/api/v1/dives/import/subsurface-xml", 
    #                              files=files, headers=auth_headers)
    #         
    #         print(f"Response status: {response.status_code}")
    #         print(f"Response content: {response.text}")
    #         assert response.status_code == status.HTTP_200_OK
    #         data = response.json()
    #         assert "dives" in data
    #         assert len(data["dives"]) == 1
    #         
    #         dive_data = data["dives"][0]
    #         assert "profile_data" in dive_data
    #         assert dive_data["profile_data"]["sample_count"] == 41
    #         assert dive_data["profile_data"]["calculated_max_depth"] == 48.5
    #         assert dive_data["profile_data"]["calculated_avg_depth"] > 0
    #         
    #         # Step 2: Confirm import
    #         response = client.post("/api/v1/dives/import/confirm", 
    #                              json=[dive_data], headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_200_OK
    #         confirm_data = response.json()
    #         assert "imported_dives" in confirm_data
    #         assert len(confirm_data["imported_dives"]) == 1
    #         
    #         created_dive = confirm_data["imported_dives"][0]
    #         assert created_dive["name"] == "Dive #1"
    #         assert created_dive["dive_date"] == "2024-09-27"
    #         
    #         # Step 3: Verify dive was created in database
    #         dive_id = created_dive["id"]
    #         response = client.get(f"/api/v1/dives/{dive_id}", headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_200_OK
    #         dive_details = response.json()
    #         # Verify the dive was created successfully
    #         assert dive_details["id"] == dive_id
    #         assert dive_details["name"] == "Dive #1"

    # TODO: Commented out due to SQLite compatibility issues - needs MySQL for proper testing
    # def test_complete_dive_profile_upload_workflow(self, client, auth_headers, test_dive):
    #     """Test complete dive profile upload workflow."""
    #     with patch('app.routers.dives.r2_storage') as mock_r2:
    #         mock_r2.upload_profile.return_value = "user_1/2025/09/uploaded_profile.xml"
    #         
    #         # Step 1: Upload profile XML
    #         sample_xml = """<?xml version="1.0" encoding="UTF-8"?>
    # <dives>
    #     <dive>
    #         <diveid>upload_test_123</diveid>
    #         <number>1</number>
    #         <date>2024-09-27</date>
    #         <time>12:11:13</time>
    #         <duration>45:00</duration>
    #         <maxdepth>25.0</maxdepth>
    #         <meandepth>15.0</meandepth>
    #         <watertemp>22</watertemp>
    #         <samples>
    #             <sample time='0:10 min' depth='2.0 m' temperature='22 C' />
    #             <sample time='0:20 min' depth='5.0 m' temperature='21 C' />
    #             <sample time='0:30 min' depth='10.0 m' temperature='20 C' />
    #             <sample time='0:40 min' depth='15.0 m' temperature='19 C' />
    #             <sample time='0:50 min' depth='20.0 m' temperature='18 C' />
    #             <sample time='1:00 min' depth='25.0 m' temperature='17 C' />
    #             <sample time='1:10 min' depth='20.0 m' temperature='18 C' />
    #             <sample time='1:20 min' depth='15.0 m' temperature='19 C' />
    #             <sample time='1:30 min' depth='10.0 m' temperature='20 C' />
    #             <sample time='1:40 min' depth='5.0 m' temperature='21 C' />
    #             <sample time='1:50 min' depth='2.0 m' temperature='22 C' />
    #             <sample time='2:00 min' depth='0.0 m' temperature='23 C' />
    #         </samples>
    #     </dive>
    # </dives>"""
    #         
    #         files = {"file": ("upload_test.xml", sample_xml, "application/xml")}
    #         response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
    #                              files=files, headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_200_OK
    #         upload_data = response.json()
    #         assert "Dive profile uploaded successfully" in upload_data["message"]
    #         assert "profile_data" in upload_data
    #         
    #         # Step 2: Verify profile was saved
    #         response = client.get(f"/api/v1/dives/{test_dive.id}/profile", 
    #                             headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_200_OK
    #         profile_data = response.json()
    #         assert len(profile_data["samples"]) == 12
    #         assert profile_data["calculated_max_depth"] == 25.0
    #         assert profile_data["calculated_avg_depth"] > 0
    #         assert profile_data["calculated_duration_minutes"] == 2.0

    def test_dive_profile_retrieval_workflow(self, client, auth_headers, test_dive):
        """Test dive profile retrieval workflow."""
        # Set up dive with profile data
        test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
        test_dive.profile_sample_count = 10
        test_dive.profile_max_depth = 30.0
        test_dive.profile_duration_minutes = 5.0
        
        sample_profile_data = {
            "samples": [
                {"time_minutes": 0, "depth": 0, "temperature": 20},
                {"time_minutes": 1, "depth": 10, "temperature": 19},
                {"time_minutes": 2, "depth": 20, "temperature": 18},
                {"time_minutes": 3, "depth": 30, "temperature": 17},
                {"time_minutes": 4, "depth": 20, "temperature": 18},
                {"time_minutes": 5, "depth": 0, "temperature": 19}
            ],
            "calculated_max_depth": 30.0,
            "calculated_avg_depth": 13.33,
            "calculated_duration_minutes": 5.0,
            "temperature_range": {"min": 17, "max": 20}
        }
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = json.dumps(sample_profile_data).encode('utf-8')
            
            # Step 1: Retrieve profile data
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile", 
                                headers=auth_headers)
            
            assert response.status_code == status.HTTP_200_OK
            profile_data = response.json()
            assert len(profile_data["samples"]) == 6
            assert profile_data["calculated_max_depth"] == 30.0
            assert profile_data["calculated_avg_depth"] == 13.33
            assert profile_data["calculated_duration_minutes"] == 5.0
            assert profile_data["temperature_range"]["min"] == 17
            assert profile_data["temperature_range"]["max"] == 20

    # TODO: Commented out due to SQLite compatibility issues - needs MySQL for proper testing
    # def test_dive_profile_deletion_workflow(self, client, auth_headers, test_dive):
    #     """Test dive profile deletion workflow."""
    #     # Set up dive with profile data
    #     test_dive.profile_xml_path = "user_1/2025/09/test_profile.json"
    #     test_dive.profile_sample_count = 10
    #     test_dive.profile_max_depth = 30.0
    #     test_dive.profile_duration_minutes = 5.0
    #     
    #     with patch('app.routers.dives.r2_storage') as mock_r2:
    #         mock_r2.delete_profile.return_value = True
    #         
    #         # Step 1: Delete profile
    #         response = client.delete(f"/api/v1/dives/{test_dive.id}/profile",
    #                                headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_200_OK
    #         delete_data = response.json()
    #         assert "Dive profile deleted successfully" in delete_data["message"]
    #         
    #         # Step 2: Verify profile was deleted from database
    #         response = client.get(f"/api/v1/dives/{test_dive.id}", headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_200_OK
    #         dive_details = response.json()
    #         assert dive_details["profile_xml_path"] is None
    #         assert dive_details["profile_sample_count"] is None
    #         assert dive_details["profile_max_depth"] is None
    #         assert dive_details["profile_duration_minutes"] is None
    #         
    #         # Step 3: Verify profile retrieval fails
    #         response = client.get(f"/api/v1/dives/{test_dive.id}/profile", 
    #                             headers=auth_headers)
    #         
    #         assert response.status_code == status.HTTP_404_NOT_FOUND
    #         assert "Profile not found" in response.json()["detail"]

    def test_storage_health_check_workflow(self, client):
        """Test storage health check workflow."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.health_check.return_value = {
                "r2_available": True,
                "boto3_available": True,
                "credentials_present": True,
                "r2_connectivity": True,
                "bucket_accessible": True,
                "local_storage_available": True,
                "local_storage_writable": True
            }
            
            response = client.get("/api/v1/dives/storage/health")
            
            assert response.status_code == status.HTTP_200_OK
            health_data = response.json()
            assert health_data["r2_available"] == True
            assert health_data["bucket_accessible"] == True
            assert health_data["local_storage_available"] == True
            assert health_data["local_storage_writable"] == True

    def test_user_profile_deletion_workflow(self, client, admin_headers):
        """Test user profile deletion workflow."""
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.delete_user_profiles.return_value = True
            
            response = client.delete("/api/v1/dives/profiles/user/1", 
                                   headers=admin_headers)
            
            assert response.status_code == status.HTTP_200_OK
            delete_data = response.json()
            assert "All profiles for user 1 deleted successfully" in delete_data["message"]

    def test_error_handling_workflow(self, client, auth_headers, test_dive):
        """Test error handling in dive profile workflow."""
        # Test 1: Profile retrieval when file doesn't exist
        test_dive.profile_xml_path = "user_1/2025/09/nonexistent.json"
        
        with patch('app.routers.dives.r2_storage') as mock_r2:
            mock_r2.download_profile.return_value = None
            
            response = client.get(f"/api/v1/dives/{test_dive.id}/profile", 
                                headers=auth_headers)
            
            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "Profile file not found" in response.json()["detail"]
        
        # Test 2: Profile upload with invalid XML
        invalid_xml = "invalid xml content"
        files = {"file": ("invalid.xml", invalid_xml, "application/xml")}
        
        with patch('app.services.dive_profile_parser.DiveProfileParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.parse_xml_file.return_value = None
            mock_parser.return_value = mock_parser_instance
            
            response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
                                 files=files, headers=auth_headers)
            
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "Invalid dive profile data" in response.json()["detail"]
        
        # Test 3: Profile deletion when no profile exists
        test_dive.profile_xml_path = None
        
        response = client.delete(f"/api/v1/dives/{test_dive.id}/profile", 
                               headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "No profile found" in response.json()["detail"]

    def test_authentication_workflow(self, client, test_dive):
        """Test authentication requirements in dive profile workflow."""
        # Test 1: Profile retrieval without authentication
        response = client.get(f"/api/v1/dives/{test_dive.id}/profile")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test 2: Profile upload without authentication
        files = {"file": ("test.xml", "test content", "application/xml")}
        response = client.post(f"/api/v1/dives/{test_dive.id}/profile", files=files)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test 3: Profile deletion without authentication
        response = client.delete(f"/api/v1/dives/{test_dive.id}/profile")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test 4: User profile deletion without admin access
        response = client.delete("/api/v1/dives/profiles/user/1")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_permission_workflow(self, client, test_dive, db_session):
        """Test permission requirements in dive profile workflow."""
        from app.database import get_db
        from app.auth import create_access_token
        
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
        
        # Test 1: Profile upload by different user
        files = {"file": ("test.xml", "test content", "application/xml")}
        response = client.post(f"/api/v1/dives/{test_dive.id}/profile", 
                             files=files, headers=other_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized" in response.json()["detail"]
        
        # Test 2: Profile deletion by different user
        response = client.delete(f"/api/v1/dives/{test_dive.id}/profile", 
                               headers=other_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Not authorized" in response.json()["detail"]
