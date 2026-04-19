from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, and_, or_, desc, asc, select, text, distinct, literal_column
from slowapi.util import get_remote_address
from datetime import datetime, timedelta
import difflib
import orjson
import uuid
import random
from pathlib import Path
from app.services.r2_storage_service import get_r2_storage
from app.services.image_processing import image_processing
from app.database import get_db
from app.models import DiveSite, SiteRating, SiteComment, SiteMedia, User, DivingCenter, CenterDiveSite, UserCertification, DivingOrganization, Dive, DiveTag, AvailableTag, DiveSiteAlias, DiveSiteTag, ParsedDive, DiveRoute, DifficultyLevel, get_difficulty_id_by_code, OwnershipStatus
from app.services.osm_coastline_service import detect_shore_direction
from app.services.wind_recommendation_service import calculate_wind_suitability
from app.services.open_meteo_service import fetch_wind_data_single_point
from app.models import DiveSite, SiteRating, SiteComment, SiteMedia, User, DivingCenter, CenterDiveSite, UserCertification, DivingOrganization, Dive, DiveTag, AvailableTag, DiveSiteAlias, DiveSiteTag, ParsedDive, DiveRoute, DifficultyLevel, get_difficulty_id_by_code, OwnershipStatus, DiveMedia, DiveSiteEditRequest, EditRequestStatus, EditRequestType
from app.auth import is_trusted_contributor
from fastapi.responses import JSONResponse

from app.schemas import (
    DiveSiteCreate, DiveSiteUpdate, DiveSiteResponse, DiveSiteListResponse,
    SiteRatingCreate, SiteRatingResponse,
    SiteCommentCreate, SiteCommentUpdate, SiteCommentResponse,
    SiteMediaCreate, SiteMediaUpdate, SiteMediaResponse, DiveSiteMediaOrderRequest,
    DiveSiteSearchParams, CenterDiveSiteCreate, DiveResponse,
    DiveSiteAliasCreate, DiveSiteAliasUpdate, DiveSiteAliasResponse,
    DiveRouteCreate, DiveRouteResponse, DiveRouteWithCreator
)
import requests
from app.auth import get_current_active_user, get_current_admin_user, get_current_user_optional, get_current_user
from app.limiter import limiter, skip_rate_limit_for_admin
from app.utils import (
    calculate_unified_phrase_aware_score,
    classify_match_type,
    get_unified_fuzzy_trigger_conditions,
    UNIFIED_TYPO_TOLERANCE
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def calculate_phrase_aware_score(query: str, site_name: str, site_country: str, site_region: str, site_description: str, site_tags: List[str] = None) -> float:
    """
    Calculate a relevance score using phrase-aware logic that prioritizes site names
    over geographic fields and handles multi-word queries intelligently.

    Args:
        query: The search query string
        site_name: The dive site name
        site_country: The dive site country (can be None)
        site_region: The dive site region (can be None)
        site_description: The dive site description (can be None)
        site_tags: List of tag names for the dive site (can be None)

    Returns:
        Float score between 0.0 and 1.0, where higher is more relevant
    """
    query_lower = query.lower()
    name_lower = site_name.lower()
    country_lower = (site_country or "").lower()
    region_lower = (site_region or "").lower()
    desc_lower = (site_description or "").lower()

    # 1. Exact phrase match (highest priority)
    if query_lower in name_lower:
        return 1.0

    # 2. Word-by-word matching in name (with fuzzy matching for typos)
    query_words = query_lower.split()
    name_words = name_lower.split()

    # Count how many query words appear in name (with fuzzy matching)
    matching_words = 0
    for query_word in query_words:
        # Check for exact substring match first
        if any(query_word in name_word for name_word in name_words):
            matching_words += 1
        else:
            # Check for fuzzy similarity (typo tolerance)
            for name_word in name_words:
                if difflib.SequenceMatcher(None, query_word, name_word).ratio() >= 0.7:
                    matching_words += 1
                    break

    word_match_ratio = matching_words / len(query_words)

    # 3. Consecutive word bonus (for "blue hole" in "bluehole reef")
    consecutive_bonus = 0.0
    if len(query_words) > 1:
        # Check if words appear consecutively (even if concatenated)
        query_phrase = ''.join(query_words)
        if query_phrase in name_lower.replace(' ', ''):
            consecutive_bonus = 0.3
        else:
            # Check for fuzzy similarity of concatenated phrase
            name_no_spaces = name_lower.replace(' ', '')
            if difflib.SequenceMatcher(None, query_phrase, name_no_spaces).ratio() >= 0.7:
                consecutive_bonus = 0.2

    # 4. Geographic field matching (country and region)
    geographic_bonus = 0.0
    if country_lower and query_lower in country_lower:
        geographic_bonus += 0.2
    if region_lower and query_lower in region_lower:
        geographic_bonus += 0.2

    # 5. Tag matching (high priority for specialized searches)
    tag_bonus = 0.0
    if site_tags:
        for tag in site_tags:
            tag_lower = tag.lower()
            if query_lower in tag_lower:
                tag_bonus += 0.3  # High bonus for tag matches
                break
            # Also check for word-by-word matching in tags
            for query_word in query_words:
                if query_word in tag_lower:
                    tag_bonus += 0.2
                    break

    # 6. Traditional similarity for edge cases
    similarity_score = difflib.SequenceMatcher(None, query_lower, name_lower).ratio()

    # 7. Weighted final score
    final_score = (
        word_match_ratio * 0.4 +      # Word matching (40%)
        consecutive_bonus +            # Consecutive bonus
        geographic_bonus +             # Geographic bonus
        tag_bonus +                    # Tag bonus
        similarity_score * 0.2 +      # Traditional similarity (20%)
        (0.1 if query_lower in desc_lower else 0.0)  # Description bonus (10%)
    )

    # 7. Special case: if it's a single word and has high similarity to any name word, boost the score
    if len(query_words) == 1 and len(name_words) > 0:
        best_word_similarity = max(
            difflib.SequenceMatcher(None, query_words[0], name_word).ratio()
            for name_word in name_words
        )
        if best_word_similarity >= 0.8:  # High similarity threshold for single words
            final_score = max(final_score, best_word_similarity * 0.8)

    return min(final_score, 1.0)


def apply_tag_filtering(query, tag_ids, db):
    """
    Apply tag filtering to a query using consistent logic.

    Args:
        query: SQLAlchemy query object to filter
        tag_ids: List of tag IDs to filter by (AND logic)
        db: Database session

    Returns:
        Filtered query object

    Raises:
        HTTPException: If too many tag filters are provided
    """
    if not tag_ids:
        return query

    # Validate tag_ids to prevent injection
    if len(tag_ids) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many tag filters"
        )

    # Import required models
    from app.models import DiveSiteTag

    # If multiple tags are provided, ensure the site has ALL of them
    tag_count = len(tag_ids)

    # Use select() construct explicitly to avoid SQLAlchemy warning
    # "Coercing Subquery object into a select() for use in IN()"
    stmt = select(DiveSiteTag.dive_site_id).where(
        DiveSiteTag.tag_id.in_(tag_ids)
    ).group_by(DiveSiteTag.dive_site_id).having(
        func.count(DiveSiteTag.tag_id) == tag_count
    )

    return query.filter(DiveSite.id.in_(stmt))


def apply_search_filters(query, search, name, db):
    """
    Apply search and name filtering to a query.

    Args:
        query: SQLAlchemy query object to filter
        search: Search query string
        name: Name filter string
        db: Database session

    Returns:
        Filtered query object
    """
    if search:
        # Sanitize search input to prevent injection
        sanitized_search = search.strip()[:200]
        # Search across name, country, region, description, and aliases (case-insensitive using ilike)
        search_filter = or_(
            DiveSite.name.ilike(f"%{sanitized_search}%"),
            DiveSite.country.ilike(f"%{sanitized_search}%"),
            DiveSite.region.ilike(f"%{sanitized_search}%"),
            # Handle nullable description field safely
            and_(DiveSite.description.isnot(None), DiveSite.description.ilike(f"%{sanitized_search}%")),
            DiveSite.id.in_(
                db.query(DiveSiteAlias.dive_site_id).filter(
                    DiveSiteAlias.alias.ilike(f"%{sanitized_search}%")
                )
            )
        )
        query = query.filter(search_filter)

    if name:
        # Sanitize name input to prevent injection
        sanitized_name = name.strip()[:100]
        # Search in both dive site names and aliases
        query = query.filter(
            or_(
                DiveSite.name.ilike(f"%{sanitized_name}%"),
                DiveSite.id.in_(
                    db.query(DiveSiteAlias.dive_site_id).filter(
                        DiveSiteAlias.alias.ilike(f"%{sanitized_name}%")
                    )
                )
            )
        )

    return query


def apply_basic_filters(query, difficulty_code, exclude_unspecified_difficulty, country, region, my_dive_sites, current_user, db, created_by_username=None):
    """
    Apply basic filtering criteria to a query.

    Args:
        query: SQLAlchemy query object to filter
        difficulty_code: Difficulty code filter (e.g., 'OPEN_WATER')
        exclude_unspecified_difficulty: Whether to exclude sites with NULL difficulty (default: False)
        country: Country filter
        region: Region filter
        my_dive_sites: Whether to filter by user's dive sites
        current_user: Current authenticated user
        db: Database session for lookups
        created_by_username: Username of the user who created the dive sites

    Returns:
        Filtered query object
    """
    if difficulty_code:
        difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
        if difficulty_id:
            query = query.filter(DiveSite.difficulty_id == difficulty_id)
        elif exclude_unspecified_difficulty:
            # If code doesn't exist and we want to exclude undefined, return empty set
            query = query.filter(False)
    elif exclude_unspecified_difficulty:
        # If no difficulty_code filter but we want to exclude unspecified, exclude NULL
        query = query.filter(DiveSite.difficulty_id.isnot(None))

    if country:
        sanitized_country = country.strip()[:100]
        query = query.filter(DiveSite.country.ilike(f"%{sanitized_country}%"))

    if region:
        sanitized_region = region.strip()[:100]
        query = query.filter(DiveSite.region.ilike(f"%{sanitized_region}%"))

    if my_dive_sites and current_user:
        query = query.filter(DiveSite.created_by == current_user.id)

    if created_by_username:
        # Find user by username and filter by their created_by ID
        user = db.query(User).filter(User.username == created_by_username, User.enabled == True).first()
        if user:
            query = query.filter(DiveSite.created_by == user.id)
        else:
            # User not found, return empty result
            query = query.filter(False)

    return query


def apply_rating_filtering(query, min_rating, db):
    """
    Apply minimum rating filtering to a query.

    Args:
        query: SQLAlchemy query object to filter
        min_rating: Minimum average rating threshold
        db: Database session

    Returns:
        Filtered query object
    """
    if min_rating is not None:
        # Get dive site IDs that have an average rating >= min_rating
        dive_site_ids_with_min_rating = db.query(SiteRating.dive_site_id).group_by(
            SiteRating.dive_site_id
        ).having(
            func.avg(SiteRating.score) >= min_rating
        )
        query = query.filter(DiveSite.id.in_(dive_site_ids_with_min_rating))

    return query


def apply_sorting(query, sort_by, sort_order, current_user, ratings_subquery=None):
    """
    Apply sorting logic to a query.

    Args:
        query: SQLAlchemy query object to sort
        sort_by: Field to sort by
        sort_order: Sort order ('asc' or 'desc')
        current_user: Current authenticated user
        ratings_subquery: Optional aggregated ratings subquery (required when sort_by is average_rating)

    Returns:
        Sorted query object

    Raises:
        HTTPException: If sort parameters are invalid
    """
    if sort_by:
        # All valid sort fields (including admin-only ones)
        valid_sort_fields = {
            'name', 'country', 'region', 'difficulty_level',
            'view_count', 'comment_count', 'created_at', 'updated_at', 'average_rating'
        }

        if sort_by not in valid_sort_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by field. Must be one of: {', '.join(valid_sort_fields)}"
            )

        # Validate sort_order parameter
        if sort_order not in ['asc', 'desc']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sort_order must be 'asc' or 'desc'"
            )

        # Apply sorting based on field
        if sort_by == 'name':
            sort_field = func.lower(DiveSite.name)
        elif sort_by == 'country':
            sort_field = func.lower(DiveSite.country)
        elif sort_by == 'region':
            sort_field = func.lower(DiveSite.region)
        elif sort_by == 'difficulty_level':
            # Sort by difficulty order_index via LEFT JOIN (NULLs go last)
            query = query.outerjoin(DifficultyLevel, DiveSite.difficulty_id == DifficultyLevel.id)
            sort_field = DifficultyLevel.order_index
        elif sort_by == 'view_count':
            # Only admin users can sort by view_count
            if not current_user or not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Sorting by view_count is only available for admin users"
                )
            sort_field = DiveSite.view_count
        elif sort_by == 'comment_count':
            # Only admin users can sort by comment_count
            if not current_user or not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Sorting by comment_count is only available for admin users"
                )
            # Use the joined subquery column if available, otherwise join directly
            if 'comment_count' in [c.name for c in query.column_descriptions if hasattr(c, 'name')]:
                sort_field = text('comment_count')
            else:
                query = query.outerjoin(SiteComment).group_by(DiveSite.id)
                sort_field = func.count(SiteComment.id)
        elif sort_by == 'route_count':
            if 'route_count' in [c.name for c in query.column_descriptions if hasattr(c, 'name')]:
                sort_field = text('route_count')
            else:
                from app.models import DiveRoute
                query = query.outerjoin(DiveRoute, and_(DiveSite.id == DiveRoute.dive_site_id, DiveRoute.deleted_at.is_(None))).group_by(DiveSite.id)
                sort_field = func.count(DiveRoute.id)
        elif sort_by == 'average_rating':
            # ratings_subquery.c.avg_rating still traces to ORM (func.avg(SiteRating.score)); during
            # distinct().count() SQLAlchemy rewrites ORDER BY to avg(site_ratings.score) and adds
            # duplicate JOINs to site_ratings (MySQL 1066). Use a literal qualified column on the
            # named Core-built subquery instead.
            if ratings_subquery is None:
                raise RuntimeError("ratings_subquery is required when sort_by is average_rating")
            sort_field = literal_column(f"{ratings_subquery.name}.avg_rating")
        elif sort_by == 'created_at':
            sort_field = DiveSite.created_at
        elif sort_by == 'updated_at':
            sort_field = DiveSite.updated_at
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid sort_by field: {sort_by}"
            )

        # Apply the sorting
        if sort_order == 'asc':
            query = query.order_by(sort_field.asc())
        else:
            query = query.order_by(sort_field.desc())
    else:
        # Default sorting by name (case-insensitive)
        query = query.order_by(func.lower(DiveSite.name).asc())

    return query


