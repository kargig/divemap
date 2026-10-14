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

    # Verify rental tier retail price is base_price + 30.0 (105.0)
    from app.models import OctoUnit
    rental_unit = db_session.query(OctoUnit).filter(
        OctoUnit.product_id == slot.product_id,
        OctoUnit.unit_type == "DIVER_RENTAL_GEAR"
    ).first()
    assert rental_unit is not None
    assert float(rental_unit.retail_price) == 105.0

    # Verify disabling booking
    service.provision_or_sync_slot(
        db=db_session,
        trip=trip,
        enable_booking=False
    )
    assert trip.is_bookable is False
    assert trip.octo_slot_id == slot.id  # slot retained for history


def test_provision_slot_equipment_included_same_price(db_session, test_diving_center):
    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=date(2026, 11, 15),
        trip_time=time(10, 0),
        trip_price=90.0,
        trip_currency="EUR",
        group_size_limit=8,
        different_rental_price=False,  # Equipment included!
    )
    db_session.add(trip)
    db_session.commit()

    service = TripOctoProvisioningService()
    slot = service.provision_or_sync_slot(
        db=db_session,
        trip=trip,
        enable_booking=True
    )

    from app.models import OctoUnit
    own_unit = db_session.query(OctoUnit).filter(
        OctoUnit.product_id == slot.product_id,
        OctoUnit.unit_type == "DIVER_OWN_GEAR"
    ).first()
    rental_unit = db_session.query(OctoUnit).filter(
        OctoUnit.product_id == slot.product_id,
        OctoUnit.unit_type == "DIVER_RENTAL_GEAR"
    ).first()

    assert own_unit is not None
    assert rental_unit is not None
    # Same price for both own gear and rental
    assert float(own_unit.retail_price) == 90.0
    assert float(rental_unit.retail_price) == 90.0


def test_provision_slot_custom_rental_price(db_session, test_diving_center):
    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=date(2026, 11, 20),
        trip_time=time(9, 30),
        trip_price=80.0,
        trip_currency="EUR",
        different_rental_price=True,
        custom_rental_price=125.0,  # Custom price override
    )
    db_session.add(trip)
    db_session.commit()

    service = TripOctoProvisioningService()
    slot = service.provision_or_sync_slot(
        db=db_session,
        trip=trip,
        enable_booking=True
    )

    from app.models import OctoUnit
    rental_unit = db_session.query(OctoUnit).filter(
        OctoUnit.product_id == slot.product_id,
        OctoUnit.unit_type == "DIVER_RENTAL_GEAR"
    ).first()

    assert float(rental_unit.retail_price) == 125.0

