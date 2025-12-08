"""
Open-Meteo Weather Service

Service to fetch current wind data from Open-Meteo API for dive site locations.
Supports single point queries and grid-based queries for map overlays.

Uses 3-tier caching:
1. In-memory cache (fastest, lost on restart)
2. Database cache (persistent, shared across instances)
3. Open-Meteo API (source of truth)
"""

import requests
import math
import random
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta, timezone
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

# Open-Meteo API base URL
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"

# Cache for wind data (in-memory dictionary)
_wind_cache: Dict[str, Dict] = {}
_cache_ttl_seconds = 15 * 60  # 15 minutes (fallback for old cache entries)
# Increased cache size to accommodate zoom 12-13 usage patterns
# Single viewport at zoom 13: ~480 entries
# Typical session (panning + time exploration): ~1100-1600 entries
# Buffer: ~500-1000 entries
# Memory cost: ~875 KB (negligible)
_max_cache_size = 2500  # Maximum number of cache entries


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


def _calculate_cache_ttl(target_datetime: Optional[datetime], now: datetime) -> timedelta:
    """
    Calculate cache TTL based on forecast distance from current time.
    
    Args:
        target_datetime: Forecast datetime (None for current time)
        now: Current datetime
    
    Returns:
        timedelta representing cache TTL
    """
    # Current time requests: use shortest cache (1 hour)
    if target_datetime is None:
        return timedelta(hours=1)
    
    # Past forecasts: use shortest cache (shouldn't happen, but handle gracefully)
    if target_datetime < now:
        return timedelta(hours=1)
    
    # Calculate hours until forecast
    time_until_forecast = target_datetime - now
    hours_until = time_until_forecast.total_seconds() / 3600
    
    # Apply caching rules
    if hours_until <= 6:
        # 0-6 hours: cache until forecast time (dynamic)
        # But ensure minimum TTL of 1 hour for current time or very near-future requests
        if hours_until <= 0:
            # Current time or past: use 1 hour minimum
            return timedelta(hours=1)
        elif hours_until < 1:
            # Less than 1 hour away: use 1 hour minimum TTL
            return timedelta(hours=1)
        return time_until_forecast
    elif hours_until <= 12:
        # 6-12 hours: cache for 3 hours
        return timedelta(hours=3)
    elif hours_until <= 24:
        # 12-24 hours: cache for 2 hours
        return timedelta(hours=2)
    else:
        # 24+ hours: cache for 1 hour
        return timedelta(hours=1)


def _is_cache_valid(cache_entry: Dict, target_datetime: Optional[datetime] = None) -> bool:
    """
    Check if a cache entry is still valid (not expired).
    
    Uses dynamic TTL based on target_datetime if available, otherwise falls back
    to fixed 15-minute TTL for backward compatibility with old cache entries.
    """
    if 'timestamp' not in cache_entry:
        return False
    
    # Get target_datetime from cache entry or parameter
    entry_target_datetime = cache_entry.get('target_datetime')
    if entry_target_datetime is None:
        entry_target_datetime = target_datetime
    
    # Calculate dynamic TTL based on target_datetime
    now = datetime.now()
    
    # If we have target_datetime, use dynamic TTL
    if entry_target_datetime is not None:
        ttl = _calculate_cache_ttl(entry_target_datetime, now)
    else:
        # Fallback to fixed TTL for old cache entries without target_datetime
        ttl = timedelta(seconds=_cache_ttl_seconds)
    
    # Check if cache age is less than calculated TTL
    age = now - cache_entry['timestamp']
    return age < ttl


def _cleanup_cache():
    """Remove expired entries and limit cache size."""
    global _wind_cache
    
    # Remove expired entries using dynamic TTL
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


