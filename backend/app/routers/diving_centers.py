from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
import difflib
import json

from app.database import get_db
from app.models import DivingCenter, CenterRating, CenterComment, User, CenterDiveSite, GearRentalCost, DivingCenterOrganization, DivingOrganization, UserCertification, OwnershipRequest
from app.schemas import (
    DivingCenterCreate, DivingCenterUpdate, DivingCenterResponse,
    CenterRatingCreate, CenterRatingResponse,
    CenterCommentCreate, CenterCommentUpdate, CenterCommentResponse,
    CenterDiveSiteCreate, GearRentalCostCreate,
    DivingCenterOrganizationCreate, DivingCenterOrganizationUpdate, DivingCenterOrganizationResponse,
    DivingCenterOwnershipClaim, DivingCenterOwnershipResponse, DivingCenterOwnershipApproval, OwnershipRequestHistoryResponse
)
from app.auth import get_current_active_user, get_current_admin_user, get_current_user_optional, is_admin_or_moderator, get_current_user
from app.models import OwnershipStatus
from app.utils import (
    calculate_unified_phrase_aware_score,
    classify_match_type,
    get_unified_fuzzy_trigger_conditions,
    UNIFIED_TYPO_TOLERANCE
)

router = APIRouter()

def search_diving_centers_with_fuzzy(query: str, exact_results: List[DivingCenter], db: Session, similarity_threshold: float = UNIFIED_TYPO_TOLERANCE['overall_threshold'], max_fuzzy_results: int = 10, sort_by: str = None, sort_order: str = 'asc'):
    """
    Enhance search results with fuzzy matching when exact results are insufficient.
    
    Args:
        query: The search query string
        exact_results: List of diving centers from exact search
        db: Database session
        similarity_threshold: Minimum similarity score (0.0 to 1.0)
        max_fuzzy_results: Maximum number of fuzzy results to return
    
    Returns:
        List of diving centers with exact results first, followed by fuzzy matches
    """
    # Always apply phrase-aware scoring to exact results for consistent ranking
    # Sort exact results according to the specified sort criteria
    if sort_by == 'name':
        exact_results_sorted = sorted(exact_results, key=lambda x: x.name.lower(), reverse=(sort_order == 'desc'))
    elif sort_by == 'created_at':
        exact_results_sorted = sorted(exact_results, key=lambda x: x.created_at, reverse=(sort_order == 'desc'))
    elif sort_by == 'updated_at':
        exact_results_sorted = sorted(exact_results, key=lambda x: x.updated_at, reverse=(sort_order == 'desc'))
    else:
        # Default: sort by name ascending (case-insensitive)
        exact_results_sorted = sorted(exact_results, key=lambda x: x.name.lower())
    
    # Convert exact results to the expected format with phrase-aware scoring
    exact_results_with_scores = []
    for center in exact_results_sorted:
        # Get tags for this diving center for scoring
        center_tags = []
        if hasattr(center, 'tags') and center.tags:
            center_tags = [tag.name if hasattr(tag, 'name') else str(tag) for tag in center.tags]
        
        score = calculate_unified_phrase_aware_score(query.lower(), center.name, center.description, center.country, center.region, center.city, center_tags)
        exact_results_with_scores.append({
            'center': center,
            'match_type': 'exact' if score >= 0.9 else 'exact_words' if score >= 0.7 else 'partial_words',
            'score': score,
            'name_contains': query.lower() in center.name.lower(),
            'description_contains': center.description and query.lower() in center.description.lower(),
            'country_contains': False, # No longer used
            'region_contains': False # No longer used
        })
    
    # If we have enough exact results and no fuzzy search needed, return them
    if len(exact_results) >= 10:
        return exact_results_with_scores
    
    # Get all diving centers for fuzzy matching
    all_diving_centers = db.query(DivingCenter).all()
    
    # Create a set of exact result IDs to avoid duplicates
    exact_ids = {center.id for center in exact_results}
    
    # Perform fuzzy matching on all diving centers (case-insensitive)
    fuzzy_matches = []
    query_lower = query.lower()  # Convert query to lowercase for case-insensitive comparison
    
    for center in all_diving_centers:
        # Skip if already in exact results
        if center.id in exact_ids:
            continue
            
        # Use the new phrase-aware scoring function
        # Get tags for this diving center for scoring
        center_tags = []
        if hasattr(center, 'tags') and center.tags:
            center_tags = [tag.name if hasattr(tag, 'name') else str(tag) for tag in center.tags]
        
        weighted_score = calculate_unified_phrase_aware_score(query_lower, center.name, center.description, center.country, center.region, center.city, center_tags)
        
        # Check for partial matches (substring matches) for match type classification
        name_contains = query_lower in center.name.lower()
        description_contains = center.description and query_lower in center.description.lower()
        
        # Include if similarity above threshold
        if weighted_score > similarity_threshold:
            # Determine match type using unified classification
            match_type = classify_match_type(weighted_score)
            
            fuzzy_matches.append({
                'center': center,
                'match_type': match_type,
                'score': weighted_score,
                'name_contains': name_contains,
                'description_contains': description_contains,
                'country_contains': False, # No longer used
                'region_contains': False # No longer used
            })
    
    # Sort by score (highest first)
    fuzzy_matches.sort(key=lambda x: x['score'], reverse=True)
    
    # Limit results
    fuzzy_matches = fuzzy_matches[:max_fuzzy_results]
    
    # Combine exact and fuzzy results
    final_results = []
    
    # Sort exact results according to the specified sort criteria
    if sort_by == 'name':
        exact_results_sorted = sorted(exact_results, key=lambda x: x.name.lower(), reverse=(sort_order == 'desc'))
    elif sort_by == 'created_at':
        exact_results_sorted = sorted(exact_results, key=lambda x: x.created_at, reverse=(sort_order == 'desc'))
    elif sort_by == 'updated_at':
        exact_results_sorted = sorted(exact_results, key=lambda x: x.updated_at, reverse=(sort_order == 'desc'))
    else:
        # Default: sort by name ascending (case-insensitive)
        exact_results_sorted = sorted(exact_results, key=lambda x: x.name.lower())
    
    # Add scored exact results first
    final_results.extend(exact_results_with_scores)
    
    # Add fuzzy results (already sorted by score)
    final_results.extend(fuzzy_matches)
    
    return final_results

