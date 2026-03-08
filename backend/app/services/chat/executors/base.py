from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import or_, and_, func
from app.models import (
    DiveSite, ParsedDiveTrip, DivingCenter, ParsedDive, CenterDiveSite, 
    AvailableTag, DiveSiteTag, Dive, GearRentalCost, SiteRating,
    DivingOrganization, CertificationLevel, User
)
from app.schemas.chat import SearchIntent, IntentType
from app.geo_utils import (
    get_external_region_bounds, get_empirical_region_bounds, 
    calculate_directional_bounds, get_location_info_from_coords
)
