"""Regression tests for PR #265 inventory, medical binding, and access hardening fixes."""

from datetime import UTC, datetime, time, timedelta, timezone

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.models import (
    CenterDiverMedicalApproval,
    DiverMedicalRecord,
    DivingCenter,
    DivingCenterBookingSettings,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoOption,
    OctoProduct,
    OctoUnit,
    OwnershipStatus,
    ParsedDiveTrip,
    User,
    UserMedicalProfile,
)
from app.routers.center_booking_ops import reconcile_slot_seats
from app.services.booking_access_service import (
    hash_booking_token,
    mint_booking_access_token,
    mint_claim_token,
    verify_claim_token,
)
from app.services.booking_medical_encryption_service import (
    BookingMedicalEncryptionService,
)
from app.services.booking_pricing_service import compute_participant_octo_pricing


@pytest.fixture
def harden_setup(
    db_session: Session, test_diving_center: DivingCenter, test_user: User
):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        default_currency="EUR",
        hold_duration_minutes=20,
        rental_equipment_pricing={
            "full_kit_package": 40.0,
            "items": {"wetsuit": 15.0, "bcd": 12.0},
        },
    )
    db_session.add(settings)
    product = OctoProduct(
        id="prod-harden-1",
        diving_center_id=test_diving_center.id,
        title="Harden Dive",
        product_type="GUIDED_BOAT_TRIP",
        waiver_bundle_id="padi_10086",
    )
    db_session.add(product)
    db_session.flush()
    option = OctoOption(
        id="opt-harden-1",
        product_id=product.id,
        title="Morning",
        meeting_time=time(8, 0),
        departure_time=time(8, 30),
        max_capacity=4,
    )
    unit_own = OctoUnit(
        id="unit-harden-own",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver (Own Gear)",
        retail_price=80.0,
        currency="EUR",
    )
    unit_rent = OctoUnit(
        id="unit-harden-rent",
        product_id=product.id,
        unit_type="DIVER_RENTAL_GEAR",
        title="Certified Diver (Full Rental Gear)",
        retail_price=110.0,
        currency="EUR",
    )
    db_session.add_all([option, unit_own, unit_rent])
    db_session.flush()
    start_dt = datetime.now(UTC) + timedelta(days=5)
    slot = OctoAvailabilitySlot(
        id="slot-harden-1",
        product_id=product.id,
        option_id=option.id,
        start_datetime=start_dt,
        end_datetime=start_dt + timedelta(hours=4),
        seats_total=4,
        seats_available=4,
    )
    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=start_dt.date(),
        trip_time=time(8, 30),
        trip_description="Harden trip",
        group_size_limit=4,
        current_bookings=0,
        is_bookable=True,
        octo_slot_id=slot.id,
    )
    db_session.add(slot)
    db_session.flush()
    trip.octo_slot_id = slot.id
    db_session.add(trip)
    db_session.commit()
    # Link bidirectional
    slot.dive_trip = trip
    db_session.commit()
    return {
        "center": test_diving_center,
        "user": test_user,
        "product": product,
        "option": option,
        "unit_own": unit_own,
        "unit_rent": unit_rent,
        "slot": slot,
        "trip": trip,
        "settings": settings,
    }


def _auth_headers(user: User):
    token = create_access_token({"sub": user.username})
    return {"Authorization": f"Bearer {token}"}


def _hold_payload(
    setup, *, unit_id=None, seats=1, product_id=None, option_id=None, avail_id=None
):
    items = []
    for i in range(seats):
        items.append(
            {
                "unitId": unit_id or setup["unit_own"].id,
                "diverFullName": f"Diver {i}",
                "diverEmail": f"diver{i}@example.com",
            }
        )
    return {
        "productId": product_id or setup["product"].id,
        "optionId": option_id or setup["option"].id,
        "availabilityId": avail_id or setup["slot"].id,
        "unitItems": items,
        "contact": {"fullName": "Lead", "email": "lead@example.com"},
    }


def test_hold_rejects_mismatched_product(
    client: TestClient, harden_setup, db_session: Session
):
    other = OctoProduct(
        id="prod-other-center",
        diving_center_id=harden_setup["center"].id,
        title="Other",
        product_type="GUIDED_BOAT_TRIP",
    )
    db_session.add(other)
    db_session.commit()
    payload = _hold_payload(harden_setup, product_id=other.id)
    res = client.post("/api/v1/octo/bookings", json=payload)
    assert res.status_code == 400
    assert "productId" in res.json()["detail"]


