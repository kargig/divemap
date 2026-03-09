import logging
import requests
import math
from typing import Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import DiveSite

logger = logging.getLogger(__name__)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two points using Haversine formula."""
    R = 6371.0 # Earth radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def get_external_region_bounds(region_name: str) -> Optional[Tuple[Tuple[float, float, float, float], str]]:
    """
    Fetches the official geographic bounding box and display name for a region name using Nominatim (OpenStreetMap).
    Returns ((North, South, East, West), display_name) or None.
    """
    try:
        url = "https://nominatim.openstreetmap.org/search"
        
        # Improve resolution for Divemap focus areas (Greece)
        query = region_name
        if "greece" not in region_name.lower() and "hellas" not in region_name.lower():
            query = f"{region_name}, Greece"
            
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "addressdetails": 1
        }
        headers = {
            "User-Agent": "Divemap-Backend/1.0 (info@divemap.com)" # Nominatim requires a User-Agent
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        
        if data and isinstance(data, list) and len(data) > 0:
            item = data[0]
            boundingbox = item.get("boundingbox")
            display_name = item.get("display_name", "")
            if boundingbox and len(boundingbox) == 4:
                # Nominatim boundingbox format: [South, North, West, East] (all as strings)
                south = float(boundingbox[0])
                north = float(boundingbox[1])
                west = float(boundingbox[2])
                east = float(boundingbox[3])
                
                logger.info(f"Resolved external bounds for '{query}': N={north}, S={south}, E={east}, W={west}")
                return ((north, south, east, west), display_name)
                
        logger.warning(f"No external bounds found for region '{query}'")
        return None
    except Exception as e:
        logger.error(f"Error fetching external bounds for '{region_name}': {e}")
        return None

def get_empirical_region_bounds(db: Session, region_name: str) -> Optional[Tuple[float, float, float, float]]:
    """
    Fallback method: Finds the bounding box based on existing dive sites matching the region name.
    """
    try:
        # We look for matches in region, country, or city (via address or just broadly)
        result = db.query(
            func.max(DiveSite.latitude).label('north'),
            func.min(DiveSite.latitude).label('south'),
            func.max(DiveSite.longitude).label('east'),
            func.min(DiveSite.longitude).label('west')
        ).filter(
            (DiveSite.region.ilike(f"%{region_name}%")) | 
            (DiveSite.country.ilike(f"%{region_name}%")) |
            (DiveSite.name.ilike(f"%{region_name}%")) # Sometimes sites have city in the name
        ).first()

        if result and result.north is not None and result.south is not None:
            # Add a tiny buffer so it's not a zero-area box if there's only 1 site
            buffer = 0.05 
            north = float(result.north) + buffer
            south = float(result.south) - buffer
            east = float(result.east) + buffer
            west = float(result.west) - buffer
            
            logger.info(f"Resolved empirical bounds for '{region_name}': N={north}, S={south}, E={east}, W={west}")
            return (north, south, east, west)
            
        return None
    except Exception as e:
        logger.error(f"Error calculating empirical bounds for '{region_name}': {e}")
        return None

def get_location_info_from_coords(lat: float, lon: float) -> Dict[str, Optional[str]]:
    """
    Reverse geocodes coordinates to find country and region using Nominatim.
    """
    result = {"country": None, "region": None}
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "zoom": 5 # City/Region level
        }
        headers = {
            "User-Agent": "Divemap-Backend/1.0 (info@divemap.com)"
        }
        response = requests.get(url, params=params, headers=headers, timeout=5.0)
        response.raise_for_status()
        data = response.json()
        address = data.get("address", {})
        
        result["country"] = address.get("country")
        # Try to find the most relevant regional administrative level
        result["region"] = address.get("state") or address.get("region") or address.get("county")
        
        if result["country"]:
            logger.info(f"Resolved location info from coords ({lat}, {lon}): {result}")
    except Exception as e:
        logger.error(f"Error reverse geocoding coords ({lat}, {lon}): {e}")
    return result

def get_country_from_ip(ip: str) -> Optional[str]:
    """
    Looks up the country name for an IP address using ip-api.com.
    """
    if not ip or ip in ["127.0.0.1", "::1", "localhost"]:
        return None
    try:
        # Using free ip-api.com (limited to 45 requests per minute)
        url = f"http://ip-api.com/json/{ip}"
        response = requests.get(url, timeout=5.0)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "success":
            country = data.get("country")
            if country:
                logger.info(f"Resolved country '{country}' from IP {ip}")
                return country
    except Exception as e:
        logger.error(f"Error geolocating IP {ip}: {e}")
    return None

def calculate_directional_bounds(north: float, south: float, east: float, west: float, direction: str) -> Tuple[float, float, float, float]:
    """
    Given a geographic bounding box, subdivides it into the requested cardinal direction.
    direction can be 'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'.
    Returns (new_north, new_south, new_east, new_west)
    """
    d = direction.lower().strip()
    mid_lat = (north + south) / 2.0
    mid_lon = (east + west) / 2.0
    
    new_north = north
    new_south = south
    new_east = east
    new_west = west

    if "north" in d:
        new_south = mid_lat
    if "south" in d:
        new_north = mid_lat
    if "east" in d:
        new_west = mid_lon
    if "west" in d:
        new_east = mid_lon

    return (new_north, new_south, new_east, new_west)
