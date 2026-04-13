from .base import *
import logging
from urllib.parse import quote
logger = logging.getLogger(__name__)
from app.physics import calculate_mod, calculate_sac, calculate_best_mix, calculate_min_gas, calculate_ead, calculate_end, GasMix
    
def execute_other_intents(
    db: Session, 
    intent_type: IntentType,
    current_user: Optional[User] = None,
    keywords: Optional[List[str]] = None,
    location: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: Optional[float] = None,
    direction: Optional[str] = None,
    calculator_params: Optional[Dict] = None,
    context_entity_id: Optional[int] = None,
    context_entity_type: Optional[str] = None,
    query: Optional[str] = None,
    organization: Optional[str] = None,
    **kwargs
) -> List[Dict]:
    results = []
    if intent_type == IntentType.GEAR_RENTAL:
        query_gear = db.query(GearRentalCost).join(DivingCenter)

        # Filter by Location
        if direction and location:
            res = get_external_region_bounds(location)
            if res:
                bounds, _ = res
            else:
                bounds = get_empirical_region_bounds(db, location)
            if bounds:
                n, s, e, w = bounds
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                query_gear = query_gear.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w,
                    or_(
                        DivingCenter.city.ilike(f"%{location}%"),
                        DivingCenter.region.ilike(f"%{location}%"),
                        DivingCenter.country.ilike(f"%{location}%"),
                        DivingCenter.address.ilike(f"%{location}%")
                    )
                )
            else:
                query_gear = query_gear.filter(
                    or_(
                        DivingCenter.city.ilike(f"%{location}%"),
                        DivingCenter.region.ilike(f"%{location}%"),
                        DivingCenter.country.ilike(f"%{location}%"),
                        DivingCenter.address.ilike(f"%{location}%")
                    )
                )
        elif location:
            query_gear = query_gear.filter(
                or_(
                    DivingCenter.city.ilike(f"%{location}%"),
                    DivingCenter.region.ilike(f"%{location}%"),
                    DivingCenter.country.ilike(f"%{location}%"),
                    DivingCenter.address.ilike(f"%{location}%")
                )
            )
        elif latitude and longitude:
            lat_range = 0.2
            lon_range = 0.2
            if direction:
                n = latitude + (lat_range / 2)
                s = latitude - (lat_range / 2)
                e = longitude + (lon_range / 2)
                w = longitude - (lon_range / 2)
                new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                query_gear = query_gear.filter(
                    DivingCenter.latitude <= new_n,
                    DivingCenter.latitude >= new_s,
                    DivingCenter.longitude <= new_e,
                    DivingCenter.longitude >= new_w
                )
            else:
                query_gear = query_gear.filter(
                    DivingCenter.latitude >= latitude - (lat_range / 2),
                    DivingCenter.latitude <= latitude + (lat_range / 2),
                    DivingCenter.longitude >= longitude - (lon_range / 2),
                    DivingCenter.longitude <= longitude + (lon_range / 2)
                )

        # Filter by Item Name (Keywords)
        if keywords:
            stop_words = {'rent', 'rental', 'cost', 'price', 'cheap', 'cheaper', 'cheapest', 'how', 'much', 'in', 'at', 'for'}

            filtered_kws = []
            for k in keywords:
                clean_k = k.lower().strip()
                if clean_k in stop_words:
                    continue
                if location and clean_k in location.lower():
                    continue
                if location and location.lower() in clean_k:
                    continue
                filtered_kws.append(k)

            if filtered_kws:
                conditions = []
                for kw in filtered_kws:
                    conditions.append(GearRentalCost.item_name.ilike(f"%{kw}%"))

                if conditions:
                    query_gear = query_gear.filter(and_(*conditions))

        query_gear = query_gear.order_by(GearRentalCost.cost.asc())

        items = query_gear.limit(10).all()
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

        if not results and (location or (latitude and longitude)):
            centers_query = db.query(DivingCenter).join(GearRentalCost).distinct()
            if location:
                centers_query = centers_query.filter(
                    or_(
                        DivingCenter.city.ilike(f"%{location}%"),
                        DivingCenter.region.ilike(f"%{location}%"),
                        DivingCenter.country.ilike(f"%{location}%")
                    )
                )
            elif latitude and longitude:
                radius_km = radius if radius else 30.0
                deg_range = radius_km / 111.0
                centers_query = centers_query.filter(
                    DivingCenter.latitude >= latitude - deg_range,
                    DivingCenter.latitude <= latitude + deg_range,
                    DivingCenter.longitude >= longitude - deg_range,
                    DivingCenter.longitude <= longitude + deg_range
                )

            centers = centers_query.limit(5).all()
            if centers:
                results.append({
                    "entity_type": "system_message",
                    "message": "Exact rental items not found, but these diving centers in the area are verified to offer gear rentals. Recommend them to the user."
                })
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

    elif intent_type == IntentType.CAREER_PATH:
        org_name = organization
        org_match = None
        
        search_terms = keywords if keywords else ([query] if query else [])
        
        # Extract meaningful terms
        import re as py_re
        expanded_terms = []
        stop_words = {"what", "are", "the", "requirements", "for", "how", "to", "become", "a", "an", "is", "there", "i", "want", "do", "you", "have", "any", "after", "before", "next", "course", "courses", "certification", "certifications", "level", "levels", "path", "career", "diving", "diver"}
        for t in search_terms:
            parts = py_re.findall(r'[a-zA-Z]+|\d+', t.lower())
            for p in parts:
                if p not in stop_words and len(p) > 1:
                    expanded_terms.append(p)

        if not org_name and expanded_terms:
            known_orgs = ["PADI", "SSI", "CMAS", "NAUI", "BSAC", "TDI", "IANTD", "GUE", "SDI", "RAID"]
            for kw in expanded_terms:
                if kw.upper() in known_orgs:
                    org_name = kw.upper()
                    break

        if not org_name and expanded_terms:
            for kw in expanded_terms:
                potential_org = db.query(DivingOrganization).filter(
                    or_(
                        DivingOrganization.name.ilike(f"%{kw}%"),
                        DivingOrganization.acronym.ilike(f"%{kw}%")
                    )
                ).first()

                if potential_org:
                    org_match = potential_org
                    break

        query_cert = db.query(CertificationLevel).join(DivingOrganization)

        if org_name:
            query_cert = query_cert.filter(DivingOrganization.acronym == org_name)
        elif org_match:
            query_cert = query_cert.filter(DivingOrganization.id == org_match.id)

        if not org_name and not org_match and expanded_terms:
            kw_filters = []
            for kw in expanded_terms:
                kw_filters.append(CertificationLevel.name.ilike(f"%{kw}%"))

            if kw_filters:
                 query_cert = query_cert.filter(or_(*kw_filters))

        certs = query_cert.limit(30).all()

        org_certs = {}
        for cert in certs:
            org = cert.diving_organization.name
            if org not in org_certs:
                org_certs[org] = []

            cert_info = {
                "name": cert.name,
                "category": cert.category,
                "max_depth": cert.max_depth,
                "prerequisites": cert.prerequisites,
                "order_hint": 0, 
                "route_path": f"/resources/diving-organizations?org={quote(cert.diving_organization.acronym or cert.diving_organization.name)}&course={quote(cert.name)}"
            }
            org_certs[org].append(cert_info)

        for org, cert_list in org_certs.items():
            org_acronym = next((c.diving_organization.acronym for c in certs if c.diving_organization.name == org), org)
            results.append({
                "entity_type": "career_path",
                "id": 0,
                "name": f"Career Path: {org}",
                "organization": org,
                "courses": [c["name"] for c in cert_list],
                "details": cert_list,
                "route_path": f"/resources/diving-organizations?org={quote(org_acronym)}"
            })

    elif intent_type == IntentType.MARINE_LIFE:
        if keywords:
            query_marine = db.query(DiveSite)

            if direction and location:
                res = get_external_region_bounds(location)
                if res:
                    bounds, _ = res
                else:
                    bounds = get_empirical_region_bounds(db, location)
                if bounds:
                    n, s, e, w = bounds
                    new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                    query_marine = query_marine.filter(
                        DiveSite.latitude <= new_n,
                        DiveSite.latitude >= new_s,
                        DiveSite.longitude <= new_e,
                        DiveSite.longitude >= new_w,
                        or_(
                            DiveSite.region.ilike(f"%{location}%"),
                            DiveSite.country.ilike(f"%{location}%"),
                            DiveSite.description.ilike(f"%{location}%")
                        )
                    )
                else:
                    query_marine = query_marine.filter(
                        or_(
                            DiveSite.region.ilike(f"%{location}%"),
                            DiveSite.country.ilike(f"%{location}%"),
                            DiveSite.description.ilike(f"%{location}%")
                        )
                    )
            elif location:
                query_marine = query_marine.filter(
                    or_(
                        DiveSite.region.ilike(f"%{location}%"),
                        DiveSite.country.ilike(f"%{location}%"),
                        DiveSite.description.ilike(f"%{location}%")
                    )
                )
            elif latitude and longitude:
                lat_range = 0.5 
                lon_range = 0.5

                if direction:
                    n = latitude + (lat_range / 2)
                    s = latitude - (lat_range / 2)
                    e = longitude + (lon_range / 2)
                    w = longitude - (lon_range / 2)
                    new_n, new_s, new_e, new_w = calculate_directional_bounds(n, s, e, w, direction)
                    query_marine = query_marine.filter(
                        DiveSite.latitude <= new_n,
                        DiveSite.latitude >= new_s,
                        DiveSite.longitude <= new_e,
                        DiveSite.longitude >= new_w
                    )
                else:
                    query_marine = query_marine.filter(
                        DiveSite.latitude >= latitude - (lat_range / 2),
                        DiveSite.latitude <= latitude + (lat_range / 2),
                        DiveSite.longitude >= longitude - (lon_range / 2),
                        DiveSite.longitude <= longitude + (lon_range / 2)
                    )

            and_filters = []
            or_filters = []

            relevant_keywords = []
            for kw in keywords:
                if location and kw.lower() in location.lower(): continue
                if kw.lower() in ["see", "find", "watch", "look", "where", "sites", "marine", "life", "underwater", "creatures"]: continue
                relevant_keywords.append(kw)

                if ' ' in kw:
                    for word in kw.split():
                        if len(word) > 3 and word.lower() not in ["with", "and", "the", "for"]:
                            relevant_keywords.append(word)

            if relevant_keywords:
                for kw in relevant_keywords:
                    f = or_(
                        DiveSite.marine_life.ilike(f"%{kw}%"),
                        DiveSite.name.ilike(f"%{kw}%"),
                        DiveSite.description.ilike(f"%{kw}%")
                    )
                    and_filters.append(f)
                    or_filters.append(f)

                strict_query = query_marine.filter(and_(*and_filters))
                sites = strict_query.limit(10).all()

                if len(sites) < 3 and len(relevant_keywords) > 1:
                    existing_ids = {s.id for s in sites}
                    fallback_query = query_marine.filter(or_(*or_filters))
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

    elif intent_type == IntentType.PERSONAL_RECOMMENDATION:
        query_rec = db.query(DiveSite).options(joinedload(DiveSite.difficulty))
        
        target_lat = latitude
        target_lon = longitude
        location_name = location
        has_location = False

        if current_user:
            from app.services.chat.utils import get_user_difficulty_level
            user_max_difficulty = get_user_difficulty_level(db, current_user.id)

            past_dives = db.query(Dive).options(joinedload(Dive.dive_site)).filter(Dive.user_id == current_user.id).all()
            visited_site_ids = {d.dive_site_id for d in past_dives if d.dive_site_id}

            if not location_name and not (target_lat and target_lon):
                last_dive = db.query(Dive).options(joinedload(Dive.dive_site)).filter(Dive.user_id == current_user.id).order_by(Dive.dive_date.desc()).first()
                if last_dive and last_dive.dive_site:
                    target_lat = float(last_dive.dive_site.latitude)
                    target_lon = float(last_dive.dive_site.longitude)

            # Only filter by difficulty if user has actual certs (> 1)
            # If they are Level 1 (Beginner), we might filter out too many sites if none are explicitly level 1
            if user_max_difficulty and user_max_difficulty > 1:
                query_rec = query_rec.filter(DiveSite.difficulty_id <= user_max_difficulty)

            if visited_site_ids:
                query_rec = query_rec.filter(DiveSite.id.notin_(visited_site_ids))

        if location_name:
            has_location = True
            query_rec = query_rec.filter(
                or_(
                    DiveSite.region.ilike(f"%{location_name}%"),
                    DiveSite.country.ilike(f"%{location_name}%"),
                    DiveSite.description.ilike(f"%{location_name}%"),
                    DiveSite.name.ilike(f"%{location_name}%")
                )
            )
        elif target_lat and target_lon:
            has_location = True
            lat_range = 0.5 
            lon_range = 0.5
            query_rec = query_rec.filter(
                DiveSite.latitude >= target_lat - (lat_range / 2),
                DiveSite.latitude <= target_lat + (lat_range / 2),
                DiveSite.longitude >= target_lon - (lon_range / 2),
                DiveSite.longitude <= target_lon + (lon_range / 2)
            )

        RatingAlias = aliased(SiteRating)
        query_rec = query_rec.outerjoin(RatingAlias, DiveSite.ratings).group_by(DiveSite.id)
        query_rec = query_rec.order_by(func.avg(RatingAlias.score).desc())

        # If we have location or a current user, we execute the query
        if has_location or current_user:
            sites = query_rec.limit(5).all()
            
            # Fallback if no sites found due to strict filters
            if not sites and current_user:
                fallback_query = db.query(DiveSite).options(joinedload(DiveSite.difficulty))
                if has_location:
                    if location_name:
                        fallback_query = fallback_query.filter(
                            or_(
                                DiveSite.region.ilike(f"%{location_name}%"),
                                DiveSite.country.ilike(f"%{location_name}%"),
                                DiveSite.description.ilike(f"%{location_name}%"),
                                DiveSite.name.ilike(f"%{location_name}%")
                            )
                        )
                    elif target_lat and target_lon:
                        fallback_query = fallback_query.filter(
                            DiveSite.latitude >= target_lat - (lat_range / 2),
                            DiveSite.latitude <= target_lat + (lat_range / 2),
                            DiveSite.longitude >= target_lon - (lon_range / 2),
                            DiveSite.longitude <= target_lon + (lon_range / 2)
                        )
                RatingAlias2 = aliased(SiteRating)
                fallback_query = fallback_query.outerjoin(RatingAlias2, DiveSite.ratings).group_by(DiveSite.id)
                fallback_query = fallback_query.order_by(func.avg(RatingAlias2.score).desc())
                sites = fallback_query.limit(5).all()

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
        else:
            # If no user and no location, just return top 5 globally
            sites = query_rec.limit(5).all()
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

        if not results:
            centers_query = db.query(DivingCenter)
            if location_name:
                centers_query = centers_query.filter(
                    or_(
                        DivingCenter.region.ilike(f"%{location_name}%"),
                        DivingCenter.country.ilike(f"%{location_name}%"),
                        DivingCenter.city.ilike(f"%{location_name}%"),
                        DivingCenter.name.ilike(f"%{location_name}%")
                    )
                )
            elif target_lat and target_lon:
                lat_range = 0.5 
                lon_range = 0.5
                centers_query = centers_query.filter(
                    DivingCenter.latitude >= target_lat - (lat_range / 2),
                    DivingCenter.latitude <= target_lat + (lat_range / 2),
                    DivingCenter.longitude >= target_lon - (lon_range / 2),
                    DivingCenter.longitude <= target_lon + (lon_range / 2)
                )
            
            if location_name or (target_lat and target_lon):
                centers = centers_query.limit(5).all()
                if centers:
                    results.append({
                        "entity_type": "system_message",
                        "message": "No dive sites found matching the criteria. However, here are some diving centers in the area you could contact:"
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
                else:
                    results.append({
                        "entity_type": "system_message",
                        "error": "No dive sites or diving centers found matching the criteria in this area."
                    })

    elif intent_type == IntentType.COMPARISON:
        search_terms = keywords if keywords else ([query] if query else [])
        
        stop_words = {"vs", "difference", "compare", "comparison", "between", "and", "or", "what", "is", "the", "technical", "diving", "certification", "certifications", "course", "courses", "details"}
        
        # Extract meaningful terms
        import re as py_re
        expanded_terms = []
        for t in search_terms:
            parts = py_re.findall(r'[a-zA-Z]+|\d+', t.lower())
            for p in parts:
                if p not in stop_words and len(p) > 1:
                    expanded_terms.append(p)

        certs = []
        if expanded_terms:
            potential_certs = []
            
            # Use the organization parameter if provided by the LLM
            org_filter = None
            if organization:
                org_filter = organization.upper()
            
            # Query builder
            base_query = db.query(CertificationLevel).join(DivingOrganization)
            if org_filter:
                base_query = base_query.filter(DivingOrganization.acronym == org_filter)
                
            # Search for the meaningful keywords
            for kw in expanded_terms:
                matches = base_query.filter(
                    or_(
                        CertificationLevel.name.ilike(f"%{kw}%"),
                        CertificationLevel.category.ilike(f"%{kw}%"),
                        DivingOrganization.acronym.ilike(f"{kw}")
                    )
                ).all()
                potential_certs.extend(matches)

            seen_ids = set()
            for c in potential_certs:
                if c.id not in seen_ids:
                    certs.append(c)
                    seen_ids.add(c.id)

            def sort_score(c):
                score = 0
                c_name_lower = c.name.lower()
                c_name_words = set(py_re.findall(r'[a-zA-Z]+|\d+', c_name_lower))
                for kw in expanded_terms:
                    kw_lower = kw.lower()
                    if kw_lower == c_name_lower:
                        score += 100  # Exact match
                    elif kw_lower in c_name_words:
                        score += 10   # Whole word match inside name
                    elif kw_lower in c_name_lower:
                        score += 1    # Substring match
                return score

            # Sort the results so that exact matches on the name come first
            certs.sort(key=sort_score, reverse=True)

            # Cap the results to a small number of highly relevant hits
            for cert in certs[:20]:
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

    elif intent_type == IntentType.KNOWLEDGE:
        search_terms = keywords if keywords else ([query] if query else [])
        query_str = " ".join(search_terms)
        if query_str:
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

            if len(results) < 3:
                site_kws = [kw for kw in search_terms if kw.lower() not in ['history', 'info', 'information', 'about', 'what', 'is', 'the']]
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

    elif intent_type == IntentType.CONTEXT_QA and context_entity_id:
        if context_entity_type == "dive_site":
            from sqlalchemy.orm import selectinload
            site = db.query(DiveSite).options(
                selectinload(DiveSite.center_relationships).joinedload(CenterDiveSite.diving_center),
                joinedload(DiveSite.difficulty)
            ).filter(DiveSite.id == context_entity_id).first()

            if site:
                centers = []
                for rel in site.center_relationships:
                    if rel.diving_center:
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
        elif context_entity_type == "diving_center":
            center = db.query(DivingCenter).filter(DivingCenter.id == context_entity_id).first()
            if center:
                results.append({
                    "entity_type": "diving_center",
                    "id": center.id,
                    "name": center.name,
                    "description": center.description,
                    "address": center.address,
                    "website": center.website
                })

    elif intent_type == IntentType.CALCULATOR:
        calc_results = {
            "entity_type": "calculator_results", 
            "name": "Diving Calculation Results",
            "source": "Divemap Physics Engine"
        }
        params = calculator_params or {}
        specific_tool = "/resources/tools"

        if params.get('o2') is not None:
            pp_o2 = params.get('pp_o2_max', 1.4)
            mod = calculate_mod(GasMix(o2=params['o2'], he=params.get('he', 0.0) or 0.0), pp_o2)
            calc_results['mod'] = f"{mod:.1f} meters (at {pp_o2} ppO2)"
            specific_tool = "/resources/tools?tab=mod"

        if all(params.get(k) is not None for k in ['start_pressure', 'end_pressure', 'tank_volume', 'depth', 'duration']):
            gas = GasMix(o2=params.get('o2', 21.0) or 21.0, he=params.get('he', 0.0) or 0.0)
            sac = calculate_sac(
                params['depth'], params['duration'], params['tank_volume'], 
                params['start_pressure'], params['end_pressure'], gas
            )
            calc_results['sac_rate'] = f"{sac:.2f} L/min"
            specific_tool = "/resources/tools?tab=sac"

        if params.get('depth') is not None and params.get('pp_o2_max') is not None:
            best_mix = calculate_best_mix(params['depth'], params['pp_o2_max'])
            calc_results['best_mix'] = f"{best_mix.o2:.1f}% O2"
            specific_tool = "/resources/tools?tab=best-mix"

        if params.get('depth') is not None and (params.get('o2') is not None or params.get('he') is not None):
            gas = GasMix(o2=params.get('o2', 21.0) or 21.0, he=params.get('he', 0.0) or 0.0)
            ead = calculate_ead(params['depth'], gas)
            end = calculate_end(params['depth'], gas)
            calc_results['ead'] = f"{ead:.1f} meters"
            if gas.he > 0:
                calc_results['end'] = f"{end:.1f} meters"

        if all(params.get(k) is not None for k in ['depth', 'duration', 'sac_rate', 'tank_volume']):
            min_gas = calculate_min_gas(params['depth'], params['duration'], params['sac_rate'], params['tank_volume'])
            calc_results['min_gas_reserve'] = f"{min_gas:.1f} bar"
            specific_tool = "/resources/tools?tab=min-gas"

        results.append(calc_results)
        results.append({
            "entity_type": "calculator_tools",
            "name": "Divemap Tools",
            "description": "Access to high-precision diving calculators.",
            "route_path": specific_tool
        })

    return clean_results(results)
