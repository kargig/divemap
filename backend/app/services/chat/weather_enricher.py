import logging
from datetime import datetime, date
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models import DiveSite
from app.services.open_meteo_service import fetch_wind_data_batch
from app.services.wind_recommendation_service import calculate_wind_suitability

logger = logging.getLogger(__name__)

def enrich_results_with_weather(db: Session, results: List[Dict], intent_date: Optional[str], intent_time: Optional[str], intent_lat: Optional[float], intent_lon: Optional[float], intent_location: Optional[str]) -> bool:
    """
    Enriches search results with weather suitability data if a date is provided.
    Returns True if we should ask the user for a specific time.
    """
    ask_for_time = False
    
    target_date_str = intent_date
    target_date = None
    if target_date_str:
        try:
            target_date = date.fromisoformat(target_date_str.strip())
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse date string '{target_date_str}': {e}")
            return False
            
    if not target_date:
        return False

    # Check if time is provided
    target_dt = None
    if intent_time:
        try:
            h, m = map(int, intent_time.split(':'))
            target_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=h, minute=m)
        except Exception as e:
            logger.error(f"Error processing time '{intent_time}': {e}")
            ask_for_time = True
    else:
        ask_for_time = True

    if not target_dt:
        # If no time, use a default for the enrichment but still return ask_for_time=True
        target_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=10)

    # Add the requested location if it's not already covered
    if intent_lat and intent_lon:
        already_covered = False
        for item in results:
            if item.get("latitude") and item.get("longitude"):
                dist = abs(item["latitude"] - intent_lat) + abs(item["longitude"] - intent_lon)
                if dist < 0.05:
                    already_covered = True
                    break
        if not already_covered:
            results.append({
                "entity_type": "location",
                "name": intent_location or "Requested Location",
                "latitude": intent_lat,
                "longitude": intent_lon,
            })

    site_coords = []
    site_id_map = {}
    for item in results:
        if (item["entity_type"] in ["dive_site", "location"]) and "latitude" in item and item["latitude"]:
            coords = (item["latitude"], item["longitude"])
            site_coords.append(coords)
            # Use a unique identifier for mapping back
            ref_id = item.get("id", f"loc_{results.index(item)}")
            site_id_map[coords] = ref_id
    
    if site_coords:
        try:
            weather_results = fetch_wind_data_batch(site_coords, target_dt)
            for coords, wind_data in weather_results.items():
                if wind_data:
                    ref_id = site_id_map[coords]
                    for item in results:
                        item_id = item.get("id", f"loc_{results.index(item)}")
                        if item_id == ref_id:
                            shore_dir = None
                            if item["entity_type"] == "dive_site":
                                site = db.query(DiveSite).filter(DiveSite.id == item["id"]).first()
                                shore_dir = float(site.shore_direction) if site.shore_direction else None
                            
                            suitability = calculate_wind_suitability(
                                wind_direction=wind_data["wind_direction_10m"],
                                wind_speed=wind_data["wind_speed_10m"],
                                shore_direction=shore_dir,
                                wind_gusts=wind_data.get("wind_gusts_10m"),
                                wave_height=wind_data.get("wave_height"),
                                wave_period=wind_data.get("wave_period")
                            )
                            
                            item["suitability"] = suitability["suitability"]
                            item["suitability_reasoning"] = suitability["reasoning"]
                            item["current_wind_dir"] = wind_data["wind_direction_10m"]
                            from .utils import degrees_to_cardinal
                            item["current_wind_cardinal"] = degrees_to_cardinal(wind_data["wind_direction_10m"])
                            item["current_wind_speed"] = wind_data["wind_speed_10m"]
        except Exception as e:
            logger.error(f"Error in weather enrichment: {e}")

    return ask_for_time
