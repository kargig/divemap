"""
Logging utilities for dives modules.

This module contains common logging patterns and utilities
that are shared across multiple dives modules.
"""

import logging
from typing import Any, Dict, Optional
from .dives_shared import logger


def log_dive_operation(operation: str, dive_id: int, user_id: int, **kwargs):
    """Log dive operations with consistent format."""
    logger.info(f"Dive {operation}: dive_id={dive_id}, user_id={user_id}, {kwargs}")


def log_admin_operation(operation: str, admin_user_id: int, target_id: int, **kwargs):
    """Log admin operations with consistent format."""
    logger.info(f"Admin {operation}: admin_user_id={admin_user_id}, target_id={target_id}, {kwargs}")


def log_import_operation(operation: str, user_id: int, file_count: int, **kwargs):
    """Log import operations with consistent format."""
    logger.info(f"Import {operation}: user_id={user_id}, file_count={file_count}, {kwargs}")


def log_error(operation: str, error: Exception, user_id: Optional[int] = None, **kwargs):
    """Log errors with consistent format."""
    logger.error(f"Error in {operation}: {str(error)}, user_id={user_id}, {kwargs}")


def log_performance(operation: str, duration_ms: float, **kwargs):
    """Log performance metrics with consistent format."""
    logger.info(f"Performance {operation}: duration={duration_ms}ms, {kwargs}")


def log_security_event(event: str, user_id: Optional[int] = None, ip_address: Optional[str] = None, **kwargs):
    """Log security events with consistent format."""
    logger.warning(f"Security {event}: user_id={user_id}, ip={ip_address}, {kwargs}")