def search_dive_sites_with_fuzzy(query: str, exact_results: List[DiveSite], db: Session, similarity_threshold: float = 0.2, max_fuzzy_results: int = 10, **filters):
    """
    Enhance search results with fuzzy matching when exact results are insufficient.

    Args:
        query: The search query string
        exact_results: List of dive sites from exact search
        db: Database session
        similarity_threshold: Minimum similarity score (0.0 to 1.0)
        max_fuzzy_results: Maximum number of fuzzy results to return
        **filters: Additional filters to apply (tag_ids, difficulty_code, etc.)

    Returns:
        List of dive sites with exact results first, followed by fuzzy matches
    """
    # If we have enough exact results, return them with match type info
    if len(exact_results) >= 10:
        # Convert exact results to the expected format
        final_results = []
        for site in exact_results:
            final_results.append({
                'site': site,
                'match_type': 'exact',
                'score': 1.0,
                'name_contains': query.lower() in site.name.lower(),
                'country_contains': site.country and query.lower() in site.country.lower(),
                'region_contains': site.region and query.lower() in site.region.lower(),
                'description_contains': site.description and query.lower() in site.description.lower()
            })
        return final_results

    # Build a filtered query that respects the same filters as the main query
    filtered_query = db.query(DiveSite)

    show_archived = filters.get('show_archived', False)
    if not show_archived:
        filtered_query = filtered_query.filter(DiveSite.deleted_at.is_(None))

    # Apply status filter if provided
    if 'status' in filters and filters['status'] and ('current_user' in filters and (filters['current_user'].is_admin or filters['current_user'].is_moderator)):
        filtered_query = filtered_query.filter(DiveSite.status == filters['status'])
    elif not show_archived:
        # Default to approved for non-admins if no explicit status is provided
        filtered_query = filtered_query.filter(DiveSite.status == 'approved')

    # Apply the same filters that were used in the main query
    if 'dive_site_id' in filters and filters['dive_site_id'] and ('current_user' in filters and (filters['current_user'].is_admin or filters['current_user'].is_moderator)):
        filtered_query = filtered_query.filter(DiveSite.id == filters['dive_site_id'])

    if 'difficulty_code' in filters and filters['difficulty_code']:
        from app.models import get_difficulty_id_by_code
        difficulty_id = get_difficulty_id_by_code(db, filters['difficulty_code'])
        if difficulty_id:
            filtered_query = filtered_query.filter(DiveSite.difficulty_id == difficulty_id)

    if 'country' in filters and filters['country']:
        filtered_query = filtered_query.filter(DiveSite.country.ilike(f"%{filters['country']}%"))

    if 'region' in filters and filters['region']:
        filtered_query = filtered_query.filter(DiveSite.region.ilike(f"%{filters['region']}%"))

    if 'min_rating' in filters and filters['min_rating'] is not None:
        from app.models import SiteRating
        dive_site_ids_with_min_rating = db.query(SiteRating.dive_site_id).group_by(
            SiteRating.dive_site_id
        ).having(
            func.avg(SiteRating.score) >= filters['min_rating']
        )
        filtered_query = filtered_query.filter(DiveSite.id.in_(dive_site_ids_with_min_rating))

    if 'tag_ids' in filters and filters['tag_ids']:
        from app.models import DiveSiteTag
        # Apply the same tag filtering logic
        tag_count = len(filters['tag_ids'])
        dive_sites_with_all_tags = db.query(DiveSiteTag.dive_site_id).filter(
            DiveSiteTag.tag_id.in_(filters['tag_ids'])
        ).group_by(DiveSiteTag.dive_site_id).having(
            func.count(DiveSiteTag.tag_id) == tag_count
        ).subquery()
        filtered_query = filtered_query.filter(DiveSite.id.in_(dive_sites_with_all_tags))

    if 'my_dive_sites' in filters and filters['my_dive_sites'] and 'current_user' in filters and filters['current_user']:
        filtered_query = filtered_query.filter(DiveSite.created_by == filters['current_user'].id)

    # Get filtered dive sites for fuzzy matching
    all_dive_sites = filtered_query.all()

    # Create a set of exact result IDs to avoid duplicates
    exact_ids = {site.id for site in exact_results}

    # Perform fuzzy matching on filtered dive sites (case-insensitive)
    fuzzy_matches = []
    query_lower = query.lower()  # Convert query to lowercase for case-insensitive comparison

    for site in all_dive_sites:
        # Skip if already in exact results
        if site.id in exact_ids:
            continue

        # Get tags for this dive site for scoring
        site_tags = []
        if hasattr(site, 'tags') and site.tags:
            site_tags = [tag.name if hasattr(tag, 'name') else str(tag) for tag in site.tags]
        else:
            # Query tags from database if not already loaded
            from app.models import DiveSiteTag, AvailableTag
            tags = db.query(AvailableTag).join(DiveSiteTag).filter(
                DiveSiteTag.dive_site_id == site.id
            ).all()
            site_tags = [tag.name for tag in tags]

        # Use the unified phrase-aware scoring function with tags
        weighted_score = calculate_unified_phrase_aware_score(
            query_lower,
            site.name,
            site.description,
            site.country,
            site.region,
            None,  # city parameter (not used for dive sites)
            site_tags
        )

        # Check for partial matches (substring matches) for match type classification
        name_contains = query_lower in site.name.lower()
        country_contains = site.country and query_lower in site.country.lower()
        region_contains = site.region and query.lower() in site.region.lower()
        description_contains = site.description and query.lower() in site.description.lower()

        # Determine match type using unified classification
        match_type = classify_match_type(weighted_score)

        # Add to fuzzy matches if above threshold
        if weighted_score >= UNIFIED_TYPO_TOLERANCE['overall_threshold']:
            fuzzy_matches.append({
                'site': site,
                'score': weighted_score,
                'match_type': match_type,
                'name_contains': name_contains,
                'country_contains': country_contains,
                'region_contains': region_contains,
                'description_contains': description_contains
            })

    # Sort fuzzy matches by score (highest first)
    fuzzy_matches.sort(key=lambda x: x['score'], reverse=True)

    # Limit fuzzy results
    fuzzy_matches = fuzzy_matches[:max_fuzzy_results]

    # Create final results with match type information
    final_results = []

    # Add exact results first with match type
    for site in exact_results:
        final_results.append({
            'site': site,
            'match_type': 'exact',
            'score': 1.0,
            'name_contains': query_lower in site.name.lower(),
            'country_contains': site.country and query.lower() in site.country.lower(),
            'region_contains': site.region and query.lower() in site.region.lower(),
            'description_contains': site.description and query.lower() in site.description.lower()
        })

    # Add fuzzy matches
    for match in fuzzy_matches:
        final_results.append(match)

    return final_results

def _perform_reverse_geocode(latitude: float, longitude: float) -> Optional[Dict]:
    """Internal helper to perform reverse geocoding without requiring a Request object."""
    try:
        import requests
        # Use OpenStreetMap Nominatim API for reverse geocoding
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "addressdetails": 1,
            "zoom": 8,
            "accept-language": "en"
        }

        headers = {
            "User-Agent": "Divemap/1.0 (https://github.com/kargig/divemap)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code != 200:
            return None

        data = response.json()
        address = data.get("address", {})

        # Extract country and region information
        country = address.get("country")

        def clean_regional_unit(text):
            if text:
                if text.endswith(" Regional Unit"):
                    return text[:-len(" Regional Unit")].strip()
                elif text.endswith("Regional Unit"):
                    return text[:-len("Regional Unit")].strip()
                return text
            return text

        county = clean_regional_unit(address.get("county"))
        state_district = clean_regional_unit(address.get("state_district"))

        if county and state_district:
            region = f"{county}, {state_district}"
        else:
            region = (
                clean_regional_unit(address.get("state")) or
                clean_regional_unit(address.get("province")) or
                clean_regional_unit(address.get("region")) or
                county
            )

        return {
            "country": country,
            "region": region,
            "full_address": data.get("display_name", "")
        }
    except Exception as e:
        logger.error(f"Internal geocoding error: {e}")
        return None

async def _update_location_data_background(dive_site_id: int):
    """Background task to automatically detect country, region and shore direction."""
    from app.database import SessionLocal
    from app.services.osm_coastline_service import detect_shore_direction

    db = SessionLocal()
    try:
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
        if not dive_site or not dive_site.latitude or not dive_site.longitude:
            return

        has_updates = False

        # 1. Automatic Geocoding (Country/Region)
        if not dive_site.country or not dive_site.region:
            location_data = _perform_reverse_geocode(float(dive_site.latitude), float(dive_site.longitude))
            if location_data:
                if not dive_site.country and location_data.get("country"):
                    dive_site.country = location_data["country"]
                    has_updates = True
                if not dive_site.region and location_data.get("region"):
                    dive_site.region = location_data["region"]
                    has_updates = True

        # 2. Shore Direction Detection
        if dive_site.shore_direction is None:
            shore_data = detect_shore_direction(float(dive_site.latitude), float(dive_site.longitude))
            if shore_data:
                dive_site.shore_direction = shore_data.get("shore_direction")
                dive_site.shore_direction_confidence = shore_data.get("confidence")
                dive_site.shore_direction_method = shore_data.get("method")
                dive_site.shore_direction_distance_m = shore_data.get("distance_to_coastline_m")
                has_updates = True

        if has_updates:
            db.commit()
            logger.info(f"Automatically updated location/shore data for dive site {dive_site_id}")

    except Exception as e:
        logger.error(f"Error in automatic location background task for site {dive_site_id}: {e}")
    finally:
        db.close()

@router.get("/reverse-geocode")
@skip_rate_limit_for_admin("75/minute")
async def reverse_geocode(
    request: Request,
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    debug: bool = Query(False, description="Enable debug logging for Nominatim API calls"),
    db: Session = Depends(get_db)
):
    """
    Get country and region suggestions based on coordinates using OpenStreetMap Nominatim API
    """
    try:
        # Use OpenStreetMap Nominatim API for reverse geocoding
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "addressdetails": 1,
            "zoom": 8,  # Get more detailed results
            "accept-language": "en"  # Request English language results
        }

        # Add User-Agent header as required by Nominatim
        headers = {
            "User-Agent": "Divemap/1.0 (https://github.com/kargig/divemap)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=15)

        # Log the response for debugging
        if debug:
            print(f"🔍 Nominatim API Request:")
            print(f"   URL: {url}")
            print(f"   Parameters: {params}")
            print(f"   Headers: {headers}")
            print(f"   Coordinates: lat={latitude}, lon={longitude}")

        response.raise_for_status()

        data = response.json()

        if debug:
            print(f"📡 Nominatim API Response:")
            print(f"   Status Code: {response.status_code}")
            print(f"   Response Headers: {dict(response.headers)}")
            print(f"   Full Response Content:")
            print(f"   {orjson.dumps(data, option=orjson.OPT_INDENT_2).decode('utf-8')}")

        address = data.get("address", {})

        # Extract country and region information
        country = address.get("country")

        # Helper function to clean "Regional Unit" from text
        # Only remove "Regional Unit" if it appears at the end, keep it if it appears at the beginning
        def clean_regional_unit(text):
            if text:
                # Remove " Regional Unit" only if it appears at the end
                if text.endswith(" Regional Unit"):
                    return text[:-len(" Regional Unit")].strip()
                # Remove "Regional Unit" only if it appears at the end (no leading space)
                elif text.endswith("Regional Unit"):
                    return text[:-len("Regional Unit")].strip()
                return text
            return text

        # Get and clean county and state_district fields
        county = clean_regional_unit(address.get("county"))
        state_district = clean_regional_unit(address.get("state_district"))

        if county and state_district:
            region = f"{county}, {state_district}"
        else:
            # Fallback to previous priority order, also cleaning "Regional Unit"
            region = (
                clean_regional_unit(address.get("state")) or
                clean_regional_unit(address.get("province")) or
                clean_regional_unit(address.get("region")) or
                county  # county alone if no state_district
            )

        # Log the extracted data
        if debug:
            print(f"📍 Extracted Location Data:")
            print(f"   Country: '{country}'")
            print(f"   Region: '{region}'")
            print(f"   Full Address: '{data.get('display_name', '')}'")
            print(f"   Raw Address Object: {orjson.dumps(address, option=orjson.OPT_INDENT_2).decode('utf-8')}")

            # Show which region fields were found and used
            print(f"   Region Field Analysis:")
            print(f"     county: '{address.get('county')}' → cleaned: '{county}'")
            print(f"     state_district: '{address.get('state_district')}' → cleaned: '{state_district}'")
            print(f"     state: '{address.get('state')}' → cleaned: '{clean_regional_unit(address.get('state'))}'")
            print(f"     province: '{address.get('province')}' → cleaned: '{clean_regional_unit(address.get('province'))}'")
            print(f"     region: '{address.get('region')}' → cleaned: '{clean_regional_unit(address.get('region'))}'")
            if county and state_district:
                print(f"     → Using concatenated: '{county}, {state_district}'")
            else:
                print(f"     → Using fallback: '{region}'")

        return {
            "country": country,
            "region": region,
            "full_address": data.get("display_name", "")
        }

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Geocoding service timeout. Please try again later."
        )
    except requests.exceptions.ConnectionError:
        # Fallback to basic location detection based on coordinates
        if debug:
            print("❌ OpenStreetMap API unavailable, using fallback location detection")
        fallback_result = get_fallback_location(latitude, longitude, debug)
        if debug:
            print(f"🔄 Fallback result: {fallback_result}")
        return fallback_result
    except requests.RequestException as e:
        # Fallback to basic location detection based on coordinates
        if debug:
            print(f"❌ OpenStreetMap API error: {e}, using fallback location detection")
        fallback_result = get_fallback_location(latitude, longitude, debug)
        if debug:
            print(f"🔄 Fallback result: {fallback_result}")
        return fallback_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during geocoding: {str(e)}"
        )

def get_fallback_location(latitude: float, longitude: float, debug: bool = False):
    """
    Fallback function to provide basic location information based on coordinates
    """
    if debug:
        print(f"🔄 Using fallback location detection for coordinates: lat={latitude}, lon={longitude}")

    # Simple fallback based on coordinate ranges
    if -90 <= latitude <= 90 and -180 <= longitude <= 180:
        # Basic region detection based on longitude
        if -180 <= longitude < -120:
            region = "Western Pacific"
        elif -120 <= longitude < -60:
            region = "Americas"
        elif -60 <= longitude < 0:
            region = "Atlantic"
        elif 0 <= longitude < 60:
            region = "Europe/Africa"
        elif 60 <= longitude < 120:
            region = "Asia"
        else:
            region = "Western Pacific"

        # Basic country detection based on latitude
        if -60 <= latitude < -30:
            country = "Antarctica"
        elif -30 <= latitude < 0:
            country = "Southern Hemisphere"
        elif 0 <= latitude < 30:
            country = "Tropical Region"
        elif 30 <= latitude < 60:
            country = "Northern Hemisphere"
        else:
            country = "Arctic Region"

        fallback_result = {
            "country": country,
            "region": region,
            "full_address": f"Coordinates: {latitude}, {longitude}"
        }

        if debug:
            print(f"   Fallback region detection: {region}")
            print(f"   Fallback country detection: {country}")
            print(f"   Fallback result: {fallback_result}")

        return fallback_result
    else:
        if debug:
            print(f"   ❌ Invalid coordinates: lat={latitude}, lon={longitude}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid coordinates provided"
        )