def _get_from_database_cache(cache_key: str, latitude: float, longitude: float, target_datetime: Optional[datetime]) -> Optional[Dict]:
    """
    Retrieve wind data from database cache (Tier 2 cache).
    
    Returns None if not found or expired.
    """
    try:
        # Import here to avoid circular dependencies
        from app.database import SessionLocal
        from app.models import WindDataCache
        
        db = SessionLocal()
        try:
            # Calculate rounded coordinates (matching cache key generation)
            rounded_lat = round(latitude * 10) / 10
            rounded_lon = round(longitude * 10) / 10
            
            # Query by cache_key first (fastest lookup)
            cache_entry = db.query(WindDataCache).filter(
                WindDataCache.cache_key == cache_key,
                WindDataCache.expires_at > datetime.utcnow()  # Only return non-expired entries
            ).first()
            
            if cache_entry:
                logger.debug(f"[DB CACHE] Found valid cache entry for key: {cache_key}")
                # Update last_accessed_at timestamp
                cache_entry.last_accessed_at = datetime.utcnow()
                db.commit()
                # Deserialize wind_data (convert ISO string timestamp back to datetime)
                wind_data = cache_entry.wind_data.copy()
                if 'timestamp' in wind_data and isinstance(wind_data['timestamp'], str):
                    try:
                        wind_data['timestamp'] = datetime.fromisoformat(wind_data['timestamp'])
                    except (ValueError, TypeError):
                        # If deserialization fails, keep as string or use target_datetime
                        if target_datetime:
                            wind_data['timestamp'] = target_datetime
                return wind_data
            
            # If not found by cache_key, try location + datetime lookup (for smart lookup)
            if target_datetime:
                # Round datetime to hour for lookup
                rounded_datetime = target_datetime.replace(minute=0, second=0, microsecond=0)
                cache_entry = db.query(WindDataCache).filter(
                    WindDataCache.latitude == Decimal(str(rounded_lat)),
                    WindDataCache.longitude == Decimal(str(rounded_lon)),
                    WindDataCache.target_datetime == rounded_datetime,
                    WindDataCache.expires_at > datetime.utcnow()
                ).first()
                
                if cache_entry:
                    logger.debug(f"[DB CACHE] Found valid cache entry by location+datetime for {rounded_lat}, {rounded_lon} at {rounded_datetime}")
                    # Update last_accessed_at timestamp
                    cache_entry.last_accessed_at = datetime.utcnow()
                    db.commit()
                    # Deserialize wind_data (convert ISO string timestamp back to datetime)
                    wind_data = cache_entry.wind_data.copy()
                    if 'timestamp' in wind_data and isinstance(wind_data['timestamp'], str):
                        try:
                            wind_data['timestamp'] = datetime.fromisoformat(wind_data['timestamp'])
                        except (ValueError, TypeError):
                            # If deserialization fails, keep as string or use target_datetime
                            if target_datetime:
                                wind_data['timestamp'] = target_datetime
                    return wind_data
            
            logger.debug(f"[DB CACHE] No valid cache entry found for key: {cache_key}")
            return None
            
        finally:
            db.close()
    except Exception as e:
        # Log error but don't fail - fall back to API
        logger.warning(f"[DB CACHE] Error reading from database cache: {e}")
        return None


