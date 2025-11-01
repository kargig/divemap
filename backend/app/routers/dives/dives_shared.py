"""
Shared imports, constants, and configuration for dives modules.

This module contains all the common imports, constants, and shared configuration
that will be used across all dives modules to avoid duplication.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, date, time
import re
import xml.etree.ElementTree as ET
from io import BytesIO
from difflib import SequenceMatcher
import json
import logging
import os

from app.database import get_db
from app.models import Dive, DiveMedia, DiveTag, DiveSite, AvailableTag, User, DivingCenter, DiveSiteAlias
from app.schemas import (
    DiveCreate, DiveUpdate, DiveResponse, DiveMediaCreate, DiveMediaResponse,
    DiveTagCreate, DiveTagResponse, DiveSearchParams
)
from app.auth import get_current_user, get_current_user_optional, get_current_admin_user
from app.utils import (
    calculate_unified_phrase_aware_score,
    classify_match_type,
    get_unified_fuzzy_trigger_conditions,
    UNIFIED_TYPO_TOLERANCE
)
from app.services.r2_storage_service import r2_storage

# Main router instance
router = APIRouter()

# Shared constants
UNIFIED_TYPO_TOLERANCE = UNIFIED_TYPO_TOLERANCE

# Logging configuration
logger = logging.getLogger(__name__)