@router.get("/", response_model=DiveSiteListResponse, response_model_exclude_none=True)
@skip_rate_limit_for_admin("250/minute")
async def get_dive_sites(
    request: Request,
    search: Optional[str] = Query(None, max_length=200, description="Unified search across name, country, region, and description"),
    name: Optional[str] = Query(None, max_length=100),
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    exclude_unspecified_difficulty: bool = Query(False, description="Exclude dive sites with unspecified difficulty"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum average rating (0-10)"),
    tag_ids: Optional[List[int]] = Query(None),
    country: Optional[str] = Query(None, max_length=100),
    region: Optional[str] = Query(None, max_length=100),
    my_dive_sites: Optional[bool] = Query(None, description="Filter to show only dive sites created by the current user"),
    created_by_username: Optional[str] = Query(None, description="Filter by username of the user who created the dive sites"),
    sort_by: Optional[str] = Query(None, description="Sort field (name, country, region, difficulty_level, created_at, updated_at). Admin users can also sort by view_count and comment_count."),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, 100, or 1000)"),
    wind_suitability: Optional[str] = Query(None, description="Filter by wind suitability range: 'good' (only good), 'caution' (good+caution), 'difficult' (good+caution+difficult), 'avoid' (all conditions)"),
    include_unknown_wind: bool = Query(False, description="Include dive sites with unknown wind conditions in addition to the selected range"),
    datetime_str: Optional[str] = Query(None, description="Target date/time in ISO format (YYYY-MM-DDTHH:MM:SS) for wind filtering. Defaults to current time. Max +2 days ahead."),
    north: Optional[float] = Query(None, ge=-90, le=90, description="North bound for viewport filtering"),
    south: Optional[float] = Query(None, ge=-90, le=90, description="South bound for viewport filtering"),
    east: Optional[float] = Query(None, ge=-180, le=180, description="East bound for viewport filtering"),
    west: Optional[float] = Query(None, ge=-180, le=180, description="West bound for viewport filtering"),
    detail_level: Optional[str] = Query('full', description="Data detail level: 'minimal' (id, lat, lng only), 'basic' (id, name, lat, lng, difficulty, rating), 'full' (all fields)"),
    include_archived: bool = Query(False, description="Include soft-deleted (archived) dive sites (Admin only)"),
    site_status: Optional[str] = Query(None, alias="status", description="Filter by status (approved, pending, rejected). Admin only for pending/rejected."),
    dive_site_id: Optional[int] = Query(None, description="Filter by a specific dive site ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):

    # Validate page_size to only allow 25, 50, 100, or 1000
    if page_size not in [1, 5, 25, 50, 100, 1000]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be one of: 25, 50, 100, 1000"
        )

    # Validate search query length
    if search and len(search.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 3 characters long"
        )

    # Validate wind_suitability parameter if provided
    if wind_suitability is not None:
        valid_suitabilities = ['good', 'caution', 'difficult', 'avoid', 'unknown']
        if wind_suitability.lower() not in valid_suitabilities:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"wind_suitability must be one of: {', '.join(valid_suitabilities)}"
            )
        wind_suitability = wind_suitability.lower()

    # Validate detail_level parameter if provided
    if detail_level is not None:
        valid_detail_levels = ['minimal', 'basic', 'full']
        if detail_level.lower() not in valid_detail_levels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"detail_level must be one of: {', '.join(valid_detail_levels)}"
            )
        detail_level = detail_level.lower()
    else:
        detail_level = 'full'

    # Validate bounds if provided
    if all(x is not None for x in [north, south, east, west]):
        if north <= south:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="north must be greater than south"
            )
        # Handle longitude wrap-around (e.g., -179 to 179)
        # For now, we'll allow east < west to handle date line crossing
        # The between() filter will handle this correctly

    # Parse and validate datetime_str if provided
    target_datetime = None
    if datetime_str:
        try:
            target_datetime = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            # Validate date range: only allow up to +2 days ahead
            # Round max_future to next hour to allow selecting any hour within 2-day window
            now_utc = datetime.utcnow()
            max_future = (now_utc + timedelta(days=2)).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            if target_datetime > max_future:
                raise HTTPException(
                    status_code=400,
                    detail=f"Date/time cannot be more than 2 days ahead. Maximum allowed: {max_future.isoformat()}"
                )
            # Don't allow past dates (only current and future up to +2 days)
            if target_datetime < datetime.utcnow() - timedelta(hours=1):
                raise HTTPException(
                    status_code=400,
                    detail="Date/time cannot be more than 1 hour in the past"
                )
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid datetime format. Use ISO 8601 format (e.g., '2025-12-01T14:00:00'): {str(e)}"
            )

    # Check if we should include archived sites (admin only feature)
    show_archived = include_archived and current_user and current_user.is_admin

    # Eager load difficulty relationship for efficient access
    query = db.query(DiveSite).options(joinedload(DiveSite.difficulty))
    if not show_archived:
        query = query.filter(DiveSite.deleted_at.is_(None))

        # Apply status filter
        if site_status and (current_user and (current_user.is_admin or current_user.is_moderator)):
            query = query.filter(DiveSite.status == site_status)
        else:
            query = query.filter(DiveSite.status == 'approved')
    elif site_status:
        # For admin with show_archived=True, still allow explicit status filter
        query = query.filter(DiveSite.status == site_status)

    # Store the search query for potential fuzzy search enhancement
    search_query_for_fuzzy = None
    if search:
        search_query_for_fuzzy = search.strip()[:200]

    # Apply search and name filtering using utility function
    query = apply_search_filters(query, search, name, db)

    # Apply basic filters using utility function
    query = apply_basic_filters(query, difficulty_code, exclude_unspecified_difficulty, country, region, my_dive_sites, current_user, db, created_by_username)

    # Apply tag filtering using utility function
    query = apply_tag_filtering(query, tag_ids, db)

    # Apply rating filtering using utility function
    query = apply_rating_filtering(query, min_rating, db)

    # Apply specific ID filter if provided (Admin/Moderator only)
    if dive_site_id and (current_user and (current_user.is_admin or current_user.is_moderator)):
        query = query.filter(DiveSite.id == dive_site_id)

    # Apply bounds filtering if provided
    if all(x is not None for x in [north, south, east, west]):
        from app.utils import get_rounded_buffered_bounds
        north, south, east, west = get_rounded_buffered_bounds(north, south, east, west)
        
        query = query.filter(
            DiveSite.latitude.between(south, north),
            DiveSite.longitude.between(west, east)
        )

    # Apply sorting using utility function
    # Removed premature sorting call here to prevent subquery aliasing conflicts later
    
    # Apply wind suitability filtering if requested
    if wind_suitability is not None:
        try:
            logger.info(f"[WIND FILTER] Filtering by wind_suitability={wind_suitability}, include_unknown_wind={include_unknown_wind}, target_datetime={target_datetime}")

            # Define suitability hierarchy for range filtering
            # Order: good < caution < difficult < avoid
            suitability_order = {"good": 0, "caution": 1, "difficult": 2, "avoid": 3}

            # Determine which suitabilities to include based on range
            if wind_suitability == "good":
                allowed_suitabilities = ["good"]
            elif wind_suitability == "caution":
                allowed_suitabilities = ["good", "caution"]
            elif wind_suitability == "difficult":
                allowed_suitabilities = ["good", "caution", "difficult"]
            elif wind_suitability == "avoid":
                allowed_suitabilities = ["good", "caution", "difficult", "avoid"]
            else:
                # Invalid value, return empty result
                logger.warning(f"[WIND FILTER] Invalid wind_suitability value: {wind_suitability}")
                query = query.filter(False)
                allowed_suitabilities = []

            # Get all matching dive sites before pagination (needed for wind filtering)
            all_matching_sites = query.all()
            logger.info(f"[WIND FILTER] Found {len(all_matching_sites)} sites before wind suitability filtering")

            if all_matching_sites and allowed_suitabilities:
                sites_with_coords = [s for s in all_matching_sites if s.latitude is not None and s.longitude is not None]
                if sites_with_coords:
                    # OPTIMIZATION: Group sites by cache key (0.1° grid cell) to batch fetch wind data
                    # This reduces API calls and improves accuracy (sites get wind data from their actual grid cell)
                    # The open_meteo_service cache already handles deduplication at the 0.1° level

                    def get_cache_key_for_site(site, target_datetime):
                        """Generate cache key for a site (matches open_meteo_service logic)."""
                        rounded_lat = round(site.latitude * 10) / 10
                        rounded_lon = round(site.longitude * 10) / 10
                        base_key = (rounded_lat, rounded_lon)

                        if target_datetime:
                            # Round to nearest hour for cache efficiency
                            hour_key = target_datetime.replace(minute=0, second=0, microsecond=0).isoformat()
                            return (base_key, hour_key)
                        return base_key

                    # Group sites by cache key
                    sites_by_cache_key = {}
                    for site in sites_with_coords:
                        cache_key = get_cache_key_for_site(site, target_datetime)
                        if cache_key not in sites_by_cache_key:
                            sites_by_cache_key[cache_key] = []
                        sites_by_cache_key[cache_key].append(site)

                    # Fetch wind data once per unique grid cell
                    # Use a representative site from each group (first site in group)
                    wind_data_by_cache_key = {}
                    fetch_errors = []

                    for cache_key, sites_in_group in sites_by_cache_key.items():
                        # Use first site in group as representative for fetching wind data
                        representative_site = sites_in_group[0]

                        try:
                            wind_data = fetch_wind_data_single_point(
                                representative_site.latitude,
                                representative_site.longitude,
                                target_datetime,
                                skip_validation=True  # Validation already done at endpoint level
                            )

                            if wind_data:
                                wind_data_by_cache_key[cache_key] = wind_data
                            else:
                                fetch_errors.append(f"Failed to fetch wind data for grid cell {cache_key}")
                        except Exception as e:
                            logger.error(f"Error fetching wind data for grid cell {cache_key}: {str(e)}")
                            fetch_errors.append(f"Error fetching wind data for grid cell {cache_key}: {str(e)}")

                    # Calculate suitability for each site
                    filtered_site_ids = []

                    for site in all_matching_sites:
                        try:
                            # Handle sites without coordinates (they have "unknown" suitability)
                            if site.latitude is None or site.longitude is None:
                                if include_unknown_wind:
                                    filtered_site_ids.append(site.id)
                                continue

                            # Get cache key for this site
                            cache_key = get_cache_key_for_site(site, target_datetime)

                            # Get wind data for this site's grid cell
                            wind_data = wind_data_by_cache_key.get(cache_key)

                            if not wind_data:
                                # No wind data for this grid cell - site has "unknown" suitability
                                if include_unknown_wind:
                                    filtered_site_ids.append(site.id)
                                continue

                            wind_direction = wind_data.get("wind_direction_10m")
                            wind_speed = wind_data.get("wind_speed_10m")
                            wind_gusts = wind_data.get("wind_gusts_10m")
                            wave_height = wind_data.get("wave_height")
                            wave_period = wind_data.get("wave_period")

                            if wind_direction is not None and wind_speed is not None:
                                suitability_result = calculate_wind_suitability(
                                    wind_direction=wind_direction,
                                    wind_speed=wind_speed,
                                    shore_direction=float(site.shore_direction) if site.shore_direction else None,
                                    wind_gusts=wind_gusts,
                                    wave_height=wave_height,
                                    wave_period=wave_period
                                )

                                site_suitability = suitability_result["suitability"]

                                # Filter by suitability range
                                if site_suitability in allowed_suitabilities:
                                    filtered_site_ids.append(site.id)
                                elif include_unknown_wind and site_suitability == "unknown":
                                    # Include unknown if checkbox is checked
                                    filtered_site_ids.append(site.id)
                            else:
                                # Invalid wind data - site has "unknown" suitability
                                if include_unknown_wind:
                                    filtered_site_ids.append(site.id)
                        except Exception as e:
                            logger.error(f"Error calculating suitability for site {site.id}: {str(e)}")
                            # Skip this site if calculation fails
                            continue

                    # Rebuild query with filtered site IDs
                    logger.info(f"[WIND FILTER] After filtering: {len(filtered_site_ids)} sites match wind_suitability={wind_suitability} (range: {allowed_suitabilities}), include_unknown={include_unknown_wind} for target_datetime={target_datetime}")
                    if filtered_site_ids:
                        query = query.filter(DiveSite.id.in_(filtered_site_ids))
                    else:
                        # No sites match the suitability filter
                        logger.info(f"[WIND FILTER] No sites match, returning empty result")
                        query = query.filter(False)
                else:
                    # No sites with valid coordinates
                    if include_unknown_wind:
                        # Include sites without coordinates if unknown is allowed
                        sites_without_coords = [s.id for s in all_matching_sites if s.latitude is None or s.longitude is None]
                        if sites_without_coords:
                            query = query.filter(DiveSite.id.in_(sites_without_coords))
                        else:
                            query = query.filter(False)
                    else:
                        query = query.filter(False)
            else:
                # No matching sites, return empty result
                query = query.filter(False)
        except Exception as e:
            logger.error(f"Error in wind suitability filter: {str(e)}")
            # If any error occurs, return empty result when filtering by suitability
            query = query.filter(False)

    # Pagination total: count filtered sites via a distinct-ID subquery only (no metadata JOINs,
    # no ORDER BY). Calling .distinct().count() on the later query that outer-joins rating
    # subqueries and orders by average_rating makes SQLAlchemy emit duplicate JOINs to
    # site_ratings on MySQL (OperationalError 1066).
    _count_q = query._generate()
    count_id_subq = (
        _count_q.enable_eagerloads(False)
        .with_entities(DiveSite.id)
        .distinct()
        .subquery(name="ds_matching_ids")
    )
    total_count = db.execute(select(func.count()).select_from(count_id_subq)).scalar_one()

    # Define subqueries for metadata to avoid N+1 queries.
    # Build ratings aggregate with Core (SiteRating.__table__) so ORDER BY does not unwrap to
    # avg(site_ratings.score) and duplicate JOINs during count().
    from app.models import SiteRating, SiteComment, DiveRoute
    _sr = SiteRating.__table__
    ratings_subquery = (
        select(
            _sr.c.dive_site_id,
            func.avg(_sr.c.score).label("avg_rating"),
            func.count(_sr.c.id).label("total_ratings"),
        )
        .group_by(_sr.c.dive_site_id)
    ).subquery(name="ds_rating_agg")

    comments_subquery = db.query(
        SiteComment.dive_site_id,
        func.count(SiteComment.id).label('comment_count')
    ).group_by(SiteComment.dive_site_id).subquery()

    routes_subquery = db.query(
        DiveRoute.dive_site_id,
        func.count(DiveRoute.id).label('route_count')
    ).filter(DiveRoute.deleted_at.is_(None)).group_by(DiveRoute.dive_site_id).subquery()

    # Join subqueries and eager load relationships
    from app.models import DiveSiteTag
    query = query.outerjoin(ratings_subquery, DiveSite.id == ratings_subquery.c.dive_site_id) \
                 .outerjoin(comments_subquery, DiveSite.id == comments_subquery.c.dive_site_id) \
                 .outerjoin(routes_subquery, DiveSite.id == routes_subquery.c.dive_site_id) \
                 .options(
                     joinedload(DiveSite.difficulty),
                     selectinload(DiveSite.tags).joinedload(DiveSiteTag.tag),
                     selectinload(DiveSite.aliases)
                 )

    # Apply sorting using updated apply_sorting
    if sort_by:
        query = apply_sorting(query, sort_by, sort_order, current_user, ratings_subquery)

    # Add metadata columns to the query results for fetching
    query = query.add_columns(
        ratings_subquery.c.avg_rating,
        ratings_subquery.c.total_ratings,
        comments_subquery.c.comment_count,
        routes_subquery.c.route_count
    )

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size

    # Initialize match_types at function level
    match_types = {}

    # Apply pagination and fetch results
    rows = query.offset(offset).limit(page_size).all()

    # Process results (rows are tuples because of add_columns)
    dive_sites = []
    metadata_map = {}
    for row in rows:
        site = row[0]
        dive_sites.append(site)
        metadata_map[site.id] = {
            "avg_rating": row[1],
            "total_ratings": row[2] or 0,
            "comment_count": row[3] or 0,
            "route_count": row[4] or 0
        }

    # Apply fuzzy search enhancement if needed
    if search:
        search_query_for_fuzzy = search.strip()[:200]
        if get_unified_fuzzy_trigger_conditions(search_query_for_fuzzy, len(dive_sites), max_exact_results=5, max_query_length=10):
            enhanced_results = search_dive_sites_with_fuzzy(
                search_query_for_fuzzy,
                dive_sites,
                db,
                similarity_threshold=UNIFIED_TYPO_TOLERANCE['overall_threshold'],
                max_fuzzy_results=10,
                tag_ids=tag_ids,
                difficulty_code=difficulty_code,
                country=country,
                region=region,
                min_rating=min_rating,
                my_dive_sites=my_dive_sites,
                current_user=current_user,
                show_archived=show_archived,
                status=site_status,
                dive_site_id=dive_site_id
            )

            dive_sites = []
            for result in enhanced_results:
                site = result['site']
                dive_sites.append(site)
                match_types[site.id] = {
                    'type': result['match_type'],
                    'score': result['score'],
                    'name_contains': result['name_contains'],
                    'country_contains': result['country_contains'],
                    'region_contains': result['region_contains'],
                    'description_contains': result['description_contains']
                }

                # If site was not in original results, we might need to fetch its metadata
                if site.id not in metadata_map:
                    # Individual fetch for fuzzy matches (rare and limited to 10)
                    avg_r, total_r = db.query(func.avg(SiteRating.score), func.count(SiteRating.id)).filter(SiteRating.dive_site_id == site.id).first()
                    comm_c = db.query(func.count(SiteComment.id)).filter(SiteComment.dive_site_id == site.id).scalar()
                    rout_c = db.query(func.count(DiveRoute.id)).filter(DiveRoute.dive_site_id == site.id, DiveRoute.deleted_at.is_(None)).scalar()
                    metadata_map[site.id] = {
                        "avg_rating": avg_r,
                        "total_ratings": total_r or 0,
                        "comment_count": comm_c or 0,
                        "route_count": rout_c or 0
                    }


    # Bulk fetch media to avoid N+1 queries
    site_media_map = {}
    dive_media_map = {}
    if detail_level in ['basic', 'full'] and dive_sites:
        site_ids = [s.id for s in dive_sites]

        # Fetch all media from SiteMedia for these sites
        from app.models import SiteMedia, DiveMedia, Dive
        all_site_media = db.query(SiteMedia).filter(SiteMedia.dive_site_id.in_(site_ids)).all()
        for sm in all_site_media:
            if sm.dive_site_id not in site_media_map:
                site_media_map[sm.dive_site_id] = []
            site_media_map[sm.dive_site_id].append(sm)

        # Fetch all media from DiveMedia for these sites
        all_dive_media = db.query(DiveMedia).join(Dive).filter(Dive.dive_site_id.in_(site_ids)).all()
        for dm in all_dive_media:
            # We need to find the dive site id for this dive media
            # Since we joined with Dive, dm.dive.dive_site_id should work
            ds_id = dm.dive.dive_site_id
            if ds_id not in dive_media_map:
                dive_media_map[ds_id] = []
            dive_media_map[ds_id].append(dm)

    # Bulk fetch creator usernames if needed
    creator_map = {}
    if detail_level == 'full' and dive_sites:
        creator_ids = list(set([s.created_by for s in dive_sites if s.created_by]))
        if creator_ids:
            creators = db.query(User.id, User.username).filter(User.id.in_(creator_ids)).all()
            creator_map = {u.id: u.username for u in creators}

    # Build final results using the bulk-fetched data
    result = []
    for site in dive_sites:
        metadata = metadata_map.get(site.id, {})
        avg_rating = metadata.get("avg_rating")
        total_ratings = metadata.get("total_ratings", 0)
        comment_count = metadata.get("comment_count", 0)
        route_count = metadata.get("route_count", 0)

        # Get thumbnail from pre-fetched media
        thumbnail = None
        thumbnail_type = None
        thumbnail_source = None
        thumbnail_id = None

        if detail_level in ['basic', 'full']:
            site_media = site_media_map.get(site.id, [])
            dive_media = dive_media_map.get(site.id, [])

            # Combine all media items with source info
            all_media = [(m, 'site_media') for m in site_media] + [(m, 'dive_media') for m in dive_media]

            if all_media:
                # Use ordering logic if available
                if site.media_order and len(site.media_order) > 0:
                    ordered_media = []
                    media_map = {f"{src}_{m.id}": (m, src) for m, src in all_media}
                    for key in site.media_order:
                        if key in media_map:
                            ordered_media.append(media_map[key])

                    if ordered_media:
                        selected_media, source = ordered_media[0]
                    else:
                        selected_media, source = random.choice(all_media)
                else:
                    selected_media, source = random.choice(all_media)

                thumbnail = selected_media.thumbnail_url or selected_media.url
                thumbnail_id = selected_media.id
                thumbnail_source = source

                media_type_val = selected_media.media_type
                thumbnail_type = media_type_val.value if hasattr(media_type_val, 'value') else str(media_type_val)

            if thumbnail:
                if thumbnail.startswith('user_'):
                     r2_storage = get_r2_storage()
                     thumbnail = r2_storage.get_photo_url(thumbnail)
                elif 'youtube.com' in thumbnail or 'youtu.be' in thumbnail:
                    import re
                    youtube_regex = r'(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&\s]+)'
                    match = re.search(youtube_regex, thumbnail)
                    if match:
                        video_id = match.group(1)
                        thumbnail = f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
                    if thumbnail_type != 'video':
                        thumbnail_type = 'video'

        # Get tags and aliases from eagerly loaded relationships
        tags_dict = []
        aliases_dict = []
        if detail_level == 'full':
            tags_dict = [
                {
                    "id": t.tag.id,
                    "name": t.tag.name,
                    "description": t.tag.description,
                    "created_by": t.tag.created_by,
                    "created_at": t.tag.created_at
                }
                for t in site.tags if t.tag
            ]

            aliases_dict = [
                {
                    "id": alias.id,
                    "dive_site_id": alias.dive_site_id,
                    "alias": alias.alias,
                    "created_at": alias.created_at
                }
                for alias in site.aliases
            ]

        # Build site_dict based on detail_level
        if detail_level == 'minimal':
            site_dict = {
                "id": site.id,
                "latitude": float(site.latitude) if site.latitude else None,
                "longitude": float(site.longitude) if site.longitude else None,
            }
        elif detail_level == 'basic':
            site_dict = {
                "id": site.id,
                "name": site.name,
                "latitude": float(site.latitude) if site.latitude else None,
                "longitude": float(site.longitude) if site.longitude else None,
                "difficulty_code": site.difficulty.code if site.difficulty else None,
                "difficulty_label": site.difficulty.label if site.difficulty else None,
                "average_rating": float(avg_rating) if avg_rating else None,
                "thumbnail": thumbnail,
                "thumbnail_type": thumbnail_type,
                "thumbnail_source": thumbnail_source,
                "thumbnail_id": thumbnail_id,
                "status": site.status,
            }
        else:
            # Full: all fields
            site_dict = {
                "id": site.id,
                "name": site.name,
                "description": site.description,
                "latitude": float(site.latitude) if site.latitude else None,
                "longitude": float(site.longitude) if site.longitude else None,
                "access_instructions": site.access_instructions,
                "difficulty_code": site.difficulty.code if site.difficulty else None,
                "difficulty_label": site.difficulty.label if site.difficulty else None,
                "marine_life": site.marine_life,
                "safety_information": site.safety_information,
                "max_depth": float(site.max_depth) if site.max_depth else None,
                "country": site.country,
                "region": site.region,
                "created_at": site.created_at,
                "updated_at": site.updated_at,
                "deleted_at": site.deleted_at,
                "status": site.status,
                "average_rating": float(avg_rating) if avg_rating else None,
                "total_ratings": total_ratings,
                "comment_count": comment_count,
                "route_count": route_count,
                "created_by": site.created_by,
                "created_by_username": creator_map.get(site.created_by),
                "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                "shore_direction_confidence": site.shore_direction_confidence,
                "shore_direction_method": site.shore_direction_method,
                "shore_direction_distance_m": float(site.shore_direction_distance_m) if site.shore_direction_distance_m else None,
                "thumbnail": thumbnail,
                "thumbnail_type": thumbnail_type,
                "thumbnail_source": thumbnail_source,
                "thumbnail_id": thumbnail_id,
                "tags": tags_dict,
                "aliases": aliases_dict,
                "view_count": site.view_count if current_user and current_user.is_admin else None
            }
        result.append(site_dict)

    # Create and return the response object directly
    # Ensure match_types keys are strings for Pydantic validation
    str_match_types = None
    if match_types:
        str_match_types = {str(k): v for k, v in match_types.items()}

    return DiveSiteListResponse(
        items=result,
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next_page=page < total_pages,
        has_prev_page=page > 1,
        match_types=str_match_types
    )


