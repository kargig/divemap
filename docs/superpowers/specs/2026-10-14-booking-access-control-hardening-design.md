# Specification: Booking Access Control Hardening (Guest + Authenticated)

- **Date:** 2026-10-14
- **Status:** Approved Design for Implementation
- **Author:** AI Software Architect & Senior Security Engineer
- **Parent Specifications:**
  - `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (§5.3 Guest Claim, OCTO lifecycle, medical encryption)
  - `docs/superpowers/plans/phase-5-safety-gates-and-group-workflows.md` (claim-token subset pulled forward)
- **Out of Scope:** Client-side fast-checkout cookie / localStorage PII reduction (tracked separately).

---

## 1. Executive Summary & Problem Statement

Divemap's booking platform intentionally supports:

1. **Logged-in Divemap users** (pre-fill, annual medical, my-bookings).
2. **Anonymous / guest checkout** (nullable `OctoBooking.user_id`, contact fields).
3. **OTA / external supplier holds** (OCTO interoperability).
4. **Multi-party group guests** who complete paperwork via magic links without accounts.

Current implementation treats the **booking UUID as the sole credential** for paperwork submission, voucher/PDF download, OCTO confirm/cancel/extend, and briefing PDF. Center trip-scoped ops routes often verify manager membership for `center_id` but **do not bind** `trip_id` / `participant_id` to that center.

**Goal:** Preserve guest checkout while enforcing:

> **UUID identifies; access/claim token or session authorizes; center staff authorize only within their center.**

---

## 2. Security Principles

| Principle | Rule |
|-----------|------|
| P1 Capability separation | `booking_uuid` is a public identifier. It never alone unlocks medical write, passport export, confirm, or cancel. |
| P2 Dual guest credentials | Lead booker receives a `booking_access_token` at hold creation. Co-divers receive per-seat `claim_token` magic links. |
| P3 Hash at rest | Store only SHA-256 (or stronger) hashes of access/claim tokens. Return raw tokens once. |
| P4 Session OR token | Authenticated owners may use session auth; guests must present a valid token. Either path is sufficient when correct. |
| P5 Least privilege | Claim tokens authorize **one unit item** only. Access tokens authorize lead-booker booking lifecycle for that UUID. |
| P6 Center isolation | Every center ops trip/participant route asserts slot and booking belong to `center_id`. |
| P7 Confirm ≠ paperwork | Confirming a booking does not imply medical/waiver completion. Paperwork is per-participant. |
| P8 Audit medical mutations | Every medical decrypt **and** encrypt/update/clear/grant is audited with a real accessor id (never fallback `user_id=1`). |

---

## 3. Authorization Model

### 3.1 Decision Function

For diver-facing booking UUID routes:

```
ALLOW if ANY of:
  A. current_user is authenticated AND (
        booking.user_id == current_user.id
        OR (current_user.email_verified AND emails_equal(booking.contact_email, current_user.email))
     )
  B. valid booking_access_token presented for this booking
     (header X-Booking-Access-Token preferred; query ?access_token= allowed for email/PDF links)
  C. valid claim_token presented for the specific unit item being mutated/read
     (claim routes only)
  D. bona fide center staff for booking.diving_center_id (ops routes only; never for guest medical write via public UUID)

