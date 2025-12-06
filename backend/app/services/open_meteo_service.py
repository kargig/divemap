"""
Open-Meteo Weather Service

Service to fetch current wind data from Open-Meteo API for dive site locations.
Supports single point queries and grid-based queries for map overlays.
"""

import requests
import math
import random
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Open-Meteo API base URL
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"

# Cache for wind data (in-memory dictionary)
_wind_cache: Dict[str, Dict] = {}
_cache_ttl_seconds = 15 * 60  # 15 minutes
_max_cache_size = 100  # Maximum number of cache entries


def _generate_cache_key(latitude: float, longitude: float, bounds: Optional[Dict] = None, target_datetime: Optional[datetime] = None) -> str:
    """
    Generate a cache key for wind data.
    
    Rounds coordinates to 0.1° grid for cache efficiency.
    Includes date/time in cache key for forecast data.
    """
    if bounds:
        # For bounds, use rounded center point
        center_lat = (bounds['north'] + bounds['south']) / 2
        center_lon = (bounds['east'] + bounds['west']) / 2
        rounded_lat = round(center_lat * 10) / 10
        rounded_lon = round(center_lon * 10) / 10
        base_key = f"wind-{rounded_lat}-{rounded_lon}"
    else:
        rounded_lat = round(latitude * 10) / 10
        rounded_lon = round(longitude * 10) / 10
        base_key = f"wind-{rounded_lat}-{rounded_lon}"
    
    # Add date/time to cache key if specified (round to hour for cache efficiency)
    if target_datetime:
        # Round to nearest hour for cache efficiency
        hour_key = target_datetime.replace(minute=0, second=0, microsecond=0).isoformat()
        return f"{base_key}-{hour_key}"
    
    return base_key


def _is_cache_valid(cache_entry: Dict) -> bool:
    """Check if a cache entry is still valid (not expired)."""
    if 'timestamp' not in cache_entry:
        return False
    
    age = (datetime.now() - cache_entry['timestamp']).total_seconds()
    return age < _cache_ttl_seconds


def _cleanup_cache():
    """Remove expired entries and limit cache size."""
    global _wind_cache
    
    # Remove expired entries
    current_time = datetime.now()
    expired_keys = [
        key for key, entry in _wind_cache.items()
        if not _is_cache_valid(entry)
    ]
    for key in expired_keys:
        del _wind_cache[key]
    
    # Limit cache size (LRU: remove oldest entries)
    if len(_wind_cache) > _max_cache_size:
        # Sort by timestamp and remove oldest
        sorted_entries = sorted(
            _wind_cache.items(),
            key=lambda x: x[1].get('timestamp', datetime.min)
        )
        entries_to_remove = len(_wind_cache) - _max_cache_size
        for key, _ in sorted_entries[:entries_to_remove]:
            del _wind_cache[key]


def _create_grid_points(bounds: Dict, zoom_level: Optional[int] = None) -> List[Tuple[float, float]]:
    """
    Create a grid of points within the given bounds.
    
    Grid density adapts based on zoom level:
    - Zoom 12: 0.10° spacing (~11km)
    - Zoom 13-14: 0.08° spacing (~8.8km)
    - Zoom 15-16: 0.05° spacing (~5.5km)
    - Zoom 17: 0.03° spacing (~3.3km)
    - Zoom 18+: 0.02° spacing (~2.2km)
    
    Points are generated INSIDE the bounds (not at edges) to ensure they appear
    within the visible viewport.
    """
    if zoom_level is None:
        zoom_level = 15  # Default to high zoom
    
    # Adaptive grid spacing based on zoom
    if zoom_level >= 18:
        spacing = 0.02
    elif zoom_level >= 17:
        spacing = 0.03
    elif zoom_level >= 15:
        spacing = 0.05
    elif zoom_level >= 13:
        spacing = 0.08
    else:  # zoom 12
        spacing = 0.10
    
    # Add a small margin to ensure points are INSIDE bounds, not at edges
    # Margin is 10% of spacing to keep points away from edges
    margin = spacing * 0.1
    
    points = []
    # Start from slightly inside south/west bounds
    lat = bounds['south'] + margin
    
    # End slightly before north/east bounds
    while lat < bounds['north'] - margin:
        lon = bounds['west'] + margin
        while lon < bounds['east'] - margin:
            points.append((lat, lon))
            lon += spacing
        lat += spacing
    
    # Limit to maximum points to avoid API overload
    max_points = 100
    if len(points) > max_points:
        # Sample evenly
        step = len(points) // max_points
        points = points[::step][:max_points]
    
    # Log grid point distribution for debugging
    if points:
        logger.info(
            f"Grid point distribution: "
            f"total={len(points)}, "
            f"lat_range=[{min(p[0] for p in points):.6f}, {max(p[0] for p in points):.6f}], "
            f"lon_range=[{min(p[1] for p in points):.6f}, {max(p[1] for p in points):.6f}], "
            f"bounds={{north={bounds['north']:.6f}, south={bounds['south']:.6f}, "
            f"east={bounds['east']:.6f}, west={bounds['west']:.6f}}}, "
            f"zoom={zoom_level}, spacing={spacing}"
        )
        # Log first and last few points to verify distribution
        logger.debug(f"First 5 grid points: {points[:5]}")
        logger.debug(f"Last 5 grid points: {points[-5:]}")
    
    return points