@router.get("/wind-recommendations")
@skip_rate_limit_for_admin("60/minute")
async def get_wind_recommendations(
    request: Request,
    latitude: Optional[float] = Query(None, ge=-90, le=90, description="Latitude for wind data"),
    longitude: Optional[float] = Query(None, ge=-180, le=180, description="Longitude for wind data"),
    north: Optional[float] = Query(None, ge=-90, le=90, description="North bound for area query"),
    south: Optional[float] = Query(None, ge=-90, le=90, description="South bound for area query"),
    east: Optional[float] = Query(None, ge=-180, le=180, description="East bound for area query"),
    west: Optional[float] = Query(None, ge=-180, le=180, description="West bound for area query"),
    wind_direction: Optional[float] = Query(None, ge=0, le=360, description="Wind direction in degrees (optional, will fetch if not provided)"),
    wind_speed: Optional[float] = Query(None, ge=0, description="Wind speed in m/s (optional, will fetch if not provided)"),
    wind_gusts: Optional[float] = Query(None, ge=0, description="Wind gusts in m/s (optional)"),
    datetime_str: Optional[str] = Query(None, description="Target date/time in ISO format (YYYY-MM-DDTHH:MM:SS). Defaults to current time. Max +2 days ahead."),
    include_unknown: bool = Query(False, description="Include sites without shore_direction"),
    min_suitability: Optional[str] = Query(None, description="Minimum suitability filter: good, caution, difficult, avoid"),
    current_user: Optional = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get wind suitability recommendations for dive sites.

    Fetches wind data if not provided, then calculates suitability for each dive site
    based on wind direction, wind speed, and shore direction.

    Date/time parameter:
    - If not provided, fetches current weather data (NOW)
    - If provided, fetches forecast for that date/time (max +2 days ahead)
    - Format: ISO 8601 (e.g., "2025-12-01T14:00:00")
    """
    try:
        # Parse target datetime if provided
        target_datetime = None
        if datetime_str:
            try:
                target_datetime = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
                # Validate date range: only allow up to +2 days ahead
                # Round max_future to next hour to allow selecting any hour within 2-day window
                now = datetime.now()
                max_future = (now + timedelta(days=2)).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                if target_datetime > max_future:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Date/time cannot be more than 2 days ahead. Maximum allowed: {max_future.isoformat()}"
                    )
                # Don't allow past dates (only current and future up to +2 days)
                if target_datetime < datetime.now() - timedelta(hours=1):
                    raise HTTPException(
                        status_code=400,
                        detail="Date/time cannot be more than 1 hour in the past"
                    )
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid datetime format. Use ISO 8601 format (e.g., '2025-12-01T14:00:00'): {str(e)}"
                )

        # Determine wind data source
        wave_height = None
        wave_period = None
        wave_direction = None
        swell_wave_height = None
        swell_wave_direction = None
        swell_wave_period = None
        sea_surface_temperature = None
        sea_level_height_msl = None

        if wind_direction is None or wind_speed is None:
            # Need to fetch wind data
            if latitude and longitude:
                wind_data = fetch_wind_data_single_point(latitude, longitude, target_datetime)
                if not wind_data:
                    raise HTTPException(
                        status_code=503,
                        detail="Failed to fetch wind data from weather service"
                    )
                wind_direction = wind_direction or wind_data.get("wind_direction_10m")
                wind_speed = wind_speed or wind_data.get("wind_speed_10m")
                wind_gusts = wind_gusts or wind_data.get("wind_gusts_10m")
                wave_height = wind_data.get("wave_height")
                wave_period = wind_data.get("wave_period")
                wave_direction = wind_data.get("wave_direction")
                swell_wave_height = wind_data.get("swell_wave_height")
                swell_wave_direction = wind_data.get("swell_wave_direction")
                swell_wave_period = wind_data.get("swell_wave_period")
                sea_surface_temperature = wind_data.get("sea_surface_temperature")
                sea_level_height_msl = wind_data.get("sea_level_height_msl")
            elif all(x is not None for x in [north, south, east, west]):
                # Use center of bounds for wind data
                center_lat = (north + south) / 2
                center_lon = (east + west) / 2
                wind_data = fetch_wind_data_single_point(center_lat, center_lon, target_datetime)
                if wind_data:
                    wind_direction = wind_direction or wind_data.get("wind_direction_10m")
                    wind_speed = wind_speed or wind_data.get("wind_speed_10m")
                    wind_gusts = wind_gusts or wind_data.get("wind_gusts_10m")
                    wave_height = wind_data.get("wave_height")
                    wave_period = wind_data.get("wave_period")
                    wave_direction = wind_data.get("wave_direction")
                    swell_wave_height = wind_data.get("swell_wave_height")
                    swell_wave_direction = wind_data.get("swell_wave_direction")
                    swell_wave_period = wind_data.get("swell_wave_period")
                    sea_surface_temperature = wind_data.get("sea_surface_temperature")
                    sea_level_height_msl = wind_data.get("sea_level_height_msl")
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Must provide (latitude, longitude) or bounds to fetch wind data"
                )

        if wind_direction is None or wind_speed is None:
            raise HTTPException(
                status_code=400,
                detail="Wind direction and speed are required"
            )

        # Query dive sites
        query = db.query(DiveSite).filter(DiveSite.deleted_at.is_(None))

        # Filter by bounds if provided
        if all(x is not None for x in [north, south, east, west]):
            query = query.filter(
                DiveSite.latitude.between(south, north),
                DiveSite.longitude.between(west, east)
            )

        # Filter out sites without shore_direction if include_unknown is False
        if not include_unknown:
            query = query.filter(DiveSite.shore_direction.isnot(None))

        dive_sites = query.all()

        # Calculate suitability for each dive site
        recommendations = []
        for site in dive_sites:
            suitability_result = calculate_wind_suitability(
                wind_direction=wind_direction,
                wind_speed=wind_speed,
                shore_direction=float(site.shore_direction) if site.shore_direction else None,
                wind_gusts=wind_gusts,
                wave_height=wave_height,
                wave_period=wave_period
            )

            # Apply min_suitability filter if specified
            if min_suitability:
                suitability_order = {"good": 0, "caution": 1, "difficult": 2, "avoid": 3, "unknown": 4}
                min_order = suitability_order.get(min_suitability.lower(), 0)
                site_order = suitability_order.get(suitability_result["suitability"], 4)
                if site_order > min_order:
                    continue

            recommendations.append({
                "dive_site_id": site.id,
                "name": site.name,
                "suitability": suitability_result["suitability"],
                "wind_direction": wind_direction,
                "wind_speed": wind_speed,
                "wind_gusts": wind_gusts,
                "wave_height": wave_height,
                "wave_period": wave_period,
                "wave_direction": wave_direction,
                "swell_wave_height": swell_wave_height,
                "swell_wave_direction": swell_wave_direction,
                "swell_wave_period": swell_wave_period,
                "sea_surface_temperature": sea_surface_temperature,
                "sea_level_height_msl": sea_level_height_msl,
                "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                "reasoning": suitability_result["reasoning"],
                "wind_speed_category": suitability_result["wind_speed_category"]
            })

        # Sort by suitability (good first, then caution, then difficult, then avoid, then unknown)
        suitability_order = {"good": 0, "caution": 1, "difficult": 2, "avoid": 3, "unknown": 4}
        recommendations.sort(key=lambda x: suitability_order.get(x["suitability"], 4))

        return {
            "recommendations": recommendations,
            "wind_data": {
                "wind_direction": wind_direction,
                "wind_speed": wind_speed,
                "wind_gusts": wind_gusts,
                "wave_height": wave_height,
                "wave_period": wave_period,
                "wave_direction": wave_direction,
                "swell_wave_height": swell_wave_height,
                "swell_wave_direction": swell_wave_direction,
                "swell_wave_period": swell_wave_period,
                "sea_surface_temperature": sea_surface_temperature,
                "sea_level_height_msl": sea_level_height_msl
            },
            "total_sites": len(recommendations)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating wind recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error while calculating recommendations"
        )

@router.get("/count")
@skip_rate_limit_for_admin("250/minute")
async def get_dive_sites_count(
    request: Request,
    search: Optional[str] = Query(None, max_length=200, description="Unified search across name, country, region, and description"),
    name: Optional[str] = Query(None, max_length=100),
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    exclude_unspecified_difficulty: bool = Query(False, description="Exclude dive sites with unspecified difficulty"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum average rating (0-10)"),
    tag_ids: Optional[List[int]] = Query(None),
    country: Optional[str] = Query(None, max_length=100),
    region: Optional[str] = Query(None, max_length=100),
    my_dive_sites: Optional[bool] = Query(None, description="Filter to show only dive sites created by the current user"),
    created_by_username: Optional[str] = Query(None, description="Filter by username of the user who created the dive sites"),
    include_archived: bool = Query(False, description="Include soft-deleted (archived) dive sites (Admin only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get total count of dive sites matching the filters"""
    show_archived = include_archived and current_user and current_user.is_admin
    query = db.query(DiveSite)
    if not show_archived:
        query = query.filter(DiveSite.deleted_at.is_(None))

    # Apply all filters using utility functions
    query = apply_search_filters(query, search, name, db)
    query = apply_basic_filters(query, difficulty_code, exclude_unspecified_difficulty, country, region, my_dive_sites, current_user, db, created_by_username)
    query = apply_tag_filtering(query, tag_ids, db)
    query = apply_rating_filtering(query, min_rating, db)

    # Get total count with distinct to avoid inflated counts from joins
    total_count = query.distinct().count()

    return {"total": total_count}

async def _send_pending_moderation_notification(dive_site_id: int):
    """Background task to notify admins of a pending dive site."""
    from app.database import SessionLocal
    from app.services.notification_service import NotificationService
    db = SessionLocal()
    try:
        dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
        if not dive_site:
            return

        # Find all admins
        admins = db.query(User).filter(User.is_admin == True).all()
        notification_service = NotificationService()
        for admin in admins:
            notification_service.create_notification(
                db=db,
                user_id=admin.id,
                category="admin_alerts",
                title="New Dive Site Requires Moderation",
                message=f"A new dive site '{dive_site.name}' has been created near existing sites and requires your approval.",
                link_url=f"/admin/dive-sites?status=pending&dive_site_id={dive_site.id}",
                entity_type="dive_site",
                entity_id=dive_site.id
            )
        db.commit()
    except Exception as e:
        logger.error(f"Error sending pending moderation notifications: {e}")
    finally:
        db.close()

async def _send_dive_site_notifications(dive_site_id: int):
    """Background task to send notifications for a new dive site."""
    try:
        from app.services.notification_service import NotificationService
        from app.database import SessionLocal

        # Create a new database session for the background task
        db = SessionLocal()
        try:
            notification_service = NotificationService()
            await notification_service.notify_users_for_new_dive_site(dive_site_id, db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to send notifications for new dive site {dive_site_id}: {e}")

async def _update_shore_direction_background(dive_site_id: int):
    """Legacy background task wrapper for shore direction detection, now uses unified location update."""
    await _update_location_data_background(dive_site_id)


@router.get("/check-proximity", response_model=List[dict])
@skip_rate_limit_for_admin("300/minute")
async def check_proximity(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(50, ge=10, le=5000),
    db: Session = Depends(get_db)
):
    """
    Check for existing dive sites within a specific radius (in meters) of given coordinates.
    """
    from sqlalchemy import text
    bind = db.get_bind()
    dialect = bind.dialect.name if bind is not None else None

    if dialect == 'mysql':
        nearby_query = text("""
            SELECT
                ds.id, ds.name, ds.description,
                ds.latitude, ds.longitude,
                ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) AS distance_m
            FROM dive_sites ds
            WHERE ds.location IS NOT NULL
            AND ds.deleted_at IS NULL
            AND ds.status = 'approved'
            AND ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) <= :radius_m
            ORDER BY distance_m ASC
            LIMIT 5
        """)
    else:
        nearby_query = text("""
            SELECT
                ds.id, ds.name, ds.description,
                ds.latitude, ds.longitude,
                (6371 * acos(
                    cos(radians(:lat)) * cos(radians(ds.latitude)) *
                    cos(radians(ds.longitude) - radians(:lng)) +
                    sin(radians(:lat)) * sin(radians(ds.latitude))
                )) * 1000 AS distance_m
            FROM dive_sites ds
            WHERE ds.latitude IS NOT NULL
            AND ds.longitude IS NOT NULL
            AND ds.deleted_at IS NULL
            AND ds.status = 'approved'
            HAVING distance_m <= :radius_m
            ORDER BY distance_m ASC
            LIMIT 5
        """)

    result = db.execute(
        nearby_query,
        {
            "lat": lat,
            "lng": lng,
            "radius_m": radius_m
        }
    ).fetchall()

    nearby_sites = []
    for row in result:
        nearby_sites.append({
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "latitude": float(row.latitude) if row.latitude else None,
            "longitude": float(row.longitude) if row.longitude else None,
            "distance_m": round(row.distance_m, 2)
        })

    return nearby_sites

@router.post("/", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("15/minute")
async def create_dive_site(
    request: Request,
    dive_site: DiveSiteCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    dive_site_data = dive_site.model_dump()
    moderation_needed = dive_site_data.pop('moderation_needed', False)
    dive_site_data['created_by'] = current_user.id

    # Check for proximity
    if not moderation_needed and dive_site.latitude and dive_site.longitude:
        # Check proximity internally
        nearby_sites = await check_proximity(request, lat=dive_site.latitude, lng=dive_site.longitude, radius_m=50, db=db)
        if nearby_sites:
            # 409 Conflict with payload
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Dive site is too close to existing ones.",
                    "nearby_sites": nearby_sites
                }
            )

    # Set status
    if moderation_needed:
        dive_site_data['status'] = 'pending'
    else:
        dive_site_data['status'] = 'approved'

    # Convert difficulty_code to difficulty_id
    if 'difficulty_code' in dive_site_data:
        difficulty_code = dive_site_data.pop('difficulty_code')
        dive_site_data['difficulty_id'] = get_difficulty_id_by_code(db, difficulty_code)

    db_dive_site = DiveSite(**dive_site_data)
    db.add(db_dive_site)
    db.commit()
    db.refresh(db_dive_site)

    # Trigger background location and shore detection if coordinates are provided
    if db_dive_site.latitude and db_dive_site.longitude:
        # Check if we need geocoding or shore detection
        needs_geocoding = not db_dive_site.country or not db_dive_site.region
        needs_shore = db_dive_site.shore_direction is None

        if needs_geocoding or needs_shore:
            background_tasks.add_task(_update_location_data_background, db_dive_site.id)

    # Re-query with eager loading for response
    db_dive_site = db.query(DiveSite).options(
        joinedload(DiveSite.difficulty)
    ).filter(DiveSite.id == db_dive_site.id).first()

    # Schedule notification sending as a background task
    if db_dive_site.status == 'approved':
        background_tasks.add_task(_send_dive_site_notifications, db_dive_site.id)
    else:
        background_tasks.add_task(_send_pending_moderation_notification, db_dive_site.id)

    # Serialize response with difficulty_code and difficulty_label
    input_data = dive_site.model_dump()
    input_data.pop('moderation_needed', None)

    response_data = {
        **input_data,
        "id": db_dive_site.id,
        "created_at": db_dive_site.created_at,
        "created_by": db_dive_site.created_by,
        "updated_at": db_dive_site.updated_at,
        "status": db_dive_site.status.value if hasattr(db_dive_site.status, 'value') else str(db_dive_site.status),
        "average_rating": None,
        "total_ratings": 0,
        "tags": []
    }

    # Add difficulty_code and difficulty_label from relationship
    if db_dive_site.difficulty:
        response_data["difficulty_code"] = db_dive_site.difficulty.code
        response_data["difficulty_label"] = db_dive_site.difficulty.label
    else:
        response_data["difficulty_code"] = None
        response_data["difficulty_label"] = None

    return response_data

from fastapi_cache.decorator import cache

@router.get("/countries", response_model=List[str])
@skip_rate_limit_for_admin("100/minute")
@cache(expire=3600)
async def get_unique_countries(request: Request, search: Optional[str] = Query(None, max_length=100), db: Session = Depends(get_db)):
    """Get unique countries from dive sites with optional search"""
    query = db.query(DiveSite.country).filter(DiveSite.country.isnot(None))

    if search:
        query = query.filter(DiveSite.country.ilike(f"%{search}%"))

    countries = query.distinct().order_by(DiveSite.country).all()
    return [c[0] for c in countries]

@router.get("/regions", response_model=List[str])
@skip_rate_limit_for_admin("100/minute")
@cache(expire=3600)
async def get_unique_regions(request: Request, country: Optional[str] = Query(None, max_length=100), search: Optional[str] = Query(None, max_length=100), db: Session = Depends(get_db)):
    """Get unique regions from dive sites with optional country and search filtering"""
    query = db.query(DiveSite.region).filter(DiveSite.region.isnot(None))

    if country:
        query = query.filter(DiveSite.country == country)

    if search:
        query = query.filter(DiveSite.region.ilike(f"%{search}%"))

    regions = query.distinct().order_by(DiveSite.region).all()
    return [r[0] for r in regions]

@router.get("/{dive_site_id}", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("300/minute")
async def get_dive_site(
    request: Request,
    dive_site_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)  # <-- new optional dependency
):

    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if dive_site.deleted_at is not None and not (current_user and current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Increment view count in the background without blocking the response
    from app.utils import increment_view_count
    background_tasks.add_task(increment_view_count, db, DiveSite, dive_site.id)

    # Calculate average rating
    avg_rating = db.query(func.avg(SiteRating.score)).filter(
        SiteRating.dive_site_id == dive_site.id
    ).scalar()

    total_ratings = db.query(func.count(SiteRating.id)).filter(
        SiteRating.dive_site_id == dive_site.id
    ).scalar()

    # Get tags for this dive site
    from app.models import DiveSiteTag, AvailableTag
    tags = db.query(AvailableTag).join(DiveSiteTag).filter(
        DiveSiteTag.dive_site_id == dive_site_id
    ).order_by(AvailableTag.name.asc()).all()

    # Convert tags to dictionaries
    tags_dict = [
        {
            "id": tag.id,
            "name": tag.name,
            "description": tag.description,
            "created_by": tag.created_by,
            "created_at": tag.created_at.isoformat() if tag.created_at else None
        }
        for tag in tags
    ]

    # Get aliases for this dive site
    aliases = db.query(DiveSiteAlias).filter(
        DiveSiteAlias.dive_site_id == dive_site_id
    ).all()

    # Convert aliases to dictionaries
    aliases_dict = [
        {
            "id": alias.id,
            "dive_site_id": alias.dive_site_id,
            "alias": alias.alias,
            "created_at": alias.created_at.isoformat() if alias.created_at else None
        }
        for alias in aliases
    ]

    # Get user's previous rating if authenticated
    user_rating = None
    if current_user:
        user_rating_obj = db.query(SiteRating).filter(
            SiteRating.dive_site_id == dive_site_id,
            SiteRating.user_id == current_user.id
        ).first()
        if user_rating_obj:
            user_rating = user_rating_obj.score

    # Get thumbnail
    thumbnail = None
    thumbnail_type = None
    thumbnail_source = None
    thumbnail_id = None

    # Get all media from SiteMedia (id, media_type, url, thumbnail_url)
    site_media = db.query(SiteMedia.id, SiteMedia.media_type, SiteMedia.url, SiteMedia.thumbnail_url).filter(
        SiteMedia.dive_site_id == dive_site.id
    ).all()

    # Get all media from DiveMedia (id, media_type, url, thumbnail_url)
    dive_media = db.query(DiveMedia.id, DiveMedia.media_type, DiveMedia.url, DiveMedia.thumbnail_url).join(Dive).filter(
        Dive.dive_site_id == dive_site.id
    ).all()

    # Combine all media items with source info
    # Format: (media_object, source_string)
    all_media = [(m, 'site_media') for m in site_media] + [(m, 'dive_media') for m in dive_media]

    if all_media:
        import random
        # If there's a defined media order, try to respect it
        if dive_site.media_order and len(dive_site.media_order) > 0:
            ordered_media = []
            media_map = {f"{src}_{m.id}": (m, src) for m, src in all_media}

            # Add ordered items first
            for key in dive_site.media_order:
                if key in media_map:
                    ordered_media.append(media_map[key])

            # If we found ordered items, pick the first one
            if ordered_media:
                selected_media, source = ordered_media[0]
            else:
                selected_media, source = random.choice(all_media)
        else:
            selected_media, source = random.choice(all_media)

        # Use thumbnail_url if available, otherwise fallback to url (original)
        if selected_media.thumbnail_url:
            thumbnail = selected_media.thumbnail_url
        else:
            thumbnail = selected_media.url

        thumbnail_id = selected_media.id
        thumbnail_source = source

        # Determine media type
        media_type_val = selected_media.media_type
        if hasattr(media_type_val, 'value'):
            thumbnail_type = media_type_val.value
        else:
            thumbnail_type = str(media_type_val)

    if thumbnail:
        if thumbnail.startswith('user_'):
             r2_storage = get_r2_storage()
             thumbnail = r2_storage.get_photo_url(thumbnail)
        elif 'youtube.com' in thumbnail or 'youtu.be' in thumbnail:
            import re
            youtube_regex = r'(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&\s]+)'
            match = re.search(youtube_regex, thumbnail)
            if match:
                video_id = match.group(1)
                thumbnail = f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
            if thumbnail_type != 'video':
                thumbnail_type = 'video'

    # Prepare response data
    # Extract difficulty_code and difficulty_label from relationship
    difficulty_code = dive_site.difficulty.code if dive_site.difficulty else None
    difficulty_label = dive_site.difficulty.label if dive_site.difficulty else None

    response_data = {
        "id": dive_site.id,
        "name": dive_site.name,
        "description": dive_site.description,
        "latitude": float(dive_site.latitude) if dive_site.latitude else None,
        "longitude": float(dive_site.longitude) if dive_site.longitude else None,
        "access_instructions": dive_site.access_instructions,
        "difficulty_code": difficulty_code,
        "difficulty_label": difficulty_label,
        "marine_life": dive_site.marine_life,
        "safety_information": dive_site.safety_information,
        "max_depth": float(dive_site.max_depth) if dive_site.max_depth else None,
        "country": dive_site.country,
        "region": dive_site.region,
        "shore_direction": float(dive_site.shore_direction) if dive_site.shore_direction else None,
        "shore_direction_confidence": dive_site.shore_direction_confidence,
        "shore_direction_method": dive_site.shore_direction_method,
        "shore_direction_distance_m": float(dive_site.shore_direction_distance_m) if dive_site.shore_direction_distance_m else None,
        "created_at": dive_site.created_at.isoformat() if dive_site.created_at else None,
        "updated_at": dive_site.updated_at.isoformat() if dive_site.updated_at else None,
        "deleted_at": dive_site.deleted_at.isoformat() if dive_site.deleted_at else None,
        "created_by": dive_site.created_by,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "tags": tags_dict,
        "aliases": aliases_dict,
        "user_rating": user_rating,
        "thumbnail": thumbnail,
        "thumbnail_type": thumbnail_type,
        "thumbnail_source": thumbnail_source,
        "thumbnail_id": thumbnail_id
    }

    # Only include view_count for admin users
    if not current_user or not current_user.is_admin:
        response_data.pop("view_count", None)

    return response_data

@router.get("/{dive_site_id}/media", response_model=List[SiteMediaResponse])
@skip_rate_limit_for_admin("250/minute")
async def get_dive_site_media(
    request: Request,
    dive_site_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Get admin-uploaded site media
    site_media = db.query(SiteMedia).filter(SiteMedia.dive_site_id == dive_site_id).all()

    # Get public media from dives associated with this dive site
    # Also include private media if current user owns the dive
    # Use joinedload to eagerly load dive and user relationships to avoid N+1 queries
    dive_media_query = db.query(DiveMedia).join(Dive).options(
        joinedload(DiveMedia.dive).joinedload(Dive.user)
    ).filter(
        Dive.dive_site_id == dive_site_id,
    )

    dive_media = dive_media_query.all()

    # Convert to SiteMediaResponse format
    # Note: We're using SiteMediaResponse but it will contain dive media too
    # The frontend will need to handle both types
    result = []
    r2_storage = get_r2_storage()

    # Map for easy access by composite ID (e.g. "site_123", "dive_456")
    media_map = {}

    # Add site media (admin-uploaded)
    for media in site_media:
        # If URL is an R2 path (starts with 'user_'), generate presigned URL
        media_url = media.url
        thumbnail_url = media.thumbnail_url
        medium_url = media.medium_url
        download_url = None

        if media_url and media_url.startswith('user_'):
            # Generate download URL from the original path
            download_url = r2_storage.get_photo_url(media_url, download=True)
            media_url = r2_storage.get_photo_url(media_url)

        if thumbnail_url and thumbnail_url.startswith('user_'):
            thumbnail_url = r2_storage.get_photo_url(thumbnail_url)
        if medium_url and medium_url.startswith('user_'):
            medium_url = r2_storage.get_photo_url(medium_url)

        response_obj = SiteMediaResponse(
            id=media.id,
            dive_site_id=media.dive_site_id,
            media_type=media.media_type.value if hasattr(media.media_type, 'value') else str(media.media_type),
            url=media_url,  # Use media_url (presigned URL)
            description=media.description,
            created_at=media.created_at,
            dive_id=None,
            user_id=None,
            user_username=None,
            thumbnail_url=thumbnail_url,
            medium_url=medium_url,
            download_url=download_url
        )
        media_map[f"site_{media.id}"] = response_obj


    for media in dive_media:
        # Get the dive to access user info (already loaded via joinedload)
        dive = media.dive

        # Get username from dive's user relationship (already loaded)
        user_username = dive.user.username if dive and dive.user else None

        # Format description: if user provided description, append "From dive: XXX", otherwise just "From dive: XXX"
        dive_name = dive.name if dive else 'Unknown'
        default_description = f"By: {user_username}\nDive: {dive_name}"
        if media.description and media.description.strip():
            # User provided description - append default description
            formatted_description = f"{media.description}\n{default_description}"
        else:
            # No user description - just default description
            formatted_description = default_description

        # If URL is an R2 path (starts with 'user_'), generate presigned URL
        media_url = media.url
        thumbnail_url = media.thumbnail_url
        medium_url = media.medium_url
        download_url = None

        if media_url and media_url.startswith('user_'):
            download_url = r2_storage.get_photo_url(media_url, download=True)
            media_url = r2_storage.get_photo_url(media_url)

        if thumbnail_url and thumbnail_url.startswith('user_'):
            thumbnail_url = r2_storage.get_photo_url(thumbnail_url)
        if medium_url and medium_url.startswith('user_'):
            medium_url = r2_storage.get_photo_url(medium_url)

        response_obj = SiteMediaResponse(
            id=media.id,
            dive_site_id=dive_site_id,
            media_type=media.media_type.value if hasattr(media.media_type, 'value') else str(media.media_type),
            url=media_url,
            description=formatted_description,
            created_at=media.created_at,
            dive_id=media.dive_id if media.dive_id else None,
            user_id=dive.user_id if dive else None,
            user_username=user_username,
            thumbnail_url=thumbnail_url,
            medium_url=medium_url,
            download_url=download_url
        )
        media_map[f"dive_{media.id}"] = response_obj

    # Apply ordering if exists
    if dive_site.media_order:
        try:
            # First add items in the specified order
            for media_key in dive_site.media_order:
                if media_key in media_map:
                    result.append(media_map[media_key])
                    # Remove from map so we know it's been handled
                    del media_map[media_key]
        except Exception as e:
            logger.error(f"Error applying media order: {e}")
            # Continue with remaining items if ordering fails

    # Add any remaining items (newly uploaded or not in order list)
    # Sort them by ID/created_at implicitly (or could sort explicitly here)
    remaining_keys = sorted(media_map.keys()) # Sort keys for consistent fallback order
    for key in remaining_keys:
        result.append(media_map[key])

    return result

@router.put("/{dive_site_id}/media/order")
@skip_rate_limit_for_admin("30/minute")
async def update_media_order(
    request: Request,
    dive_site_id: int,
    order_data: DiveSiteMediaOrderRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update the display order of media for a dive site.
    Requester must be admin, moderator, or the creator of the dive site.
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check permissions
    can_edit = (
        current_user.is_admin or
        current_user.is_moderator or
        dive_site.created_by == current_user.id
    )

    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this dive site"
        )

    # Update order
    # Note: We don't validate that every ID exists here, as that would be expensive
    # and "ghost" IDs are handled gracefully by the GET endpoint.
    # However, basic validation of format is handled by Pydantic model.

    dive_site.media_order = order_data.order
    db.commit()

    return {"message": "Media order updated successfully", "order": dive_site.media_order}

@router.post("/{dive_site_id}/media", response_model=SiteMediaResponse)
@skip_rate_limit_for_admin("30/minute")
async def add_dive_site_media(
    request: Request,
    dive_site_id: int,
    media: SiteMediaCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if not is_trusted_contributor(db, current_user, dive_site):
        update_data = media.dict()
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.media_addition,
            proposed_data=update_data
        )
        db.add(edit_request)
        db.commit()
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=202, content={"message": "Media addition submitted for moderation."})

    # Validate media URL
    # Allow HTTP/HTTPS URLs for external media, or R2 paths (starting with 'user_') for uploaded photos
    if not (media.url.startswith(('http://', 'https://')) or media.url.startswith('user_')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media URL"
        )

    db_media = SiteMedia(
        dive_site_id=dive_site_id,
        user_id=current_user.id,
        media_type=media.media_type,
        url=media.url,
        description=media.description,
        thumbnail_url=media.thumbnail_url,
        medium_url=media.medium_url
    )
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media

@router.patch("/{dive_site_id}/media/{media_id}", response_model=SiteMediaResponse)
@skip_rate_limit_for_admin("30/minute")
async def update_dive_site_media(
    request: Request,
    dive_site_id: int,
    media_id: int,
    media_update: SiteMediaUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if not is_trusted_contributor(db, current_user, dive_site):
        update_data = media_update.dict(exclude_unset=True)
        update_data['id'] = media_id
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.media_update,
            proposed_data=update_data
        )
        db.add(edit_request)
        db.commit()
        return JSONResponse(status_code=202, content={"message": "Media update submitted for moderation."})

    # Check if media exists
    media = db.query(SiteMedia).filter(
        and_(SiteMedia.id == media_id, SiteMedia.dive_site_id == dive_site_id)
    ).first()
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )

    # Update fields if provided
    update_data = media_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(media, field, value)

    db.commit()
    db.refresh(media)
    return media

@router.delete("/{dive_site_id}/media/{media_id}")
@skip_rate_limit_for_admin("30/minute")
async def delete_dive_site_media(
    request: Request,
    dive_site_id: int,
    media_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if not is_trusted_contributor(db, current_user, dive_site):
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.media_deletion,
            proposed_data={"id": media_id}
        )
        db.add(edit_request)
        db.commit()
        return JSONResponse(status_code=202, content={"message": "Media deletion submitted for moderation."})

    # Check if media exists
    media = db.query(SiteMedia).filter(
        and_(SiteMedia.id == media_id, SiteMedia.dive_site_id == dive_site_id)
    ).first()
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )

    # Remove from media_order if present
    if dive_site.media_order:
        media_key = f"site_{media_id}"
        if media_key in dive_site.media_order:
            # Create a copy to modify
            new_order = [key for key in dive_site.media_order if key != media_key]
            dive_site.media_order = new_order

    db.delete(media)
    db.commit()
    return {"message": "Media deleted successfully"}

@router.post("/{dive_site_id}/media/upload-photo-r2-only")
@skip_rate_limit_for_admin("30/minute")
async def upload_dive_site_photo_r2_only(
    request: Request,
    dive_site_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload photo to R2 only (no database record created yet).
    Used for photo uploads that will be saved to database on form submission.
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if not is_trusted_contributor(db, current_user, dive_site):
        update_data = media_update.dict(exclude_unset=True)
        update_data['id'] = media_id
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.media_update,
            proposed_data=update_data
        )
        db.add(edit_request)
        db.commit()
        return JSONResponse(status_code=202, content={"message": "Media update submitted for moderation."})

    # Validate file size (max 15MB) - Read in chunks to prevent memory exhaustion
    MAX_FILE_SIZE = 15 * 1024 * 1024
    file_size = 0
    file_content = bytearray()

    # Use 1MB chunks
    CHUNK_SIZE = 1024 * 1024

    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        file_size += len(chunk)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds 15MB limit"
            )
        file_content.extend(chunk)

    # Convert bytearray back to bytes for downstream processing
    file_content = bytes(file_content)

    # Generate unique filename
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    # Default to .jpg if extension is missing or weird, ImageProcessing will sanitize format anyway
    if not file_ext or file_ext.lower() not in ['.jpg', '.jpeg', '.png', '.webp']:
        file_ext = '.jpg'

    unique_filename = f"{uuid.uuid4()}{file_ext}"

    # Process image (Generate variants)
    try:
        image_streams = image_processing.process_image(file_content, file.filename or "unknown")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Upload to R2 or local storage only (no database record)
    r2_storage = get_r2_storage()
    try:
        # Use upload_photo_set for all variants
        uploaded_paths = r2_storage.upload_photo_set(
            user_id=current_user.id,
            original_filename=unique_filename,
            image_streams=image_streams,
            dive_site_id=dive_site_id
        )

        response_data = {}

        # Helper to generate URL
        def get_url(path):
            if not path: return None
            if path.startswith('user_'):
                return r2_storage.get_photo_url(path)
            return path # Local storage path is already a URL suffix usually

        # Populate response with paths and signed URLs
        response_data["r2_path"] = uploaded_paths.get("original")
        response_data["url"] = get_url(uploaded_paths.get("original"))

        if uploaded_paths.get("medium"):
            response_data["medium_path"] = uploaded_paths.get("medium")
            response_data["medium_url"] = get_url(uploaded_paths.get("medium"))

        if uploaded_paths.get("thumbnail"):
            response_data["thumbnail_path"] = uploaded_paths.get("thumbnail")
            response_data["thumbnail_url"] = get_url(uploaded_paths.get("thumbnail"))

        return response_data

    except Exception as e:
        logger.error(f"Failed to upload photo to R2: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload photo to R2"
        )

