from .base import *
import logging
logger = logging.getLogger(__name__)
    
def execute_discovery(db: Session, intent: SearchIntent) -> List[Dict]:
    results = []
    limit = 10
    # Smart Location Resolution: If location is a specific Dive Site, switch to Spatial Search around it
    if intent.location and not (intent.latitude and intent.longitude):
        # Try to find a dive site with this name
        site_match = db.query(DiveSite).filter(DiveSite.name.ilike(f"{intent.location}")).first()
        
        # If exact match fails, try a fuzzy match by replacing spaces with wildcards
        if not site_match:
            import re
            fuzzy_name = re.sub(r'[\s\-]+', '%', intent.location.strip())
            site_match = db.query(DiveSite).filter(DiveSite.name.ilike(f"%{fuzzy_name}%")).first()
            
        if site_match and site_match.latitude and site_match.longitude:
            logger.info(f"Resolved location '{intent.location}' to DiveSite '{site_match.name}' coordinates.")
            intent.latitude = float(site_match.latitude)
            intent.longitude = float(site_match.longitude)
            intent.location = None # Clear text location to force radius search
    
    # 1. Search Dive Sites
    search_query = db.query(DiveSite).options(
        joinedload(DiveSite.difficulty),
        joinedload(DiveSite.ratings)
    )
    
    has_filters = False
    spatial_filters = []
    text_filters = []
    
    # 1. Spatial & Directional Search
    if (not intent.entity_type_filter or intent.entity_type_filter == "dive_site") and intent.direction and (intent.location or intent.parent_region):
        has_filters = True
        # Normalize location for better resolution
        # Promotion logic: If we have a parent region, use it for the bounds to get a better cardinal split
        loc_res = intent.parent_region if intent.parent_region else intent.location
        
        if loc_res.lower() in ["athens", "atniki", "athina"]:
            loc_res = "Attica" # Athens as a city is small, Attica is the region
    
        # Try empirical bounds FIRST for our regions, as they are more accurate for dive site distribution
        bounds = get_empirical_region_bounds(db, loc_res)
        if not bounds:
            res = get_external_region_bounds(loc_res)
            if res:
                bounds, display_name = res
                # Auto-promote parent_region if LLM missed it
                if not intent.parent_region and "," in display_name:
                    parts = [p.strip() for p in display_name.split(",")]
                    if len(parts) >= 3:
                        # For "Anavyssos, Municipality, Regional Unit, Attica, Greece", parts[-2] is "Attica"
                        # We need to check if parts[-2] is the country
                        parent = parts[-2]
                        if parent.lower() in ["greece", "hellas"] and len(parts) >= 4:
                            parent = parts[-3]
                        intent.parent_region = parent
                        logger.info(f"Auto-promoted parent_region to '{intent.parent_region}' from display_name: {display_name}")
                        # Re-try empirical bounds with the NEWLY discovered parent region for better accuracy
                        p_bounds = get_empirical_region_bounds(db, intent.parent_region)
                        if p_bounds:
                            bounds = p_bounds
                            logger.info(f"Successfully switched to empirical bounds of parent region: {intent.parent_region}")
        
        if bounds:
            n, s, e, w = bounds
            new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
            spatial_filters = [
                DiveSite.latitude <= new_n,
                DiveSite.latitude >= new_s,
                DiveSite.longitude <= new_e,
                DiveSite.longitude >= new_w
            ]
        else:
            logger.warning(f"Could not resolve bounds for {loc_res} to apply direction {intent.direction}")
    
    if not spatial_filters and intent.latitude and intent.longitude:
        has_filters = True
        radius_km = intent.radius if intent.radius else 20.0
        deg_range = radius_km / 111.0
        
        if intent.direction:
            n = intent.latitude + deg_range
            s = intent.latitude - deg_range
            e = intent.longitude + deg_range
            w = intent.longitude - deg_range
            new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
            spatial_filters = [
                DiveSite.latitude <= new_n,
                DiveSite.latitude >= new_s,
                DiveSite.longitude <= new_e,
                DiveSite.longitude >= new_w
            ]
        else:
            lat_min, lat_max = intent.latitude - deg_range, intent.latitude + deg_range
            lon_min, lon_max = intent.longitude - deg_range, intent.longitude + deg_range
            spatial_filters = [
                DiveSite.latitude >= lat_min,
                DiveSite.latitude <= lat_max,
                DiveSite.longitude >= lon_min,
                DiveSite.longitude <= lon_max
            ]
    
    # 2. Text Search (Location Name)
    if intent.location:
        has_filters = True
        loc_term = intent.location.split(',')[0].strip()
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
        if intent.direction:
            # Direction is strict: Must be within bounds AND (optional) match region text
            # We use OR for text filters, but AND with spatial
            search_query = search_query.filter(and_(*spatial_filters, or_(*text_filters)))
        else:
            search_query = search_query.filter(or_(and_(*spatial_filters), or_(*text_filters)))
    elif spatial_filters:
        search_query = search_query.filter(and_(*spatial_filters))
    elif text_filters:
        search_query = search_query.filter(or_(*text_filters))
    
    # Ordering
    if intent.latitude and intent.longitude:
        # Order by distance if coordinates provided
        search_query = search_query.order_by(
            func.pow(DiveSite.latitude - intent.latitude, 2) + 
            func.pow(DiveSite.longitude - intent.longitude, 2)
        )
    
    
    
    if (not intent.entity_type_filter or intent.entity_type_filter == "dive_site") and intent.keywords:
        # Apply AND logic between keywords: Each keyword must match at least one field
        applied_rating_sort = False
        for kw in intent.keywords:
            clean_kw = kw.lower().strip()
            
            # Handle Sorting Keywords
            if clean_kw in ['highest_rated', 'top_rated', 'best']:
                if not applied_rating_sort:
                    # Use alias to avoid conflict with joinedload(DiveSite.ratings)
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
    
            # Smart Snorkeling Filter
            if clean_kw in ['snorkeling', 'snorkel']:
                # Tag subquery for shore/snorkeling tags
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
                    and_(DiveSite.max_depth <= 10, DiveSite.max_depth > 0), # Shallow sites
                    DiveSite.access_instructions.ilike("%shore%"),
                    DiveSite.access_instructions.ilike("%beach%"),
                    DiveSite.access_instructions.ilike("%walk%"),
                    DiveSite.name.ilike("%reef%"), # Heuristic: Reefs are often snorkelable
                    DiveSite.name.ilike("%bay%"),  # Heuristic: Bays are often calm/shallow
                    DiveSite.name.ilike("%cove%"),
                    DiveSite.id.in_(snorkel_tag_subquery) # Check tags
                )
                search_query = search_query.filter(snorkel_condition)
                has_filters = True
                continue
    
            # Skip only truly generic filler words. 
            if clean_kw in ['dive', 'sites', 'suitable', 'diving', 'tomorrow', 'today', 'around', 'near', 'nearby', 'closest', 'dive sites', 'accessible', 'via', 'good', 'nice', 'great', 'amazing', 'beautiful', 'best', 'some', 'any', 'tell', 'me', 'about', 'find', 'show', 'search', 'history', 'wreck', 'wrecks', 'info', 'information', 'details', 'list', 'guide']:
                continue
            # Only skip if it's EXACTLY the location. We want to keep "Anavyssos" even if location is "Attica"
            if intent.location and clean_kw == intent.location.lower():
                continue
            
            has_filters = True
            
            # Search in tags
            tag_subquery = db.query(DiveSiteTag.dive_site_id).join(
                AvailableTag, DiveSiteTag.tag_id == AvailableTag.id
            ).filter(
                or_(
                    AvailableTag.name.ilike(f"%{kw}%"),
                    AvailableTag.description.ilike(f"%{kw}%")
                )
            )
    
            # Fields to search for THIS keyword
            kw_condition = or_(
                DiveSite.name.ilike(f"%{kw}%"),
                DiveSite.description.ilike(f"%{kw}%"),
                DiveSite.marine_life.ilike(f"%{kw}%"),
                DiveSite.access_instructions.ilike(f"%{kw}%"),
                DiveSite.id.in_(tag_subquery)
            )
            
            # Apply as a filter (AND with previous filters)
            search_query = search_query.filter(kw_condition)
    
    if intent.difficulty_level:
        has_filters = True
        search_query = search_query.filter(DiveSite.difficulty_id <= intent.difficulty_level)
    
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
    
    # Fallback: If no sites found with keywords but we have location, try spatial search WITHOUT keywords
    # This prevents empty results when keywords like "shore" or "wreck" don't match specifically but sites exist nearby.
    if not results and (intent.latitude and intent.longitude) and intent.keywords:
        logger.info("Strict search returned 0 sites. Attempting fallback spatial search without keywords.")
        
        # Re-calculate spatial bounds
        radius_km = intent.radius if intent.radius else 20.0
        deg_range = radius_km / 111.0
        lat_min, lat_max = intent.latitude - (deg_range), intent.latitude + (deg_range)
        lon_min, lon_max = intent.longitude - (deg_range), intent.longitude + (deg_range)
        
        fallback_query = db.query(DiveSite).filter(
            DiveSite.latitude >= lat_min,
            DiveSite.latitude <= lat_max,
            DiveSite.longitude >= lon_min,
            DiveSite.longitude <= lon_max
        ).order_by(
            func.pow(DiveSite.latitude - intent.latitude, 2) + 
            func.pow(DiveSite.longitude - intent.longitude, 2)
        ).limit(limit)
        
        sites = fallback_query.all()
        for site in sites:
            # Logic to calculate rating (duplicated for now, could be refactored)
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
                "is_fallback": True # Mark as fallback result
            })
    
    # 2. Search Diving Centers
    centers_query = db.query(DivingCenter)
    has_center_filters = False
    
    # Skip centers if user specifically asked for something else
    if intent.entity_type_filter and intent.entity_type_filter != "diving_center":
        has_center_filters = False
    else:
        if intent.direction and intent.location:
            has_center_filters = True
            res = get_external_region_bounds(intent.location)
            if res:
                bounds, _ = res
            else:
                bounds = get_empirical_region_bounds(db, intent.location)
            
            if bounds:
                n, s, e, w = bounds
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                centers_query = centers_query.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w,
                    or_(
                        DivingCenter.city.ilike(f"%{intent.location}%"),
                        DivingCenter.region.ilike(f"%{intent.location}%"),
                        DivingCenter.country.ilike(f"%{intent.location}%"),
                        DivingCenter.name.ilike(f"%{intent.location}%")
                    )
                )
            else:
                centers_query = centers_query.filter(
                    or_(
                        DivingCenter.city.ilike(f"%{intent.location}%"),
                        DivingCenter.region.ilike(f"%{intent.location}%"),
                        DivingCenter.country.ilike(f"%{intent.location}%"),
                        DivingCenter.name.ilike(f"%{intent.location}%")
                    )
                )
        elif intent.location:
            has_center_filters = True
            centers_query = centers_query.filter(
                or_(
                    DivingCenter.city.ilike(f"%{intent.location}%"),
                    DivingCenter.region.ilike(f"%{intent.location}%"),
                    DivingCenter.country.ilike(f"%{intent.location}%"),
                    DivingCenter.name.ilike(f"%{intent.location}%")
                )
            )
        elif intent.latitude and intent.longitude:
            has_center_filters = True
            radius_km = intent.radius if intent.radius else 30.0
            deg_range = radius_km / 111.0
            
            if intent.direction:
                n = intent.latitude + deg_range
                s = intent.latitude - deg_range
                e = intent.longitude + deg_range
                w = intent.longitude - deg_range
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                centers_query = centers_query.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w
                )
            else:
                centers_query = centers_query.filter(
                    DivingCenter.latitude >= intent.latitude - deg_range,
                    DivingCenter.latitude <= intent.latitude + deg_range,
                    DivingCenter.longitude >= intent.longitude - deg_range,
                    DivingCenter.longitude <= intent.longitude + deg_range
                )
    
        if intent.keywords:
            has_center_filters = True
            for kw in intent.keywords:
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
    date_ok = intent.date or (intent.date_range and len(intent.date_range) >= 2 and intent.date_range[0])
    if (date_ok or intent.location) and (not intent.entity_type_filter or intent.entity_type_filter == "dive_trip"):
        try:
            trips_query = db.query(ParsedDiveTrip)
            
            if intent.date:
                try:
                    d = date.fromisoformat(intent.date)
                    trips_query = trips_query.filter(ParsedDiveTrip.trip_date == d)
                except ValueError: pass
            elif intent.date_range and len(intent.date_range) >= 2 and intent.date_range[0] and intent.date_range[1]:
                try:
                    d1 = date.fromisoformat(intent.date_range[0])
                    d2 = date.fromisoformat(intent.date_range[1])
                    trips_query = trips_query.filter(
                        ParsedDiveTrip.trip_date >= d1,
                        ParsedDiveTrip.trip_date <= d2
                    )
                except ValueError: pass
            
            if intent.direction and intent.location:
                res = get_external_region_bounds(intent.location)
                if res:
                    bounds, _ = res
                else:
                    bounds = get_empirical_region_bounds(db, intent.location)
                
                trips_query = trips_query.join(DivingCenter)
                if bounds:
                    n, s, e, w = bounds
                    new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                    trips_query = trips_query.filter(
                        DivingCenter.latitude <= new_n,
                        DivingCenter.latitude >= new_s,
                        DivingCenter.longitude <= new_e,
                        DivingCenter.longitude >= new_w,
                        or_(
                            DivingCenter.city.ilike(f"%{intent.location}%"),
                            DivingCenter.region.ilike(f"%{intent.location}%"),
                            DivingCenter.country.ilike(f"%{intent.location}%")
                        )
                    )
                else:
                    trips_query = trips_query.filter(
                        or_(
                            DivingCenter.city.ilike(f"%{intent.location}%"),
                            DivingCenter.region.ilike(f"%{intent.location}%"),
                            DivingCenter.country.ilike(f"%{intent.location}%")
                        )
                    )
            elif intent.location:
                trips_query = trips_query.join(DivingCenter).filter(
                    or_(
                        DivingCenter.city.ilike(f"%{intent.location}%"),
                        DivingCenter.region.ilike(f"%{intent.location}%"),
                        DivingCenter.country.ilike(f"%{intent.location}%")
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
    

    return results
