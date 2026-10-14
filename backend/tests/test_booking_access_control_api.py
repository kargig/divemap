"""Access-control hardening: tokens, ownership, claim, center isolation, physician URL."""
import pytest
from datetime import datetime, time, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.models import (
    DivingCenter,
    DivingCenterBookingSettings,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    User,
)
from app.services.booking_access_service import (
    hash_booking_token,
    mint_booking_access_token,
    validate_physician_certificate_url,
)


@pytest.fixture
def access_setup(db_session: Session, test_diving_center: DivingCenter, test_user: User):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        default_currency="EUR",
        hold_duration_minutes=20,
    )
    db_session.add(settings)
    product = OctoProduct(
        id="prod-access-1",
        diving_center_id=test_diving_center.id,
        title="Access Control Dive",
        product_type="GUIDED_BOAT_TRIP",
        waiver_bundle_id="padi_10086",
    )
    db_session.add(product)
    db_session.flush()
    option = OctoOption(
        id="opt-access-1",
        product_id=product.id,
        title="Morning",
        meeting_time=time(8, 0),
        departure_time=time(8, 30),
        max_capacity=8,
    )
    unit = OctoUnit(
        id="unit-access-1",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver",
        retail_price=80.0,
        currency="EUR",
    )
    db_session.add_all([option, unit])
    db_session.flush()
    start_dt = datetime.now(timezone.utc) + timedelta(days=3)
    slot = OctoAvailabilitySlot(
        id="slot-access-1",
        product_id=product.id,
        option_id=option.id,
        start_datetime=start_dt,
        end_datetime=start_dt + timedelta(hours=4),
        seats_total=8,
        seats_available=8,
    )
    db_session.add(slot)
    db_session.commit()
    return {
        "center": test_diving_center,
        "user": test_user,
        "product": product,
        "option": option,
        "unit": unit,
        "slot": slot,
    }


def _hold_two_seats(client: TestClient, access_setup):
    payload = {
        "productId": access_setup["product"].id,
        "optionId": access_setup["option"].id,
        "availabilityId": access_setup["slot"].id,
        "unitItems": [
            {
                "unitId": access_setup["unit"].id,
                "diverFullName": "Lead Diver",
                "diverEmail": "lead@example.com",
            },
            {
                "unitId": access_setup["unit"].id,
                "diverFullName": "Guest Diver",
                "diverEmail": "guest@example.com",
            },
        ],
        "contact": {"fullName": "Lead Diver", "email": "lead@example.com"},
    }
    res = client.post("/api/v1/octo/bookings", json=payload)
    assert res.status_code == 201
    return res.json()


def test_uuid_only_voucher_denied(client: TestClient, access_setup):
    booking = _hold_two_seats(client, access_setup)
    res = client.get(f"/api/v1/bookings/{booking['uuid']}/voucher")
    assert res.status_code == 401


def test_access_token_allows_voucher(client: TestClient, access_setup):
    booking = _hold_two_seats(client, access_setup)
    headers = {"X-Booking-Access-Token": booking["accessToken"]}
    res = client.get(f"/api/v1/bookings/{booking['uuid']}/voucher", headers=headers)
    assert res.status_code == 200
    assert res.json()["bookingUuid"] == booking["uuid"]


def test_guest_claim_flow(client: TestClient, access_setup, monkeypatch):
    from cryptography.fernet import Fernet

    monkeypatch.setenv("BOOKING_MEDICAL_MASTER_KEYS", Fernet.generate_key().decode())
    booking = _hold_two_seats(client, access_setup)
    invites = booking["claimInviteTokens"]
    assert len(invites) == 1
    claim = invites[0]
    claim_token = claim["claimToken"]
    unit_item_id = claim["unitItemId"]

    ctx = client.get(f"/api/v1/bookings/{booking['uuid']}/claim/{claim_token}")
    assert ctx.status_code == 200
    assert ctx.json()["unitItemId"] == unit_item_id
    assert ctx.json()["diverFullName"] == "Guest Diver"

    paperwork = {
        "unitItemId": unit_item_id,
        "dmscAnswers": {f"q{i}": False for i in range(1, 11)},
        "signatureName": "Guest Diver",
    }
    res = client.post(
        f"/api/v1/bookings/{booking['uuid']}/claim/{claim_token}",
        json=paperwork,
    )
    assert res.status_code == 200
    assert res.json()["waiversComplete"] is True
    # Lead seat incomplete → booking stays ON_HOLD
    assert res.json()["status"] == "ON_HOLD"


def test_physician_url_allowlist(monkeypatch):
    monkeypatch.setenv("PHYSICIAN_CERTIFICATE_ALLOWED_HOSTS", "uploads.divemap.blue")
    assert (
        validate_physician_certificate_url("https://uploads.divemap.blue/docs/cert.pdf")
        == "https://uploads.divemap.blue/docs/cert.pdf"
    )
    with pytest.raises(Exception):
        validate_physician_certificate_url("https://evil.example/phish.pdf")
    with pytest.raises(Exception):
        validate_physician_certificate_url("javascript:alert(1)")


def test_cross_center_manifest_idor_denied(
    client: TestClient,
    db_session: Session,
    test_user: User,
):
    """Manager of center A cannot read center B's trip via A's path + B's slot id."""
    from app.models import OwnershipStatus

    center_a = DivingCenter(
        name="Center A Access",
        owner_id=test_user.id,
        ownership_status=OwnershipStatus.approved,
        email="a-access@example.com",
        country="Greece",
        region="Attica",
    )
    center_b = DivingCenter(
        name="Center B Access",
        email="b-access@example.com",
        country="Greece",
        region="Attica",
    )
    db_session.add_all([center_a, center_b])
    db_session.flush()

    product_b = OctoProduct(
        id="prod-access-b",
        diving_center_id=center_b.id,
        title="Other Center Trip",
        product_type="GUIDED_BOAT_TRIP",
        waiver_bundle_id="padi_10086",
    )
    db_session.add(product_b)
    db_session.flush()
    option_b = OctoOption(
        id="opt-access-b",
        product_id=product_b.id,
        title="Afternoon",
        meeting_time=time(14, 0),
        departure_time=time(14, 30),
        max_capacity=6,
    )
    db_session.add(option_b)
    db_session.flush()
    start_dt = datetime.now(timezone.utc) + timedelta(days=4)
    slot_b = OctoAvailabilitySlot(
        id="slot-access-b",
        product_id=product_b.id,
        option_id=option_b.id,
        start_datetime=start_dt,
        end_datetime=start_dt + timedelta(hours=3),
        seats_total=6,
        seats_available=6,
    )
    db_session.add(slot_b)
    db_session.commit()

    token = create_access_token({"sub": test_user.username})
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(
        f"/api/v1/centers/{center_a.id}/booking-ops/trips/{slot_b.id}/manifest",
        headers=headers,
    )
    assert res.status_code == 404
