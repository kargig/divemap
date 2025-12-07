"""
OpenStreetMap Coastline Service

Service to detect shore direction for dive sites using OpenStreetMap coastline data
via the Overpass API. This service queries for coastline segments near dive site
coordinates and calculates the shore direction (compass bearing facing seaward).
"""

import requests
import math
from typing import Optional, Dict, Tuple, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Overpass API endpoints (primary and fallback)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
]

# Default search radius in meters
DEFAULT_RADIUS = 1000

# Confidence thresholds based on distance to coastline
CONFIDENCE_HIGH_THRESHOLD = 100  # meters
CONFIDENCE_MEDIUM_THRESHOLD = 500  # meters


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth using Haversine formula.
    
    Returns distance in meters.
    """
    R = 6371000  # Earth radius in meters
    
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the bearing (direction) from point 1 to point 2.
    
    Returns bearing in degrees (0-360).
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    dlon = lon2 - lon1
    
    bearing = math.atan2(
        math.sin(dlon) * math.cos(lat2),
        math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    )
    
    # Convert to degrees and normalize to 0-360
    bearing = math.degrees(bearing)
    return (bearing + 360) % 360


def point_to_segment_distance(point: Tuple[float, float], seg_start: Tuple[float, float], seg_end: Tuple[float, float]) -> float:
    """
    Calculate the distance from a point to a line segment.
    
    Uses the midpoint of the segment for simplicity (good enough for our use case).
    """
    mid_lat = (seg_start[0] + seg_end[0]) / 2
    mid_lon = (seg_start[1] + seg_end[1]) / 2
    return haversine_distance(point[0], point[1], mid_lat, mid_lon)


def query_overpass_api(latitude: float, longitude: float, radius: int = DEFAULT_RADIUS, timeout: int = 15) -> Optional[Dict]:
    """
    Query Overpass API for coastline segments near the given coordinates.
    
    Tries multiple endpoints if one fails.
    
    Returns the JSON response or None if all endpoints fail.
    """
    query = f'''[out:json][timeout:{timeout}];
(
  way["natural"="coastline"](around:{radius},{latitude},{longitude});
);
out geom;'''
    
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            logger.debug(f"Querying Overpass API endpoint: {endpoint}")
            response = requests.post(
                endpoint,
                data=query,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=timeout + 5  # Add buffer for network latency
            )
            
            if response.status_code != 200:
                logger.warning(f"Overpass API returned status {response.status_code} from {endpoint}")
                continue
            
            # Check if response is JSON (timeouts return HTML/XML)
            if not response.text.strip().startswith('{'):
                logger.warning(f"Non-JSON response from {endpoint} (likely timeout): {response.text[:200]}")
                continue
            
            data = response.json()
            return data
            
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout querying {endpoint}")
            continue
        except requests.exceptions.RequestException as e:
            logger.warning(f"Error querying {endpoint}: {e}")
            continue
        except ValueError as e:  # JSON decode error
            logger.warning(f"Invalid JSON response from {endpoint}: {e}")
            continue
    
    logger.error("All Overpass API endpoints failed")
    return None


def detect_shore_direction(latitude: float, longitude: float, radius: int = DEFAULT_RADIUS) -> Optional[Dict[str, any]]:
    """
    Detect shore direction for a dive site using OpenStreetMap coastline data.
    
    Args:
        latitude: Dive site latitude
        longitude: Dive site longitude
        radius: Search radius in meters (default: 1000)
    
    Returns:
        Dictionary with:
        - shore_direction: float (0-360 degrees) or None if not found
        - confidence: str ('high', 'medium', 'low') or None
        - method: str ('osm_coastline')
        - distance_to_coastline_m: float (meters) or None
        
        Returns None if detection fails completely.
    """
    try:
        # Query Overpass API
        data = query_overpass_api(latitude, longitude, radius)
        
        if not data or "elements" not in data:
            logger.warning(f"No coastline data found for coordinates {latitude}, {longitude}")
            return None
        
        elements = data.get("elements", [])
        if not elements:
            logger.warning(f"No coastline elements found for coordinates {latitude}, {longitude}")
            return None
        
        # Find nearest coastline segment
        dive_site = (latitude, longitude)
        nearest_segment = None
        min_distance = float('inf')
        
        for element in elements:
            if element.get("type") != "way" or "geometry" not in element:
                continue
            
            geometry = element.get("geometry", [])
            if len(geometry) < 2:
                continue
            
            # Check each segment in the way
            for i in range(len(geometry) - 1):
                p1 = (geometry[i]["lat"], geometry[i]["lon"])
                p2 = (geometry[i+1]["lat"], geometry[i+1]["lon"])
                
                dist = point_to_segment_distance(dive_site, p1, p2)
                
                if dist < min_distance:
                    min_distance = dist
                    nearest_segment = (p1, p2)
        
        if not nearest_segment:
            logger.warning(f"No valid coastline segments found for coordinates {latitude}, {longitude}")
            return None
        
        # Calculate coastline bearing
        p1, p2 = nearest_segment
        coastline_bearing = calculate_bearing(p1[0], p1[1], p2[0], p2[1])
        
        # Shore direction is perpendicular to coastline (facing seaward)
        # OSM coastlines are oriented with land on left, water on right
        # Adding 90° gives us the direction facing out to sea
        shore_direction = (coastline_bearing + 90) % 360
        
        # Determine confidence based on distance
        if min_distance < CONFIDENCE_HIGH_THRESHOLD:
            confidence = "high"
        elif min_distance < CONFIDENCE_MEDIUM_THRESHOLD:
            confidence = "medium"
        else:
            confidence = "low"
        
        logger.info(
            f"Detected shore direction: {shore_direction:.1f}° (confidence: {confidence}, "
            f"distance: {min_distance:.1f}m) for coordinates {latitude}, {longitude}"
        )
        
        return {
            "shore_direction": round(shore_direction, 2),
            "confidence": confidence,
            "method": "osm_coastline",
            "distance_to_coastline_m": round(min_distance, 2)
        }
        
    except Exception as e:
        logger.error(f"Error detecting shore direction for {latitude}, {longitude}: {e}", exc_info=True)
        return None

