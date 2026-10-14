import pytest
from app.models import UserGearProfile


def test_gear_profile_ownership_model(db_session, test_user):
    profile = UserGearProfile(
        user_id=test_user.id,
        name="Summer 3mm Tropical",
        is_default=True,
        has_own_mask=True,
        has_own_wetsuit=True,
        has_own_regulator=False,
        regulator_fitting="DIN",
        has_own_bcd=False,
        has_own_fins=True,
        has_own_boots=True,
        has_own_torch=False,
        has_own_lead_weights=False,
        has_own_dive_computer=True,
        has_own_smb=True,
        wetsuit_size="M",
        wetsuit_thickness="3mm",
        bcd_size="M",
        shoe_size_eu=43.0,
        estimated_lead_kg=4.0,
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)

    assert profile.id is not None
    assert profile.has_own_mask is True
    assert profile.has_own_wetsuit is True
    assert profile.has_own_regulator is False
    assert profile.regulator_fitting == "DIN"
    assert profile.has_own_bcd is False
    assert profile.has_own_fins is True
    assert profile.has_own_lead_weights is False


def test_gear_profile_ownership_api(client, db_session, test_user, auth_headers):
    # Test creating via API
    resp = client.post(
        "/api/v1/bookings/gear-profiles",
        headers=auth_headers,
        json={
            "name": "Winter 7mm Cold Water",
            "is_default": False,
            "has_own_mask": True,
            "has_own_wetsuit": True,
            "has_own_regulator": True,
            "regulator_fitting": "DIN",
            "has_own_bcd": True,
            "has_own_fins": True,
            "has_own_boots": True,
            "has_own_torch": True,
            "has_own_lead_weights": True,
            "has_own_dive_computer": True,
            "has_own_smb": True,
            "wetsuit_thickness": "7mm",
            "estimated_lead_kg": 8.0,
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Winter 7mm Cold Water"
    assert data["has_own_mask"] is True
    assert data["has_own_regulator"] is True
    assert data["regulator_fitting"] == "DIN"
    assert data["has_own_lead_weights"] is True

    # Test listing via API
    list_resp = client.get("/api/v1/bookings/gear-profiles", headers=auth_headers)
    assert list_resp.status_code == 200
    profiles = list_resp.json()
    winter = next((p for p in profiles if p["name"] == "Winter 7mm Cold Water"), None)
    assert winter is not None
    assert winter["has_own_bcd"] is True
    assert winter["has_own_torch"] is True
