import logging
import math
import os

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import DiveSite

logger = logging.getLogger(__name__)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two points using Haversine formula."""
    R = 6371.0  # Earth radius in km

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def get_external_region_bounds(
    region_name: str,
) -> tuple[tuple[float, float, float, float], str] | None:
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

        params = {"q": query, "format": "json", "limit": 1, "addressdetails": 1}
        headers = {
            "User-Agent": "Divemap-Backend/1.0 (info@divemap.blue)"  # Nominatim requires a User-Agent
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

                logger.info(
                    f"Resolved external bounds for '{query}': N={north}, S={south}, E={east}, W={west}"
                )
                return ((north, south, east, west), display_name)

        logger.warning(f"No external bounds found for region '{query}'")
        return None
    except Exception as e:
        logger.error(f"Error fetching external bounds for '{region_name}': {e}")
        return None


def get_empirical_region_bounds(
    db: Session, region_name: str
) -> tuple[float, float, float, float] | None:
    """
    Fallback method: Finds the bounding box based on existing dive sites matching the region name.
    """
    try:
        # We look for matches in region, country, or city (via address or just broadly)
        result = (
            db.query(
                func.max(DiveSite.latitude).label("north"),
                func.min(DiveSite.latitude).label("south"),
                func.max(DiveSite.longitude).label("east"),
                func.min(DiveSite.longitude).label("west"),
            )
            .filter(
                (DiveSite.region.ilike(f"%{region_name}%"))
                | (DiveSite.country.ilike(f"%{region_name}%"))
                | (
                    DiveSite.name.ilike(f"%{region_name}%")
                )  # Sometimes sites have city in the name
            )
            .first()
        )

        if result and result.north is not None and result.south is not None:
            # Add a tiny buffer so it's not a zero-area box if there's only 1 site
            buffer = 0.05
            north = float(result.north) + buffer
            south = float(result.south) - buffer
            east = float(result.east) + buffer
            west = float(result.west) - buffer

            logger.info(
                f"Resolved empirical bounds for '{region_name}': N={north}, S={south}, E={east}, W={west}"
            )
            return (north, south, east, west)

        return None
    except Exception as e:
        logger.error(f"Error calculating empirical bounds for '{region_name}': {e}")
        return None


def clean_regional_unit(text: str | None) -> str | None:
    """Strips verbose suffixes like 'Regional Unit' from administrative region names."""
    if text:
        if text.endswith(" Regional Unit"):
            return text[: -len(" Regional Unit")].strip()
        elif text.endswith("Regional Unit"):
            return text[: -len("Regional Unit")].strip()
        return text.strip()
    return text


def perform_reverse_geocode(latitude: float, longitude: float) -> dict[str, str | None]:
    """
    3-tier reverse geocoder resolving country, region, and city from coordinates:
    Tier 1: Geoapify (if GEOAPIFY_KEY is set in environment)
    Tier 2: Photon (Komoot)
    Tier 3: OpenStreetMap Nominatim
    """
    result = {
        "country": None,
        "region": None,
        "county": None,
        "state": None,
        "city": None,
        "suburb": None,
    }

    timeout_errors = []
    connection_errors = []
    attempts = 0

    # 1. Tier 1: Geoapify
    geoapify_key = os.getenv("GEOAPIFY_KEY")
    if geoapify_key:
        attempts += 1
        try:
            url = "https://api.geoapify.com/v1/geocode/reverse"
            params = {
                "lat": latitude,
                "lon": longitude,
                "apiKey": geoapify_key,
                "lang": "en",
            }
            resp = requests.get(url, params=params, timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                if features:
                    props = features[0].get("properties", {})
                    country = props.get("country")
                    state = clean_regional_unit(props.get("state"))
                    county = clean_regional_unit(props.get("county"))
                    city = (
                        props.get("city")
                        or props.get("municipality")
                        or props.get("town")
                    )

                    region = state or county or props.get("region")

                    result.update(
                        {
                            "country": country,
                            "region": region,
                            "county": county,
                            "state": state,
                            "city": city,
                            "suburb": props.get("suburb"),
                        }
                    )
                    if result["country"]:
                        logger.debug("Geoapify reverse geocoding succeeded")
                        return result
        except requests.exceptions.Timeout as e:
            timeout_errors.append(e)
            logger.warning("Geoapify reverse geocoding timed out")
        except requests.exceptions.ConnectionError as e:
            connection_errors.append(e)
            logger.warning("Geoapify reverse geocoding connection error")
        except Exception as e:
            logger.warning(f"Geoapify reverse geocoding failed: {e}")

    # 2. Tier 2: Photon (Komoot)
    attempts += 1
    try:
        url = "https://photon.komoot.io/reverse"
        params = {"lat": latitude, "lon": longitude, "lang": "en"}
        headers = {"User-Agent": "Divemap-Backend/1.0 (info@divemap.blue)"}
        resp = requests.get(url, params=params, headers=headers, timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                props = features[0].get("properties", {})
                country = props.get("country")
                state = clean_regional_unit(props.get("state"))
                county = clean_regional_unit(props.get("county"))
                city = (
                    props.get("city") or props.get("district") or props.get("locality")
                )

                region = state or county or props.get("region")

                result.update(
                    {
                        "country": country,
                        "region": region,
                        "county": county,
                        "state": state,
                        "city": city,
                    }
                )
                if result["country"]:
                    logger.debug("Photon reverse geocoding succeeded")
                    return result
    except requests.exceptions.Timeout as e:
        timeout_errors.append(e)
        logger.warning("Photon reverse geocoding timed out")
    except requests.exceptions.ConnectionError as e:
        connection_errors.append(e)
        logger.warning("Photon reverse geocoding connection error")
    except Exception as e:
        logger.warning(f"Photon reverse geocoding failed: {e}")

    # 3. Tier 3: Nominatim (OpenStreetMap)
    attempts += 1
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "addressdetails": 1,
            "zoom": 8,
            "accept-language": "en",
        }
        headers = {"User-Agent": "Divemap-Backend/1.0 (info@divemap.blue)"}
        resp = requests.get(url, params=params, headers=headers, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            address = data.get("address", {})

            country = address.get("country")
            county = clean_regional_unit(address.get("county"))
            state_district = clean_regional_unit(address.get("state_district"))
            state = clean_regional_unit(address.get("state"))

            if county and state_district:
                region = f"{county}, {state_district}"
            else:
                region = (
                    state
                    or clean_regional_unit(address.get("province"))
                    or clean_regional_unit(address.get("region"))
                    or county
                )

            city = (
                address.get("city")
                or address.get("town")
                or address.get("village")
                or address.get("municipality")
            )

            result.update(
                {
                    "country": country,
                    "region": region,
                    "county": county,
                    "state": state,
                    "city": city,
                    "suburb": address.get("suburb"),
                }
            )
            if result["country"]:
                logger.debug("Nominatim reverse geocoding succeeded")
                return result
    except requests.exceptions.Timeout as e:
        timeout_errors.append(e)
        logger.warning("Nominatim reverse geocoding timed out")
    except requests.exceptions.ConnectionError as e:
        connection_errors.append(e)
        logger.warning("Nominatim reverse geocoding connection error")
    except Exception as e:
        logger.error(f"Nominatim reverse geocoding failed: {e}")

    if attempts > 0 and len(timeout_errors) == attempts:
        raise timeout_errors[0]
    if attempts > 0 and len(connection_errors) == attempts:
        raise connection_errors[0]

    return result


def search_places(
    query: str,
    lat: float | None = None,
    lon: float | None = None,
    limit: int = 5,
) -> list[dict]:
    """
    3-tier forward place search:
    Tier 1: Geoapify Autocomplete (if GEOAPIFY_KEY is set in environment)
    Tier 2: Photon (Komoot)
    Tier 3: OpenStreetMap Nominatim
    """
    clean_q = (query or "").strip()
    if not clean_q:
        return []

    # 1. Tier 1: Geoapify Autocomplete
    geoapify_key = os.getenv("GEOAPIFY_KEY")
    if geoapify_key:
        try:
            url = "https://api.geoapify.com/v1/geocode/autocomplete"
            params = {
                "text": clean_q,
                "apiKey": geoapify_key,
                "limit": limit,
            }
            if lat is not None and lon is not None:
                params["bias"] = f"proximity:{lon},{lat}"

            resp = requests.get(url, params=params, timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                if features:
                    results = []
                    for f in features:
                        p = f.get("properties", {})
                        coords = f.get("geometry", {}).get("coordinates", [0, 0])
                        results.append(
                            {
                                "display_name": p.get("formatted")
                                or p.get("name")
                                or clean_q,
                                "name": p.get("name") or p.get("city") or clean_q,
                                "latitude": coords[1],
                                "longitude": coords[0],
                                "country": p.get("country"),
                                "region": clean_regional_unit(
                                    p.get("state") or p.get("county")
                                ),
                                "type": p.get("result_type"),
                            }
                        )
                    logger.debug(f"Geoapify place search found {len(results)} items")
                    return results
        except Exception as e:
            logger.warning(f"Geoapify search failed: {e}")

    # 2. Tier 2: Photon (Komoot)
    try:
        url = "https://photon.komoot.io/api/"
        params = {"q": clean_q, "limit": limit, "lang": "en"}
        if lat is not None and lon is not None:
            params["lat"] = lat
            params["lon"] = lon

        headers = {"User-Agent": "Divemap-Backend/1.0 (info@divemap.blue)"}
        resp = requests.get(url, params=params, headers=headers, timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                results = []
                for f in features:
                    p = f.get("properties", {})
                    coords = f.get("geometry", {}).get("coordinates", [0, 0])
                    parts = [
                        p.get("name"),
                        p.get("city"),
                        p.get("state"),
                        p.get("country"),
                    ]
                    display_name = ", ".join(filter(None, parts))
                    results.append(
                        {
                            "display_name": display_name,
                            "name": p.get("name") or clean_q,
                            "latitude": coords[1],
                            "longitude": coords[0],
                            "country": p.get("country"),
                            "region": clean_regional_unit(
                                p.get("state") or p.get("county")
                            ),
                            "type": p.get("type") or p.get("osm_value"),
                        }
                    )
                logger.debug(f"Photon place search found {len(results)} items")
                return results
    except Exception as e:
        logger.warning(f"Photon search failed: {e}")

    # 3. Tier 3: Nominatim (OpenStreetMap)
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": clean_q,
            "format": "json",
            "limit": limit,
            "addressdetails": 1,
            "accept-language": "en",
        }
        headers = {"User-Agent": "Divemap-Backend/1.0 (info@divemap.blue)"}
        resp = requests.get(url, params=params, headers=headers, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                results = []
                for d in data:
                    addr = d.get("address", {})
                    results.append(
                        {
                            "display_name": d.get("display_name"),
                            "name": d.get("display_name", "").split(",")[0],
                            "latitude": float(d["lat"]),
                            "longitude": float(d["lon"]),
                            "country": addr.get("country"),
                            "region": clean_regional_unit(
                                addr.get("state") or addr.get("county")
                            ),
                            "type": d.get("addresstype") or d.get("type"),
                        }
                    )
                logger.debug(f"Nominatim place search found {len(results)} items")
                return results
    except Exception as e:
        logger.error(f"Nominatim search failed: {e}")

    return []


def get_location_info_from_coords(lat: float, lon: float) -> dict[str, str | None]:
    """
    Reverse geocodes coordinates to find country and region using the 3-tier geocoder.
    """
    geo = perform_reverse_geocode(lat, lon)
    return {"country": geo.get("country"), "region": geo.get("region")}


def get_country_from_ip(ip: str) -> str | None:
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


def calculate_directional_bounds(
    north: float, south: float, east: float, west: float, direction: str
) -> tuple[float, float, float, float]:
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
