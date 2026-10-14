import pytest
from cryptography.fernet import Fernet
from datetime import datetime, timezone, timedelta, time
from app.models import (
    User,
    DivingCenter,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    UserMedicalProfile,
    CenterDiverMedicalApproval,
    DiverMedicalRecord,
)


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch):
    test_key = Fernet.generate_key().decode()
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", test_key)


def test_annual_medical_profile_endpoints(client, db_session, test_user, auth_headers):
    # 1. Initially no record
    resp = client.get("/api/v1/bookings/medical/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["has_record"] is False

    # 2. Save 10-No cleared declaration
    answers_clean = {f"q{i}": False for i in range(1, 11)}
    post_resp = client.post(
        "/api/v1/bookings/medical/me",
        headers=auth_headers,
        json={
            "dmscAnswers": answers_clean,
            "signatureName": "Diver Alex",
        }
    )
    assert post_resp.status_code == 200
    data = post_resp.json()
    assert data["success"] is True
    assert data["status"] == "CLEARED"

    # 3. Verify get returns active cleared record
    get_resp = client.get("/api/v1/bookings/medical/me", headers=auth_headers)
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["has_record"] is True
    assert get_data["status"] == "CLEARED"
    assert get_data["days_remaining"] >= 364
    assert get_data["is_expired"] is False

    # 4. Delete profile under GDPR Article 17(1)
    del_resp = client.delete("/api/v1/bookings/medical/me", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 5. Verify get now returns has_record = False
    get_after_del = client.get("/api/v1/bookings/medical/me", headers=auth_headers)
    assert get_after_del.status_code == 200
    assert get_after_del.json()["has_record"] is False


def test_fast_track_checkout_and_center_isolation(
    client,
    db_session,
    test_user,
    test_admin_user,
    auth_headers,
    admin_headers,
    test_diving_center,
):
    # Setup center 2 (different center)
    center2 = DivingCenter(
        name="Santorini Dive Club",
        email="info@santorinidive.gr",
        phone="+302286012345",
        owner_id=test_admin_user.id,
        latitude=36.3932,
        longitude=25.4615,
        location="POINT(25.4615 36.3932)",
    )
    db_session.add(center2)
    db_session.commit()

    now_utc = datetime.now(timezone.utc)

    # Setup products, options and slots for center 1
    prod1 = OctoProduct(
        id="prod-med-1",
        diving_center_id=test_diving_center.id,
        title="Cape Greco Morning Dive",
    )
    opt1 = OctoOption(
        id="opt-med-1",
        product_id=prod1.id,
        title="Default Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
    )
    slot1 = OctoAvailabilitySlot(
        id="slot-med-1",
        product_id=prod1.id,
        option_id=opt1.id,
        start_datetime=now_utc + timedelta(days=5),
        end_datetime=now_utc + timedelta(days=5, hours=4),
        seats_total=10,
        seats_available=10,
    )
    unit1 = OctoUnit(
        id="unit-med-1",
        product_id=prod1.id,
        unit_type="DIVER_OWN_GEAR",
        title="Standard Diver",
        retail_price=65.0,
    )
    db_session.add_all([prod1, opt1, unit1, slot1])
    db_session.commit()

    booking1 = OctoBooking(
        uuid="test-uuid-annual-1",
        product_id=prod1.id,
        option_id=opt1.id,
        availability_id=slot1.id,
        diving_center_id=test_diving_center.id,
        status="PENDING",
        total_amount=65.0,
        currency="EUR",
    )
    db_session.add(booking1)
    db_session.commit()

    item1 = OctoBookingUnitItem(
        id="unit-item-1",
        booking_uuid=booking1.uuid,
        unit_id=unit1.id,
        user_id=test_user.id,
        diver_full_name="Diver Alex",
        diver_email=test_user.email,
    )
    db_session.add(item1)
    db_session.commit()

    # Case A: Diver has CLEARED annual record -> fast-tracks to CLEARED
    annual_clean = UserMedicalProfile(
        user_id=test_user.id,
        status="CLEARED",
        encrypted_dek="dek-1",
        encrypted_answers=b"ans-1",
        completed_at=now_utc,
        expires_at=now_utc + timedelta(days=365),
        audit_signature_hash="hash-clean",
    )
    db_session.add(annual_clean)
    db_session.commit()

    resp_submit = client.post(
        f"/api/v1/bookings/{booking1.uuid}/submit-paperwork",
        headers=auth_headers,
        json={
            "unitItemId": item1.id,
            "signatureName": "Diver Alex",
            "useAnnualMedical": True,
            "confirmNoMedicalChange": True,
        }
    )
    assert resp_submit.status_code == 200
    assert resp_submit.json()["medicalStatus"] == "CLEARED"

    # Case B: Diver updates to FLAGGED (e.g. Asthma condition)
    annual_clean.status = "FLAGGED"
    db_session.commit()

    # Diver submits on slot 1 with Center 1 -> marked FLAGGED_CONTACT_CENTER because Center 1 hasn't approved yet
    resp_submit_flagged = client.post(
        f"/api/v1/bookings/{booking1.uuid}/submit-paperwork",
        headers=auth_headers,
        json={
            "unitItemId": item1.id,
            "signatureName": "Diver Alex",
            "useAnnualMedical": True,
            "confirmNoMedicalChange": True,
        }
    )
    assert resp_submit_flagged.status_code == 200
    assert resp_submit_flagged.json()["medicalStatus"] == "FLAGGED_CONTACT_CENTER"

    # Case C: Center 1 Manager grants 1-Year Approval
    resp_grant = client.post(
        f"/api/v1/centers/{test_diving_center.id}/booking-ops/trips/{slot1.id}/participants/{item1.id}/grant-annual-approval",
        headers=admin_headers,
        json={
            "physician_name": "Dr. Marina Sotiropoulou",
            "physician_clinic": "Athens Dive Medical",
            "approval_notes": "Mild exercise asthma, approved with inhaler on board.",
            "validity_days": 365,
        }
    )
    assert resp_grant.status_code == 200
    assert resp_grant.json()["status"] == "PHYSICIAN_APPROVED"

    # Now verify that re-submitting on Center 1 auto-recognizes the center approval
    resp_submit_approved = client.post(
        f"/api/v1/bookings/{booking1.uuid}/submit-paperwork",
        headers=auth_headers,
        json={
            "unitItemId": item1.id,
            "signatureName": "Diver Alex",
            "useAnnualMedical": True,
            "confirmNoMedicalChange": True,
        }
    )
    assert resp_submit_approved.status_code == 200
    assert resp_submit_approved.json()["medicalStatus"] == "PHYSICIAN_APPROVED"

    # Case D: Diver books with Center 2 (Santorini) -> Center 1's approval does NOT apply to Center 2!
    prod2 = OctoProduct(
        id="prod-med-2",
        diving_center_id=center2.id,
        title="Caldera Morning Dive",
    )
    opt2 = OctoOption(
        id="opt-med-2",
        product_id=prod2.id,
        title="Departure 10:00",
        meeting_time=time(9, 30),
        departure_time=time(10, 0),
    )
    slot2 = OctoAvailabilitySlot(
        id="slot-med-2",
        product_id=prod2.id,
        option_id=opt2.id,
        start_datetime=now_utc + timedelta(days=10),
        end_datetime=now_utc + timedelta(days=10, hours=4),
        seats_total=10,
        seats_available=10,
    )
    unit2 = OctoUnit(
        id="unit-med-2",
        product_id=prod2.id,
        unit_type="DIVER_OWN_GEAR",
        title="Standard Diver",
        retail_price=70.0,
    )
    db_session.add_all([prod2, opt2, unit2, slot2])
    db_session.commit()

    booking2 = OctoBooking(
        uuid="test-uuid-annual-2",
        product_id=prod2.id,
        option_id=opt2.id,
        availability_id=slot2.id,
        diving_center_id=center2.id,
        status="PENDING",
        total_amount=70.0,
        currency="EUR",
    )
    db_session.add(booking2)
    db_session.commit()

    item2 = OctoBookingUnitItem(
        id="unit-item-2",
        booking_uuid=booking2.uuid,
        unit_id=unit2.id,
        user_id=test_user.id,
        diver_full_name="Diver Alex",
        diver_email=test_user.email,
    )
    db_session.add(item2)
    db_session.commit()

    resp_submit_center2 = client.post(
        f"/api/v1/bookings/{booking2.uuid}/submit-paperwork",
        headers=auth_headers,
        json={
            "unitItemId": item2.id,
            "signatureName": "Diver Alex",
            "useAnnualMedical": True,
            "confirmNoMedicalChange": True,
        }
    )
    assert resp_submit_center2.status_code == 200
    # Must be FLAGGED_CONTACT_CENTER because Center 2 manager has not independently approved this diver!
    assert resp_submit_center2.json()["medicalStatus"] == "FLAGGED_CONTACT_CENTER"
