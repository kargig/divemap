# Implementation Plan: Booking Access Control Hardening

- **Date:** 2026-10-14
- **Status:** Approved Draft for Implementation
- **Author:** AI Software Architect & Senior Security Engineer
- **Parent Specification:** `docs/superpowers/specs/2026-10-14-booking-access-control-hardening-design.md`
- **Out of Scope:** Client-side fast-checkout cookie / localStorage PII reduction.

> **For agentic workers:** Implement task-by-task. Use checkbox tracking. Backend tests only via `./docker-test-github-actions.sh`. NEVER auto-commit.

---

## Global Constraints

- **No Raw Pytest on Host / No pytest inside `divemap_backend`:** Always `cd backend && ./docker-test-github-actions.sh [tests/...]`.
- **Git:** Do not `git add` / `git commit` unless the user explicitly asks.
- **Migration:** Next number is `0105` (pulls claim-token security fields forward; Phase 5 remaining safety fields shift to `0106+`).
- **Frontend:** `make lint-frontend` must pass for touched files.

---

## Task Checklist

- [x] **Task 1: Schema & migration `0105`**
  - Add to `OctoBooking`: `access_token_hash`, `access_token_expires_at`.
  - Add to `OctoBookingUnitItem`: `claim_token_hash`, `claim_status`, `claim_invited_at`, `claim_completed_at`.
  - Create `backend/migrations/versions/0105_add_booking_access_and_claim_tokens.py` (`down_revision='0104'`).
  - Model unit tests in `backend/tests/test_booking_access_token_models.py`.

- [x] **Task 2: Shared authz helpers**
  - Create `backend/app/services/booking_access_service.py`:
    - `hash_booking_token(raw: str) -> str`
    - `mint_booking_access_token(booking) -> str` (sets hash + expiry, returns raw)
    - `verify_booking_access(booking, raw_token) -> bool`
    - `mint_claim_token(unit_item) -> str`
    - `verify_claim_token(unit_item, raw_token) -> bool`
    - `require_booking_principal(booking, current_user, access_token, db) -> None` (raises 401/403)
    - `assert_slot_belongs_to_center(db, slot_id, center_id)`
    - `assert_participant_on_center_trip(db, participant_id, trip_id, center_id)`
    - `validate_physician_certificate_url(url: Optional[str]) -> Optional[str]`
  - Unit tests in `backend/tests/test_booking_access_service.py`.

- [x] **Task 3: OCTO router — mint token + gate lifecycle**
  - `POST /octo/bookings`: mint access token; return `accessToken` in response schema.
  - Multi-diver: mint claim tokens for unit items after the first; set `claim_status=INVITED`.
  - Gate `GET/POST .../bookings/{uuid}`, confirm, cancel, extend via `require_booking_principal`.
  - Confirm: do **not** invent medical clearance; extend access token expiry for voucher window.
  - Update `backend/tests/test_octo_api.py`.

- [x] **Task 4: Bookings router — paperwork, voucher, briefing, annual medical**
  - Gate `submit-paperwork`, voucher JSON/PDF, briefing PDF with `require_booking_principal`.
  - `submit-paperwork`: stop auto-confirming entire booking from one seat; confirm only when all unit items have `waivers_complete` + medical record present (or keep status unchanged and document).
  - `useAnnualMedical`: require authenticated caller and that caller is booker or matching unit `user_id`.
  - Voucher PDF: medical default `NOT_SUBMITTED`.
  - Annual medical POST: validate physician URL; audit write.
  - Paperwork medical write: audit.
  - Claim endpoints:
    - `GET /{uuid}/claim/{claim_token}`
    - `POST /{uuid}/claim/{claim_token}` (paperwork for that seat only)
  - `my-bookings`: email match only if `email_verified`.
  - Update `backend/tests/test_bookings_router.py`; add `backend/tests/test_booking_access_control_api.py` and `backend/tests/test_guest_claim_api.py`.

- [x] **Task 5: Center ops isolation + PDF token hygiene**
  - Apply `assert_slot_belongs_to_center` / `assert_participant_on_center_trip` on all trip/participant routes in `center_booking_ops.py`.
  - Medical mutate paths: call `log_medical_access`.
  - Fix audit fallback away from `user_id=1` in `medical_audit_service.py`.
  - Manager PDF routes: remove JWT `?token=` acceptance; require session (blob download pattern). Update frontend ops PDF buttons accordingly.
  - Update `backend/tests/test_center_booking_ops_api.py` and `backend/tests/test_medical_audit_logs.py`.

- [x] **Task 6: Frontend wiring**
  - `BookingWizard.jsx`: capture `accessToken`; send header on paperwork / subsequent OCTO calls; pass token into voucher navigation.
  - `BookingVoucherPage.jsx`: read `access_token` from query or sessionStorage; send header.
  - `UserBookingsPage.jsx`: authenticated briefing/voucher via session.
  - Add `GuestBookingClaimPage.jsx` + route in `App.jsx` (minimal claim intake reusing medical/waiver modals where practical).
  - Center ops: PDF downloads via authenticated `api.get` blob (no JWT in URL).
  - **Do not** modify `bookingCookies.js` PII fields.

- [x] **Task 7: Docs index + Phase 5 migration note**
  - Update `docs/superpowers/plans/2026-09-27-divemap-octo-booking-plan-of-plans.md` with hardening row and migration renumber note.
  - Update `phase-5-safety-gates-and-group-workflows.md` header: claim-token security fields delivered in `0105`; remaining safety fields `0106+`.
  - Brief note in parent OCTO design §5.3 pointing at access-token + hash-at-rest.

- [x] **Task 8: Verification**
  - `cd backend && ./docker-test-github-actions.sh tests/test_booking_access_control_api.py` ✅
  - Guest claim covered inside `test_booking_access_control_api.py` ✅
  - `cd backend && ./docker-test-github-actions.sh tests/test_octo_api.py` ✅
  - `cd backend && ./docker-test-github-actions.sh tests/test_bookings_router.py` ✅
  - `cd backend && ./docker-test-github-actions.sh tests/test_center_booking_ops_api.py` ✅
  - `cd backend && ./docker-test-github-actions.sh tests/test_medical_audit_logs.py` ✅
  - `cd backend && ./docker-test-github-actions.sh tests/test_briefing_endpoints.py` ✅
  - Frontend: BookingWizard access-token header, voucher query/sessionStorage, GuestBookingClaimPage route added. Cookie PII left unchanged per scope.

---

## Implementation Notes

### Response schema addition (OCTO create)

```json
{
  "uuid": "...",
  "accessToken": "<raw once>",
  "status": "ON_HOLD",
  "...": "..."
}
```

### Header

```
X-Booking-Access-Token: <raw>
```

Query fallback for email links: `?access_token=` (voucher/briefing GET only).

### Confirm-all-paperwork rule (v1)

```python
def all_participants_paperwork_complete(booking) -> bool:
    for item in booking.unit_items:
        if not item.waivers_complete:
            return False
        if item.medical_record is None:
            return False
    return True
```

After paperwork/claim: if complete and status is `ON_HOLD`, set `CONFIRMED` and clear hold expiry. If incomplete, leave `ON_HOLD` (or keep prior status). OCTO confirm with token may still confirm hold for seat lock / payment flows **without** clearing medical gates for boarding.

---

## Success Criteria

Matches §13 of the design spec: no UUID-only sensitive diver routes; guest checkout preserved; center isolation; audits; physician URL allowlist; no client cookie PII changes.