def fetch_wind_data_single_point(latitude: float, longitude: float, target_datetime: Optional[datetime] = None) -> Optional[Dict]:
    """
    Fetch wind data for a single point.
    
    Args:
        latitude: Latitude of the point
        longitude: Longitude of the point
        target_datetime: Optional datetime for forecast (defaults to current time)
    
    Returns:
        Dictionary with wind_speed_10m, wind_direction_10m, wind_gusts_10m, timestamp
        or None if fetch fails
    """
    # Default to current time if not specified
    if target_datetime is None:
        target_datetime = datetime.now()
    
    # Validate date range: only allow up to +2 days ahead
    max_future = datetime.now() + timedelta(days=2)
    if target_datetime > max_future:
        logger.warning(f"Requested datetime {target_datetime} is more than 2 days ahead, limiting to {max_future}")
        target_datetime = max_future
    
    # Don't allow past dates (only current and future up to +2 days)
    if target_datetime < datetime.now() - timedelta(hours=1):
        logger.warning(f"Requested datetime {target_datetime} is in the past, using current time")
        target_datetime = datetime.now()
    
    cache_key = _generate_cache_key(latitude, longitude, target_datetime=target_datetime)
    
    # Check cache
    if cache_key in _wind_cache and _is_cache_valid(_wind_cache[cache_key]):
        logger.debug(f"Using cached wind data for {latitude}, {longitude} at {target_datetime}")
        return _wind_cache[cache_key].get('data')
    
    try:
        # Determine if we need current or forecast data
        time_diff = (target_datetime - datetime.now()).total_seconds()
        
        if time_diff <= 3600:  # Within 1 hour, use current
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
                "wind_speed_unit": "ms",  # Request wind speed in m/s
                "timezone": "auto"
            }
        else:
            # Use hourly forecast
            start_date = target_datetime.strftime("%Y-%m-%d")
            end_date = target_datetime.strftime("%Y-%m-%d")
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
                "start_date": start_date,
                "end_date": end_date,
                "wind_speed_unit": "ms",  # Request wind speed in m/s
                "timezone": "auto"
            }
        
        response = requests.get(OPEN_METEO_BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        wind_data = None
        
        # Parse current data
        if "current" in data:
            current = data["current"]
            # Wind speed is already in m/s due to wind_speed_unit=ms parameter
            wind_data = {
                "wind_speed_10m": current.get("wind_speed_10m"),  # m/s
                "wind_direction_10m": current.get("wind_direction_10m"),  # degrees
                "wind_gusts_10m": current.get("wind_gusts_10m"),  # m/s
                "timestamp": target_datetime
            }
        # Parse hourly forecast data
        elif "hourly" in data:
            hourly = data["hourly"]
            times = hourly.get("time", [])
            target_hour = target_datetime.replace(minute=0, second=0, microsecond=0)
            
            # Find the closest hour in the forecast
            target_time_str = target_hour.strftime("%Y-%m-%dT%H:00")
            
            try:
                hour_index = times.index(target_time_str)
            except ValueError:
                # If exact hour not found, use the first available hour
                if times:
                    hour_index = 0
                    logger.warning(f"Exact hour {target_time_str} not found in forecast, using {times[0]}")
                else:
                    logger.warning(f"No hourly data available for {latitude}, {longitude}")
                    return None
            
            # Wind speed is already in m/s due to wind_speed_unit=ms parameter
            wind_data = {
                "wind_speed_10m": hourly.get("wind_speed_10m", [None])[hour_index] if hour_index < len(hourly.get("wind_speed_10m", [])) else None,  # m/s
                "wind_direction_10m": hourly.get("wind_direction_10m", [None])[hour_index] if hour_index < len(hourly.get("wind_direction_10m", [])) else None,  # degrees
                "wind_gusts_10m": hourly.get("wind_gusts_10m", [None])[hour_index] if hour_index < len(hourly.get("wind_gusts_10m", [])) else None,  # m/s
                "timestamp": target_datetime
            }
        
        if not wind_data:
            logger.warning(f"No wind data in Open-Meteo response for {latitude}, {longitude} at {target_datetime}")
            return None
        
        # Cache the result
        _wind_cache[cache_key] = {
            "data": wind_data,
            "timestamp": datetime.now()
        }
        _cleanup_cache()
        
        return wind_data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching wind data from Open-Meteo for {latitude}, {longitude} at {target_datetime}: {e}")
        # Return cached data even if expired
        if cache_key in _wind_cache:
            logger.info(f"Returning expired cached data for {latitude}, {longitude}")
            return _wind_cache[cache_key].get('data')
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching wind data: {e}", exc_info=True)
        return None


def fetch_wind_data_grid(bounds: Dict, zoom_level: Optional[int] = None, target_datetime: Optional[datetime] = None, jitter_factor: int = 5) -> List[Dict]:
    """
    Fetch wind data for a grid of points within the given bounds.
    
    Args:
        bounds: Dictionary with 'north', 'south', 'east', 'west' keys
        zoom_level: Current map zoom level (affects grid density)
        target_datetime: Optional datetime for forecast (defaults to current time)
        jitter_factor: Number of jittered variations to create for each grid point (default: 5)
    
    Returns:
        List of dictionaries with lat, lon, wind_speed_10m, wind_direction_10m, wind_gusts_10m
        Each grid point is expanded into multiple points with small random jitter for visual density.
    """
    grid_points = _create_grid_points(bounds, zoom_level)
    wind_data_points = []
    
    logger.info(f"Fetching wind data for {len(grid_points)} grid points at {target_datetime or 'current time'}")
    
    # Calculate jitter range based on grid spacing (small fraction of spacing)
    if zoom_level is None:
        zoom_level = 15
    if zoom_level >= 18:
        base_spacing = 0.02
    elif zoom_level >= 17:
        base_spacing = 0.03
    elif zoom_level >= 15:
        base_spacing = 0.05
    elif zoom_level >= 13:
        base_spacing = 0.08
    else:  # zoom 12
        base_spacing = 0.10
    
    # Jitter range is 20% of base spacing to create visual variety without losing accuracy
    # Reduced from 40% to ensure jittered points stay within bounds
    jitter_range = base_spacing * 0.2
    
    total_jittered_attempts = 0
    total_jittered_success = 0
    
    for lat, lon in grid_points:
        wind_data = fetch_wind_data_single_point(lat, lon, target_datetime)
        if wind_data:
            # Create base point
            wind_data_points.append({
                "lat": lat,
                "lon": lon,
                "wind_speed_10m": wind_data.get("wind_speed_10m"),
                "wind_direction_10m": wind_data.get("wind_direction_10m"),
                "wind_gusts_10m": wind_data.get("wind_gusts_10m"),
                "timestamp": wind_data.get("timestamp")
            })
            
            # Create jittered variations for visual density
            # Use same wind data (wind doesn't change significantly over small distances)
            for _ in range(jitter_factor - 1):  # -1 because we already added the base point
                total_jittered_attempts += 1
                max_retries = 10  # Maximum retries to find a valid jittered point
                jittered_point_created = False
                
                for retry in range(max_retries):
                    # Generate random jitter within range
                    lat_jitter = random.uniform(-jitter_range, jitter_range)
                    lon_jitter = random.uniform(-jitter_range, jitter_range)
                    
                    # Calculate jittered coordinates
                    jittered_lat = lat + lat_jitter
                    jittered_lon = lon + lon_jitter
                    
                    # Validate jittered coordinates are within bounds
                    # Use <= and >= to allow points at the edge (they'll be filtered by frontend if needed)
                    if (bounds['south'] <= jittered_lat <= bounds['north'] and
                        bounds['west'] <= jittered_lon <= bounds['east']):
                        total_jittered_success += 1
                        wind_data_points.append({
                            "lat": jittered_lat,
                            "lon": jittered_lon,
                            "wind_speed_10m": wind_data.get("wind_speed_10m"),
                            "wind_direction_10m": wind_data.get("wind_direction_10m"),
                            "wind_gusts_10m": wind_data.get("wind_gusts_10m"),
                            "timestamp": wind_data.get("timestamp")
                        })
                        jittered_point_created = True
                        break  # Successfully created jittered point, move to next
                
                # If we couldn't create a valid jittered point after max_retries, skip it
                # This should be rare with 20% jitter range, but can happen near bounds edges
                if not jittered_point_created:
                    logger.debug(
                        f"Could not create valid jittered point for base point ({lat}, {lon}) "
                        f"after {max_retries} retries. Point may be too close to bounds edge."
                    )
    
    # More accurate log message
    expected_total = len(grid_points) * jitter_factor
    logger.info(
        f"Successfully fetched wind data for {len(wind_data_points)} points "
        f"({len(grid_points)} base points + {total_jittered_success}/{total_jittered_attempts} jittered variations, "
        f"expected ~{expected_total} total)"
    )
    return wind_data_points