@router.get("/{dive_site_id}/diving-centers")
@skip_rate_limit_for_admin("250/minute")
async def get_dive_site_diving_centers(
    request: Request,
    dive_site_id: int,
    db: Session = Depends(get_db)
):
    """Get all diving centers associated with a dive site"""

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    centers = db.query(DivingCenter, CenterDiveSite.dive_cost, CenterDiveSite.currency).join(
        CenterDiveSite, DivingCenter.id == CenterDiveSite.diving_center_id
    ).filter(CenterDiveSite.dive_site_id == dive_site_id).all()

    result = []
    for center, dive_cost, currency in centers:
        center_dict = {
            "id": center.id,
            "name": center.name,
            "description": center.description,
            "email": center.email,
            "phone": center.phone,
            "website": center.website,
            "latitude": center.latitude,
            "longitude": center.longitude,
            "dive_cost": dive_cost,
            "currency": currency
        }
        result.append(center_dict)

    return result

@router.post("/{dive_site_id}/diving-centers")
@skip_rate_limit_for_admin("15/minute")
async def add_diving_center_to_dive_site(
    request: Request,
    dive_site_id: int,
    center_assignment: CenterDiveSiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a diving center to a dive site (admin, moderator, diving center owner, or trusted contributor)"""

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == center_assignment.diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Check if user has permission to manage this diving center directly
    can_manage_directly = (
        current_user.is_admin or 
        current_user.is_moderator or
        (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved) or
        is_trusted_contributor(db, current_user, dive_site)
    )

    if not can_manage_directly:
        # Submit for moderation
        update_data = center_assignment.model_dump()
        update_data["diving_center_name"] = diving_center.name
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.center_association,
            proposed_data=update_data
        )
        db.add(edit_request)
        db.commit()
        return JSONResponse(status_code=202, content={"message": "Diving center association submitted for moderation."})

    # Check if association already exists
    existing_association = db.query(CenterDiveSite).filter(
        CenterDiveSite.dive_site_id == dive_site_id,
        CenterDiveSite.diving_center_id == center_assignment.diving_center_id
    ).first()

    if existing_association:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diving center is already associated with this dive site"
        )

    # Create the association
    db_association = CenterDiveSite(
        dive_site_id=dive_site_id,
        diving_center_id=center_assignment.diving_center_id,
        dive_cost=center_assignment.dive_cost,
        currency=center_assignment.currency
    )
    db.add(db_association)
    db.commit()
    db.refresh(db_association)

    return {
        "id": db_association.id,
        "dive_site_id": dive_site_id,
        "diving_center_id": center_assignment.diving_center_id,
        "dive_cost": center_assignment.dive_cost,
        "currency": center_assignment.currency,
        "created_at": db_association.created_at
    }

@router.delete("/{dive_site_id}/diving-centers/{diving_center_id}")
@skip_rate_limit_for_admin("15/minute")
async def remove_diving_center_from_dive_site(
    request: Request,
    dive_site_id: int,
    diving_center_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a diving center from a dive site (admin, moderator, diving center owner, or trusted contributor)"""

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Check if user has permission to manage this diving center directly
    can_manage_directly = (
        current_user.is_admin or 
        current_user.is_moderator or
        (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved) or
        is_trusted_contributor(db, current_user, dive_site)
    )

    if not can_manage_directly:
        # Submit for moderation
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.center_removal,
            proposed_data={
                "diving_center_id": diving_center_id,
                "diving_center_name": diving_center.name
            }
        )
        db.add(edit_request)
        db.commit()
        return JSONResponse(status_code=202, content={"message": "Diving center removal submitted for moderation."})

    # Find and delete the association
    association = db.query(CenterDiveSite).filter(
        CenterDiveSite.dive_site_id == dive_site_id,
        CenterDiveSite.diving_center_id == diving_center_id
    ).first()

    if not association:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center is not associated with this dive site"
        )

    db.delete(association)
    db.commit()

    return {"message": "Diving center removed from dive site successfully"}