def test_hold_rejects_foreign_unit(
    client: TestClient, harden_setup, db_session: Session
):
    foreign = OctoUnit(
        id="unit-foreign",
        product_id="prod-does-not-exist",
        unit_type="DIVER_OWN_GEAR",
        title="Orphan",
        retail_price=1.0,
        currency="EUR",
    )
    # Use a second product on same center so FK works
    p2 = OctoProduct(
        id="prod-harden-2",
        diving_center_id=harden_setup["center"].id,
        title="Other product",
        product_type="GUIDED_BOAT_TRIP",
    )
    db_session.add(p2)
    db_session.flush()
    foreign.product_id = p2.id
    db_session.add(foreign)
    db_session.commit()
    payload = _hold_payload(harden_setup, unit_id=foreign.id)
    res = client.post("/api/v1/octo/bookings", json=payload)
    assert res.status_code == 400
    assert "unitId" in res.json()["detail"]


def test_confirm_expired_rejected_for_owner(
    client: TestClient, harden_setup, db_session: Session, test_user: User
):
    payload = _hold_payload(harden_setup)
    # Authenticated hold attaches user_id
    res = client.post(
        "/api/v1/octo/bookings", json=payload, headers=_auth_headers(test_user)
    )
    assert res.status_code == 201
    booking_uuid = res.json()["uuid"]
    booking = (
        db_session.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    )
    booking.user_id = test_user.id
    booking.utc_hold_expiration = datetime.now(UTC) - timedelta(minutes=5)
    db_session.commit()

    slot = (
        db_session.query(OctoAvailabilitySlot)
        .filter_by(id=harden_setup["slot"].id)
        .first()
    )
    reconcile_slot_seats(db_session, slot)
    db_session.refresh(booking)
    assert booking.status == "EXPIRED"

    seats_after = (
        db_session.query(OctoAvailabilitySlot)
        .filter_by(id=harden_setup["slot"].id)
        .first()
    ).seats_available

    confirm = client.post(
        f"/api/v1/octo/bookings/{booking_uuid}/confirm",
        headers=_auth_headers(test_user),
    )
    assert confirm.status_code == 400
    db_session.refresh(booking)
    assert booking.status == "EXPIRED"
    seats_now = (
        db_session.query(OctoAvailabilitySlot)
        .filter_by(id=harden_setup["slot"].id)
        .first()
    ).seats_available
    assert seats_now == seats_after


def test_cancel_expired_does_not_double_free(
    client: TestClient, harden_setup, db_session: Session, test_user: User
):
    res = client.post(
        "/api/v1/octo/bookings",
        json=_hold_payload(harden_setup, seats=2),
        headers=_auth_headers(test_user),
    )
    assert res.status_code == 201
    booking_uuid = res.json()["uuid"]
    booking = (
        db_session.query(OctoBooking).filter(OctoBooking.uuid == booking_uuid).first()
    )
    booking.user_id = test_user.id
    booking.utc_hold_expiration = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    slot = (
        db_session.query(OctoAvailabilitySlot)
        .filter_by(id=harden_setup["slot"].id)
        .first()
    )
    reconcile_slot_seats(db_session, slot)
    db_session.refresh(slot)
    assert slot.seats_available == 4

    cancel = client.post(
        f"/api/v1/octo/bookings/{booking_uuid}/cancel",
        headers=_auth_headers(test_user),
    )
    assert cancel.status_code == 200
    db_session.refresh(slot)
    assert slot.seats_available == 4


def test_reconfirm_rejected(
    client: TestClient, harden_setup, db_session: Session, test_user: User
):
    res = client.post(
        "/api/v1/octo/bookings",
        json=_hold_payload(harden_setup),
        headers=_auth_headers(test_user),
    )
    booking_uuid = res.json()["uuid"]
    access = res.json()["accessToken"]
    headers = {**_auth_headers(test_user), "X-Booking-Access-Token": access}

    c1 = client.post(f"/api/v1/octo/bookings/{booking_uuid}/confirm", headers=headers)
    assert c1.status_code == 200
    trip = (
        db_session.query(ParsedDiveTrip).filter_by(id=harden_setup["trip"].id).first()
    )
    db_session.refresh(trip)
    bookings_after = trip.current_bookings

    c2 = client.post(f"/api/v1/octo/bookings/{booking_uuid}/confirm", headers=headers)
    assert c2.status_code == 400
    db_session.refresh(trip)
    assert trip.current_bookings == bookings_after


