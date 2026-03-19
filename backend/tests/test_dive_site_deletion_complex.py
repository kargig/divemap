
import pytest
from fastapi import status
from app.models import DiveSite, Dive, DiveRoute, SiteRating, SiteComment, CenterDiveSite, DivingCenter, User, DiveBuddy

class TestComplexDiveSiteDeletion:
    def test_delete_dive_site_with_complex_relationships(self, client, admin_headers, db_session, test_user):
        """Test deleting a dive site that has many related records."""
        # 1. Create a dive site
        dive_site = DiveSite(
            name="Deletion Test Site",
            description="Site to be deleted",
            latitude=37.0,
            longitude=24.0,
            created_by=test_user.id
        )
        db_session.add(dive_site)
        db_session.commit()
        db_session.refresh(dive_site)

        # 2. Create a route for this site
        route = DiveRoute(
            dive_site_id=dive_site.id,
            created_by=test_user.id,
            name="Test Route",
            route_data={"type": "FeatureCollection", "features": []},
            route_type="scuba"
        )
        db_session.add(route)
        
        # 3. Create a rating
        rating = SiteRating(
            dive_site_id=dive_site.id,
            user_id=test_user.id,
            score=8
        )
        db_session.add(rating)

        # 4. Create a comment
        comment = SiteComment(
            dive_site_id=dive_site.id,
            user_id=test_user.id,
            comment_text="Nice site"
        )
        db_session.add(comment)

        # 5. Create a dive at this site
        from datetime import date
        dive = Dive(
            user_id=test_user.id,
            dive_site_id=dive_site.id,
            name="Test Dive",
            dive_date=date.today(),
            max_depth=20.0,
            duration=45
        )
        db_session.add(dive)
        db_session.commit()
        db_session.refresh(dive)
        db_session.refresh(route)

        # 6. Link the dive to the route and add a buddy
        dive.selected_route_id = route.id
        
        # Create another user for buddy
        buddy = User(
            username="buddy",
            email="buddy@example.com",
            password_hash="dummy",
            enabled=True
        )
        db_session.add(buddy)
        db_session.commit()
        db_session.refresh(buddy)
        
        from app.models import DiveBuddy
        dive_buddy = DiveBuddy(
            dive_id=dive.id,
            user_id=buddy.id
        )
        db_session.add(dive_buddy)
        db_session.commit()
        
        # 7. Create a diving center and link it to the site
        center = DivingCenter(
            name="Test Center",
            description="Center description",
            location="POINT(24 37)"
        )
        db_session.add(center)
        db_session.commit()
        db_session.refresh(center)
        
        center_site = CenterDiveSite(
            diving_center_id=center.id,
            dive_site_id=dive_site.id,
            dive_cost=50.0
        )
        db_session.add(center_site)
        
        # 8. Create route analytics
        from app.models import RouteAnalytics
        analytics = RouteAnalytics(
            route_id=route.id,
            interaction_type="view",
            ip_address="127.0.0.1"
        )
        db_session.add(analytics)
        db_session.commit()

        # 9. Try to delete the dive site as admin
        response = client.delete(f"/api/v1/dive-sites/{dive_site.id}", headers=admin_headers)

        # Check if it failed with 500
        if response.status_code == 500:
            print(f"Reproduction successful: {response.json()}")
        
        assert response.status_code == status.HTTP_200_OK
