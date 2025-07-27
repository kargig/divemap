from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from slowapi.util import get_remote_address
from slowapi import Limiter

from app.database import get_db
from app.models import DiveSite, SiteRating, SiteComment, SiteMedia, User, DivingCenter, CenterDiveSite
from app.schemas import (
    DiveSiteCreate, DiveSiteUpdate, DiveSiteResponse, 
    SiteRatingCreate, SiteRatingResponse,
    SiteCommentCreate, SiteCommentUpdate, SiteCommentResponse,
    SiteMediaCreate, SiteMediaResponse,
    DiveSiteSearchParams, CenterDiveSiteCreate
)
from app.auth import get_current_active_user, get_current_admin_user, get_current_user_optional
from app.limiter import limiter

router = APIRouter()

@router.get("/", response_model=List[DiveSiteResponse])
@limiter.limit("100/minute")
async def get_dive_sites(
    request: Request,
    name: Optional[str] = Query(None, max_length=100),
    difficulty_level: Optional[str] = Query(None, pattern=r"^(beginner|intermediate|advanced|expert)$"),
    min_rating: Optional[float] = Query(None, ge=0, le=10),
    max_rating: Optional[float] = Query(None, ge=0, le=10),
    tag_ids: Optional[List[int]] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    
    query = db.query(DiveSite)
    
    # Apply filters with input validation
    if name:
        # Sanitize name input to prevent injection
        sanitized_name = name.strip()[:100]
        query = query.filter(DiveSite.name.ilike(f"%{sanitized_name}%"))
    
    if difficulty_level:
        query = query.filter(DiveSite.difficulty_level == difficulty_level)
    
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
    
    # Get dive sites with average ratings
    dive_sites = query.offset(offset).limit(limit).all()
    
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
        ).all()
        
        # Convert tags to dictionaries
        tags_dict = [
            {
                "id": tag.id,
                "name": tag.name,
                "description": tag.description,
                "created_by": tag.created_by,
                "created_at": tag.created_at
            }
            for tag in tags
        ]
        
        site_dict = {
            "id": site.id,
            "name": site.name,
            "description": site.description,
            "latitude": site.latitude,
            "longitude": site.longitude,
            "address": site.address,
            "access_instructions": site.access_instructions,
            "dive_plans": site.dive_plans,
            "gas_tanks_necessary": site.gas_tanks_necessary,
            "difficulty_level": site.difficulty_level,
            "marine_life": site.marine_life,
            "safety_information": site.safety_information,
            "created_at": site.created_at,
            "updated_at": site.updated_at,
            "average_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings,
            "tags": tags_dict
        }
        result.append(site_dict)
    
    # Apply rating filters
    if min_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] >= min_rating]
    
    if max_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] <= max_rating]
    
    return result

@router.post("/", response_model=DiveSiteResponse)
@limiter.limit("10/minute")
async def create_dive_site(
    request: Request,
    dive_site: DiveSiteCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    
    db_dive_site = DiveSite(**dive_site.dict())
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
@limiter.limit("200/minute")
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
            "created_at": tag.created_at
        }
        for tag in tags
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
    
    return {
        **dive_site.__dict__,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings,
        "tags": tags_dict,
        "user_rating": user_rating
    }

@router.get("/{dive_site_id}/media", response_model=List[SiteMediaResponse])
@limiter.limit("100/minute")
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
@limiter.limit("20/minute")
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
@limiter.limit("20/minute")
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
@limiter.limit("100/minute")
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
@limiter.limit("10/minute")
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
@limiter.limit("10/minute")
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
@limiter.limit("20/minute")
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
            "created_at": tag.created_at
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
@limiter.limit("10/minute")
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
@limiter.limit("10/minute")
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
@limiter.limit("100/minute")
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
    
    comments = db.query(SiteComment, User.username).join(
        User, SiteComment.user_id == User.id
    ).filter(SiteComment.dive_site_id == dive_site_id).all()
    
    result = []
    for comment, username in comments:
        comment_dict = {
            "id": comment.id,
            "dive_site_id": comment.dive_site_id,
            "user_id": comment.user_id,
            "username": username,
            "comment_text": comment.comment_text,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at
        }
        result.append(comment_dict)
    
    return result

@router.post("/{dive_site_id}/comments", response_model=SiteCommentResponse)
@limiter.limit("5/minute")
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
    
    return {
        **db_comment.__dict__,
        "username": current_user.username
    }

@router.get("/{dive_site_id}/nearby", response_model=List[DiveSiteResponse])
@limiter.limit("100/minute")
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
            dive_plans, gas_tanks_necessary, created_at, updated_at,
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
                "created_at": tag.created_at
            }
            for tag in tags
        ]
        
        site_dict = {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "difficulty_level": row.difficulty_level,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "address": row.address,
            "access_instructions": row.access_instructions,
            "safety_information": row.safety_information,
            "marine_life": row.marine_life,
            "dive_plans": row.dive_plans,
            "gas_tanks_necessary": row.gas_tanks_necessary,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "average_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings,
            "tags": tags_dict,
            "distance_km": round(row.distance_km, 2)
        }
        nearby_sites.append(site_dict)
    
    return nearby_sites 