@router.post("/{dive_site_id}/approve", response_model=DiveSiteResponse)
async def approve_dive_site(
    request: Request,
    dive_site_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to approve a pending dive site."""
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    dive_site = db.query(DiveSite).options(joinedload(DiveSite.difficulty)).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(status_code=404, detail="Dive site not found")

    if dive_site.status != 'pending':
        raise HTTPException(status_code=400, detail="Dive site is not in pending status")

    dive_site.status = 'approved'
    db.commit()
    db.refresh(dive_site)

    # Trigger notifications as if it was just created
    background_tasks.add_task(_send_dive_site_notifications, dive_site.id)

    response_data = {
        **dive_site.__dict__,
        "difficulty_code": dive_site.difficulty.code if dive_site.difficulty else None,
        "difficulty_label": dive_site.difficulty.label if dive_site.difficulty else None,
        "tags": []
    }
    return response_data

@router.post("/{dive_site_id}/reject", response_model=dict)
async def reject_dive_site(
    request: Request,
    dive_site_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to reject a pending dive site."""
    if not current_user.is_admin and not current_user.is_moderator:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(status_code=404, detail="Dive site not found")

    if dive_site.status != 'pending':
        raise HTTPException(status_code=400, detail="Dive site is not in pending status")

    dive_site.status = 'rejected'
    db.commit()

    return {"status": "success", "message": "Dive site rejected"}

@router.put("/{dive_site_id}", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("30/minute")
async def update_dive_site(
    request: Request,
    dive_site_id: int,
    dive_site_update: DiveSiteUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):

    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if not is_trusted_contributor(db, current_user, dive_site):
        update_data = dive_site_update.dict(exclude_unset=True)
        # Compute a strict diff against the current dive site
        diff_data = {}

        # In the frontend payload, the difficulty is called `difficulty_code`, but the ORM
        # stores it as `difficulty_id`. We need to handle this explicitly so it doesn't
        # erroneously trigger a "modified" diff simply because `dive_site.difficulty_code` is missing.
        if 'difficulty_code' in update_data:
            difficulty_code = update_data.pop('difficulty_code')
            new_difficulty_id = get_difficulty_id_by_code(db, difficulty_code) if difficulty_code else None

            if dive_site.difficulty_id != new_difficulty_id:
                diff_data['difficulty_code'] = difficulty_code

        for key, value in update_data.items():
            current_val = getattr(dive_site, key, None)

            # Simple conversion to prevent strict string/float mismatches
            # e.g., '10.0' vs 10.0
            if current_val is not None and value is not None:
                if str(current_val) != str(value):
                    try:
                        if float(current_val) != float(value):
                            diff_data[key] = value
                    except ValueError:
                        diff_data[key] = value
            elif current_val != value:
                diff_data[key] = value

        if not diff_data:
             return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "No changes detected."})

        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.site_data,
            proposed_data=diff_data
        )
        db.add(edit_request)
        db.commit()
        from app.services.notification_service import NotificationService
        ns = NotificationService()
        background_tasks.add_task(ns.notify_admins_pending_edit, edit_request.id, db)
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"message": "Your changes have been submitted for moderation."})

    # Check if user has permission to edit (admin, moderator, or owner)
    can_edit = True

    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this dive site"
        )

    # Update only provided fields
    update_data = dive_site_update.model_dump(exclude_unset=True)

    # Convert difficulty_code to difficulty_id if provided
    if 'difficulty_code' in update_data:
        difficulty_code = update_data.pop('difficulty_code')
        update_data['difficulty_id'] = get_difficulty_id_by_code(db, difficulty_code)

    # Ensure latitude and longitude are never set to null
    if 'latitude' in update_data and update_data['latitude'] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Latitude cannot be empty"
        )
    if 'longitude' in update_data and update_data['longitude'] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Longitude cannot be empty"
        )

    # Validate shore_direction if provided - must be a valid value (0-360), cannot be None
    if 'shore_direction' in update_data:
        if update_data['shore_direction'] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Shore direction cannot be set to None. Use a valid compass bearing (0-360 degrees) or omit the field."
            )
        if not (0 <= update_data['shore_direction'] <= 360):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Shore direction must be between 0 and 360 degrees"
            )

    # Auto-detect shore direction if:
    # 1. Coordinates actually changed and shore_direction not provided, OR
    # 2. Shore direction is currently NULL in database and not being explicitly set

    actual_coords_changed = False
    if 'latitude' in update_data and dive_site.latitude is not None:
        if abs(float(update_data['latitude']) - float(dive_site.latitude)) > 1e-7:
            actual_coords_changed = True
    elif 'latitude' in update_data:
        actual_coords_changed = True

    if 'longitude' in update_data and dive_site.longitude is not None:
        if abs(float(update_data['longitude']) - float(dive_site.longitude)) > 1e-7:
            actual_coords_changed = True
    elif 'longitude' in update_data:
        actual_coords_changed = True

    shore_direction_not_provided = 'shore_direction' not in update_data or update_data.get('shore_direction') is None

    # Check if we should trigger detection
    # Only if coordinates changed OR (missing AND hasn't failed before)
    shore_direction_is_missing = dive_site.shore_direction is None and dive_site.shore_direction_method != 'osm_failed'

    # Auto-detect location data if coordinates changed or data is missing
    country_region_missing = not dive_site.country or not dive_site.region

    if (actual_coords_changed or shore_direction_is_missing or country_region_missing) and (shore_direction_not_provided or country_region_missing):
        # Schedule background detection (includes geocoding and shore direction)
        background_tasks.add_task(_update_location_data_background, dive_site_id)
        logger.info(f"Scheduled background location and shore direction detection for dive site {dive_site_id}")

    for field, value in update_data.items():
        setattr(dive_site, field, value)

    db.commit()
    db.refresh(dive_site)

    # Re-query with eager loading of difficulty relationship for response
    dive_site = db.query(DiveSite).options(joinedload(DiveSite.difficulty)).filter(DiveSite.id == dive_site_id).first()

    # Calculate average rating
    avg_rating = db.query(func.avg(SiteRating.score)).filter(
        SiteRating.dive_site_id == dive_site.id
    ).scalar()

    total_ratings = db.query(func.count(SiteRating.id)).filter(
        SiteRating.dive_site_id == dive_site.id
    ).scalar()

    # Get tags for this dive site
    from app.models import DiveSiteTag, AvailableTag
    tags = db.query(AvailableTag).join(DiveSiteTag).filter(
        DiveSiteTag.dive_site_id == dive_site_id
    ).all()

    # Convert tags to dictionaries
    tags_dict = [
        {
            "id": tag.id,
            "name": tag.name,
            "description": tag.description,
            "created_by": tag.created_by,
            "created_at": tag.created_at.isoformat() if tag.created_at else None
        }
        for tag in tags
    ]

    # Difficulty information is already eager-loaded above
    difficulty_code = dive_site.difficulty.code if dive_site.difficulty else None
    difficulty_label = dive_site.difficulty.label if dive_site.difficulty else None

    return {
        "id": dive_site.id,
        "name": dive_site.name,
        "description": dive_site.description,
        "latitude": float(dive_site.latitude) if dive_site.latitude else None,
        "longitude": float(dive_site.longitude) if dive_site.longitude else None,
        "access_instructions": dive_site.access_instructions,
        "difficulty_code": difficulty_code,
        "difficulty_label": difficulty_label,
        "marine_life": dive_site.marine_life,
        "safety_information": dive_site.safety_information,
        "max_depth": float(dive_site.max_depth) if dive_site.max_depth else None,
        "country": dive_site.country,
        "region": dive_site.region,
        "shore_direction": float(dive_site.shore_direction) if dive_site.shore_direction else None,
        "shore_direction_confidence": dive_site.shore_direction_confidence,
        "shore_direction_method": dive_site.shore_direction_method,
        "shore_direction_distance_m": float(dive_site.shore_direction_distance_m) if dive_site.shore_direction_distance_m else None,
        "created_at": dive_site.created_at.isoformat() if dive_site.created_at else None,
        "updated_at": dive_site.updated_at.isoformat() if dive_site.updated_at else None,
        "deleted_at": dive_site.deleted_at.isoformat() if dive_site.deleted_at else None,
        "created_by": dive_site.created_by,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "tags": tags_dict
    }

