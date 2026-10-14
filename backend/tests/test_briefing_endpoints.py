from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import pytest

from app.models import (
    OctoProduct,
    OctoOption,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoUnit,
    DiveSite,
    DivingCenter,
    User,
    OwnershipStatus,
)
from app.auth import create_access_token


@pytest.fixture
def briefing_api_setup(db_session):
    owner = User(
        username="manager_briefing_api",
        email="manager_api@briefing.com",
        password_hash="fakehash123",
    )
    db_session.add(owner)
    db_session.commit()

    center = DivingCenter(
        name="Briefing API Dive Center",
        phone="+30 22420 99999",
        email="info@briefingapi.com",
        owner_id=owner.id,
        ownership_status=OwnershipStatus.approved,
    )
    db_session.add(center)
    db_session.commit()

    site = DiveSite(
        name="Paradise Reef",
        latitude=36.85,
        longitude=27.28,
        max_depth=20.0,
    )
    db_session.add(site)
    db_session.commit()

    product = OctoProduct(
        id="prod-brf-api",
        diving_center_id=center.id,
        title="Morning Boat Dive",
        product_type="GUIDED_BOAT_TRIP",
        dive_site_id=site.id,
    )
    db_session.add(product)
    db_session.commit()

    option = OctoOption(
        id="opt-brf-api",
        product_id=product.id,
        title="08:30 Trip",
        meeting_time="08:30",
        departure_time="09:00",
    )
    db_session.add(option)
    db_session.commit()

    unit = OctoUnit(
        id="unit-brf-api",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver",
        retail_price=75.0,
        currency="EUR",
    )
    db_session.add(unit)
    db_session.commit()

    slot = OctoAvailabilitySlot(
        id="slot-brf-api",
        product_id=product.id,
        option_id=option.id,
        start_datetime=datetime.now(timezone.utc) + timedelta(days=1),
        end_datetime=datetime.now(timezone.utc) + timedelta(days=1, hours=4),
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)
    db_session.commit()

    booking = OctoBooking(
        uuid="book-brf-api-uuid",
        diving_center_id=center.id,
        product_id=product.id,
        option_id=option.id,
        availability_id=slot.id,
        status="CONFIRMED",
        payment_mode="PAY_ON_ARRIVAL",
        payment_status="PENDING_AT_CHECKIN",
        total_amount=75.0,
        currency="EUR",
    )
    db_session.add(booking)
    db_session.flush()
    from app.services.booking_access_service import mint_booking_access_token

    access_token = mint_booking_access_token(
        booking,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.commit()

    return {
        "owner": owner,
        "center": center,
        "site": site,
        "slot": slot,
        "booking": booking,
        "access_token": access_token,
    }


def test_briefing_lifecycle_endpoints(client: TestClient, briefing_api_setup):
    owner = briefing_api_setup["owner"]
    center = briefing_api_setup["center"]
    slot = briefing_api_setup["slot"]
    booking = briefing_api_setup["booking"]

    token = create_access_token(data={"sub": owner.username})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET draft briefing (auto-compiles if not existing)
    res_get = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/briefing",
        headers=headers,
    )
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["status"] == "DRAFT_PENDING_REVIEW"
    assert "Paradise Reef" in data["active_dive_site_name"]
    assert "emergency_action_plan" in data

    # 2. PUT custom meeting notes and crew
    update_payload = {
        "meeting_notes": "Please assemble at the dock 20 minutes prior to cast-off.",
        "hazards_and_safety_notes": "Current may pick up on outgoing tide.",
        "contingency_notes": "If south wind exceeds 15 knots, divert to north bay.",
    }
    res_put = client.put(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/briefing",
        json=update_payload,
        headers=headers,
    )
    assert res_put.status_code == 200
    assert "20 minutes prior" in res_put.json()["meeting_notes"]
    assert "divert to north bay" in res_put.json()["contingency_notes"]

    # 3. GET manager briefing PDF
    res_pdf = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/briefing/pdf",
        headers=headers,
    )
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF-")

    # 4. POST dispatch briefing
    res_dispatch = client.post(
        f"/api/v1/centers/{center.id}/booking-ops/trips/{slot.id}/briefing/dispatch",
        headers=headers,
    )
    assert res_dispatch.status_code == 200
    assert res_dispatch.json()["status"] == "APPROVED_DISPATCHED"

    # 5. Customer download briefing PDF requires booking access token (or owner session)
    res_denied = client.get(f"/api/v1/bookings/{booking.uuid}/briefing")
    assert res_denied.status_code == 401

    access_token = briefing_api_setup["access_token"]
    res_cust_pdf = client.get(
        f"/api/v1/bookings/{booking.uuid}/briefing",
        headers={"X-Booking-Access-Token": access_token},
    )
    assert res_cust_pdf.status_code == 200
    assert res_cust_pdf.headers["content-type"] == "application/pdf"
    assert res_cust_pdf.content.startswith(b"%PDF-")
