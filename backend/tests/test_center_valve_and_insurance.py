from datetime import UTC, datetime, time, timedelta

from app.auth import create_access_token
from app.models import (
    DivingCenter,
    DivingCenterBookingSettings,
    OctoAvailabilitySlot,
    OctoOption,
    OctoProduct,
    OctoUnit,
    OwnershipStatus,
    User,
)
from app.services.booking_pricing_service import compute_participant_octo_pricing


def test_center_valve_and_insurance_settings(client, db_session, test_user):
    center = DivingCenter(
        name="Santorini Dive Club",
        owner_id=test_user.id,
        ownership_status=OwnershipStatus.approved,
        email="ops@santorinidive.com",
    )
    db_session.add(center)
    db_session.flush()

    token = create_access_token({"sub": test_user.username})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update rental pricing with default valve and daily insurance
    put_res = client.put(
        f"/api/v1/centers/{center.id}/booking-ops/rental-pricing",
        json={
            "currency": "EUR",
            "full_kit_package": 35.0,
            "default_valve_fitting": "YOKE",
            "daily_insurance_price": 5.0,
        },
        headers=headers,
    )
    assert put_res.status_code == 200

    # 2. Get rental pricing
    get_res = client.get(
        f"/api/v1/centers/{center.id}/booking-ops/rental-pricing",
        headers=headers,
    )
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["default_valve_fitting"] == "YOKE"
    assert data["daily_insurance_price"] == 5.0

    # 3. Test checkout context returns center_settings
    product = OctoProduct(
        id="prod-valve-test",
        diving_center_id=center.id,
        title="Volcano Trip",
        product_type="GUIDED_BOAT_TRIP",
    )
    option = OctoOption(
        id="opt-valve-test",
        product_id=product.id,
        title="Morning",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    db_session.add_all([product, option])
    db_session.flush()

    start_dt = datetime.now(UTC) + timedelta(days=2)
    slot = OctoAvailabilitySlot(
        id="slot-valve-test",
        product_id=product.id,
        option_id=option.id,
        start_datetime=start_dt,
        end_datetime=start_dt + timedelta(hours=3),
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)
    db_session.commit()

    ctx_res = client.get(
        f"/api/v1/bookings/checkout-context/{slot.id}",
        headers=headers,
    )
    assert ctx_res.status_code == 200
    ctx_data = ctx_res.json()
    assert "center_settings" in ctx_data
    assert ctx_data["center_settings"]["default_valve_fitting"] == "YOKE"
    assert ctx_data["center_settings"]["daily_insurance_price"] == 5.0

    # 4. Test compute_participant_octo_pricing adds insurance line item
    unit = OctoUnit(
        id="unit-insurance-test",
        product_id=product.id,
        unit_type="DIVER_RENTAL_GEAR",
        title="Certified Diver (Full Rental)",
        retail_price=90.0,
    )
    db_session.add(unit)
    db_session.commit()

    c_settings = (
        db_session.query(DivingCenterBookingSettings)
        .filter(DivingCenterBookingSettings.diving_center_id == center.id)
        .first()
    )

    pricing_with_ins = compute_participant_octo_pricing(
        center_settings=c_settings,
        unit=unit,
        equipment_sizing={"insurance_type": "CENTER"},
        currency="EUR",
    )
    # 90.0 base + 5.0 insurance = 95.0
    assert pricing_with_ins["total_due"] == 95.0
    item_titles = [it["title"] for it in pricing_with_ins["line_items"]]
    assert any("Insurance" in t for t in item_titles)
