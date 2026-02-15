"""
Global Search API Router

Provides unified search endpoint that searches across all entity types
(dive sites, diving centers, dives, dive routes, dive trips) simultaneously.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import (
    DiveSite, DiveSiteAlias, DivingCenter, Dive, DiveRoute,
    ParsedDiveTrip, ParsedDive, User, AvailableTag, DiveSiteTag
)
from app.schemas import (
    GlobalSearchResponse, GlobalSearchResult, EntityTypeSearchResults
)
from app.auth import get_current_user_optional
from app.limiter import skip_rate_limit_for_admin

router = APIRouter()

# Icon mappings for entity types
ENTITY_ICONS = {
    "dive_site": "Map",
    "diving_center": "Building",
    "dive": "Anchor",
    "dive_route": "Route",
    "dive_trip": "Calendar"
}


def search_dive_sites(query: str, limit: int, db: Session) -> List[GlobalSearchResult]:
    """Search dive sites by name, country, region, description, and aliases"""
    sanitized_query = query.strip()[:200]
    
    search_filter = or_(
        DiveSite.name.ilike(f"%{sanitized_query}%"),
        DiveSite.country.ilike(f"%{sanitized_query}%"),
        DiveSite.region.ilike(f"%{sanitized_query}%"),
        and_(DiveSite.description.isnot(None), DiveSite.description.ilike(f"%{sanitized_query}%")),
        DiveSite.id.in_(
            db.query(DiveSiteAlias.dive_site_id).filter(
                DiveSiteAlias.alias.ilike(f"%{sanitized_query}%")
            )
        ),
        # Add tag search
        DiveSite.id.in_(
            db.query(DiveSiteTag.dive_site_id)
            .join(AvailableTag, DiveSiteTag.tag_id == AvailableTag.id)
            .filter(AvailableTag.name.ilike(f"%{sanitized_query}%"))
        )
    )
    
    sites = db.query(DiveSite).filter(search_filter).limit(limit).all()
    
    results = []
    for site in sites:
        metadata = {}
        if site.country:
            metadata["country"] = site.country
        if site.region:
            metadata["region"] = site.region
        if site.max_depth:
            metadata["max_depth"] = float(site.max_depth)
        
        results.append(GlobalSearchResult(
            entity_type="dive_site",
            id=site.id,
            name=site.name,
            route_path=f"/dive-sites/{site.id}",
            icon_name=ENTITY_ICONS["dive_site"],
            metadata=metadata if metadata else None
        ))
    
    return results


def search_diving_centers(query: str, limit: int, db: Session) -> List[GlobalSearchResult]:
    """Search diving centers by name, description, country, region, city"""
    sanitized_query = query.strip()[:200]
    
    search_filter = or_(
        DivingCenter.name.ilike(f"%{sanitized_query}%"),
        and_(DivingCenter.description.isnot(None), DivingCenter.description.ilike(f"%{sanitized_query}%")),
        and_(DivingCenter.country.isnot(None), DivingCenter.country.ilike(f"%{sanitized_query}%")),
        and_(DivingCenter.region.isnot(None), DivingCenter.region.ilike(f"%{sanitized_query}%")),
        and_(DivingCenter.city.isnot(None), DivingCenter.city.ilike(f"%{sanitized_query}%"))
    )
    
    centers = db.query(DivingCenter).filter(search_filter).limit(limit).all()
    
    results = []
    for center in centers:
        metadata = {}
        if center.country:
            metadata["country"] = center.country
        if center.region:
            metadata["region"] = center.region
        if center.city:
            metadata["city"] = center.city
        
        results.append(GlobalSearchResult(
            entity_type="diving_center",
            id=center.id,
            name=center.name,
            route_path=f"/diving-centers/{center.id}",
            icon_name=ENTITY_ICONS["diving_center"],
            metadata=metadata if metadata else None
        ))
    
    return results


def search_dives(query: str, limit: int, db: Session, current_user: Optional[User] = None) -> List[GlobalSearchResult]:
    """Search dives by dive site name, description, and dive information"""
    sanitized_query = query.strip()[:200]
    
    # Join with DiveSite for search
    search_filter = or_(
        Dive.dive_information.ilike(f"%{sanitized_query}%"),
        Dive.id.in_(
            db.query(Dive.id)
            .join(DiveSite, Dive.dive_site_id == DiveSite.id)
            .filter(
                or_(
                    DiveSite.name.ilike(f"%{sanitized_query}%"),
                    and_(DiveSite.description.isnot(None), DiveSite.description.ilike(f"%{sanitized_query}%"))
                )
            )
        )
    )
    
    # Base query - only public dives for non-authenticated users
    dive_query = db.query(Dive).filter(search_filter)
    
    if current_user:
        # Authenticated users can see their own private dives
        dive_query = dive_query.filter(
            or_(Dive.is_private == False, Dive.user_id == current_user.id)
        )
    else:
        # Non-authenticated users only see public dives
        dive_query = dive_query.filter(Dive.is_private == False)
    
    dives = dive_query.join(DiveSite, Dive.dive_site_id == DiveSite.id).limit(limit).all()
    
    results = []
    for dive in dives:
        metadata = {}
        if dive.dive_date:
            metadata["dive_date"] = str(dive.dive_date)
        if dive.max_depth:
            metadata["max_depth"] = float(dive.max_depth)
        if dive.dive_site:
            metadata["dive_site_name"] = dive.dive_site.name
        
        results.append(GlobalSearchResult(
            entity_type="dive",
            id=dive.id,
            name=dive.name or f"Dive at {dive.dive_site.name if dive.dive_site else 'Unknown Site'}" if dive.dive_site else f"Dive on {dive.dive_date}",
            route_path=f"/dives/{dive.id}",
            icon_name=ENTITY_ICONS["dive"],
            metadata=metadata if metadata else None
        ))
    
    return results


def search_dive_routes(query: str, limit: int, db: Session) -> List[GlobalSearchResult]:
    """Search dive routes by name and description"""
    sanitized_query = query.strip()[:200]
    
    search_filter = or_(
        DiveRoute.name.ilike(f"%{sanitized_query}%"),
        and_(DiveRoute.description.isnot(None), DiveRoute.description.ilike(f"%{sanitized_query}%"))
    )
    
    routes = db.query(DiveRoute).filter(
        and_(search_filter, DiveRoute.deleted_at.is_(None))
    ).options(joinedload(DiveRoute.dive_site)).limit(limit).all()
    
    results = []
    for route in routes:
        metadata = {}
        if route.dive_site:
            metadata["dive_site_id"] = route.dive_site.id
            metadata["dive_site_name"] = route.dive_site.name
        if route.route_type:
            metadata["route_type"] = route.route_type
        
        dive_site_id = route.dive_site_id if route.dive_site else None
        if dive_site_id:
            route_path = f"/dive-sites/{dive_site_id}/route/{route.id}"
        else:
            # Fallback if dive_site is missing
            route_path = f"/dive-routes/{route.id}"
        
        results.append(GlobalSearchResult(
            entity_type="dive_route",
            id=route.id,
            name=route.name,
            route_path=route_path,
            icon_name=ENTITY_ICONS["dive_route"],
            metadata=metadata if metadata else None
        ))
    
    return results


def search_dive_trips(query: str, limit: int, db: Session) -> List[GlobalSearchResult]:
    """Search dive trips by description, special requirements, diving center name, dive site names"""
    sanitized_query = query.strip()[:200]
    search_term = f"%{sanitized_query}%"
    
    # Search in trip description, special requirements, diving center name, and dive site names
    from app.models import DivingCenter, DiveSite as DS
    trips_query = db.query(ParsedDiveTrip).options(
        joinedload(ParsedDiveTrip.diving_center),
        joinedload(ParsedDiveTrip.dives).joinedload(ParsedDive.dive_site)
    )
    
    search_filter = or_(
        and_(ParsedDiveTrip.trip_description.isnot(None), ParsedDiveTrip.trip_description.ilike(search_term)),
        and_(ParsedDiveTrip.special_requirements.isnot(None), ParsedDiveTrip.special_requirements.ilike(search_term)),
        ParsedDiveTrip.diving_center.has(DivingCenter.name.ilike(search_term)),
        ParsedDiveTrip.dives.any(ParsedDive.dive_site.has(DS.name.ilike(search_term))),
        ParsedDiveTrip.dives.any(ParsedDive.dive_description.ilike(search_term))
    )
    
    trips = trips_query.filter(search_filter).limit(limit).all()
    
    results = []
    for trip in trips:
        metadata = {}
        if trip.trip_date:
            metadata["trip_date"] = str(trip.trip_date)
        if trip.diving_center:
            metadata["diving_center_name"] = trip.diving_center.name
        if trip.trip_price:
            metadata["trip_price"] = float(trip.trip_price)
            metadata["trip_currency"] = trip.trip_currency
        
        # Generate trip name - use description or fallback
        trip_name = trip.trip_description
        if not trip_name and trip.diving_center:
            trip_name = f"{trip.diving_center.name} Trip"
        if not trip_name and trip.trip_date:
            trip_name = f"Trip on {trip.trip_date}"
        if not trip_name:
            trip_name = f"Trip {trip.id}"
        
        results.append(GlobalSearchResult(
            entity_type="dive_trip",
            id=trip.id,
            name=trip_name,
            route_path=f"/dive-trips/{trip.id}",
            icon_name=ENTITY_ICONS["dive_trip"],
            metadata=metadata if metadata else None
        ))
    
    return results


@router.get("/", response_model=GlobalSearchResponse)
@skip_rate_limit_for_admin("150/minute")
async def global_search(
    request: Request,
    q: str = Query(..., min_length=3, max_length=200, description="Search query (minimum 3 characters)"),
    limit: int = Query(8, ge=1, le=20, description="Maximum results per entity type"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Global search across all entity types: dive sites, diving centers, dives, dive routes, and dive trips.
    
    Returns grouped results by entity type with metadata for frontend rendering.
    """
    # Sanitize and validate query
    query = q.strip()
    if len(query) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 3 characters"
        )
    
    # Execute searches sequentially (SQLAlchemy sessions are not thread-safe)
    # Each search is optimized with indexes, so sequential execution is still fast
    results_dict = {
        "dive_site": [],
        "diving_center": [],
        "dive": [],
        "dive_route": [],
        "dive_trip": []
    }
    
    # Run all searches, handling errors gracefully
    search_functions = [
        ("dive_site", lambda: search_dive_sites(query, limit, db)),
        ("diving_center", lambda: search_diving_centers(query, limit, db)),
        ("dive", lambda: search_dives(query, limit, db, current_user)),
        ("dive_route", lambda: search_dive_routes(query, limit, db)),
        ("dive_trip", lambda: search_dive_trips(query, limit, db))
    ]
    
    for entity_type, search_func in search_functions:
        try:
            results_dict[entity_type] = search_func()
        except Exception as e:
            # Log error but continue with other searches
            print(f"Error searching {entity_type}: {str(e)}")
            results_dict[entity_type] = []
    
    # Build response grouped by entity type
    grouped_results = []
    total_count = 0
    
    entity_order = ["dive_site", "diving_center", "dive", "dive_route", "dive_trip"]
    for entity_type in entity_order:
        results = results_dict.get(entity_type, [])
        if results:  # Only include entity types with results
            grouped_results.append(EntityTypeSearchResults(
                entity_type=entity_type,
                icon_name=ENTITY_ICONS[entity_type],
                count=len(results),
                results=results
            ))
            total_count += len(results)
    
    return GlobalSearchResponse(
        query=query,
        results=grouped_results,
        total_count=total_count
    )

