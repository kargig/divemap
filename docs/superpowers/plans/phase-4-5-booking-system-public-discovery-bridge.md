# Phase 4.5: Core Discovery, Center Hub & Public Booking Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seamlessly link Divemap's public dive trips and center discovery systems with the OCTO 1.0 booking engine, establishing a dedicated Diving Center Management Portal at `/diving-centers/:id/manage`, instant online booking toggle in trip creation, discovery cards with live availability, and a diver reservations hub at `/profile/bookings`.

**Architecture:**
1. Database migration adding `octo_slot_id` foreign key and `is_bookable` boolean flag to `ParsedDiveTrip` with bidirectional ORM linkage to `OctoAvailabilitySlot`.
2. Dedicated backend provisioning service `TripOctoProvisioningService` that automatically creates and synchronizes `OctoProduct`, `OctoOption`, and `OctoAvailabilitySlot` records when managers enable booking on trips.
3. Authenticated customer reservations endpoint `GET /api/v1/bookings/my-bookings` and manager summary endpoint `GET /api/v1/centers/{center_id}/booking-ops/trips-summary`.
4. Dedicated center management command center `DivingCenterManagePage.jsx` at `/diving-centers/:id/manage` with redirect from `?tab=manage` and direct links to the operations dashboard (`TripOperationsDashboard.jsx`).
5. Diver reservations page `UserBookingsPage.jsx` at `/profile/bookings` with redirect from `/profile?tab=bookings`.
6. Public booking CTAs in `TripCard.jsx` and `TripDetail.jsx` directing directly to `/book/:slotId`.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, MySQL 8.0, React 18, React Router v6, Tailwind CSS, Lucide React, ReportLab.

**Spec:** `docs/superpowers/specs/2026-10-08-booking-system-public-discovery-bridge-design.md`

## Global Constraints
- Naming Convention: Migration files MUST be named sequentially, e.g., `0101_link_parsed_dive_trips_to_octo_slots.py`.
- Safe Backend Testing: NEVER run tests inside `divemap_backend`. Always execute: `cd backend && ./docker-test-github-actions.sh [tests/test_file.py]`.
- Frontend Quality: Run `make lint-frontend` after frontend modifications.
- Browser Verification: Verify with Chrome DevTools MCP tools ensuring 0 console errors.
- Git Protocol: Never execute `git add` or `git commit`. All commits are prepared via `commit-message.txt`.

---

### Task 1: Database Schema & Model Linkage

**Files:**
- Create: `backend/migrations/versions/0101_link_parsed_dive_trips_to_octo_slots.py`
- Modify: `backend/app/models.py`
- Test: `backend/tests/test_trip_octo_link_model.py`

**Interfaces:**
- Consumes: `OctoAvailabilitySlot` (`id` UUID)
- Produces: `ParsedDiveTrip.octo_slot_id`, `ParsedDiveTrip.is_bookable`, `ParsedDiveTrip.octo_slot`, `OctoAvailabilitySlot.dive_trip`

- [x] **Step 1: Write model test verifying relationship and columns**

```python
# backend/tests/test_trip_octo_link_model.py
import pytest
from datetime import date, time, datetime, timezone
from app.models import ParsedDiveTrip, OctoAvailabilitySlot, OctoProduct, OctoOption, DivingCenter

def test_parsed_dive_trip_octo_slot_relationship(db_session, test_diving_center):
    product = OctoProduct(
        diving_center_id=test_diving_center.id,
        internal_name="Boat Dive",
        title="Boat Dive",
        is_active=True
    )
    db_session.add(product)
    db_session.commit()

    option = OctoOption(
        product_id=product.id,
        internal_name="Morning",
        title="Morning",
        is_active=True
    )
    db_session.add(option)
    db_session.commit()

    slot = OctoAvailabilitySlot(
        product_id=product.id,
        option_id=option.id,
        start_datetime=datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 10, 20, 13, 0, tzinfo=timezone.utc),
        seats_total=10,
        seats_available=10,
        base_price=65.0,
        currency="EUR"
    )
    db_session.add(slot)
    db_session.commit()

    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=date(2026, 10, 20),
        trip_time=time(9, 0),
        trip_duration="4h",
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
    assert loaded_trip.octo_slot.id == slot.id
    assert slot.dive_trip.id == trip.id
```

