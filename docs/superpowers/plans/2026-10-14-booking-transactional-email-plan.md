# Implementation Plan: Booking Confirmation & Pre-Dive Briefing Emails

- **Date:** 2026-10-14
- **Status:** Planned (docs only — **no implementation in this change**)
- **Author:** AI Software Architect
- **Parent Specification:** `docs/superpowers/specs/2026-10-14-booking-transactional-email-design.md`
- **Depends On:**
  - Booking Access Control Hardening (completed)
  - Phase 4 Pre-Dive Briefing Pipeline (completed; extend dispatch)

> **For agentic workers (when implementation is authorized):** Implement task-by-task. Backend tests only via `./docker-test-github-actions.sh`. NEVER auto-commit. Do not start this plan until the user explicitly requests implementation.

---

## Global Constraints

- Reuse `SQSService` + SES (`email_service.py`); no Celery/Redis.
- Never persist raw access tokens; rotate on email if hash-only at rest.
- Confirm/dispatch HTTP handlers enqueue work only — do not await SES.
- Frontend: hydrate `?access_token=` into sessionStorage then strip query (existing voucher behavior).

---

## Task Checklist (future)

- [ ] **Task 1: Shared booking email helpers**
  - Add `backend/app/services/booking_email_service.py` (name flexible):
    - `resolve_booking_confirmation_recipient(booking) -> Optional[str]`
    - `ensure_access_token_for_email(booking) -> str` (rotate if needed; extend voucher window)
    - `build_voucher_deep_link(booking, raw_token) -> str`
    - `enqueue_booking_confirmation(booking_uuid, reason)`
  - Unit tests for recipient priority and rotate-on-missing-raw.

- [ ] **Task 2: Confirmation templates & SQS consumer**
  - Jinja2 HTML + plaintext: `backend/app/templates/booking/emails/booking_confirmation.*`
  - SQS task type `DISPATCH_BOOKING_CONFIRMATION`
  - Wire enqueue from confirm paths (`octo.confirm_booking`, `_maybe_confirm_booking_after_paperwork`) without blocking response.
  - Tests with mocked SES/SQS.

- [ ] **Task 3: Resend confirmation API**
  - `POST /api/v1/bookings/{uuid}/resend-confirmation` with `require_booking_principal` and/or center manager.
  - Rate limit per booking; audit log without raw token.
  - Optional voucher empty-state CTA (authenticated or post-token only for v1).

- [ ] **Task 4: Extend briefing dispatch emails**
  - Update `BriefingService.dispatch_briefing` / `DISPATCH_TRIP_BRIEFING` worker:
    - Resolve emails per confirmed seat (user → diver_email → contact_email).
    - Attach/link PDF via short-lived signed URL.
    - Per-booking voucher deep link with `ensure_access_token_for_email`.
  - Manager dispatch response: `sent` / `skipped_no_email` counts.
  - Tests: multi-seat recipient matrix; cancelled booking excluded.

- [ ] **Task 5: Docs & ops**
  - Operator notes: SES templates, bounce handling, resend limits.
  - Cross-link Phase 4 plan “dispatch” section to this enhancement as the access-token-aware completion.
  - Update plan-of-plans status to **Completed** only after verification gates pass.

---

## Verification Gates (when implementing)

1. `./docker-test-github-actions.sh` for new/updated email + briefing dispatch tests.
2. Manual: anonymous confirm → open email link on second browser → voucher loads.
3. Manual: briefing dispatch → guest with only `contact_email` receives PDF + working voucher link.
4. Cancelled booking: old confirmation link returns 401/403.
5. `make lint-frontend` if voucher empty-state changes.

---

## Out of Scope

- Claim-invite WhatsApp/email copy (Phase 5)
- SMS / push
- Contact-email OTP reclaim without token
- Changing Phase 4 draft-generation / manager review UX beyond dispatch recipient + links
