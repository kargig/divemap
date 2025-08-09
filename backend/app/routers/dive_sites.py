from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import DiveSite, SiteRating, SiteComment, SiteMedia, User, DivingCenter, CenterDiveSite, UserCertification, DivingOrganization, Dive, DiveTag, AvailableTag, DiveSiteAlias
from app.schemas import (
    DiveSiteCreate, DiveSiteUpdate, DiveSiteResponse,
    SiteRatingCreate, SiteRatingResponse,
    SiteCommentCreate, SiteCommentUpdate, SiteCommentResponse,
    SiteMediaCreate, SiteMediaResponse,
    DiveSiteSearchParams, CenterDiveSiteCreate, DiveResponse,
    DiveSiteAliasCreate, DiveSiteAliasUpdate, DiveSiteAliasResponse
)
import requests
from app.auth import get_current_active_user, get_current_admin_user, get_current_user_optional
from app.limiter import limiter, skip_rate_limit_for_admin

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Simple health check endpoint
    """
    return {"status": "healthy", "timestamp": "2025-07-27T12:56:00Z"}

@router.get("/reverse-geocode")
@skip_rate_limit_for_admin("50/minute")
async def reverse_geocode(
    request: Request,
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
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
            "User-Agent": "Divemap/1.0 (https://github.com/your-repo/divemap)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=15)

        # Log the response for debugging
        print(f"Geocoding request: {url} with params {params}")
        print(f"Response status: {response.status_code}")
        print(f"Response content: {response.text[:500]}...")

        response.raise_for_status()

        data = response.json()
        address = data.get("address", {})

        # Extract country and region information
        country = address.get("country")
        region = (
            address.get("state") or
            address.get("province") or
            address.get("region") or
            address.get("county")
        )

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
        print("OpenStreetMap API unavailable, using fallback location detection")
        return get_fallback_location(latitude, longitude)
    except requests.RequestException as e:
        # Fallback to basic location detection based on coordinates
        print(f"OpenStreetMap API error: {e}, using fallback location detection")
        return get_fallback_location(latitude, longitude)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during geocoding: {str(e)}"
        )

def get_fallback_location(latitude: float, longitude: float):
    """
    Fallback function to provide basic location information based on coordinates
    """
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

        return {
            "country": country,
            "region": region,
            "full_address": f"Coordinates: {latitude}, {longitude}"
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid coordinates provided"
        )

@router.get("/", response_model=List[DiveSiteResponse])
@skip_rate_limit_for_admin("100/minute")
async def get_dive_sites(
    request: Request,
    name: Optional[str] = Query(None, max_length=100),
    difficulty_level: Optional[str] = Query(None, pattern=r"^(beginner|intermediate|advanced|expert)$"),
    min_rating: Optional[float] = Query(None, ge=0, le=10),
    max_rating: Optional[float] = Query(None, ge=0, le=10),
    tag_ids: Optional[List[int]] = Query(None),
    country: Optional[str] = Query(None, max_length=100),
    region: Optional[str] = Query(None, max_length=100),
    my_dive_sites: Optional[bool] = Query(None, description="Filter to show only dive sites created by the current user"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(25, description="Page size (25, 50, or 100)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):

    # Validate page_size to only allow 25, 50, or 100
    if page_size not in [25, 50, 100]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be one of: 25, 50, 100"
        )

    query = db.query(DiveSite)

    # Apply filters with input validation
    if name:
        # Sanitize name input to prevent injection
        sanitized_name = name.strip()[:100]
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))

    if difficulty_level:
        query = query.filter(DiveSite.difficulty_level == difficulty_level)

    # Apply country filtering
    if country:
        sanitized_country = country.strip()[:100]
        query = query.filter(DiveSite.country.ilike(f"%{sanitized_country}%"))

    # Apply region filtering
    if region:
        sanitized_region = region.strip()[:100]
        query = query.filter(DiveSite.region.ilike(f"%{sanitized_region}%"))

    # Apply my_dive_sites filtering
    if my_dive_sites and current_user:
        query = query.filter(DiveSite.created_by == current_user.id)

    # Apply tag filtering
    if tag_ids:
        from app.models import DiveSiteTag
        from sqlalchemy import select
        # Validate tag_ids to prevent injection
        if len(tag_ids) > 20:  # Limit number of tags
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many tag filters"
            )
        # Use AND logic - dive site must have ALL selected tags
        # First, get dive site IDs that have all the required tags
        tag_count = len(tag_ids)
        dive_site_ids_with_all_tags = select(DiveSiteTag.dive_site_id).filter(
            DiveSiteTag.tag_id.in_(tag_ids)
        ).group_by(DiveSiteTag.dive_site_id).having(
            func.count(DiveSiteTag.tag_id) == tag_count
        )

        # Then filter the main query by those dive site IDs
        query = query.filter(DiveSite.id.in_(dive_site_ids_with_all_tags))

    # Apply alphabetical sorting by name (case-insensitive)
    query = query.order_by(func.lower(DiveSite.name).asc())

    # Get total count for pagination
    total_count = query.count()

    # Calculate pagination
    offset = (page - 1) * page_size
    total_pages = (total_count + page_size - 1) // page_size

    # Get dive sites with pagination
    dive_sites = query.offset(offset).limit(page_size).all()

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

        site_dict = {
                "id": site.id,
                "name": site.name,
                "description": site.description,
                "latitude": float(site.latitude) if site.latitude else None,
                "longitude": float(site.longitude) if site.longitude else None,
                "address": site.address,
                "access_instructions": site.access_instructions,
                "difficulty_level": site.difficulty_level.value if site.difficulty_level else None,
                "marine_life": site.marine_life,
                "safety_information": site.safety_information,
                "max_depth": float(site.max_depth) if site.max_depth else None,
                "country": site.country,
                "region": site.region,
                "created_at": site.created_at.isoformat() if site.created_at else None,
                "updated_at": site.updated_at.isoformat() if site.updated_at else None,
                "average_rating": float(avg_rating) if avg_rating else None,
                "total_ratings": total_ratings,
                "tags": tags_dict,
                "aliases": aliases_dict
            }

        # Only include view_count for admin users
        if current_user and current_user.is_admin:
            site_dict["view_count"] = site.view_count

        result.append(site_dict)

    # Apply rating filters
    if min_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] >= min_rating]

    if max_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] <= max_rating]

    # Add pagination metadata to response headers
    from fastapi.responses import JSONResponse
    response = JSONResponse(content=result)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Current-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Has-Next-Page"] = str(page < total_pages).lower()
    response.headers["X-Has-Prev-Page"] = str(page > 1).lower()

    return response

@router.get("/count")
@skip_rate_limit_for_admin("100/minute")
async def get_dive_sites_count(
    request: Request,
    name: Optional[str] = Query(None, max_length=100),
    difficulty_level: Optional[str] = Query(None, pattern=r"^(beginner|intermediate|advanced|expert)$"),
    min_rating: Optional[float] = Query(None, ge=0, le=10),
    max_rating: Optional[float] = Query(None, ge=0, le=10),
    tag_ids: Optional[List[int]] = Query(None),
    country: Optional[str] = Query(None, max_length=100),
    region: Optional[str] = Query(None, max_length=100),
    my_dive_sites: Optional[bool] = Query(None, description="Filter to show only dive sites created by the current user"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get total count of dive sites matching the filters"""
    query = db.query(DiveSite)

    # Apply my_dive_sites filtering
    if my_dive_sites and current_user:
        query = query.filter(DiveSite.created_by == current_user.id)

    # Apply filters with input validation
    if name:
        sanitized_name = name.strip()[:100]
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))

    if difficulty_level:
        query = query.filter(DiveSite.difficulty_level == difficulty_level)

    # Apply country filtering
    if country:
        sanitized_country = country.strip()[:100]
        query = query.filter(DiveSite.country.ilike(f"%{sanitized_country}%"))

    # Apply region filtering
    if region:
        sanitized_region = region.strip()[:100]
        query = query.filter(DiveSite.region.ilike(f"%{sanitized_region}%"))

    # Apply tag filtering
    if tag_ids:
        from app.models import DiveSiteTag
        from sqlalchemy import select
        if len(tag_ids) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many tag filters"
            )
        tag_count = len(tag_ids)
        dive_site_ids_with_all_tags = select(DiveSiteTag.dive_site_id).filter(
            DiveSiteTag.tag_id.in_(tag_ids)
        ).group_by(DiveSiteTag.dive_site_id).having(
            func.count(DiveSiteTag.tag_id) == tag_count
        )
        query = query.filter(DiveSite.id.in_(dive_site_ids_with_all_tags))

    # Get total count
    total_count = query.count()

    return {"total": total_count}

