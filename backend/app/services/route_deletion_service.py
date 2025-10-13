"""
Dive Route Deletion Service

Handles route deletion rules, permissions, and restrictions.
Implements soft delete with proper validation and migration logic.
"""

from typing import Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import DiveRoute, Dive, User, DiveSite
from app.schemas import RouteDeletionCheck


class RouteDeletionService:
    """Service for handling dive route deletion logic"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def can_delete_route(self, route_id: int, user: User, soft_delete: bool = False) -> RouteDeletionCheck:
        """
        Check if user can delete a route (soft or hard delete) and return detailed information.
        
        Args:
            route_id: ID of the route to check
            user: User attempting to delete
            soft_delete: If True, check for soft delete permission; if False, check for hard delete
            
        Returns:
            RouteDeletionCheck with permission details
        """
        # Get the route
        route = self.db.query(DiveRoute).filter(
            and_(DiveRoute.id == route_id, DiveRoute.deleted_at.is_(None))
        ).first()
        
        if not route:
            return RouteDeletionCheck(
                can_delete=False,
                reason="Route not found or already deleted",
                dives_using_route=0,
                requires_migration=False
            )
        
        # Check if route is already deleted
        if route.is_deleted:
            return RouteDeletionCheck(
                can_delete=False,
                reason="Route is already deleted",
                dives_using_route=0,
                requires_migration=False
            )
        
        # Count total dives using this route
        total_dives = self.db.query(Dive).filter(
            Dive.selected_route_id == route_id
        ).count()
        
        # Count dives by OTHER users (not the route creator)
        other_users_dives = self.db.query(Dive).filter(
            and_(
                Dive.selected_route_id == route_id,
                Dive.user_id != route.created_by
            )
        ).count()
        
        # Check basic permissions
        can_delete, reason = self._check_deletion_permissions(route, user)
        
        # For soft delete, allow if user has permission (regardless of other users' dives)
        if soft_delete:
            return RouteDeletionCheck(
                can_delete=can_delete,
                reason=reason,
                dives_using_route=total_dives,
                requires_migration=False
            )
        
        # For hard delete, prevent if other users' dives are using it
        if other_users_dives > 0 and not user.is_admin:
            return RouteDeletionCheck(
                can_delete=False,
                reason=f"Cannot delete route - {other_users_dives} dives by other users are using this route. Use soft delete (hide) instead.",
                dives_using_route=total_dives,
                requires_migration=False
            )
        
        # Hard delete allowed for creator's own dives or admin
        return RouteDeletionCheck(
            can_delete=can_delete and (other_users_dives == 0 or user.is_admin),
            reason=reason,
            dives_using_route=total_dives,
            requires_migration=total_dives > 0 and (other_users_dives == 0 or user.is_admin)
        )
    
    def _check_deletion_permissions(self, route: DiveRoute, user: User) -> Tuple[bool, str]:
        """
        Check if user has permission to delete the route.
        
        Args:
            route: Route to check
            user: User attempting deletion
            
        Returns:
            Tuple of (can_delete, reason)
        """
        # Creator can always delete their own routes
        if route.created_by == user.id:
            return True, "Route creator"
        
        # Admins can always delete
        if user.is_admin:
            return True, "Admin"
        
        # Moderators can delete routes on sites they moderate
        if user.is_moderator:
            # Check if user can moderate this dive site
            dive_site = self.db.query(DiveSite).filter(DiveSite.id == route.dive_site_id).first()
            if dive_site and dive_site.created_by == user.id:
                return True, "Site moderator"
        
        return False, "Insufficient permissions"
    
    def soft_delete_route(self, route_id: int, user: User) -> bool:
        """
        Soft delete (hide) a route - can be done even if other users' dives use it.
        
        Args:
            route_id: ID of route to hide
            user: User performing deletion
            
        Returns:
            True if successful, False otherwise
        """
        # Check permissions for soft delete
        deletion_check = self.can_delete_route(route_id, user, soft_delete=True)
        if not deletion_check.can_delete:
            return False
        
        # Get the route
        route = self.db.query(DiveRoute).filter(
            and_(DiveRoute.id == route_id, DiveRoute.deleted_at.is_(None))
        ).first()
        
        if not route:
            return False
        
        # Perform soft delete (no migration needed - dives keep their references)
        route.soft_delete(user.id)
        self.db.commit()
        
        return True
    
    def hard_delete_route(self, route_id: int, user: User, migrate_to_route_id: Optional[int] = None) -> bool:
        """
        Hard delete (permanently remove) a route with optional migration of associated dives.
        Only allowed if no other users' dives are using the route.
        
        Args:
            route_id: ID of route to delete
            user: User performing deletion
            migrate_to_route_id: Optional route ID to migrate dives to
            
        Returns:
            True if successful, False otherwise
        """
        # Check permissions for hard delete
        deletion_check = self.can_delete_route(route_id, user, soft_delete=False)
        if not deletion_check.can_delete:
            return False
        
        # Get the route
        route = self.db.query(DiveRoute).filter(
            and_(DiveRoute.id == route_id, DiveRoute.deleted_at.is_(None))
        ).first()
        
        if not route:
            return False
        
        # Handle migration if dives are using this route
        if deletion_check.dives_using_route > 0:
            if migrate_to_route_id:
                # Migrate dives to new route
                self._migrate_dives_to_route(route_id, migrate_to_route_id)
            else:
                # Unlink all dives from this route
                self._unlink_dives_from_route(route_id)
        
        # Perform soft delete (we still use soft delete for audit trail)
        route.soft_delete(user.id)
        self.db.commit()
        
        return True
    
    def _migrate_dives_to_route(self, from_route_id: int, to_route_id: int) -> None:
        """Migrate all dives from one route to another"""
        # Verify target route exists and is not deleted
        target_route = self.db.query(DiveRoute).filter(
            and_(DiveRoute.id == to_route_id, DiveRoute.deleted_at.is_(None))
        ).first()
        
        if not target_route:
            raise ValueError("Target route not found or deleted")
        
        # Update all dives using the old route
        self.db.query(Dive).filter(
            Dive.selected_route_id == from_route_id
        ).update({"selected_route_id": to_route_id})
    
    def _unlink_dives_from_route(self, route_id: int) -> None:
        """Unlink all dives from a route (set selected_route_id to NULL)"""
        self.db.query(Dive).filter(
            Dive.selected_route_id == route_id
        ).update({"selected_route_id": None})
    
    def restore_route(self, route_id: int, user: User) -> bool:
        """
        Restore a soft-deleted route.
        
        Args:
            route_id: ID of route to restore
            user: User attempting restoration
            
        Returns:
            True if successful, False otherwise
        """
        # Only admins and the original creator can restore routes
        route = self.db.query(DiveRoute).filter(DiveRoute.id == route_id).first()
        
        if not route or not route.is_deleted:
            return False
        
        if route.created_by != user.id and not user.is_admin:
            return False
        
        # Restore the route
        route.restore()
        self.db.commit()
        
        return True
    
    def get_routes_for_deletion_check(self, dive_site_id: int) -> list:
        """
        Get all active routes for a dive site (for migration selection).
        
        Args:
            dive_site_id: ID of the dive site
            
        Returns:
            List of active routes
        """
        return self.db.query(DiveRoute).filter(
            and_(
                DiveRoute.dive_site_id == dive_site_id,
                DiveRoute.deleted_at.is_(None)
            )
        ).all()
