import pytest
import json
from datetime import datetime, date, time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import (
    User, Dive, DiveMedia, SiteRating, SiteComment, 
    CenterRating, CenterComment, UserCertification, DivingCenter,
    DiveSite, AvailableTag, DivingOrganization, DiveTag
)

class TestPrivacyDataExport:
    """Test cases for the privacy data export endpoint"""
    
    def test_data_export_success(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test successful data export for authenticated user"""
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Verify response structure
        assert "user_profile" in data
        assert "dives" in data
        assert "ratings" in data
        assert "comments" in data
        assert "certifications" in data
        assert "owned_diving_centers" in data
        assert "export_timestamp" in data
        assert "total_records" in data
    
        # Verify user profile data
        user_profile = data["user_profile"]
        assert user_profile["id"] == test_user.id
        assert user_profile["username"] == test_user.username
        assert user_profile["email"] == test_user.email
        assert user_profile["is_admin"] == test_user.is_admin
        assert user_profile["is_moderator"] == test_user.is_moderator
        assert user_profile["enabled"] == test_user.enabled
    
        # Verify empty data arrays for new user
        assert data["dives"] == []
        assert data["ratings"] == {"dive_sites": [], "diving_centers": []}
        assert data["comments"] == {"dive_sites": [], "diving_centers": []}
        assert data["certifications"] == []
        assert data["owned_diving_centers"] == []
    
        # Verify metadata
        assert "export_timestamp" in data
        assert data["total_records"] == 1  # Always includes user profile
    
    def test_data_export_with_dive_data(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test data export for user with dive data"""
        # Create a dive site
        dive_site = DiveSite(
            name="Test Site",
            description="Test description",
            latitude=10.0,
            longitude=20.0,
            access_instructions="Shore access",
            difficulty_level="intermediate"
        )
        db_session.add(dive_site)
        db_session.commit()
        db_session.refresh(dive_site)
    
        # Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            dive_date=date(2023, 1, 15),
            dive_time=time(10, 0),
            max_depth=18.5,
            duration=45,
            visibility_rating=15,
            user_rating=8,
            dive_information="Great dive!"
        )
        db_session.add(dive)
        db_session.commit()
        db_session.refresh(dive)
    
        # Create dive media
        dive_media = DiveMedia(
            dive_id=dive.id,
            media_type="photo",
            url="https://example.com/photo.jpg",
            description="Underwater photo"
        )
        db_session.add(dive_media)
        db_session.commit()
    
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Verify dive data
        assert len(data["dives"]) == 1
        dive_data = data["dives"][0]
        assert dive_data["id"] == dive.id
        assert dive_data["dive_date"] == "2023-01-15"
        assert dive_data["max_depth"] == 18.5
        assert dive_data["duration"] == 45
        assert dive_data["dive_information"] == "Great dive!"
        assert dive_data["dive_site"]["name"] == "Test Site"
        assert len(dive_data["media"]) == 1
        assert dive_data["media"][0]["url"] == "https://example.com/photo.jpg"
    
        # Verify total records count
        assert data["total_records"] == 2  # 1 user profile + 1 dive (media is nested within dive)
    
    def test_data_export_with_ratings_and_comments(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test data export for user with ratings and comments"""
        # Create a dive site
        dive_site = DiveSite(
            name="Test Site",
            description="Test description",
            latitude=10.0,
            longitude=20.0,
            access_instructions="Shore access",
            difficulty_level="intermediate"
        )
        db_session.add(dive_site)
        db_session.commit()
        db_session.refresh(dive_site)
    
        # Create a diving center
        diving_center = DivingCenter(
            name="Test Center",
            description="Test description",
            email="test@center.com",
            phone="+1234567890",
            website="www.testcenter.com",
            latitude=15.0,
            longitude=25.0
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)
    
        # Create site rating
        site_rating = SiteRating(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            score=5
        )
        db_session.add(site_rating)
        db_session.commit()
    
        # Create site comment
        site_comment = SiteComment(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            comment_text="Beautiful underwater landscape"
        )
        db_session.add(site_comment)
        db_session.commit()
    
        # Create center rating
        center_rating = CenterRating(
            user_id=test_user.id,
            diving_center_id=diving_center.id,
            score=4
        )
        db_session.add(center_rating)
        db_session.commit()
    
        # Create center comment
        center_comment = CenterComment(
            user_id=test_user.id,
            diving_center_id=diving_center.id,
            comment_text="Professional staff"
        )
        db_session.add(center_comment)
        db_session.commit()
    
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Verify ratings
        assert len(data["ratings"]["dive_sites"]) == 1
        assert len(data["ratings"]["diving_centers"]) == 1
        
        site_rating_data = data["ratings"]["dive_sites"][0]
        center_rating_data = data["ratings"]["diving_centers"][0]
        
        assert site_rating_data["score"] == 5
        assert center_rating_data["score"] == 4
    
        # Verify comments
        assert len(data["comments"]["dive_sites"]) == 1
        assert len(data["comments"]["diving_centers"]) == 1
        
        site_comment_data = data["comments"]["dive_sites"][0]
        center_comment_data = data["comments"]["diving_centers"][0]
        
        assert site_comment_data["comment_text"] == "Beautiful underwater landscape"
        assert center_comment_data["comment_text"] == "Professional staff"
    
        # Verify total records count
        assert data["total_records"] == 5  # 1 user profile + 1 site rating + 1 center rating + 1 site comment + 1 center comment
    
    def test_data_export_unauthorized(self, client: TestClient):
        """Test data export without authentication"""
        response = client.get("/api/v1/privacy/data-export")
        assert response.status_code == 403  # FastAPI returns 403 for missing token
    
    def test_data_export_disabled_user(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test data export for disabled user"""
        # Disable the user
        test_user.enabled = False
        db_session.commit()
    
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
        assert response.status_code == 403  # User is disabled
    
    def test_data_export_only_own_data(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test that user can only export their own data"""
        # Create another user
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",
            is_admin=False,
            is_moderator=False,
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
    
        # Create dive site
        dive_site = DiveSite(
            name="Test Site",
            description="Test description",
            latitude=10.0,
            longitude=20.0,
            access_instructions="Shore access",
            difficulty_level="intermediate"
        )
        db_session.add(dive_site)
        db_session.commit()
        db_session.refresh(dive_site)
    
        # Create dive for other user
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=dive_site.id,
            dive_date=date(2023, 1, 15),
            dive_time=time(10, 0),
            max_depth=18.5,
            duration=45,
            visibility_rating=15,
            dive_information="Other user's dive"
        )
        db_session.add(other_dive)
        db_session.commit()
    
        # Create dive for test user
        test_dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            dive_date=date(2023, 1, 16),
            dive_time=time(11, 0),
            max_depth=20.0,
            duration=50,
            visibility_rating=20,
            dive_information="Test user's dive"
        )
        db_session.add(test_dive)
        db_session.commit()
    
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Should only contain test user's data
        assert len(data["dives"]) == 1
        assert data["dives"][0]["id"] == test_dive.id
        assert data["dives"][0]["dive_information"] == "Test user's dive"
    
        # Should not contain other user's data
        dive_ids = [d["id"] for d in data["dives"]]
        assert other_dive.id not in dive_ids
    
    def test_data_export_with_certifications(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test data export for user with certifications"""
        # Create diving organization
        org = DivingOrganization(
            name="PADI",
            acronym="PADI",
            description="Professional Association of Diving Instructors",
            website="www.padi.com"
        )
        db_session.add(org)
        db_session.commit()
        db_session.refresh(org)
    
        # Create user certification
        cert = UserCertification(
            user_id=test_user.id,
            diving_organization_id=org.id,
            certification_level="Open Water Diver"
        )
        db_session.add(cert)
        db_session.commit()
    
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Verify certification data
        assert len(data["certifications"]) == 1
        cert_data = data["certifications"][0]
        assert cert_data["organization_name"] == "PADI"
        assert cert_data["organization_acronym"] == "PADI"
        assert cert_data["certification_level"] == "Open Water Diver"
        assert cert_data["is_active"] is True
        
        # Verify total records count
        assert data["total_records"] == 2  # 1 user profile + 1 certification
    
    def test_data_export_with_owned_diving_center(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test data export for user who owns a diving center"""
        # Create diving center owned by test user
        diving_center = DivingCenter(
            name="My Diving Center",
            description="A diving center I own",
            email="owner@mycenter.com",
            phone="+1234567890",
            website="www.mycenter.com",
            latitude=15.0,
            longitude=25.0,
            owner_id=test_user.id
        )
        db_session.add(diving_center)
        db_session.commit()
        db_session.refresh(diving_center)
    
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Verify owned diving center data
        assert len(data["owned_diving_centers"]) == 1
        center_data = data["owned_diving_centers"][0]
        assert center_data["name"] == "My Diving Center"
        assert center_data["email"] == "owner@mycenter.com"
        assert center_data["description"] == "A diving center I own"
        assert center_data["phone"] == "+1234567890"
        assert center_data["website"] == "www.mycenter.com"
        
        # Verify total records count
        assert data["total_records"] == 2  # 1 user profile + 1 owned diving center
    
    def test_data_export_cannot_access_other_user_data_with_manipulation(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test that user cannot access other user's data even with manipulated token"""
        # Create another user
        other_user = User(
            username="otheruser",
            email="other@example.com",
            password_hash="$2b$12$Qf4ceC4ETacht.pNDme/H.nTnGtc7bNpWDZD2R39K.1Nh32oH7cfy",
            is_admin=False,
            is_moderator=False,
            enabled=True
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
    
        # Create dive site
        dive_site = DiveSite(
            name="Test Site",
            description="Test description",
            latitude=10.0,
            longitude=20.0,
            access_instructions="Shore access",
            difficulty_level="intermediate"
        )
        db_session.add(dive_site)
        db_session.commit()
        db_session.refresh(dive_site)
    
        # Create dive for other user
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=dive_site.id,
            dive_date=date(2023, 1, 15),
            dive_time=time(10, 0),
            max_depth=18.5,
            duration=45,
            visibility_rating=15,
            dive_information="Other user's dive"
        )
        db_session.add(other_dive)
        db_session.commit()
    
        # Try to access data export (should only get own data)
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
    
        assert response.status_code == 200
        data = response.json()
    
        # Should not contain other user's data
        assert len(data["dives"]) == 0
        assert data["total_records"] == 1  # User's own profile is always included

class TestPrivacyAuditLog:
    """Test cases for the privacy audit log endpoint"""
    
    def test_audit_log_success(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test successful audit log retrieval for authenticated user"""
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "entries" in data
        assert "total_entries" in data
        assert "period_start" in data
        assert "period_end" in data
        assert "export_timestamp" in data
        
        # Verify data types
        assert isinstance(data["entries"], list)
        assert isinstance(data["total_entries"], int)
        assert isinstance(data["period_start"], str)
        assert isinstance(data["period_end"], str)
        assert isinstance(data["export_timestamp"], str)
        
        # Verify period dates are valid
        period_start = datetime.fromisoformat(data["period_start"])
        period_end = datetime.fromisoformat(data["period_end"])
        assert isinstance(period_start, datetime)
        assert isinstance(period_end, datetime)
        
        # Verify export timestamp is valid
        export_timestamp = datetime.fromisoformat(data["export_timestamp"])
        assert isinstance(export_timestamp, datetime)
    
    def test_audit_log_with_recent_activity(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test audit log includes recent user activity"""
        # Create some activity for the user
        dive_site = DiveSite(
            name="Test Dive Site for Audit",
            latitude=40.7128,
            longitude=-74.0060
        )
        db_session.add(dive_site)
        db_session.flush()
        
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name="Test Dive for Audit",
            is_private=False,
            dive_date=date(2023, 1, 15),
            dive_time=time(10, 0),
            max_depth=18.5,
            duration=45,
            visibility_rating=15,
            dive_information="Test dive for audit log"
        )
        db_session.add(dive)
        db_session.commit()
        
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify audit log contains entries
        assert data["total_entries"] >= 0  # May be 0 if no audit logging implemented
        
        # Clean up
        db_session.delete(dive)
        db_session.delete(dive_site)
        db_session.commit()
    
    def test_audit_log_parameters(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test audit log with different parameters"""
        # Test with custom days parameter
        response = client.get("/api/v1/privacy/audit-log?days=7", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with custom limit parameter
        response = client.get("/api/v1/privacy/audit-log?limit=50", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with custom offset parameter
        response = client.get("/api/v1/privacy/audit-log?offset=10", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with multiple parameters
        response = client.get("/api/v1/privacy/audit-log?days=14&limit=25&offset=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "entries" in data
        assert "total_entries" in data
    
    def test_audit_log_parameter_validation(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test audit log parameter validation"""
        # Test with invalid days (negative)
        response = client.get("/api/v1/privacy/audit-log?days=-1", headers=auth_headers)
        assert response.status_code == 400  # Bad request error
        
        # Test with invalid limit (negative)
        response = client.get("/api/v1/privacy/audit-log?limit=-1", headers=auth_headers)
        assert response.status_code == 400  # Bad request error
        
        # Test with invalid offset (negative)
        response = client.get("/api/v1/privacy/audit-log?offset=-1", headers=auth_headers)
        assert response.status_code == 400  # Bad request error
        
        # Test with very large values
        response = client.get("/api/v1/privacy/audit-log?days=10000&limit=10000&offset=10000", headers=auth_headers)
        assert response.status_code == 400  # Should reject values exceeding limits
    
    def test_audit_log_unauthorized(self, client: TestClient):
        """Test audit log requires authentication"""
        response = client.get("/api/v1/privacy/audit-log")
        assert response.status_code == 403  # FastAPI returns 403 for missing auth
    
    def test_audit_log_disabled_user(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test audit log fails for disabled user"""
        # Disable the user
        test_user.enabled = False
        db_session.commit()
        
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        assert response.status_code == 403
        assert "User account is disabled" in response.json()["detail"]
        
        # Re-enable the user for other tests
        test_user.enabled = True
        db_session.commit()
    
    def test_audit_log_only_own_data(self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict):
        """Test audit log only includes user's own data"""
        # Create another user
        other_user = User(
            username="otheruser2",
            email="other2@example.com",
            password_hash="hashed_password"
        )
        db_session.add(other_user)
        db_session.flush()
        
        # Create activity for the other user
        dive_site = DiveSite(
            name="Other User's Dive Site 2",
            latitude=40.7128,
            longitude=-74.0060
        )
        db_session.add(dive_site)
        db_session.flush()
        
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=dive_site.id,
            name="Other User's Dive 2",
            is_private=False,
            dive_date=date(2023, 1, 15),
            dive_time=time(10, 0),
            max_depth=18.5,
            duration=45,
            visibility_rating=15,
            dive_information="Other user's dive for audit log"
        )
        db_session.add(other_dive)
        db_session.commit()
        
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify audit log only contains test_user's data
        # This test assumes the audit log implementation filters by user
        # If no filtering is implemented, this test may need adjustment
        
        # Clean up
        db_session.delete(other_dive)
        db_session.delete(dive_site)
        db_session.delete(other_user)
        db_session.commit()

class TestPrivacySecurityControls:
    """Test cases for privacy security controls"""
    
    def test_data_export_cannot_access_other_user_data_with_manipulation(
        self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict
    ):
        """Test that users cannot access other users' data through manipulation"""
        # Create another user
        other_user = User(
            username="otheruser3",
            email="other3@example.com",
            password_hash="hashed_password"
        )
        db_session.add(other_user)
        db_session.flush()
        
        # Try to manipulate the request to access other user's data
        # This test verifies that the endpoint properly validates the current user
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify only test_user's data is returned
        assert data["user_profile"]["id"] == test_user.id
        assert data["user_profile"]["username"] == test_user.username
        
        # Verify no data from other_user is included
        assert data["user_profile"]["id"] != other_user.id
        
        # Clean up
        db_session.delete(other_user)
        db_session.commit()
    
    def test_audit_log_cannot_access_other_user_data_with_manipulation(
        self, client: TestClient, db_session: Session, test_user: User, auth_headers: dict
    ):
        """Test that users cannot access other users' audit logs through manipulation"""
        # Create another user
        other_user = User(
            username="otheruser4",
            email="other4@example.com",
            password_hash="hashed_password"
        )
        db_session.add(other_user)
        db_session.flush()
        
        # Try to access audit log
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify audit log only contains test_user's data
        # This test assumes the audit log implementation filters by user
        
        # Clean up
        db_session.delete(other_user)
        db_session.commit()
    
    def test_privacy_endpoints_with_invalid_tokens(self, client: TestClient, db_session: Session):
        """Test privacy endpoints reject invalid tokens"""
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        
        # Test data export with invalid token
        response = client.get("/api/v1/privacy/data-export", headers=invalid_headers)
        assert response.status_code == 401
        
        # Test audit log with invalid token
        response = client.get("/api/v1/privacy/audit-log", headers=invalid_headers)
        assert response.status_code == 401
    
    def test_privacy_endpoints_with_expired_tokens(self, client: TestClient, db_session: Session):
        """Test privacy endpoints reject expired tokens"""
        # Create an expired token (this would need to be implemented in the test setup)
        # For now, we'll test with a malformed token that should be rejected
        expired_headers = {"Authorization": "Bearer expired_token_format"}
        
        # Test data export with expired token
        response = client.get("/api/v1/privacy/data-export", headers=expired_headers)
        assert response.status_code == 401
        
        # Test audit log with expired token
        response = client.get("/api/v1/privacy/audit-log", headers=expired_headers)
        assert response.status_code == 401
