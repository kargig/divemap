from datetime import UTC, datetime, time, timedelta

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.models import (
    DiverMedicalRecord,
    DivingCenter,
    DivingCenterVessel,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoOption,
    OctoProduct,
    OctoUnit,
    OwnershipStatus,
    User,
)


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", test_key)


@pytest.fixture
def center_ops_gas_setup(db_session: Session, test_user: User):
    center = DivingCenter(
        name="Santorini Dive Club",
        owner_id=test_user.id,
        ownership_status=OwnershipStatus.approved,
        email="ops@santorinidive.com",
        phone="+30 22860 12345",
        address="Perissa Beach, Santorini",
        country="Greece",
        region="Cyclades",
    )
    db_session.add(center)
    db_session.flush()

    vessel = DivingCenterVessel(
        diving_center_id=center.id,
        name="Ocean Raider",
        registration_number="TH-9842",
        licensed_capacity=14,
        has_emergency_oxygen=True,
        has_first_aid_kit=True,
    )
    db_session.add(vessel)
    db_session.flush()

    product = OctoProduct(
        id="prod-gas-test",
        diving_center_id=center.id,
        title="Volcano & Nea Kameni 2-Tank Dive",
        product_type="GUIDED_BOAT_TRIP",
    )
    option = OctoOption(
        id="opt-gas-test",
        product_id=product.id,
        title="Morning Cruise",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=12,
    )
    unit = OctoUnit(
        id="unit-gas-test",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver",
        retail_price=80.00,
        currency="EUR",
    )
    db_session.add_all([product, option, unit])
    db_session.flush()

    start_dt = datetime.now(UTC) + timedelta(days=2)
    end_dt = start_dt + timedelta(hours=4)
    slot = OctoAvailabilitySlot(
        id="slot-gas-test",
        product_id=product.id,
        option_id=option.id,
        vessel_id=vessel.id,
        start_datetime=start_dt,
        end_datetime=end_dt,
        seats_total=12,
        seats_available=10,
    )
    db_session.add(slot)
    db_session.flush()

    booking = OctoBooking(
        uuid="booking-gas-uuid-1",
        diving_center_id=center.id,
        product_id=product.id,
        option_id=option.id,
        availability_id=slot.id,
        user_id=test_user.id,
        status="CONFIRMED",
        payment_mode="PAY_ON_ARRIVAL",
        payment_status="PENDING_AT_CHECKIN",
        total_amount=160.00,
        currency="EUR",
    )
    db_session.add(booking)
    db_session.flush()

    participant = OctoBookingUnitItem(
        id="part-gas-item-1",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        diver_full_name="Sylvia Earle",
        diver_email="sylvia@deepsea.org",
        certification_agency="PADI",
        certification_level="Open Water Diver",
        selected_tank_id="12",
        selected_gas_mix_id="ean32",
        gas_mix_status="PENDING_APPROVAL",
        checkin_verifications=None,
        equipment_sizing={"lead_kg": 6.0, "weight_systems": ["INTEGRATED", "BELT"]},
    )
    db_session.add(participant)
    db_session.commit()

    return {
        "user": test_user,
        "center": center,
        "slot": slot,
        "booking": booking,
        "participant": participant,
    }


def test_manager_approve_eanx(client: TestClient, db_session, center_ops_gas_setup):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/approve-gas",
        json={"notes": "Checked SSI Nitrox digital card"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["gas_mix_status"] == "APPROVED"
    assert data["selected_gas_mix_id"] == "ean32"
    assert data["checkin_verifications"]["nitrox_cert_verified"] is True
    assert (
        data["checkin_verifications"]["nitrox_notes"]
        == "Checked SSI Nitrox digital card"
    )

    db_session.refresh(participant)
    assert participant.gas_mix_status == "APPROVED"


def test_manager_revert_to_air(client: TestClient, db_session, center_ops_gas_setup):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/revert-air",
        json={"reason": "Diver does not have nitrox cert"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["gas_mix_status"] == "REVERTED_AIR"
    assert data["selected_gas_mix_id"] == "air"
    assert (
        data["checkin_verifications"]["gas_revert_reason"]
        == "Diver does not have nitrox cert"
    )

    db_session.refresh(participant)
    assert participant.selected_gas_mix_id == "air"
    assert participant.gas_mix_status == "REVERTED_AIR"


def test_manager_verify_checkin_item(
    client: TestClient, db_session, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/verify-checkin-item",
        json={"item": "doctor_note", "verified": True},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["checkin_verifications"]["doctor_note_verified"] is True

    db_session.refresh(participant)
    assert participant.checkin_verifications["doctor_note_verified"] is True


def test_manifest_includes_gas_status_and_verifications(
    client: TestClient, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest",
        headers=headers,
    )
    assert res.status_code == 200
    manifest = res.json()
    assert len(manifest["participants"]) == 1
    p = manifest["participants"][0]
    assert "gas_mix_status" in p
    assert "checkin_verifications" in p
    assert p["gas_mix_status"] == "PENDING_APPROVAL"
