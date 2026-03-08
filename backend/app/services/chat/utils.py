import logging
import uuid
from datetime import datetime, date, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from urllib.parse import quote

from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import or_, and_, func

from app.services.openai_service import openai_service
from app.schemas.chat import SearchIntent, ChatMessage, ChatRequest, ChatResponse, IntentType
from app.models import (
    DiveSite, ParsedDiveTrip, User, CertificationLevel, DivingCenter, ParsedDive,
    ChatSession, ChatMessage as ChatMessageModel, CenterDiveSite,
    AvailableTag, DiveSiteTag, Dive, UserCertification, GearRentalCost, SiteRating, DivingOrganization
)
from app.routers.search import search_dive_sites, ENTITY_ICONS
from app.services.open_meteo_service import fetch_wind_data_batch
from app.services.wind_recommendation_service import calculate_wind_suitability
from app.geo_utils import (
    get_external_region_bounds, get_empirical_region_bounds, 
    calculate_directional_bounds, get_location_info_from_coords, get_country_from_ip
)

logger = logging.getLogger(__name__)

from app.physics import (
    calculate_mod, calculate_sac, calculate_best_mix, 
    calculate_min_gas, calculate_ead, calculate_end, GasMix
)

def degrees_to_cardinal(d):
    """
    Convert degrees to cardinal direction (N, NE, E, etc.)
    """
    if d is None:
        return "Unknown"
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    ix = round(d / (360. / len(dirs)))
    return dirs[ix % len(dirs)]
    """
    Convert degrees to cardinal direction (N, NE, E, etc.)
    """
    if d is None:
        return "Unknown"
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    ix = round(d / (360. / len(dirs)))
    return dirs[ix % len(dirs)]
