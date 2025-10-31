from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc, asc
from slowapi.util import get_remote_address
import difflib
import json

from app.database import get_db
from app.models import DiveSite, SiteRating, SiteComment, SiteMedia, User, DivingCenter, CenterDiveSite, UserCertification, DivingOrganization, Dive, DiveTag, AvailableTag, DiveSiteAlias, DiveSiteTag, ParsedDive, DiveRoute, DifficultyLevel, get_difficulty_id_by_code, OwnershipStatus
from app.schemas import (
    DiveSiteCreate, DiveSiteUpdate, DiveSiteResponse,
    SiteRatingCreate, SiteRatingResponse,
    SiteCommentCreate, SiteCommentUpdate, SiteCommentResponse,
    SiteMediaCreate, SiteMediaResponse,
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
    
    # Use consistent subquery approach - dive site must have ALL selected tags
    tag_count = len(tag_ids)
    tag_subquery = db.query(DiveSiteTag.dive_site_id).filter(
        DiveSiteTag.tag_id.in_(tag_ids)
    ).group_by(DiveSiteTag.dive_site_id).having(
        func.count(DiveSiteTag.tag_id) == tag_count
    ).subquery()
    
    return query.filter(DiveSite.id.in_(tag_subquery))


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


def apply_basic_filters(query, difficulty_code, include_undefined, country, region, my_dive_sites, current_user, db):
    """
    Apply basic filtering criteria to a query.
    
    Args:
        query: SQLAlchemy query object to filter
        difficulty_code: Difficulty code filter (e.g., 'OPEN_WATER')
        include_undefined: Whether to include sites with NULL difficulty
        country: Country filter
        region: Region filter
        my_dive_sites: Whether to filter by user's dive sites
        current_user: Current authenticated user
        db: Database session for lookups
        
    Returns:
        Filtered query object
    """
    if difficulty_code:
        difficulty_id = get_difficulty_id_by_code(db, difficulty_code)
        if difficulty_id:
            query = query.filter(DiveSite.difficulty_id == difficulty_id)
        elif not include_undefined:
            # If code doesn't exist and we don't want undefined, return empty set
            query = query.filter(False)
    elif not include_undefined:
        # If no difficulty_code filter but we don't want undefined, exclude NULL
        query = query.filter(DiveSite.difficulty_id.isnot(None))
    
    if country:
        sanitized_country = country.strip()[:100]
        query = query.filter(DiveSite.country.ilike(f"%{sanitized_country}%"))
    
    if region:
        sanitized_region = region.strip()[:100]
        query = query.filter(DiveSite.region.ilike(f"%{sanitized_region}%"))
    
    if my_dive_sites and current_user:
        query = query.filter(DiveSite.created_by == current_user.id)
    
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


def apply_sorting(query, sort_by, sort_order, current_user):
    """
    Apply sorting logic to a query.
    
    Args:
        query: SQLAlchemy query object to sort
        sort_by: Field to sort by
        sort_order: Sort order ('asc' or 'desc')
        current_user: Current authenticated user
        
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
            # For comment count, we need to join with comments and group
            query = query.outerjoin(SiteComment).group_by(DiveSite.id)
            sort_field = func.count(SiteComment.id)
        elif sort_by == 'created_at':
            sort_field = DiveSite.created_at
        elif sort_by == 'updated_at':
            sort_field = DiveSite.updated_at
        elif sort_by == 'average_rating':
            # For average_rating, we'll handle this separately in the main function
            # as it requires special processing
            return query
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
    
    # Apply the same filters that were used in the main query
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
            print(f"   {json.dumps(data, indent=2)}")
        
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
            print(f"   Raw Address Object: {json.dumps(address, indent=2)}")
            
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

@router.get("/", response_model=List[DiveSiteResponse])
@skip_rate_limit_for_admin("250/minute")
async def get_dive_sites(
    request: Request,
    search: Optional[str] = Query(None, max_length=200, description="Unified search across name, country, region, and description"),
    name: Optional[str] = Query(None, max_length=100),
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    include_undefined: bool = Query(False, description="Include dive sites with unspecified difficulty"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum average rating (0-10)"),
    tag_ids: Optional[List[int]] = Query(None),
    country: Optional[str] = Query(None, max_length=100),
    region: Optional[str] = Query(None, max_length=100),
    my_dive_sites: Optional[bool] = Query(None, description="Filter to show only dive sites created by the current user"),
    sort_by: Optional[str] = Query(None, description="Sort field (name, country, region, difficulty_level, created_at, updated_at). Admin users can also sort by view_count and comment_count."),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, 100, or 1000)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):

    # Validate page_size to only allow 25, 50, 100, or 1000
    if page_size not in [1, 5, 25, 50, 100, 1000]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be one of: 25, 50, 100, 1000"
        )

    # Eager load difficulty relationship for efficient access
    query = db.query(DiveSite).options(joinedload(DiveSite.difficulty))

    # Store the search query for potential fuzzy search enhancement
    search_query_for_fuzzy = None
    if search:
        search_query_for_fuzzy = search.strip()[:200]

    # Apply search and name filtering using utility function
    query = apply_search_filters(query, search, name, db)

    # Apply basic filters using utility function
    query = apply_basic_filters(query, difficulty_code, include_undefined, country, region, my_dive_sites, current_user, db)

    # Apply tag filtering using utility function
    query = apply_tag_filtering(query, tag_ids, db)

    # Apply rating filtering using utility function
    query = apply_rating_filtering(query, min_rating, db)

    # Apply sorting using utility function
    query = apply_sorting(query, sort_by, sort_order, current_user)

    # Get total count for pagination
    total_count = query.count()

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size

    # Handle average_rating sorting before pagination
    if sort_by == 'average_rating':
        # Get all dive sites with their average ratings for proper sorting
        all_dive_sites_query = db.query(DiveSite)
        
        # Apply the same filters to the full query using utility functions
        all_dive_sites_query = apply_search_filters(all_dive_sites_query, search, name, db)
        all_dive_sites_query = apply_basic_filters(all_dive_sites_query, difficulty_code, include_undefined, country, region, my_dive_sites, current_user, db)
        all_dive_sites_query = apply_tag_filtering(all_dive_sites_query, tag_ids, db)
        all_dive_sites_query = apply_rating_filtering(all_dive_sites_query, min_rating, db)
        
        # Get all dive sites that match the filters
        all_dive_sites = all_dive_sites_query.all()
        
        # Calculate average ratings for all matching dive sites
        dive_sites_with_ratings = []
        for site in all_dive_sites:
            avg_rating = db.query(func.avg(SiteRating.score)).filter(
                SiteRating.dive_site_id == site.id
            ).scalar()
            dive_sites_with_ratings.append((site, avg_rating or 0))
        
        # Sort by average rating
        dive_sites_with_ratings.sort(
            key=lambda x: x[1], 
            reverse=(sort_order == 'desc')
        )
        
        # Apply pagination to the sorted results
        start_idx = offset
        end_idx = start_idx + page_size
        paginated_dive_sites = dive_sites_with_ratings[start_idx:end_idx]
        
        # Extract just the dive sites for further processing
        dive_sites = [site for site, rating in paginated_dive_sites]
        
        # Update total count for pagination
        total_count = len(all_dive_sites)
    else:
        # Initialize match_types at function level
        match_types = {}
        
        # Get dive sites with pagination for other sort fields
        dive_sites = query.offset(offset).limit(page_size).all()
        
        # Apply fuzzy search enhancement using unified trigger conditions
        if 'search_query_for_fuzzy' in locals() and get_unified_fuzzy_trigger_conditions(
            search_query_for_fuzzy,
            len(dive_sites),
            max_exact_results=5,
            max_query_length=10
        ):
            # Get exact results first
            exact_results = dive_sites
            
            # Enhance with fuzzy search
            enhanced_results = search_dive_sites_with_fuzzy(
                search_query_for_fuzzy, 
                exact_results, 
                db, 
                similarity_threshold=UNIFIED_TYPO_TOLERANCE['overall_threshold'],
                max_fuzzy_results=10,
                # Pass the current filters to ensure fuzzy search respects them
                tag_ids=tag_ids,
                difficulty_code=difficulty_code,
                country=country,
                region=region,
                min_rating=min_rating,
                my_dive_sites=my_dive_sites,
                current_user=current_user
            )
            
            # Transform enhanced results back to the expected format
            # Extract dive sites and create a mapping for match types
            dive_sites = []
            
            for result in enhanced_results:
                dive_sites.append(result['site'])
                match_types[result['site'].id] = {
                    'type': result['match_type'],
                    'score': result['score'],
                    'name_contains': result['name_contains'],
                    'country_contains': result['country_contains'],
                    'region_contains': result['region_contains'],
                    'description_contains': result['description_contains']
                }
        else:
            # Initialize empty match_types if no fuzzy search was performed
            match_types = {}

    # Calculate average ratings and get tags
    result = []
    for site in dive_sites:
        avg_rating = db.query(func.avg(SiteRating.score)).filter(
            SiteRating.dive_site_id == site.id
        ).scalar()

        total_ratings = db.query(func.count(SiteRating.id)).filter(
            SiteRating.dive_site_id == site.id
        ).scalar()

        # Get tags for this dive site
        from app.models import DiveSiteTag, AvailableTag
        tags = db.query(AvailableTag).join(DiveSiteTag).filter(
            DiveSiteTag.dive_site_id == site.id
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
            DiveSiteAlias.dive_site_id == site.id
        ).order_by(DiveSiteAlias.alias.asc()).all()

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

        # Get creator username if available
        creator_username = None
        if site.created_by:
            creator_user = db.query(User).filter(User.id == site.created_by).first()
            creator_username = creator_user.username if creator_user else None

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
                "created_at": site.created_at.isoformat() if site.created_at else None,
                "updated_at": site.updated_at.isoformat() if site.updated_at else None,
                "average_rating": float(avg_rating) if avg_rating else None,
                "total_ratings": total_ratings,
                "created_by": site.created_by,
                "created_by_username": creator_username,
                "tags": tags_dict,
                "aliases": aliases_dict
            }

        # Only include view_count for admin users
        if current_user and current_user.is_admin:
            site_dict["view_count"] = site.view_count

        result.append(site_dict)



    # Add pagination metadata to response headers
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=result)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Has-Next-Page"] = str(page < total_pages).lower()
    response.headers["X-Has-Prev-Page"] = str(page > 1).lower()
    
    # Add match type information to response headers if available
    if match_types:
        # Optimize match_types to prevent extremely large headers
        # Only include essential match information and limit size
        optimized_match_types = {}
        for site_id, match_info in match_types.items():
            # Include only essential fields to reduce header size
            optimized_match_types[site_id] = {
                'type': match_info.get('type', 'unknown'),
                'score': round(match_info.get('score', 0), 2) if match_info.get('score') else 0
            }
        
        # Convert to JSON and check size
        match_types_json = json.dumps(optimized_match_types)
        
        # If header is still too large, truncate or omit it
        if len(match_types_json) > 8000:  # 8KB limit for headers
            # Log warning about large header
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"X-Match-Types header too large ({len(match_types_json)} chars), omitting to prevent nginx errors")
        else:
            response.headers["X-Match-Types"] = match_types_json

    return response

@router.get("/count")
@skip_rate_limit_for_admin("250/minute")
async def get_dive_sites_count(
    request: Request,
    name: Optional[str] = Query(None, max_length=100),
    difficulty_code: Optional[str] = Query(None, description="Difficulty code: OPEN_WATER, ADVANCED_OPEN_WATER, DEEP_NITROX, TECHNICAL_DIVING"),
    include_undefined: bool = Query(False, description="Include dive sites with unspecified difficulty"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum average rating (0-10)"),
    tag_ids: Optional[List[int]] = Query(None),
    country: Optional[str] = Query(None, max_length=100),
    region: Optional[str] = Query(None, max_length=100),
    my_dive_sites: Optional[bool] = Query(None, description="Filter to show only dive sites created by the current user"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get total count of dive sites matching the filters"""
    query = db.query(DiveSite)

    # Apply all filters using utility functions
    query = apply_search_filters(query, None, name, db)  # No search parameter in count function
    query = apply_basic_filters(query, difficulty_code, include_undefined, country, region, my_dive_sites, current_user, db)
    query = apply_tag_filtering(query, tag_ids, db)
    query = apply_rating_filtering(query, min_rating, db)

    # Get total count
    total_count = query.count()

    return {"total": total_count}

@router.post("/", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("15/minute")
async def create_dive_site(
    request: Request,
    dive_site: DiveSiteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):

    dive_site_data = dive_site.dict()
    dive_site_data['created_by'] = current_user.id
    
    # Convert difficulty_code to difficulty_id
    if 'difficulty_code' in dive_site_data:
        difficulty_code = dive_site_data.pop('difficulty_code')
        dive_site_data['difficulty_id'] = get_difficulty_id_by_code(db, difficulty_code)
    
    db_dive_site = DiveSite(**dive_site_data)
    db.add(db_dive_site)
    db.commit()
    db.refresh(db_dive_site)

    return {
        **dive_site.dict(),
        "id": db_dive_site.id,
        "created_at": db_dive_site.created_at,
        "updated_at": db_dive_site.updated_at,
        "average_rating": None,
        "total_ratings": 0,
        "tags": []
    }

@router.get("/{dive_site_id}", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("300/minute")
async def get_dive_site(
    request: Request,
    dive_site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)  # <-- new optional dependency
):

    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Increment view count
    dive_site.view_count += 1
    db.commit()

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
        "created_at": dive_site.created_at.isoformat() if dive_site.created_at else None,
        "updated_at": dive_site.updated_at.isoformat() if dive_site.updated_at else None,
        "created_by": dive_site.created_by,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "tags": tags_dict,
        "aliases": aliases_dict,
        "user_rating": user_rating
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
    db: Session = Depends(get_db)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    media = db.query(SiteMedia).filter(SiteMedia.dive_site_id == dive_site_id).all()
    return media

@router.post("/{dive_site_id}/media", response_model=SiteMediaResponse)
@skip_rate_limit_for_admin("30/minute")
async def add_dive_site_media(
    request: Request,
    dive_site_id: int,
    media: SiteMediaCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Validate media URL
    if not media.url.startswith(('http://', 'https://')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media URL"
        )

    db_media = SiteMedia(
        dive_site_id=dive_site_id,
        media_type=media.media_type,
        url=media.url,
        description=media.description
    )
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media

@router.delete("/{dive_site_id}/media/{media_id}")
@skip_rate_limit_for_admin("30/minute")
async def delete_dive_site_media(
    request: Request,
    dive_site_id: int,
    media_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):

    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Check if media exists
    media = db.query(SiteMedia).filter(
        and_(SiteMedia.id == media_id, SiteMedia.dive_site_id == dive_site_id)
    ).first()
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )

    db.delete(media)
    db.commit()
    return {"message": "Media deleted successfully"}

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
    """Add a diving center to a dive site (admin, moderator, or diving center owner)"""

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

    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator or 
            (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage this diving center"
        )

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
    """Remove a diving center from a dive site (admin, moderator, or diving center owner)"""

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

    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator or 
            (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage this diving center"
        )

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

@router.put("/{dive_site_id}", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("30/minute")
async def update_dive_site(
    request: Request,
    dive_site_id: int,
    dive_site_update: DiveSiteUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):

    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    # Update only provided fields
    update_data = dive_site_update.dict(exclude_unset=True)

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
        "created_at": dive_site.created_at.isoformat() if dive_site.created_at else None,
        "updated_at": dive_site.updated_at.isoformat() if dive_site.updated_at else None,
        "created_by": dive_site.created_by,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "tags": tags_dict
    }

@router.delete("/{dive_site_id}")
@skip_rate_limit_for_admin("15/minute")
async def delete_dive_site(
    request: Request,
    dive_site_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )
    
    try:
        # Delete the dive site (cascade will handle related records)
        db.delete(dive_site)
        db.commit()
        return {"message": "Dive site deleted successfully"}
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
    Uses Haversine formula to calculate distances.
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

    # Haversine formula to calculate distances
    # Formula: 2 * R * asin(sqrt(sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)))
    # Where R = 6371 km (Earth's radius)
    from sqlalchemy import text

    haversine_query = text("""
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
        HAVING distance_km <= 100
        ORDER BY distance_km ASC
        LIMIT :limit
    """)

    result = db.execute(
        haversine_query,
        {
            "lat": dive_site.latitude,
            "lng": dive_site.longitude,
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
                    "region": dive_site.region
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
