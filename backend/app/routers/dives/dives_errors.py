"""
Error handling utilities for dives modules.

This module contains common error handling patterns and HTTPException
definitions that are shared across multiple dives modules.
"""

from fastapi import HTTPException, status
from .dives_shared import logger


def raise_dive_not_found(dive_id: int):
    """Raise HTTPException for dive not found."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Dive with id {dive_id} not found"
    )


def raise_dive_site_not_found(dive_site_id: int):
    """Raise HTTPException for dive site not found."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Dive site with id {dive_site_id} not found"
    )


def raise_media_not_found(media_id: int):
    """Raise HTTPException for media not found."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Media with id {media_id} not found"
    )


def raise_tag_not_found(tag_id: int):
    """Raise HTTPException for tag not found."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Tag with id {tag_id} not found"
    )


def raise_unauthorized():
    """Raise HTTPException for unauthorized access."""
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authorized to perform this action"
    )


def raise_forbidden():
    """Raise HTTPException for forbidden access."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden to perform this action"
    )


def raise_validation_error(message: str):
    """Raise HTTPException for validation error."""
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=message
    )


def raise_internal_error(message: str = "Internal server error"):
    """Raise HTTPException for internal server error."""
    logger.error(message)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=message
    )
