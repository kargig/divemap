from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserCertification, User, DivingOrganization
from app.schemas import (
    UserCertificationCreate, UserCertificationUpdate, UserCertificationResponse
)
from app.auth import get_current_active_user, get_current_user_optional

router = APIRouter()

@router.get("/my-certifications", response_model=List[UserCertificationResponse])
async def get_my_certifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's certifications."""
    certifications = db.query(UserCertification).filter(
        UserCertification.user_id == current_user.id
    ).all()
    return certifications

@router.get("/users/{user_id}/certifications", response_model=List[UserCertificationResponse])
async def get_user_certifications(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Get certifications for a specific user (public endpoint)."""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    certifications = db.query(UserCertification).filter(
        UserCertification.user_id == user_id,
        UserCertification.is_active == True
    ).all()
    return certifications

@router.post("/my-certifications", response_model=UserCertificationResponse)
async def create_my_certification(
    certification: UserCertificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new certification for the current user."""
    # Check if diving organization exists
    organization = db.query(DivingOrganization).filter(
        DivingOrganization.id == certification.diving_organization_id
    ).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    # Check if certification already exists for this user and organization
    existing_cert = db.query(UserCertification).filter(
        UserCertification.user_id == current_user.id,
        UserCertification.diving_organization_id == certification.diving_organization_id,
        UserCertification.certification_level == certification.certification_level
    ).first()
    if existing_cert:
        raise HTTPException(status_code=400, detail="Certification already exists for this organization and level")

    db_certification = UserCertification(**certification.dict(), user_id=current_user.id)
    db.add(db_certification)
    db.commit()
    db.refresh(db_certification)
    return db_certification

@router.put("/my-certifications/{certification_id}", response_model=UserCertificationResponse)
async def update_my_certification(
    certification_id: int,
    certification: UserCertificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a certification for the current user."""
    db_certification = db.query(UserCertification).filter(
        UserCertification.id == certification_id,
        UserCertification.user_id == current_user.id
    ).first()
    if not db_certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    # Check if diving organization exists if being updated
    if certification.diving_organization_id:
        organization = db.query(DivingOrganization).filter(
            DivingOrganization.id == certification.diving_organization_id
        ).first()
        if not organization:
            raise HTTPException(status_code=404, detail="Diving organization not found")

    # Update fields
    update_data = certification.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_certification, field, value)

    db.commit()
    db.refresh(db_certification)
    return db_certification

@router.delete("/my-certifications/{certification_id}")
async def delete_my_certification(
    certification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a certification for the current user."""
    db_certification = db.query(UserCertification).filter(
        UserCertification.id == certification_id,
        UserCertification.user_id == current_user.id
    ).first()
    if not db_certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    db.delete(db_certification)
    db.commit()
    return {"message": "Certification deleted successfully"}

@router.patch("/my-certifications/{certification_id}/toggle")
async def toggle_certification_status(
    certification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle the active status of a certification."""
    db_certification = db.query(UserCertification).filter(
        UserCertification.id == certification_id,
        UserCertification.user_id == current_user.id
    ).first()
    if not db_certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    db_certification.is_active = not db_certification.is_active
    db.commit()
    db.refresh(db_certification)

    return {
        "message": f"Certification {'activated' if db_certification.is_active else 'deactivated'} successfully",
        "is_active": db_certification.is_active
    }