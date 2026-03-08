import logging
from typing import Dict
from sqlalchemy.orm import Session
from app.models import DiveSite, DivingCenter, Dive, DiveRoute

logger = logging.getLogger(__name__)

def resolve_page_context(db: Session, page_context: Dict) -> str:
    """
    Converts the raw page context from the frontend into a human-readable summary for the LLM.
    """
    if not page_context:
        return "None"

    path = page_context.get("path", "")
    params = page_context.get("params", {})
    summary = [f"Path: {path}"]

    if params:
        summary.append(f"Query Parameters: {params}")

    try:
        # 1. Dive Site & Route Context
        if "/dive-sites/" in path:
            site_id_parts = path.split("/")
            if len(site_id_parts) >= 3:
                site_id = site_id_parts[2]
                if site_id.isdigit():
                    site = db.query(DiveSite).filter(DiveSite.id == int(site_id)).first()
                    if site:
                        summary.append(f"Current Dive Site: '{site.name}' (ID: {site.id}, Region: {site.region})")
                    
                    route_id = page_context.get("route_id")
                    if route_id:
                        route = db.query(DiveRoute).filter(DiveRoute.id == int(route_id)).first()
                        if route:
                            summary.append(f"Current Dive Route: '{route.name}'")

        # 2. Diving Center Context
        elif "/diving-centers/" in path:
            center_id_parts = path.split("/")
            if len(center_id_parts) >= 3:
                center_id = center_id_parts[2]
                if center_id.isdigit():
                    center = db.query(DivingCenter).filter(DivingCenter.id == int(center_id)).first()
                    if center:
                        summary.append(f"Current Diving Center: '{center.name}' in {center.city}, {center.region}")

        # 3. Dive Log Context
        elif "/dives/" in path:
            dive_id_parts = path.split("/")
            if len(dive_id_parts) >= 3:
                dive_id = dive_id_parts[2]
                if dive_id.isdigit():
                    dive = db.query(Dive).filter(Dive.id == int(dive_id)).first()
                    if dive:
                        summary.append(f"Current Dive Log: Site '{dive.site_name}' on {dive.dive_date}")

        # 4. Resources / Tools Context
        elif "/resources/tools" in path:
            tab = params.get("tab", "General")
            summary.append(f"Active Tool Tab: {tab}")
        
        elif "/resources/diving-organizations" in path:
            summary.append("Currently viewing the list of recognized Diving Organizations.")

        # 5. Generic List Views
        elif path == "/dive-sites":
            summary.append("Currently viewing the Dive Sites directory.")
        elif path == "/diving-centers":
            summary.append("Currently viewing the Diving Centers directory.")
        elif path == "/dive-trips":
            summary.append("Currently viewing the upcoming Dive Trips.")

    except Exception as e:
        logger.error(f"Error resolving page context: {e}")

    return " | ".join(summary)
