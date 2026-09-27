import pytest
from datetime import datetime, time, timezone, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet

from app.auth import create_access_token
from app.models import (
    User,
    DivingCenter,
    OwnershipStatus,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    DivingCenterVessel,
)

@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", test_key)

@pytest.fixture
def center_ops_setup(db_session: Session, test_user: User):
    # Create center with test_user as approved owner
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

    # Vessel
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

    # Product, Option, Unit
    product = OctoProduct(
        id="prod-ops-test",
        diving_center_id=center.id,
        title="Volcano & Nea Kameni 2-Tank Dive",
        product_type="GUIDED_BOAT_TRIP",
    )
    option = OctoOption(
        id="opt-ops-test",
        product_id=product.id,
        title="Morning Cruise",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=12,
    )
    unit = OctoUnit(
        id="unit-ops-test",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver",
        retail_price=80.00,
        currency="EUR",
    )
    db_session.add_all([product, option, unit])
    db_session.flush()

    # Slot
    start_dt = datetime.now(timezone.utc) + timedelta(days=2)
    end_dt = start_dt + timedelta(hours=4)
    slot = OctoAvailabilitySlot(
        id="slot-ops-test",
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

    # Booking with 2 participants
    booking = OctoBooking(
        uuid="booking-ops-uuid-1",
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

    item1 = OctoBookingUnitItem(
        id="part-item-1",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        diver_full_name="Sylvia Earle",
        diver_email="sylvia@deepsea.org",
        diver_nationality="American",
        passport_number="US998877",
        date_of_birth=date(1935, 8, 30),
        certification_agency="NAUI",
        certification_level="Instructor",
        selected_tank_id="15",
        selected_gas_mix_id="ean32",
        equipment_sizing={"estimated_lead_kg": 4.0, "wetsuit_size": "M", "wetsuit_thickness": "5mm", "bcd_size": "M", "shoe_size_eu": 39},
        onboard_checkin_status=True,
    )
    item2 = OctoBookingUnitItem(
        id="part-item-2",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        diver_full_name="Robert Ballard",
        diver_email="ballard@ocean.org",
        diver_nationality="American",
        passport_number="US112233",
        date_of_birth=date(1942, 6, 30),
        certification_agency="PADI",
        certification_level="Rescue Diver",
        selected_tank_id="12",
        selected_gas_mix_id="air",
        equipment_sizing={"estimated_lead_kg": 6.0, "wetsuit_size": "L", "wetsuit_thickness": "5mm", "bcd_size": "L", "shoe_size_eu": 43},
        onboard_checkin_status=False,
    )
    db_session.add_all([item1, item2])
    db_session.commit()

    return {
        "center": center,
        "vessel": vessel,
        "slot": slot,
        "booking": booking,
        "owner": test_user,
    }


def test_get_trip_manifest(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["center"]["name"] == "Santorini Dive Club"
    assert data["vessel"]["name"] == "Ocean Raider"
    assert data["slot"]["seats_total"] == 12
    assert len(data["participants"]) == 2

    # Check crate packing summary aggregation
    summary = data["crate_packing_summary"]
    assert any("15L EAN32" in k for k in summary["cylinders"])
    assert any("12L AIR" in k for k in summary["cylinders"])
    assert summary["total_lead_kg"] == 10.0 # 4.0 + 6.0
    assert summary["total_participants"] == 2
    assert "M (5mm)" in summary["wetsuits"]


def test_add_walkin_participant(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    walkin_payload = {
        "diver_full_name": "Barnaby Jones",
        "diver_email": "barnaby@jones.org",
        "diver_nationality": "British",
        "passport_number": "UK883344",
        "date_of_birth": "1988-04-14",
        "certification_agency": "SSI",
        "certification_level": "Advanced Open Water",
        "selected_tank_id": "12",
        "selected_gas_mix_id": "air",
        "equipment_sizing": {"wetsuit_size": "XL", "wetsuit_thickness": "5mm", "estimated_lead_kg": 7.0},
        "mark_as_paid": True,
        "onboard_checkin_status": True,
    }

    res = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants",
        json=walkin_payload,
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["diver_full_name"] == "Barnaby Jones"
    assert data["seats_available"] == 9 # Was 10, decremented to 9


def test_update_participant_equipment(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    update_payload = {
        "selected_tank_id": "15",
        "selected_gas_mix_id": "ean32",
        "equipment_sizing": {"estimated_lead_kg": 8.0, "wetsuit_size": "XXL"},
    }

    res = client.put(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-2",
        json=update_payload,
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["updated"] is True


def test_toggle_participant_checkin(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    # part-item-2 started as onboard_checkin_status=False
    res1 = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-2/toggle-checkin",
        headers=headers,
    )
    assert res1.status_code == 200
    assert res1.json()["onboard_checkin_status"] is True

    # Toggle again -> False
    res2 = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-2/toggle-checkin",
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()["onboard_checkin_status"] is False


def test_toggle_booking_payment(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    booking = center_ops_setup["booking"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    # Initial state: PENDING_AT_CHECKIN -> toggle to PAID_IN_FULL
    res = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/bookings/{booking.uuid}/toggle-payment",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["payment_status"] == "PAID_IN_FULL"

    # Toggle again -> back to PENDING_AT_CHECKIN
    res2 = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/bookings/{booking.uuid}/toggle-payment",
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()["payment_status"] == "PENDING_AT_CHECKIN"


def test_update_trip_staff(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    staff_payload = {
        "skipper_name": "Capt. Nikos",
        "skipper_license": "GR-SK-9988",
        "lead_guide_name": "Maria K.",
        "lead_guide_cert": "PADI OWSI #112233",
        "crew_names": ["Yiannis (Deckhand)"]
    }
    res = client.put(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/staff",
        json=staff_payload,
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["staff"]["skipper_name"] == "Capt. Nikos"
    assert data["staff"]["lead_guide_name"] == "Maria K."


def test_delete_participant_releases_seat(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    initial_seats = slot.seats_available
    res = client.delete(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-1",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["seats_available"] == initial_seats + 1


def test_export_port_authority_manifest(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    # CSV Export
    res_csv = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest/export-port-authority?format=csv",
        headers=headers,
    )
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "PORT AUTHORITY PASSENGER & DIVER MANIFEST" in res_csv.text
    assert "Sylvia Earle" in res_csv.text

    # PDF Export
    res_pdf = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest/export-port-authority?format=pdf",
        headers=headers,
    )
    assert res_pdf.status_code == 200
    assert "application/pdf" in res_pdf.headers["content-type"]
    assert len(res_pdf.content) > 1000 # Valid non-empty PDF bytes
    assert res_pdf.content[:4] == b"%PDF"


def test_unauthorized_user_forbidden(client: TestClient, db_session: Session, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]

    # Create another regular user who does NOT manage this center
    random_user = User(
        username="unauthorized_diver",
        email="diver@random.com",
        password_hash="dummy_hash",
        enabled=True,
    )
    db_session.add(random_user)
    db_session.commit()

    token = create_access_token(data={"sub": random_user.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest", headers=headers)
    assert res.status_code == 403
    assert "Not authorized" in res.json()["detail"]


def test_nitrox_requires_qualifying_certification(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt walk-in with Scuba Diver (no nitrox) requesting ean32 -> 400
    invalid_walkin = {
        "diver_full_name": "Novice Diver",
        "diver_email": "novice@test.com",
        "certification_agency": "PADI",
        "certification_level": "Scuba Diver", # Not nitrox
        "selected_tank_id": "12",
        "selected_gas_mix_id": "ean32",
    }
    res_fail = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants",
        json=invalid_walkin,
        headers=headers,
    )
    assert res_fail.status_code == 400
    assert "requires an Enriched Air Diver" in res_fail.json()["detail"]

    # Now with Enriched Air Diver (Nitrox) -> 201
    valid_walkin = {
        "diver_full_name": "Nitrox Diver",
        "diver_email": "nitrox@test.com",
        "certification_agency": "PADI",
        "certification_level": "Enriched Air Diver (Nitrox)",
        "selected_tank_id": "12",
        "selected_gas_mix_id": "ean32",
    }
    res_ok = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants",
        json=valid_walkin,
        headers=headers,
    )
    assert res_ok.status_code == 201


def test_medical_review_and_physician_clearance_override(client: TestClient, db_session: Session, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    # Create encrypted medical record with a flagged condition for part-item-2
    from app.services.booking_medical_encryption_service import BookingMedicalEncryptionService
    from app.models import DiverMedicalRecord
    encryption_svc = BookingMedicalEncryptionService()
    flagged_answers = {"q1": True, "q2": False, "q3": False}
    enc_dek, enc_answers = encryption_svc.encrypt_answers(flagged_answers)

    med_rec = DiverMedicalRecord(
        booking_unit_item_id="part-item-2",
        user_id=owner.id,
        status="FLAGGED_CONTACT_CENTER",
        encrypted_dek=enc_dek,
        encrypted_answers=enc_answers,
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
    )
    db_session.add(med_rec)
    db_session.commit()

    # 1. Fetch medical review
    res_review = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-2/medical-review",
        headers=headers,
    )
    assert res_review.status_code == 200
    review_data = res_review.json()
    assert review_data["status"] == "FLAGGED_CONTACT_CENTER"
    assert len(review_data["flagged_questions"]) == 1
    assert "lungs/breathing" in review_data["flagged_questions"][0]["text"]

    # Safety Gate test: Attempting to board diver with FLAGGED_CONTACT_CENTER must fail with 400
    res_blocked = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-2/toggle-checkin",
        headers=headers,
    )
    assert res_blocked.status_code == 400
    assert "Safety Gate" in res_blocked.json()["detail"]

    # 2. Perform physician clearance override
    clear_payload = {
        "physician_name": "Dr. Sofia Karra",
        "physician_clinic": "Santorini General Hospital",
        "notes": "ECG normal, cleared for diving down to 30m.",
        "confirmed_physical_form_inspected": True,
    }
    res_clear = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-2/clear-medical",
        json=clear_payload,
        headers=headers,
    )
    assert res_clear.status_code == 200
    clear_data = res_clear.json()
    assert clear_data["status"] == "PHYSICIAN_APPROVED"
    assert clear_data["cleared_by"] == owner.username
    assert clear_data["physician_name"] == "Dr. Sofia Karra"

    # 3. Verify manifest reflects PHYSICIAN_APPROVED with audit info
    res_manifest = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/manifest",
        headers=headers,
    )
    assert res_manifest.status_code == 200
    p2 = [p for p in res_manifest.json()["participants"] if p["id"] == "part-item-2"][0]
    assert p2["medical_status"] == "PHYSICIAN_APPROVED"
    assert p2["medical_clearance_audit"]["physician_name"] == "Dr. Sofia Karra"
    assert p2["medical_clearance_audit"]["cleared_by_name"] == owner.username


def test_export_emergency_dossier_pdf(client: TestClient, center_ops_setup):
    center = center_ops_setup["center"]
    slot = center_ops_setup["slot"]
    owner = center_ops_setup["owner"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/part-item-1/emergency-dossier",
        headers=headers,
    )
    assert res.status_code == 200
    assert "application/pdf" in res.headers["content-type"]
    assert res.content[:4] == b"%PDF"
    assert len(res.content) > 1000