- [x] **Step 2: Run test in isolated Docker to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_trip_octo_link_model.py`
Expected: FAIL with AttributeError or missing column `octo_slot_id`

- [x] **Step 3: Update `backend/app/models.py`**

Add `octo_slot_id`, `is_bookable`, and `octo_slot` relationship to `ParsedDiveTrip`:
```python
    octo_slot_id = Column(
        String(36),
        ForeignKey("octo_availability_slots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_bookable = Column(Boolean, default=False, nullable=False)

    octo_slot = relationship(
        "OctoAvailabilitySlot",
        backref=sa.orm.backref("dive_trip", uselist=False),
        foreign_keys=[octo_slot_id],
    )
```

- [x] **Step 4: Create migration `backend/migrations/versions/0101_link_parsed_dive_trips_to_octo_slots.py`**

```python
"""link parsed dive trips to octo slots

Revision ID: 0101
Revises: 0100
Create Date: 2026-10-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0101'
down_revision = '0100'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('parsed_dive_trips', sa.Column('octo_slot_id', sa.String(length=36), nullable=True))
    op.add_column('parsed_dive_trips', sa.Column('is_bookable', sa.Boolean(), server_default='0', nullable=False))
    op.create_index(op.f('ix_parsed_dive_trips_octo_slot_id'), 'parsed_dive_trips', ['octo_slot_id'], unique=False)
    op.create_foreign_key(
        'fk_parsed_dive_trips_octo_slot_id',
        'parsed_dive_trips', 'octo_availability_slots',
        ['octo_slot_id'], ['id'],
        ondelete='SET NULL'
    )

def downgrade():
    op.drop_constraint('fk_parsed_dive_trips_octo_slot_id', 'parsed_dive_trips', type_='foreignkey')
    op.drop_index(op.f('ix_parsed_dive_trips_octo_slot_id'), table_name='parsed_dive_trips')
    op.drop_column('parsed_dive_trips', 'is_bookable')
    op.drop_column('parsed_dive_trips', 'octo_slot_id')
```

- [x] **Step 5: Run tests in isolated Docker to verify schema and model pass**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_trip_octo_link_model.py`
Expected: PASS

- [x] **Step 6: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 2: Automatic OCTO Provisioning Service

**Files:**
- Create: `backend/app/services/trip_octo_provisioning_service.py`
- Test: `backend/tests/test_trip_octo_provisioning_service.py`

**Interfaces:**
- Produces: `TripOctoProvisioningService.provision_or_sync_slot(db, trip, enable_booking, base_price, currency, seats_limit)`
- Consumes: `ParsedDiveTrip`, `OctoProduct`, `OctoOption`, `OctoAvailabilitySlot`

- [x] **Step 1: Write unit tests for provisioning service**

```python
# backend/tests/test_trip_octo_provisioning_service.py
import pytest
from datetime import date, time
from app.models import ParsedDiveTrip, OctoProduct, OctoAvailabilitySlot
from app.services.trip_octo_provisioning_service import TripOctoProvisioningService

def test_provision_slot_creates_product_option_and_slot(db_session, test_diving_center):
    trip = ParsedDiveTrip(
        diving_center_id=test_diving_center.id,
        trip_date=date(2026, 10, 25),
        trip_time=time(10, 0),
        trip_duration="3 hours",
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

    # Disable booking test
    service.provision_or_sync_slot(
        db=db_session,
        trip=trip,
        enable_booking=False
    )
    assert trip.is_bookable is False
    assert trip.octo_slot_id == slot.id  # slot retained for history
```

- [x] **Step 2: Run test in isolated Docker to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_trip_octo_provisioning_service.py`
Expected: FAIL with ModuleNotFoundError

- [x] **Step 3: Implement `TripOctoProvisioningService`**

```python
# backend/app/services/trip_octo_provisioning_service.py
import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models import ParsedDiveTrip, OctoProduct, OctoOption, OctoUnit, OctoAvailabilitySlot

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
            OctoProduct.internal_name == "guided-boat-dive"
        ).first()

        if not product:
            product = OctoProduct(
                id=str(uuid.uuid4()),
                diving_center_id=center_id,
                internal_name="guided-boat-dive",
                title="Guided Boat Dive",
                description="Professional boat dive with certified dive guide and safety briefings.",
                is_active=True
            )
            db.add(product)
            db.flush()

            # Ensure default Adult Diver unit exists
            unit = OctoUnit(
                id=str(uuid.uuid4()),
                product_id=product.id,
                internal_name="adult-diver",
                title="Certified Diver",
                type="ADULT",
                pricing_currency=currency or "EUR",
                price_amount=base_price or 60.0
            )
            db.add(unit)
            db.flush()

        # 2. Resolve or create default Option
        option = db.query(OctoOption).filter(
            OctoOption.product_id == product.id,
            OctoOption.internal_name == "standard-departure"
        ).first()

        if not option:
            option = OctoOption(
                id=str(uuid.uuid4()),
                product_id=product.id,
                internal_name="standard-departure",
                title="Standard Scheduled Departure",
                is_active=True
            )
            db.add(option)
            db.flush()

        # 3. Calculate start and end datetimes
        trip_date = trip.trip_date or datetime.now(timezone.utc).date()
        trip_time = trip.trip_time or datetime.min.time()
        start_dt = datetime.combine(trip_date, trip_time).replace(tzinfo=timezone.utc)

        duration_hours = 4
        if trip.trip_duration:
            match = re.search(r'(\d+)', trip.trip_duration)
            if match:
                duration_hours = int(match.group(1))
        end_dt = start_dt + timedelta(hours=duration_hours)

        total_seats = seats_limit or trip.group_size_limit or 12
        price = base_price if base_price is not None else (float(trip.trip_price) if trip.trip_price else 60.0)

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
                base_price=price,
                currency=currency or "EUR",
                is_active=True
            )
            db.add(slot)
            db.flush()
            trip.octo_slot_id = slot.id
        else:
            slot.start_datetime = start_dt
            slot.end_datetime = end_dt
            slot.seats_total = total_seats
            slot.seats_available = max(0, total_seats - (trip.current_bookings or 0))
            slot.base_price = price
            slot.currency = currency or "EUR"
            slot.is_active = True

        trip.is_bookable = True
        trip.group_size_limit = total_seats
        db.commit()
        return slot
```

- [x] **Step 4: Run test in isolated Docker to verify it passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_trip_octo_provisioning_service.py`
Expected: PASS

- [x] **Step 5: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 3: Backend API Endpoints & Discovery Enhancements

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/routers/trips.py`
- Modify: `backend/app/routers/bookings.py`
- Modify: `backend/app/routers/center_booking_ops.py`
- Test: `backend/tests/test_trip_octo_bridge_api.py`

**Interfaces:**
- Produces:
  - `GET /api/v1/bookings/my-bookings`
  - `GET /api/v1/centers/{center_id}/booking-ops/trips-summary`
  - `is_bookable`, `octo_slot_id`, `seats_available` in trip schemas

- [x] **Step 1: Write failing API test**

```python
# backend/tests/test_trip_octo_bridge_api.py
import pytest
from datetime import date, time
from app.models import ParsedDiveTrip

def test_trip_creation_with_online_booking(client, auth_headers, test_diving_center, db_session):
    payload = {
        "diving_center_id": test_diving_center.id,
        "trip_date": str(date(2026, 10, 28)),
        "trip_time": "09:30:00",
        "trip_duration": "4h",
        "trip_description": "Exclusive Reef Dive",
        "group_size_limit": 10,
        "trip_price": "70",
        "trip_currency": "EUR",
        "enable_online_booking": True
    }
    response = client.post("/api/v1/dive-trips", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["is_bookable"] is True
    assert data["octo_slot_id"] is not None
    assert data["seats_available"] == 10

def test_my_bookings_endpoint(client, auth_headers, test_user):
    response = client.get("/api/v1/bookings/my-bookings", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_center_trips_summary_endpoint(client, auth_headers, test_diving_center):
    response = client.get(
        f"/api/v1/centers/{test_diving_center.id}/booking-ops/trips-summary",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

- [x] **Step 2: Run test in isolated Docker to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_trip_octo_bridge_api.py`
Expected: FAIL

- [x] **Step 3: Update `backend/app/schemas/__init__.py`**

Add booking fields to `ParsedDiveTripCreate`, `ParsedDiveTripUpdate`, and `ParsedDiveTripResponse`:
```python
# In ParsedDiveTripCreate & ParsedDiveTripUpdate:
enable_online_booking: Optional[bool] = False

# In ParsedDiveTripResponse:
is_bookable: bool = False
octo_slot_id: Optional[str] = None
seats_available: Optional[int] = None
base_price: Optional[float] = None
```

- [x] **Step 4: Update `backend/app/routers/trips.py`**

In `create_parsed_dive_trip` and `update_parsed_dive_trip`:
Call `TripOctoProvisioningService().provision_or_sync_slot()` when `enable_online_booking` is provided. Enrich response with `seats_available` from `octo_slot`. Add `bookable_only: Optional[bool] = False` filter to `get_parsed_dive_trips`.

- [x] **Step 5: Implement `GET /api/v1/bookings/my-bookings` in `backend/app/routers/bookings.py`**

```python
class MyBookingItemResponse(BaseModel):
    bookingUuid: str
    reference: str
    status: str
    paymentStatus: str
    paymentMode: str
    totalAmount: float
    currency: str
    tripDate: Optional[str] = None
    centerId: int
    centerName: str
    slotId: str
    tripId: Optional[int] = None
    participantsCount: int
    hasBriefing: bool

@router.get("/my-bookings", response_model=List[MyBookingItemResponse])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookings = (
        db.query(OctoBooking)
        .filter(OctoBooking.user_id == current_user.id)
        .order_by(OctoBooking.created_at.desc())
        .all()
    )
    res = []
    for b in bookings:
        trip = b.slot.dive_trip if b.slot else None
        res.append(MyBookingItemResponse(
            bookingUuid=b.uuid,
            reference=b.reference or f"DIVEMAP-{b.uuid[:8].upper()}",
            status=b.status,
            paymentStatus=b.payment_status or "PENDING",
            paymentMode=b.payment_mode or "PAY_ON_ARRIVAL",
            totalAmount=float(b.total_amount or 0.0),
            currency=b.currency or "EUR",
            tripDate=b.slot.start_datetime.isoformat() if b.slot else None,
            centerId=b.center_id,
            centerName=b.center.name if b.center else "Diving Center",
            slotId=b.availability_id,
            tripId=trip.id if trip else None,
            participantsCount=len(b.unit_items),
            hasBriefing=bool(b.slot and b.slot.briefing)
        ))
    return res
```

- [x] **Step 6: Implement `GET /trips-summary` in `backend/app/routers/center_booking_ops.py`**

```python
class CenterTripSummaryItem(BaseModel):
    tripId: int
    tripDate: str
    tripTime: Optional[str] = None
    title: Optional[str] = None
    isBookable: bool
    octoSlotId: Optional[str] = None
    seatsTotal: int
    seatsBooked: int
    seatsAvailable: int
    occupancyRate: float
    hasBriefing: bool
    briefingStatus: Optional[str] = None

@router.get("/trips-summary", response_model=List[CenterTripSummaryItem])
def get_center_trips_summary(
    center_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    center = get_managed_center(db, center_id, current_user)
    trips = (
        db.query(ParsedDiveTrip)
        .filter(ParsedDiveTrip.diving_center_id == center.id)
        .order_by(ParsedDiveTrip.trip_date.asc(), ParsedDiveTrip.trip_time.asc())
        .all()
    )
    results = []
    for t in trips:
        total = t.group_size_limit or 12
        booked = t.current_bookings or 0
        if t.octo_slot:
            total = t.octo_slot.seats_total
            booked = total - t.octo_slot.seats_available
        avail = max(0, total - booked)
        rate = round(booked / total, 2) if total > 0 else 0.0

        results.append(CenterTripSummaryItem(
            tripId=t.id,
            tripDate=str(t.trip_date),
            tripTime=str(t.trip_time) if t.trip_time else None,
            title=t.trip_description or f"Trip on {t.trip_date}",
            isBookable=bool(t.is_bookable and t.octo_slot_id),
            octoSlotId=t.octo_slot_id,
            seatsTotal=total,
            seatsBooked=booked,
            seatsAvailable=avail,
            occupancyRate=rate,
            hasBriefing=bool(t.octo_slot and t.octo_slot.briefing),
            briefingStatus=t.octo_slot.briefing.status if (t.octo_slot and t.octo_slot.briefing) else None
        ))
    return results
```

- [x] **Step 7: Run tests in isolated Docker to verify API passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_trip_octo_bridge_api.py`
Expected: PASS

- [x] **Step 8: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 4: Diver Reservations Hub (`UserBookingsPage.jsx`)

**Files:**
- Create: `frontend/src/pages/UserBookingsPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Profile.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/bookings/my-bookings`
- Produces: Route `/profile/bookings`, redirect `/profile?tab=bookings` $	o$ `/profile/bookings`

- [x] **Step 1: Create `frontend/src/pages/UserBookingsPage.jsx`**

Implement high-density, mobile-first reservations dashboard rendering upcoming and past booking cards, status badges, total prices, digital voucher links (`/bookings/:uuid/voucher`), and PDF briefing downloads.

- [x] **Step 2: Register routes in `frontend/src/App.jsx`**

```jsx
<Route
  path='/profile/bookings'
  element={
    <ProtectedRoute>
      <UserBookingsPage />
    </ProtectedRoute>
  }
/>
```
Add redirect from `/profile?tab=bookings` to `/profile/bookings`.

- [x] **Step 3: Update `frontend/src/pages/Profile.jsx`**

Add "My Bookings" button and icon in the Profile navigation sidebar.

- [x] **Step 4: Run frontend lint**

Run: `make lint-frontend`
Expected: 0 errors

- [x] **Step 5: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 5: Diving Center Management Portal (`DivingCenterManagePage.jsx`)

**Files:**
- Create: `frontend/src/pages/DivingCenterManagePage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/centers/{center_id}/booking-ops/trips-summary`
- Produces: Route `/diving-centers/:id/manage` and `/diving-centers/:id/:slug/manage`, redirect from `?tab=manage`

- [x] **Step 1: Implement `DivingCenterManagePage.jsx`**

Build the command center containing:
- Header with center identity and "View Public Profile" button.
- Quick action pills: `Create Trip`, `Manage Gear Rental Pricing`.
- **Trips & Booking Console:**
  - Table and mobile card stack of all trips.
  - Visual capacity meter (`X / Y seats booked`, color-coded by occupancy).
  - Online booking status indicator.
  - Primary button: **"Operations & Manifest"** linking to `/manage/centers/:centerId/trips/:slotId`.
  - Secondary buttons: Edit trip modal, view public trip.
- Team Managers and Announcements management sections.

- [x] **Step 2: Register routes in `frontend/src/App.jsx`**

```jsx
<Route
  path='/diving-centers/:id/manage'
  element={
    <ProtectedRoute>
      <DivingCenterManagePage />
    </ProtectedRoute>
  }
/>
<Route
  path='/diving-centers/:id/:slug/manage'
  element={
    <ProtectedRoute>
      <DivingCenterManagePage />
    </ProtectedRoute>
  }
/>
```

- [x] **Step 3: Add automatic redirect in `DivingCenterDetail.jsx`**

If user navigates to `?tab=manage`, redirect immediately to `/diving-centers/${id}/${slug || 'center'}/manage`.
Update the "Manage" tab button in the navigation bar to directly link to `/diving-centers/${id}/${slug || 'center'}/manage`.

- [x] **Step 4: Run frontend lint**

Run: `make lint-frontend`
Expected: 0 errors

- [x] **Step 5: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 6: Trip Form Online Booking Toggle (`TripFormModal.jsx`)

**Files:**
- Modify: `frontend/src/components/TripFormModal.jsx`
- Modify: `frontend/src/pages/CreateTrip.jsx`

**Interfaces:**
- Submits: `enable_online_booking: boolean` in payload to `POST /api/v1/dive-trips` and `PUT /api/v1/dive-trips/:id`

- [x] **Step 1: Update form default values and inputs in `TripFormModal.jsx`**

Add:
- Toggle switch: "Enable Instant Online Booking"
- Informational banner explaining that enabling online booking activates digital paperwork, automated manifests, and online reservations.
- Sync `group_size_limit` with capacity.

- [x] **Step 2: Run frontend lint**

Run: `make lint-frontend`
Expected: 0 errors

- [x] **Step 3: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 7: Public Discovery & Booking CTAs (`TripCard.jsx` & `TripDetail.jsx`)

**Files:**
- Modify: `frontend/src/components/TripCard.jsx`
- Modify: `frontend/src/pages/TripDetail.jsx`
- Modify: `frontend/src/pages/Trips.jsx` (Filter Bar)

**Interfaces:**
- Links: Directly to `/book/:slotId` when `trip.is_bookable` is True

- [x] **Step 1: Enhance `TripCard.jsx`**

- Render emerald "Instant Booking" badge when `trip.is_bookable`.
- Render remaining seats badge (`X seats left`).
- Add secondary "Book Now" button linking straight to `/book/${trip.octo_slot_id}`.

- [x] **Step 2: Enhance `TripDetail.jsx`**

- In Header: Add primary "Book Online" CTA button with price and seats remaining.
- In Booking Tab: If `trip.is_bookable`, replace the contact-only box with an interactive "Instant Online Booking" card displaying price, seats available, cancellation terms, and a large "Proceed to Booking" button navigating to `/book/${trip.octo_slot_id}`.

- [x] **Step 3: Add Filter in `Trips.jsx`**

Add "Instant Booking Only" filter checkbox/toggle to the trip discovery search filters.

- [x] **Step 4: Run frontend lint**

Run: `make lint-frontend`
Expected: 0 errors

- [x] **Step 5: Prepare commit draft**

Write commit draft to `commit-message.txt`.

---

### Task 8: End-to-End Verification & Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-09-27-divemap-octo-booking-plan-of-plans.md`
- Test: All automated test suites

- [x] **Step 1: Run complete backend test suite in isolated Docker**

Run: `cd backend && ./docker-test-github-actions.sh`
Expected: `All tests passed!`

- [x] **Step 2: Run frontend lint suite**

Run: `make lint-frontend`
Expected: 0 errors

- [x] **Step 3: Verify user journeys in browser with Chrome DevTools MCP**

1. Navigate to `/diving-centers/56/manage` $\to$ verify 0 console errors.
2. Navigate to `/diving-centers/56?tab=manage` $\to$ verify clean redirect to `/diving-centers/56/manage` with 0 console errors.
3. Navigate to `/dive-trips` $\to$ verify "Instant Booking" badges and filter with 0 console errors.
4. Navigate to `/profile/bookings` $\to$ verify 0 console errors.

- [x] **Step 4: Update Master Roadmap (`2026-09-27-divemap-octo-booking-plan-of-plans.md`)**

Insert Phase 4.5 between Phase 4 and Phase 5 as the active execution phase.

- [x] **Step 5: Prepare commit draft**

Write commit draft to `commit-message.txt`.
