import pytest
from datetime import date, time
from app.models import ParsedDiveTrip, OctoProduct, OctoAvailabilitySlot
from app.services.trip_octo_provisioning_service import TripOctoProvisioningService

def test_provision_slot_creates_product_option_and_slot(db_session, test_diving_center):
    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=date(2026, 10, 25),
        trip_time=time(10, 0),
        trip_duration=180,
        trip_description="Two Tank Boat Dive",
        group_size_limit=12,
        is_bookable=False
    )
    db_session.add(trip)
    db_session.commit()

    service = TripOctoProvisioningService()
    slot = service.provision_or_sync_slot(
        db=db_session,
        trip=trip,
        enable_booking=True,
        base_price=75.0,
        currency="EUR",
        seats_limit=12
    )

    assert slot is not None
    assert trip.is_bookable is True
    assert trip.octo_slot_id == slot.id
    assert slot.base_price == 75.0
    assert slot.currency == "EUR"
    assert slot.seats_total == 12
    assert slot.seats_available == 12

    # Verify disabling booking
    service.provision_or_sync_slot(
        db=db_session,
        trip=trip,
        enable_booking=False
    )
    assert trip.is_bookable is False
    assert trip.octo_slot_id == slot.id  # slot retained for history
