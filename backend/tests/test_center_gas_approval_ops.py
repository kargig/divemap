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


def test_gas_and_checkin_endpoints_reject_mismatched_trip_id(
    client: TestClient, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    participant = center_ops_gas_setup["participant"]
    wrong_trip_id = "00000000-0000-0000-0000-000000000000"

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. approve-gas with wrong trip
    res1 = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{wrong_trip_id}/participants/{participant.id}/approve-gas",
        json={},
        headers=headers,
    )
    assert res1.status_code == 404

    # 2. revert-air with wrong trip
    res2 = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{wrong_trip_id}/participants/{participant.id}/revert-air",
        json={},
        headers=headers,
    )
    assert res2.status_code == 404

    # 3. verify-checkin-item with wrong trip
    res3 = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{wrong_trip_id}/participants/{participant.id}/verify-checkin-item",
        json={"item": "doctor_note", "verified": True},
        headers=headers,
    )
    assert res3.status_code == 404


def test_verify_checkin_item_allowlist_and_unverify_clearing(
    client: TestClient, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid item rejected with 400
    res_bad = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/verify-checkin-item",
        json={"item": "arbitrary_custom_pollutant", "verified": True},
        headers=headers,
    )
    assert res_bad.status_code == 400

    # Verify c_card -> sets timestamp and user
    res_verify = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/verify-checkin-item",
        json={"item": "c_card", "verified": True},
        headers=headers,
    )
    assert res_verify.status_code == 200
    verifs = res_verify.json()["checkin_verifications"]
    assert verifs["c_card_verified"] is True
    assert "c_card_verified_at" in verifs
    assert verifs["c_card_verified_by"] == user.username

    # Unverify c_card -> clears timestamp and user
    res_unverify = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/verify-checkin-item",
        json={"item": "c_card", "verified": False},
        headers=headers,
    )
    assert res_unverify.status_code == 200
    verifs2 = res_unverify.json()["checkin_verifications"]
    assert verifs2["c_card_verified"] is False
    assert "c_card_verified_at" not in verifs2
    assert "c_card_verified_by" not in verifs2


def test_boarding_gate_blocks_pending_gas_mix_and_unblocks_on_approval(
    client: TestClient, db_session, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    # Ensure gear check and medical clearance pass
    participant.equipment_sizing = {"gear_checked": True}
    from app.models import DiverMedicalRecord

    med = DiverMedicalRecord(
        booking_unit_item_id=participant.id,
        user_id=None,
        status="CLEARED",
        encrypted_dek="test-dek",
        encrypted_answers=b"{}",
    )
    db_session.add(med)
    db_session.commit()

    # 1. Attempt to board with PENDING_APPROVAL EAN32 -> blocked with 400
    res_board = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/toggle-checkin",
        headers=headers,
    )
    assert res_board.status_code == 400
    assert "Safety Gate" in res_board.json()["detail"]
    assert "EAN32" in res_board.json()["detail"]

    # 2. Approve gas -> boarding succeeds
    res_approve = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/approve-gas",
        headers=headers,
    )
    assert res_approve.status_code == 200

    res_board_after_approve = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}/toggle-checkin",
        headers=headers,
    )
    assert res_board_after_approve.status_code == 200
    assert res_board_after_approve.json()["onboard_checkin_status"] is True


def test_cert_downgrade_flips_gas_status_to_pending(
    client: TestClient, db_session, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    # Initially approved for EAN32
    participant.gas_mix_status = "APPROVED"
    participant.certification_level = "Enriched Air Diver (Nitrox)"
    db_session.commit()

    # Staff downgrades certification level to Open Water without specifying gas
    res = client.put(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{participant.id}",
        json={"certification_level": "Open Water Diver"},
        headers=headers,
    )
    assert res.status_code == 200
    db_session.refresh(participant)
    assert participant.gas_mix_status == "PENDING_APPROVAL"


def test_packing_manifest_counts_belts_for_both_weight_systems(
    client: TestClient, db_session, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]
    participant = center_ops_gas_setup["participant"]

    # Configure diver to use BOTH integrated pockets and a weight belt
    participant.equipment_sizing = {
        "weight_system": "BOTH",
        "weight_systems": ["INTEGRATED", "BELT"],
        "estimated_lead_kg": 6.0,
    }
    db_session.commit()

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest",
        headers=headers,
    )
    assert res.status_code == 200
    lead_breakdown = res.json()["crate_packing_summary"]["lead_breakdown"]
    assert lead_breakdown["belts_needed"] >= 1


def test_walkin_eanx_unverified_sets_pending_approval(
    client: TestClient, db_session, center_ops_gas_setup
):
    user = center_ops_gas_setup["user"]
    center = center_ops_gas_setup["center"]
    slot = center_ops_gas_setup["slot"]

    token = create_access_token({"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}

    walkin_payload = {
        "diver_full_name": "Walkin Diver",
        "diver_email": "walkin@example.com",
        "certification_agency": "PADI",
        "certification_level": "Open Water Diver",
        "selected_tank_id": "12",
        "selected_gas_mix_id": "ean32",
        "equipment_sizing": {"weight_system": "INTEGRATED"},
    }

    res = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants",
        json=walkin_payload,
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["diver_full_name"] == "Walkin Diver"

    from app.models import OctoBookingUnitItem

    item = (
        db_session.query(OctoBookingUnitItem)
        .filter(OctoBookingUnitItem.id == data["id"])
        .first()
    )
    assert item is not None
    assert item.selected_gas_mix_id == "ean32"
    assert item.gas_mix_status == "PENDING_APPROVAL"
