"""
Notification Service

Core service for creating and managing notifications.
Handles user preference matching, area filtering, and email queuing via SQS.
"""

import math
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models import (
    User, Notification, NotificationPreference, DiveSite, Dive, DivingCenter, ParsedDiveTrip
)
from app.services.sqs_service import SQSService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the distance between two points using the Haversine formula.
    Returns distance in kilometers.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r


class NotificationService:
    """Service for creating and managing notifications."""
    
    def __init__(self):
        """Initialize notification service with AWS services."""
        self.sqs_service = SQSService()
        self.email_service = EmailService()
    
    def create_notification(
        self,
        user_id: int,
        category: str,
        title: str,
        message: str,
        link_url: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        db: Session = None
    ) -> Optional[Notification]:
        """
        Create a notification record for a user.
        
        Args:
            user_id: User ID to notify
            category: Notification category
            title: Notification title
            message: Notification message
            link_url: Optional URL to related content
            entity_type: Optional entity type ('dive_site', 'dive', 'diving_center', 'dive_trip')
            entity_id: Optional entity ID
            db: Database session
        
        Returns:
            Notification instance or None if creation failed
        """
        try:
            notification = Notification(
                user_id=user_id,
                category=category,
                title=title,
                message=message,
                link_url=link_url,
                entity_type=entity_type,
                entity_id=entity_id,
                is_read=False,
                email_sent=False
            )
            
            db.add(notification)
            db.commit()
            db.refresh(notification)
            
            logger.info(f"Created notification {notification.id} for user {user_id}")
            return notification
            
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            db.rollback()
            return None
    
    def _get_entity_location(self, entity_type: str, entity_id: int, db: Session) -> Optional[Dict[str, float]]:
        """Get latitude/longitude for an entity."""
        try:
            if entity_type == 'dive_site':
                entity = db.query(DiveSite).filter(DiveSite.id == entity_id).first()
                if entity and entity.latitude and entity.longitude:
                    return {'lat': float(entity.latitude), 'lng': float(entity.longitude)}
            
            elif entity_type == 'diving_center':
                entity = db.query(DivingCenter).filter(DivingCenter.id == entity_id).first()
                if entity and entity.location:
                    # DivingCenter uses ST_Point, need to extract lat/lng
                    from sqlalchemy import text
                    result = db.execute(
                        text("SELECT ST_Y(location) as lat, ST_X(location) as lng FROM diving_centers WHERE id = :id"),
                        {'id': entity_id}
                    ).first()
                    if result:
                        return {'lat': float(result.lat), 'lng': float(result.lng)}
            
            elif entity_type == 'dive':
                entity = db.query(Dive).filter(Dive.id == entity_id).first()
                if entity and entity.dive_site_id:
                    dive_site = db.query(DiveSite).filter(DiveSite.id == entity.dive_site_id).first()
                    if dive_site and dive_site.latitude and dive_site.longitude:
                        return {'lat': float(dive_site.latitude), 'lng': float(dive_site.longitude)}
            
            elif entity_type == 'dive_trip':
                entity = db.query(ParsedDiveTrip).filter(ParsedDiveTrip.id == entity_id).first()
                if entity and entity.diving_center_id:
                    center = db.query(DivingCenter).filter(DivingCenter.id == entity.diving_center_id).first()
                    if center and center.location:
                        from sqlalchemy import text
                        result = db.execute(
                            text("SELECT ST_Y(location) as lat, ST_X(location) as lng FROM diving_centers WHERE id = :id"),
                            {'id': entity.diving_center_id}
                        ).first()
                        if result:
                            return {'lat': float(result.lat), 'lng': float(result.lng)}
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting entity location: {e}")
            return None
    
    def _matches_area_filter(
        self,
        preference: NotificationPreference,
        entity_location: Optional[Dict[str, float]],
        entity_country: Optional[str] = None,
        entity_region: Optional[str] = None
    ) -> bool:
        """
        Check if notification matches user's area filter preference.
        
        Args:
            preference: NotificationPreference instance
            entity_location: Dict with 'lat' and 'lng' keys
            entity_country: Optional country name
            entity_region: Optional region name
        
        Returns:
            True if matches area filter, False otherwise
        """
        area_filter = preference.area_filter
        if not area_filter:
            # No area filter means notify for all areas
            return True
        
        # Check country filter
        if 'country' in area_filter and area_filter['country']:
            if entity_country != area_filter['country']:
                return False
        
        # Check region filter
        if 'region' in area_filter and area_filter['region']:
            if entity_region != area_filter['region']:
                return False
        
        # Check radius filter (requires location)
        if 'radius_km' in area_filter and area_filter['radius_km'] and entity_location:
            if 'center_lat' in area_filter and 'center_lng' in area_filter:
                distance = calculate_distance(
                    area_filter['center_lat'],
                    area_filter['center_lng'],
                    entity_location['lat'],
                    entity_location['lng']
                )
                if distance > area_filter['radius_km']:
                    return False
        
        return True
    
    def _get_users_to_notify(
        self,
        category: str,
        entity_location: Optional[Dict[str, float]] = None,
        entity_country: Optional[str] = None,
        entity_region: Optional[str] = None,
        db: Session = None
    ) -> List[User]:
        """
        Get list of users who should receive notifications for this category.
        
        Args:
            category: Notification category
            entity_location: Optional entity location dict
            entity_country: Optional country name
            entity_region: Optional region name
            db: Database session
        
        Returns:
            List of User instances
        """
        # Get all preferences for this category with website or email enabled
        preferences = db.query(NotificationPreference).filter(
            NotificationPreference.category == category,
            or_(
                NotificationPreference.enable_website == True,
                NotificationPreference.enable_email == True
            )
        ).all()
        
        logger.debug(f"Found {len(preferences)} notification preferences for category '{category}'")
        
        users_to_notify = []
        for preference in preferences:
            # Check area filter
            if not self._matches_area_filter(preference, entity_location, entity_country, entity_region):
                logger.debug(f"Preference {preference.id} (user_id={preference.user_id}) filtered out by area filter")
                continue
            
            # Get user
            user = db.query(User).filter(User.id == preference.user_id).first()
            if user and user.enabled:
                users_to_notify.append(user)
            elif not user:
                logger.warning(f"Preference {preference.id} references non-existent user_id={preference.user_id}")
            elif not user.enabled:
                logger.debug(f"User {preference.user_id} is disabled, skipping notification")
        
        logger.debug(f"Returning {len(users_to_notify)} users to notify for category '{category}'")
        return users_to_notify
    
    def _queue_email_notification(
        self,
        notification: Notification,
        user: User,
        template_name: str
    ) -> bool:
        """Queue email notification via SQS."""
        notification_data = {
            'title': notification.title,
            'message': notification.message,
            'link_url': notification.link_url,
            'category': notification.category
        }
        
        return self.sqs_service.send_email_task(
            notification_id=notification.id,
            user_email=user.email,
            notification_data=notification_data
        )
    
    async def notify_users_for_new_dive_site(self, dive_site_id: int, db: Session) -> int:
        """
        Notify users about a new dive site.
        
        Args:
            dive_site_id: Dive site ID
            db: Database session
        
        Returns:
            Number of notifications created
        """
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
        if not dive_site:
            logger.error(f"Dive site {dive_site_id} not found")
            return 0
        
        # Get entity location
        entity_location = None
        if dive_site.latitude and dive_site.longitude:
            entity_location = {'lat': float(dive_site.latitude), 'lng': float(dive_site.longitude)}
        
        # Get users to notify
        users = self._get_users_to_notify(
            category='new_dive_sites',
            entity_location=entity_location,
            entity_country=dive_site.country,
            entity_region=dive_site.region,
            db=db
        )
        
        # Exclude the creator from notifications (they don't need to be notified about their own creation)
        creator_id = dive_site.created_by
        if creator_id:
            users = [user for user in users if user.id != creator_id]
        
        # Create notifications
        notification_count = 0
        for user in users:
            # Get user's preference
            preference = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == 'new_dive_sites'
            ).first()
            
            if not preference:
                continue
            
            # Create notification
            link_url = f"/dive-sites/{dive_site_id}"
            notification = self.create_notification(
                user_id=user.id,
                category='new_dive_sites',
                title=f"New Dive Site: {dive_site.name}",
                message=f"A new dive site '{dive_site.name}' has been added.",
                link_url=link_url,
                entity_type='dive_site',
                entity_id=dive_site_id,
                db=db
            )
            
            if notification:
                notification_count += 1
                
                # Queue email if enabled and frequency is immediate
                if preference.enable_email and preference.frequency == 'immediate':
                    self._queue_email_notification(notification, user, 'new_dive_site')
        
        logger.info(f"Created {notification_count} notifications for dive site {dive_site_id}")
        return notification_count
    
    async def notify_users_for_new_dive(self, dive_id: int, db: Session) -> int:
        """Notify users about a new dive."""
        dive = db.query(Dive).filter(Dive.id == dive_id).first()
        if not dive:
            logger.error(f"Dive {dive_id} not found")
            return 0
        
        # Get dive site location
        entity_location = None
        if dive.dive_site_id:
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if dive_site and dive_site.latitude and dive_site.longitude:
                entity_location = {'lat': float(dive_site.latitude), 'lng': float(dive_site.longitude)}
        
        users = self._get_users_to_notify(
            category='new_dives',
            entity_location=entity_location,
            db=db
        )
        
        # Exclude the creator from notifications (they don't need to be notified about their own dive)
        creator_id = dive.user_id
        if creator_id:
            users = [user for user in users if user.id != creator_id]
        
        notification_count = 0
        for user in users:
            preference = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == 'new_dives'
            ).first()
            
            if not preference:
                continue
            
            link_url = f"/dives/{dive_id}"
            notification = self.create_notification(
                user_id=user.id,
                category='new_dives',
                title=f"New Dive: {dive.name or 'Untitled Dive'}",
                message=f"A new dive has been logged.",
                link_url=link_url,
                entity_type='dive',
                entity_id=dive_id,
                db=db
            )
            
            if notification:
                notification_count += 1
                if preference.enable_email and preference.frequency == 'immediate':
                    self._queue_email_notification(notification, user, 'new_dive')
        
        return notification_count
    
    async def notify_users_for_new_diving_center(self, center_id: int, db: Session) -> int:
        """Notify users about a new diving center."""
        center = db.query(DivingCenter).filter(DivingCenter.id == center_id).first()
        if not center:
            logger.error(f"Diving center {center_id} not found")
            return 0
        
        # Get center location
        entity_location = None
        if center.location:
            from sqlalchemy import text
            result = db.execute(
                text("SELECT ST_Y(location) as lat, ST_X(location) as lng FROM diving_centers WHERE id = :id"),
                {'id': center_id}
            ).first()
            if result:
                entity_location = {'lat': float(result.lat), 'lng': float(result.lng)}
        
        users = self._get_users_to_notify(
            category='new_diving_centers',
            entity_location=entity_location,
            entity_country=center.country,
            entity_region=center.region,
            db=db
        )
        
        # Exclude the owner from notifications (they don't need to be notified about their own center)
        owner_id = center.owner_id
        if owner_id:
            users = [user for user in users if user.id != owner_id]
        
        notification_count = 0
        for user in users:
            preference = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == 'new_diving_centers'
            ).first()
            
            if not preference:
                continue
            
            link_url = f"/diving-centers/{center_id}"
            notification = self.create_notification(
                user_id=user.id,
                category='new_diving_centers',
                title=f"New Diving Center: {center.name}",
                message=f"A new diving center '{center.name}' has been added.",
                link_url=link_url,
                entity_type='diving_center',
                entity_id=center_id,
                db=db
            )
            
            if notification:
                notification_count += 1
                if preference.enable_email and preference.frequency == 'immediate':
                    self._queue_email_notification(notification, user, 'new_diving_center')
        
        return notification_count
    
    async def notify_users_for_new_dive_trip(self, trip_id: int, db: Session) -> int:
        """Notify users about a new dive trip."""
        trip = db.query(ParsedDiveTrip).filter(ParsedDiveTrip.id == trip_id).first()
        if not trip:
            logger.error(f"Dive trip {trip_id} not found")
            return 0
        
        # Get center location
        entity_location = None
        if trip.diving_center_id:
            from sqlalchemy import text
            result = db.execute(
                text("SELECT ST_Y(location) as lat, ST_X(location) as lng FROM diving_centers WHERE id = :id"),
                {'id': trip.diving_center_id}
            ).first()
            if result:
                entity_location = {'lat': float(result.lat), 'lng': float(result.lng)}
        
        users = self._get_users_to_notify(
            category='new_dive_trips',
            entity_location=entity_location,
            db=db
        )
        
        # Exclude the diving center owner from notifications (they don't need to be notified about their own trips)
        if trip.diving_center_id:
            diving_center = db.query(DivingCenter).filter(DivingCenter.id == trip.diving_center_id).first()
            if diving_center and diving_center.owner_id:
                users = [user for user in users if user.id != diving_center.owner_id]
        
        notification_count = 0
        for user in users:
            preference = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user.id,
                NotificationPreference.category == 'new_dive_trips'
            ).first()
            
            if not preference:
                continue
            
            link_url = f"/dive-trips/{trip_id}"
            notification = self.create_notification(
                user_id=user.id,
                category='new_dive_trips',
                title=f"New Dive Trip: {trip.title or 'Untitled Trip'}",
                message=f"A new dive trip has been posted.",
                link_url=link_url,
                entity_type='dive_trip',
                entity_id=trip_id,
                db=db
            )
            
            if notification:
                notification_count += 1
                if preference.enable_email and preference.frequency == 'immediate':
                    self._queue_email_notification(notification, user, 'new_dive_trip')
        
        return notification_count