@router.post("/", response_model=DiveSiteResponse)
@skip_rate_limit_for_admin("10/minute")
async def create_dive_site(
    request: Request,
    dive_site: DiveSiteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):

    dive_site_data = dive_site.dict()
    dive_site_data['created_by'] = current_user.id

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
@skip_rate_limit_for_admin("200/minute")
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
    response_data = {
        **dive_site.__dict__,
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
@skip_rate_limit_for_admin("100/minute")
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
@skip_rate_limit_for_admin("20/minute")
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
@skip_rate_limit_for_admin("20/minute")
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
@skip_rate_limit_for_admin("100/minute")
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
@skip_rate_limit_for_admin("10/minute")
async def add_diving_center_to_dive_site(
    request: Request,
    dive_site_id: int,
    center_assignment: CenterDiveSiteCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Add a diving center to a dive site (admin only)"""

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
@skip_rate_limit_for_admin("10/minute")
async def remove_diving_center_from_dive_site(
    request: Request,
    dive_site_id: int,
    diving_center_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Remove a diving center from a dive site (admin only)"""

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
@skip_rate_limit_for_admin("20/minute")
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

    return {
        **dive_site.__dict__,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "tags": tags_dict
    }

@router.delete("/{dive_site_id}")
@skip_rate_limit_for_admin("10/minute")
async def delete_dive_site(
    request: Request,
    dive_site_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):

    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )

    db.delete(dive_site)
    db.commit()

    return {"message": "Dive site deleted successfully"}

@router.post("/{dive_site_id}/rate", response_model=SiteRatingResponse)
@skip_rate_limit_for_admin("10/minute")
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
@skip_rate_limit_for_admin("100/minute")
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
@skip_rate_limit_for_admin("5/minute")
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
@skip_rate_limit_for_admin("100/minute")
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
            id, name, description, difficulty_level, latitude, longitude,
            address, access_instructions, safety_information, marine_life,
            created_at, updated_at,
            (6371 * acos(
                cos(radians(:lat)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians(:lng)) +
                sin(radians(:lat)) * sin(radians(latitude))
            )) AS distance_km
        FROM dive_sites
        WHERE id != :site_id
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
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
            "difficulty_level": row.difficulty_level if row.difficulty_level else None,
            "latitude": float(row.latitude) if row.latitude else None,
            "longitude": float(row.longitude) if row.longitude else None,
            "address": row.address,
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
@skip_rate_limit_for_admin("100/minute")
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
                    "address": dive_site.address,
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
            "difficulty_level": dive.difficulty_level,
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