ELSE → 401/403
```

### 3.2 Auth Matrix

| Action | Guest (access token) | Logged-in booker | Co-diver (claim token) | Center manager |
|--------|----------------------|------------------|------------------------|----------------|
| Create hold | Yes | Yes | — | Walk-in API |
| Submit own / lead paperwork | Yes | Session OR token | Claim token for **their** seat only | Desk override + audit |
| View voucher / PDF | Yes (token) | Owner session OR token | No full passport PDF via claim (optional: own-seat summary later) | Center-scoped ops exports |
| Confirm / cancel / extend | Yes (token) | Owner session OR token | No | Ops cancel with audit |
| Briefing PDF (booking UUID) | Token | Owner session OR token | No | Center briefing routes |
| Decrypt trip medical | No | No (annual `/medical/me` only for own profile) | No | Staff + center+slot binding + audit |
| Annual medical reuse on seat | N/A | Own profile → own seat / lead managing own seat only | After claim + optional login | Approval grant only |

---

## 4. Data Model Changes

### 4.1 `OctoBooking` (lead booker access)

| Column | Type | Notes |
|--------|------|-------|
| `access_token_hash` | `String(64)`, nullable, index | SHA-256 hex of raw access token |
| `access_token_expires_at` | `DateTime(timezone=True)`, nullable | Defaults to hold expiration at create; after confirm, extend to trip date + grace (e.g. +7 days) for voucher read |
| `voucher_token_hash` | `String(64)`, nullable | Optional read-only token minted at confirm (may equal rotated access token with read scope in v1) |

**v1 simplification:** One access token with scopes inferred by booking status:

- `ON_HOLD`: allow paperwork, confirm, cancel, extend, voucher
- `CONFIRMED`: allow voucher/briefing read + cancel; disallow re-confirm; paperwork allowed until all seats complete
- `CANCELLED` / `EXPIRED`: deny token use (404/403)

### 4.2 `OctoBookingUnitItem` (guest claim — security subset of Phase 5)

| Column | Type | Notes |
|--------|------|-------|
| `claim_token_hash` | `String(64)`, unique, nullable, index | SHA-256 of raw claim token |
| `claim_status` | `String(30)`, default `CLAIMED` | `INVITED` \| `CLAIMED` |
| `claim_invited_at` | `DateTime(timezone=True)`, nullable | |
| `claim_completed_at` | `DateTime(timezone=True)`, nullable | |

**Do not store plaintext claim tokens.** Phase 5 plan's plaintext `claim_token` column is superseded by `claim_token_hash`.

### 4.3 Migration

- File: `backend/migrations/versions/0105_add_booking_access_and_claim_tokens.py`
- `down_revision = '0104'`
- Updates Phase 5 plan numbering: remaining Phase 5 safety fields (no-fly, nitrox analyzer, buddy pairing, guardian) move to `0106+`.

---

## 5. Token Lifecycle

### 5.1 Booking access token

1. On `POST /api/v1/octo/bookings` (hold create):
   - Generate `raw = secrets.token_urlsafe(32)`
   - Persist `access_token_hash = sha256(raw)`, `access_token_expires_at = utc_hold_expiration`
   - Return `accessToken` **once** in the create response (alongside `uuid`)
2. Wizard stores token in memory / sessionStorage for the checkout tab (not durable cookie PII store — out of scope here).
3. Confirmation email (when/if sent) includes `?access_token=` link.
4. On successful confirm: extend `access_token_expires_at` to `slot.start_datetime + 7 days` (voucher retrieval window).
5. On cancel/expire: clear hash or set expires_at to now.

### 5.2 Claim token (multi-diver)

1. When hold includes multiple unit items:
   - Seat #1 (lead): no claim token required if lead completes via access token / session
   - Seats #2+: generate claim token, set `claim_status=INVITED`, email/WhatsApp link when notification pipeline exists
2. Endpoints:
   - `GET /api/v1/bookings/{uuid}/claim/{claim_token}` — validate + return limited booking context for that seat
   - `POST /api/v1/bookings/{uuid}/claim/{claim_token}` — submit sizing, DOB, medical, waiver for **that** unit item only
3. On successful claim POST: set `claim_status=CLAIMED`, `claim_completed_at=now`, mark waivers/medical as for that item only
4. Does **not** confirm the whole booking unless all required seats are complete (see §6)

### 5.3 Presentation

| Channel | Mechanism |
|---------|-----------|
| API (wizard) | Response body `accessToken`; subsequent calls use header `X-Booking-Access-Token` |
| Email / deep link | Query `access_token` or path claim token (one-time style links) |
| Manager PDF downloads | Prefer session cookie; if query needed, mint **short-lived signed download token** scoped to resource (not reuse of long-lived JWT access token) |

---

## 6. Confirm vs Paperwork Split

### 6.1 Current (incorrect) behavior

- `submit-paperwork` sets `booking.status = CONFIRMED` after a single unit item
- OCTO `confirm` can confirm without medical/waivers

### 6.2 Target behavior

| Endpoint | Effect |
|----------|--------|
| `submit-paperwork` / claim POST | Updates **that** unit item medical + waivers only. Does **not** force whole-booking `CONFIRMED` unless all adult unit items have `waivers_complete` and a medical record in an acceptable status (`CLEARED`, `PHYSICIAN_APPROVED`, or center policy `FLAGGED_CONTACT_CENTER` with staff override — v1: require `waivers_complete` + medical record exists for all items before auto-confirm). |
| OCTO `confirm` | Transitions `ON_HOLD` → `CONFIRMED` **only if** authorized (token/session). Does **not** invent medical clearance. Boarding gates remain authoritative for boat boarding. |
| Optional status | If product needs a label for “paid but incomplete paperwork,” keep `CONFIRMED` with per-item flags (existing `waivers_complete` + medical status). Do not default missing medical to `CLEARED` on vouchers. |

### 6.3 Voucher medical default

```
medicalClearanceStatus = medical_record.status if medical_record else "NOT_SUBMITTED"
```

Never `"CLEARED"` when absent.

---

## 7. Center Operations Isolation

### 7.1 Shared helpers

```python
def assert_slot_belongs_to_center(db, slot_id: str, center_id: int) -> OctoAvailabilitySlot:
    slot = load slot by id with product
    if not slot or slot.product.diving_center_id != center_id:
        raise 404  # avoid cross-center existence oracle when possible
    return slot

