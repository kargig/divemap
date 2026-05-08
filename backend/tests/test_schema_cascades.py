import pytest
from fastapi import status
from datetime import date
from app.models import (
    DivingCenter, CenterRating, CenterComment, CenterMedia, 
    CenterDiveSite, GearRentalCost, User, DiveSite, MediaType
)

class TestDivingCenterInterdependencies:
    def test_delete_diving_center_with_complex_relationships(
        self, client, admin_headers, db_session, test_user, test_dive_site
    ):
        """Test deleting a diving center that has ratings, comments, and media attached."""
        
        # 1. Create a diving center
        center = DivingCenter(
            name="Cascade Test Center",
            description="A center to be deleted",
            latitude=35.0,
            longitude=25.0,
            country="Greece",
            owner_id=test_user.id
        )
        db_session.add(center)
        db_session.commit()
        db_session.refresh(center)

        # 2. Add a rating
        rating = CenterRating(
            diving_center_id=center.id,
            user_id=test_user.id,
            score=9
        )
        db_session.add(rating)

        # 3. Add a comment
        comment = CenterComment(
            diving_center_id=center.id,
            user_id=test_user.id,
            comment_text="Great place!"
        )
        db_session.add(comment)

        # 4. Add gear rental cost
        gear = GearRentalCost(
            diving_center_id=center.id,
            item_name="BCD",
            cost=15.00
        )
        db_session.add(gear)

        # 5. Link to a dive site
        center_site = CenterDiveSite(
            diving_center_id=center.id,
            dive_site_id=test_dive_site.id
        )
        db_session.add(center_site)

        db_session.commit()

        # 6. Attempt to delete the diving center (assuming admin endpoint exists)
        # Note: Testing the actual deletion at the ORM level to verify the cascade, 
        # as there might not be an explicit admin delete endpoint for centers yet.
        db_session.delete(center)
        db_session.commit()
        
        # 7. Verify interdependencies are cleaned up
        assert db_session.query(CenterRating).filter(CenterRating.diving_center_id == center.id).count() == 0
        assert db_session.query(CenterComment).filter(CenterComment.diving_center_id == center.id).count() == 0
        assert db_session.query(GearRentalCost).filter(GearRentalCost.diving_center_id == center.id).count() == 0
        assert db_session.query(CenterDiveSite).filter(CenterDiveSite.diving_center_id == center.id).count() == 0
        
        # 8. Verify the referenced user and dive site were NOT deleted
        assert db_session.query(User).filter(User.id == test_user.id).first() is not None
        assert db_session.query(DiveSite).filter(DiveSite.id == test_dive_site.id).first() is not None

class TestUserInterdependencies:
    def test_delete_user_with_comments(
        self, client, auth_headers, db_session, test_user, test_dive_site
    ):
        """Test that deleting a user sets their comments' user_id to NULL rather than deleting the comment."""
        
        # 1. Create a center
        center = DivingCenter(
            name="User Test Center",
            latitude=35.0,
            longitude=25.0
        )
        db_session.add(center)
        db_session.commit()
        db_session.refresh(center)

        # 2. Add a center comment by the test_user
        comment = CenterComment(
            diving_center_id=center.id,
            user_id=test_user.id,
            comment_text="I liked it here."
        )
        db_session.add(comment)
        db_session.commit()
        db_session.refresh(comment)
        comment_id = comment.id

        # 3. Delete the user
        db_session.delete(test_user)
        db_session.commit()
        
        # 4. Verify the comment still exists but user_id is NULL
        reloaded_comment = db_session.query(CenterComment).filter(CenterComment.id == comment_id).first()
        assert reloaded_comment is not None
        assert reloaded_comment.user_id is None
        assert reloaded_comment.comment_text == "I liked it here."
