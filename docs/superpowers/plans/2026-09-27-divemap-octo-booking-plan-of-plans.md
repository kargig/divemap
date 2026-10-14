# Divemap Native Booking Platform & OCTO Integration: Plan of Plans

- **Date:** 2026-09-27
- **Status:** Approved Master Roadmap
- **Parent Specification:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md`
- **Architectural Approach:** Incremental Subsystem Decomposition (Strict Forward-Only Dependencies)

---

## 1. Roadmap Architecture & Dependency Graph

To manage complexity, de-risk implementation, and deliver immediate value at every step, the system is decomposed into **6 independent, sequentially ordered sub-plans**.

### Strict Forward-Only Dependency Rule
Each sub-plan depends **strictly on the completed artifacts of preceding phases**. No phase ever depends on, requires, or anticipates unbuilt future phases. Every phase yields a self-contained, testable, and functional increment in production.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Diver Gear Profile & Encrypted Paperwork Engine              │
│  • Canonical cylinders & gas mixes (backend constants mirroring diveConstants.js)
│  • Bidirectional metric <-> imperial conversion engine                 │
│  • UserGearProfile DB model & Alembic migration                        │
│  • AES-256-GCM / MultiFernet envelope encryption service               │
│  • DMSC 2020 medical & Jinja2 legal waivers rendering engine           │
│  • Frontend profile gear & biometrics editor with live unit switcher   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Provides biometrics, encryption & waivers)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 2: Minimal Viable Booking Engine (Single Trip & OCTO Core)      │
│  • OCTO 1.0 Supplier Core Models (OctoProduct, Option, Unit, Booking)  │
│  • Center settings model (DivingCenterBookingSettings: PAY_ON_ARRIVAL) │
│  • OCTO 1.0 Supplier API (Catalog, Availability, Hold, Confirm, Cancel)│
│  • 5-Step Guided Booking Wizard (Credentials, Equipment, Insurance,    │
│    Medical DMSC 2020, Liability Waiver) with live wide summary         │
│  • Dive accident insurance & mandatory emergency contact integration   │
│  • Digital booking voucher with QR code                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Provides confirmed bookings & unit items)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 3: Center Trip Operations Dashboard & Daily Manifest            │
│  • Multi-View Operations Dashboard: /manifest, /gear-check, /crates    │
│  • Tab 1: Live boat roster with Gear Check column & medical safety gate│
│  • Tab 2: Individual diver equipment inspection & handover checklist   │
│  • Tab 3: Dockside crate packing with configurable 1 to 5 crates       │
│  • Top-to-bottom gear: Torches, scooters, stages, hoods, boots, fins   │
│  • One-click Maritime Port Authority / Coast Guard manifest export     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Provides active departures & passenger roster)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 4: Pre-Dive Briefing Pipeline (AWS SQS + Open-Meteo)            │
│  • TripBriefing model & database table                                 │
│  • Automated 24-48h draft compiler (dive site data + marine forecast)  │
│  • Site-specific Emergency Action Plan (EAP) and nearest chamber info  │
│  • Center manager briefing review and customization UI                 │
│  • Async PDF compilation & SES email dispatch via AWS SQS queue        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Connects isolated booking engine to core app)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 4.5: Core Discovery, Center Hub & Public Booking Bridge         │
│  • Link ParsedDiveTrip to OctoAvailabilitySlot (octo_slot_id)          │
│  • Auto-provisioning OCTO product/option/slot on trip creation/update  │
│  • Center manager portal: /diving-centers/:id/manage & /trips-summary  │
│  • Public discovery badges & instant booking CTA on /dive-trips        │
│  • Customer reservations dashboard at /profile/bookings                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Enhances bookings with advanced validation)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 5: Scuba Safety Gates & Multi-Party Group Workflows             │
│  • DCS No-Fly buffer validation (12h/18h surface interval check)       │
│  • Multi-party guest claim magic-links (independent group waivers)     │
│  • Minor protection (under 18 guardian co-signature & 12m depth caps)  │
│  • Inactive diver currency checks (>180d / >365d refresher gates)      │
│  • Nitrox certification gate, dockside analyzer log & sign-off         │
│  • Buddy pairing & dive guide assignment interface                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Builds on complete operational platform)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 6: Advanced Operations & Divemap Ecosystem Synergy              │
│  • Public discovery bridge (/dive-trips <-> /book/:slotId)             │
│  • Center operator shortcuts (/dive-trips/:id -> /manage/... ops)      │
│  • Multi-day passes & multi-session courses (octo/packages)            │
│  • Hotel & resort shuttle pickup logistics (octo/pickups)              │
│  • Physical rental equipment inventory stock quotas                    │
│  • Offshore offline boat mode with IndexedDB PWA synchronization       │
│  • Post-dive automatic logbook sync (trip -> draft Dive log creation)  │
│  • External travel aggregator webhooks (octo/webhooks: Viator, Bokun)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Index & Summary

| Phase | Title | Primary Deliverable | Sub-Plan Document | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **Diver Profile & Paperwork Engine** | Diver biometrics, Metric/Imperial conversions, local agency questionnaires/waivers, and GDPR envelope encryption. | [`phase-1-diver-profile-and-paperwork.md`](phase-1-diver-profile-and-paperwork.md) | **Completed** |
| **Phase 2** | **Minimal Viable Booking Engine** | Core OCTO 1.0 API, catalog, availability, hold/confirm booking lifecycle, and diver checkout wizard. | [`phase-2-mvp-booking-engine.md`](phase-2-mvp-booking-engine.md) | **Completed** |
| **Phase 3** | **Center Operations Dashboard** | Live boat roster, participant walk-ins/edits/cancellations, crate packing checklist, DIN/Yoke valve adapter alerts, weight system breakdown, medical safety gates, Port Authority manifest export, and emergency incident dossier PDF. | [`phase-3-center-operations-dashboard.md`](phase-3-center-operations-dashboard.md) | **Completed** |
| **Phase 4** | **Pre-Dive Briefing Pipeline** | Automated weather & site intelligence synthesis, manager review UI, and AWS SQS PDF email dispatch. | [`phase-4-pre-dive-briefing-pipeline.md`](phase-4-pre-dive-briefing-pipeline.md) | **Completed** |
| **Phase 4.5** | **Discovery, Center Hub & Booking Bridge** | Linking `ParsedDiveTrip` to `OctoAvailabilitySlot`, dedicated manager portal at `/diving-centers/:id/manage`, public booking CTAs, and diver reservations hub at `/profile/bookings`. | [`phase-4-5-booking-system-public-discovery-bridge.md`](phase-4-5-booking-system-public-discovery-bridge.md) | **Completed** |
| **Enhancement** | **Fully-Booked Trip Inquiries & Offline Capacity** | Friction-free diver contact flow (in-app chat, WhatsApp, email, phone) with pre-filled trip context when online seats are full, capacity guard on checkout wizard, and 'Online spots full' badges. | [`2026-10-13-fully-booked-trip-inquiry-plan.md`](2026-10-13-fully-booked-trip-inquiry-plan.md) | **Completed** |
| **Safety Gate** | **Annual Medical Clearance & Center Approval Engine** | 1-year valid DMSC 2020 annual medical questionnaire (`/profile/medical`), center physician 1-year approval engine, and GDPR Article 17 right-to-erasure endpoint. | [`2026-10-13-annual-medical-questionnaire-design.md`](../specs/2026-10-13-annual-medical-questionnaire-design.md) | **Completed** |
| **Ops & UX** | **Smart Gear Profile Integration & Gap Resolver** | Item-by-item gear ownership and conditional rental sizing cards on `/profile/gear`, auto-selection and application of primary gear setup in `BookingWizard.jsx` Step 2, grayed-out/hidden rental sizing for owned gear with instant overrides, DIN/Yoke valve synchronization, local diver lead ballast tracking, and dynamic dual-tone equipment checklists. | [`2026-10-14-smart-gear-profile-booking-integration-plan.md`](2026-10-14-smart-gear-profile-booking-integration-plan.md) | **Completed** |
| **Security** | **Booking Access Control Hardening** | Dual credentials for guest + authenticated bookers (`booking_access_token` + session ownership), claim-token magic links (hash-at-rest), center↔slot↔participant IDOR fixes, confirm/paperwork split, medical audit writes, physician URL allowlist, manager PDF token hygiene. Excludes client-side fast-checkout cookie PII reduction. | [`2026-10-14-booking-access-control-hardening-plan.md`](2026-10-14-booking-access-control-hardening-plan.md) / [`spec`](../specs/2026-10-14-booking-access-control-hardening-design.md) | **Completed** |
| **Phase 5** | **Safety Gates & Group Workflows** | DCS no-fly buffer, remaining youth/Nitrox/buddy gates. Guest claim magic-link **security subset** delivered under Access Control Hardening (`0105`); remaining Phase 5 safety columns use `0106+`. | [`phase-5-safety-gates-and-group-workflows.md`](phase-5-safety-gates-and-group-workflows.md) | Planned |
| **Phase 6** | **Advanced Ops & Ecosystem Synergy**| Multi-day passes (`octo/packages`), hotel pickups (`octo/pickups`), physical rental equipment stock quotas, offshore offline PWA sync, and automated post-dive logbook creation. | [`phase-6-advanced-ops-and-ecosystem-synergy.md`](phase-6-advanced-ops-and-ecosystem-synergy.md) | Planned |

---

## 3. Global Quality & Verification Standards

Every sub-plan must satisfy the following non-negotiable verification gates before being marked complete:

1. **Alembic Sequential Migrations (Starting at 0105):**
   * The codebase currently contains sequential migrations up to `0104_add_gear_profile_ownership_flags.py` (following `0103_add_annual_and_center_medical_clearances.py`).
   * Sequential migrations for subsequent phases MUST follow:
     * Security hardening: `0105_add_booking_access_and_claim_tokens.py` (access token + claim token hashes)
     * Phase 5 remaining safety fields: `0106_add_safety_gate_fields.py`
     * Phase 6: `0107_create_advanced_ops_models.py`
2. **Backend Testing Isolation:**
   * Direct host `pytest` is strictly forbidden.
   * Tests must execute via `./docker-test-github-actions.sh [test_file]` against ephemeral MySQL containers.
3. **Frontend Quality & Zero Console Errors:**
   * Every component and page must pass `make lint-frontend` with zero errors.
   * Every page must be visually inspected and verified using Chrome DevTools MCP (`navigate_page`, `take_snapshot`) and confirmed to produce zero browser console errors (`list_console_messages`).
4. **Responsive Mobile First (Zero Horizontal Scrolling):**
   * Top-level wrappers must use `max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8`.
   * Horizontal scrolling on mobile is strictly prohibited (`overflow-x-auto` is forbidden; responsive card-stack views must be used on mobile for multi-column rosters and tables).
5. **Git Protocol:**
   * Feature branch workflow: `feature/[task-name-kebab-case]`.
   * All git commits are staged manually by the user via prepared `commit-message.txt`. No direct `git commit` or `git add` from agent tooling.
