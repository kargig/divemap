"""
Validation utilities for dives modules.

This module contains common validation functions and utilities
that are shared across multiple dives modules.
"""

from datetime import date, time
from typing import Optional
from fastapi import HTTPException, status
from .dives_shared import logger


def raise_validation_error(message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
    """Raise a validation error with the given message."""
    raise HTTPException(status_code=status_code, detail=message)


def validate_dive_date(dive_date: date) -> bool:
    """Validate dive date is not in the future."""
    from datetime import date
    return dive_date <= date.today()


def validate_dive_time(dive_time: Optional[time]) -> bool:
    """Validate dive time is reasonable."""
    if dive_time is None:
        return True
    # Basic validation - could be expanded
    return True


def validate_depth(depth: Optional[float]) -> bool:
    """Validate dive depth is reasonable."""
    if depth is None:
        return True
    return 0 <= depth <= 200  # Reasonable depth range


def validate_duration(duration: Optional[int]) -> bool:
    """Validate dive duration is reasonable."""
    if duration is None:
        return True
    return 0 <= duration <= 600  # 10 hours max


def validate_rating(rating: Optional[int]) -> bool:
    """Validate dive rating is in valid range."""
    if rating is None:
        return True
    return 1 <= rating <= 5


def validate_visibility(visibility: Optional[float]) -> bool:
    """Validate visibility is reasonable."""
    if visibility is None:
        return True
    return 0 <= visibility <= 100  # meters


def validate_temperature(temperature: Optional[float]) -> bool:
    """Validate water temperature is reasonable."""
    if temperature is None:
        return True
    return -5 <= temperature <= 40  # Celsius range
