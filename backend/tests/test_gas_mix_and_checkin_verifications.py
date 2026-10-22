import uuid
from datetime import UTC, datetime, time, timezone

from app.models import (
    DivingCenterBookingSettings,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    OctoOption,
    OctoProduct,
    OctoUnit,
)


def test_octo_booking_unit_item_gas_status_and_checkin(
    db_session, test_user, test_diving_center
):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        default_currency="EUR",
        payment_mode="PAY_ON_ARRIVAL",
    )
    db_session.add(settings)

    product = OctoProduct(
        id=f"prod-{uuid.uuid4().hex[:8]}",
        diving_center_id=test_diving_center.id,
        title="2-Tank Morning Boat Dive",
        product_type="GUIDED_BOAT_TRIP",
    )
    db_session.add(product)
    db_session.flush()

    option = OctoOption(
        id=f"opt-{uuid.uuid4().hex[:8]}",
        product_id=product.id,
        title="08:30 Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    db_session.add(option)
    db_session.flush()

    unit = OctoUnit(
        id=f"unit-{uuid.uuid4().hex[:8]}",
        product_id=product.id,
        title="Certified Diver",
        unit_type="DIVER_OWN_GEAR",
        retail_price=85.0,
        currency="EUR",
    )
    db_session.add(unit)
    db_session.flush()

    slot = OctoAvailabilitySlot(
        id=f"slot-{uuid.uuid4().hex[:8]}",
        product_id=product.id,
        option_id=option.id,
        start_datetime=datetime(2026, 11, 10, 9, 0, tzinfo=UTC),
        end_datetime=datetime(2026, 11, 10, 13, 0, tzinfo=UTC),
        seats_total=12,
        seats_available=12,
        is_closed=False,
    )
    db_session.add(slot)
    db_session.flush()

    booking = OctoBooking(
        uuid=str(uuid.uuid4()),
        diving_center_id=test_diving_center.id,
        product_id=product.id,
        option_id=option.id,
        availability_id=slot.id,
        user_id=test_user.id,
        status="CONFIRMED",
        total_amount=85.00,
        currency="EUR",
        payment_mode="PAY_ON_ARRIVAL",
        payment_status="PENDING_AT_CHECKIN",
    )
    db_session.add(booking)
    db_session.flush()

    unit_item = OctoBookingUnitItem(
        id=f"item-{uuid.uuid4().hex[:8]}",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        user_id=test_user.id,
        diver_full_name="Jacques Cousteau",
        diver_email="cousteau@ocean.org",
        certification_agency="CMAS",
        certification_level="3 Star Diver",
        selected_tank_id="12",
        selected_gas_mix_id="air",
    )
    db_session.add(unit_item)
    db_session.commit()
    db_session.refresh(unit_item)

    assert unit_item.gas_mix_status == "APPROVED"
    assert unit_item.checkin_verifications is None

    # Update gas_mix_status to PENDING_APPROVAL and set checkin_verifications dictionary
    unit_item.gas_mix_status = "PENDING_APPROVAL"
    unit_item.checkin_verifications = {
        "doctor_note_verified": True,
        "nitrox_cert_verified": False,
        "c_card_verified": True,
    }
    db_session.commit()
    db_session.refresh(unit_item)

    assert unit_item.gas_mix_status == "PENDING_APPROVAL"
    assert unit_item.checkin_verifications["doctor_note_verified"] is True
    assert unit_item.checkin_verifications["nitrox_cert_verified"] is False
    assert unit_item.checkin_verifications["c_card_verified"] is True