def _store_in_database_cache(cache_key: str, latitude: float, longitude: float, target_datetime: Optional[datetime], wind_data: Dict):
    """
    Store wind data in database cache (Tier 2 cache).
    
    Silently handles errors to avoid breaking the API flow.
    """
    try:
        # Import here to avoid circular dependencies
        from app.database import SessionLocal
        from app.models import WindDataCache
        
        db = SessionLocal()
        try:
            # Calculate rounded coordinates (matching cache key generation)
            rounded_lat = round(latitude * 10) / 10
            rounded_lon = round(longitude * 10) / 10
            
            # Round datetime to hour if provided
            rounded_datetime = None
            if target_datetime:
                rounded_datetime = target_datetime.replace(minute=0, second=0, microsecond=0)
            
            # Calculate expiration time using dynamic TTL based on forecast distance
            now_utc = datetime.utcnow()
            # Convert target_datetime to UTC if it's timezone-aware, otherwise assume it's in local time
            # and convert to UTC for comparison
            if target_datetime:
                if target_datetime.tzinfo is not None:
                    # Timezone-aware: convert to UTC
                    target_datetime_utc = target_datetime.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    # Naive datetime: assume it's in local time, convert to UTC
                    # For simplicity, we'll use the naive datetime directly and compare with UTC now
                    # This works because we're calculating relative time differences
                    target_datetime_utc = target_datetime
            else:
                target_datetime_utc = None
            
            ttl = _calculate_cache_ttl(target_datetime_utc, now_utc)
            expires_at = now_utc + ttl
            
            # Serialize wind_data for JSON storage (convert datetime to ISO string)
            serialized_wind_data = wind_data.copy()
            if 'timestamp' in serialized_wind_data and isinstance(serialized_wind_data['timestamp'], datetime):
                serialized_wind_data['timestamp'] = serialized_wind_data['timestamp'].isoformat()
            
            # Check if entry already exists
            existing = db.query(WindDataCache).filter(
                WindDataCache.cache_key == cache_key
            ).first()
            
            if existing:
                # Update existing entry
                existing.wind_data = serialized_wind_data
                existing.expires_at = expires_at
                existing.target_datetime = rounded_datetime
                logger.debug(f"[DB CACHE] Updated cache entry for key: {cache_key}")
            else:
                # Create new entry
                cache_entry = WindDataCache(
                    cache_key=cache_key,
                    latitude=Decimal(str(rounded_lat)),
                    longitude=Decimal(str(rounded_lon)),
                    target_datetime=rounded_datetime,
                    wind_data=serialized_wind_data,
                    expires_at=expires_at
                )
                db.add(cache_entry)
                logger.debug(f"[DB CACHE] Created new cache entry for key: {cache_key}")
            
            db.commit()
            logger.info(f"[DB CACHE STORE] Stored wind data in database cache for {latitude:.4f}, {longitude:.4f} at {target_datetime}")
            
        except Exception as e:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as e:
        # Log error but don't fail - in-memory cache still works
        logger.warning(f"[DB CACHE] Error storing in database cache: {e}")


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


