import uuid
from datetime import datetime, timedelta, time, UTC
from typing import Optional
from sqlalchemy.orm import Session
from app.models import (
    ParsedDiveTrip,
    OctoProduct,
    OctoOption,
    OctoUnit,
    OctoAvailabilitySlot,
    DivingCenterBookingSettings,
)

class TripOctoProvisioningService:
    def provision_or_sync_slot(
        self,
        db: Session,
        trip: ParsedDiveTrip,
        enable_booking: bool,
        base_price: Optional[float] = None,
        currency: Optional[str] = "EUR",
        seats_limit: Optional[int] = None,
    ) -> Optional[OctoAvailabilitySlot]:
        if not enable_booking:
            trip.is_bookable = False
            db.commit()
            return trip.octo_slot

        center_id = trip.diving_center_id
        if not center_id:
            return None

        # 1. Resolve or create default Product for center
        product = db.query(OctoProduct).filter(
            OctoProduct.diving_center_id == center_id,
            OctoProduct.title == "Guided Boat Dive"
        ).first()

        if not product:
            product = OctoProduct(
                id=str(uuid.uuid4()),
                diving_center_id=center_id,
                title="Guided Boat Dive",
                description="Professional guided boat dive with certified dive guide and safety briefing.",
                product_type="GUIDED_BOAT_TRIP",
                dives_count=2,
                waiver_bundle_id="dmsc_recreational",
                is_active=True
            )
            db.add(product)
            db.flush()

        # Ensure default Adult Diver unit (Own Gear) exists for product
        price = base_price if base_price is not None else (float(trip.trip_price) if trip.trip_price else 60.0)
        curr = currency or trip.trip_currency or "EUR"

        unit = db.query(OctoUnit).filter(
            OctoUnit.product_id == product.id,
            OctoUnit.unit_type == "DIVER_OWN_GEAR"
        ).first()

        if not unit:
            unit = OctoUnit(
                id=str(uuid.uuid4()),
                product_id=product.id,
                unit_type="DIVER_OWN_GEAR",
                title="Certified Diver (Own Gear)",
                retail_price=price,
                currency=curr,
                is_active=True
            )
            db.add(unit)
            db.flush()
        else:
            unit.retail_price = price
            unit.currency = curr

        # 1b. Resolve or create rental gear tier (DIVER_RENTAL_GEAR)
        different_price = getattr(trip, "different_rental_price", True)
        if different_price is False:
            rental_price = price
        elif getattr(trip, "custom_rental_price", None) is not None:
            rental_price = float(trip.custom_rental_price)
        else:
            settings = db.query(DivingCenterBookingSettings).filter(
                DivingCenterBookingSettings.diving_center_id == center_id
            ).first()
            rental_addon = 30.0
            if settings and settings.rental_equipment_pricing and isinstance(settings.rental_equipment_pricing, dict):
                rental_addon = float(
                    settings.rental_equipment_pricing.get("full_kit_package")
                    or settings.rental_equipment_pricing.get("full_kit")
                    or 30.0
                )
            rental_price = price + rental_addon

        rental_unit = db.query(OctoUnit).filter(
            OctoUnit.product_id == product.id,
            OctoUnit.unit_type == "DIVER_RENTAL_GEAR"
        ).first()

        if not rental_unit:
            rental_unit = OctoUnit(
                id=str(uuid.uuid4()),
                product_id=product.id,
                unit_type="DIVER_RENTAL_GEAR",
                title="Certified Diver (Full Equipment Rental)",
                retail_price=rental_price,
                currency=curr,
                is_active=True
            )
            db.add(rental_unit)
            db.flush()
        else:
            rental_unit.retail_price = rental_price
            rental_unit.currency = curr

        # 2. Resolve or create default Option
        option = db.query(OctoOption).filter(
            OctoOption.product_id == product.id,
            OctoOption.title == "Standard Departure"
        ).first()

        duration_mins = trip.trip_duration if isinstance(trip.trip_duration, int) else 240
        total_seats = seats_limit or trip.group_size_limit or 12

        if not option:
            option = OctoOption(
                id=str(uuid.uuid4()),
                product_id=product.id,
                title="Standard Departure",
                meeting_time=trip.trip_time or time(9, 0),
                departure_time=trip.trip_time or time(9, 30),
                duration_minutes=duration_mins,
                max_capacity=total_seats,
                is_active=True
            )
            db.add(option)
            db.flush()
        else:
            option.duration_minutes = duration_mins
            option.max_capacity = total_seats

        # 3. Calculate start and end datetimes
        trip_date = trip.trip_date or datetime.now(UTC).date()
        trip_time = trip.trip_time or time(9, 0)
        start_dt = datetime.combine(trip_date, trip_time).replace(tzinfo=UTC)
        end_dt = start_dt + timedelta(minutes=duration_mins)

        # 4. Resolve or create Slot
        slot = None
        if trip.octo_slot_id:
            slot = db.query(OctoAvailabilitySlot).filter(OctoAvailabilitySlot.id == trip.octo_slot_id).first()

        if not slot:
            slot = OctoAvailabilitySlot(
                id=str(uuid.uuid4()),
                product_id=product.id,
                option_id=option.id,
                start_datetime=start_dt,
                end_datetime=end_dt,
                seats_total=total_seats,
                seats_available=total_seats - (trip.current_bookings or 0),
                is_closed=False
            )
            db.add(slot)
            db.flush()
            trip.octo_slot_id = slot.id
        else:
            slot.start_datetime = start_dt
            slot.end_datetime = end_dt
            slot.seats_total = total_seats
            slot.seats_available = max(0, total_seats - (trip.current_bookings or 0))
            slot.is_closed = False

        trip.is_bookable = True
        trip.group_size_limit = total_seats
        if base_price is not None:
            trip.trip_price = base_price
        if currency:
            trip.trip_currency = currency

        db.commit()
        db.refresh(trip)
        db.refresh(slot)
        return slot
