import pytest
from datetime import date
from sqlalchemy.orm import Session
from app.models import User, UserGearProfile

def test_create_and_retrieve_user_gear_profile(db_session: Session, test_user: User):
    profile = UserGearProfile(
        user_id=test_user.id,
        name="Mediterranean 5mm",
        is_default=True,
        preferred_unit_system="METRIC",
        preferred_shoe_system="EU",
        height_cm=180,
        weight_kg=75,
        shoe_size_eu=43.0,
        wetsuit_gender="MEN",
        wetsuit_size="L",
        wetsuit_thickness="5mm",
        bcd_size="M",
        fin_type="OPEN_HEEL",
        regulator_fitting="DIN",
        preferred_tank_id="12",
        preferred_gas_mix_id="air",
        estimated_lead_kg=4.0,
        has_own_dive_computer=True,
        has_own_smb=True,
        insurance_provider="DAN Europe",
        insurance_policy_number="12345678",
        insurance_expiry_date=date(2027, 6, 30),
        emergency_contact_name="Sarah Connor",
        emergency_contact_phone="+1234567890",
        emergency_contact_relation="Spouse",
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)
    
    assert profile.id is not None
    assert profile.user_id == test_user.id
    assert profile.name == "Mediterranean 5mm"
    assert profile.is_default is True
    assert profile.preferred_tank_id == "12"
    assert profile.insurance_provider == "DAN Europe"
    assert profile.has_own_dive_computer is True
    assert profile.has_own_smb is True
    assert len(test_user.gear_profiles) == 1
    assert test_user.gear_profiles[0].id == profile.id
