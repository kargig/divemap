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

class UserGearProfileUpdateSchema(BaseModel):
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
    has_own_dive_computer: Optional[bool] = False
    has_own_smb: Optional[bool] = False
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_expiry_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

@router.get("/my-gear-profile", response_model=UserGearProfileSchema)
def get_my_gear_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).first()
    if not profile:
        # Return default profile values without saving to database yet
        return UserGearProfileSchema(user_id=current_user.id)
    return profile

@router.put("/my-gear-profile", response_model=UserGearProfileSchema)
def update_my_gear_profile(
    profile_in: UserGearProfileUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserGearProfile).filter(UserGearProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserGearProfile(user_id=current_user.id)
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
