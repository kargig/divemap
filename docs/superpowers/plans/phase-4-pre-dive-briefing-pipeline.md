# Phase 4: Pre-Dive Briefing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the automated pre-dive briefing pipeline that merges Divemap's rich dive site data (depths, marine life, access, hazards) with live Open-Meteo marine weather forecasts (waves, wind, water temp) and Emergency Action Plans (EAP / nearest hyperbaric chamber), allowing dive center managers to review, customize, and dispatch a PDF briefing to confirmed divers 24–48 hours prior to departure via AWS SQS.

**Architecture:**
1. `TripBriefing` database model storing draft notes, weather snapshot JSON, marine life tags, and compiled PDF R2 storage paths.
2. `BriefingService` aggregating dive site topography, Open-Meteo forecasts, and center logistics into an automated draft 24–48h before departure.
3. Center manager review interface inside the trip dashboard allowing staff to adjust meeting gates, skipper names, and custom safety notices before clicking "Approve & Dispatch".
4. Asynchronous PDF compilation and email delivery using Divemap's existing AWS SQS queue (`backend/app/services/sqs_service.py`) and SES service (`backend/app/services/email_service.py`), with zero Celery or Redis dependencies.

**Follow-up (planned, not in Phase 4):** Access-token-aware confirmation email and briefing PDF deep links for anonymous bookers are specified in
[`2026-10-14-booking-transactional-email-design.md`](../specs/2026-10-14-booking-transactional-email-design.md) /
[`2026-10-14-booking-transactional-email-plan.md`](2026-10-14-booking-transactional-email-plan.md).
Phase 4 delivers draft/compile/manager dispatch; the enhancement aligns dispatch links with booking access control.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Jinja2, WeasyPrint / ReportLab, AWS SQS / SES, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (Sections 3.3, 6, 8.3)

**Dependencies:** Phase 2 (bookings and availability slots) & Phase 3 (trip operations dashboard).

## Global Constraints

- **No Raw Pytest on Host:** Always run backend tests via `./docker-test-github-actions.sh [test_file]`. Never run direct pytest commands that connect to the development database.
- **Git Restrictions:** NEVER execute `git add` or `git commit`. All commit steps prepare `commit-message.txt` for the user to execute manually.
- **No Celery / Redis:** Background task dispatch must strictly use `SQSService` and existing AWS Lambda/SES pipelines.
- **Dual-Unit Briefing Formatting:** Briefings must display dual units (e.g. `30m (98ft)`, `22°C (72°F)`) for maximum international readability.

---

### Task 4.1: `TripBriefing` Model, Migration & Compilation Service

**Files:**
- Modify: `backend/app/models.py`
- Create: Sequential migration file (e.g. `backend/migrations/versions/0096_create_trip_briefing_table.py`)
- Create: `backend/app/services/briefing_service.py`
- Create: `backend/app/templates/booking/briefings/trip_briefing.html.j2`
- Test: `backend/tests/test_briefing_service.py`

**Interfaces:**
- Consumes: `OctoAvailabilitySlot`, `DiveSite`, `fetch_wind_data_single_point`, `SQSService`.
- Produces: `BriefingService.compile_draft_briefing(db, slot_id) -> TripBriefing`, `BriefingService.dispatch_briefing(db, briefing_id, user_id)`.

- [x] **Step 1: Write tests for draft compilation and weather synthesis**

Create `backend/tests/test_briefing_service.py`:
```python
import pytest
from unittest.mock import patch
from app.services.briefing_service import BriefingService
from app.models import TripBriefing

@patch("app.services.open_meteo_service.fetch_wind_data_single_point")
def test_compile_draft_briefing_synthesis(mock_fetch_weather, db, test_slot_with_site):
    mock_fetch_weather.return_value = {
        "wave_height": 0.6,
        "wind_speed_10m": 5.1, # m/s (~10 knots)
        "sea_surface_temperature": 24.0,
    }
    
    briefing = BriefingService.compile_draft_briefing(db, test_slot_with_site.id)
    assert briefing.id is not None
    assert briefing.status == "DRAFT_PENDING_REVIEW"
    assert briefing.weather_forecast_data["wave_height"] == 0.6
    assert "Zenobia Wreck" in briefing.site_profile_notes
```

- [x] **Step 2: Add `TripBriefing` to `backend/app/models.py` and create migration**

Create `backend/migrations/versions/0096_create_trip_briefing_table.py`.

- [x] **Step 3: Create Jinja2 briefing template `trip_briefing.html.j2` and ReportLab PDF compiler**

Include header with boat & meeting time, dive site depth & topography, marine life species icons/photos, live wind/wave forecast, packing checklist, and emergency action plan (hyperbaric chamber phone + VHF 16).

- [x] **Step 4: Implement `BriefingService`**

- [x] **Step 5: Run tests in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_briefing_service.py
```
Expected: `All tests passed!`.

- [x] **Step 6: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add TripBriefing model, compilation service, and Jinja2 PDF template

Synthesizes dive site details, Open-Meteo forecasts, and emergency action plans
into automated draft briefings.
```

---

### Task 4.2: Center Manager Briefing Review Endpoints & Dispatch Integration

**Files:**
- Modify: `backend/app/routers/center_booking_ops.py`
- Test: `backend/tests/test_briefing_endpoints.py`

**Interfaces:**
- Consumes: `BriefingService`, `TripBriefing`.
- Produces: 
  - `GET /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/briefing`
  - `PUT /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/briefing`
  - `POST /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/briefing/dispatch`

- [x] **Step 1: Write API tests for briefing editing and dispatch**

Create `backend/tests/test_briefing_endpoints.py`.

- [x] **Step 2: Implement briefing routes in `center_booking_ops.py`**

- [x] **Step 3: Connect dispatch to `SQSService` queue**

Pushes `DISPATCH_TRIP_BRIEFING` task with recipient list and compiled PDF URL.

- [x] **Step 4: Run tests in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_briefing_endpoints.py
```
Expected: `All tests passed!`.

- [x] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add briefing review and SQS dispatch endpoints

Enables center managers to customize briefing notes and trigger asynchronous
PDF email dispatch to all confirmed divers on the trip roster.
```

---

### Task 4.3: Frontend Briefing Review Modal & Diver Viewer

**Files:**
- Create: `frontend/src/components/booking/BriefingReviewModal.jsx`
- Modify: `frontend/src/components/booking/TripOperationsDashboard.jsx`
- Modify: `frontend/src/pages/BookingVoucherPage.jsx` (add "View Briefing" button)
- Test: Frontend verification via Chrome DevTools MCP & unit tests

**Interfaces:**
- Consumes: Briefing endpoints.
- Produces: Manager review UI with editable notes and diver PDF viewer.

- [x] **Step 1: Implement `BriefingReviewModal.jsx`**

Modal in operations dashboard showing live briefing preview, weather badge, editable meeting notes textarea, skipper selector, and "Approve & Dispatch" button.

- [x] **Step 2: Add "View Briefing" download button in `BookingVoucherPage.jsx`**

- [x] **Step 3: Run frontend lint and browser verification**

Run:
```bash
make lint-frontend
```
Verify via Chrome DevTools MCP and check for zero console errors.

- [x] **Step 4: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add briefing review modal and diver briefing viewer

Allows center staff to review and approve pre-dive briefings before dispatch
and divers to download the PDF briefing directly from their vouchers.
```

---

### Phase 4 Verification Checklist
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_briefing_service.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_briefing_endpoints.py` passes.
- [x] `make lint-frontend` passes with zero errors.
- [x] Browser verification passes via Chrome DevTools MCP with zero console errors.
