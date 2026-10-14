# Implementation Plan: Smart Gear Profile Integration & Equipment Gap Resolver

- **Date:** 2026-10-14
- **Status:** Approved Draft for Implementation
- **Author:** AI Software Architect & Senior Diving Operations Engineer
- **Parent Specification:** `docs/superpowers/specs/2026-10-14-smart-gear-profile-booking-integration-design.md`

---

## Technical Checklist & Implementation Steps

- [x] **Task 1: Database Model & Alembic Migration `0104`**
  - Add ownership columns to `UserGearProfile` in `backend/app/models.py`:
    `has_own_mask`, `has_own_wetsuit`, `has_own_regulator`, `has_own_bcd`, `has_own_fins`, `has_own_boots`, `has_own_torch`, `has_own_lead_weights`.
  - Create sequential migration `backend/migrations/versions/0104_add_gear_profile_ownership_flags.py` (down_revision: `'0103'`).
  - Update `UserGearProfileSchema`, `UserGearProfileCreateSchema`, and `UserGearProfileUpdateSchema` in `backend/app/routers/diver_gear_profile.py`.
  - Run model tests in isolated Docker: `cd backend && ./docker-test-github-actions.sh tests/test_annual_and_center_medical_models.py`.
  - Apply migration to local development database: `docker-compose exec -T backend python run_migrations.py`.

- [x] **Task 2: User Profile Gear Configuration UI Updates**
  - Update `DiverGearConfigForm.jsx` and `UserGearProfileModal.jsx` to render gear ownership checkboxes.
  - Group checkboxes cleanly: Mask, Suit, Regulator (with DIN/Yoke radio), BCD, Fins, Boots, Computer, Torch, SMB, and Weight/Lead preferences (Integrated Pockets vs Belt, and Own Lead vs Center Lead).
  - Test saving/editing profiles on `/profile/gear`.

- [x] **Task 3: Backend Checkout Context & Paperwork Sizing Bridge**
  - Update `get_checkout_context` in `backend/app/routers/bookings.py` to include `user_gear_profiles: List[...]` with all user setups and ownership flags.
  - Update `submit_diver_paperwork` in `backend/app/routers/bookings.py` to accept `gear_ownership_summary` and store valve fitting requirements on the booking unit item.
  - Write test verifying multi-profile serialization and pricing computation in `backend/tests/test_gear_gap_pricing.py`.

- [x] **Task 4: Booking Wizard Step 2: Smart Gear Gap Resolver & Valve Sync**
  - Add Gear Profile Switcher dropdown at top of Step 2 in `BookingWizard.jsx`.
  - Implement dual-tone color-coded checklist:
    - 🟢 Green section: **Bringing Your Own Gear (Diver Provided)**
    - 🔵 Blue section: **Rental Gear Required (Center Provided)**
  - Implement Regulator / Tank Valve Binding:
    - If diver brings regulator: auto-locks cylinder valve requirement to match (DIN vs YOKE) and instructs dive center.
    - If diver rents regulator: allows selection of DIN or YOKE.
  - Live pricing recalculation: displays itemized rental prices with automatic package cap discount.

- [x] **Task 5: Operations Roster & Packing Manifest Integration**
  - Update `GearPackingManifest.jsx` and `BoatManifestTable.jsx` to display color-coded badges for diver's own gear vs center rental pieces.
  - Ensure DIN vs Yoke cylinder count and insert warnings are prominently surfaced for the boat deck crew.

- [x] **Task 6: Verification & Quality Control**
  - Run `make lint-frontend` ensuring 0 errors.
  - Run backend test suite via `./docker-test-github-actions.sh`.
  - Visually verify in Chrome DevTools MCP with multiple gear profile selections and confirm 0 browser console errors.
