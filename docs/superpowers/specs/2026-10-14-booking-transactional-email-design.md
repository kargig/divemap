# Design: Booking Confirmation & Pre-Dive Briefing Emails

- **Date:** 2026-10-14
- **Status:** Approved Design (docs only — implementation deferred)
- **Author:** AI Software Architect
- **Parent Specifications:**
  - `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (§6 Pre-Dive Briefing Pipeline)
  - `docs/superpowers/specs/2026-10-14-booking-access-control-hardening-design.md` (§5 Token Lifecycle)
- **Implementation Plan:** `docs/superpowers/plans/2026-10-14-booking-transactional-email-plan.md`

---

## 1. Problem

After access-control hardening, voucher / paperwork / briefing routes require a booking principal (session owner **or** hashed `access_token`). The wizard strips `?access_token=` from the voucher URL after hydrating `sessionStorage`, so:

1. An **anonymous** booker who opens `/bookings/{uuid}/voucher` on another device cannot load the voucher.
2. Confirmation email with a portable deep link was assumed (“when/if sent”) but never scoped as a deliverable.
3. Phase 4 briefing dispatch emails the PDF to confirmed divers, but deep links must not rely on UUID-only voucher URLs; recipients need a still-valid access token (or an authenticated Divemap session).

---

## 2. Goals

1. **Booking confirmation email** after a booking becomes `CONFIRMED` (OCTO confirm and/or auto-confirm after complete paperwork).
2. **Pre-dive briefing PDF email** remains manager-triggered (Phase 4), but recipient links and attachments must work for anonymous bookers under the access-token model.
3. **Resend** paths for both confirmation and briefing without minting unbounded long-lived secrets.
4. Reuse existing **SES + SQS** infrastructure (`email_service.py`, `sqs_service.py`) — no Celery/Redis.

Non-goals for this design: SMS/WhatsApp, marketing newsletters, OTA supplier webhook emails, guest claim invite email bodies (Phase 5 may reuse the same dispatch helpers).

---

## 3. Confirmation Email

### 3.1 Trigger

Send when booking status transitions to `CONFIRMED` and a recipient address exists:

| Priority | Recipient |
|----------|-----------|
| 1 | Authenticated booker `User.email` if `booking.user_id` set and email present |
| 2 | Else `booking.contact_email` |

Do **not** send on hold create (`ON_HOLD`). Do not send again on idempotent re-entry if already `CONFIRMED` unless explicitly requested via resend.

### 3.2 Content (minimum)

- Center name, product/option title, departure date/time, meeting instructions (if available)
- Booking UUID (human reference)
- Total amount + `PAY_ON_ARRIVAL` / payment status summary
- Primary CTA: **Open digital voucher** →  
  `{PUBLIC_BASE_URL}/bookings/{uuid}/voucher?access_token={raw}`
- Secondary: center phone / contact; link to Divemap account bookings if `user_id` present
- Short privacy note: link grants access to this booking’s voucher and paperwork until expiry; do not forward casually

### 3.3 Access token rules

- Prefer the **existing** raw access token only if still available in-process at confirm time (hold response already returned it once). Prefer **not** to log raw tokens.
- If the server no longer has the raw token (hash-only at rest): **rotate** — mint a new access token (overwrite hash + extend expiry to voucher window: `slot.start_datetime + 7 days`), include the new raw value **only** in the email deep link.
- Resend confirmation: same rotate-or-reuse policy; rate-limit (e.g. 3 / hour / booking) to limit abuse.
- Cancel / expire: clear or invalidate access token per hardening design; confirmation links must fail closed after cancel.

### 3.4 Transport

- Enqueue SQS task `DISPATCH_BOOKING_CONFIRMATION` with `{ booking_uuid, reason: "confirm" | "resend" }`.
- Worker/Lambda loads booking, resolves recipient, ensures token, renders Jinja2 template, sends via SES (HTML + plaintext).
- Audit: log send success/failure without storing raw token (booking uuid, recipient domain or redacted email, template id, message id).

### 3.5 API / UX (when implemented)

- Automatic send on confirm (async; confirm API must not block on SES).
- Optional: `POST /api/v1/bookings/{uuid}/resend-confirmation` gated by `require_booking_principal` **or** center manager for that center.
- Voucher page empty-state for anonymous visitors without token: “Check your email for the confirmation link” + optional “Resend” if they can prove contact email (out of band OTP may be a later iteration; v1 can require center/support or known token).

---

## 4. Pre-Dive Briefing PDF Email

Phase 4 already defines manager **Approve & Dispatch** → `DISPATCH_TRIP_BRIEFING` → SES with PDF to confirmed divers. This design **extends** that path:

### 4.1 Recipients

- All `CONFIRMED` (and optionally `COMPLETED` same-day) unit participants with a usable email: prefer linked `User.email`, else unit `diver_email`, else booking `contact_email` for the lead seat.
- Skip seats with no email; surface count in manager dispatch result (`sent` / `skipped_no_email`).

### 4.2 Body & links

- Attach or link the compiled briefing PDF (private R2 + short-lived signed URL preferred over long-lived public objects).
- Include a **voucher deep link per booking** with that booking’s access token (rotate if needed), so anonymous divers can open voucher + download briefing from the app after arrival.
- Do not put medical answers in email body.

### 4.3 Auth alignment

- In-app `/bookings/{uuid}/briefing` remains gated by `require_booking_principal`.
- Email must never instruct users to open a bare UUID voucher URL as the primary CTA.
- Manager preview / dispatch UI unchanged in intent; implementation updates recipient resolution and deep-link minting.

### 4.4 Relation to confirmation email

| Email | When | Attachment | Deep link |
|-------|------|------------|-----------|
| Confirmation | On `CONFIRMED` | None required (optional thin calendar note later) | Voucher `?access_token=` |
| Briefing | Manager dispatch (typically 24–48h pre-departure) | Briefing PDF | Voucher + optional direct PDF signed URL |

Both share token mint/rotate helpers and SES/SQS patterns.

---

## 5. Security & Privacy

- Raw access tokens appear only in HTTPS email links and transient worker memory — never in DB, logs, or manager UI.
- Tokens remain hashed at rest; email is an intentional bearer channel (same threat model as password-reset links).
- Prefer `?access_token=` in email (allowed by hardening design); FE continues to hydrate sessionStorage and strip query on open.
- GDPR: transactional mail necessary for contract performance; honor suppression only where legally required without breaking safety briefings (document retention of send logs separately from medical ciphertext).

---

## 6. Dependencies

- Access-control hardening (tokens, voucher window expiry) — **done**
- Phase 4 briefing compile/dispatch skeleton — **done** (extend recipient + link behavior)
- SES/SQS operational in target environments

---

## 7. Success Criteria (implementation phase)

1. Anonymous confirm → email arrives with working voucher deep link on a second device.
2. Resend rotates or reissues a working link without UUID-only access.
3. Briefing dispatch emails PDF and includes a working authenticated voucher/briefing path for guests.
4. Cancelled bookings’ old confirmation links stop working.
5. Confirm API latency unaffected (async queue only).
6. Tests cover mint/rotate, recipient resolution, and “no email → skip” paths via `docker-test-github-actions.sh`.

---

## 8. Explicitly Deferred

- Contact-email OTP reclaim without any token
- WhatsApp/SMS confirmation
- Guest claim-invite email templates (Phase 5; reuse helpers)
- Calendar `.ics` attachments
- Localization of email copy
