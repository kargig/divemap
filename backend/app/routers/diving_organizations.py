from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DivingOrganization
from app.schemas import (
    DivingOrganizationCreate, DivingOrganizationUpdate, DivingOrganizationResponse
)
from app.auth import get_current_admin_user, get_current_user_optional

router = APIRouter()

@router.get("/", response_model=List[DivingOrganizationResponse])
async def get_diving_organizations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all diving organizations."""
    organizations = db.query(DivingOrganization).offset(skip).limit(limit).all()
    return organizations

@router.get("/{organization_id}", response_model=DivingOrganizationResponse)
async def get_diving_organization(
    organization_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific diving organization by ID."""
    organization = db.query(DivingOrganization).filter(DivingOrganization.id == organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")
    return organization

@router.post("/", response_model=DivingOrganizationResponse)
async def create_diving_organization(
    organization: DivingOrganizationCreate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Create a new diving organization (admin only)."""
    # Check if organization with same acronym already exists
    existing_org = db.query(DivingOrganization).filter(
        DivingOrganization.acronym == organization.acronym
    ).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization with this acronym already exists")

    # Check if organization with same name already exists
    existing_org = db.query(DivingOrganization).filter(
        DivingOrganization.name == organization.name
    ).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization with this name already exists")

    db_organization = DivingOrganization(**organization.dict())
    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)
    return db_organization

@router.put("/{organization_id}", response_model=DivingOrganizationResponse)
async def update_diving_organization(
    organization_id: int,
    organization: DivingOrganizationUpdate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Update a diving organization (admin only)."""
    db_organization = db.query(DivingOrganization).filter(DivingOrganization.id == organization_id).first()
    if not db_organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    # Check for conflicts if acronym or name is being updated
    if organization.acronym and organization.acronym != db_organization.acronym:
        existing_org = db.query(DivingOrganization).filter(
            DivingOrganization.acronym == organization.acronym
        ).first()
        if existing_org:
            raise HTTPException(status_code=400, detail="Organization with this acronym already exists")

    if organization.name and organization.name != db_organization.name:
        existing_org = db.query(DivingOrganization).filter(
            DivingOrganization.name == organization.name
        ).first()
        if existing_org:
            raise HTTPException(status_code=400, detail="Organization with this name already exists")

    # Update fields
    update_data = organization.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_organization, field, value)

    db.commit()
    db.refresh(db_organization)
    return db_organization

@router.delete("/{organization_id}")
async def delete_diving_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(get_current_admin_user)
):
    """Delete a diving organization (admin only)."""
    db_organization = db.query(DivingOrganization).filter(DivingOrganization.id == organization_id).first()
    if not db_organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    db.delete(db_organization)
    db.commit()
    return {"message": "Diving organization deleted successfully"}