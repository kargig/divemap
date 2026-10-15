"""
Shared imports, constants, and configuration for dives modules.

This module contains all the common imports, constants, and shared configuration
that will be used across all dives modules to avoid duplication.
"""

import json
import logging
import os
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, time
from difflib import SequenceMatcher
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.auth import (
    get_current_active_user,
    get_current_admin_user,
    get_current_user,
    get_current_user_optional,
)
from app.database import get_db
from app.models import (
    AvailableTag,
    Dive,
    DiveBuddy,
    DiveMedia,
    DiveSite,
    DiveSiteAlias,
    DiveTag,
    DivingCenter,
    User,
)
from app.schemas import (
    DiveCreate,
    DiveMediaCreate,
    DiveMediaResponse,
    DiveResponse,
    DiveSearchParams,
    DiveTagCreate,
    DiveTagResponse,
    DiveUpdate,
)
from app.services.r2_storage_service import r2_storage
from app.utils import (
    UNIFIED_TYPO_TOLERANCE,
    calculate_unified_phrase_aware_score,
    classify_match_type,
    get_unified_fuzzy_trigger_conditions,
)

# Main router instance
router = APIRouter()

# Shared constants
UNIFIED_TYPO_TOLERANCE = UNIFIED_TYPO_TOLERANCE

# Logging configuration
logger = logging.getLogger(__name__)
