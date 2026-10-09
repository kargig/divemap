# Phase 4.5: Core Discovery, Center Hub & Public Booking Bridge Specification

- **Date:** 2026-10-08
- **Status:** Approved Design Specification
- **Parent Plan:** `docs/superpowers/plans/2026-09-27-divemap-octo-booking-plan-of-plans.md`
- **Related Specs:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md`

---

## 1. Executive Summary & Goals

Phases 1 through 4 delivered the foundational engines of the Divemap Booking System:
1. Biometric diver profiles and encrypted medical questionnaires (GDPR Article 9).
2. The OCTO 1.0 booking engine, pricing structure, and 5-step checkout wizard.
3. Daily operations dashboard (`TripOperationsDashboard.jsx`) with live manifests, crate loadouts, bench inspection sheets, and Coast Guard PDF exports.
4. Pre-dive weather briefing generation and automated PDF email dispatches.

However, the booking engine currently operates as an isolated subsystem. Users cannot discover or book trips from `/dive-trips` or `TripDetail.jsx`, diving center managers have no unified dashboard to view upcoming booked trips and open their operations console, and divers have no centralized place to view their reservations.

**Phase 4.5 connects these subsystems into a cohesive, production-ready product:**
- Links public trips (`ParsedDiveTrip`) with booking slots (`OctoAvailabilitySlot`).
- Establishes a dedicated **Diving Center Management Portal** at `/diving-centers/:id/manage` (with slug support and redirects from `?tab=manage`).
- Embeds instant online booking into trip creation and editing (`TripFormModal.jsx` and `CreateTrip.jsx`).
- Exposes online booking CTAs and live seat availability on `/dive-trips` cards and `TripDetail.jsx`.
- Adds a dedicated **"My Bookings"** page for divers at `/profile/bookings` (with redirects from `/profile?tab=bookings`).

---

## 2. Architecture & URL Routing Structure

### 2.1 Frontend Route Hierarchy (`frontend/src/App.jsx`)

1. **Center Management Hub:**
   - Primary Route: `/diving-centers/:id/manage`
   - Slugged Route: `/diving-centers/:id/:slug/manage`
   - Guarded by `<ProtectedRoute>` and center manager authorization checks.
   - Redirect: Visiting `/diving-centers/:id?tab=manage` or `/diving-centers/:id/:slug?tab=manage` triggers a redirect to `/diving-centers/:id/:slug/manage`.
2. **Operations Dashboard (Existing from Phase 3):**
   - Route: `/manage/centers/:centerId/trips/:tripId` (where `:tripId` is the `OctoAvailabilitySlot.id` UUID).
3. **Public Trip Discovery & Booking:**
   - Catalog: `/dive-trips`
   - Trip Details: `/dive-trips/:id/:slug`
   - Checkout Wizard: `/book/:slotId` (Existing from Phase 2)
   - Voucher View: `/bookings/:uuid/voucher` (Existing from Phase 2)
4. **Diver Bookings Hub:**
   - Primary Route: `/profile/bookings`
   - Guarded by `<ProtectedRoute>`.
   - Redirect: Visiting `/profile?tab=bookings` redirects to `/profile/bookings`.

---

## 3. Data Schema & Models

### 3.1 Migration `0101_link_parsed_dive_trips_to_octo_slots.py`
Extend `parsed_dive_trips` table to establish a foreign key link to `octo_availability_slots`:

```python
# In backend/app/models.py (ParsedDiveTrip)
octo_slot_id = Column(
    String(36),
    ForeignKey("octo_availability_slots.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
)
is_bookable = Column(Boolean, default=False, nullable=False)

# Relationships
octo_slot = relationship(
    "OctoAvailabilitySlot",
    backref=sa.orm.backref("dive_trip", uselist=False),
)
```

### 3.2 Data Synchronization Rules
- When a trip has `is_bookable=True`:
  - `octo_slot.seats_total` is kept synchronized with `parsed_dive_trip.group_size_limit`.
  - `parsed_dive_trip.current_bookings` is kept synchronized with the confirmed seats count in `OctoBooking`.
  - Trip price and currency are mirrored to `OctoAvailabilitySlot.base_price` and `currency`.
  - When an `OctoBooking` is confirmed or cancelled, slot `seats_available` and trip `current_bookings` update atomically within the same transaction.

---

## 4. Backend Service & API Specification

### 4.1 Automatic OCTO Provisioning Service (`app/services/trip_octo_provisioning_service.py`)
Encapsulates slot creation and maintenance when managers toggle online booking:
- `provision_or_sync_octo_slot(db, trip, enable_booking, base_price, currency, seats)`:
  1. If `enable_booking` is False:
     - Set `trip.is_bookable = False`.
     - Keep existing slot intact (if any) so historic bookings remain accessible, but mark slot `is_active = False` or set capacity to 0.
  2. If `enable_booking` is True:
     - Find or create default `OctoProduct` for `trip.diving_center_id` (e.g., standard "Guided Boat Dive" product for the center).
     - Find or create default `OctoOption` (standard "Boat Dive Schedule").
     - If `trip.octo_slot_id` exists, fetch slot and update `start_datetime`, `end_datetime`, `seats_total`, `base_price`, and `currency`.
     - If no slot exists, create a new `OctoAvailabilitySlot` UUID and link `trip.octo_slot_id = slot.id`.
     - Set `trip.is_bookable = True`.

### 4.2 API Endpoint Enhancements

#### `GET /api/v1/dive-trips` & `GET /api/v1/dive-trips/{id}`
- Response schema `ParsedDiveTripResponse` includes:
  - `is_bookable: bool`
  - `octo_slot_id: Optional[str]`
  - `seats_available: Optional[int]`
  - `base_price: Optional[float]`
  - `currency: Optional[str]`
- Query parameter added to `GET /api/v1/dive-trips`: `bookable_only: Optional[bool] = False`.

#### `POST /api/v1/dive-trips` & `PUT /api/v1/dive-trips/{id}`
- Request schemas accept:
  - `enable_online_booking: Optional[bool] = False`
  - `base_price: Optional[float] = None`
  - `currency: Optional[str] = "EUR"`
- Handlers call `provision_or_sync_octo_slot` upon creation/update.

#### `GET /api/v1/centers/{center_id}/booking-ops/trips-summary` *(New)*
- **Security:** Requires authenticated manager of `center_id`.
- **Response:** List of upcoming trips for the center with enriched operational metadata:
  ```json
  [
    {
      "trip_id": 42,
      "trip_date": "2026-10-15",
      "trip_time": "09:00:00",
      "title": "Nea Kameni Wreck Two-Tank Dive",
      "dive_sites": [{"id": 12, "name": "Nea Kameni Wreck"}],
      "is_bookable": true,
      "octo_slot_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "seats_total": 12,
      "seats_booked": 8,
      "seats_available": 4,
      "occupancy_rate": 0.67,
      "has_briefing": true,
      "briefing_status": "DISPATCHED"
    }
  ]
  ```

#### `GET /api/v1/bookings/my-bookings` *(New)*
- **Security:** Requires authenticated user (`current_user`).
- **Response:** List of bookings associated with `current_user.id` or matching email:
  ```json
  [
    {
      "booking_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "reference": "DIVEMAP-202610-A89F",
      "status": "CONFIRMED",
      "payment_status": "PENDING_AT_CHECKIN",
      "center": {
        "id": 56,
        "name": "Santorini Dive Center",
        "slug": "santorini-dive-center"
      },
      "trip_date": "2026-10-15T09:00:00Z",
      "slot_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "trip_id": 42,
      "participants_count": 2,
      "total_amount": 160.00,
      "currency": "EUR",
      "has_briefing": true
    }
  ]
  ```

---

## 5. Frontend Components & User Experience

### 5.1 Center Management Portal (`DivingCenterManagePage.jsx`)
- Located at `frontend/src/pages/DivingCenterManagePage.jsx`.
- **Top Bar:** Center name, logo, link back to public view (`View Center Profile`), and quick metrics (Total Scheduled Trips, Online Bookings Active, Overall Seat Fill Rate).
- **Tabbed or Sectional Dashboard:**
  1. **Trips & Bookings Hub:**
     - High-density card/table list of upcoming trips.
     - Visual capacity progress gauge (`X / Y seats booked`).
     - Primary button: **"Operations & Manifest"** linking to `/manage/centers/:centerId/trips/:slotId`.
     - Secondary actions: Edit Trip (`TripFormModal`), Public Link (`/dive-trips/:id/:slug`).
  2. **Rental Pricing:** Embedded shortcut card linking to `/diving-centers/:id/gear-rental`.
  3. **Announcements:** Broadcast announcement editor.
  4. **Team Management:** Add/remove manager usernames.

### 5.2 Trip Creation & Edit Form (`TripFormModal.jsx`)
- Adds an **"Online Booking Setup"** section:
  - Toggle switch: "Enable Instant Online Booking on Divemap".
  - If checked:
    - Base Ticket Price per Diver (currency selector EUR/USD/GBP).
    - Group Size Limit automatically syncs as total available capacity.
    - Helpful explanatory callout detailing how bookings automatically feed into the manifest, equipment sizing, and medical checks.

### 5.3 Public Discovery (`TripCard.jsx` & `TripDetail.jsx`)
- **`TripCard.jsx`:**
  - If `trip.is_bookable`:
    - Distinctive **"Instant Booking"** badge.
    - Remaining capacity indicator (e.g. `4 seats remaining`).
    - Direct **"Book Now"** action button alongside the trip card.
- **`TripDetail.jsx`:**
  - Header displays a prominent **"Book This Trip"** CTA button with base ticket price.
  - The "Booking" tab renders:
    - If bookable: Detailed trip schedule, included gear/services summary, seats remaining, and large **"Book Online"** button linking directly to `/book/:slotId`.
    - If not bookable: Fallback contact card ("Call or Email diving center").

### 5.4 Diver Bookings Portal (`UserBookingsPage.jsx`)
- Located at `frontend/src/pages/UserBookingsPage.jsx` (`/profile/bookings`).
- Renders cards of upcoming and past dive reservations:
  - Center name, date, departure time, and booking status badge.
  - Number of participants and payment mode (`Pay on Arrival`).
  - Action buttons:
    - **"Digital Voucher & QR"** $	o$ `/bookings/:uuid/voucher`.
    - **"Download Briefing"** (if available) $	o$ `/api/v1/bookings/:uuid/briefing`.
    - **"View Trip"** $	o$ `/dive-trips/:id/:slug`.
- Added to Profile sidebar navigation in `Profile.jsx` and user dropdown.

---

## 6. Verification & Quality Standards

1. **Backend Automated Tests:**
   - Run in isolated Docker test environment via `./docker-test-github-actions.sh`:
     - Schema migration test (`0101_link_parsed_dive_trips_to_octo_slots.py`).
     - Trip creation with OCTO slot auto-provisioning test.
     - Booking capacity synchronization test.
     - `GET /api/v1/bookings/my-bookings` authentication & isolation test.
     - `GET /api/v1/centers/{id}/booking-ops/trips-summary` permission and calculation test.
2. **Frontend Quality & Linting:**
   - `make lint-frontend` with 0 errors.
3. **Browser MCP Verification:**
   - Verify `/diving-centers/:id/manage` loads with 0 console errors.
   - Verify `/diving-centers/:id?tab=manage` correctly redirects to `/diving-centers/:id/:slug/manage`.
   - Verify `/dive-trips/:id/:slug` displays the "Book Online" CTA button.
   - Verify `/profile/bookings` loads with 0 console errors.