def fetch_wind_data_single_point(latitude: float, longitude: float, target_datetime: Optional[datetime] = None, skip_validation: bool = False) -> Optional[Dict]:
    """
    Fetch wind data for a single point.
    
    Args:
        latitude: Latitude of the point
        longitude: Longitude of the point
        target_datetime: Optional datetime for forecast (defaults to current time)
        skip_validation: If True, skip datetime validation (used when called from fetch_wind_data_grid)
    
    Returns:
        Dictionary with wind_speed_10m, wind_direction_10m, wind_gusts_10m, timestamp
        or None if fetch fails
    """
    # Default to current time if not specified
    if target_datetime is None:
        target_datetime = datetime.now()
    
    # Validate date range: only allow up to +2 days ahead (unless validation is skipped)
    if not skip_validation:
        max_future = datetime.now() + timedelta(days=2)
        if target_datetime > max_future:
            logger.warning(f"Requested datetime {target_datetime} is more than 2 days ahead, limiting to {max_future}")
            target_datetime = max_future
        
        # Don't allow past dates (only current and future up to +2 days)
        if target_datetime < datetime.now() - timedelta(hours=1):
            logger.warning(f"Requested datetime {target_datetime} is in the past, using current time")
            target_datetime = datetime.now()
    
    cache_key = _generate_cache_key(latitude, longitude, target_datetime=target_datetime)
    
    # Check cache - first try exact hour match
    if cache_key in _wind_cache and _is_cache_valid(_wind_cache[cache_key], target_datetime):
        logger.info(f"[CACHE HIT] Serving wind data from cache for {latitude:.4f}, {longitude:.4f} at {target_datetime} (exact match)")
        return _wind_cache[cache_key].get('data')
    
    # Log cache key for debugging (only at debug level to avoid spam)
    logger.debug(f"[CACHE LOOKUP] Checking cache for key: {cache_key} (lat={latitude:.4f}, lon={longitude:.4f}, datetime={target_datetime})")
    
    # OPTIMIZATION: If exact hour not found, check if ANY hour from the same date is cached
    # When Open-Meteo returns 24 hours, we cache all hours, so if ANY hour from that date is cached,
    # the requested hour should also be cached (unless there was an error during caching)
    if target_datetime:
        target_date = target_datetime.date()
        # Check a few representative hours (00:00, 12:00, and the requested hour's date) to quickly find if data exists
        # This is more efficient than checking all 24 hours
        check_hours = [0, 12]  # Check midnight and noon as representatives
        if target_datetime.hour not in check_hours:
            check_hours.append(target_datetime.hour)  # Also check the requested hour itself
        
        for hour in check_hours:
            check_datetime = target_datetime.replace(hour=hour, minute=0, second=0, microsecond=0)
            # Use _generate_cache_key to ensure consistent key format
            check_cache_key = _generate_cache_key(latitude, longitude, target_datetime=check_datetime)
            
            logger.debug(f"[CACHE LOOKUP] Checking for cached hour {hour:02d} with key: {check_cache_key}")
            
            if check_cache_key in _wind_cache:
                if _is_cache_valid(_wind_cache[check_cache_key], check_datetime):
                    # Found cached data for this date! Since we cache all 24 hours when fetching any hour,
                    # the requested hour should also be in cache. Let's verify the exact hour exists.
                    logger.info(f"[CACHE LOOKUP] Found cached data for {target_date} hour {hour:02d}, checking if requested hour {target_datetime.hour:02d} is also cached...")
                    
                    # The exact hour should be in cache - check one more time (in case of race condition)
                    if cache_key in _wind_cache and _is_cache_valid(_wind_cache[cache_key], target_datetime):
                        logger.info(f"[CACHE HIT] Serving wind data from cache for {latitude:.4f}, {longitude:.4f} at {target_datetime} (found via date lookup, originally cached for hour {hour:02d})")
                        return _wind_cache[cache_key].get('data')
                    else:
                        # This should not happen - if we cached hour {hour}, we should have cached all 24 hours
                        # Log detailed information for debugging
                        rounded_lat = round(latitude * 10) / 10
                        rounded_lon = round(longitude * 10) / 10
                        matching_keys = [k for k in _wind_cache.keys() if k.startswith(f'wind-{rounded_lat}-{rounded_lon}')]
                        logger.warning(
                            f"[CACHE INCONSISTENCY] Found cached data for {target_date} hour {hour:02d} "
                            f"but requested hour {target_datetime.hour:02d} (cache_key: {cache_key}) is not in cache. "
                            f"This suggests the 24-hour caching did not work correctly. "
                            f"Available cache keys for this location ({rounded_lat}, {rounded_lon}): {matching_keys[:10]}"
                        )
                        # Fall through to make API call (which will cache all 24 hours again)
                        break
                else:
                    logger.debug(f"[CACHE LOOKUP] Found cached hour {hour:02d} but it's expired (key: {check_cache_key})")
            else:
                logger.debug(f"[CACHE LOOKUP] Hour {hour:02d} not in cache (key: {check_cache_key})")
    
    # Tier 2: Check database cache (if in-memory cache missed)
    db_cache_data = _get_from_database_cache(cache_key, latitude, longitude, target_datetime)
    if db_cache_data:
        logger.info(f"[DB CACHE HIT] Serving wind data from database cache for {latitude:.4f}, {longitude:.4f} at {target_datetime}")
        # Also store in in-memory cache for faster subsequent access
        _wind_cache[cache_key] = {
            'data': db_cache_data,
            'timestamp': datetime.now(),
            'target_datetime': target_datetime  # Store for TTL calculation
        }
        return db_cache_data
    
    # Cache miss - need to fetch from Open-Meteo API
    logger.info(f"[CACHE MISS] Wind data not in cache (memory or database) for {latitude:.4f}, {longitude:.4f} at {target_datetime}. Fetching from Open-Meteo API.")
    
    try:
        # OPTIMIZATION: Always use hourly forecast API (not "current") to get 24 hours of data
        # This enables bulk caching of all 24 hours from a single API call
        # The hourly API works for both current and future times, and always returns 24 hours
        time_diff = (target_datetime - datetime.now()).total_seconds()
        
        # Use hourly forecast for all requests (returns 24 hours, enables bulk caching)
        start_date = target_datetime.strftime("%Y-%m-%d")
        end_date = target_datetime.strftime("%Y-%m-%d")
        logger.info(f"[API TYPE] Using 'hourly' forecast API for {latitude:.4f}, {longitude:.4f} at {target_datetime} (time_diff: {time_diff:.0f}s) - will cache all 24 hours")
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
            "start_date": start_date,
            "end_date": end_date,
            "wind_speed_unit": "ms",  # Request wind speed in m/s
            "timezone": "auto"
        }
        
        logger.info(f"[API CALL] Fetching wind data from Open-Meteo API for {latitude:.4f}, {longitude:.4f} at {target_datetime}")
        response = requests.get(OPEN_METEO_BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        logger.info(f"[API SUCCESS] Successfully fetched wind data from Open-Meteo API for {latitude:.4f}, {longitude:.4f} at {target_datetime}")
        
        wind_data = None
        
        # Parse hourly forecast data (we always use hourly API now for 24-hour caching)
        if "hourly" in data:
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
            
            # OPTIMIZATION #10: Cache all 24 hours from forecast response
            # Open-Meteo returns 24 hours of data, so cache all hours to avoid refetching
            if times and len(times) > 0:
                # Extract date from first time entry (format: YYYY-MM-DDTHH:00)
                first_time = times[0]
                forecast_date = first_time.split('T')[0]  # Get YYYY-MM-DD
                
                # Cache each hour from the forecast response
                wind_speeds = hourly.get("wind_speed_10m", [])
                wind_directions = hourly.get("wind_direction_10m", [])
                wind_gusts = hourly.get("wind_gusts_10m", [])
                
                for idx, time_str in enumerate(times):
                    if idx < len(wind_speeds) and idx < len(wind_directions) and idx < len(wind_gusts):
                        # Parse the hour from time string (YYYY-MM-DDTHH:00)
                        try:
                            hour_datetime = datetime.fromisoformat(time_str)
                            hour_cache_key = _generate_cache_key(latitude, longitude, target_datetime=hour_datetime)
                            
                            # Always cache (even if already cached) to ensure all hours are available
                            # This ensures that if we fetch hour 05:00, all 24 hours are cached and available
                            _wind_cache[hour_cache_key] = {
                                "data": {
                                    "wind_speed_10m": wind_speeds[idx],
                                    "wind_direction_10m": wind_directions[idx],
                                    "wind_gusts_10m": wind_gusts[idx],
                                    "timestamp": hour_datetime
                                },
                                "timestamp": datetime.now(),
                                "target_datetime": hour_datetime  # Store for TTL calculation
                            }
                        except (ValueError, IndexError) as e:
                            logger.debug(f"Could not parse/cache hour {time_str}: {e}")
                            continue
                
                logger.info(f"[CACHE STORE] Cached {len(times)} hours of forecast data for {latitude:.4f}, {longitude:.4f} on {forecast_date} (from Open-Meteo API response)")
                
                # OPTIMIZATION: Store all 24 hours in database cache as well
                # This enables persistent caching across server restarts
                for idx, time_str in enumerate(times):
                    if idx < len(wind_speeds) and idx < len(wind_directions) and idx < len(wind_gusts):
                        try:
                            hour_datetime = datetime.fromisoformat(time_str)
                            hour_cache_key = _generate_cache_key(latitude, longitude, target_datetime=hour_datetime)
                            hour_wind_data = {
                                "wind_speed_10m": wind_speeds[idx],
                                "wind_direction_10m": wind_directions[idx],
                                "wind_gusts_10m": wind_gusts[idx],
                                "timestamp": hour_datetime
                            }
                            # Store in database cache (non-blocking, errors are logged but don't fail)
                            _store_in_database_cache(hour_cache_key, latitude, longitude, hour_datetime, hour_wind_data)
                        except (ValueError, IndexError) as e:
                            logger.debug(f"Could not store hour {time_str} in database cache: {e}")
                            continue
        
        if not wind_data:
            logger.warning(f"No wind data in Open-Meteo response for {latitude}, {longitude} at {target_datetime}")
            return None
        
        # Cache the result (also cached above for forecast data, but ensure it's here for current data)
        if cache_key not in _wind_cache:
            _wind_cache[cache_key] = {
                "data": wind_data,
                "timestamp": datetime.now(),
                "target_datetime": target_datetime  # Store for TTL calculation
            }
            logger.info(f"[CACHE STORE] Stored wind data in in-memory cache for {latitude:.4f}, {longitude:.4f} at {target_datetime}")
        
        # Also store in database cache (non-blocking, errors are logged but don't fail)
        _store_in_database_cache(cache_key, latitude, longitude, target_datetime, wind_data)
        
        _cleanup_cache()
        
        return wind_data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching wind data from Open-Meteo for {latitude}, {longitude} at {target_datetime}: {e}")
        # Return cached data even if expired
        if cache_key in _wind_cache:
            logger.info(f"[CACHE HIT - EXPIRED] Returning expired cached data for {latitude:.4f}, {longitude:.4f} at {target_datetime} (API call failed)")
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
    # Validate datetime once before processing all grid points to avoid duplicate warnings
    validated_datetime = target_datetime
    if validated_datetime is None:
        validated_datetime = datetime.now()
    else:
        # Validate date range: only allow up to +2 days ahead
        max_future = datetime.now() + timedelta(days=2)
        if validated_datetime > max_future:
            logger.warning(f"Requested datetime {validated_datetime} is more than 2 days ahead, limiting to {max_future}")
            validated_datetime = max_future
        
        # Don't allow past dates (only current and future up to +2 days)
        if validated_datetime < datetime.now() - timedelta(hours=1):
            logger.warning(f"Requested datetime {validated_datetime} is in the past, using current time")
            validated_datetime = datetime.now()
    
    grid_points = _create_grid_points(bounds, zoom_level)
    wind_data_points = []
    
    logger.info(f"Fetching wind data for {len(grid_points)} grid points at {validated_datetime or 'current time'}")
    
    # OPTIMIZATION #3: Group grid points by cache key (0.1° grid cell) before API calls
    # This reduces API calls by reusing cached data or making one call per cache cell
    from collections import defaultdict
    points_by_cache_key = defaultdict(list)
    
    for lat, lon in grid_points:
        # Generate cache key for this point (rounded to 0.1°)
        cache_key = _generate_cache_key(lat, lon, target_datetime=validated_datetime)
        points_by_cache_key[cache_key].append((lat, lon))
    
    logger.debug(f"Grouped {len(grid_points)} grid points into {len(points_by_cache_key)} cache cells")
    
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
    
    # Process points grouped by cache key
    for cache_key, points_in_cell in points_by_cache_key.items():
        # Use the first point in the cell as representative for API call
        # All points in the same 0.1° cell will use the same cached data
        representative_lat, representative_lon = points_in_cell[0]
        
        # Fetch wind data for representative point (will use cache if available)
        # Pass validated datetime to avoid duplicate validation and warnings
        wind_data = fetch_wind_data_single_point(representative_lat, representative_lon, validated_datetime, skip_validation=True)
        
        if wind_data:
            # Apply the same wind data to all points in this cache cell
            for lat, lon in points_in_cell:
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

