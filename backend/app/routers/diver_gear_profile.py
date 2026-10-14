import logging
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models import User, UserGearProfile
from app.constants.cylinders import TANK_SIZES, GAS_MIXES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bookings", tags=["Diver Gear Profile & Bookings"])

class UserGearProfileSchema(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int] = None
    name: str = "Default"
    is_default: bool = False
    preferred_unit_system: str = "METRIC"
    preferred_shoe_system: str = "EU"
    height_cm: Optional[int] = None
    weight_kg: Optional[float] = None
    shoe_size_eu: Optional[float] = None
    wetsuit_gender: Optional[str] = None
    wetsuit_size: Optional[str] = None
    wetsuit_thickness: Optional[str] = "5mm"
    bcd_size: Optional[str] = None
    fin_type: Optional[str] = "OPEN_HEEL"
    regulator_fitting: Optional[str] = "DIN"
    preferred_tank_id: Optional[str] = "12"
    preferred_gas_mix_id: Optional[str] = "air"
    estimated_lead_kg: Optional[float] = None
    has_own_mask: bool = True
    has_own_wetsuit: bool = False
    has_own_regulator: bool = False
    has_own_bcd: bool = False
    has_own_fins: bool = False
    has_own_boots: bool = False
    has_own_torch: bool = False
    has_own_lead_weights: bool = False
    has_own_dive_computer: bool = False
    has_own_smb: bool = False
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_expiry_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    class Config:
        from_attributes = True

class UserGearProfileCreateSchema(BaseModel):
    name: str = "Default"
    is_default: Optional[bool] = False
    preferred_unit_system: Optional[str] = "METRIC"
    preferred_shoe_system: Optional[str] = "EU"
    height_cm: Optional[int] = None
    weight_kg: Optional[float] = None
    shoe_size_eu: Optional[float] = None
    wetsuit_gender: Optional[str] = None
    wetsuit_size: Optional[str] = None
    wetsuit_thickness: Optional[str] = "5mm"
    bcd_size: Optional[str] = None
    fin_type: Optional[str] = "OPEN_HEEL"
    regulator_fitting: Optional[str] = "DIN"
    preferred_tank_id: Optional[str] = "12"
    preferred_gas_mix_id: Optional[str] = "air"
    estimated_lead_kg: Optional[float] = None
    has_own_mask: Optional[bool] = True
    has_own_wetsuit: Optional[bool] = False
    has_own_regulator: Optional[bool] = False
    has_own_bcd: Optional[bool] = False
    has_own_fins: Optional[bool] = False
    has_own_boots: Optional[bool] = False
    has_own_torch: Optional[bool] = False
    has_own_lead_weights: Optional[bool] = False
    has_own_dive_computer: Optional[bool] = False
    has_own_smb: Optional[bool] = False
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_expiry_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