@router.post("/{dive_site_id}/restore")
@skip_rate_limit_for_admin("15/minute")
async def restore_dive_site(
    request: Request,
    dive_site_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Restore a soft-deleted dive site (Admin only)"""
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if dive_site.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dive site is not archived"
        )

    try:
        dive_site.deleted_at = None
        db.commit()
        return {"message": "Dive site restored successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error restoring dive site: {str(e)}"
        )

@router.delete("/{dive_site_id}")
@skip_rate_limit_for_admin("15/minute")
async def delete_dive_site(
    request: Request,
    dive_site_id: int,
    force: bool = Query(False, description="Hard delete (admin only)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Permission check: must be admin or the creator
    if not current_user.is_admin and dive_site.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this dive site"
        )

    try:
        if current_user.is_admin and force:
            # Hard delete
            db.delete(dive_site)
            message = "Dive site permanently deleted"
        else:
            # Soft delete
            from datetime import datetime, timezone
            dive_site.deleted_at = datetime.now(timezone.utc)
            message = "Dive site archived successfully"

        db.commit()
        return {"message": message}
    except HTTPException as e:
        # Re-raise HTTP exceptions (like 404 Not Found) as-is
        db.rollback()
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting dive site: {str(e)}"
        )

@router.post("/{dive_site_id}/rate", response_model=SiteRatingResponse)
@skip_rate_limit_for_admin("15/minute")
async def rate_dive_site(
    request: Request,
    dive_site_id: int,
    rating: SiteRatingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if user already rated this site
    existing_rating = db.query(SiteRating).filter(
        and_(SiteRating.dive_site_id == dive_site_id, SiteRating.user_id == current_user.id)
    ).first()

    if existing_rating:
        # Update existing rating
        existing_rating.score = rating.score
        db.commit()
        db.refresh(existing_rating)
        return existing_rating
    else:
        # Create new rating
        db_rating = SiteRating(
            dive_site_id=dive_site_id,
            user_id=current_user.id,
            score=rating.score
        )
        db.add(db_rating)
        db.commit()
        db.refresh(db_rating)
        return db_rating

@router.get("/{dive_site_id}/comments", response_model=List[SiteCommentResponse])
@skip_rate_limit_for_admin("250/minute")
async def get_dive_site_comments(
    request: Request,
    dive_site_id: int,
    db: Session = Depends(get_db)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Get comments with user information and their primary certification
    comments = db.query(
        SiteComment,
        User.username,
        User.number_of_dives,
        UserCertification.certification_level,
        DivingOrganization.acronym
    ).join(
        User, SiteComment.user_id == User.id
    ).outerjoin(
        UserCertification, User.id == UserCertification.user_id
    ).outerjoin(
        DivingOrganization, UserCertification.diving_organization_id == DivingOrganization.id
    ).filter(
        SiteComment.dive_site_id == dive_site_id
    ).all()

    # Group comments by comment ID to handle multiple certifications per user
    comment_dict = {}
    for comment, username, number_of_dives, certification_level, org_acronym in comments:
        if comment.id not in comment_dict:
            # Format certification string
            certification_str = None
            if certification_level and org_acronym:
                certification_str = f"{org_acronym} {certification_level}"

            comment_dict[comment.id] = {
                "id": comment.id,
                "dive_site_id": comment.dive_site_id,
                "user_id": comment.user_id,
                "username": username,
                "comment_text": comment.comment_text,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at,
                "user_diving_certification": certification_str,
                "user_number_of_dives": number_of_dives
            }

    return list(comment_dict.values())

@router.post("/{dive_site_id}/comments", response_model=SiteCommentResponse)
@skip_rate_limit_for_admin("8/minute")
async def create_dive_site_comment(
    request: Request,
    dive_site_id: int,
    comment: SiteCommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    db_comment = SiteComment(
        dive_site_id=dive_site_id,
        user_id=current_user.id,
        comment_text=comment.comment_text
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)

    # Get user's primary certification
    primary_certification = db.query(
        UserCertification.certification_level,
        DivingOrganization.acronym
    ).join(
        DivingOrganization, UserCertification.diving_organization_id == DivingOrganization.id
    ).filter(
        UserCertification.user_id == current_user.id,
        UserCertification.is_active == True
    ).first()

    certification_str = None
    if primary_certification and primary_certification[0] and primary_certification[1]:
        certification_str = f"{primary_certification[1]} {primary_certification[0]}"

    return {
        **db_comment.__dict__,
        "username": current_user.username,
        "user_diving_certification": certification_str,
        "user_number_of_dives": current_user.number_of_dives
    }

@router.get("/{dive_site_id}/nearby", response_model=List[DiveSiteResponse])
@skip_rate_limit_for_admin("250/minute")
async def get_nearby_dive_sites(
    request: Request,
    dive_site_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Get nearby dive sites based on geographic proximity.
    Uses MySQL native spatial functions (ST_Distance_Sphere) with Spatial Index for performance.
    Falls back to Haversine formula for non-MySQL dialects.
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if dive site has coordinates
    if not dive_site.latitude or not dive_site.longitude:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dive site does not have location coordinates"
        )

    from sqlalchemy import text
    bind = db.get_bind()
    dialect = bind.dialect.name if bind is not None else None

    if dialect == 'mysql':
        # Optimized Spatial Query using MySQL 8.0 native functions and Spatial Index
        # ST_Distance_Sphere returns distance in meters, we divide by 1000 for km
        nearby_query = text("""
            SELECT
                ds.id, ds.name, ds.description,
                dl.code AS difficulty_code, dl.label AS difficulty_label,
                ds.latitude, ds.longitude,
                ds.access_instructions, ds.safety_information, ds.marine_life,
                ds.created_at, ds.updated_at,
                ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) / 1000.0 AS distance_km
            FROM dive_sites ds
            LEFT JOIN difficulty_levels dl ON ds.difficulty_id = dl.id
            WHERE ds.id != :site_id
            AND ds.location IS NOT NULL
            AND ds.deleted_at IS NULL
            AND ds.status = 'approved'
            AND ST_Distance_Sphere(ds.location, ST_SRID(POINT(:lng, :lat), 4326)) <= 100000
            ORDER BY distance_km ASC
            LIMIT :limit
        """)
    else:
        # Fallback to Haversine formula for non-MySQL dialects (e.g., SQLite in tests)
        nearby_query = text("""
            SELECT
                ds.id, ds.name, ds.description,
                dl.code AS difficulty_code, dl.label AS difficulty_label,
                ds.latitude, ds.longitude,
                ds.access_instructions, ds.safety_information, ds.marine_life,
                ds.created_at, ds.updated_at,
                (6371 * acos(
                    cos(radians(:lat)) * cos(radians(ds.latitude)) *
                    cos(radians(ds.longitude) - radians(:lng)) +
                    sin(radians(:lat)) * sin(radians(ds.latitude))
                )) AS distance_km
            FROM dive_sites ds
            LEFT JOIN difficulty_levels dl ON ds.difficulty_id = dl.id
            WHERE ds.id != :site_id
            AND ds.latitude IS NOT NULL
            AND ds.longitude IS NOT NULL
            AND ds.deleted_at IS NULL
            AND ds.status = 'approved'
            HAVING distance_km <= 100
            ORDER BY distance_km ASC
            LIMIT :limit
        """)

    result = db.execute(
        nearby_query,
        {
            "lat": float(dive_site.latitude),
            "lng": float(dive_site.longitude),
            "site_id": dive_site_id,
            "limit": limit
        }
    ).fetchall()

    # Convert to response format
    nearby_sites = []
    for row in result:
        # Get average rating and total ratings
        avg_rating = db.query(func.avg(SiteRating.score)).filter(
            SiteRating.dive_site_id == row.id
        ).scalar()

        total_ratings = db.query(func.count(SiteRating.id)).filter(
            SiteRating.dive_site_id == row.id
        ).scalar()

        # Get tags for this dive site
        from app.models import DiveSiteTag, AvailableTag
        tags = db.query(AvailableTag).join(DiveSiteTag).filter(
            DiveSiteTag.dive_site_id == row.id
        ).all()

        # Convert tags to dictionaries
        tags_dict = [
            {
                "id": tag.id,
                "name": tag.name,
                "description": tag.description,
                "created_by": tag.created_by,
                "created_at": tag.created_at.isoformat() if tag.created_at else None
            }
            for tag in tags
        ]

        site_dict = {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "difficulty_code": row.difficulty_code if hasattr(row, 'difficulty_code') else None,
            "difficulty_label": row.difficulty_label if hasattr(row, 'difficulty_label') else None,
            "latitude": float(row.latitude) if row.latitude else None,
            "longitude": float(row.longitude) if row.longitude else None,
            "access_instructions": row.access_instructions,
            "safety_information": row.safety_information,
            "marine_life": row.marine_life,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "average_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings,
            "tags": tags_dict,
            "distance_km": round(row.distance_km, 2)
        }
        nearby_sites.append(site_dict)

    return nearby_sites

@router.get("/{dive_site_id}/dives", response_model=List[DiveResponse])
@skip_rate_limit_for_admin("250/minute")
async def get_dive_site_dives(
    request: Request,
    dive_site_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """
    Get top dives for a specific dive site, ordered by rating (descending).
    If no rating is available, returns the first 10 dives.
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Build query for dives at this dive site
    query = db.query(Dive).filter(Dive.dive_site_id == dive_site_id)

    # If user is not authenticated, only show public dives
    if not current_user:
        query = query.filter(Dive.is_private == False)
    else:
        # Show own dives and public dives from others
        query = query.filter(
            or_(
                Dive.user_id == current_user.id,
                and_(Dive.user_id != current_user.id, Dive.is_private == False)
            )
        )

    # Order by rating (descending) first, then by dive date (descending)
    # Dives with no rating will be ordered by dive date
    query = query.order_by(
        desc(Dive.user_rating),  # Highest rating first
        desc(Dive.dive_date),    # Most recent first
        desc(Dive.dive_time)     # Most recent time first
    )

    # Limit results
    dives = query.limit(limit).all()

    # Convert to response format
    dive_list = []
    for dive in dives:
        # Get dive site information
        dive_site_info = None
        if dive.dive_site_id:
            dive_site = db.query(DiveSite).filter(DiveSite.id == dive.dive_site_id).first()
            if dive_site:
                dive_site_info = {
                    "id": dive_site.id,
                    "name": dive_site.name,
                    "description": dive_site.description,
                    "latitude": float(dive_site.latitude) if dive_site.latitude else None,
                    "longitude": float(dive_site.longitude) if dive_site.longitude else None,
                    "country": dive_site.country,
                    "region": dive_site.region,
                    "deleted_at": dive_site.deleted_at.isoformat() if dive_site.deleted_at else None
                }

        # Get tags for this dive
        dive_tags = db.query(AvailableTag).join(DiveTag).filter(DiveTag.dive_id == dive.id).order_by(AvailableTag.name.asc()).all()
        tags_list = [{"id": tag.id, "name": tag.name} for tag in dive_tags]

        # Get user information
        user = db.query(User).filter(User.id == dive.user_id).first()
        user_username = user.username if user else None

        dive_dict = {
            "id": dive.id,
            "user_id": dive.user_id,
            "dive_site_id": dive.dive_site_id,
            "name": dive.name,
            "is_private": dive.is_private,
            "dive_information": dive.dive_information,
            "max_depth": dive.max_depth,
            "average_depth": dive.average_depth,
            "gas_bottles_used": dive.gas_bottles_used,
            "suit_type": dive.suit_type,
            "difficulty_code": dive.difficulty.code if dive.difficulty else None,
            "difficulty_label": dive.difficulty.label if dive.difficulty else None,
            "visibility_rating": dive.visibility_rating,
            "user_rating": dive.user_rating,
            "dive_date": dive.dive_date.strftime("%Y-%m-%d"),
            "dive_time": dive.dive_time.strftime("%H:%M:%S") if dive.dive_time else None,
            "duration": dive.duration,
            "created_at": dive.created_at,
            "updated_at": dive.updated_at,
            "dive_site": dive_site_info,
            "media": [],  # Could be expanded to include media if needed
            "tags": tags_list,
            "user_username": user_username
        }
        dive_list.append(dive_dict)

    return dive_list

