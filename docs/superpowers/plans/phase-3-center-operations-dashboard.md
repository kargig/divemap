# Phase 3: Center Operations Dashboard & Daily Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide diving center managers and boat crew with a single-pane-of-glass operations dashboard for each dive trip, featuring live capacity gauges, medical status badges, dive currency warnings, participant walk-in additions, equipment edits, roll-call boarding toggles, "Mark Paid" check-ins, aggregated crate packing summaries, and one-click Port Authority / Coast Guard manifest exports.

**Architecture:**
1. Backend router `/api/v1/centers/{center_id}/booking-ops/...` providing trip roster data, manual walk-in reservations, participant modifications, capacity releases, and dynamic unit rendering according to the center manager's preferred unit system (`METRIC` vs `IMPERIAL`).
2. Maritime PDF/CSV generator compiling compliant crew and passenger manifests with vessel IMO/registration numbers, skipper credentials, divemaster credentials, and diver passport numbers.
3. React operations dashboard (`TripOperationsDashboard.jsx`) with live capacity bar, interactive participant table, aggregated gear packing cards, and modal dialogs for walk-ins and medical certificate inspection.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, ReportLab / WeasyPrint, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (Sections 3.5, 3.6, 7, 8.3)

**Dependencies:** Phase 2 (requires `OctoAvailabilitySlot`, `OctoBooking`, `OctoBookingUnitItem`, `DiverMedicalRecord`, `DivingCenterBookingSettings`).

## Global Constraints

- **No Raw Pytest on Host:** Always run backend tests via `./docker-test-github-actions.sh [test_file]`. Never run direct pytest commands that connect to the development database.
- **Git Restrictions:** NEVER execute `git add` or `git commit`. All commit steps prepare `commit-message.txt` for the user to execute manually.
- **Frontend Verification:** Every frontend page modified or created MUST be verified using Chrome DevTools MCP (`navigate_page`, `take_snapshot`) and confirmed to produce zero browser console errors (`list_console_messages`).
- **Dynamic Unit Translation:** All diver biometric values are dynamically rendered in the center manager's configured unit system (`METRIC` or `IMPERIAL`), with the original diver input available via tooltip.

---

### Task 3.1: Center Operations Dashboard API Router & Participant Actions

**Files:**
- Create: `backend/app/routers/center_booking_ops.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_center_booking_ops_api.py`

**Interfaces:**
- Consumes: `OctoAvailabilitySlot`, `OctoBooking`, `OctoBookingUnitItem`, `DiverMedicalRecord`, `DivingCenterBookingSettings`.
- Produces: 
  - `GET /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/manifest`
  - `POST /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants` (manual walk-in)
  - `PUT /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants/{id}` (edit sizing/tanks)
  - `DELETE /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants/{id}` (cancel & release seat)
  - `POST /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants/{id}/toggle-checkin`
  - `POST /api/v1/centers/{center_id}/booking-ops/bookings/{booking_id}/mark-paid`
  - `GET /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/manifest/export-port-authority`

- [x] **Step 1: Write API tests for manifest fetching, walk-in additions, edits, and exports**

Create `backend/tests/test_center_booking_ops_api.py`:
```python
import pytest
from fastapi.testclient import TestClient

def test_get_trip_manifest_and_add_walkin(authenticated_manager_client: TestClient, test_slot):
    center_id = test_slot.product.diving_center_id
    trip_id = test_slot.id
    
    # 1. Fetch manifest
    res = authenticated_manager_client.get(f"/api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/manifest")
    assert res.status_code == 200
    data = res.json()
    assert "participants" in data
    assert "crate_packing_summary" in data
    
    # 2. Add manual walk-in diver
    walkin_payload = {
        "diver_full_name": "Barnaby Jones",
        "date_of_birth": "1985-06-12",
        "diver_nationality": "British",
        "certification_agency": "SSI",
        "certification_level": "Open Water",
        "selected_tank_id": "12",
        "wetsuit_size": "L"
    }
    res_add = authenticated_manager_client.post(
        f"/api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants",
        json=walkin_payload
    )
    assert res_add.status_code == 201
    assert res_add.json()["diver_full_name"] == "Barnaby Jones"

def test_toggle_checkin_and_mark_paid(authenticated_manager_client: TestClient, test_booking_with_participant):
    center_id = test_booking_with_participant.diving_center_id
    part_id = test_booking_with_participant.unit_items[0].id
    booking_id = test_booking_with_participant.uuid
    
    # Toggle boarding
    res_toggle = authenticated_manager_client.post(
        f"/api/v1/centers/{center_id}/booking-ops/trips/test/participants/{part_id}/toggle-checkin"
    )
    assert res_toggle.status_code == 200
    assert res_toggle.json()["onboard_checkin_status"] is True
    
    # Mark paid
    res_paid = authenticated_manager_client.post(
        f"/api/v1/centers/{center_id}/booking-ops/bookings/{booking_id}/mark-paid"
    )
    assert res_paid.status_code == 200
    assert res_paid.json()["payment_status"] == "PAID_IN_FULL"
```

- [x] **Step 2: Implement `backend/app/routers/center_booking_ops.py`**

