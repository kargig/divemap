
import pytest
from fastapi import status
from sqlalchemy import text
from app.models import DiveSite, User

class TestProximityModeration:
    """Test dive site proximity validation and moderation workflow."""

    def setup_method(self):
        # Coordinates for testing (Athens, Greece area)
        self.lat1 = 37.9838
        self.lng1 = 23.7275
        
        # Point ~10 meters away from point 1
        self.lat_near = 37.98385
        self.lng_near = 23.72755
        
        # Point ~1km away from point 1
        self.lat_far = 37.9938
        self.lng_far = 23.7375

    def _create_spatial_site(self, db, name, lat, lng, user_id, status='approved'):
        """Helper to create a dive site with spatial location."""
        site = DiveSite(
            name=name,
            latitude=lat,
            longitude=lng,
            status=status,
            created_by=user_id
        )
        db.add(site)
        db.commit()
        db.refresh(site)
        
        # Manually update the location column since ORM might not handle POINT type well in tests
        db.execute(
            text("UPDATE dive_sites SET location = ST_SRID(POINT(:lng, :lat), 4326) WHERE id = :id"),
            {"lng": lng, "lat": lat, "id": site.id}
        )
        db.commit()
        return site

    def test_check_proximity_empty(self, client):
        """Test proximity check when no sites exist."""
        response = client.get(
            f"/api/v1/dive-sites/check-proximity?lat={self.lat1}&lng={self.lng1}&radius_m=50"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_check_proximity_match(self, client, db_session, test_user):
        """Test proximity check when a site is nearby."""
        self._create_spatial_site(db_session, "Existing Site", self.lat1, self.lng1, test_user.id)
        
        # Check from very close
        response = client.get(
            f"/api/v1/dive-sites/check-proximity?lat={self.lat_near}&lng={self.lng_near}&radius_m=50"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Existing Site"
        assert data[0]["distance_m"] < 50

    def test_create_dive_site_proximity_conflict(self, client, auth_headers, db_session, test_user):
        """Test creating a dive site too close to an existing one returns 409."""
        self._create_spatial_site(db_session, "Existing Site", self.lat1, self.lng1, test_user.id)
        
        new_site_data = {
            "name": "New Duplicate Site",
            "latitude": self.lat_near,
            "longitude": self.lng_near,
            "difficulty_code": "OPEN_WATER"
        }
        
        response = client.post("/api/v1/dive-sites/", json=new_site_data, headers=auth_headers)
        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()
        assert "nearby_sites" in data["detail"]
        assert data["detail"]["nearby_sites"][0]["name"] == "Existing Site"

    def test_create_dive_site_with_moderation(self, client, auth_headers, db_session, test_user):
        """Test creating a dive site with moderation_needed=True bypasses conflict but sets pending status."""
        self._create_spatial_site(db_session, "Existing Site", self.lat1, self.lng1, test_user.id)
        
        new_site_data = {
            "name": "Distinct Site Near Existing",
            "latitude": self.lat_near,
            "longitude": self.lng_near,
            "difficulty_code": "OPEN_WATER",
            "moderation_needed": True
        }
        
        response = client.post("/api/v1/dive-sites/", json=new_site_data, headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK # Success because moderation_needed is True
        data = response.json()
        assert data["status"] == "pending"
        
        # Verify it's not in the public list
        list_response = client.get("/api/v1/dive-sites/")
        assert list_response.status_code == status.HTTP_200_OK
        list_data = list_response.json().get("items", [])
        assert not any(s["id"] == data["id"] for s in list_data)

    def test_admin_approve_dive_site(self, client, admin_headers, db_session, test_user):
        """Test admin can approve a pending dive site."""
        site = self._create_spatial_site(db_session, "Pending Site", self.lat1, self.lng1, test_user.id, status='pending')
        
        response = client.post(f"/api/v1/dive-sites/{site.id}/approve", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "approved"
        
        # Verify it's now in the public list
        list_response = client.get("/api/v1/dive-sites/")
        list_data = list_response.json().get("items", [])
        assert any(s["id"] == site.id for s in list_data)

    def test_admin_reject_dive_site(self, client, admin_headers, db_session, test_user):
        """Test admin can reject a pending dive site."""
        site = self._create_spatial_site(db_session, "Duplicate Site", self.lat1, self.lng1, test_user.id, status='pending')
        
        response = client.post(f"/api/v1/dive-sites/{site.id}/reject", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "success"
        
        # Verify status is rejected in DB
        db_session.refresh(site)
        assert site.status == "rejected"

    def test_admin_get_pending_sites(self, client, admin_headers, db_session, test_user):
        """Test admin can list pending sites."""
        self._create_spatial_site(db_session, "Pending 1", self.lat1, self.lng1, test_user.id, status='pending')
        self._create_spatial_site(db_session, "Approved 1", self.lat_far, self.lng_far, test_user.id, status='approved')
        
        response = client.get("/api/v1/admin/dive-sites/pending", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Pending 1"

    def test_non_admin_cannot_approve(self, client, auth_headers, test_user, db_session):
        """Test regular user cannot approve sites."""
        site = self._create_spatial_site(db_session, "Pending Site", self.lat1, self.lng1, test_user.id, status='pending')
        response = client.post(f"/api/v1/dive-sites/{site.id}/approve", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
