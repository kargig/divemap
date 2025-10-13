"""
Tests for RouteDeletionService
"""

import pytest
from datetime import datetime

from app.models import DiveRoute, Dive, User, DiveSite
from app.services.route_deletion_service import RouteDeletionService


class TestRouteDeletionService:
    """Test cases for RouteDeletionService"""

    def test_soft_delete_route_success(self, db_session, test_user, test_route):
        """Test successful soft deletion of a route."""
        service = RouteDeletionService(db_session)
        
        result = service.soft_delete_route(test_route.id, test_user)
        
        assert result is True
        
        # Verify route is soft deleted
        db_session.refresh(test_route)
        assert test_route.deleted_at is not None
        assert test_route.deleted_by == test_user.id

    def test_soft_delete_route_not_found(self, db_session, test_user):
        """Test soft deletion of non-existent route."""
        service = RouteDeletionService(db_session)
        
        result = service.soft_delete_route(99999, test_user)
        
        assert result is False

    def test_soft_delete_route_permission_denied(self, db_session, test_user, test_route_other_user):
        """Test soft deletion without permission."""
        service = RouteDeletionService(db_session)
        
        result = service.soft_delete_route(test_route_other_user.id, test_user)
        
        assert result is False

    def test_hard_delete_route_success(self, db_session, test_user, test_route):
        """Test successful hard deletion of a route."""
        service = RouteDeletionService(db_session)
        
        result = service.hard_delete_route(test_route.id, test_user)
        
        assert result is True
        
        # Verify route is soft deleted (hard delete actually does soft delete)
        db_session.refresh(test_route)
        assert test_route.deleted_at is not None
        assert test_route.deleted_by == test_user.id

    def test_hard_delete_route_with_associated_dives(self, db_session, test_user, test_route, test_dive_with_route):
        """Test hard deletion of route with associated dives."""
        service = RouteDeletionService(db_session)
        
        result = service.hard_delete_route(test_route.id, test_user)
        
        assert result is True
        
        # Verify route is soft deleted
        db_session.refresh(test_route)
        assert test_route.deleted_at is not None

    def test_hard_delete_route_with_other_users_dives(self, db_session, test_user, test_route, test_user_other):
        """Test hard deletion of route with dives by other users."""
        # Create a dive by another user using the route
        dive = Dive(
            user_id=test_user_other.id,
            dive_site_id=test_route.dive_site_id,
            selected_route_id=test_route.id,
            name="Other User Dive",
            dive_date=datetime.now().date(),
            max_depth=15.0,
            duration=30
        )
        db_session.add(dive)
        db_session.commit()
        
        service = RouteDeletionService(db_session)
        
        result = service.hard_delete_route(test_route.id, test_user)
        
        assert result is False

    def test_hard_delete_route_admin_override(self, db_session, test_admin_user, test_route, test_dive_with_route):
        """Test admin can hard delete route with associated dives."""
        service = RouteDeletionService(db_session)
        
        result = service.hard_delete_route(test_route.id, test_admin_user)
        
        assert result is True
        
        # Verify route is soft deleted
        db_session.refresh(test_route)
        assert test_route.deleted_at is not None

    def test_migrate_dives_to_alternative_route(self, db_session, test_user, test_route, test_route_other_user, test_dive_with_route):
        """Test migrating dives to alternative route before deletion."""
        service = RouteDeletionService(db_session)
        
        # Test hard delete with migration
        result = service.hard_delete_route(test_route.id, test_user, migrate_to_route_id=test_route_other_user.id)
        
        assert result is True
        
        # Verify route is soft deleted
        db_session.refresh(test_route)
        assert test_route.deleted_at is not None
        
        # Verify dive was migrated to alternative route
        db_session.refresh(test_dive_with_route)
        assert test_dive_with_route.selected_route_id == test_route_other_user.id

    def test_get_route_usage_stats(self, db_session, test_user, test_route, test_dive_with_route):
        """Test getting route usage statistics via can_delete_route."""
        service = RouteDeletionService(db_session)
        
        # Use can_delete_route to get usage stats
        deletion_check = service.can_delete_route(test_route.id, test_user, soft_delete=False)
        
        assert deletion_check.dives_using_route == 1
        assert deletion_check.can_delete is True

    def test_get_route_usage_stats_with_other_users(self, db_session, test_user, test_route, test_user_other):
        """Test getting route usage stats with other users' dives."""
        # Create dive by another user
        dive = Dive(
            user_id=test_user_other.id,
            dive_site_id=test_route.dive_site_id,
            selected_route_id=test_route.id,
            name="Other User Dive",
            dive_date=datetime.now().date(),
            max_depth=15.0,
            duration=30
        )
        db_session.add(dive)
        db_session.commit()
        
        service = RouteDeletionService(db_session)
        
        # Use can_delete_route to get usage stats
        deletion_check = service.can_delete_route(test_route.id, test_user, soft_delete=False)
        
        assert deletion_check.dives_using_route == 1
        assert deletion_check.can_delete is False

    def test_restore_soft_deleted_route(self, db_session, test_user, test_route):
        """Test restoring a soft-deleted route."""
        # First soft delete the route
        test_route.soft_delete(test_user.id)
        db_session.commit()
        
        service = RouteDeletionService(db_session)
        
        result = service.restore_route(test_route.id, test_user)
        
        assert result is True
        
        # Verify route is restored
        db_session.refresh(test_route)
        assert test_route.deleted_at is None

    def test_restore_route_not_found(self, db_session, test_user):
        """Test restoring non-existent route."""
        service = RouteDeletionService(db_session)
        
        result = service.restore_route(99999, test_user)
        
        assert result is False

    def test_restore_route_permission_denied(self, db_session, test_user, test_route_other_user):
        """Test restoring route by non-owner."""
        # Soft delete the route
        test_route_other_user.soft_delete(test_route_other_user.created_by)
        db_session.commit()
        
        service = RouteDeletionService(db_session)
        
        result = service.restore_route(test_route_other_user.id, test_user)
        
        assert result is False