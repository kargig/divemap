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

client = TestClient(app)

class TestPrivacyDataExport:
    """Test cases for the privacy data export endpoint"""
    
    def test_data_export_success(self, test_db: Session, test_user: User, auth_headers: dict):
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
        assert "password_hash" not in user_profile  # Ensure password is not exported
        
        # Verify ratings structure
        assert "dive_sites" in data["ratings"]
        assert "diving_centers" in data["ratings"]
        
        # Verify comments structure
        assert "dive_sites" in data["comments"]
        assert "diving_centers" in data["comments"]
        
        # Verify timestamp format
        timestamp = datetime.fromisoformat(data["export_timestamp"])
        assert isinstance(timestamp, datetime)
    
    def test_data_export_with_dive_data(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test data export includes user's dive data"""
        # Create a dive site
        dive_site = DiveSite(
            name="Test Dive Site",
            latitude=40.7128,
            longitude=-74.0060,
            description="Test dive site for privacy test"
        )
        test_db.add(dive_site)
        test_db.flush()
        
        # Create a dive for the user
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name="Test Dive",
            is_private=False,
            dive_information="Test dive information",
            max_depth=30.5,
            dive_date=date(2024, 1, 15),
            dive_time=time(10, 30),
            duration=45
        )
        test_db.add(dive)
        test_db.flush()
        
        # Create dive media
        dive_media = DiveMedia(
            dive_id=dive.id,
            media_type="photo",
            url="https://example.com/photo.jpg",
            description="Test photo"
        )
        test_db.add(dive_media)
        
        # Create a tag and link it to the dive
        tag = AvailableTag(name="Test Tag", description="Test tag")
        test_db.add(tag)
        test_db.flush()
        
        dive_tag = DiveTag(dive_id=dive.id, tag_id=tag.id)
        test_db.add(dive_tag)
        test_db.commit()
        
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify dive data is included
        assert len(data["dives"]) == 1
        dive_data = data["dives"][0]
        assert dive_data["id"] == dive.id
        assert dive_data["name"] == "Test Dive"
        assert dive_data["max_depth"] == 30.5
        assert dive_data["dive_site"]["name"] == "Test Dive Site"
        
        # Verify media is included
        assert len(dive_data["media"]) == 1
        assert dive_data["media"][0]["url"] == "https://example.com/photo.jpg"
        
        # Verify tags are included
        assert len(dive_data["tags"]) == 1
        assert dive_data["tags"][0]["name"] == "Test Tag"
    
    def test_data_export_with_ratings_and_comments(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test data export includes user's ratings and comments"""
        # Create dive site and diving center
        dive_site = DiveSite(
            name="Rated Dive Site",
            latitude=40.7128,
            longitude=-74.0060
        )
        test_db.add(dive_site)
        test_db.flush()
        
        diving_center = DivingCenter(
            name="Test Diving Center",
            latitude=40.7128,
            longitude=-74.0060
        )
        test_db.add(diving_center)
        test_db.flush()
        
        # Create ratings
        site_rating = SiteRating(
            dive_site_id=dive_site.id,
            user_id=test_user.id,
            score=8
        )
        test_db.add(site_rating)
        
        center_rating = CenterRating(
            diving_center_id=diving_center.id,
            user_id=test_user.id,
            score=9
        )
        test_db.add(center_rating)
        
        # Create comments
        site_comment = SiteComment(
            dive_site_id=dive_site.id,
            user_id=test_user.id,
            comment_text="Great dive site!"
        )
        test_db.add(site_comment)
        
        center_comment = CenterComment(
            diving_center_id=diving_center.id,
            user_id=test_user.id,
            comment_text="Excellent service!"
        )
        test_db.add(center_comment)
        test_db.commit()
        
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify ratings
        assert len(data["ratings"]["dive_sites"]) == 1
        assert data["ratings"]["dive_sites"][0]["score"] == 8
        assert data["ratings"]["dive_sites"][0]["dive_site_name"] == "Rated Dive Site"
        
        assert len(data["ratings"]["diving_centers"]) == 1
        assert data["ratings"]["diving_centers"][0]["score"] == 9
        assert data["ratings"]["diving_centers"][0]["diving_center_name"] == "Test Diving Center"
        
        # Verify comments
        assert len(data["comments"]["dive_sites"]) == 1
        assert data["comments"]["dive_sites"][0]["comment_text"] == "Great dive site!"
        
        assert len(data["comments"]["diving_centers"]) == 1
        assert data["comments"]["diving_centers"][0]["comment_text"] == "Excellent service!"
    
    def test_data_export_unauthorized(self):
        """Test data export requires authentication"""
        response = client.get("/api/v1/privacy/data-export")
        assert response.status_code == 401
    
    def test_data_export_disabled_user(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test data export fails for disabled user"""
        # Disable the user
        test_user.enabled = False
        test_db.commit()
        
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
        assert response.status_code == 403
        
        # Re-enable user for cleanup
        test_user.enabled = True
        test_db.commit()
    
    def test_data_export_only_own_data(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test that user can only export their own data, not other users' data"""
        # Create another user with data
        other_user = User(
            username="other_user",
            email="other@example.com",
            password_hash="hashed_password"
        )
        test_db.add(other_user)
        test_db.flush()
        
        # Create dive site
        dive_site = DiveSite(
            name="Other User Site",
            latitude=40.7128,
            longitude=-74.0060
        )
        test_db.add(dive_site)
        test_db.flush()
        
        # Create data for other user
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=dive_site.id,
            name="Other User Dive",
            dive_date=date(2024, 1, 15)
        )
        test_db.add(other_dive)
        
        other_rating = SiteRating(
            dive_site_id=dive_site.id,
            user_id=other_user.id,
            score=7
        )
        test_db.add(other_rating)
        test_db.commit()
        
        # Export data as test_user
        response = client.get("/api/v1/privacy/data-export", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify test_user only gets their own data
        assert data["user_profile"]["id"] == test_user.id
        assert len(data["dives"]) == 0  # No dives for test_user
        assert len(data["ratings"]["dive_sites"]) == 0  # No ratings for test_user
        
        # Verify other user's data is not included
        for dive in data["dives"]:
            assert dive["user_id"] != other_user.id
        
        for rating in data["ratings"]["dive_sites"]:
            assert rating["id"] != other_rating.id

class TestPrivacyAuditLog:
    """Test cases for the privacy audit log endpoint"""
    
    def test_audit_log_success(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test successful audit log retrieval"""
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "entries" in data
        assert "total_entries" in data
        assert "period_start" in data
        assert "period_end" in data
        assert "export_timestamp" in data
        
        # Verify timestamps are valid
        period_start = datetime.fromisoformat(data["period_start"])
        period_end = datetime.fromisoformat(data["period_end"])
        export_timestamp = datetime.fromisoformat(data["export_timestamp"])
        
        assert isinstance(period_start, datetime)
        assert isinstance(period_end, datetime)
        assert isinstance(export_timestamp, datetime)
        assert period_start < period_end
    
    def test_audit_log_with_recent_activity(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test audit log includes recent user activity"""
        # Create a dive site
        dive_site = DiveSite(
            name="Audit Test Site",
            latitude=40.7128,
            longitude=-74.0060
        )
        test_db.add(dive_site)
        test_db.flush()
        
        # Create a recent dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name="Recent Dive",
            dive_date=date.today(),
            dive_information="Recent dive for audit test"
        )
        test_db.add(dive)
        
        # Create a recent rating
        rating = SiteRating(
            dive_site_id=dive_site.id,
            user_id=test_user.id,
            score=8
        )
        test_db.add(rating)
        test_db.commit()
        
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have some entries for recent activity
        assert data["total_entries"] > 0
        assert len(data["entries"]) > 0
        
        # Check that audit entries contain expected activities
        actions = [entry["action"] for entry in data["entries"]]
        resource_types = [entry["resource_type"] for entry in data["entries"]]
        
        assert "CREATE" in actions
        assert "dive" in resource_types or "site_rating" in resource_types
    
    def test_audit_log_parameters(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test audit log with different parameters"""
        # Test with custom days parameter
        response = client.get("/api/v1/privacy/audit-log?days=7", headers=auth_headers)
        assert response.status_code == 200
        
        # Test with custom limit and offset
        response = client.get("/api/v1/privacy/audit-log?limit=10&offset=0", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) <= 10
    
    def test_audit_log_parameter_validation(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test audit log parameter validation"""
        # Invalid days (too high)
        response = client.get("/api/v1/privacy/audit-log?days=400", headers=auth_headers)
        assert response.status_code == 400
        assert "Days parameter must be between 1 and 365" in response.json()["detail"]
        
        # Invalid days (too low)
        response = client.get("/api/v1/privacy/audit-log?days=0", headers=auth_headers)
        assert response.status_code == 400
        
        # Invalid limit (too high)
        response = client.get("/api/v1/privacy/audit-log?limit=2000", headers=auth_headers)
        assert response.status_code == 400
        assert "Limit parameter must be between 1 and 1000" in response.json()["detail"]
        
        # Invalid offset (negative)
        response = client.get("/api/v1/privacy/audit-log?offset=-1", headers=auth_headers)
        assert response.status_code == 400
        assert "Offset parameter must be non-negative" in response.json()["detail"]
    
    def test_audit_log_unauthorized(self):
        """Test audit log requires authentication"""
        response = client.get("/api/v1/privacy/audit-log")
        assert response.status_code == 401
    
    def test_audit_log_disabled_user(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test audit log fails for disabled user"""
        # Disable the user
        test_user.enabled = False
        test_db.commit()
        
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        assert response.status_code == 403
        
        # Re-enable user for cleanup
        test_user.enabled = True
        test_db.commit()
    
    def test_audit_log_only_own_data(self, test_db: Session, test_user: User, auth_headers: dict):
        """Test that audit log only shows user's own activities"""
        # Create another user
        other_user = User(
            username="other_audit_user",
            email="other_audit@example.com",
            password_hash="hashed_password"
        )
        test_db.add(other_user)
        test_db.flush()
        
        # Create dive site
        dive_site = DiveSite(
            name="Audit Site",
            latitude=40.7128,
            longitude=-74.0060
        )
        test_db.add(dive_site)
        test_db.flush()
        
        # Create activity for other user
        other_dive = Dive(
            user_id=other_user.id,
            dive_site_id=dive_site.id,
            name="Other User Dive",
            dive_date=date.today()
        )
        test_db.add(other_dive)
        
        # Create activity for test user
        test_dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name="Test User Dive",
            dive_date=date.today()
        )
        test_db.add(test_dive)
        test_db.commit()
        
        response = client.get("/api/v1/privacy/audit-log", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # All audit entries should be for the authenticated user only
        # We can't directly check user_id in audit entries since they don't store it,
        # but we verify that the activities correspond to the test user's data
        for entry in data["entries"]:
            if entry["resource_type"] == "dive":
                # If we can match the resource_id, it should be test_user's dive
                if entry["resource_id"] == test_dive.id:
                    assert entry["details"]["dive_name"] == "Test User Dive"
                # Should never be other user's dive
                assert entry["resource_id"] != other_dive.id

class TestPrivacySecurityControls:
    """Test security controls for privacy endpoints"""
    
    def test_data_export_cannot_access_other_user_data_with_manipulation(
        self, test_db: Session, test_user: User, auth_headers: dict
    ):
        """Test that manipulating requests cannot access other users' data"""
        # Create another user
        other_user = User(
            username="target_user",
            email="target@example.com",
            password_hash="hashed_password"
        )
        test_db.add(other_user)
        test_db.flush()
        
        # Try various parameter manipulation attempts (though our endpoint doesn't take user params)
        response = client.get(f"/api/v1/privacy/data-export?user_id={other_user.id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should still only return the authenticated user's data
        assert data["user_profile"]["id"] == test_user.id
        assert data["user_profile"]["id"] != other_user.id
    
    def test_audit_log_cannot_access_other_user_data_with_manipulation(
        self, test_db: Session, test_user: User, auth_headers: dict
    ):
        """Test that manipulating audit log requests cannot access other users' data"""
        # Create another user
        other_user = User(
            username="target_audit_user",
            email="target_audit@example.com",
            password_hash="hashed_password"
        )
        test_db.add(other_user)
        test_db.commit()
        
        # Try parameter manipulation
        response = client.get(f"/api/v1/privacy/audit-log?user_id={other_user.id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only show authenticated user's audit trail
        # (The endpoint ignores any user_id parameter and uses only the authenticated user)
        for entry in data["entries"]:
            # All entries should be related to test_user's activities only
            if entry["resource_type"] == "user_account":
                # If it's an account creation, it should be test_user's account
                assert entry["resource_id"] == test_user.id
    
    def test_privacy_endpoints_with_invalid_tokens(self, test_db: Session):
        """Test privacy endpoints with invalid authentication tokens"""
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        
        # Test data export with invalid token
        response = client.get("/api/v1/privacy/data-export", headers=invalid_headers)
        assert response.status_code == 401
        
        # Test audit log with invalid token
        response = client.get("/api/v1/privacy/audit-log", headers=invalid_headers)
        assert response.status_code == 401
    
    def test_privacy_endpoints_with_expired_tokens(self, test_db: Session):
        """Test privacy endpoints with malformed authorization headers"""
        malformed_headers = {"Authorization": "InvalidFormat token"}
        
        # Test data export with malformed token
        response = client.get("/api/v1/privacy/data-export", headers=malformed_headers)
        assert response.status_code == 401
        
        # Test audit log with malformed token
        response = client.get("/api/v1/privacy/audit-log", headers=malformed_headers)
        assert response.status_code == 401
