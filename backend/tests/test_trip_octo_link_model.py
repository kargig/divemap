import pytest
import uuid
from datetime import date, time, datetime, timezone
from app.models import ParsedDiveTrip, OctoAvailabilitySlot, OctoProduct, OctoOption, DivingCenter

def test_parsed_dive_trip_octo_slot_relationship(db_session, test_diving_center):
    product = OctoProduct(
        id=str(uuid.uuid4()),
        diving_center_id=test_diving_center.id,
        title="Guided Boat Dive",
        is_active=True
    )
    db_session.add(product)
    db_session.commit()

    option = OctoOption(
        id=str(uuid.uuid4()),
        product_id=product.id,
        title="09:00 Departure",
        meeting_time=time(8, 30),
        departure_time=time(9, 0),
        duration_minutes=240,
        max_capacity=10,
        is_active=True
    )
    db_session.add(option)
    db_session.commit()

    slot = OctoAvailabilitySlot(
        id=str(uuid.uuid4()),
        product_id=product.id,
        option_id=option.id,
        start_datetime=datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 10, 20, 13, 0, tzinfo=timezone.utc),
        seats_total=10,
        seats_available=10,
    )
    db_session.add(slot)
    db_session.commit()

    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=date(2026, 10, 20),
        trip_time=time(9, 0),
        trip_duration=240,
        trip_description="Morning Wreck Dive",
        group_size_limit=10,
        is_bookable=True,
        octo_slot_id=slot.id
    )
    db_session.add(trip)
    db_session.commit()

    loaded_trip = db_session.query(ParsedDiveTrip).filter(ParsedDiveTrip.id == trip.id).first()
    assert loaded_trip.is_bookable is True
    assert loaded_trip.octo_slot_id == slot.id
    assert loaded_trip.octo_slot is not None
    assert loaded_trip.octo_slot.id == slot.id
    assert slot.dive_trip is not None
    assert slot.dive_trip.id == trip.id
