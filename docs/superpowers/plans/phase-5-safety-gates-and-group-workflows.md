# Phase 5: Scuba Safety Gates & Group Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement critical real-world scuba diving safety gates (DCS No-Fly surface interval validation, Nitrox certification check and dockside analyzer log, minor protection with guardian co-signatures, and inactive diver refresher warnings) along with multi-party group booking workflows (guest claim magic-links) and boat buddy pairing.

**Architecture:**
1. Database extensions on `OctoBookingUnitItem` storing guest invitation tokens, date of birth, guardian signatures, flight times, and Nitrox analysis readings ($O_2\%$ and MOD).
2. Safety gate validators in `backend/app/services/waiver_service.py` intercepting checkout if flight interval is $< 18$h or if non-certified divers select Nitrox.
3. Multi-party guest claim router (`GET/POST /api/v1/bookings/{uuid}/claim/{claim_token}`) allowing secondary divers in a group booking to independently sign waivers and submit biometrics.
4. Dockside Nitrox analyzer signoff endpoint (`POST /trips/{trip_id}/log-nitrox`) and buddy team pairing (`POST /trips/{trip_id}/assign-buddies`) in the operations router.
5. Responsive guest claim page (`GuestBookingClaimPage.jsx`) and roster enhancements for buddy pairs, Nitrox badges, and no-fly alerts.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (Sections 3.2, 5.1, 5.3, 5.4, 5.5, 7.2, 8.2, 8.3)

**Dependencies:** Phase 2 (core booking engine) & Phase 3 (operations dashboard).

## Global Constraints

- **No Raw Pytest on Host:** Always run backend tests via `./docker-test-github-actions.sh [test_file]`. Never run direct pytest commands that connect to the development database.
- **Git Restrictions:** NEVER execute `git add` or `git commit`. All commit steps prepare `commit-message.txt` for the user to execute manually.
- **Frontend Verification:** Every frontend page modified or created MUST be verified using Chrome DevTools MCP (`navigate_page`, `take_snapshot`) and confirmed to produce zero browser console errors (`list_console_messages`).

---

### Task 5.1: Safety Gate & Group Booking Database Schema Extensions

**Files:**
- Modify: `backend/app/models.py`
- Create: Sequential migration file (e.g. `backend/migrations/versions/0097_add_safety_and_group_claim_fields.py`)
- Test: `backend/tests/test_safety_and_group_models.py`

**Interfaces:**
- Consumes: `OctoBookingUnitItem`.
- Produces: Enhanced `OctoBookingUnitItem` with safety and claim fields.

- [ ] **Step 1: Write model test verifying new fields**

Create `backend/tests/test_safety_and_group_models.py`:
```python
import pytest
from datetime import datetime, timezone
from app.models import OctoBookingUnitItem

def test_safety_and_claim_fields(db, test_booking_unit_item):
    unit = test_booking_unit_item
    unit.claim_token = "secure-random-token-64-chars"
    unit.claim_status = "INVITED"
    unit.is_minor = True
    unit.is_junior = True
    unit.guardian_full_name = "Jane Doe"
    unit.outbound_flight_datetime = datetime(2026, 10, 2, 14, 0, tzinfo=timezone.utc)
    unit.nitrox_certified = True
    unit.nitrox_analyzed_o2_percent = 32.2
    unit.nitrox_mod_meters = 33.5
    db.commit()
    db.refresh(unit)
    
    assert unit.claim_token == "secure-random-token-64-chars"
    assert unit.is_junior is True
    assert unit.nitrox_analyzed_o2_percent == 32.2
```

- [ ] **Step 2: Add safety fields to `OctoBookingUnitItem` in `backend/app/models.py`**

- [ ] **Step 3: Create sequential migration file**

Create `backend/migrations/versions/0097_add_safety_and_group_claim_fields.py`.

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_safety_and_group_models.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add safety gate and group booking claim fields to OctoBookingUnitItem