def test_pricing_ignores_client_is_rental_package(harden_setup):
    unit = harden_setup["unit_own"]
    settings = harden_setup["settings"]
    with_flag = compute_participant_octo_pricing(
        settings,
        unit,
        {"is_rental_package": True, "wetsuit_size": "M"},
    )
    without = compute_participant_octo_pricing(
        settings,
        unit,
        {"wetsuit_size": "M"},
    )
    # Own-gear unit should charge wetsuit rental either way; package flag must not skip it
    assert with_flag["total_due"] == without["total_due"]
    assert with_flag["total_due"] > float(unit.retail_price)


def test_pricing_requires_unit():
    with pytest.raises(ValueError):
        compute_participant_octo_pricing(None, None, {})


def test_annual_medical_cannot_apply_to_guest_seat(
    client: TestClient, harden_setup, db_session: Session, test_user: User, monkeypatch
):
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    enc = BookingMedicalEncryptionService()
    dek, payload = enc.encrypt_answers({f"q{i}": False for i in range(1, 11)})
    profile = UserMedicalProfile(
        user_id=test_user.id,
        status="CLEARED",
        encrypted_dek=dek,
        encrypted_answers=payload,
        completed_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=365),
        audit_signature_hash="test-audit-hash",
    )
    db_session.add(profile)
    db_session.commit()

    res = client.post(
        "/api/v1/octo/bookings",
        json=_hold_payload(harden_setup, seats=2),
        headers=_auth_headers(test_user),
    )
    assert res.status_code == 201
    data = res.json()
    guest_item = data["unitItems"][1]["id"]
    headers = {
        **_auth_headers(test_user),
        "X-Booking-Access-Token": data["accessToken"],
    }
    bad = client.post(
        f"/api/v1/bookings/{data['uuid']}/submit-paperwork",
        headers=headers,
        json={
            "unitItemId": guest_item,
            "signatureName": "Guest Diver",
            "useAnnualMedical": True,
            "confirmNoMedicalChange": True,
        },
    )
    assert bad.status_code == 403


def test_guest_paperwork_does_not_overwrite_booker_annual(
    client: TestClient, harden_setup, db_session: Session, test_user: User, monkeypatch
):
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    enc = BookingMedicalEncryptionService()
    original = {f"q{i}": False for i in range(1, 11)}
    original["q1"] = True
    dek, payload = enc.encrypt_answers(original)
    profile = UserMedicalProfile(
        user_id=test_user.id,
        status="FLAGGED",
        encrypted_dek=dek,
        encrypted_answers=payload,
        completed_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=365),
        audit_signature_hash="test-audit-hash",
    )
    db_session.add(profile)
    db_session.commit()

    res = client.post(
        "/api/v1/octo/bookings",
        json=_hold_payload(harden_setup, seats=2),
        headers=_auth_headers(test_user),
    )
    data = res.json()
    guest_item = data["unitItems"][1]["id"]
    guest_answers = {f"q{i}": False for i in range(1, 11)}
    headers = {
        **_auth_headers(test_user),
        "X-Booking-Access-Token": data["accessToken"],
    }
    ok = client.post(
        f"/api/v1/bookings/{data['uuid']}/submit-paperwork",
        headers=headers,
        json={
            "unitItemId": guest_item,
            "signatureName": "Guest Diver",
            "dmscAnswers": guest_answers,
        },
    )
    assert ok.status_code == 200
    db_session.refresh(profile)
    decrypted = enc.decrypt_answers(profile.encrypted_dek, profile.encrypted_answers)
    assert decrypted["q1"] is True
    med = (
        db_session.query(DiverMedicalRecord)
        .filter(DiverMedicalRecord.booking_unit_item_id == guest_item)
        .first()
    )
    assert med is not None
    assert med.user_id != test_user.id
    seat_answers = enc.decrypt_answers(med.encrypted_dek, med.encrypted_answers)
    assert seat_answers["q1"] is False
    # Seat medical should not overwrite annual; annual still flagged with q1=True
    assert profile.status == "FLAGGED"