# Dive Site Alias Endpoints
@router.get("/{dive_site_id}/aliases", response_model=List[DiveSiteAliasResponse])
async def get_dive_site_aliases(
    request: Request,
    dive_site_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all aliases for a specific dive site
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Get aliases for this dive site
    aliases = db.query(DiveSiteAlias).filter(DiveSiteAlias.dive_site_id == dive_site_id).all()
    return aliases

@router.post("/{dive_site_id}/aliases", response_model=DiveSiteAliasResponse)
async def create_dive_site_alias(
    request: Request,
    dive_site_id: int,
    alias: DiveSiteAliasCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create a new alias for a dive site
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if alias already exists for this dive site
    existing_alias = db.query(DiveSiteAlias).filter(
        DiveSiteAlias.dive_site_id == dive_site_id,
        DiveSiteAlias.alias == alias.alias
    ).first()

    if existing_alias:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alias already exists for this dive site"
        )

    # Create new alias
    new_alias = DiveSiteAlias(
        dive_site_id=dive_site_id,
        alias=alias.alias
    )

    db.add(new_alias)
    db.commit()
    db.refresh(new_alias)

    return new_alias

@router.put("/{dive_site_id}/aliases/{alias_id}", response_model=DiveSiteAliasResponse)
async def update_dive_site_alias(
    request: Request,
    dive_site_id: int,
    alias_id: int,
    alias_update: DiveSiteAliasUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing alias for a dive site
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if alias exists
    alias = db.query(DiveSiteAlias).filter(
        DiveSiteAlias.id == alias_id,
        DiveSiteAlias.dive_site_id == dive_site_id
    ).first()

    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alias not found"
        )

    # Update alias fields
    if alias_update.alias is not None:
        # Check if new alias name already exists for this dive site
        existing_alias = db.query(DiveSiteAlias).filter(
            DiveSiteAlias.dive_site_id == dive_site_id,
            DiveSiteAlias.alias == alias_update.alias,
            DiveSiteAlias.id != alias_id
        ).first()

        if existing_alias:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Alias already exists for this dive site"
            )

        alias.alias = alias_update.alias

    db.commit()
    db.refresh(alias)

    return alias

@router.delete("/{dive_site_id}/aliases/{alias_id}")
async def delete_dive_site_alias(
    request: Request,
    dive_site_id: int,
    alias_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Delete an alias for a dive site
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if alias exists
    alias = db.query(DiveSiteAlias).filter(
        DiveSiteAlias.id == alias_id,
        DiveSiteAlias.dive_site_id == dive_site_id
    ).first()

    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alias not found"
        )

    db.delete(alias)
    db.commit()

    return {"message": "Alias deleted successfully"}


# Dive Routes endpoints for dive sites
@router.get("/{dive_site_id}/routes", response_model=List[DiveRouteWithCreator])
async def get_dive_site_routes(
    dive_site_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get all routes for a specific dive site"""
    # Verify dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    if dive_site.deleted_at is not None and not (current_user and current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    routes = db.query(DiveRoute).filter(
        and_(
            DiveRoute.dive_site_id == dive_site_id,
            DiveRoute.deleted_at.is_(None)
        )
    ).order_by(desc(DiveRoute.created_at)).all()

    # Convert routes to dictionaries and add creator information
    routes_with_creator = []
    for route in routes:
        route_dict = route.__dict__.copy()

        # Manually fetch creator information
        creator = db.query(User).filter(User.id == route.created_by).first()
        route_dict['creator'] = {
            'id': creator.id,
            'username': creator.username,
            'name': creator.name
        } if creator else None

        routes_with_creator.append(route_dict)

    return routes_with_creator


@router.post("/{dive_site_id}/routes", response_model=DiveRouteResponse)
@limiter.limit("10/minute")
async def create_dive_site_route(
    request: Request,
    dive_site_id: int,
    route_data: DiveRouteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new route for a specific dive site"""
    # Verify dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Ensure route_data.dive_site_id matches the URL parameter
    if route_data.dive_site_id != dive_site_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route dive_site_id must match URL parameter"
        )

    # Create route
    db_route = DiveRoute(
        dive_site_id=dive_site_id,
        created_by=current_user.id,
        name=route_data.name,
        description=route_data.description,
        route_data=route_data.route_data,
        route_type=route_data.route_type
    )

    db.add(db_route)
    db.commit()
    db.refresh(db_route)

    return db_route

@router.post("/{dive_site_id}/detect-shore-direction")
@skip_rate_limit_for_admin("10/minute")
async def detect_shore_direction_for_dive_site(
    request: Request,
    dive_site_id: int,
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Detect shore direction for an existing dive site using OpenStreetMap coastline data.

    This endpoint triggers automatic detection of shore direction based on the dive site's
    coordinates. The detected value can be used to update the dive site or returned for
    user confirmation.

    If latitude and longitude are provided as query parameters, they are used instead
    of the site's current coordinates. This is useful for unsaved changes during editing.

    Rate limited to prevent API abuse.
    """
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check permissions (allow any authenticated user to use the detection tool)
    # This helps contributors (including those whose edits require moderation) 
    # to provide accurate data.
    # Note: current_user is already verified by Dependency get_current_active_user
    
    # Use provided coordinates or fall back to site's coordinates
    lat = latitude if latitude is not None else (float(dive_site.latitude) if dive_site.latitude is not None else None)
    lng = longitude if longitude is not None else (float(dive_site.longitude) if dive_site.longitude is not None else None)

    # Check if coordinates are available
    if lat is None or lng is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dive site must have latitude and longitude to detect shore direction"
        )

    # Detect shore direction
    result = detect_shore_direction(lat, lng)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not detect shore direction. No coastline found nearby or API error occurred."
        )

    return {
        "shore_direction": result.get("shore_direction"),
        "confidence": result.get("confidence"),
        "method": result.get("method"),
        "distance_to_coastline_m": result.get("distance_to_coastline_m"),
        "message": "Shore direction detected successfully. Update the dive site to save this value."
    }