class UserGearProfileUpdateSchema(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None
    preferred_unit_system: Optional[str] = None
    preferred_shoe_system: Optional[str] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[float] = None
    shoe_size_eu: Optional[float] = None
    wetsuit_gender: Optional[str] = None
    wetsuit_size: Optional[str] = None
    wetsuit_thickness: Optional[str] = None
    bcd_size: Optional[str] = None
    fin_type: Optional[str] = None
    regulator_fitting: Optional[str] = None
    preferred_tank_id: Optional[str] = None
    preferred_gas_mix_id: Optional[str] = None
    estimated_lead_kg: Optional[float] = None
    has_own_mask: Optional[bool] = None
    has_own_wetsuit: Optional[bool] = None
    has_own_regulator: Optional[bool] = None
    has_own_bcd: Optional[bool] = None
    has_own_fins: Optional[bool] = None
    has_own_boots: Optional[bool] = None
    has_own_torch: Optional[bool] = None
    has_own_lead_weights: Optional[bool] = None
    has_own_dive_computer: Optional[bool] = None
    has_own_smb: Optional[bool] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_expiry_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

@router.get("/gear-profiles", response_model=List[UserGearProfileSchema])
def list_my_gear_profiles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all saved gear profiles for current user."""
    profiles = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).order_by(UserGearProfile.is_default.desc(), UserGearProfile.id.asc()).all()
    if not profiles:
        # Create a default profile automatically
        default_prof = UserGearProfile(user_id=current_user.id, name="Default", is_default=True)
        db.add(default_prof)
        db.commit()
        db.refresh(default_prof)
        return [default_prof]
    return profiles

@router.post("/gear-profiles", response_model=UserGearProfileSchema, status_code=status.HTTP_201_CREATED)
def create_gear_profile(
    profile_in: UserGearProfileCreateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new named gear profile."""
    existing = db.query(UserGearProfile).filter(
        UserGearProfile.user_id == current_user.id,
        UserGearProfile.name == profile_in.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A gear profile named '{profile_in.name}' already exists.")

    is_first = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).count() == 0
    make_default = profile_in.is_default or is_first

    if make_default:
        # Clear existing default
        db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).update({"is_default": False})

    new_profile = UserGearProfile(
        user_id=current_user.id,
        **profile_in.model_dump(exclude={"is_default"}),
        is_default=make_default
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile

@router.get("/gear-profiles/{profile_id}", response_model=UserGearProfileSchema)
def get_gear_profile_by_id(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(
        UserGearProfile.id == profile_id,
        UserGearProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Gear profile not found")
    return profile

@router.put("/gear-profiles/{profile_id}", response_model=UserGearProfileSchema)
def update_gear_profile_by_id(
    profile_id: int,
    profile_in: UserGearProfileUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(
        UserGearProfile.id == profile_id,
        UserGearProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Gear profile not found")

    update_data = profile_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != profile.name:
        existing = db.query(UserGearProfile).filter(
            UserGearProfile.user_id == current_user.id,
            UserGearProfile.name == update_data["name"]
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"A gear profile named '{update_data['name']}' already exists.")

    if update_data.get("is_default") is True:
        db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).update({"is_default": False})

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile

@router.delete("/gear-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gear_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(
        UserGearProfile.id == profile_id,
        UserGearProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Gear profile not found")

    count = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete your only gear profile.")

    was_default = profile.is_default
    db.delete(profile)
    db.commit()

    if was_default:
        # Designate remaining profile as default
        fallback = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).first()
        if fallback:
            fallback.is_default = True
            db.commit()

@router.post("/gear-profiles/{profile_id}/set-default", response_model=UserGearProfileSchema)
def set_default_gear_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(
        UserGearProfile.id == profile_id,
        UserGearProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Gear profile not found")

    db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).update({"is_default": False})
    profile.is_default = True
    db.commit()
    db.refresh(profile)
    return profile

# Backward-compatible convenience endpoints for primary profile
@router.get("/my-gear-profile", response_model=UserGearProfileSchema)
def get_my_gear_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(
        UserGearProfile.user_id == current_user.id,
        UserGearProfile.is_default == True
    ).first()
    if not profile:
        profile = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).first()
    if not profile:
        return UserGearProfileSchema(user_id=current_user.id, name="Default", is_default=True)
    return profile

@router.put("/my-gear-profile", response_model=UserGearProfileSchema)
def update_my_gear_profile(
    profile_in: UserGearProfileUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(
        UserGearProfile.user_id == current_user.id,
        UserGearProfile.is_default == True
    ).first()
    if not profile:
        profile = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserGearProfile(user_id=current_user.id, name="Default", is_default=True)
        db.add(profile)

    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile

@router.get("/cylinders", response_model=List[Dict[str, Any]])
def get_cylinders():
    """Returns canonical cylinder types and dimensions."""
    return TANK_SIZES

@router.get("/gas-mixes", response_model=List[Dict[str, Any]])
def get_gas_mixes():
    """Returns canonical breathing gas mixes."""
    return GAS_MIXES
