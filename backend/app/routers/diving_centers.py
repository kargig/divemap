from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.database import get_db
from app.models import DivingCenter, CenterRating, CenterComment, User, CenterDiveSite, GearRentalCost, DivingCenterOrganization, DivingOrganization, UserCertification
from app.schemas import (
    DivingCenterCreate, DivingCenterUpdate, DivingCenterResponse, 
    CenterRatingCreate, CenterRatingResponse,
    CenterCommentCreate, CenterCommentUpdate, CenterCommentResponse,
    DivingCenterSearchParams, CenterDiveSiteCreate, GearRentalCostCreate,
    DivingCenterOrganizationCreate, DivingCenterOrganizationUpdate, DivingCenterOrganizationResponse,
    DivingCenterOwnershipClaim, DivingCenterOwnershipResponse, DivingCenterOwnershipApproval
)
from app.auth import get_current_active_user, get_current_admin_user, get_current_user_optional, is_admin_or_moderator
from app.models import OwnershipStatus

router = APIRouter()

@router.get("/count")
async def get_diving_centers_count(
    search_params: DivingCenterSearchParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get total count of diving centers matching the filters."""
    query = db.query(DivingCenter)
    
    # Apply filters
    if search_params.name:
        query = query.filter(DivingCenter.name.ilike(f"%{search_params.name}%"))
    
    # Get total count
    total_count = query.count()
    
    return {"total": total_count}

@router.get("/", response_model=List[DivingCenterResponse])
async def get_diving_centers(
    search_params: DivingCenterSearchParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    query = db.query(DivingCenter)
    
    # Apply filters
    if search_params.name:
        query = query.filter(DivingCenter.name.ilike(f"%{search_params.name}%"))
    
    # Get diving centers with average ratings
    diving_centers = query.offset(search_params.offset).limit(search_params.limit).all()
    
    # Calculate average ratings
    result = []
    for center in diving_centers:
        avg_rating = db.query(func.avg(CenterRating.score)).filter(
            CenterRating.diving_center_id == center.id
        ).scalar()
        
        total_ratings = db.query(func.count(CenterRating.id)).filter(
            CenterRating.diving_center_id == center.id
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
            "created_at": center.created_at,
            "updated_at": center.updated_at,
            "average_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings
        }
        
        # Only include view_count for admin users
        if current_user and current_user.is_admin:
            center_dict["view_count"] = center.view_count
        
        result.append(center_dict)
    
    # Apply rating filters
    if search_params.min_rating is not None:
        result = [center for center in result if center["average_rating"] and center["average_rating"] >= search_params.min_rating]
    
    if search_params.max_rating is not None:
        result = [center for center in result if center["average_rating"] and center["average_rating"] <= search_params.max_rating]
    
    return result

@router.post("/", response_model=DivingCenterResponse)
async def create_diving_center(
    diving_center: DivingCenterCreate,
    current_user: User = Depends(is_admin_or_moderator),
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
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all diving centers with ownership requests (admin only)"""
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
        (diving_center.owner_id == current_user.id and diving_center.ownership_status == "approved")
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
    
    return {
        "id": diving_center.id,
        "name": diving_center.name,
        "description": diving_center.description,
        "email": diving_center.email,
        "phone": diving_center.phone,
        "website": diving_center.website,
        "latitude": diving_center.latitude,
        "longitude": diving_center.longitude,
        "created_at": diving_center.created_at,
        "updated_at": diving_center.updated_at,
        "average_rating": float(avg_rating) if avg_rating else None,
        "total_ratings": total_ratings
    }

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
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
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
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diving center not found"
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
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Add an organization to a diving center (admin only)."""
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
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
    """Update an organization association for a diving center (admin only)."""
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
    current_user: User = Depends(is_admin_or_moderator),
    db: Session = Depends(get_db)
):
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
    
    # Update diving center ownership status
    diving_center.ownership_status = "claimed"
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
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Approve or deny ownership claim for a diving center (admin only)"""
    # Check if diving center exists
    diving_center = db.query(DivingCenter).filter(DivingCenter.id == diving_center_id).first()
    if not diving_center:
        raise HTTPException(status_code=404, detail="Diving center not found")
    
    if approval.approved:
        # Approve the ownership claim
        diving_center.ownership_status = "approved"
        message = "Ownership claim approved successfully"
    else:
        # Deny the ownership claim
        diving_center.ownership_status = "unclaimed"
        diving_center.owner_id = None
        message = "Ownership claim denied"
    
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
    current_user: User = Depends(get_current_admin_user),
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
    diving_center.ownership_status = "approved"
    
    db.commit()
    db.refresh(diving_center)
    
    return {
        "message": f"User {user.username} assigned as owner of {diving_center.name}",
        "diving_center_id": diving_center_id,
        "owner_id": user_id,
        "status": "approved"
    } 