from .base import *
import logging
from urllib.parse import quote
logger = logging.getLogger(__name__)
from app.physics import calculate_mod, calculate_sac, calculate_best_mix, calculate_min_gas, calculate_ead, calculate_end, GasMix
    
def execute_other_intents(db: Session, intent: SearchIntent, current_user=None) -> List[Dict]:
    results = []
    if intent.intent_type == IntentType.GEAR_RENTAL:
        query = db.query(GearRentalCost).join(DivingCenter)

        # Filter by Location
        if intent.direction and intent.location:
            res = get_external_region_bounds(intent.location)
            if res:
                bounds, _ = res
            else:
                bounds = get_empirical_region_bounds(db, intent.location)
            if bounds:
                n, s, e, w = bounds
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                query = query.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w,
                    or_(
                        DivingCenter.city.ilike(f"%{intent.location}%"),
                        DivingCenter.region.ilike(f"%{intent.location}%"),
                        DivingCenter.country.ilike(f"%{intent.location}%"),
                        DivingCenter.address.ilike(f"%{intent.location}%")
                    )
                )
            else:
                query = query.filter(
                    or_(
                        DivingCenter.city.ilike(f"%{intent.location}%"),
                        DivingCenter.region.ilike(f"%{intent.location}%"),
                        DivingCenter.country.ilike(f"%{intent.location}%"),
                        DivingCenter.address.ilike(f"%{intent.location}%")
                    )
                )
        elif intent.location:
            query = query.filter(
                or_(
                    DivingCenter.city.ilike(f"%{intent.location}%"),
                    DivingCenter.region.ilike(f"%{intent.location}%"),
                    DivingCenter.country.ilike(f"%{intent.location}%"),
                    DivingCenter.address.ilike(f"%{intent.location}%")
                )
            )
        elif intent.latitude and intent.longitude:
            # Spatial search for centers
            lat_range = 0.2
            lon_range = 0.2
            if intent.direction:
                n = intent.latitude + (lat_range / 2)
                s = intent.latitude - (lat_range / 2)
                e = intent.longitude + (lon_range / 2)
                w = intent.longitude - (lon_range / 2)
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                query = query.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w
                )
            else:
                query = query.filter(
                    DivingCenter.latitude >= intent.latitude - (lat_range / 2),
                    DivingCenter.latitude <= intent.latitude + (lat_range / 2),
                    DivingCenter.longitude >= intent.longitude - (lon_range / 2),
                    DivingCenter.longitude <= intent.longitude + (lon_range / 2)
                )

        # Filter by Item Name (Keywords)
        if intent.keywords:
            stop_words = {'rent', 'rental', 'cost', 'price', 'cheap', 'cheaper', 'cheapest', 'how', 'much', 'in', 'at', 'for'}

            filtered_kws = []
            for k in intent.keywords:
                clean_k = k.lower().strip()
                if clean_k in stop_words:
                    continue
                if intent.location and clean_k in intent.location.lower():
                    continue
                # Also skip if keyword is contained in location (e.g. "Athens" in "Athens, Greece")
                if intent.location and intent.location.lower() in clean_k:
                    continue
                filtered_kws.append(k)

            if filtered_kws:
                conditions = []
                for kw in filtered_kws:
                    conditions.append(GearRentalCost.item_name.ilike(f"%{kw}%"))

                if conditions:
                    query = query.filter(and_(*conditions))

        # Sort by Cost
        query = query.order_by(GearRentalCost.cost.asc())

        items = query.limit(10).all()
        for item in items:
            results.append({
                "entity_type": "gear_rental",
                "id": item.id,
                "name": item.item_name,
                "cost": float(item.cost),
                "currency": item.currency,
                "center_name": item.diving_center.name,
                "center_id": item.diving_center.id,
                "center_location": f"{item.diving_center.city}, {item.diving_center.region}",
                "route_path": f"/diving-centers/{item.diving_center.id}"
            })

        # Fallback: If no gear rental items found, find diving centers in the area
        if not results and (intent.location or (intent.latitude and intent.longitude)):
            centers_query = db.query(DivingCenter)
            if intent.location:
                centers_query = centers_query.filter(
                    or_(
                        DivingCenter.city.ilike(f"%{intent.location}%"),
                        DivingCenter.region.ilike(f"%{intent.location}%"),
                        DivingCenter.country.ilike(f"%{intent.location}%")
                    )
                )
            elif intent.latitude and intent.longitude:
                radius_km = intent.radius if intent.radius else 30.0
                deg_range = radius_km / 111.0
                centers_query = centers_query.filter(
                    DivingCenter.latitude >= intent.latitude - deg_range,
                    DivingCenter.latitude <= intent.latitude + deg_range,
                    DivingCenter.longitude >= intent.longitude - deg_range,
                    DivingCenter.longitude <= intent.longitude + deg_range
                )

            centers = centers_query.limit(5).all()
            for center in centers:
                results.append({
                    "entity_type": "diving_center",
                    "id": center.id,
                    "name": center.name,
                    "description": center.description,
                    "address": center.address,
                    "route_path": f"/diving-centers/{center.id}",
                    "note": "Contact for gear rental prices"
                })

    elif intent.intent_type == IntentType.CAREER_PATH:
        # 1. Try to match Organization from keywords dynamically
        org_name = None
        org_match = None

        # First, check against known major organizations (hardcoded for speed/precision)
        known_orgs = ["PADI", "SSI", "CMAS", "NAUI", "BSAC", "TDI", "IANTD", "GUE", "SDI", "RAID"]
        for kw in intent.keywords:
            if kw.upper() in known_orgs:
                org_name = kw.upper()
                break

        # If not found in known list, try to find ANY organization matching the keywords
        if not org_name:
            for kw in intent.keywords:
                # Skip common stop words
                if kw.lower() in ["course", "certification", "level", "path", "career", "diving", "diver"]:
                    continue

                potential_org = db.query(DivingOrganization).filter(
                    or_(
                        DivingOrganization.name.ilike(f"%{kw}%"),
                        DivingOrganization.acronym.ilike(f"%{kw}%")
                    )
                ).first()

                if potential_org:
                    org_match = potential_org
                    break

        query = db.query(CertificationLevel).join(DivingOrganization)

        if org_name:
            query = query.filter(DivingOrganization.acronym == org_name)
        elif org_match:
            query = query.filter(DivingOrganization.id == org_match.id)

        # If still no org found, maybe the user asked about a specific level (e.g. "Advanced Open Water")
        # in which case we might find multiple orgs.
        if not org_name and not org_match and intent.keywords:
            kw_filters = []
            for kw in intent.keywords:
                if kw.lower() not in ["after", "before", "next", "course", "certification", "level", "path", "career"]:
                    kw_filters.append(CertificationLevel.name.ilike(f"%{kw}%"))

            if kw_filters:
                 query = query.filter(or_(*kw_filters))

        # Fetch results
        certs = query.limit(30).all()

        # Group by Org
        org_certs = {}
        for cert in certs:
            org = cert.diving_organization.name
            if org not in org_certs:
                org_certs[org] = []

            # detailed info
            cert_info = {
                "name": cert.name,
                "category": cert.category,
                "max_depth": cert.max_depth,
                "prerequisites": cert.prerequisites,
                "order_hint": 0, # We could try to infer order from ID or data if available
                "route_path": f"/resources/diving-organizations?org={quote(cert.diving_organization.acronym or cert.diving_organization.name)}&course={quote(cert.name)}"
            }
            org_certs[org].append(cert_info)

        for org, cert_list in org_certs.items():
            # Find acronym for the org to use in top-level link
            org_acronym = next((c.diving_organization.acronym for c in certs if c.diving_organization.name == org), org)
            results.append({
                "entity_type": "career_path",
                "id": 0, # Dummy ID
                "name": f"Career Path: {org}", # Name is required for generate_response
                "organization": org,
                "courses": [c["name"] for c in cert_list], # Keep simple list for compatibility or summary
                "details": cert_list, # Provide full details for the LLM
                "route_path": f"/resources/diving-organizations?org={quote(org_acronym)}"
            })

    elif intent.intent_type == IntentType.MARINE_LIFE:
        # Search strictly in marine_life column
        if intent.keywords:
            query = db.query(DiveSite)

            # Location filter
            if intent.direction and intent.location:
                res = get_external_region_bounds(intent.location)
                if res:
                    bounds, _ = res
                else:
                    bounds = get_empirical_region_bounds(db, intent.location)
                if bounds:
                    n, s, e, w = bounds
                    new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                    query = query.filter(
                        DiveSite.latitude <= new_n,
                        DiveSite.latitude >= new_s,
                        DiveSite.longitude <= new_e,
                        DiveSite.longitude >= new_w,
                        or_(
                            DiveSite.region.ilike(f"%{intent.location}%"),
                            DiveSite.country.ilike(f"%{intent.location}%"),
                            DiveSite.description.ilike(f"%{intent.location}%")
                        )
                    )
                else:
                    query = query.filter(
                        or_(
                            DiveSite.region.ilike(f"%{intent.location}%"),
                            DiveSite.country.ilike(f"%{intent.location}%"),
                            DiveSite.description.ilike(f"%{intent.location}%")
                        )
                    )
            elif intent.location:
                query = query.filter(
                    or_(
                        DiveSite.region.ilike(f"%{intent.location}%"),
                        DiveSite.country.ilike(f"%{intent.location}%"),
                        DiveSite.description.ilike(f"%{intent.location}%")
                    )
                )
            elif intent.latitude and intent.longitude:
                lat_range = 0.5 
                lon_range = 0.5

                if intent.direction:
                    n = intent.latitude + (lat_range / 2)
                    s = intent.latitude - (lat_range / 2)
                    e = intent.longitude + (lon_range / 2)
                    w = intent.longitude - (lon_range / 2)
                    new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, intent.direction)
                    query = query.filter(
                        DiveSite.latitude <= new_n,
                        DiveSite.latitude >= new_s,
                        DiveSite.longitude <= new_e,
                        DiveSite.longitude >= new_w
                    )
                else:
                    query = query.filter(
                        DiveSite.latitude >= intent.latitude - (lat_range / 2),
                        DiveSite.latitude <= intent.latitude + (lat_range / 2),
                        DiveSite.longitude >= intent.longitude - (lon_range / 2),
                        DiveSite.longitude <= intent.longitude + (lon_range / 2)
                    )

            # Keyword filter on marine_life column
            # Strategy: Try to find sites that match ALL keywords first (AND logic)
            # If that returns too few results, fallback to ANY keyword (OR logic)

            and_filters = []
            or_filters = []

            relevant_keywords = []
            for kw in intent.keywords:
                # Cleanup keywords
                if intent.location and kw.lower() in intent.location.lower(): continue
                if kw.lower() in ["see", "find", "watch", "look", "where", "sites", "marine", "life", "underwater", "creatures"]: continue
                relevant_keywords.append(kw)

                # Split multi-word keywords (e.g. "monk seals" -> "monk", "seals")
                if ' ' in kw:
                    for word in kw.split():
                        if len(word) > 3 and word.lower() not in ["with", "and", "the", "for"]:
                            relevant_keywords.append(word)

            if relevant_keywords:
                for kw in relevant_keywords:
                    # Search in multiple fields for marine life keywords
                    f = or_(
                        DiveSite.marine_life.ilike(f"%{kw}%"),
                        DiveSite.name.ilike(f"%{kw}%"),
                        DiveSite.description.ilike(f"%{kw}%")
                    )
                    and_filters.append(f)
                    or_filters.append(f)

                # 1. Try Strict AND search
                strict_query = query.filter(and_(*and_filters))
                sites = strict_query.limit(10).all()

                # 2. Fallback to OR search if strict search yielded few results (< 3)
                if len(sites) < 3 and len(relevant_keywords) > 1:
                    # Get IDs we already have to exclude them
                    existing_ids = {s.id for s in sites}
                    fallback_query = query.filter(or_(*or_filters))
                    if existing_ids:
                        fallback_query = fallback_query.filter(DiveSite.id.notin_(existing_ids))

                    more_sites = fallback_query.limit(10 - len(sites)).all()
                    sites.extend(more_sites)

                for site in sites:
                    results.append({
                        "entity_type": "dive_site",
                        "id": site.id,
                        "name": site.name,
                        "marine_life": site.marine_life,
                        "location": f"{site.region}, {site.country}",
                        "route_path": f"/dive-sites/{site.id}"
                    })

    elif intent.intent_type == IntentType.PERSONAL_RECOMMENDATION:
        if current_user:
            # 1. Determine Difficulty
            from app.services.chat.intent_extractor import get_user_difficulty_level
            user_max_difficulty = get_user_difficulty_level(db, current_user.id)

            # 2. Get Past Dives (Locations and Site IDs)
            past_dives = db.query(Dive).options(joinedload(Dive.dive_site)).filter(Dive.user_id == current_user.id).all()
            visited_site_ids = {d.dive_site_id for d in past_dives if d.dive_site_id}

            # 3. Determine Search Location
            target_lat = intent.latitude
            target_lon = intent.longitude
            location_name = intent.location

            # FALLBACK: If no location/coords, use last dive location
            if not location_name and not (target_lat and target_lon):
                last_dive = db.query(Dive).options(joinedload(Dive.dive_site)).filter(Dive.user_id == current_user.id).order_by(Dive.dive_date.desc()).first()
                if last_dive and last_dive.dive_site:
                    target_lat = float(last_dive.dive_site.latitude)
                    target_lon = float(last_dive.dive_site.longitude)

            query = db.query(DiveSite).options(joinedload(DiveSite.difficulty))

            # Filter by Difficulty
            if user_max_difficulty:
                query = query.filter(DiveSite.difficulty_id <= user_max_difficulty)

            # Filter Exclude Visited
            if visited_site_ids:
                query = query.filter(DiveSite.id.notin_(visited_site_ids))

            # Filter Location
            has_location = False
            if location_name:
                has_location = True
                query = query.filter(
                    or_(
                        DiveSite.region.ilike(f"%{location_name}%"),
                        DiveSite.country.ilike(f"%{location_name}%"),
                        DiveSite.description.ilike(f"%{location_name}%")
                    )
                )
            elif target_lat and target_lon:
                has_location = True
                # 50km radius
                lat_range = 0.5 
                lon_range = 0.5
                query = query.filter(
                    DiveSite.latitude >= target_lat - (lat_range / 2),
                    DiveSite.latitude <= target_lat + (lat_range / 2),
                    DiveSite.longitude >= target_lon - (lon_range / 2),
                    DiveSite.longitude <= target_lon + (lon_range / 2)
                )

            # Filter Shore Dives
            query = query.filter(
                or_(
                    DiveSite.access_instructions.ilike("%shore%"),
                    DiveSite.access_instructions.ilike("%beach%"),
                    DiveSite.access_instructions.ilike("%walk%"),
                    DiveSite.description.ilike("%shore dive%"),
                    DiveSite.shore_direction.isnot(None)
                )
            )

            if has_location:
                sites = query.limit(5).all()
                for site in sites:
                    results.append({
                        "entity_type": "dive_site",
                        "id": site.id,
                        "name": site.name,
                        "description": site.description,
                        "max_depth": float(site.max_depth) if site.max_depth else None,
                        "difficulty": site.difficulty.label if site.difficulty else None,
                        "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                        "route_path": f"/dive-sites/{site.id}"
                    })

    elif intent.intent_type == IntentType.COMPARISON:
        query_str = " ".join(intent.keywords)
        if query_str:
            # Comparison logic:
            # 1. Try to find Certification Levels
            certs = db.query(CertificationLevel).filter(
                or_(
                    CertificationLevel.name.ilike(f"%{query_str}%"),
                    CertificationLevel.category.ilike(f"%{query_str}%")
                )
            ).all()

            # If we have keywords, try to match them individually if strict phrase match failed or returned few results
            if len(certs) < 2: 
                # If user asked "Compare PADI OW and SSI OW", keywords might be ["PADI", "OW", "SSI"]
                # We need to be smart about finding the entities.
                # Simple approach: Find all certs matching ANY keyword, then the LLM can filter.
                # Better approach for comparison: We need at least TWO distinct entities.

                # Let's try to find entities matching each keyword or combination
                potential_certs = []
                for kw in intent.keywords:
                    matches = db.query(CertificationLevel).filter(
                        or_(
                            CertificationLevel.name.ilike(f"%{kw}%"),
                            CertificationLevel.category.ilike(f"%{kw}%")
                        )
                    ).all()
                    potential_certs.extend(matches)

                # Deduplicate by ID
                seen_ids = set()
                for c in potential_certs:
                    if c.id not in seen_ids:
                        certs.append(c)
                        seen_ids.add(c.id)

            for cert in certs:
                # Enrich with Organization details
                org_name = cert.diving_organization.name if cert.diving_organization else "Unknown"
                org_acronym = cert.diving_organization.acronym if cert.diving_organization else org_name
                results.append({
                    "entity_type": "certification",
                    "id": cert.id,
                    "name": cert.name,
                    "route_path": f"/resources/diving-organizations?org={quote(org_acronym)}&course={quote(cert.name)}",
                    "metadata": {
                        "organization": org_name,
                        "max_depth": cert.max_depth,
                        "prerequisites": cert.prerequisites,
                        "category": cert.category,
                        "gases": cert.gases,
                        "tanks": cert.tanks,
                        "deco_time_limit": cert.deco_time_limit
                    }
                })

    elif intent.intent_type == IntentType.KNOWLEDGE:
        query_str = " ".join(intent.keywords)
        if query_str:
            # 1. Try Certification Levels
            certs = db.query(CertificationLevel).filter(
                or_(
                    CertificationLevel.name.ilike(f"%{query_str}%"),
                    CertificationLevel.category.ilike(f"%{query_str}%")
                )
            ).limit(5).all()
            for cert in certs:
                org_acronym = cert.diving_organization.acronym if cert.diving_organization else "Unknown"
                results.append({
                    "entity_type": "certification",
                    "id": cert.id,
                    "name": cert.name,
                    "route_path": f"/resources/diving-organizations?org={quote(org_acronym)}&course={quote(cert.name)}",
                    "metadata": {
                        "organization": org_acronym,
                        "max_depth": cert.max_depth,
                        "prerequisites": cert.prerequisites
                    }
                })

            # 2. ALSO Try Dive Sites if few certs found
            if len(results) < 3:
                # Filter out non-skip keywords for site search
                site_kws = [kw for kw in intent.keywords if kw.lower() not in ['history', 'info', 'information', 'about', 'what', 'is', 'the']]
                if site_kws:
                    site_query = db.query(DiveSite)
                    for kw in site_kws:
                        site_query = site_query.filter(or_(
                            DiveSite.name.ilike(f"%{kw}%"),
                            DiveSite.description.ilike(f"%{kw}%")
                        ))
                    sites = site_query.limit(5).all()
                    for site in sites:
                        results.append({
                            "entity_type": "dive_site",
                            "id": site.id,
                            "name": site.name,
                            "description": site.description,
                            "route_path": f"/dive-sites/{site.id}"
                        })

    elif intent.intent_type == IntentType.CONTEXT_QA and intent.context_entity_id:
        if intent.context_entity_type == "dive_site":
            site = db.query(DiveSite).options(
                joinedload(DiveSite.center_relationships).joinedload(CenterDiveSite.diving_center),
                joinedload(DiveSite.difficulty)
            ).filter(DiveSite.id == intent.context_entity_id).first()

            if site:
                # Extract connected diving centers
                centers = []
                for rel in site.center_relationships:
                    if rel.diving_center:
                        # Format as markdown link
                        center_link = f"[{rel.diving_center.name} ({rel.diving_center.city})](/diving-centers/{rel.diving_center.id})"
                        centers.append(center_link)

                results.append({
                    "entity_type": "dive_site",
                    "id": site.id,
                    "name": site.name,
                    "description": site.description,
                    "max_depth": float(site.max_depth) if site.max_depth else None,
                    "difficulty": site.difficulty.label if site.difficulty else None,
                    "difficulty_code": site.difficulty.code if site.difficulty else None,
                    "marine_life": site.marine_life,
                    "safety_info": site.safety_information,
                    "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                    "latitude": float(site.latitude) if site.latitude else None,
                    "longitude": float(site.longitude) if site.longitude else None,
                    "visited_by_centers": centers
                })
        elif intent.context_entity_type == "diving_center":
            center = db.query(DivingCenter).filter(DivingCenter.id == intent.context_entity_id).first()
            if center:
                results.append({
                    "entity_type": "diving_center",
                    "id": center.id,
                    "name": center.name,
                    "description": center.description,
                    "address": center.address,
                    "website": center.website
                })

    elif intent.intent_type == IntentType.CALCULATOR:
        calc_results = {
            "entity_type": "calculator_results", 
            "name": "Diving Calculation Results",
            "source": "Divemap Physics Engine"
        }
        params = intent.calculator_params or {}
        specific_tool = "/resources/tools"

        # 1. MOD Calculation
        if params.get('o2') is not None:
            pp_o2 = params.get('pp_o2_max', 1.4)
            mod = calculate_mod(GasMix(o2=params['o2'], he=params.get('he', 0.0) or 0.0), pp_o2)
            calc_results['mod'] = f"{mod:.1f} meters (at {pp_o2} ppO2)"
            specific_tool = "/resources/tools?tab=mod"

        # 2. SAC Calculation
        if all(params.get(k) is not None for k in ['start_pressure', 'end_pressure', 'tank_volume', 'depth', 'duration']):
            gas = GasMix(o2=params.get('o2', 21.0) or 21.0, he=params.get('he', 0.0) or 0.0)
            sac = calculate_sac(
                params['depth'], params['duration'], params['tank_volume'], 
                params['start_pressure'], params['end_pressure'], gas
            )
            calc_results['sac_rate'] = f"{sac:.2f} L/min"
            specific_tool = "/resources/tools?tab=sac"

        # 3. Best Mix
        if params.get('depth') is not None and params.get('pp_o2_max') is not None:
            best_mix = calculate_best_mix(params['depth'], params['pp_o2_max'])
            calc_results['best_mix'] = f"{best_mix.o2:.1f}% O2"
            specific_tool = "/resources/tools?tab=best-mix"

        # 4. EAD / END
        if params.get('depth') is not None and (params.get('o2') is not None or params.get('he') is not None):
            gas = GasMix(o2=params.get('o2', 21.0) or 21.0, he=params.get('he', 0.0) or 0.0)
            ead = calculate_ead(params['depth'], gas)
            end = calculate_end(params['depth'], gas)
            calc_results['ead'] = f"{ead:.1f} meters"
            if gas.he > 0:
                calc_results['end'] = f"{end:.1f} meters"

        # 5. Minimum Gas
        if all(params.get(k) is not None for k in ['depth', 'duration', 'sac_rate', 'tank_volume']):
            min_gas = calculate_min_gas(params['depth'], params['duration'], params['sac_rate'], params['tank_volume'])
            calc_results['min_gas_reserve'] = f"{min_gas:.1f} bar"
            specific_tool = "/resources/tools?tab=min-gas"

        results.append(calc_results)
        # Add general info about tools
        results.append({
            "entity_type": "calculator_tools",
            "name": "Divemap Tools",
            "description": "Access to high-precision diving calculators.",
            "route_path": specific_tool
        })


    return results
