# Phase 6: Advanced Operations & Ecosystem Synergy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement advanced commercial and operational capabilities: multi-day dive packages and certification courses (`octo/packages`), hotel shuttle pickup logistics (`octo/pickups`), rental equipment stock quotas (`CenterEquipmentInventory`), offshore offline boat mode with IndexedDB PWA synchronization, automated post-dive logbook synchronization (creating verified draft `Dive` logs), and external travel aggregator webhooks (`octo/webhooks`).

**Architecture:**
1. Database models for packages (`OctoPackageItem`, `BookingPackageSchedule`), pickup points (`OctoPickupPoint`), physical rental inventory (`CenterEquipmentInventory`), add-on extras (`OctoProductExtra`), and webhook subscriptions (`OctoWebhookSubscription`).
2. Concurrency-safe inventory deduction preventing double-booking of physical rental equipment (e.g. Size M BCDs or rental dive computers).
3. `TripLogbookService` auto-generating draft `Dive` log entries in divers' accounts upon trip completion, pre-filling dive site details, depth, gas mix, and divemaster digital signatures.
4. Client-side IndexedDB caching in the frontend PWA allowing boat crews to operate offline offshore and auto-reconcile changes via `/api/v1/centers/{center_id}/booking-ops/sync-offline`.
5. HMAC SHA-256 signed webhooks alerting external OTAs (Viator, GetYourGuide, Bokun) of booking and availability updates.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, IndexedDB, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (Sections 3.1, 3.4, 7.5, 7.6, 8.1, 8.3)

**Dependencies:** Phase 2 (core booking engine), Phase 3 (operations dashboard), Phase 5 (safety & claim workflows).

## Global Constraints

- **No Raw Pytest on Host:** Always run backend tests via `./docker-test-github-actions.sh [test_file]`. Never run direct pytest commands that connect to the development database.
- **Git Restrictions:** NEVER execute `git add` or `git commit`. All commit steps prepare `commit-message.txt` for the user to execute manually.
- **Frontend Verification:** Every frontend page modified or created MUST be verified using Chrome DevTools MCP (`navigate_page`, `take_snapshot`) and confirmed to produce zero browser console errors (`list_console_messages`).

---

### Task 6.1: Advanced Operations Database Models & Sequential Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: Sequential migration file (e.g. `backend/migrations/versions/0098_create_advanced_ops_models.py`)
- Test: `backend/tests/test_advanced_ops_models.py`

**Interfaces:**
- Consumes: Core models.
- Produces: `CenterEquipmentInventory`, `OctoPickupPoint`, `OctoPackageItem`, `BookingPackageSchedule`, `OctoProductExtra`, `OctoBookingExtraItem`, `OctoWebhookSubscription`, and extended `Dive` model with verification columns.

- [ ] **Step 1: Write model tests verifying packages, pickups, inventory models, and Dive verification columns**

Create `backend/tests/test_advanced_ops_models.py`:
```python
import pytest
from datetime import datetime, date, timezone
from app.models import CenterEquipmentInventory, OctoPickupPoint, OctoPackageItem, Dive, DivingCenter, User

def test_inventory_and_pickup_models(db, test_diving_center, test_product):
    # Test inventory quota
    inv = CenterEquipmentInventory(
        diving_center_id=test_diving_center.id,
        item_type="BCD",
        size_or_variant="M",
        total_quantity=5,
        maintenance_quantity=1,
    )
    db.add(inv)
    
    # Test pickup spot
    pickup = OctoPickupPoint(
        diving_center_id=test_diving_center.id,
        name="Larnaca Marina Main Gate",
        minutes_prior=30,
    )
    db.add(pickup)
    db.commit()
    
    assert inv.id is not None
    assert pickup.id is not None

def test_dive_verification_fields(db, test_user, test_diving_center):
    dive = Dive(
        user_id=test_user.id,
        dive_date=date.today(),
        diving_center_id=test_diving_center.id,
        is_verified=True,
        verified_by_center_id=test_diving_center.id,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(dive)
    db.commit()
    db.refresh(dive)
    
    assert dive.is_verified is True
    assert dive.verified_by_center_id == test_diving_center.id
```

- [ ] **Step 2: Add advanced models to `backend/app/models.py`**

Add `CenterEquipmentInventory`, `OctoPickupPoint`, `OctoPackageItem`, `BookingPackageSchedule`, `OctoProductExtra`, `OctoBookingExtraItem`, `OctoWebhookSubscription`.
Also extend `Dive` model with:
```python
is_verified = Column(Boolean, default=False, index=True)
verified_by_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="SET NULL"), nullable=True, index=True)
verified_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
verified_at = Column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 3: Create sequential migration file**

Create `backend/migrations/versions/0098_create_advanced_ops_models.py` to create the advanced ops tables and add the verification columns to the `dives` table.

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_advanced_ops_models.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add advanced operations models, Dive verification columns, and migration 0098

Adds CenterEquipmentInventory, OctoPickupPoint, OctoPackageItem, BookingPackageSchedule,
OctoWebhookSubscription, and Dive verification fields.
```

