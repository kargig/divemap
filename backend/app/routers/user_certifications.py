from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_current_active_user, get_current_user_optional
from app.database import get_db
from app.models import DivingOrganization, User, UserCertification
from app.schemas import (
    UserCertificationCreate,
    UserCertificationPublicResponse,
    UserCertificationResponse,
    UserCertificationUpdate,
)
from app.services.entity_audit_service import log_entity_mutation

router = APIRouter()


@router.get("/my-certifications", response_model=list[UserCertificationResponse])
async def get_my_certifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """Get current user's certifications."""
    certifications = (
        db.query(UserCertification)
        .filter(UserCertification.user_id == current_user.id)
        .all()
    )
    return certifications


@router.get(
    "/users/{user_id}/certifications",
    response_model=list[UserCertificationPublicResponse],
)
async def get_user_certifications(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Get certifications for a specific user (public endpoint; no card_id)."""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    certifications = (
        db.query(UserCertification)
        .filter(
            UserCertification.user_id == user_id, UserCertification.is_active == True
        )
        .all()
    )
    return certifications


@router.post("/my-certifications", response_model=UserCertificationResponse)
async def create_my_certification(
    certification: UserCertificationCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new certification for the current user."""
    # Check if diving organization exists
    organization = (
        db.query(DivingOrganization)
        .filter(DivingOrganization.id == certification.diving_organization_id)
        .first()
    )
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    # Construct duplicate check filter
    # Check if certification already exists for this user and organization
    query = db.query(UserCertification).filter(
        UserCertification.user_id == current_user.id,
        UserCertification.diving_organization_id
        == certification.diving_organization_id,
    )

    if certification.certification_level_id:
        # If using structured level ID
        from app.models import CertificationLevel

        # Verify level exists
        level = (
            db.query(CertificationLevel)
            .filter(
                CertificationLevel.id == certification.certification_level_id,
                CertificationLevel.diving_organization_id
                == certification.diving_organization_id,
            )
            .first()
        )
        if not level:
            raise HTTPException(
                status_code=400,
                detail="Invalid certification level for this organization",
            )

        # Check duplicate
        query = query.filter(
            UserCertification.certification_level_id
            == certification.certification_level_id
        )

        # Auto-fill text field for backward compatibility if empty
        if not certification.certification_level:
            certification.certification_level = level.name

    elif certification.certification_level:
        # Fallback to text matching
        query = query.filter(
            UserCertification.certification_level == certification.certification_level
        )
    else:
        raise HTTPException(
            status_code=400, detail="Certification level or ID is required"
        )

    if query.first():
        raise HTTPException(
            status_code=400,
            detail="Certification already exists for this organization and level",
        )

    db_certification = UserCertification(
        **certification.model_dump(), user_id=current_user.id
    )
    db.add(db_certification)
    db.flush()
    log_entity_mutation(
        db,
        "user_certification",
        db_certification.id,
        "create",
        current_user,
        request=request,
        after_state=certification.model_dump(),
    )
    db.commit()
    db.refresh(db_certification)
    return db_certification


@router.put(
    "/my-certifications/{certification_id}", response_model=UserCertificationResponse
)
async def update_my_certification(
    certification_id: int,
    certification: UserCertificationUpdate,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a certification for the current user."""
    db_certification = (
        db.query(UserCertification)
        .filter(
            UserCertification.id == certification_id,
            UserCertification.user_id == current_user.id,
        )
        .first()
    )
    if not db_certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    # Check if diving organization exists if being updated
    if certification.diving_organization_id:
        organization = (
            db.query(DivingOrganization)
            .filter(DivingOrganization.id == certification.diving_organization_id)
            .first()
        )
        if not organization:
            raise HTTPException(status_code=404, detail="Diving organization not found")

    # If updating certification level ID, verify it exists and belongs to the org
    if certification.certification_level_id:
        from app.models import CertificationLevel

        # Use new org ID if provided, otherwise existing
        org_id = (
            certification.diving_organization_id
            or db_certification.diving_organization_id
        )

        level = (
            db.query(CertificationLevel)
            .filter(
                CertificationLevel.id == certification.certification_level_id,
                CertificationLevel.diving_organization_id == org_id,
            )
            .first()
        )
        if not level:
            raise HTTPException(
                status_code=400,
                detail="Invalid certification level for this organization",
            )

        # Auto-update text field for backward compatibility
        if not certification.certification_level:
            certification.certification_level = level.name

    update_data = certification.model_dump(exclude_unset=True)
    before_state = {
        field: getattr(db_certification, field)
        for field in update_data.keys()
        if hasattr(db_certification, field)
    }

    # Update fields
    for field, value in update_data.items():
        setattr(db_certification, field, value)

    log_entity_mutation(
        db,
        "user_certification",
        db_certification.id,
        "update",
        current_user,
        request=request,
        before_state=before_state,
        after_state=update_data,
    )

    db.commit()
    db.refresh(db_certification)
    return db_certification


@router.delete("/my-certifications/{certification_id}")
async def delete_my_certification(
    certification_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a certification for the current user."""
    db_certification = (
        db.query(UserCertification)
        .filter(
            UserCertification.id == certification_id,
            UserCertification.user_id == current_user.id,
        )
        .first()
    )
    if not db_certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    before_state = {
        "diving_organization_id": db_certification.diving_organization_id,
        "certification_level": db_certification.certification_level,
        "card_id": db_certification.card_id,
        "certification_date": db_certification.certification_date,
    }
    log_entity_mutation(
        db,
        "user_certification",
        db_certification.id,
        "delete",
        current_user,
        request=request,
        before_state=before_state,
    )

    db.delete(db_certification)
    db.commit()
    return {"message": "Certification deleted successfully"}


@router.patch("/my-certifications/{certification_id}/toggle")
async def toggle_certification_status(
    certification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Toggle the active status of a certification."""
    db_certification = (
        db.query(UserCertification)
        .filter(
            UserCertification.id == certification_id,
            UserCertification.user_id == current_user.id,
        )
        .first()
    )
    if not db_certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    db_certification.is_active = not db_certification.is_active
    db.commit()
    db.refresh(db_certification)

    return {
        "message": f"Certification {'activated' if db_certification.is_active else 'deactivated'} successfully",
        "is_active": db_certification.is_active,
    }
