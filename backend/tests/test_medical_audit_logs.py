import pytest
from cryptography.fernet import Fernet
from datetime import datetime, timezone, timedelta, time
from app.models import (
    User,
    DivingCenter,
    DivingCenterManager,
    OwnershipStatus,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    DiverMedicalRecord,
    AuthAuditLog,
)
from app.services.booking_medical_encryption_service import BookingMedicalEncryptionService
from app.auth import create_access_token


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", test_key)


def test_medical_access_audit_logging_success_and_denial(client, db_session, test_user, auth_headers):
    # 1. Setup Diving Center with manager
    manager_user = User(
        username="audit_manager",
        email="audit_manager@example.com",
        name="Audit Manager",
        password_hash="hashed_pw_test",
    )
    unauthorized_user = User(
        username="intruder_user",
        email="intruder@example.com",
        name="Intruder User",
        password_hash="hashed_pw_test",
    )
    db_session.add_all([manager_user, unauthorized_user])
    db_session.commit()

    center = DivingCenter(
        name="Audit Reef Center",
        owner_id=manager_user.id,
        ownership_status=OwnershipStatus.approved,
    )
    db_session.add(center)
    db_session.commit()

    # Product and Slot
    product = OctoProduct(id="audit-prod-01", diving_center_id=center.id, title="Audit Boat Dive", is_active=True)
    db_session.add(product)
    db_session.commit()

    option = OctoOption(
        id="audit-opt-01",
        product_id=product.id,
        title="Morning Slot",
        departure_time=time(9, 0),
        meeting_time=time(8, 30),
    )
    db_session.add(option)
    db_session.commit()

    slot = OctoAvailabilitySlot(
        id="audit-slot-01",
        product_id=product.id,
        option_id=option.id,
        start_datetime=datetime.now(timezone.utc) + timedelta(days=2),
        end_datetime=datetime.now(timezone.utc) + timedelta(days=2, hours=3),
        seats_total=10,
        seats_available=8,
    )
    db_session.add(slot)
    db_session.commit()

    # Create Booking for test_user
    booking = OctoBooking(
        uuid="audit-bk-uuid-001",
        diving_center_id=center.id,
        product_id=product.id,
        option_id=option.id,
        availability_id=slot.id,
        user_id=test_user.id,
        status="CONFIRMED",
        total_amount=100.0,
    )
    db_session.add(booking)
    db_session.commit()

    unit = OctoUnit(
        id="unit-med-test",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Standard Diver",
        retail_price=65.0,
    )
    db_session.add(unit)
    db_session.commit()

    unit_item = OctoBookingUnitItem(
        id="unit-item-audit-01",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        user_id=test_user.id,
        diver_full_name="Diver Alex",
    )
    db_session.add(unit_item)
    db_session.commit()

    # Encrypt medical record
    enc_svc = BookingMedicalEncryptionService()
    answers = {f"q{i}": (i == 1) for i in range(1, 11)} # q1=True (flagged)
    dek, payload = enc_svc.encrypt_answers(answers)

    med_rec = DiverMedicalRecord(
        booking_unit_item_id=unit_item.id,
        user_id=test_user.id,
        status="FLAGGED_CONTACT_CENTER",
        encrypted_dek=dek,
        encrypted_answers=payload,
        audit_signature_hash="sample-audit-hash",
    )
    db_session.add(med_rec)
    db_session.commit()

    # Create auth headers
    manager_token = create_access_token(data={"sub": manager_user.username})
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    intruder_token = create_access_token(data={"sub": unauthorized_user.username})
    intruder_headers = {"Authorization": f"Bearer {intruder_token}"}

    # TEST A: Unauthorized user attempts to view medical review -> DENIED
    unauth_resp = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{unit_item.id}/medical-review",
        headers=intruder_headers,
    )
    assert unauth_resp.status_code == 403

    denied_log = db_session.query(AuthAuditLog).filter(
        AuthAuditLog.user_id == unauthorized_user.id,
        AuthAuditLog.action == "medical_review_view",
        AuthAuditLog.success == False,
    ).first()
    assert denied_log is not None
    assert "Not authorized manager" in denied_log.details

    # TEST B: Authorized manager views medical review -> SUCCESS
    auth_resp = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/participants/{unit_item.id}/medical-review",
        headers=manager_headers,
    )
    assert auth_resp.status_code == 200
    assert auth_resp.json()["status"] == "FLAGGED_CONTACT_CENTER"

    success_log = db_session.query(AuthAuditLog).filter(
        AuthAuditLog.user_id == manager_user.id,
        AuthAuditLog.action == "medical_review_view",
        AuthAuditLog.success == True,
    ).first()
    assert success_log is not None
    assert "Diver Alex" in success_log.details

    # TEST C: Diver views their own annual medical status -> Logged
    me_resp = client.get("/api/v1/bookings/medical/me", headers=auth_headers)
    assert me_resp.status_code == 200

    self_log = db_session.query(AuthAuditLog).filter(
        AuthAuditLog.user_id == test_user.id,
        AuthAuditLog.action == "medical_annual_medical_status_view",
        AuthAuditLog.success == True,
    ).first()
    assert self_log is not None
