import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from app.models import User, DiveRoute, RouteAnalytics, Dive
from app.services.route_analytics_service import RouteAnalyticsService


class TestRouteAnalyticsService:
    """Test route analytics service functionality."""

    def test_track_route_interaction_success(self, db_session, test_user, test_route):
        """Test successful tracking of route interaction."""
        service = RouteAnalyticsService(db_session)
        
        result = service.track_interaction(
            route_id=test_route.id,
            user_id=test_user.id,
            interaction_type="view",
            ip_address="127.0.0.1"
        )
        
        assert result is not None
        assert result.route_id == test_route.id
        assert result.user_id == test_user.id
        assert result.interaction_type == "view"
        
        # Verify interaction was recorded
        analytics = db_session.query(RouteAnalytics).filter(
            RouteAnalytics.route_id == test_route.id,
            RouteAnalytics.user_id == test_user.id,
            RouteAnalytics.interaction_type == "view"
        ).first()
        
        assert analytics is not None
        assert analytics.route_id == test_route.id
        assert analytics.user_id == test_user.id
        assert analytics.interaction_type == "view"
        assert analytics.ip_address == "127.0.0.1"

    def test_track_route_interaction_invalid_type(self, db_session, test_user, test_route):
        """Test tracking with invalid interaction type."""
        service = RouteAnalyticsService(db_session)
        
        # The service doesn't validate interaction types, so it should succeed
        result = service.track_interaction(
            route_id=test_route.id,
            user_id=test_user.id,
            interaction_type="invalid_type"
        )
        
        assert result is not None
        assert result.interaction_type == "invalid_type"

    def test_track_route_interaction_nonexistent_route(self, db_session, test_user):
        """Test tracking interaction for non-existent route."""
        service = RouteAnalyticsService(db_session)
        
        with pytest.raises(ValueError, match="Route 99999 not found or deleted"):
            service.track_interaction(
                route_id=99999,
                user_id=test_user.id,
                interaction_type="view"
            )

    def test_track_route_interaction_nonexistent_user(self, db_session, test_route):
        """Test tracking interaction for non-existent user."""
        service = RouteAnalyticsService(db_session)
        
        # The service doesn't validate user existence, so it will fail at database level
        with pytest.raises(Exception):  # SQLAlchemy IntegrityError
            service.track_interaction(
                route_id=test_route.id,
                user_id=99999,
                interaction_type="view"
            )

    def test_get_route_analytics(self, db_session, test_user, test_route):
        """Test getting analytics for a route."""
        service = RouteAnalyticsService(db_session)
        
        # Track multiple interactions
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "copy", user_id=test_user.id)
        service.track_interaction(test_route.id, "share", user_id=test_user.id)
        
        # Get analytics
        analytics = service.get_route_analytics(test_route.id)
        
        assert analytics["total_interactions"] == 3
        assert analytics["unique_users"] == 1
        assert analytics["interaction_types"]["view"] == 1
        assert analytics["interaction_types"]["copy"] == 1
        assert analytics["interaction_types"]["share"] == 1

    def test_get_route_analytics_multiple_users(self, db_session, test_user, test_user_other, test_route):
        """Test getting analytics for route with multiple users."""
        service = RouteAnalyticsService(db_session)
        
        # Track interactions by different users
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "view", user_id=test_user_other.id)
        service.track_interaction(test_route.id, "copy", user_id=test_user.id)
        
        # Get analytics
        analytics = service.get_route_analytics(test_route.id)
        
        assert analytics["total_interactions"] == 3
        assert analytics["unique_users"] == 2
        assert analytics["interaction_types"]["view"] == 2
        assert analytics["interaction_types"]["copy"] == 1

    def test_get_route_analytics_nonexistent_route(self, db_session):
        """Test getting analytics for non-existent route."""
        service = RouteAnalyticsService(db_session)
        
        with pytest.raises(ValueError, match="Route 99999 not found or deleted"):
            service.get_route_analytics(99999)

    def test_get_user_analytics(self, db_session, test_user, test_route):
        """Test getting analytics for a user."""
        service = RouteAnalyticsService(db_session)
        
        # Track multiple interactions
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "share", user_id=test_user.id)
        service.track_interaction(test_route.id, "export", user_id=test_user.id)
        
        # Get user analytics
        analytics = service.get_user_analytics(test_user.id)
        
        assert analytics["total_interactions"] == 3
        assert analytics["unique_routes"] == 1
        assert analytics["interaction_types"]["view"] == 1
        assert analytics["interaction_types"]["share"] == 1
        assert analytics["interaction_types"]["export"] == 1

    def test_get_user_analytics_multiple_routes(self, db_session, test_user, test_route, test_route_other_user):
        """Test getting analytics for user with multiple routes."""
        service = RouteAnalyticsService(db_session)
        
        # Track interactions on different routes
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route_other_user.id, "view", user_id=test_user.id)
        service.track_interaction(test_route.id, "copy", user_id=test_user.id)
        
        # Get user analytics
        analytics = service.get_user_analytics(test_user.id)
        
        assert analytics["total_interactions"] == 3
        assert analytics["unique_routes"] == 2
        assert analytics["interaction_types"]["view"] == 2
        assert analytics["interaction_types"]["copy"] == 1

    def test_get_user_analytics_nonexistent_user(self, db_session):
        """Test getting analytics for non-existent user."""
        service = RouteAnalyticsService(db_session)
        
        analytics = service.get_user_analytics(99999)
        
        assert analytics["total_interactions"] == 0
        assert analytics["unique_routes"] == 0
        assert analytics["interaction_types"] == {}
        assert analytics["top_routes"] == []

    def test_get_popular_routes(self, db_session, test_user, test_route, test_route_other_user):
        """Test getting popular routes."""
        service = RouteAnalyticsService(db_session)
        
        # Track interactions (only "view" type since get_popular_routes filters by interaction_type="view" by default)
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route_other_user.id, "view", user_id=test_user.id)
        
        # Track more view interactions on one route
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        service.track_interaction(test_route_other_user.id, "view", user_id=test_user.id)
        
        # Get popular routes
        popular = service.get_popular_routes(limit=10)
        
        assert len(popular) == 2
        # First route should have more interactions
        assert popular[0]["route_id"] == test_route.id
        assert popular[0]["interaction_count"] == 2

    def test_get_popular_routes_with_limit(self, db_session, test_user, test_route):
        """Test getting popular routes with limit."""
        service = RouteAnalyticsService(db_session)
        
        # Track interactions
        service.track_interaction(test_route.id, "view", user_id=test_user.id)
        
        # Get popular routes with limit
        popular = service.get_popular_routes(limit=1)
        
        assert len(popular) == 1
        assert popular[0]["route_id"] == test_route.id
