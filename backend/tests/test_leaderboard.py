import pytest
from fastapi import status
from datetime import datetime, timezone

from app.models import Dive, DiveSite, SiteRating, SiteComment, DivingCenter, ParsedDiveTrip

class TestLeaderboard:
    """Test leaderboard endpoints."""

    def test_get_overall_leaderboard_empty(self, client):
        """Test overall leaderboard when no activity exists."""
        response = client.get("/api/v1/leaderboard/users/overall")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["metric"] == "overall"
        assert len(data["entries"]) == 0

    def test_get_overall_leaderboard_with_data(self, client, db_session, test_user):
        """Test overall leaderboard with various user activities."""
        # Add some activities for the test user
        # 1. Log a dive (10 pts)
        dive = Dive(user_id=test_user.id, dive_date=datetime.now(timezone.utc).date())
        db_session.add(dive)
        
        # 2. Create a dive site (20 pts)
        site = DiveSite(name="Test Site", created_by=test_user.id, location="POINT(0 0)")
        db_session.add(site)
        
        # 3. Post a comment (5 pts)
        db_session.commit() # Need site.id for comment
        comment = SiteComment(user_id=test_user.id, dive_site_id=site.id, comment_text="Great site!")
        db_session.add(comment)
        
        db_session.commit()

        # Total expected points: 10 + 20 + 5 = 35
        response = client.get("/api/v1/leaderboard/users/overall")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) > 0
        entry = next(e for e in data["entries"] if e["user_id"] == test_user.id)
        assert entry["points"] == 35
        assert entry["rank"] == 1

    def test_get_category_leaderboard_dives(self, client, db_session, test_user):
        """Test dives category leaderboard."""
        # Log 3 dives for test_user
        for _ in range(3):
            dive = Dive(user_id=test_user.id, dive_date=datetime.now(timezone.utc).date())
            db_session.add(dive)
        db_session.commit()

        response = client.get("/api/v1/leaderboard/users/category/dives")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["metric"] == "dives"
        entry = next(e for e in data["entries"] if e["user_id"] == test_user.id)
        assert entry["count"] >= 3

    def test_get_center_leaderboard(self, client, db_session, test_user):
        """Test diving center leaderboard."""
        # Create a center and some trips
        center = DivingCenter(name="Test Center", owner_id=test_user.id, location="POINT(0 0)")
        db_session.add(center)
        db_session.commit()

        for i in range(5):
            trip = ParsedDiveTrip(diving_center_id=center.id, trip_date=datetime.now(timezone.utc).date())
            db_session.add(trip)
        db_session.commit()

        response = client.get("/api/v1/leaderboard/centers")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["metric"] == "trips"
        entry = next(e for e in data["entries"] if e["center_id"] == center.id)
        assert entry["count"] == 5

    def test_get_monthly_leaderboard_success(self, client, db_session, test_user):
        """Test getting monthly leaderboard for a specific month with data."""
        from datetime import datetime, timezone
        from app.models import Dive, DiveSite, OwnershipStatus
        
        # This month (current date)
        now = datetime.now(timezone.utc)
        
        # Log a dive in current month (10 pts)
        dive = Dive(user_id=test_user.id, dive_date=now.date(), created_at=now)
        db_session.add(dive)
        db_session.commit()
        
        # Log a dive in previous month (should not be counted in this month's leaderboard)
        from datetime import timedelta
        prev_month_date = now - timedelta(days=45)
        old_dive = Dive(user_id=test_user.id, dive_date=prev_month_date.date(), created_at=prev_month_date)
        db_session.add(old_dive)
        db_session.commit()

        # Query current month's leaderboard
        response = client.get(f"/api/v1/leaderboard/users/monthly?year={now.year}&month={now.month}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) > 0
        entry = next(e for e in data["entries"] if e["user_id"] == test_user.id)
        # Should only count the current month's dive (10 pts), not the old one
        assert entry["points"] == 10
        assert entry["rank"] == 1

    def test_get_monthly_leaderboard_empty(self, client):
        """Test monthly leaderboard for a month with no activity."""
        # Query next year (guaranteed empty)
        response = client.get("/api/v1/leaderboard/users/monthly?year=2030&month=1")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) == 0

    def test_leaderboard_invalid_limit(self, client):
        """Test leaderboard with invalid limit parameters."""
        response = client.get("/api/v1/leaderboard/users/overall?limit=0")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        response = client.get("/api/v1/leaderboard/users/overall?limit=101")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