Adds claim_token, guardian signatures, outbound flight time, Nitrox analyzer readings,
and buddy pairing fields via migration 0097.
```

---

### Task 5.2: Multi-Party Guest Claim Router & Safety Validators

**Files:**
- Modify: `backend/app/routers/bookings.py`
- Modify: `backend/app/services/waiver_service.py`
- Test: `backend/tests/test_guest_claim_and_safety_api.py`

**Interfaces:**
- Consumes: `OctoBookingUnitItem`, `WaiverService`.
- Produces: 
  - `GET /api/v1/bookings/{uuid}/claim/{claim_token}`
  - `POST /api/v1/bookings/{uuid}/claim/{claim_token}`
  - DCS surface interval gate, Nitrox certification validator, and Junior 12m depth restriction check.

- [ ] **Step 1: Write API tests for guest claim flow, no-fly safety checks, and junior depth caps**

Create `backend/tests/test_guest_claim_and_safety_api.py`.

- [ ] **Step 2: Implement guest claim verification and submission endpoints**

- [ ] **Step 3: Integrate safety validators into checkout and claim endpoints**

Validates:
- No-fly buffer: Ensures `outbound_flight_datetime - trip_end_time >= min_surface_interval_hours` (default 18h).
- Nitrox certification: Requires `user_certifications` with Nitrox or manual card proof if `selected_gas_mix_id != "air"`.
- Junior diver safety: For ages 10–11 (`is_junior = True`), verifies the booked dive site profile does not exceed 12m (`max_depth <= 12m`).
- Guardian release: For minors under 18 (`is_minor = True`), requires guardian full name, relationship, and co-signature.

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_guest_claim_and_safety_api.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add multi-party guest claim endpoints and scuba safety gates

Implements magic-link guest claim intake, DCS no-fly interval checks,
and Nitrox prerequisite verification.
```

---

### Task 5.3: Dockside Nitrox Log & Buddy Pairing Endpoints

**Files:**
- Modify: `backend/app/routers/center_booking_ops.py`
- Test: `backend/tests/test_nitrox_and_buddies_api.py`

**Interfaces:**
- Consumes: `OctoBookingUnitItem`.
- Produces: 
  - `POST /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/log-nitrox`
  - `POST /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/assign-buddies`

- [ ] **Step 1: Write API tests for Nitrox analyzer logging and buddy pairing**

Create `backend/tests/test_nitrox_and_buddies_api.py`.

- [ ] **Step 2: Implement Nitrox and buddy pairing routes in `center_booking_ops.py`**

- [ ] **Step 3: Run tests in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_nitrox_and_buddies_api.py
```
Expected: `All tests passed!`.

- [ ] **Step 4: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add dockside Nitrox analyzer log and buddy pairing endpoints

Allows center staff to log measured oxygen percentage and MOD, and pair
divers into buddy teams directly on the trip roster.
```

---

### Task 5.4: Frontend Guest Claim Page & Safety Badges on Manifest

**Files:**
- Create: `frontend/src/pages/GuestBookingClaimPage.jsx`
- Modify: `frontend/src/components/booking/BoatManifestTable.jsx`
- Modify: `frontend/src/App.jsx`
- Test: Frontend verification via Chrome DevTools MCP & unit tests

**Interfaces:**
- Consumes: Claim endpoints and operations manifest endpoints.
- Produces: Responsive guest intake page and roster safety indicators (No-Fly risk badge, Nitrox status, buddy selector).

- [ ] **Step 1: Implement `GuestBookingClaimPage.jsx`**

Mobile-optimized page for invited guest divers to submit their name, DOB, gear sizes, DMSC questionnaire, and waiver signature.

- [ ] **Step 2: Update `BoatManifestTable.jsx`**

Add buddy pairing dropdown, Nitrox sign-off badge, and red DCS no-fly alert badge.

- [ ] **Step 3: Register `/bookings/:uuid/claim/:token` in `frontend/src/App.jsx`**

- [ ] **Step 4: Run frontend lint and browser verification**

Run:
```bash
make lint-frontend
```
Verify claim page and manifest safety badges via Chrome DevTools MCP with zero console errors.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add guest booking claim page and manifest safety indicators

Provides standalone intake for group guests and surfaces DCS flight alerts,
Nitrox analysis status, and buddy assignments on the boat roster.
```

---

### Phase 5 Verification Checklist
- [ ] `cd backend && ./docker-test-github-actions.sh tests/test_safety_and_group_models.py` passes.
- [ ] `cd backend && ./docker-test-github-actions.sh tests/test_guest_claim_and_safety_api.py` passes.
- [ ] `cd backend && ./docker-test-github-actions.sh tests/test_nitrox_and_buddies_api.py` passes.
- [ ] `make lint-frontend` passes with zero errors.
- [ ] Browser verification passes via Chrome DevTools MCP with zero console errors.
