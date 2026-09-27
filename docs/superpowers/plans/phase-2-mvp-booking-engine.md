# Phase 2: Minimal Viable Booking Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working end-to-end booking flow: dive centers create trip slots, and divers browse, select dates, pre-fill biometrics, complete DMSC medical questionnaires, sign legal waivers, and confirm reservations under `PAY_ON_ARRIVAL` with QR-code digital vouchers.

**Architecture:**
1. Database models implementing the core OCTO 1.0 hierarchy (`OctoProduct`, `OctoOption`, `OctoUnit`, `OctoAvailabilitySlot`, `OctoBooking`, `OctoBookingUnitItem`, `DiverMedicalRecord`) and center settings (`DivingCenterBookingSettings`).
2. Standard OCTO 1.0 supplier endpoints (`/api/v1/octo/...`) for products, real-time availability, hold creation (`POST /bookings` with row-locking concurrency control), and final confirmation (`POST /bookings/{uuid}/confirm`).
3. Diver booking router (`/api/v1/bookings/...`) managing the customer checkout experience, automatic pre-fill from `user_certifications` and `user_gear_profiles`, encrypted DMSC submission, and voucher generation.
4. React frontend wizard (`BookingWizard.jsx`) with step-by-step progress, interactive medical modal, canvas touch signature, and printable voucher.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, MySQL 8.0, PyJWT, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (Sections 3.1, 3.2, 4.2, 8.1, 8.2)

**Dependencies:** Phase 1 (`UserGearProfile`, `BookingMedicalEncryptionService`, `WaiverService`, `cylinders.py`, `unit_conversion.py`).

## Global Constraints

- **No Raw Pytest on Host:** Always run backend tests via `./docker-test-github-actions.sh [test_file]`. Never run direct pytest commands that connect to the development database.
- **Git Restrictions:** NEVER execute `git add` or `git commit`. All commit steps prepare `commit-message.txt` for the user to execute manually.
- **Frontend Verification:** Every frontend page modified or created MUST be verified using Chrome DevTools MCP (`navigate_page`, `take_snapshot`) and confirmed to produce zero browser console errors (`list_console_messages`).
- **Mobile Container Standards:** Top-level explorer/booking page wrappers must use `max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8` without horizontal scrolling.

---

### Task 2.1: Core OCTO Database Models & Sequential Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: Sequential migration file (e.g. `backend/migrations/versions/0095_create_octo_core_booking_models.py`)
- Test: `backend/tests/test_octo_core_models.py`

**Interfaces:**
- Consumes: `DivingCenter`, `DiveSite`, `User`, `UserGearProfile`.
- Produces: `DivingCenterBookingSettings`, `DivingCenterVessel`, `OctoProduct`, `OctoOption`, `OctoUnit`, `OctoAvailabilitySlot`, `OctoBooking`, `OctoBookingUnitItem`, `DiverMedicalRecord`.

- [ ] **Step 1: Write model tests verifying relationships and constraints**

Create `backend/tests/test_octo_core_models.py`:
```python
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

def test_octo_core_relationships(db: Session, test_diving_center: DivingCenter, test_user):
    settings = DivingCenterBookingSettings(
        diving_center_id=test_diving_center.id,
        is_booking_enabled=True,
        default_currency="EUR",
        payment_mode="PAY_ON_ARRIVAL",
    )
    db.add(settings)
    
    vessel = DivingCenterVessel(
        diving_center_id=test_diving_center.id,
        name="Aegean Explorer",
        registration_number="GR-PIR-49102",
        licensed_capacity=14,
    )
    db.add(vessel)
    db.flush()
    
    product = OctoProduct(
        id="prod-uuid-1",
        diving_center_id=test_diving_center.id,
        title="2-Tank Morning Boat Dive",
        product_type="GUIDED_BOAT_TRIP",
    )
    db.add(product)
    db.flush()
    
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
    db.add_all([option, unit])
    db.flush()
    
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
    db.add(slot)
    db.commit()
    
    assert slot.seats_available == 10
    assert slot.vessel_id == vessel.id
```

- [ ] **Step 2: Add core models to `backend/app/models.py`**

Add `DivingCenterBookingSettings` (with `default_currency="EUR"`), `DivingCenterVessel`, `OctoProduct`, `OctoOption`, `OctoUnit`, `OctoAvailabilitySlot` (with `vessel_id` and `assigned_guide_user_ids`), `OctoBooking` (with nullable `user_id`, `contact_full_name`, `contact_email`, `contact_phone`, `booking_notes`), `OctoBookingUnitItem`, `DiverMedicalRecord`.

- [ ] **Step 3: Create sequential migration file**

Create `backend/migrations/versions/0095_create_octo_core_booking_models.py` creating the tables with foreign keys and indexes.

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_octo_core_models.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add core OCTO booking models, vessels, and migration