@router.get("/count")
async def get_diving_centers_count(
    search: Optional[str] = Query(None, max_length=200, description="Unified search across name, description, country, region, city"),
    name: Optional[str] = Query(None, max_length=100),
    country: Optional[str] = Query(None, max_length=100, description="Filter by country"),
    region: Optional[str] = Query(None, max_length=100, description="Filter by region"),
    city: Optional[str] = Query(None, max_length=100, description="Filter by city"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum average rating (0-10)"),
    max_rating: Optional[float] = Query(None, ge=0, le=10, description="Maximum average rating (0-10)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get total count of diving centers matching the filters."""
    query = db.query(DivingCenter)

    # Apply filters
    if name:
        query = query.filter(DivingCenter.name.ilike(f"%{name}%"))
    
    if country:
        query = query.filter(DivingCenter.country.ilike(f"%{country}%"))
    
    if region:
        query = query.filter(DivingCenter.region.ilike(f"%{region}%"))
    
    if city:
        query = query.filter(DivingCenter.city.ilike(f"%{city}%"))

    # Apply unified search across multiple fields (case-insensitive)
    if search:
        # Sanitize search input to prevent injection
        sanitized_search = search.strip()[:200]
        
        # Search across name, description, country, region, and city (case-insensitive using ilike)
        query = query.filter(
            or_(
                DivingCenter.name.ilike(f"%{sanitized_search}%"),
                DivingCenter.description.ilike(f"%{sanitized_search}%"),
                DivingCenter.country.ilike(f"%{sanitized_search}%"),
                DivingCenter.region.ilike(f"%{sanitized_search}%"),
                DivingCenter.city.ilike(f"%{sanitized_search}%")
            )
        )

    # Apply rating filters at database level for accurate count
    if min_rating is not None or max_rating is not None:
        # Create a subquery to filter by ratings
        ratings_filter_subquery = db.query(
            CenterRating.diving_center_id,
            func.avg(CenterRating.score).label('avg_rating')
        ).group_by(CenterRating.diving_center_id)
        
        if min_rating is not None:
            ratings_filter_subquery = ratings_filter_subquery.having(
                func.avg(CenterRating.score) >= min_rating
            )
        
        if max_rating is not None:
            ratings_filter_subquery = ratings_filter_subquery.having(
                func.avg(CenterRating.score) <= max_rating
            )
        
        ratings_filter_subquery = ratings_filter_subquery.subquery()
        
        # Join with the filtered ratings
        query = query.join(
            ratings_filter_subquery,
            DivingCenter.id == ratings_filter_subquery.c.diving_center_id
        )

    # Get total count
    total_count = query.count()

    return {"total": total_count}

@router.get("/", response_model=List[DivingCenterResponse])
async def get_diving_centers(
    search: Optional[str] = Query(None, max_length=200, description="Unified search across name, description, country, region, city"),
    name: Optional[str] = Query(None, max_length=100),
    country: Optional[str] = Query(None, max_length=100, description="Filter by country"),
    region: Optional[str] = Query(None, max_length=100, description="Filter by region"),
    city: Optional[str] = Query(None, max_length=100, description="Filter by city"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum average rating (0-10)"),
    max_rating: Optional[float] = Query(None, ge=0, le=10, description="Maximum average rating (0-10)"),
    sort_by: Optional[str] = Query(None, description="Sort field (name, view_count, comment_count, created_at, updated_at, country, region, city)"),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, or 100)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get diving centers with filtering and pagination."""
    # Validate page_size
    if page_size not in [1, 5, 25, 50, 100]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be one of: 25, 50, 100"
        )

    query = db.query(DivingCenter)

    # Apply filters
    if name:
        query = query.filter(DivingCenter.name.ilike(f"%{name}%"))
    
    if country:
        query = query.filter(DivingCenter.country.ilike(f"%{country}%"))
    
    if region:
        query = query.filter(DivingCenter.region.ilike(f"%{region}%"))
    
    if city:
        query = query.filter(DivingCenter.city.ilike(f"%{city}%"))

    # Apply unified search across multiple fields (case-insensitive)
    if search:
        # Sanitize search input to prevent injection
        sanitized_search = search.strip()[:200]
        search_query_for_fuzzy = sanitized_search
        
        # Use a more flexible approach: search for partial matches and let fuzzy search handle scoring
        # This ensures that "anavys" can match "Anavissos" through fuzzy matching
        query = query.filter(
            or_(
                DivingCenter.name.ilike(f"%{sanitized_search}%"),
                DivingCenter.description.ilike(f"%{sanitized_search}%"),
                DivingCenter.country.ilike(f"%{sanitized_search}%"),
                DivingCenter.region.ilike(f"%{sanitized_search}%"),
                DivingCenter.city.ilike(f"%{sanitized_search}%"),
                # Add more flexible matching for geographic fields
                DivingCenter.city.ilike(f"%{sanitized_search[:4]}%"),  # Match first 4+ characters
                DivingCenter.city.ilike(f"%{sanitized_search[:5]}%"),  # Match first 5+ characters
                DivingCenter.city.ilike(f"%{sanitized_search[:6]}%")   # Match first 6+ characters
            )
        )

    # Apply rating filters at database level for accurate pagination
    if min_rating is not None or max_rating is not None:
        # Create a subquery to filter by ratings
        ratings_filter_subquery = db.query(
            CenterRating.diving_center_id,
            func.avg(CenterRating.score).label('avg_rating')
        ).group_by(CenterRating.diving_center_id)
        
        if min_rating is not None:
            ratings_filter_subquery = ratings_filter_subquery.having(
                func.avg(CenterRating.score) >= min_rating
            )
        
        if max_rating is not None:
            ratings_filter_subquery = ratings_filter_subquery.having(
                func.avg(CenterRating.score) <= max_rating
            )
        
        ratings_filter_subquery = ratings_filter_subquery.subquery()
        
        # Join with the filtered ratings
        query = query.join(
            ratings_filter_subquery,
            DivingCenter.id == ratings_filter_subquery.c.diving_center_id
        )

    # Apply dynamic sorting based on parameters
    if sort_by:
        # All valid sort fields (including admin-only ones)
        valid_sort_fields = {
            'name', 'view_count', 'comment_count', 'created_at', 'updated_at', 'country', 'region', 'city'
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
            sort_field = func.lower(DivingCenter.name)
        elif sort_by == 'view_count':
            # Only admin users can sort by view_count
            if not current_user or not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Sorting by view_count is only available for admin users"
                )
            sort_field = DivingCenter.view_count
        elif sort_by == 'comment_count':
            # Only admin users can sort by comment_count
            if not current_user or not current_user.is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Sorting by comment_count is only available for admin users"
                )
            # For comment count, we need to join with comments and group
            query = query.outerjoin(CenterComment).group_by(DivingCenter.id)
            sort_field = func.count(CenterComment.id)
        elif sort_by == 'created_at':
            sort_field = DivingCenter.created_at
        elif sort_by == 'updated_at':
            sort_field = DivingCenter.updated_at
        elif sort_by == 'country':
            sort_field = func.lower(DivingCenter.country)
        elif sort_by == 'region':
            sort_field = func.lower(DivingCenter.region)
        elif sort_by == 'city':
            sort_field = func.lower(DivingCenter.city)
        
        # Apply the sorting
        if sort_order == 'desc':
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    else:
        # Default sorting by name (case-insensitive)
        query = query.order_by(func.lower(DivingCenter.name).asc())

    # Get total count for pagination headers (after applying all filters)
    total_count = query.count()

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size
    has_next_page = page < total_pages
    has_prev_page = page > 1

    # Get diving centers with pagination and ratings in a single query
    from sqlalchemy import func as sql_func

    # Subquery to get average ratings and total ratings
    ratings_subquery = db.query(
        CenterRating.diving_center_id,
        sql_func.avg(CenterRating.score).label('avg_rating'),
        sql_func.count(CenterRating.id).label('total_ratings')
    ).group_by(CenterRating.diving_center_id).subquery()

    # Join diving centers with ratings
    query_with_ratings = query.outerjoin(
        ratings_subquery,
        DivingCenter.id == ratings_subquery.c.diving_center_id
    ).add_columns(
        ratings_subquery.c.avg_rating,
        ratings_subquery.c.total_ratings
    )

    # Check if we need fuzzy search before applying pagination
    # Always trigger fuzzy search for multi-word queries or when exact results are insufficient
    should_use_fuzzy = search and (
        total_count < 5 or 
        len(search.strip()) <= 10 or  # Reasonable length for fuzzy search
        ' ' in search.strip()  # Multi-word queries (e.g., "scuba life")
    )
    
    if should_use_fuzzy:
        # For fuzzy search, we need all exact results first, then we'll paginate the final results
        diving_centers_with_ratings = query_with_ratings.all()
        # Extract diving centers from the results
        diving_centers = [center_data[0] for center_data in diving_centers_with_ratings]
    else:
        # For normal search, apply pagination as usual
        diving_centers_with_ratings = query_with_ratings.offset(offset).limit(page_size).all()
        # Extract diving centers from the results
        diving_centers = [center_data[0] for center_data in diving_centers_with_ratings]
    
    # Apply fuzzy search if we determined we should use it
    match_types = {}
    if should_use_fuzzy:
        # Get the search query for fuzzy search
        search_query_for_fuzzy = search.strip()[:200]
        
        # Perform fuzzy search to enhance results
        enhanced_results = search_diving_centers_with_fuzzy(
            search_query_for_fuzzy, 
            diving_centers, 
            db, 
            similarity_threshold=UNIFIED_TYPO_TOLERANCE['overall_threshold'], 
            max_fuzzy_results=10,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Update diving centers with enhanced results
        all_diving_centers = [result['center'] for result in enhanced_results]
        
        # Apply pagination to the final fuzzy search results
        diving_centers = all_diving_centers[offset:offset + page_size]
        
        # Create match types mapping for frontend (only for the paginated results)
        for result in enhanced_results[offset:offset + page_size]:
            match_types[result['center'].id] = {
                'type': result['match_type'],
                'score': result['score']
            }
        
        # Update total count and pagination info for fuzzy search results
        total_count = len(all_diving_centers)
        total_pages = (total_count + page_size - 1) // page_size
        has_next_page = page < total_pages
        has_prev_page = page > 1
        
        # Re-query with the enhanced results to get ratings
        if len(diving_centers) > 0:
            # We have enhanced results, need to get ratings for the paginated subset
            enhanced_query = db.query(DivingCenter).filter(
                DivingCenter.id.in_([center.id for center in diving_centers])
            )
            
            # Re-apply the same logic for ratings
            if min_rating is not None or max_rating is not None:
                enhanced_query = enhanced_query.join(
                    ratings_subquery,
                    DivingCenter.id == ratings_subquery.c.diving_center_id
                )
            
            # Get enhanced results with ratings
            enhanced_with_ratings = enhanced_query.outerjoin(
                ratings_subquery,
                DivingCenter.id == ratings_subquery.c.diving_center_id
            ).add_columns(
                ratings_subquery.c.avg_rating,
                ratings_subquery.c.total_ratings
            ).all()
            
            # Create a mapping from ID to rating data to preserve the sorted order
            rating_data_by_id = {}
            for center_data in enhanced_with_ratings:
                center = center_data[0]
                rating_data_by_id[center.id] = center_data
            
            # Rebuild diving_centers_with_ratings in the correct sorted order
            diving_centers_with_ratings = []
            for center in diving_centers:
                if center.id in rating_data_by_id:
                    diving_centers_with_ratings.append(rating_data_by_id[center.id])
                else:
                    # Fallback: create entry with no rating data
                    diving_centers_with_ratings.append((center, None, None))

    # Build result
    result = []
    for center_data in diving_centers_with_ratings:
        center = center_data[0]  # The diving center object
        avg_rating = center_data[1]  # avg_rating from subquery
        total_ratings = center_data[2]  # total_ratings from subquery

        center_dict = {
            "id": center.id,
            "name": center.name,
            "description": center.description,
            "email": center.email,
            "phone": center.phone,
            "website": center.website,
            "latitude": float(center.latitude) if center.latitude else None,
            "longitude": float(center.longitude) if center.longitude else None,
            "country": center.country,
            "region": center.region,
            "city": center.city,
            "created_at": center.created_at.isoformat() if center.created_at else None,
            "updated_at": center.updated_at.isoformat() if center.updated_at else None,
            "average_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings or 0
        }

        # Only include view_count for admin users
        if current_user and current_user.is_admin:
            center_dict["view_count"] = center.view_count

        result.append(center_dict)

    # Return response with pagination headers
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=result)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Has-Next-Page"] = str(has_next_page).lower()
    response.headers["X-Has-Prev-Page"] = str(has_prev_page).lower()
    
    # Add match types header if available
    if match_types:
        response.headers["X-Match-Types"] = json.dumps(match_types)

    return response

@router.post("/", response_model=DivingCenterResponse)
async def create_diving_center(
    diving_center: DivingCenterCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_diving_center = DivingCenter(**diving_center.dict())
    db.add(db_diving_center)
    db.commit()
    db.refresh(db_diving_center)

    return {
        **diving_center.dict(),
        "id": db_diving_center.id,
        "created_at": db_diving_center.created_at,
        "updated_at": db_diving_center.updated_at,
        "average_rating": None,
        "total_ratings": 0
    }

@router.get("/ownership-requests", response_model=List[DivingCenterOwnershipResponse])
async def get_ownership_requests(
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Get all diving centers with ownership requests (admin/moderator only)"""
    diving_centers = db.query(DivingCenter).filter(
        DivingCenter.ownership_status.in_(["claimed", "approved"])
    ).all()

    result = []
    for center in diving_centers:
        owner_username = None
        if center.owner_id:
            owner = db.query(User).filter(User.id == center.owner_id).first()
            owner_username = owner.username if owner else None

        result.append({
            "id": center.id,
            "name": center.name,
            "owner_id": center.owner_id,
            "ownership_status": center.ownership_status,
            "owner_username": owner_username
        })

    return result

@router.get("/ownership-requests/history", response_model=List[OwnershipRequestHistoryResponse])
async def get_ownership_request_history(
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Get complete history of all ownership requests (admin/moderator only)"""
    ownership_requests = db.query(OwnershipRequest).order_by(OwnershipRequest.request_date.desc()).all()

    result = []
    for request in ownership_requests:
        # Get diving center name
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == request.diving_center_id).first()
        diving_center_name = diving_center.name if diving_center else "Unknown Center"
        
        # Get user username
        user = db.query(User).filter(User.id == request.user_id).first()
        username = user.username if user else "Unknown User"
        
        # Get admin username if processed
        admin_username = None
        if request.processed_by:
            admin = db.query(User).filter(User.id == request.processed_by).first()
            admin_username = admin.username if admin else "Unknown Admin"

        result.append({
            "id": request.id,
            "diving_center_id": request.diving_center_id,
            "diving_center_name": diving_center_name,
            "user_id": request.user_id,
            "username": username,
            "request_status": request.request_status.value,
            "request_date": request.request_date,
            "processed_date": request.processed_date,
            "processed_by": request.processed_by,
            "admin_username": admin_username,
            "reason": request.reason,
            "notes": request.notes
        })

    return result

@router.get("/{diving_center_id}", response_model=DivingCenterResponse)
async def get_diving_center(
    diving_center_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)  # Fix type annotation
):
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Increment view count
    diving_center.view_count += 1
    db.commit()

    # Calculate average rating
    avg_rating = db.query(func.avg(CenterRating.score)).filter(
        CenterRating.diving_center_id == diving_center.id
    ).scalar()

    total_ratings = db.query(func.count(CenterRating.id)).filter(
        CenterRating.diving_center_id == diving_center.id
    ).scalar()

    # Get user's previous rating if authenticated
    user_rating = None
    if current_user:
        user_rating_obj = db.query(CenterRating).filter(
            CenterRating.diving_center_id == diving_center_id,
            CenterRating.user_id == current_user.id
        ).first()
        if user_rating_obj:
            user_rating = user_rating_obj.score

    # Prepare response data
    response_data = {
        "id": diving_center.id,
        "name": diving_center.name,
        "description": diving_center.description,
        "email": diving_center.email,
        "phone": diving_center.phone,
        "website": diving_center.website,
        "latitude": diving_center.latitude,
        "longitude": diving_center.longitude,
        "country": diving_center.country,
        "region": diving_center.region,
        "city": diving_center.city,
        "created_at": diving_center.created_at,
        "updated_at": diving_center.updated_at,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "user_rating": user_rating,
        "ownership_status": diving_center.ownership_status.value if diving_center.ownership_status else None,
        "owner_username": diving_center.owner.username if diving_center.owner else None
    }

    # Only include view_count for admin users
    if current_user and current_user.is_admin:
        response_data["view_count"] = diving_center.view_count

    return response_data

@router.put("/{diving_center_id}", response_model=DivingCenterResponse)
async def update_diving_center(
    diving_center_id: int,
    diving_center_update: DivingCenterUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Check if user has permission to edit (admin, moderator, or owner)
    can_edit = (
        current_user.is_admin or
        current_user.is_moderator or
        (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved)
    )

    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this diving center"
        )

    update_data = diving_center_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(diving_center, field, value)

    db.commit()
    db.refresh(diving_center)

    # Calculate average rating
    avg_rating = db.query(func.avg(CenterRating.score)).filter(
        CenterRating.diving_center_id == diving_center.id
    ).scalar()

    total_ratings = db.query(func.count(CenterRating.id)).filter(
        CenterRating.diving_center_id == diving_center.id
    ).scalar()

    # Return the updated diving center using the response model
    return DivingCenterResponse(
        id=diving_center.id,
        name=diving_center.name,
        description=diving_center.description,
        email=diving_center.email,
        phone=diving_center.phone,
        website=diving_center.website,
        latitude=diving_center.latitude,
        longitude=diving_center.longitude,
        country=diving_center.country,
        region=diving_center.region,
        city=diving_center.city,
        created_at=diving_center.created_at,
        updated_at=diving_center.updated_at,
        average_rating=float(avg_rating) if avg_rating else None,
        total_ratings=total_ratings
    )

@router.delete("/{diving_center_id}")
async def delete_diving_center(
    diving_center_id: int,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    db.delete(diving_center)
    db.commit()

    return {"message": "Diving center deleted successfully"}

@router.post("/{diving_center_id}/rate", response_model=CenterRatingResponse)
async def rate_diving_center(
    diving_center_id: int,
    rating: CenterRatingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Check if user already rated this diving center
    existing_rating = db.query(CenterRating).filter(
        and_(CenterRating.diving_center_id == diving_center_id, CenterRating.user_id == current_user.id)
    ).first()

    if existing_rating:
        # Update existing rating
        existing_rating.score = rating.score
        db.commit()
        db.refresh(existing_rating)
        return {
            "id": existing_rating.id,
            "diving_center_id": existing_rating.diving_center_id,
            "user_id": existing_rating.user_id,
            "score": existing_rating.score,
            "created_at": existing_rating.created_at
        }
    else:
        # Create new rating
        db_rating = CenterRating(
            diving_center_id=diving_center_id,
            user_id=current_user.id,
            score=rating.score
        )
        db.add(db_rating)
        db.commit()
        db.refresh(db_rating)
        return {
            "id": db_rating.id,
            "diving_center_id": db_rating.diving_center_id,
            "user_id": db_rating.user_id,
            "score": db_rating.score,
            "created_at": db_rating.created_at
        }

@router.get("/{diving_center_id}/comments", response_model=List[CenterCommentResponse])
async def get_diving_center_comments(
    diving_center_id: int,
    db: Session = Depends(get_db)
):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Get comments with user information and their primary certification
    comments = db.query(
        CenterComment,
        User.username,
        User.number_of_dives,
        UserCertification.certification_level,
        DivingOrganization.acronym
    ).join(
        User, CenterComment.user_id == User.id
    ).outerjoin(
        UserCertification, User.id == UserCertification.user_id
    ).outerjoin(
        DivingOrganization, UserCertification.diving_organization_id == DivingOrganization.id
    ).filter(
        CenterComment.diving_center_id == diving_center_id
    ).order_by(CenterComment.created_at.desc()).all()

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
                "diving_center_id": comment.diving_center_id,
                "user_id": comment.user_id,
                "comment_text": comment.comment_text,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at,
                "username": username,
                "user_diving_certification": certification_str,
                "user_number_of_dives": number_of_dives
            }

    return list(comment_dict.values())

@router.post("/{diving_center_id}/comments", response_model=CenterCommentResponse)
async def create_diving_center_comment(
    diving_center_id: int,
    comment: CenterCommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    db_comment = CenterComment(
        diving_center_id=diving_center_id,
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
        "id": db_comment.id,
        "diving_center_id": db_comment.diving_center_id,
        "user_id": db_comment.user_id,
        "comment_text": db_comment.comment_text,
        "created_at": db_comment.created_at,
        "updated_at": db_comment.updated_at,
        "username": current_user.username,
        "user_diving_certification": certification_str,
        "user_number_of_dives": current_user.number_of_dives
    }

@router.put("/{diving_center_id}/comments/{comment_id}", response_model=CenterCommentResponse)
async def update_diving_center_comment(
    diving_center_id: int,
    comment_id: int,
    comment_update: CenterCommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = db.query(CenterComment).filter(
        and_(CenterComment.id == comment_id, CenterComment.diving_center_id == diving_center_id)
    ).first()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this comment"
        )

    comment.comment_text = comment_update.comment_text
    db.commit()
    db.refresh(comment)

    # Get user's primary certification
    primary_certification = db.query(
        UserCertification.certification_level,
        DivingOrganization.acronym
    ).join(
        DivingOrganization, UserCertification.diving_organization_id == DivingOrganization.id
    ).filter(
        UserCertification.user_id == comment.user_id,
        UserCertification.is_active == True
    ).first()

    certification_str = None
    if primary_certification and primary_certification[0] and primary_certification[1]:
        certification_str = f"{primary_certification[1]} {primary_certification[0]}"

    return {
        "id": comment.id,
        "diving_center_id": comment.diving_center_id,
        "user_id": comment.user_id,
        "comment_text": comment.comment_text,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "username": comment.user.username,
        "user_diving_certification": certification_str,
        "user_number_of_dives": comment.user.number_of_dives
    }

@router.delete("/{diving_center_id}/comments/{comment_id}")
async def delete_diving_center_comment(
    diving_center_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    # Check if comment exists
    comment = db.query(CenterComment).filter(
        and_(CenterComment.id == comment_id, CenterComment.diving_center_id == diving_center_id)
    ).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    # Check if user can delete the comment
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment"
        )

    db.delete(comment)
    db.commit()

    return {"message": "Comment deleted successfully"}

# Gear Rental Endpoints
@router.get("/{diving_center_id}/gear-rental")
async def get_diving_center_gear_rental(diving_center_id: int, db: Session = Depends(get_db)):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
        )

    gear_rental = db.query(GearRentalCost).filter(GearRentalCost.diving_center_id == diving_center_id).all()
    return gear_rental

@router.post("/{diving_center_id}/gear-rental")
async def add_diving_center_gear_rental(
    diving_center_id: int,
    gear_rental: GearRentalCostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator):
        # Check if user is the owner of this diving center
        from app.models import DivingCenter
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )
        
        if not (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to manage this diving center"
            )

    db_gear_rental = GearRentalCost(
        diving_center_id=diving_center_id,
        item_name=gear_rental.item_name,
        cost=gear_rental.cost,
        currency=gear_rental.currency
    )
    db.add(db_gear_rental)
    db.commit()
    db.refresh(db_gear_rental)
    return db_gear_rental

@router.delete("/{diving_center_id}/gear-rental/{gear_id}")
async def delete_diving_center_gear_rental(
    diving_center_id: int,
    gear_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator):
        # Check if user is the owner of this diving center
        from app.models import DivingCenter
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )
        
        if not (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to manage this diving center"
            )

    # Check if gear rental exists
    gear_rental = db.query(GearRentalCost).filter(
        and_(GearRentalCost.id == gear_id, GearRentalCost.diving_center_id == diving_center_id)
    ).first()
    if not gear_rental:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gear rental not found"
        )

    db.delete(gear_rental)
    db.commit()
    return {"message": "Gear rental deleted successfully"}

# Diving Center Organization Management
@router.get("/{diving_center_id}/organizations", response_model=List[DivingCenterOrganizationResponse])
async def get_diving_center_organizations(
    diving_center_id: int,
    db: Session = Depends(get_db)
):
    """Get organizations associated with a diving center."""
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    organizations = db.query(DivingCenterOrganization).options(
        joinedload(DivingCenterOrganization.diving_organization)
    ).filter(
        DivingCenterOrganization.diving_center_id == diving_center_id
    ).all()
    return organizations

@router.post("/{diving_center_id}/organizations", response_model=DivingCenterOrganizationResponse)
async def add_diving_center_organization(
    diving_center_id: int,
    organization: DivingCenterOrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add an organization to a diving center (admin, moderator, or diving center owner)."""
    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator):
        # Check if user is the owner of this diving center
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )
        
        if not (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to manage this diving center"
            )
    else:
        # Check if diving center exists
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        if not diving_center:
            raise HTTPException(status_code=404, detail="Diving center not found")

    # Check if diving organization exists
    diving_org = db.query(DivingOrganization).filter(DivingOrganization.id == organization.diving_organization_id).first()
    if not diving_org:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    # Check if organization is already associated with this center
    existing_org = db.query(DivingCenterOrganization).filter(
        DivingCenterOrganization.diving_center_id == diving_center_id,
        DivingCenterOrganization.diving_organization_id == organization.diving_organization_id
    ).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization is already associated with this diving center")

    # If this is marked as primary, unmark other primary organizations
    if organization.is_primary:
        db.query(DivingCenterOrganization).filter(
            DivingCenterOrganization.diving_center_id == diving_center_id,
            DivingCenterOrganization.is_primary == True
        ).update({"is_primary": False})

    db_organization = DivingCenterOrganization(
        diving_center_id=diving_center_id,
        **organization.dict()
    )
    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)
    return db_organization

@router.put("/{diving_center_id}/organizations/{organization_id}", response_model=DivingCenterOrganizationResponse)
async def update_diving_center_organization(
    diving_center_id: int,
    organization_id: int,
    organization: DivingCenterOrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an organization association for a diving center (admin, moderator, or diving center owner)."""
    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator):
        # Check if user is the owner of this diving center
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )
        
        if not (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to manage this diving center"
            )
    else:
        # Check if diving center exists
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        if not diving_center:
            raise HTTPException(status_code=404, detail="Diving center not found")

    # Check if organization association exists
    db_organization = db.query(DivingCenterOrganization).filter(
        DivingCenterOrganization.id == organization_id,
        DivingCenterOrganization.diving_center_id == diving_center_id
    ).first()
    if not db_organization:
        raise HTTPException(status_code=404, detail="Organization association not found")

    # If this is being marked as primary, unmark other primary organizations
    if organization.is_primary:
        db.query(DivingCenterOrganization).filter(
            DivingCenterOrganization.diving_center_id == diving_center_id,
            DivingCenterOrganization.is_primary == True,
            DivingCenterOrganization.id != organization_id
        ).update({"is_primary": False})

    # Update fields
    update_data = organization.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_organization, field, value)

    db.commit()
    db.refresh(db_organization)
    return db_organization

@router.delete("/{diving_center_id}/organizations/{organization_id}")
async def remove_diving_center_organization(
    diving_center_id: int,
    organization_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove an organization association from a diving center (admin, moderator, or diving center owner)."""
    # Check if user has permission to manage this diving center
    if not (current_user.is_admin or current_user.is_moderator):
        # Check if user is the owner of this diving center
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        
        if not diving_center:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Diving center not found"
            )
        
        if not (diving_center.owner_id == current_user.id and diving_center.ownership_status == OwnershipStatus.approved):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to manage this diving center"
            )
    else:
        # Check if diving center exists
        diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
        if not diving_center:
            raise HTTPException(status_code=404, detail="Diving center not found")

    # Check if organization relationship exists
    organization_relationship = db.query(DivingCenterOrganization).filter(
        DivingCenterOrganization.id == organization_id,
        DivingCenterOrganization.diving_center_id == diving_center_id
    ).first()

    if not organization_relationship:
        raise HTTPException(status_code=404, detail="Organization relationship not found")

    db.delete(organization_relationship)
    db.commit()

    return {"message": "Organization removed from diving center successfully"}

# Diving Center Ownership endpoints
@router.post("/{diving_center_id}/claim")
async def claim_diving_center_ownership(
    diving_center_id: int,
    claim: DivingCenterOwnershipClaim,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Claim ownership of a diving center"""
    if not current_user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    # Check if diving center is already claimed or approved
    if diving_center.ownership_status != OwnershipStatus.unclaimed:
        raise HTTPException(
            status_code=400,
            detail="Diving center is already claimed or has an owner"
        )

    # Create ownership request record
    ownership_request = OwnershipRequest(
        diving_center_id=diving_center_id,
        user_id=current_user.id,
        request_status=OwnershipStatus.claimed,
        reason=claim.reason
    )
    db.add(ownership_request)

    # Update diving center ownership status
    diving_center.ownership_status = OwnershipStatus.claimed
    diving_center.owner_id = current_user.id

    db.commit()
    db.refresh(diving_center)

    return {
        "message": "Ownership claim submitted successfully. Waiting for admin approval.",
        "diving_center_id": diving_center_id,
        "status": "claimed"
    }


@router.post("/{diving_center_id}/approve-ownership")
async def approve_diving_center_ownership(
    diving_center_id: int,
    approval: DivingCenterOwnershipApproval,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Approve or deny ownership claim for a diving center (admin only)"""
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    # Find the existing ownership request for this center and user
    ownership_request = db.query(OwnershipRequest).filter(
        OwnershipRequest.diving_center_id == diving_center_id,
        OwnershipRequest.user_id == diving_center.owner_id,
        OwnershipRequest.request_status == OwnershipStatus.claimed
    ).first()

    # Capture the current owner_id before potentially changing it
    current_owner_id = diving_center.owner_id
    
    if approval.approved:
        # Approve the ownership claim
        diving_center.ownership_status = OwnershipStatus.approved
        message = "Ownership claim approved successfully"
        new_status = OwnershipStatus.approved
    else:
        # Deny the ownership claim
        diving_center.ownership_status = OwnershipStatus.unclaimed
        diving_center.owner_id = None
        message = "Ownership claim denied"
        new_status = OwnershipStatus.denied

    # Create a new ownership request record for the approval/denial action
    new_ownership_request = OwnershipRequest(
        diving_center_id=diving_center_id,
        user_id=current_owner_id,  # Use the captured owner_id
        request_status=new_status,
        reason=approval.reason,
        processed_date=func.now(),
        processed_by=current_user.id,
        notes=f"Ownership {'approved' if approval.approved else 'denied'} by admin"
    )
    db.add(new_ownership_request)

    db.commit()
    db.refresh(diving_center)

    return {
        "message": message,
        "diving_center_id": diving_center_id,
        "status": diving_center.ownership_status,
        "reason": approval.reason
    }





@router.put("/{diving_center_id}/assign-owner")
async def assign_diving_center_owner(
    diving_center_id: int,
    user_id: int,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Assign a user as owner of a diving center (admin only)"""
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Assign ownership
    diving_center.owner_id = user_id
    diving_center.ownership_status = OwnershipStatus.approved

    db.commit()
    db.refresh(diving_center)

    return {
        "message": f"User {user.username} assigned as owner of {diving_center.name}",
        "diving_center_id": diving_center_id,
        "owner_id": user_id,
        "status": "approved"
    }


@router.post("/{diving_center_id}/revoke-ownership")
async def revoke_diving_center_ownership(
    diving_center_id: int,
    revocation: DivingCenterOwnershipApproval,
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Revoke ownership of a diving center (admin only)"""
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(status_code=404, detail="Diving center not found")

    # Check if diving center has an approved owner
    if diving_center.ownership_status != OwnershipStatus.approved:
        raise HTTPException(
            status_code=400,
            detail="Cannot revoke ownership: diving center does not have an approved owner"
        )

    # Get current owner info for the response
    current_owner_username = None
    if diving_center.owner_id:
        owner = db.query(User).filter(User.id == diving_center.owner_id).first()
        current_owner_username = owner.username if owner else None

    # Create a new ownership request record for the revocation
    revocation_request = OwnershipRequest(
        diving_center_id=diving_center_id,
        user_id=diving_center.owner_id,
        request_status=OwnershipStatus.denied,  # Use denied status for revoked ownership
        request_date=func.now(),
        processed_date=func.now(),
        processed_by=current_user.id,
        reason=revocation.reason,
        notes="Ownership revocation by admin"
    )
    db.add(revocation_request)

    # Revoke ownership
    diving_center.ownership_status = OwnershipStatus.unclaimed
    diving_center.owner_id = None

    db.commit()
    db.refresh(diving_center)

    return {
        "message": f"Ownership of {diving_center.name} has been revoked from {current_owner_username or 'previous owner'}",
        "diving_center_id": diving_center_id,
        "previous_owner": current_owner_username,
        "status": "unclaimed",
        "reason": revocation.reason
    }