def test_claim_token_not_reusable_for_write(
    client: TestClient, harden_setup, monkeypatch
):
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    res = client.post(
        "/api/v1/octo/bookings", json=_hold_payload(harden_setup, seats=2)
    )
    assert res.status_code == 201
    data = res.json()
    invites = data["claimInviteTokens"]
    assert invites
    claim = invites[0]
    paperwork = {
        "unitItemId": claim["unitItemId"],
        "dmscAnswers": {f"q{i}": False for i in range(1, 11)},
        "signatureName": "Guest Diver",
        "selectedTankId": "12",
        "selectedGasMixId": "air",
    }
    first = client.post(
        f"/api/v1/bookings/{data['uuid']}/claim/{claim['claimToken']}",
        json=paperwork,
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/v1/bookings/{data['uuid']}/claim/{claim['claimToken']}",
        json=paperwork,
    )
    assert second.status_code == 404


def test_gdpr_delete_revokes_center_approvals(
    client: TestClient,
    harden_setup,
    db_session: Session,
    test_user: User,
    monkeypatch,
):
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    enc = BookingMedicalEncryptionService()
    dek, payload = enc.encrypt_answers({f"q{i}": False for i in range(1, 11)})
    profile = UserMedicalProfile(
        user_id=test_user.id,
        status="CLEARED",
        encrypted_dek=dek,
        encrypted_answers=payload,
        completed_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=365),
        audit_signature_hash="test-audit-hash",
    )
    approval = CenterDiverMedicalApproval(
        diving_center_id=harden_setup["center"].id,
        user_id=test_user.id,
        approved_by_user_id=test_user.id,
        physician_name="Dr Test",
        approved_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=365),
    )
    db_session.add_all([profile, approval])
    db_session.commit()
    approval_id = approval.id

    booking = OctoBooking(
        uuid="gdpr-retain-booking",
        diving_center_id=harden_setup["center"].id,
        product_id=harden_setup["product"].id,
        option_id=harden_setup["option"].id,
        availability_id=harden_setup["slot"].id,
        user_id=test_user.id,
        status="CONFIRMED",
        total_amount=80,
        currency="EUR",
    )
    item = OctoBookingUnitItem(
        id="gdpr-unit-item",
        booking_uuid=booking.uuid,
        unit_id=harden_setup["unit_own"].id,
        user_id=test_user.id,
        diver_full_name="Diver",
    )
    trip_med = DiverMedicalRecord(
        booking_unit_item_id=item.id,
        user_id=test_user.id,
        status="CLEARED",
        encrypted_dek=dek,
        encrypted_answers=payload,
        expires_at=datetime.now(UTC) + timedelta(days=365),
    )
    db_session.add_all([booking, item, trip_med])
    db_session.commit()

    resp = client.delete(
        "/api/v1/bookings/medical/me", headers=_auth_headers(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["deleted"]["annualProfile"] is True
    assert body["deleted"]["centerApprovalsRevoked"] >= 1
    assert body["retained"]["tripMedicalRecords"] is True
    assert (
        db_session.query(UserMedicalProfile).filter_by(user_id=test_user.id).first()
        is None
    )
    assert (
        db_session.query(CenterDiverMedicalApproval).filter_by(id=approval_id).first()
        is None
    )
    assert (
        db_session.query(DiverMedicalRecord)
        .filter_by(booking_unit_item_id=item.id)
        .first()
        is not None
    )


def test_manifest_missing_medical_is_pending(
    client: TestClient, harden_setup, db_session: Session, test_user: User
):
    # Make user center owner
    center = harden_setup["center"]
    center.owner_id = test_user.id
    center.ownership_status = OwnershipStatus.approved
    db_session.commit()

    res = client.post(
        "/api/v1/octo/bookings",
        json=_hold_payload(harden_setup),
        headers=_auth_headers(test_user),
    )
    booking_uuid = res.json()["uuid"]
    access = res.json()["accessToken"]
    client.post(
        f"/api/v1/octo/bookings/{booking_uuid}/confirm",
        headers={**_auth_headers(test_user), "X-Booking-Access-Token": access},
    )

    manifest = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{harden_setup['slot'].id}/manifest",
        headers=_auth_headers(test_user),
    )
    assert manifest.status_code == 200
    participants = manifest.json()["participants"]
    assert participants
    assert participants[0]["medical_status"] == "PENDING"


def test_hold_does_not_assign_user_by_unverified_email(
    client: TestClient, harden_setup, db_session: Session, test_user: User
):
    payload = _hold_payload(harden_setup)
    payload["contact"]["email"] = test_user.email
    res = client.post("/api/v1/octo/bookings", json=payload)  # anonymous
    assert res.status_code == 201
    booking = (
        db_session.query(OctoBooking)
        .filter(OctoBooking.uuid == res.json()["uuid"])
        .first()
    )
    assert booking.user_id is None


def test_post_confirm_paperwork_blocked_except_own_annual_refresh(
    client: TestClient, harden_setup, db_session: Session, test_user: User, monkeypatch
):
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    enc = BookingMedicalEncryptionService()
    answers = {f"q{i}": False for i in range(1, 11)}
    dek, payload = enc.encrypt_answers(answers)
    profile = UserMedicalProfile(
        user_id=test_user.id,
        status="CLEARED",
        encrypted_dek=dek,
        encrypted_answers=payload,
        completed_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=365),
        audit_signature_hash="test-audit-hash",
    )
    db_session.add(profile)
    db_session.commit()

    res = client.post(
        "/api/v1/octo/bookings",
        json=_hold_payload(harden_setup, seats=2),
        headers=_auth_headers(test_user),
    )
    data = res.json()
    uuid = data["uuid"]
    access = data["accessToken"]
    own_item = data["unitItems"][0]["id"]
    guest_item = data["unitItems"][1]["id"]
    headers = {**_auth_headers(test_user), "X-Booking-Access-Token": access}

    # Complete paperwork for both seats (second submission auto-confirms when all seats done)
    assert (
        client.post(
            f"/api/v1/bookings/{uuid}/submit-paperwork",
            headers=headers,
            json={
                "unitItemId": own_item,
                "signatureName": "Lead",
                "useAnnualMedical": True,
                "confirmNoMedicalChange": True,
            },
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/bookings/{uuid}/submit-paperwork",
            headers=headers,
            json={
                "unitItemId": guest_item,
                "signatureName": "Guest",
                "dmscAnswers": answers,
            },
        ).status_code
        == 200
    )
    booking = db_session.query(OctoBooking).filter(OctoBooking.uuid == uuid).first()
    db_session.refresh(booking)
    assert booking.status == "CONFIRMED"

    # Guest seat overwrite after confirm must be rejected
    blocked = client.post(
        f"/api/v1/bookings/{uuid}/submit-paperwork",
        headers=headers,
        json={
            "unitItemId": guest_item,
            "signatureName": "Guest Again",
            "dmscAnswers": {**answers, "q2": True},
        },
    )
    assert blocked.status_code == 400

    # Own-seat annual refresh still allowed
    refresh = client.post(
        f"/api/v1/bookings/{uuid}/submit-paperwork",
        headers=headers,
        json={
            "unitItemId": own_item,
            "signatureName": "Lead",
            "useAnnualMedical": True,
            "confirmNoMedicalChange": True,
        },
    )
    assert refresh.status_code == 200


