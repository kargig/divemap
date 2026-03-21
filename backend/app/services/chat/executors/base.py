from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import or_, and_, func, String
from app.models import (
    DiveSite, ParsedDiveTrip, DivingCenter, ParsedDive, CenterDiveSite, 
    AvailableTag, DiveSiteTag, Dive, GearRentalCost, SiteRating,
    DivingOrganization, CertificationLevel, User, DiveRoute
)
from app.schemas.chat import SearchIntent, IntentType
from app.routers.search import ENTITY_ICONS
from app.geo_utils import (
    get_external_region_bounds, get_empirical_region_bounds, 
    calculate_directional_bounds, get_location_info_from_coords
)

def clean_results(results: List[Dict]) -> List[Dict]:
    """Ensures all objects in the results list are JSON serializable (converts Enums to strings)."""
    import enum
    def clean_obj(obj):
        if isinstance(obj, list):
            return [clean_obj(x) for x in obj]
        if isinstance(obj, dict):
            return {k: clean_obj(v) for k, v in obj.items()}
        if isinstance(obj, enum.Enum):
            return obj.value
        if hasattr(obj, 'value'): # SQLAlchemy Enum members
            return obj.value
        return obj
    return [clean_obj(r) for r in results]