---

### Task 6.2: Post-Dive Automated Logbook Sync Service (`TripLogbookService`)

**Files:**
- Create: `backend/app/services/trip_logbook_service.py`
- Modify: `backend/app/routers/center_booking_ops.py` (integrate `/complete-trip`)
- Test: `backend/tests/test_trip_logbook_service.py`

**Interfaces:**
- Consumes: `OctoAvailabilitySlot`, `OctoBookingUnitItem`, `DiveSite`, `Dive`.
- Produces: `TripLogbookService.sync_trip_to_draft_dives(db, slot_id) -> List[Dive]`.

- [ ] **Step 1: Write tests verifying automatic `Dive` record generation for checked-in divers**

Create `backend/tests/test_trip_logbook_service.py`:
```python
import pytest
from app.services.trip_logbook_service import TripLogbookService
from app.models import Dive

def test_complete_trip_generates_draft_dives(db, test_slot_with_checkedin_diver):
    slot, diver_user = test_slot_with_checkedin_diver
    created_dives = TripLogbookService.sync_trip_to_draft_dives(db, slot.id)
    
    assert len(created_dives) == 1
    dive = created_dives[0]
    assert dive.user_id == diver_user.id
    assert dive.dive_site_id == slot.product.dive_site_id
    assert dive.is_verified is True # Digital stamp from center
```

- [ ] **Step 2: Implement `TripLogbookService`**

- [ ] **Step 3: Add `POST /trips/{trip_id}/complete-trip` in `center_booking_ops.py`**

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_trip_logbook_service.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add post-dive automated logbook sync service

Generates verified draft Dive log entries for all checked-in divers upon
trip completion.
```

---

### Task 6.3: Multi-Day Packages, Pickups & Inventory Stock Router Integration

**Files:**
- Modify: `backend/app/routers/octo.py`
- Modify: `backend/app/routers/bookings.py`
- Modify: `backend/app/routers/center_booking_ops.py`
- Test: `backend/tests/test_packages_and_inventory_api.py`

**Interfaces:**
- Consumes: Inventory and package models.
- Produces: 
  - `POST /api/v1/bookings/{uuid}/redeem-package-session`
  - `GET/PUT /api/v1/centers/{center_id}/booking-ops/inventory`
  - Inventory quota checks during seat holds.

- [ ] **Step 1: Write tests for package session redemption and inventory stock quotas**

Create `backend/tests/test_packages_and_inventory_api.py`.

- [ ] **Step 2: Implement package redemption and inventory endpoints**

- [ ] **Step 3: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_packages_and_inventory_api.py
```
Expected: `All tests passed!`.

- [ ] **Step 4: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add multi-day package redemption and inventory quota endpoints

Enables flexible session scheduling for dive passes and tracks physical
equipment rental stock.
```

---

### Task 6.4: Frontend Offline Boat Mode PWA Synchronization & Inventory Manager

**Files:**
- Create: `frontend/src/utils/offlineManifestStorage.js`
- Create: `frontend/src/components/booking/CenterInventoryManager.jsx`
- Modify: `frontend/src/components/booking/TripOperationsDashboard.jsx` (integrate offline sync banner)
- Test: Frontend verification via Chrome DevTools MCP & unit tests

**Interfaces:**
- Consumes: IndexedDB client-side API, `/sync-offline` endpoint.
- Produces: Seamless offline PWA boat roll-call and dockside auto-reconciliation.

- [ ] **Step 1: Implement `offlineManifestStorage.js`**

Handles IndexedDB storage of boat manifest and queued mutations.

- [ ] **Step 2: Implement `CenterInventoryManager.jsx`**

Table showing owned stock vs. maintenance stock for BCDs, wetsuits, fins, and rental dive computers.

- [ ] **Step 3: Integrate offline sync indicator into `TripOperationsDashboard.jsx`**

Shows "🟢 Online" or "🟡 Offline Boat Mode (X changes queued)" with manual "Sync Now" button.

- [ ] **Step 4: Run frontend lint check and browser verification**

Run:
```bash
make lint-frontend
```
Verify via Chrome DevTools MCP with offline network emulation, verifying queued changes sync when back online, with zero console errors.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add offline boat mode PWA sync and center inventory manager

Enables offline offshore roll-calls and gear packing management with
IndexedDB synchronization.
```

---

### Phase 6 Verification Checklist
- [ ] `cd backend && ./docker-test-github-actions.sh tests/test_advanced_ops_models.py` passes.
- [ ] `cd backend && ./docker-test-github-actions.sh tests/test_trip_logbook_service.py` passes.
- [ ] `cd backend && ./docker-test-github-actions.sh tests/test_packages_and_inventory_api.py` passes.
- [ ] `make lint-frontend` passes with zero errors.
- [ ] Offline PWA sync verified in browser via Chrome DevTools MCP with zero console errors.
