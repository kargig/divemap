from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

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

router = APIRouter()

@router.get("/", response_model=List[DiveSiteResponse])
async def get_dive_sites(
    name: Optional[str] = Query(None),
    difficulty_level: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None, ge=0, le=10),
    max_rating: Optional[float] = Query(None, ge=0, le=10),
    tag_ids: Optional[List[int]] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(DiveSite)
    
    # Apply filters
    if name:
        query = query.filter(DiveSite.name.ilike(f"%{name}%"))
    
    if difficulty_level:
        query = query.filter(DiveSite.difficulty_level == difficulty_level)
    
    # Apply tag filtering
    if tag_ids:
        from app.models import DiveSiteTag
        from sqlalchemy import select
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
            "tags": tags
        }
        result.append(site_dict)
    
    # Apply rating filters
    if min_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] >= min_rating]
    
    if max_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] <= max_rating]
    
    return result

@router.post("/", response_model=DiveSiteResponse)
async def create_dive_site(
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
        "total_ratings": 0
    }

@router.get("/{dive_site_id}", response_model=DiveSiteResponse)
async def get_dive_site(
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
        "tags": tags,
        "user_rating": user_rating
    }

@router.get("/{dive_site_id}/media", response_model=List[SiteMediaResponse])
async def get_dive_site_media(dive_site_id: int, db: Session = Depends(get_db)):
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
async def add_dive_site_media(
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
async def delete_dive_site_media(
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
async def get_dive_site_diving_centers(dive_site_id: int, db: Session = Depends(get_db)):
    """Get all diving centers associated with a dive site"""
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )
    
    centers = db.query(DivingCenter, CenterDiveSite.dive_cost).join(
        CenterDiveSite, DivingCenter.id == CenterDiveSite.diving_center_id
    ).filter(CenterDiveSite.dive_site_id == dive_site_id).all()
    
    result = []
    for center, dive_cost in centers:
        center_dict = {
            "id": center.id,
            "name": center.name,
            "description": center.description,
            "email": center.email,
            "phone": center.phone,
            "website": center.website,
            "latitude": center.latitude,
            "longitude": center.longitude,
            "dive_cost": dive_cost
        }
        result.append(center_dict)
    
    return result

@router.post("/{dive_site_id}/diving-centers")
async def add_diving_center_to_dive_site(
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
        dive_cost=center_assignment.dive_cost
    )
    db.add(db_association)
    db.commit()
    db.refresh(db_association)
    
    return {
        "id": db_association.id,
        "dive_site_id": dive_site_id,
        "diving_center_id": center_assignment.diving_center_id,
        "dive_cost": center_assignment.dive_cost,
        "created_at": db_association.created_at
    }

@router.delete("/{dive_site_id}/diving-centers/{diving_center_id}")
async def remove_diving_center_from_dive_site(
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
async def update_dive_site(
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
    
    return {
        **dive_site.__dict__,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings
    }

@router.delete("/{dive_site_id}")
async def delete_dive_site(
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
async def rate_dive_site(
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
async def get_dive_site_comments(
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
async def create_dive_site_comment(
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