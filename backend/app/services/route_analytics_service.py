"""
Route Analytics Service

Handles tracking and analysis of user interactions with dive routes.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from app.models import RouteAnalytics, DiveRoute, User, Dive


class RouteAnalyticsService:
    """Service for managing route analytics and usage tracking"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def track_interaction(
        self,
        route_id: int,
        interaction_type: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        referrer: Optional[str] = None,
        session_id: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> RouteAnalytics:
        """Track a user interaction with a route"""
        
        # Verify route exists and is not deleted
        route = self.db.query(DiveRoute).filter(
            and_(
                DiveRoute.id == route_id,
                DiveRoute.deleted_at.is_(None)
            )
        ).first()
        
        if not route:
            raise ValueError(f"Route {route_id} not found or deleted")
        
        # Create analytics record
        analytics = RouteAnalytics(
            route_id=route_id,
            user_id=user_id,
            interaction_type=interaction_type,
            ip_address=ip_address,
            user_agent=user_agent,
            referrer=referrer,
            session_id=session_id,
            extra_data=extra_data
        )
        
        self.db.add(analytics)
        self.db.commit()
        self.db.refresh(analytics)
        
        return analytics
    
    def get_route_analytics(
        self,
        route_id: int,
        days: int = 30,
        interaction_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get analytics data for a specific route"""
        
        # Verify route exists
        route = self.db.query(DiveRoute).filter(
            and_(
                DiveRoute.id == route_id,
                DiveRoute.deleted_at.is_(None)
            )
        ).first()
        
        if not route:
            raise ValueError(f"Route {route_id} not found or deleted")
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Base query
        query = self.db.query(RouteAnalytics).filter(
            and_(
                RouteAnalytics.route_id == route_id,
                RouteAnalytics.created_at >= start_date,
                RouteAnalytics.created_at <= end_date
            )
        )
        
        # Filter by interaction types if specified
        if interaction_types:
            query = query.filter(RouteAnalytics.interaction_type.in_(interaction_types))
        
        analytics_data = query.all()
        
        # Calculate metrics
        total_interactions = len(analytics_data)
        unique_users = len(set(a.user_id for a in analytics_data if a.user_id))
        unique_sessions = len(set(a.session_id for a in analytics_data if a.session_id))
        
        # Group by interaction type
        interaction_counts = {}
        for analytics in analytics_data:
            interaction_type = analytics.interaction_type
            interaction_counts[interaction_type] = interaction_counts.get(interaction_type, 0) + 1
        
        # Group by day for time series
        daily_counts = {}
        for analytics in analytics_data:
            day = analytics.created_at.date()
            daily_counts[day] = daily_counts.get(day, 0) + 1
        
        # Get top referrers
        referrer_counts = {}
        for analytics in analytics_data:
            if analytics.referrer:
                referrer_counts[analytics.referrer] = referrer_counts.get(analytics.referrer, 0) + 1
        
        return {
            "route_id": route_id,
            "route_name": route.name,
            "period_days": days,
            "total_interactions": total_interactions,
            "unique_users": unique_users,
            "unique_sessions": unique_sessions,
            "interaction_types": interaction_counts,
            "daily_counts": {str(k): v for k, v in daily_counts.items()},
            "top_referrers": dict(sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def get_popular_routes(
        self,
        limit: int = 10,
        days: int = 30,
        interaction_type: str = "view"
    ) -> List[Dict[str, Any]]:
        """Get most popular routes based on analytics"""
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query for route popularity
        popularity_query = self.db.query(
            RouteAnalytics.route_id,
            func.count(RouteAnalytics.id).label('interaction_count'),
            func.count(func.distinct(RouteAnalytics.user_id)).label('unique_users'),
            func.count(func.distinct(RouteAnalytics.session_id)).label('unique_sessions')
        ).filter(
            and_(
                RouteAnalytics.interaction_type == interaction_type,
                RouteAnalytics.created_at >= start_date,
                RouteAnalytics.created_at <= end_date
            )
        ).group_by(RouteAnalytics.route_id).subquery()
        
        # Join with route data
        routes_query = self.db.query(DiveRoute).join(
            popularity_query, DiveRoute.id == popularity_query.c.route_id
        ).filter(
            DiveRoute.deleted_at.is_(None)
        ).order_by(
            desc(popularity_query.c.interaction_count)
        ).limit(limit)
        
        routes = routes_query.all()
        
        # Format results
        results = []
        for route in routes:
            # Get popularity data
            popularity_data = self.db.query(popularity_query).filter(
                popularity_query.c.route_id == route.id
            ).first()
            
            results.append({
                "route_id": route.id,
                "route_name": route.name,
                "route_type": route.route_type.value,
                "dive_site_id": route.dive_site_id,
                "interaction_count": popularity_data.interaction_count,
                "unique_users": popularity_data.unique_users,
                "unique_sessions": popularity_data.unique_sessions,
                "created_at": route.created_at.isoformat(),
                "creator_username": route.creator.username if route.creator else "Unknown"
            })
        
        return results
    
    def get_user_analytics(
        self,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get analytics for a specific user's route interactions"""
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get user's interactions
        interactions = self.db.query(RouteAnalytics).filter(
            and_(
                RouteAnalytics.user_id == user_id,
                RouteAnalytics.created_at >= start_date,
                RouteAnalytics.created_at <= end_date
            )
        ).all()
        
        # Calculate metrics
        total_interactions = len(interactions)
        unique_routes = len(set(i.route_id for i in interactions))
        
        # Group by interaction type
        interaction_counts = {}
        for interaction in interactions:
            interaction_type = interaction.interaction_type
            interaction_counts[interaction_type] = interaction_counts.get(interaction_type, 0) + 1
        
        # Get most interacted routes
        route_counts = {}
        for interaction in interactions:
            route_counts[interaction.route_id] = route_counts.get(interaction.route_id, 0) + 1
        
        # Get route details for top routes
        top_route_ids = sorted(route_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        top_routes = []
        for route_id, count in top_route_ids:
            route = self.db.query(DiveRoute).filter(DiveRoute.id == route_id).first()
            if route:
                top_routes.append({
                    "route_id": route.id,
                    "route_name": route.name,
                    "interaction_count": count
                })
        
        return {
            "user_id": user_id,
            "period_days": days,
            "total_interactions": total_interactions,
            "unique_routes": unique_routes,
            "interaction_types": interaction_counts,
            "top_routes": top_routes,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def get_system_analytics(
        self,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get system-wide analytics for all routes"""
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get all interactions in period
        interactions = self.db.query(RouteAnalytics).filter(
            and_(
                RouteAnalytics.created_at >= start_date,
                RouteAnalytics.created_at <= end_date
            )
        ).all()
        
        # Calculate metrics
        total_interactions = len(interactions)
        unique_users = len(set(i.user_id for i in interactions if i.user_id))
        unique_routes = len(set(i.route_id for i in interactions))
        unique_sessions = len(set(i.session_id for i in interactions if i.session_id))
        
        # Group by interaction type
        interaction_counts = {}
        for interaction in interactions:
            interaction_type = interaction.interaction_type
            interaction_counts[interaction_type] = interaction_counts.get(interaction_type, 0) + 1
        
        # Get total routes count
        total_routes = self.db.query(DiveRoute).filter(DiveRoute.deleted_at.is_(None)).count()
        
        # Get total users count
        total_users = self.db.query(User).count()
        
        return {
            "period_days": days,
            "total_interactions": total_interactions,
            "unique_users": unique_users,
            "unique_routes": unique_routes,
            "unique_sessions": unique_sessions,
            "total_routes": total_routes,
            "total_users": total_users,
            "interaction_types": interaction_counts,
            "generated_at": datetime.utcnow().isoformat()
        }
