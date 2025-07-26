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
    DiveSiteSearchParams
)
from app.auth import get_current_active_user, get_current_admin_user

router = APIRouter()

@router.get("/", response_model=List[DiveSiteResponse])
async def get_dive_sites(
    search_params: DiveSiteSearchParams = Depends(),
    db: Session = Depends(get_db)
):
    query = db.query(DiveSite)
    
    # Apply filters
    if search_params.name:
        query = query.filter(DiveSite.name.ilike(f"%{search_params.name}%"))
    
    if search_params.difficulty_level:
        query = query.filter(DiveSite.difficulty_level == search_params.difficulty_level)
    
    # Get dive sites with average ratings
    dive_sites = query.offset(search_params.offset).limit(search_params.limit).all()
    
    # Calculate average ratings
    result = []
    for site in dive_sites:
        avg_rating = db.query(func.avg(SiteRating.score)).filter(
            SiteRating.dive_site_id == site.id
        ).scalar()
        
        total_ratings = db.query(func.count(SiteRating.id)).filter(
            SiteRating.dive_site_id == site.id
        ).scalar()
        
        site_dict = {
            "id": site.id,
            "name": site.name,
            "description": site.description,
            "latitude": site.latitude,
            "longitude": site.longitude,
            "access_instructions": site.access_instructions,
            "dive_plans": site.dive_plans,
            "gas_tanks_necessary": site.gas_tanks_necessary,
            "difficulty_level": site.difficulty_level,
            "created_at": site.created_at,
            "updated_at": site.updated_at,
            "average_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings
        }
        result.append(site_dict)
    
    # Apply rating filters
    if search_params.min_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] >= search_params.min_rating]
    
    if search_params.max_rating is not None:
        result = [site for site in result if site["average_rating"] and site["average_rating"] <= search_params.max_rating]
    
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
async def get_dive_site(dive_site_id: int, db: Session = Depends(get_db)):
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
    
    return {
        **dive_site.__dict__,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings
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
    # Check if dive site exists
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dive site not found"
        )
    
    # Get associated diving centers with their dive costs
    centers = db.query(DivingCenter, CenterDiveSite.dive_cost).join(
        CenterDiveSite, DivingCenter.id == CenterDiveSite.diving_center_id
    ).filter(CenterDiveSite.dive_site_id == dive_site_id).all()
    
    result = []
    for center, dive_cost in centers:
        # Calculate average rating for the center
        avg_rating = db.query(func.avg(SiteRating.score)).filter(
            SiteRating.dive_site_id == dive_site_id
        ).scalar()
        
        center_dict = {
            "id": center.id,
            "name": center.name,
            "description": center.description,
            "email": center.email,
            "phone": center.phone,
            "website": center.website,
            "latitude": center.latitude,
            "longitude": center.longitude,
            "dive_cost": float(dive_cost) if dive_cost else None,
            "average_rating": float(avg_rating) if avg_rating else None
        }
        result.append(center_dict)
    
    return result

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