def test_claim_token_expires(
    client: TestClient, harden_setup, db_session: Session, monkeypatch
):
    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    res = client.post(
        "/api/v1/octo/bookings", json=_hold_payload(harden_setup, seats=2)
    )
    data = res.json()
    claim = data["claimInviteTokens"][0]
    item = (
        db_session.query(OctoBookingUnitItem)
        .filter(OctoBookingUnitItem.id == claim["unitItemId"])
        .first()
    )
    item.claim_invited_at = datetime.now(UTC) - timedelta(days=15)
    db_session.commit()

    expired = client.post(
        f"/api/v1/bookings/{data['uuid']}/claim/{claim['claimToken']}",
        json={
            "unitItemId": claim["unitItemId"],
            "dmscAnswers": {f"q{i}": False for i in range(1, 11)},
            "signatureName": "Guest",
        },
    )
    assert expired.status_code == 404


def test_reconcile_uses_aware_utc(harden_setup, db_session: Session):
    slot = harden_setup["slot"]
    booking = OctoBooking(
        uuid="expire-naive-hold",
        diving_center_id=harden_setup["center"].id,
        product_id=harden_setup["product"].id,
        option_id=harden_setup["option"].id,
        availability_id=slot.id,
        status="ON_HOLD",
        # Intentional naive UTC for the naive-hold expiry path under test.
        utc_hold_expiration=(
            datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
        ),
        total_amount=80,
        currency="EUR",
    )
    item = OctoBookingUnitItem(
        id="expire-naive-item",
        booking_uuid=booking.uuid,
        unit_id=harden_setup["unit_own"].id,
        diver_full_name="Expired",
    )
    slot.seats_available = 3
    db_session.add_all([booking, item])
    db_session.commit()

    reconcile_slot_seats(db_session, slot)
    db_session.refresh(booking)
    assert booking.status == "EXPIRED"
    db_session.refresh(slot)
    assert slot.seats_available == 4
