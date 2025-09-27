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

from .dives_shared import router
from .dives_crud import *
from .dives_admin import *
from .dives_media import *
from .dives_search import *
from .dives_import import *
from .dives_profiles import *
from .dives_utils import *

__all__ = [
    "router",
    # CRUD operations
    "create_dive",
    "get_dives",
    "get_dive",
    "update_dive",
    "delete_dive",
    "get_dive_details",
    "get_dives_count",
    # Admin operations
    "get_all_dives_admin",
    "get_all_dives_count_admin",
    "update_dive_admin",
    "delete_dive_admin",
    # Media operations
    "add_dive_media",
    "get_dive_media",
    "delete_dive_media",
    "add_dive_tag",
    "remove_dive_tag",
    # Search operations
    "search_dives_with_fuzzy",
    # Import operations
    "import_subsurface_xml",
    "confirm_import_dives",
    # Profile operations
    "get_dive_profile",
    "upload_dive_profile",
    "delete_dive_profile",
    "delete_user_profiles",
    # Utility operations
    "storage_health_check",
]
