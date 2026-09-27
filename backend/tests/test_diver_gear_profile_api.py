import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import User, UserGearProfile
from app.auth import create_access_token

def test_unauthenticated_access_denied(client: TestClient):
    response = client.get("/api/v1/bookings/my-gear-profile")
    assert response.status_code in (401, 403)

def test_get_empty_gear_profile_defaults(client: TestClient, test_user: User):
    token = create_access_token({"sub": test_user.username})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get("/api/v1/bookings/my-gear-profile", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["preferred_unit_system"] == "METRIC"
    assert data["preferred_tank_id"] == "12"
    assert data["height_cm"] is None

def test_create_and_update_gear_profile(client: TestClient, test_user: User):
    token = create_access_token({"sub": test_user.username})
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "preferred_unit_system": "METRIC",
        "preferred_shoe_system": "EU",
        "height_cm": 182,
        "weight_kg": 78.5,
        "shoe_size_eu": 43.5,
        "wetsuit_gender": "MEN",
        "wetsuit_size": "L",
        "wetsuit_thickness": "5mm",
        "bcd_size": "M",
        "fin_type": "OPEN_HEEL",
        "regulator_fitting": "DIN",
        "preferred_tank_id": "15",
        "preferred_gas_mix_id": "ean32",
        "estimated_lead_kg": 4.0,
        "has_own_dive_computer": True,
        "has_own_smb": True,
        "insurance_provider": "DAN Europe",
        "insurance_policy_number": "POL-987654",
        "emergency_contact_name": "Sarah Connor",
        "emergency_contact_phone": "+306912345678",
        "emergency_contact_relation": "Partner",
    }
    
    # PUT to create/update
    response = client.put("/api/v1/bookings/my-gear-profile", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["height_cm"] == 182
    assert data["preferred_tank_id"] == "15"
    assert data["insurance_provider"] == "DAN Europe"
    assert data["has_own_dive_computer"] is True
    
    # GET to verify persistence
    get_response = client.get("/api/v1/bookings/my-gear-profile", headers=headers)
    assert get_response.status_code == 200
    get_data = get_response.json()
    assert get_data["height_cm"] == 182
    assert get_data["emergency_contact_name"] == "Sarah Connor"

def test_get_cylinders_and_gas_mixes(client: TestClient):
    res_cyl = client.get("/api/v1/bookings/cylinders")
    assert res_cyl.status_code == 200
    cylinders = res_cyl.json()
    assert isinstance(cylinders, list)
    assert any(c["id"] == "12" for c in cylinders)
    assert any(c["id"] == "15" for c in cylinders)
    
    res_gas = client.get("/api/v1/bookings/gas-mixes")
    assert res_gas.status_code == 200
    gases = res_gas.json()
    assert isinstance(gases, list)
    assert any(g["id"] == "air" for g in gases)
    assert any(g["id"] == "ean32" for g in gases)
