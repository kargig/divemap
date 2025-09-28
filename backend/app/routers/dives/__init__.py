"""
Dives router module - refactored from monolithic dives.py

This module contains the refactored dives router split into focused modules:
- dives_crud: Core CRUD operations
- dives_admin: Admin operations
- dives_media: Media and tag operations
- dives_search: Search functionality
- dives_import: Subsurface XML import
- dives_profiles: Dive profile management
- dives_utils: Utility functions
- dives_shared: Shared imports and constants
- dives_db_utils: Database utilities
- dives_validation: Validation functions
- dives_errors: Error handling
- dives_logging: Logging utilities
"""

from .dives_shared import router, r2_storage
from . import dives_crud
from . import dives_admin
from . import dives_media
from . import dives_search
from . import dives_import
from . import dives_profiles
from . import dives_utils

__all__ = [
    "router",
    "r2_storage",
]