import pytest
from datetime import datetime, time, timezone
from sqlalchemy.orm import Session
from app.models import (
    DivingCenter,
    DivingCenterBookingSettings,
    DivingCenterVessel,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    OctoBooking,
    OctoBookingUnitItem,
    DiverMedicalRecord,
)

def test_octo_core_relationships(db_session: Session, test_diving_center: DivingCenter, test_user):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        default_currency="EUR",
        payment_mode="PAY_ON_ARRIVAL",
    )
    db_session.add(settings)
    
    vessel = DivingCenterVessel(
        diving_center_id=test_diving_center.id,
        name="Aegean Explorer",
        registration_number="GR-PIR-49102",
        licensed_capacity=14,
    )
    db_session.add(vessel)
    db_session.flush()
    
    product = OctoProduct(
        id="prod-uuid-1",
        diving_center_id=test_diving_center.id,
        title="2-Tank Morning Boat Dive",
        product_type="GUIDED_BOAT_TRIP",
    )
    db_session.add(product)
    db_session.flush()
    
    option = OctoOption(
        id="opt-uuid-1",
        product_id=product.id,
        title="08:30 Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        max_capacity=10,
    )
    unit = OctoUnit(
        id="unit-uuid-1",
        product_id=product.id,
        unit_type="DIVER_OWN_GEAR",
        title="Certified Diver (Own Gear)",
        retail_price=75.00,
        currency="EUR",
    )
    db_session.add_all([option, unit])
    db_session.flush()
    
    slot = OctoAvailabilitySlot(
        id="slot-uuid-1",
        product_id=product.id,
        option_id=option.id,
        vessel_id=vessel.id,
        assigned_guide_user_ids=[test_user.id],
        start_datetime=datetime(2026, 10, 1, 8, 30, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 10, 1, 13, 0, tzinfo=timezone.utc),
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)
    db_session.commit()
    
    assert slot.seats_available == 10
    assert slot.vessel_id == vessel.id
    
    # Test booking creation
    booking = OctoBooking(
        uuid="book-uuid-1",
        diving_center_id=test_diving_center.id,
        product_id=product.id,
        option_id=option.id,
        availability_id=slot.id,
        user_id=test_user.id,
        status="CONFIRMED",
        total_amount=75.00,
        currency="EUR",
        payment_mode="PAY_ON_ARRIVAL",
        payment_status="PENDING_AT_CHECKIN",
    )
    db_session.add(booking)
    db_session.flush()
    
    unit_item = OctoBookingUnitItem(
        id="item-uuid-1",
        booking_uuid=booking.uuid,
        unit_id=unit.id,
        user_id=test_user.id,
        diver_full_name="Jean-Luc Picard",
        diver_email="picard@starfleet.org",
        certification_agency="PADI",
        certification_level="Rescue Diver",
        selected_tank_id="12",
        selected_gas_mix_id="air",
    )
    db_session.add(unit_item)
    db_session.commit()
    
    assert unit_item.diver_full_name == "Jean-Luc Picard"
    assert len(booking.unit_items) == 1