Adds DivingCenterBookingSettings, DivingCenterVessel, OctoProduct, OctoOption,
OctoUnit, OctoAvailabilitySlot, OctoBooking, OctoBookingUnitItem, and
DiverMedicalRecord models with sequential migration 0095.
```

---

### Task 2.2: OCTO 1.0 Supplier API Router (Catalog, Availability, Hold & Confirm)

**Files:**
- Create: `backend/app/routers/octo.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_octo_api.py`

**Interfaces:**
- Consumes: OCTO Core Models.
- Produces: Standard OCTO 1.0 endpoints under `/api/v1/octo/...`.

- [ ] **Step 1: Write tests for standard OCTO endpoints**

Create `backend/tests/test_octo_api.py` testing `GET /suppliers/{id}`, `GET /products`, `POST /availability`, `POST /bookings` (hold with row-locking and hold expiration), `POST /bookings/{uuid}/confirm`, and expired hold reclamation.

- [ ] **Step 2: Implement `/api/v1/octo` router**

Create `backend/app/routers/octo.py` with:
- Row-level locks on `OctoAvailabilitySlot` (`with_for_update()`) to ensure no double bookings occur.
- **Hold Reclamation Helper (`reclaim_expired_holds(db, slot_id)`):** Automatically sweeps expired holds (`status == 'ON_HOLD' AND utc_hold_expiration < NOW()`), restores `seats_available`, and marks expired bookings `status = 'EXPIRED'`.
- **Timezone localization:** Converts local product/option departure times to UTC using `zoneinfo.ZoneInfo(settings.timezone)`.
- Support for external OTA guest checkout (nullable `user_id` with `contact_full_name`, `contact_email`, `contact_phone`).

- [ ] **Step 3: Register router in `backend/app/main.py`**

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_octo_api.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add OCTO 1.0 supplier API endpoints with anti-phantom hold reclamation

Implements products catalog, availability queries, and hold/confirm reservation
lifecycle with concurrency row-locking and automatic expired hold recovery.
```

---

### Task 2.3: Diver Booking Checkout Router (Pre-fill, Paperwork & Vouchers)

**Files:**
- Create: `backend/app/routers/bookings.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_bookings_router.py`

**Interfaces:**
- Consumes: `OctoBooking`, `OctoBookingUnitItem`, `UserGearProfile`, `BookingMedicalEncryptionService`, `WaiverService`.
- Produces: 
  - `POST /api/v1/bookings/{uuid}/submit-paperwork`
  - `GET /api/v1/bookings/{uuid}/voucher`

- [ ] **Step 1: Write tests for paperwork submission and voucher generation**

Create `backend/tests/test_bookings_router.py`.

- [ ] **Step 2: Implement `/api/v1/bookings` router**

- [ ] **Step 3: Register router in `backend/app/main.py`**

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_bookings_router.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add diver booking paperwork submission and digital voucher endpoints

Enables divers to submit encrypted DMSC medical forms, sign waivers, and
download QR-code booking vouchers.
```

---

### Task 2.4: Frontend Diver Booking Checkout Wizard & Modals

**Files:**
- Create: `frontend/src/components/booking/BookingWizard.jsx`
- Create: `frontend/src/components/booking/MedicalQuestionnaireModal.jsx`
- Create: `frontend/src/components/booking/WaiverSigningModal.jsx`
- Create: `frontend/src/pages/BookingVoucherPage.jsx`
- Modify: `frontend/src/App.jsx`
- Test: Frontend verification via Chrome DevTools MCP & unit tests

**Interfaces:**
- Consumes: `/api/v1/octo/...` and `/api/v1/bookings/...`.
- Produces: Complete responsive booking flow.

- [x] **Step 1: Implement `MedicalQuestionnaireModal.jsx`**
- [x] **Step 2: Implement `WaiverSigningModal.jsx`**
- [x] **Step 3: Implement `BookingWizard.jsx` & `BookingVoucherPage.jsx`**
  * **Wide Container Layout:** Conforms to `max-w-[95vw] xl:max-w-[1600px]` with 12-column grid (8 columns for form, 4 columns for sticky live summary).
  * **5-Step Progressive Guided Flow:**
    * Step 1: Diver Credentials & Identification (Tier, Full Legal Name, DOB, Nationality, Email, Phone, Passport/ID, Agency with main qualification filter, Level, C-Card #).
    * Step 2: Equipment Needed for Rent & Sizing (Cylinder, Gas Mix with Nitrox validation, DIN/Yoke valve, Ballast kg, Weight System, Wetsuit Cut/Size/Thickness, BCD Cut/Size, Fins Style, Booties EU size, Rental Dive Torch).
    * Step 3: Emergency Contact (Next of Kin Legal Name, Phone, Relationship) & Dive Accident Insurance (Own Policy vs Center Daily Coverage).
    * Step 4: Diver Medical Screening (DMSC 2020) with envelope-encrypted 10-point evaluation.
    * Step 5: Liability Waiver & Final Review with typed signature audit hash and pay-on-arrival voucher generation.
  * **Step Transition Validation & Progress Bar:** Interactive 5-step stepper bar with past-step navigation and strict validation preventing progression without mandatory data.
- [x] **Step 4: Register routes in `frontend/src/App.jsx`**
- [x] **Step 5: Run frontend lint check (`make lint-frontend`)**
- [x] **Step 6: Verify in browser with Chrome DevTools MCP (0 console errors)**

---

### Phase 2 Verification Checklist
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_octo_core_models.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_octo_api.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_bookings_router.py` passes.
- [x] `make lint-frontend` passes with zero errors.
- [x] Complete booking lifecycle tested in browser via Chrome DevTools MCP with zero console errors.