Implements endpoints protected by `is_center_manager(db, center_id, current_user)` from `backend/app/routers/diving_centers.py`. Includes:
- `GET /manifest` (live roster, boat capacity, staff, crate loadouts)
- `POST /participants` (walk-in intake)
- `PUT /participants/{id}` (equipment & cylinder modifications)
- `DELETE /participants/{id}` (seat release)
- `POST /participants/{id}/toggle-checkin` (with Scuba Safety Gate blocking unresolved medical flags)
- `POST /bookings/{id}/toggle-payment` (bidirectional payment toggle)
- `POST /staff-assignment` (skipper, lead guide, crew list)
- `POST /participants/{id}/clear-medical` (manager clearance override with physician details and audit trail)
- `GET /participants/{id}/emergency-dossier` (court-ready Emergency Incident Dossier PDF)

- [x] **Step 3: Implement Coast Guard manifest PDF/CSV export helper using ReportLab**

Add `reportlab>=4.2.0` to `backend/requirements.txt`. Implemented `backend/app/services/manifest_export_service.py` compiling vessel IMO/registration numbers, captain/crew details, and passenger credentials into a standard Port Authority manifest, as well as the formal Emergency Incident Dossier PDF.

- [x] **Step 4: Register router in `backend/app/main.py`**

- [x] **Step 5: Run tests in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_center_booking_ops_api.py
```
Expected: `All tests passed!`.

- [x] **Step 6: Prepare commit draft**

---

### Task 3.2: Frontend Center Trip Operations Dashboard & Packing Cards

**Files:**
- Create: `frontend/src/components/booking/TripOperationsDashboard.jsx`
- Create: `frontend/src/components/booking/BoatManifestTable.jsx`
- Create: `frontend/src/components/booking/GearPackingManifest.jsx`
- Create: `frontend/src/components/booking/AddDiverModal.jsx`
- Create: `frontend/src/components/booking/DiverDetailsModal.jsx`
- Modify: `frontend/src/App.jsx`
- Test: Frontend verification via Chrome DevTools MCP & unit tests

**Interfaces:**
- Consumes: `/api/v1/centers/{center_id}/booking-ops/...`.
- Produces: Responsive center management interface for desktop and mobile tablets.

- [x] **Step 1: Implement `BoatManifestTable.jsx` with mobile-first card-stack view**

Build dual responsive views adhering strictly to the "No Horizontal Scrolling" mandate:
* **Desktop / Tablet (`hidden md:block`):** Full multi-column data table with diver credentials, medical clearance badge, currency status, unit system translation with tooltip of original submission, roll-call check-in switch, and payment status toggle.
* **Mobile Viewports (`block md:hidden`):** Vertical card-stack (`rounded-none sm:rounded-2xl border-y sm:border p-3.5 sm:p-5`) with wrapped badge clusters (`flex-wrap gap-1.5`), prominent single-touch boarding and payment checkmarks, and tap-to-expand details without any horizontal scrolling.
* **Scuba Safety Gate:** Flags divers with unresolved medical conditions with a prominent `🚫 Medical Hold` badge, disabling boarding until physician clearance is approved.

- [x] **Step 2: Implement `GearPackingManifest.jsx`**

Aggregates cylinders by size, gas mix, and explicit valve adapter requirement (`✓ DIN Native Valve` vs `⚠️ YOKE (Fit DIN-to-Yoke Insert)`), total lead weights (with 2kg, 1kg, and 0.5kg block count denominations), and weight system breakdown (`Integrated BCD Pockets` vs `Nylon Weight Belts`).
* **Complete Top-to-Bottom Scuba Checklist:** Masks, snorkels, hoods, regulators, stage cylinders, BCDs, thermal suits, gloves, socks, booties, fins, and DPV scooters.
* **Anatomical Cut Sizing:** Wetsuits and BCDs explicitly differentiate `Women's Cut` (pink/rose badges) vs `Men's / Unisex` (blue badges).
* **Configurable Crate Partitioning (1 to 5 Crates):** Center managers can select from 1 to 5 transport containers to dynamically group equipment according to their vessel deck space.
* **Official Requirements:** Verified emergency contact (next of kin name, phone, relationship) and dive accident insurance status (Own active policy vs Dive center daily hyperbaric evacuation coverage).
* **Main Certification Tracks:** Filtered diving organization levels strictly to core qualification progression tracks.

- [x] **Step 3: Implement `AddDiverModal.jsx` & `DiverDetailsModal.jsx`**

Modal to search Divemap users or create guest walk-in divers on the fly; details modal to view verified C-Cards, inspect physician certificates, override medical clearance, immediately synchronize and update equipment preferences, and export the official Emergency Incident Dossier PDF.

- [x] **Step 4: Implement `TripOperationsDashboard.jsx`**

Assemble header, capacity gauge, action buttons (Export Manifest, Print Packing Sheet, Add Diver), and tabs for Roster vs. Gear Crates.

- [x] **Step 5: Register route in `frontend/src/App.jsx`**

Added `/manage/centers/:centerId/trips/:tripId`.

- [x] **Step 6: Run frontend lint and browser verification**

Run:
```bash
make lint-frontend
```
Verified page rendering, walk-in creation, and zero console errors via Chrome DevTools MCP.

- [x] **Step 7: Prepare commit draft**

---

### Phase 3 Verification Checklist
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_center_booking_ops_api.py` passes.
- [x] `make lint-frontend` passes with zero errors.
- [x] Browser verification passes via Chrome DevTools MCP with zero console errors.
