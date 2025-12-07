"""
Weather API Router

Endpoints for fetching weather data, specifically wind conditions for dive sites.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

from app.database import get_db
from app.auth import get_current_user_optional
from app.services.open_meteo_service import fetch_wind_data_single_point, fetch_wind_data_grid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class WindDataPoint(BaseModel):
    """Single wind data point"""
    lat: float
    lon: float
    wind_speed_10m: Optional[float] = None  # m/s
    wind_direction_10m: Optional[float] = None  # degrees
    wind_gusts_10m: Optional[float] = None  # m/s
    timestamp: Optional[str] = None


class WindDataResponse(BaseModel):
    """Response containing wind data points and metadata"""
    points: List[WindDataPoint]
    data_age_seconds: Optional[int] = None
    grid_resolution: Optional[str] = None
    point_count: int


@router.get("/wind", response_model=WindDataResponse)
async def get_wind_data(
    request: Request,
    latitude: Optional[float] = Query(None, ge=-90, le=90, description="Latitude for single point query"),
    longitude: Optional[float] = Query(None, ge=-180, le=180, description="Longitude for single point query"),
    north: Optional[float] = Query(None, ge=-90, le=90, description="North bound for area query"),
    south: Optional[float] = Query(None, ge=-90, le=90, description="South bound for area query"),
    east: Optional[float] = Query(None, ge=-180, le=180, description="East bound for area query"),
    west: Optional[float] = Query(None, ge=-180, le=180, description="West bound for area query"),
    zoom_level: Optional[int] = Query(None, ge=1, le=20, description="Map zoom level (affects grid density)"),
    datetime_str: Optional[str] = Query(None, description="Target date/time in ISO format (YYYY-MM-DDTHH:MM:SS). Defaults to current time. Max +2 days ahead."),
    jitter_factor: Optional[int] = Query(5, ge=1, le=10, description="Number of jittered variations per grid point (default: 5, max: 10)"),
    current_user: Optional = Depends(get_current_user_optional)
):
    """
    Fetch wind data from Open-Meteo API.
    
    Supports two modes:
    1. Single point: Provide latitude and longitude
    2. Grid/area: Provide bounds (north, south, east, west) and optional zoom_level
    
    Date/time parameter:
    - If not provided, fetches current weather data
    - If provided, fetches forecast for that date/time (max +2 days ahead)
    - Format: ISO 8601 (e.g., "2025-12-01T14:00:00")
    
    Returns array of wind data points with speed, direction, and gusts.
    """
    try:
        # Parse target datetime if provided
        target_datetime = None
        if datetime_str:
            try:
                target_datetime = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
                # Validate date range: only allow up to +2 days ahead
                # Round max_future to next hour to allow selecting any hour within 2-day window
                now = datetime.now()
                max_future = (now + timedelta(days=2)).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                if target_datetime > max_future:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Date/time cannot be more than 2 days ahead. Maximum allowed: {max_future.isoformat()}"
                    )
                # Don't allow past dates (only current and future up to +2 days)
                if target_datetime < datetime.now() - timedelta(hours=1):
                    raise HTTPException(
                        status_code=400,
                        detail="Date/time cannot be more than 1 hour in the past"
                    )
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid datetime format. Use ISO 8601 format (e.g., '2025-12-01T14:00:00'): {str(e)}"
                )
        
        # Validate input: must have either (lat, lon) or bounds
        if latitude is not None and longitude is not None:
            # Single point query
            wind_data = fetch_wind_data_single_point(latitude, longitude, target_datetime)
            if not wind_data:
                raise HTTPException(
                    status_code=503,
                    detail="Failed to fetch wind data from weather service"
                )
            
            points = [WindDataPoint(
                lat=latitude,
                lon=longitude,
                wind_speed_10m=wind_data.get("wind_speed_10m"),
                wind_direction_10m=wind_data.get("wind_direction_10m"),
                wind_gusts_10m=wind_data.get("wind_gusts_10m"),
                timestamp=wind_data.get("timestamp").isoformat() if wind_data.get("timestamp") else None
            )]
            
            return WindDataResponse(
                points=points,
                point_count=1,
                grid_resolution="single_point"
            )
            
        elif all(x is not None for x in [north, south, east, west]):
            # Grid/area query
            bounds = {
                "north": north,
                "south": south,
                "east": east,
                "west": west
            }
            
            # Validate bounds
            if north <= south:
                raise HTTPException(
                    status_code=400,
                    detail="North bound must be greater than south bound"
                )
            if east <= west:
                raise HTTPException(
                    status_code=400,
                    detail="East bound must be greater than west bound"
                )
            
            wind_data_points = fetch_wind_data_grid(bounds, zoom_level, target_datetime, jitter_factor)
            
            points = [
                WindDataPoint(
                    lat=point["lat"],
                    lon=point["lon"],
                    wind_speed_10m=point.get("wind_speed_10m"),
                    wind_direction_10m=point.get("wind_direction_10m"),
                    wind_gusts_10m=point.get("wind_gusts_10m"),
                    timestamp=point.get("timestamp").isoformat() if point.get("timestamp") else None
                )
                for point in wind_data_points
            ]
            
            return WindDataResponse(
                points=points,
                point_count=len(points),
                grid_resolution=f"adaptive_zoom_{zoom_level}" if zoom_level else "default"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either (latitude, longitude) or bounds (north, south, east, west)"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching wind data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching wind data"
        )

