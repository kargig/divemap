from typing import Any

from sqlalchemy import String, and_, func, or_
from sqlalchemy.orm import Session, aliased, joinedload

from app.geo_utils import (
    calculate_directional_bounds,
    get_empirical_region_bounds,
    get_external_region_bounds,
    get_location_info_from_coords,
)
from app.models import (
    AvailableTag,
    CenterDiveSite,
    CertificationLevel,
    Dive,
    DiveRoute,
    DiveSite,
    DiveSiteTag,
    DivingCenter,
    DivingOrganization,
    GearRentalCost,
    ParsedDive,
    ParsedDiveTrip,
    SiteRating,
    User,
)
from app.routers.search import ENTITY_ICONS
from app.schemas.chat import IntentType


def clean_results(results: list[dict]) -> list[dict]:
    """Ensures all objects in the results list are JSON serializable (converts Enums to strings)."""
    import enum

    def clean_obj(obj):
        if isinstance(obj, list):
            return [clean_obj(x) for x in obj]
        if isinstance(obj, dict):
            return {k: clean_obj(v) for k, v in obj.items()}
        if isinstance(obj, enum.Enum):
            return obj.value
        if hasattr(obj, "value"):  # SQLAlchemy Enum members
            return obj.value
        return obj

    return [clean_obj(r) for r in results]
