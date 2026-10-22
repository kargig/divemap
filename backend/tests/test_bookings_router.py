from datetime import UTC, datetime, time, timedelta, timezone

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.models import (
    DiverMedicalRecord,
    DivingCenter,
    DivingCenterBookingSettings,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoOption,
    OctoProduct,
    OctoUnit,
    User,
    UserGearProfile,
)


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", test_key)

@pytest.fixture
def booking_setup(db_session: Session, test_diving_center: DivingCenter, test_user: User):
    # Center Settings
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        payment_mode="PAY_ON_ARRIVAL",
        hold_duration_minutes=20,
    )
    db_session.add(settings)
    
    # User Gear Profile
    profile = UserGearProfile(
        user_id=test_user.id,
        name="Default",
        is_default=True,
        height_cm=185,
        weight_kg=82.0,
        shoe_size_eu=44.0,
        wetsuit_gender="MEN",
        wetsuit_size="XL",
        wetsuit_thickness="5mm",
        bcd_size="L",
        fin_type="OPEN_HEEL",
        regulator_fitting="DIN",
        preferred_tank_id="15",
        preferred_gas_mix_id="air",
        estimated_lead_kg=5.0,
        insurance_provider="DAN Europe",
        insurance_policy_number="DAN-123456",
    )
    db_session.add(profile)
    
    # Product, Option, Unit
    product = OctoProduct(
        id="prod-checkout-test",
        diving_center_id=test_diving_center.id,
        title="Zenobia Wreck 2-Tank Morning Boat Dive",
        product_type="GUIDED_BOAT_TRIP",
        waiver_bundle_id="padi_10086",
    )
    option = OctoOption(
        id="opt-checkout-test",
        product_id=product.id,
        title="08:30 Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    unit = OctoUnit(
        id="unit-checkout-test",
        product_id=product.id,
        unit_type="DIVER_RENTAL_GEAR",
        title="Certified Diver (Full Rental Gear)",
        retail_price=105.00,
        currency="EUR",
    )
    db_session.add_all([product, option, unit])
    db_session.flush()
    
    # Slot
    start_dt = datetime.now(UTC) + timedelta(days=3)
    end_dt = start_dt + timedelta(hours=4)
    slot = OctoAvailabilitySlot(
        id="slot-checkout-test",
        product_id=product.id,
        option_id=option.id,
        start_datetime=start_dt,
        end_datetime=end_dt,
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)
    
    # Existing held booking
    booking = OctoBooking(
        uuid="book-checkout-uuid-1",
        diving_center_id=test_diving_center.id,
        product_id=product.id,
        option_id=option.id,
        availability_id=slot.id,
        user_id=test_user.id,
        status="ON_HOLD",
        utc_hold_expiration=datetime.now(UTC) + timedelta(minutes=20),
        total_amount=105.00,
        currency="EUR",
    )
    db_session.add(booking)
    db_session.flush()
    
    unit_item = OctoBookingUnitItem(
        id="item-checkout-uuid-1",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        user_id=test_user.id,
        diver_full_name="Jean-Luc Picard",
        diver_email=test_user.email,
        selected_tank_id="12",
        selected_gas_mix_id="air",
    )
    db_session.add(unit_item)
    db_session.commit()
    
    return {
        "user": test_user,
        "center": test_diving_center,
        "product": product,
        "slot": slot,
        "booking": booking,
        "unit_item": unit_item,
    }

def test_get_checkout_context(client: TestClient, booking_setup):
    user = booking_setup["user"]
    slot = booking_setup["slot"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    
    res = client.get(f"/api/v1/bookings/checkout-context/{slot.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["slot"]["id"] == slot.id
    assert data["product"]["title"] == "Zenobia Wreck 2-Tank Morning Boat Dive"
    assert data["prefill_gear"]["preferred_tank_id"] == "15"
    assert data["prefill_gear"]["height_cm"] == 185
    assert "dmsc_schema" in data


def test_get_checkout_context_filters_inactive_certifications(client: TestClient, db_session, booking_setup):
    from app.models import DivingOrganization, UserCertification
    user = booking_setup["user"]
    slot = booking_setup["slot"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    org = db_session.query(DivingOrganization).first()
    if not org:
        org = DivingOrganization(name="PADI", acronym="PADI")
        db_session.add(org)
        db_session.flush()

    active_cert = UserCertification(
        user_id=user.id,
        diving_organization_id=org.id,
        certification_level="Advanced Open Water",
        is_active=True,
    )
    inactive_cert = UserCertification(
        user_id=user.id,
        diving_organization_id=org.id,
        certification_level="Expired Specialty",
        is_active=False,
    )
    db_session.add_all([active_cert, inactive_cert])
    db_session.commit()

    res = client.get(f"/api/v1/bookings/checkout-context/{slot.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "diver_capabilities" in data
    user_certs = data.get("user_certifications", [])
    levels = [c["level"] for c in user_certs]
    assert "Advanced Open Water" in levels
    assert "Expired Specialty" not in levels
    assert "allows_nitrox" in user_certs[0]

def test_submit_paperwork_clean_flow(client: TestClient, booking_setup):
    user = booking_setup["user"]
    booking = booking_setup["booking"]
    unit_item = booking_setup["unit_item"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    
    paperwork_payload = {
        "unitItemId": unit_item.id,
        "dmscAnswers": {f"q{i}": False for i in range(1, 11)},
        "signatureName": "Jean-Luc Picard",
        "selectedTankId": "15",
        "selectedGasMixId": "air",
        "equipmentSizing": {
            "wetsuit_size": "XL",
            "bcd_size": "L",
            "fin_type": "OPEN_HEEL",
            "shoe_size_eu": 44.0,
            "regulator_fitting": "DIN",
            "lead_kg": 5.0
        }
    }
    
    res = client.post(f"/api/v1/bookings/{booking.uuid}/submit-paperwork", json=paperwork_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "CONFIRMED"
    assert data["medicalStatus"] == "CLEARED"
    assert data["waiversComplete"] is True

def test_submit_paperwork_flagged_medical(client: TestClient, booking_setup):
    user = booking_setup["user"]
    booking = booking_setup["booking"]
    unit_item = booking_setup["unit_item"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    
    flagged_answers = {f"q{i}": False for i in range(1, 11)}
    flagged_answers["q1"] = True # Asthma or chest surgery
    
    paperwork_payload = {
        "unitItemId": unit_item.id,
        "dmscAnswers": flagged_answers,
        "signatureName": "Jean-Luc Picard",
        "selectedTankId": "12",
    }
    
    res = client.post(f"/api/v1/bookings/{booking.uuid}/submit-paperwork", json=paperwork_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["medicalStatus"] == "FLAGGED_CONTACT_CENTER"

def test_get_booking_voucher_requires_auth(client: TestClient, booking_setup):
    booking = booking_setup["booking"]
    res_denied = client.get(f"/api/v1/bookings/{booking.uuid}/voucher")
    assert res_denied.status_code == 401

    user = booking_setup["user"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(f"/api/v1/bookings/{booking.uuid}/voucher", headers=headers)
    assert res.status_code == 200
    voucher = res.json()
    assert voucher["bookingUuid"] == booking.uuid
    assert "qrCodeData" in voucher
    assert voucher["paymentStatus"] == "PENDING_AT_CHECKIN"
    assert voucher["currency"] == "EUR"

def test_download_booking_voucher_pdf(client: TestClient, booking_setup):
    booking = booking_setup["booking"]
    user = booking_setup["user"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(f"/api/v1/bookings/{booking.uuid}/voucher/pdf", headers=headers)
    assert res.status_code == 200
    assert "application/pdf" in res.headers["content-type"]
    assert res.content[:4] == b"%PDF"
    assert len(res.content) > 1000

