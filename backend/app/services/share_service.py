"""
Share Service

Handles generation of shareable content for dives, dive sites, and dive routes.
Provides platform-specific share URLs and metadata.
"""

from typing import Dict, Optional, Any
from datetime import datetime
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from fastapi import Request

from app.models import Dive, DiveSite, DiveRoute, User


class ShareService:
    """Service for generating shareable content and URLs"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_share_url(
        self,
        entity_type: str,
        entity_id: int,
        request: Request,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a shareable URL for an entity.
        
        Args:
            entity_type: Type of entity ('dive', 'dive-site', 'route')
            entity_id: ID of the entity
            request: FastAPI request object for getting base URL
            additional_params: Additional URL parameters
            
        Returns:
            Shareable URL string
        """
        # Get base URL from request
        host = request.headers.get("host", "localhost")
        scheme = "https" if request.headers.get("x-forwarded-proto") == "https" else "http"
        base_url = f"{scheme}://{host}"
        
        # Build entity-specific path
        if entity_type == "dive":
            path = f"/dives/{entity_id}"
        elif entity_type == "dive-site":
            path = f"/dive-sites/{entity_id}"
        elif entity_type == "route":
            # Routes need dive_site_id
            route = self.db.query(DiveRoute).filter(DiveRoute.id == entity_id).first()
            if route and route.dive_site_id:
                path = f"/dive-sites/{route.dive_site_id}/route/{entity_id}"
            else:
                path = f"/routes/{entity_id}"
        else:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        # Add query parameters if provided
        query_string = ""
        if additional_params:
            params = {k: v for k, v in additional_params.items() if v is not None and k != 'dive_site_id'}
            if params:
                query_string = "?" + urlencode(params)
        
        return f"{base_url}{path}{query_string}"
    
    def get_entity_data(
        self,
        entity_type: str,
        entity_id: int,
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        """
        Get entity data for sharing.
        
        Args:
            entity_type: Type of entity
            entity_id: ID of the entity
            current_user: Optional current user for permission checks
            
        Returns:
            Dictionary with entity data
        """
        if entity_type == "dive":
            return self._get_dive_data(entity_id, current_user)
        elif entity_type == "dive-site":
            return self._get_dive_site_data(entity_id)
        elif entity_type == "route":
            return self._get_route_data(entity_id)
        else:
            raise ValueError(f"Unknown entity type: {entity_type}")
    
    def _get_dive_data(self, dive_id: int, current_user: Optional[User] = None) -> Dict[str, Any]:
        """Get dive data for sharing"""
        dive = self.db.query(Dive).filter(Dive.id == dive_id).first()
        
        if not dive:
            raise ValueError(f"Dive {dive_id} not found")
        
        # Check privacy - private dives can only be shared by owner
        if dive.is_private:
            if not current_user or (current_user.id != dive.user_id and not current_user.is_admin):
                raise PermissionError("Cannot share private dive")
        
        # Get dive site info if available
        dive_site_info = None
        if dive.dive_site_id:
            dive_site = self.db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if dive_site:
                dive_site_info = {
                    "id": dive_site.id,
                    "name": dive_site.name,
                    "country": dive_site.country,
                    "region": dive_site.region
                }
        
        return {
            "id": dive.id,
            "name": dive.name,
            "dive_information": dive.dive_information,
            "dive_date": dive.dive_date.isoformat() if dive.dive_date else None,
            "max_depth": float(dive.max_depth) if dive.max_depth else None,
            "duration": dive.duration,
            "user_rating": dive.user_rating,
            "visibility_rating": dive.visibility_rating,
            "dive_site": dive_site_info,
            "is_private": dive.is_private
        }
    
    def _get_dive_site_data(self, dive_site_id: int) -> Dict[str, Any]:
        """Get dive site data for sharing"""
        dive_site = self.db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
        
        if not dive_site:
            raise ValueError(f"Dive site {dive_site_id} not found")
        
        return {
            "id": dive_site.id,
            "name": dive_site.name,
            "description": dive_site.description,
            "country": dive_site.country,
            "region": dive_site.region,
            "max_depth": float(dive_site.max_depth) if dive_site.max_depth else None,
            "difficulty_code": dive_site.difficulty.code if dive_site.difficulty else None,
            "difficulty_label": dive_site.difficulty.label if dive_site.difficulty else None,
            "average_rating": None  # Would need to calculate from ratings
        }
    
    def _get_route_data(self, route_id: int) -> Dict[str, Any]:
        """Get route data for sharing"""
        route = self.db.query(DiveRoute).filter(
            DiveRoute.id == route_id,
            DiveRoute.deleted_at.is_(None)
        ).first()
        
        if not route:
            raise ValueError(f"Route {route_id} not found")
        
        # Get dive site info
        dive_site_info = None
        if route.dive_site_id:
            dive_site = self.db.query(DiveSite).filter(DiveSite.id == route.dive_site_id).first()
            if dive_site:
                dive_site_info = {
                    "id": dive_site.id,
                    "name": dive_site.name
                }
        
        return {
            "id": route.id,
            "name": route.name,
            "description": route.description,
            "route_type": route.route_type,
            "dive_site_id": route.dive_site_id,
            "dive_site": dive_site_info
        }
    
    def format_share_content(
        self,
        entity_type: str,
        entity_data: Dict[str, Any],
        platform: str = "generic"
    ) -> Dict[str, str]:
        """
        Format share content for different platforms.
        
        Args:
            entity_type: Type of entity
            entity_data: Entity data dictionary
            platform: Target platform ('twitter', 'facebook', 'whatsapp', etc.)
            
        Returns:
            Dictionary with formatted title and description
        """
        title = ""
        description = ""
        
        if entity_type == "dive":
            title = entity_data.get("name") or (
                f"{entity_data.get('dive_site', {}).get('name', 'Dive')} - "
                f"{entity_data.get('dive_date', '')[:10] if entity_data.get('dive_date') else ''}"
            ).strip("- ")
            
            desc_parts = []
            if entity_data.get("dive_information"):
                desc_parts.append(entity_data["dive_information"][:200])
            
            stats = []
            if entity_data.get("max_depth"):
                stats.append(f"Max depth: {entity_data['max_depth']}m")
            if entity_data.get("duration"):
                stats.append(f"Duration: {entity_data['duration']}min")
            if entity_data.get("user_rating"):
                stats.append(f"Rating: {entity_data['user_rating']}/10")
            
            if stats:
                desc_parts.append("\n\n" + " | ".join(stats))
            
            description = "\n\n".join(desc_parts) if desc_parts else "Check out this amazing dive!"
            
        elif entity_type == "dive-site":
            title = entity_data.get("name") or "Dive Site"
            description = entity_data.get("description") or f"Discover {title}!"
            
            stats = []
            if entity_data.get("max_depth"):
                stats.append(f"Max depth: {entity_data['max_depth']}m")
            if entity_data.get("difficulty_label"):
                stats.append(f"Difficulty: {entity_data['difficulty_label']}")
            if entity_data.get("average_rating"):
                stats.append(f"Rating: {entity_data['average_rating']}/10")
            
            if stats:
                description += "\n\n" + " | ".join(stats)
            
            if entity_data.get("country") or entity_data.get("region"):
                location = ", ".join(
                    filter(None, [entity_data.get("region"), entity_data.get("country")])
                )
                if location:
                    description += f"\n📍 {location}"
                    
        elif entity_type == "route":
            title = entity_data.get("name") or "Dive Route"
            description = entity_data.get("description") or "Check out this dive route!"
            
            if entity_data.get("route_type"):
                route_type_labels = {
                    "walk": "Walk Route",
                    "swim": "Swim Route",
                    "scuba": "Scuba Route",
                    "line": "Line Route"
                }
                route_type = route_type_labels.get(entity_data["route_type"], entity_data["route_type"])
                description += f"\n\nRoute Type: {route_type}"
            
            if entity_data.get("dive_site"):
                description += f"\n📍 Dive Site: {entity_data['dive_site'].get('name', '')}"
        
        # Platform-specific formatting
        if platform == "twitter":
            # Twitter has 280 character limit
            max_length = 240  # Leave room for URL
            if len(description) > max_length:
                description = description[:max_length] + "..."
        elif platform in ["facebook", "whatsapp", "viber"]:
            # These platforms allow longer text
            max_length = 500
            if len(description) > max_length:
                description = description[:max_length] + "..."
        
        return {
            "title": title,
            "description": description
        }
    
    def get_platform_share_urls(
        self,
        share_url: str,
        title: str,
        description: str,
        entity_type: str = ""
    ) -> Dict[str, str]:
        """
        Generate platform-specific share URLs.
        
        Args:
            share_url: Base shareable URL
            title: Share title
            description: Share description
            entity_type: Type of entity ('dive', 'dive-site', 'route')
            
        Returns:
            Dictionary mapping platform names to share URLs
        """
        # Get entity label
        entity_label = ""
        if entity_type == "dive":
            entity_label = "dive"
        elif entity_type == "dive-site":
            entity_label = "dive site"
        elif entity_type == "route":
            entity_label = "dive route"
        
        # Format prefix
        prefix = f"Check out this {entity_label} on Divemap: " if entity_label else ""
        
        # Define newline variable once (can't use \n in f-string expressions)
        newline = "\n"
        
        # Format text for URLs
        if description:
            share_text = f"{prefix}{title}{newline}{newline}{description}{newline}{newline}{share_url}"
        else:
            share_text = f"{prefix}{title}{newline}{newline}{share_url}"
        
        # Twitter: Include prefix in text
        if description:
            twitter_text = f"{prefix}{title}{newline}{newline}{description}"
        else:
            twitter_text = f"{prefix}{title}"
        twitter_text = twitter_text[:240]  # Limit for Twitter
        
        # Facebook: Include prefix in quote
        facebook_quote = f"{prefix}{title}" if prefix else title
        
        # Reddit: Include prefix in title
        reddit_title = f"{prefix}{title}" if prefix else title
        
        # Email: Include prefix in subject
        email_subject = f"{prefix}{title}" if prefix else f"Check out this on Divemap: {title}"
        
        # Prepare Twitter text with newlines (can't use \n in f-string expression)
        twitter_text_with_newline = f"{twitter_text}{newline}{newline}"
        
        # Prepare email body with newlines
        if description:
            email_body = f"{description}{newline}{newline}{share_url}"
        else:
            email_body = share_url
        
        urls = {
            "twitter": f"https://twitter.com/intent/tweet?{urlencode({'text': twitter_text_with_newline, 'url': share_url, 'hashtags': 'diving,scubadiving,divemap'})}",
            "facebook": f"https://www.facebook.com/sharer/sharer.php?{urlencode({'u': share_url, 'quote': facebook_quote})}",
            "whatsapp": f"https://wa.me/?{urlencode({'text': share_text})}",
            "viber": f"viber://forward?{urlencode({'text': share_text})}",
            "reddit": f"https://reddit.com/submit?{urlencode({'url': share_url, 'title': reddit_title})}",
            "email": f"mailto:?{urlencode({'subject': email_subject, 'body': email_body})}"
        }
        
        return urls

