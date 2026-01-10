import re
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import DivingOrganization, CertificationLevel
from app.schemas import (
    DivingOrganizationCreate, DivingOrganizationUpdate, DivingOrganizationResponse,
    CertificationLevelResponse, CertificationLevelCreate, CertificationLevelUpdate
)
from app.auth import get_current_admin_user, get_current_user_optional, is_admin_or_moderator

router = APIRouter()

def get_depth_value(depth_str: Optional[str]) -> int:
    """Extract maximum depth value from string for sorting. Returns 999 if no depth found."""
    if not depth_str:
        return 999
    
    # Extract all numbers
    matches = re.findall(r'(\d+)', depth_str)
    if matches:
        # Return the largest number found (e.g. "18-40m" -> 40)
        return max(int(m) for m in matches)
    
    return 999

def get_gas_value(gas_str: Optional[str]) -> int:
    """Calculate gas difficulty score."""
    if not gas_str:
        return 0 # Air/Default
    
    gas_str = gas_str.lower()
    if 'hypoxic' in gas_str:
        return 4
    if 'trimix' in gas_str or 'helitrox' in gas_str or 'triox' in gas_str:
        return 3
    if 'nitrox' in gas_str or 'oxygen' in gas_str or 'o2' in gas_str or 'safeair' in gas_str:
        return 2
    return 1 # Explicit Air or other simple gas

def get_category_score(category: Optional[str]) -> int:
    """
    Calculate category sort score based on keywords.
    Order: Recreational/General -> Specialties/Nitrox -> Technical -> Cave -> Professional
    """
    if not category:
        return 1 # Default to lowest/general
    
    cat = category.lower()
    
    # Professional (Highest)
    if any(k in cat for k in ['professional', 'instructor', 'dive guide', 'divemaster', 'assistant']):
        return 5
    
    # Cave (Higher than Tech usually, or specific track)
    if 'cave' in cat:
        return 4
        
    # Technical
    if any(k in cat for k in ['technical', 'tec', 'extended range', 'rebreather', 'ccr']):
        return 3
        
    # Specialties / Nitrox
    if any(k in cat for k in ['specialt', 'nitrox', 'safeair']):
        return 2
        
    # Recreational / General (Default)
    return 1

def get_org_by_id_or_name(db: Session, identifier: str) -> Optional[DivingOrganization]:
    """Helper to find an organization by ID, name, or acronym."""
    if identifier.isdigit():
        return db.query(DivingOrganization).filter(DivingOrganization.id == int(identifier)).first()
    
    # Try case-insensitive match for name or acronym
    return db.query(DivingOrganization).filter(
        or_(
            DivingOrganization.name == identifier,
            DivingOrganization.acronym == identifier
        )
    ).first()

@router.get("/", response_model=List[DivingOrganizationResponse])
async def get_diving_organizations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all diving organizations."""
    organizations = db.query(DivingOrganization).offset(skip).limit(limit).all()
    return organizations

@router.get("/{identifier}", response_model=DivingOrganizationResponse)
async def get_diving_organization(
    identifier: str,
    db: Session = Depends(get_db)
):
    """Get a specific diving organization by ID, name, or acronym."""
    organization = get_org_by_id_or_name(db, identifier)
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")
    
    # Increment view count without updating updated_at
    db.query(DivingOrganization).filter(DivingOrganization.id == organization.id).update(
        {
            DivingOrganization.view_count: DivingOrganization.view_count + 1,
            DivingOrganization.updated_at: DivingOrganization.updated_at
        },
        synchronize_session=False
    )
    db.commit()
    db.refresh(organization)
    
    return organization

@router.get("/{identifier}/levels", response_model=List[CertificationLevelResponse])
async def get_organization_certification_levels(
    identifier: str,
    db: Session = Depends(get_db)
):
    """Get certification levels for a specific diving organization (by ID or name)."""
    organization = get_org_by_id_or_name(db, identifier)
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")
    
    levels = db.query(CertificationLevel).filter(
        CertificationLevel.diving_organization_id == organization.id
    ).all()
    
    # Sort levels by Category -> Depth -> Gas
    levels.sort(key=lambda l: (
        get_category_score(l.category), 
        get_depth_value(l.max_depth), 
        get_gas_value(l.gases)
    ))
    
    return levels

@router.post("/{identifier}/levels", response_model=CertificationLevelResponse)
async def create_certification_level(
    identifier: str,
    level_data: CertificationLevelCreate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_admin_or_moderator)
):
    """Create a new certification level for an organization."""
    organization = get_org_by_id_or_name(db, identifier)
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")
    
    # Ensure the organization ID in the body matches the URL (or override it)
    if level_data.diving_organization_id != organization.id:
        level_data.diving_organization_id = organization.id

    new_level = CertificationLevel(**level_data.model_dump())
    db.add(new_level)
    db.commit()
    db.refresh(new_level)
    return new_level

@router.put("/{identifier}/levels/{level_id}", response_model=CertificationLevelResponse)
async def update_certification_level(
    identifier: str,
    level_id: int,
    level_data: CertificationLevelUpdate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_admin_or_moderator)
):
    """Update a certification level."""
    organization = get_org_by_id_or_name(db, identifier)
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    level = db.query(CertificationLevel).filter(
        CertificationLevel.id == level_id,
        CertificationLevel.diving_organization_id == organization.id
    ).first()
    
    if not level:
        raise HTTPException(status_code=404, detail="Certification level not found for this organization")

    update_data = level_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(level, field, value)

    db.commit()
    db.refresh(level)
    return level

@router.delete("/{identifier}/levels/{level_id}")
async def delete_certification_level(
    identifier: str,
    level_id: int,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_admin_or_moderator)
):
    """Delete a certification level."""
    organization = get_org_by_id_or_name(db, identifier)
    if not organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    level = db.query(CertificationLevel).filter(
        CertificationLevel.id == level_id,
        CertificationLevel.diving_organization_id == organization.id
    ).first()

    if not level:
        raise HTTPException(status_code=404, detail="Certification level not found for this organization")

    db.delete(level)
    db.commit()
    return {"message": "Certification level deleted successfully"}

@router.post("/", response_model=DivingOrganizationResponse)
async def create_diving_organization(
    organization: DivingOrganizationCreate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_admin_or_moderator)
):
    """Create a new diving organization (admin/moderator only)."""
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

    db_organization = DivingOrganization(**organization.model_dump())
    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)
    return db_organization

@router.put("/{organization_id}", response_model=DivingOrganizationResponse)
async def update_diving_organization(
    organization_id: int,
    organization: DivingOrganizationUpdate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_admin_or_moderator)
):
    """Update a diving organization (admin/moderator only)."""
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
    update_data = organization.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_organization, field, value)

    db.commit()
    db.refresh(db_organization)
    return db_organization

@router.delete("/{organization_id}")
async def delete_diving_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_admin_or_moderator)
):
    """Delete a diving organization (admin/moderator only)."""
    db_organization = db.query(DivingOrganization).filter(DivingOrganization.id == organization_id).first()
    if not db_organization:
        raise HTTPException(status_code=404, detail="Diving organization not found")

    db.delete(db_organization)
    db.commit()
    return {"message": "Diving organization deleted successfully"}