def assert_participant_on_center_trip(db, participant_id, trip_id, center_id) -> OctoBookingUnitItem:
    item = load participant
    if not item or not item.booking:
        raise 404
    if item.booking.diving_center_id != center_id:
        raise 404
    if item.booking.availability_id != trip_id:
        raise 404
    assert_slot_belongs_to_center(db, trip_id, center_id)
    return item
```

### 7.2 Routes requiring binding

All `center_booking_ops` handlers under `/trips/{trip_id}/...` including:

- manifest, staff update, walk-in add
- participant get/update/delete
- toggle check-in / gear-check
- port authority export, emergency dossier, briefing compile/dispatch/PDF
- equipment checklist / crate packing PDFs

Medical review already checks center + trip; keep and reuse helpers for consistency.

---

## 8. Medical Audit & Physician Certificate URLs

### 8.1 Audit coverage

Call `log_medical_access` (or extended write variant) on:

- Annual `POST /medical/me` and `DELETE /medical/me` (GET already logs)
- `submit-paperwork` medical write (guest or auth)
- Claim medical write
- Center `update_participant_medical_answers`, `clear_participant_medical`, `grant_annual_center_medical_approval`
- Existing medical-review / emergency-dossier paths (keep)

### 8.2 Accessor attribution

```python
accessor_id = accessor_user.id if accessor_user else None
# If schema requires non-null user_id, use a dedicated system user or make column nullable.
# NEVER default to user_id=1.
```

Prefer making `AuthAuditLog.user_id` nullable for anonymous guest medical writes and store `accessor_username="guest"` + booking uuid in details. If nullability is blocked, create/use a well-known `system` / `guest_booking` user id documented in seed data — **not** admin id `1`.

### 8.3 Physician certificate URL allowlist

On write (`physicianCertificateUrl`):

- Must be `https://`
- Host must match configured allowlist (env `PHYSICIAN_CERTIFICATE_ALLOWED_HOSTS`, default Divemap upload/CDN hosts)
- Reject `javascript:`, `data:`, non-HTTPS, and unknown hosts with 400

---

## 9. Manager PDF Download Token Hygiene

Replace long-lived JWT in `?token=` with one of:

**Preferred v1:** Require session auth only for manager PDF routes (browser download via same-origin fetch + blob), matching Port Authority export pattern already used elsewhere.

**If query token required for `<a href>` navigation:** Mint a short-lived (≤5 min) signed token binding `(user_id, center_id, trip_id, resource)` using server secret; verify and discard. Do not accept full session JWT in query strings.

---

## 10. Frontend Impact (minimal)

| Area | Change |
|------|--------|
| `BookingWizard.jsx` | Persist `accessToken` from hold response; send `X-Booking-Access-Token` on paperwork, voucher nav, confirm |
| `BookingVoucherPage.jsx` | Accept `access_token` query or sessionStorage; pass to API |
| `UserBookingsPage.jsx` | Authenticated downloads use session; no UUID-only public briefing |
| New `GuestBookingClaimPage.jsx` | Claim intake using path token (security subset) |
| Center ops PDF buttons | Prefer authenticated blob download; remove JWT query string |

**Explicitly excluded:** changes to `bookingCookies.js` passport/insurance persistence.

---

## 11. Testing Requirements

Isolated Docker only (`./docker-test-github-actions.sh`):

1. Unauthenticated UUID-only paperwork / voucher / confirm → **401/403**
2. Valid access token → allowed for lead flows
3. Logged-in owner without token → allowed
4. Logged-in non-owner without token → denied
5. Cross-center manager cannot read/mutate other center trip/participant
6. Claim token can update only its unit item
7. Voucher PDF medical default `NOT_SUBMITTED` when no record
8. Physician URL reject non-allowlisted hosts
9. Medical write paths create audit rows; no `user_id=1` fallback for guests
10. Encryption tests remain green with new fields

---

## 12. Rollout & Compatibility

- Breaking API change for clients that called UUID routes without credentials.
- Wizard and voucher pages ship in the same release.
- Existing `ON_HOLD` / `CONFIRMED` bookings without `access_token_hash`: managers still operate via center ops; divers must re-request link or support issues new token (admin/center “resend access link” can be follow-up).
- Document `BOOKING_ACCESS_TOKEN` behavior in OCTO supplier notes for future OTA adapters (OTAs should use supplier API keys — separate from diver access tokens).

---

## 13. Success Criteria

1. No diver-facing medical/PII/lifecycle endpoint is UUID-only.
2. Guest checkout still works without a Divemap account.
3. Logged-in owners can manage bookings via session without copying tokens.
4. Center managers cannot cross center boundaries via trip/participant IDs.
5. Medical mutations are auditable; physician URLs cannot phish staff via `javascript:` / arbitrary hosts.
6. Spec and plan checked into `docs/superpowers/`; plan-of-plans indexes this hardening work.
