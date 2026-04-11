from .base import *
from app.geo_utils import get_empirical_region_bounds, get_external_region_bounds, calculate_directional_bounds
import logging
from datetime import date as py_date
logger = logging.getLogger(__name__)
    
def execute_discovery(
    db: Session, 
    location: Optional[str] = None,
    parent_region: Optional[str] = None,
    keywords: Optional[List[str]] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: Optional[float] = None,
    direction: Optional[str] = None,
    difficulty_level: Optional[int] = None,
    entity_type_filter: Optional[str] = None,
    date: Optional[str] = None,
    date_range: Optional[List[str]] = None,
    **kwargs
) -> List[Dict]:
    results = []
    limit = 15
    
    # Smart Location Resolution: If location is a specific Dive Site, switch to Spatial Search around it
    if location and not (latitude and longitude):
        # Try to find a dive site with this name
        site_match = db.query(DiveSite).filter(DiveSite.name.ilike(f"{location}")).first()
        
        # If exact match fails, try a fuzzy match by replacing spaces with wildcards
        if not site_match:
            import re
            fuzzy_name = re.sub(r'[\s\-]+', '%', location.strip())
            site_match = db.query(DiveSite).filter(DiveSite.name.ilike(f"%{fuzzy_name}%")).first()
            
        if site_match and site_match.latitude and site_match.longitude:
            logger.info(f"Resolved location '{location}' to DiveSite '{site_match.name}' coordinates.")
            latitude = float(site_match.latitude)
            longitude = float(site_match.longitude)
        else:
            # Fallback to region bounding box geocoding
            bounds = get_empirical_region_bounds(db, location)
            if not bounds:
                res = get_external_region_bounds(location)
                if res:
                    bounds = res[0]
            
            # If we found region bounds, calculate the center point to use as lat/lon for radius searching
            if bounds:
                n, s, e, w = bounds
                latitude = (n + s) / 2.0
                longitude = (e + w) / 2.0
                logger.info(f"Resolved region '{location}' to bounds center ({latitude}, {longitude}).")
                if not radius:
                    from app.geo_utils import calculate_distance
                    # Calculate distance from center to the NE corner
                    dist = calculate_distance(latitude, longitude, n, e)
                    # Clamp radius between 5km (for tiny villages) and 200km (for large regions/countries)
                    radius = max(5.0, min(dist, 200.0))
                    logger.info(f"Dynamically set radius to {radius:.2f}km based on bounding box size.")
            # We don't clear location=None anymore because it might be needed for Trip searches 
            # and other text filters later in the function.
            # Spatial search logic below uses latitude/longitude presence to prioritize radius.
    
    # 1. Search Dive Sites
    if not entity_type_filter or entity_type_filter == 'dive_site':
        from sqlalchemy.orm import selectinload
        search_query = db.query(DiveSite).options(
            joinedload(DiveSite.difficulty),
            selectinload(DiveSite.ratings)
        )
        
        has_filters = False
        spatial_filters = []
        text_filters = []
        
        # 1. Spatial & Directional Search
        if (not entity_type_filter or entity_type_filter == "dive_site") and direction and (location or parent_region):
            has_filters = True
            # Normalize location for better resolution
            loc_res = parent_region if parent_region else location
            
            if loc_res.lower() in ["athens", "atniki", "athina"]:
                loc_res = "Attica" 
        
            bounds = get_empirical_region_bounds(db, loc_res)
            if not bounds:
                res = get_external_region_bounds(loc_res)
                if res:
                    bounds, display_name = res
                    if not parent_region and "," in display_name:
                        parts = [p.strip() for p in display_name.split(",")]
                        if len(parts) >= 3:
                            parent = parts[-2]
                            if parent.lower() in ["greece", "hellas"] and len(parts) >= 4:
                                parent = parts[-3]
                            parent_region = parent
                            p_bounds = get_empirical_region_bounds(db, parent_region)
                            if p_bounds:
                                bounds = p_bounds
            
            if bounds:
                n, s, e, w = bounds
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                spatial_filters = [
                    DiveSite.latitude <= new_n,
                    DiveSite.latitude >= new_s,
                    DiveSite.longitude <= new_e,
                    DiveSite.longitude >= new_w
                ]
        
        if not spatial_filters and latitude and longitude:
            has_filters = True
            radius_km = radius if radius else 20.0
            deg_range = radius_km / 111.0
            
            if direction:
                n = latitude + deg_range
                s = latitude - deg_range
                e = longitude + deg_range
                w = longitude - deg_range
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                spatial_filters = [
                    DiveSite.latitude <= new_n,
                    DiveSite.latitude >= new_s,
                    DiveSite.longitude <= new_e,
                    DiveSite.longitude >= new_w
                ]
            else:
                lat_min, lat_max = latitude - deg_range, latitude + deg_range
                lon_min, lon_max = longitude - deg_range, longitude + deg_range
                spatial_filters = [
                    DiveSite.latitude >= lat_min,
                    DiveSite.latitude <= lat_max,
                    DiveSite.longitude >= lon_min,
                    DiveSite.longitude <= lon_max
                ]
        
        # 2. Text Search (Location Name)
        if location:
            has_filters = True
            loc_term = location.split(',')[0].strip()
            loc_term = loc_term.replace('Greece', '').strip()
            
            loc_variants = [loc_term]
            if loc_term.lower() in ["attiki", "athens"]: loc_variants.append("Attica")
            if loc_term.lower() == "attica": loc_variants.append("Attiki")
            
            for v in loc_variants:
                text_filters.append(DiveSite.region.ilike(f"%{v}%"))
                text_filters.append(DiveSite.country.ilike(f"%{v}%"))
                text_filters.append(DiveSite.description.ilike(f"%{v}%"))
        
        # Combine Spatial and Text filters
        if spatial_filters and text_filters:
            if direction:
                search_query = search_query.filter(and_(*spatial_filters, or_(*text_filters)))
            else:
                search_query = search_query.filter(or_(and_(*spatial_filters), or_(*text_filters)))
        elif spatial_filters:
            search_query = search_query.filter(and_(*spatial_filters))
        elif text_filters:
            search_query = search_query.filter(or_(*text_filters))
        
        # Ordering
        if latitude and longitude:
            search_query = search_query.order_by(
                func.pow(DiveSite.latitude - latitude, 2) + 
                func.pow(DiveSite.longitude - longitude, 2)
            )
        
        if (not entity_type_filter or entity_type_filter == "dive_site") and keywords:
            applied_rating_sort = False
            for kw in keywords:
                clean_kw = kw.lower().strip()
                if clean_kw in ['highest_rated', 'top_rated', 'best']:
                    if not applied_rating_sort:
                        RatingAlias = aliased(SiteRating)
                        search_query = search_query.outerjoin(RatingAlias, DiveSite.ratings).group_by(DiveSite.id)
                        search_query = search_query.order_by(func.avg(RatingAlias.score).desc())
                        applied_rating_sort = True
                        has_filters = True
                    continue 
                
                if clean_kw in ['popular', 'most_popular']:
                    search_query = search_query.order_by(DiveSite.view_count.desc())
                    has_filters = True
                    continue
        
                if clean_kw in ['snorkeling', 'snorkel']:
                    snorkel_tag_subquery = db.query(DiveSiteTag.dive_site_id).join(
                        AvailableTag, DiveSiteTag.tag_id == AvailableTag.id
                    ).filter(
                        or_(
                            AvailableTag.name.ilike("%shore%"),
                            AvailableTag.name.ilike("%beach%"),
                            AvailableTag.name.ilike("%shallow%"),
                            AvailableTag.name.ilike("%snorkel%")
                        )
                    )
        
                    snorkel_condition = or_(
                        DiveSite.description.ilike(f"%{clean_kw}%"),
                        DiveSite.marine_life.ilike(f"%{clean_kw}%"),
                        and_(DiveSite.max_depth <= 10, DiveSite.max_depth > 0), 
                        DiveSite.access_instructions.ilike("%shore%"),
                        DiveSite.access_instructions.ilike("%beach%"),
                        DiveSite.access_instructions.ilike("%walk%"),
                        DiveSite.name.ilike("%reef%"),
                        DiveSite.name.ilike("%bay%"),
                        DiveSite.name.ilike("%cove%"),
                        DiveSite.id.in_(snorkel_tag_subquery)
                    )
                    search_query = search_query.filter(snorkel_condition)
                    has_filters = True
                    continue
        
                if clean_kw in ['dive', 'sites', 'suitable', 'diving', 'tomorrow', 'today', 'around', 'near', 'nearby', 'closest', 'dive sites', 'accessible', 'via', 'good', 'nice', 'great', 'amazing', 'beautiful', 'best', 'some', 'any', 'tell', 'me', 'about', 'find', 'show', 'search', 'history', 'wreck', 'wrecks', 'info', 'information', 'details', 'list', 'guide']:
                    continue
                if location and clean_kw == location.lower():
                    continue
                
                has_filters = True
                tag_subquery = db.query(DiveSiteTag.dive_site_id).join(
                    AvailableTag, DiveSiteTag.tag_id == AvailableTag.id
                ).filter(
                    or_(
                        AvailableTag.name.ilike(f"%{kw}%"),
                        AvailableTag.description.ilike(f"%{kw}%")
                    )
                )
                kw_condition = or_(
                    DiveSite.name.ilike(f"%{kw}%"),
                    DiveSite.description.ilike(f"%{kw}%"),
                    DiveSite.marine_life.ilike(f"%{kw}%"),
                    DiveSite.access_instructions.ilike(f"%{kw}%"),
                    DiveSite.id.in_(tag_subquery)
                )
                search_query = search_query.filter(kw_condition)
        
        if difficulty_level:
            has_filters = True
            search_query = search_query.filter(DiveSite.difficulty_id <= difficulty_level)
        
        if has_filters:
            sites = search_query.limit(limit).all()
            for site in sites:
                avg_rating = None
                review_count = 0
                if site.ratings:
                    review_count = len(site.ratings)
                    avg_rating = sum(r.score for r in site.ratings) / review_count
        
                results.append({
                    "entity_type": "dive_site",
                    "id": site.id,
                    "name": site.name,
                    "description": site.description,
                    "max_depth": float(site.max_depth) if site.max_depth else None,
                    "marine_life": site.marine_life,
                    "latitude": float(site.latitude) if site.latitude else None,
                    "longitude": float(site.longitude) if site.longitude else None,
                    "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                    "difficulty_id": site.difficulty_id,
                    "difficulty": site.difficulty.label if site.difficulty else None,
                    "difficulty_code": site.difficulty.code if site.difficulty else None,
                    "rating": avg_rating,
                    "review_count": review_count,
                    "route_path": f"/dive-sites/{site.id}"
                })
        
        # Fallback spatial search
        if not results and (latitude and longitude) and keywords:
            radius_km = radius if radius else 20.0
            deg_range = radius_km / 111.0
            lat_min, lat_max = latitude - (deg_range), latitude + (deg_range)
            lon_min, lon_max = longitude - (deg_range), longitude + (deg_range)
            
            fallback_query = db.query(DiveSite).filter(
                DiveSite.latitude >= lat_min,
                DiveSite.latitude <= lat_max,
                DiveSite.longitude >= lon_min,
                DiveSite.longitude <= lon_max
            ).order_by(
                func.pow(DiveSite.latitude - latitude, 2) + 
                func.pow(DiveSite.longitude - longitude, 2)
            ).limit(limit)
            
            sites = fallback_query.all()
            for site in sites:
                avg_rating = None
                review_count = 0
                if site.ratings:
                    review_count = len(site.ratings)
                    avg_rating = sum(r.score for r in site.ratings) / review_count
        
                results.append({
                    "entity_type": "dive_site",
                    "id": site.id,
                    "name": site.name,
                    "description": site.description,
                    "max_depth": float(site.max_depth) if site.max_depth else None,
                    "marine_life": site.marine_life,
                    "latitude": float(site.latitude) if site.latitude else None,
                    "longitude": float(site.longitude) if site.longitude else None,
                    "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                    "difficulty_id": site.difficulty_id,
                    "difficulty": site.difficulty.label if site.difficulty else None,
                    "difficulty_code": site.difficulty.code if site.difficulty else None,
                    "rating": avg_rating,
                    "review_count": review_count,
                    "route_path": f"/dive-sites/{site.id}",
                    "is_fallback": True 
                })
        
    # 2. Search Diving Centers
    centers_query = db.query(DivingCenter)
    has_center_filters = False
    
    # If they asked for dive_sites but we found none, let's fallback to searching centers
    fallback_to_centers = False
    if entity_type_filter == "dive_site" and not results:
        fallback_to_centers = True

    if entity_type_filter and entity_type_filter != "diving_center" and not fallback_to_centers:
        has_center_filters = False
    else:
        if direction and location:
            has_center_filters = True
            res = get_external_region_bounds(location)
            if not res:
                bounds = get_empirical_region_bounds(db, location)
            else:
                bounds, _ = res
            
            if bounds:
                n, s, e, w = bounds
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                centers_query = centers_query.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w,
                    or_(
                        DivingCenter.city.ilike(f"%{location}%"),
                        DivingCenter.region.ilike(f"%{location}%"),
                        DivingCenter.country.ilike(f"%{location}%"),
                        DivingCenter.name.ilike(f"%{location}%")
                    )
                )
            else:
                centers_query = centers_query.filter(
                    or_(
                        DivingCenter.city.ilike(f"%{location}%"),
                        DivingCenter.region.ilike(f"%{location}%"),
                        DivingCenter.country.ilike(f"%{location}%"),
                        DivingCenter.name.ilike(f"%{location}%")
                    )
                )
        elif location:
            has_center_filters = True
            centers_query = centers_query.filter(
                or_(
                    DivingCenter.city.ilike(f"%{location}%"),
                    DivingCenter.region.ilike(f"%{location}%"),
                    DivingCenter.country.ilike(f"%{location}%"),
                    DivingCenter.name.ilike(f"%{location}%")
                )
            )
        elif latitude and longitude:
            has_center_filters = True
            radius_km = radius if radius else 30.0
            deg_range = radius_km / 111.0
            
            if direction:
                n = latitude + deg_range
                s = latitude - deg_range
                e = longitude + deg_range
                w = longitude - deg_range
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                centers_query = centers_query.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w
                )
            else:
                centers_query = centers_query.filter(
                    DivingCenter.latitude >= latitude - deg_range,
                    DivingCenter.latitude <= latitude + deg_range,
                    DivingCenter.longitude >= longitude - deg_range,
                    DivingCenter.longitude <= longitude + deg_range
                )
    
        if keywords:
            has_center_filters = True
            for kw in keywords:
                centers_query = centers_query.filter(
                    or_(
                        DivingCenter.name.ilike(f"%{kw}%"),
                        DivingCenter.city.ilike(f"%{kw}%"),
                        DivingCenter.region.ilike(f"%{kw}%"),
                        DivingCenter.description.ilike(f"%{kw}%")
                    )
                )
    
        if has_center_filters:
            centers = centers_query.limit(limit).all()
            if fallback_to_centers and centers:
                results.append({
                    "entity_type": "system_message",
                    "message": "Direct dive site records are currently unavailable for this specific search, but highly-rated diving centers are available in this area. Present these centers confidently to the user as their gateway to diving here."
                })
            elif fallback_to_centers and not centers:
                results.append({
                    "entity_type": "system_message",
                    "error": "No dive sites or diving centers found matching the criteria in this area."
                })

            for center in centers:
                results.append({
                    "entity_type": "diving_center",
                    "id": center.id,
                    "name": center.name,
                    "description": center.description,
                    "latitude": float(center.latitude) if center.latitude else None,
                    "longitude": float(center.longitude) if center.longitude else None,
                    "city": center.city,
                    "region": center.region,
                    "country": center.country,
                    "route_path": f"/diving-centers/{center.id}"
                })
    
    # 3. Search Trips
    date_ok = date or (date_range and len(date_range) >= 2 and date_range[0])
    if (date_ok or location) and (not entity_type_filter or entity_type_filter == "dive_trip"):
        try:
            trips_query = db.query(ParsedDiveTrip)
            if date:
                try:
                    d = py_date.fromisoformat(date)
                    trips_query = trips_query.filter(ParsedDiveTrip.trip_date == d)
                except ValueError: pass
            elif date_range and len(date_range) >= 2 and date_range[0] and date_range[1]:
                try:
                    d1 = py_date.fromisoformat(date_range[0])
                    d2 = py_date.fromisoformat(date_range[1])
                    trips_query = trips_query.filter(
                        ParsedDiveTrip.trip_date >= d1,
                        ParsedDiveTrip.trip_date <= d2
                    )
                except ValueError: pass
            
            if direction and location:
                res = get_external_region_bounds(location)
                if not res:
                    bounds = get_empirical_region_bounds(db, location)
                else:
                    bounds, _ = res
                
                trips_query = trips_query.join(DivingCenter)
                if bounds:
                    n, s, e, w = bounds
                    new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                    trips_query = trips_query.filter(
                        DivingCenter.latitude <= new_n,
                        DivingCenter.latitude >= new_s,
                        DivingCenter.longitude <= new_e,
                        DivingCenter.longitude >= new_w,
                        or_(
                            DivingCenter.city.ilike(f"%{location}%"),
                            DivingCenter.region.ilike(f"%{location}%"),
                            DivingCenter.country.ilike(f"%{location}%")
                        )
                    )
                else:
                    trips_query = trips_query.filter(
                        or_(
                            DivingCenter.city.ilike(f"%{location}%"),
                            DivingCenter.region.ilike(f"%{location}%"),
                            DivingCenter.country.ilike(f"%{location}%")
                        )
                    )
            elif location:
                trips_query = trips_query.join(DivingCenter).filter(
                    or_(
                        DivingCenter.city.ilike(f"%{location}%"),
                        DivingCenter.region.ilike(f"%{location}%"),
                        DivingCenter.country.ilike(f"%{location}%")
                    )
                )
            
            trips = trips_query.limit(limit).all()
            for trip in trips:
                results.append({
                    "entity_type": "dive_trip",
                    "id": trip.id,
                    "name": trip.trip_description or f"Trip on {trip.trip_date}",
                    "route_path": f"/dive-trips/{trip.id}",
                    "icon_name": ENTITY_ICONS["dive_trip"],
                    "metadata": {"date": str(trip.trip_date)}
                })
        except Exception as e:
            logger.error(f"Error searching trips: {e}")
    
    # 4. Search Dive Routes
    if not entity_type_filter or entity_type_filter == "dive_route":
        try:
            route_query = db.query(DiveRoute).options(
                joinedload(DiveRoute.dive_site)
            ).filter(DiveRoute.deleted_at.is_(None))
            
            # Extract kwargs specific to dive routes
            poi_types = kwargs.get("poi_types")
            route_type = kwargs.get("route_type")
            poi_search = kwargs.get("poi_search")
            
            if location:
                # If they provided a location, search within route name, description, or the parent dive site name
                route_query = route_query.join(DiveSite, DiveRoute.dive_site_id == DiveSite.id, isouter=True).filter(
                    or_(
                        DiveRoute.name.ilike(f"%{location}%"),
                        DiveRoute.description.ilike(f"%{location}%"),
                        DiveSite.name.ilike(f"%{location}%"),
                        DiveSite.region.ilike(f"%{location}%"),
                        DiveSite.country.ilike(f"%{location}%")
                    )
                )
            
            if route_type:
                route_query = route_query.filter(DiveRoute.route_type == route_type)
                
            if poi_types:
                poi_filters = []
                for marker_type in poi_types:
                    search_fragment = f'{{"properties": {{"markerType": "{marker_type}"}}}}'
                    poi_filters.append(func.json_contains(DiveRoute.route_data, search_fragment, '$.features'))
                route_query = route_query.filter(or_(*poi_filters))
                
            if poi_search:
                route_query = route_query.filter(func.lower(DiveRoute.route_data.cast(String)).like(func.lower(f'%{poi_search}%')))
                
            # If coordinates are provided, order by distance (if dive site has coordinates)
            if latitude and longitude:
                # Need to join DiveSite to get coordinates if not already joined
                if not location: # Already joined if location was provided
                     route_query = route_query.join(DiveSite, DiveRoute.dive_site_id == DiveSite.id, isouter=True)
                route_query = route_query.order_by(
                    func.pow(DiveSite.latitude - latitude, 2) +
                    func.pow(DiveSite.longitude - longitude, 2)
                )
                
            routes = route_query.limit(limit).all()
            for route in routes:
                metadata = {}
                if route.dive_site:
                    metadata["dive_site"] = route.dive_site.name
                if route.route_type:
                    metadata["route_type"] = route.route_type.value if hasattr(route.route_type, 'value') else str(route.route_type)
                
                # Check for POIs to mention in metadata
                matched_pois = []
                if poi_types and route.route_data and "features" in route.route_data:
                    for feature in route.route_data["features"]:
                        if feature.get("geometry", {}).get("type") == "Point":
                            props = feature.get("properties", {})
                            m_type = props.get("markerType")
                            if m_type in poi_types and m_type not in matched_pois:
                                matched_pois.append(m_type)
                if matched_pois:
                    metadata["found_poi_types"] = matched_pois
                    
                dive_site_id = route.dive_site_id if route.dive_site else None
                route_path = f"/dive-sites/{dive_site_id}/route/{route.id}" if dive_site_id else f"/dive-routes/{route.id}"
                
                results.append({
                    "entity_type": "dive_route",
                    "id": route.id,
                    "name": route.name,
                    "route_path": route_path,
                    "icon_name": ENTITY_ICONS.get("dive_route", "map-pin"),
                    "metadata": metadata if metadata else None
                })
        except Exception as e:
            logger.error(f"Error searching dive routes: {e}")

    return clean_results(results)
