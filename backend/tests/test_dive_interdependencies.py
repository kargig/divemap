import pytest
from fastapi import status
from datetime import date, datetime
from app.models import Dive, DiveSite, DiveBuddy, DiveMedia, DiveTag, AvailableTag, User, MediaType

class TestDiveInterdependencies:
    def test_delete_dive_with_complex_relationships(self, client, auth_headers, db_session, test_user, test_dive_site):
        """Test deleting a dive that has buddies, media, and tags attached."""
        # 1. Create a dive
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Complex Test Dive",
            dive_date=date(2025, 5, 10),
            duration=60
        )
        db_session.add(dive)
        db_session.commit()
        db_session.refresh(dive)

        # 2. Add a buddy
        buddy = User(
            username="buddy_user",
            email="buddy@example.com",
            password_hash="hashed",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()
        
        dive_buddy = DiveBuddy(dive_id=dive.id, user_id=buddy.id)
        db_session.add(dive_buddy)

        # 3. Add media
        dive_media = DiveMedia(
            dive_id=dive.id,
            media_type=MediaType.photo,
            url="http://example.com/image.jpg"
        )
        db_session.add(dive_media)

        # 4. Add tags
        tag = db_session.query(AvailableTag).first()
        if not tag:
            tag = AvailableTag(name="Test Tag")
            db_session.add(tag)
            db_session.commit()
            
        dive_tag = DiveTag(dive_id=dive.id, tag_id=tag.id)
        db_session.add(dive_tag)
        
        db_session.commit()

        # 5. Attempt to delete the dive
        response = client.delete(f"/api/v1/dives/{dive.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        
        # 6. Verify interdependencies are cleaned up
        assert db_session.query(DiveBuddy).filter(DiveBuddy.dive_id == dive.id).count() == 0
        assert db_session.query(DiveMedia).filter(DiveMedia.dive_id == dive.id).count() == 0
        assert db_session.query(DiveTag).filter(DiveTag.dive_id == dive.id).count() == 0
        
        # 7. Verify shared entities are NOT deleted
        assert db_session.query(User).filter(User.id == buddy.id).first() is not None
        assert db_session.query(AvailableTag).filter(AvailableTag.id == tag.id).first() is not None

    def test_delete_dive_admin_endpoint(self, client, admin_headers, auth_headers, db_session, test_user, test_dive_site):
        """Test the admin-specific dive deletion endpoint."""
        # 1. Create a dive owned by a regular user
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=test_dive_site.id,
            name="Admin Delete Test",
            dive_date=date(2025, 5, 10),
            duration=30
        )
        db_session.add(dive)
        db_session.commit()

        # 2. Unauthorized user tries to use admin endpoint
        response = client.delete(f"/api/v1/dives/admin/dives/{dive.id}", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # 3. Admin user deletes the dive
        response = client.delete(f"/api/v1/dives/admin/dives/{dive.id}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        
        # 4. Verify dive is gone
        assert db_session.query(Dive).filter(Dive.id == dive.id).first() is None

    def test_delete_dive_admin_not_found(self, client, admin_headers):
        """Test admin delete endpoint with non-existent dive."""
        response = client.delete("/api/v1/dives/admin/dives/99999", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND
