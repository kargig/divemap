from datetime import UTC, datetime, time, timedelta, timezone

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", test_key)


from app.models import (
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


@pytest.fixture
def booking_setup(
    db_session: Session, test_diving_center: DivingCenter, test_user: User
):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        payment_mode="PAY_ON_ARRIVAL",
        hold_duration_minutes=20,
    )
    db_session.add(settings)

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

    product = OctoProduct(
        id="prod-checkout-eanx",
        diving_center_id=test_diving_center.id,
        title="Zenobia Wreck 2-Tank Morning Boat Dive",
        product_type="GUIDED_BOAT_TRIP",
        waiver_bundle_id="padi_10086",
    )
    option = OctoOption(
        id="opt-checkout-eanx",
        product_id=product.id,
        title="08:30 Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    unit = OctoUnit(
        id="unit-checkout-eanx",
        product_id=product.id,
        unit_type="DIVER_RENTAL_GEAR",
        title="Certified Diver (Full Rental Gear)",
        retail_price=105.00,
        currency="EUR",
    )
    db_session.add_all([product, option, unit])
    db_session.flush()

    start_dt = datetime.now(UTC) + timedelta(days=3)
    end_dt = start_dt + timedelta(hours=4)
    slot = OctoAvailabilitySlot(
        id="slot-checkout-eanx",
        product_id=product.id,
        option_id=option.id,
        start_datetime=start_dt,
        end_datetime=end_dt,
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)

    booking = OctoBooking(
        uuid="book-checkout-eanx-uuid",
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
        id="item-checkout-eanx-uuid",
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


def test_uncertified_diver_eanx_paperwork_sets_pending(
    client: TestClient, db_session, booking_setup
):
    user = booking_setup["user"]
    booking = booking_setup["booking"]
    unit_item = booking_setup["unit_item"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    unit_item.certification_level = "Open Water Diver"
    db_session.commit()

    paperwork_payload = {
        "unitItemId": unit_item.id,
        "dmscAnswers": {f"q{i}": False for i in range(1, 11)},
        "signatureName": "Jean-Luc Picard",
        "selectedTankId": "12",
        "selectedGasMixId": "ean32",
        "equipmentSizing": {
            "lead_kg": 6.0,
            "weight_systems": ["INTEGRATED", "BELT"],
            "weight_system": "BOTH",
        },
    }

    res = client.post(
        f"/api/v1/bookings/{booking.uuid}/submit-paperwork",
        json=paperwork_payload,
        headers=headers,
    )
    assert res.status_code == 200

    db_session.refresh(unit_item)
    assert unit_item.selected_gas_mix_id == "ean32"
    assert unit_item.gas_mix_status == "PENDING_APPROVAL"

    res_v = client.get(f"/api/v1/bookings/{booking.uuid}/voucher", headers=headers)
    assert res_v.status_code == 200
    voucher = res_v.json()
    assert len(voucher["unitItems"]) == 1
    item_v = voucher["unitItems"][0]
    assert item_v["selectedGasMixId"] == "ean32"
    assert item_v["gasMixStatus"] == "PENDING_APPROVAL"


def test_certified_diver_eanx_paperwork_sets_approved(
    client: TestClient, db_session, booking_setup
):
    user = booking_setup["user"]
    booking = booking_setup["booking"]
    unit_item = booking_setup["unit_item"]
    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    unit_item.certification_level = "Enriched Air Diver (Nitrox)"
    db_session.commit()

    paperwork_payload = {
        "unitItemId": unit_item.id,
        "dmscAnswers": {f"q{i}": False for i in range(1, 11)},
        "signatureName": "Jean-Luc Picard",
        "selectedTankId": "12",
        "selectedGasMixId": "ean32",
        "equipmentSizing": {
            "lead_kg": 4.0,
            "weight_systems": ["INTEGRATED"],
            "weight_system": "INTEGRATED",
        },
    }

    res = client.post(
        f"/api/v1/bookings/{booking.uuid}/submit-paperwork",
        json=paperwork_payload,
        headers=headers,
    )
    assert res.status_code == 200

    db_session.refresh(unit_item)
    assert unit_item.selected_gas_mix_id == "ean32"
    assert unit_item.gas_mix_status == "APPROVED"
