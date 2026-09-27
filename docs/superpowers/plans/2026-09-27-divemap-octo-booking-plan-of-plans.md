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
│  • Diver booking checkout wizard with automated profile pre-fill       │
│  • Interactive DMSC medical modal & touch waiver signing               │
│  • Digital booking voucher with QR code                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Provides confirmed bookings & unit items)
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 3: Center Trip Operations Dashboard & Daily Manifest            │
│  • Operations Dashboard (/manage/centers/:id/trips/:trip_id)           │
│  • Live boat roster with medical status badges and dive currency flags │
│  • Participant management: walk-in add, edit sizing/tank, remove, move │
│  • Onboard roll-call boarding toggle & "Mark Paid" check-in button     │
│  • Equipment crate packing checklist & tank volume tally               │
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

| Phase | Title | Primary Deliverable | Sub-Plan Document |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Diver Profile & Paperwork Engine** | Diver biometrics, Metric/Imperial conversions, local agency questionnaires/waivers, and GDPR envelope encryption. | [`phase-1-diver-profile-and-paperwork.md`](phase-1-diver-profile-and-paperwork.md) |
| **Phase 2** | **Minimal Viable Booking Engine** | Core OCTO 1.0 API, catalog, availability, hold/confirm booking lifecycle, and diver checkout wizard. | [`phase-2-mvp-booking-engine.md`](phase-2-mvp-booking-engine.md) |
| **Phase 3** | **Center Operations Dashboard [DONE]** | Live boat roster, participant walk-ins/edits/cancellations, crate packing checklist, DIN/Yoke valve adapter alerts, weight system breakdown, medical safety gates, Port Authority manifest export, and emergency incident dossier PDF. | [`phase-3-center-operations-dashboard.md`](phase-3-center-operations-dashboard.md) |
| **Phase 4** | **Pre-Dive Briefing Pipeline** | Automated weather & site intelligence synthesis, manager review UI, and AWS SQS PDF email dispatch. | [`phase-4-pre-dive-briefing-pipeline.md`](phase-4-pre-dive-briefing-pipeline.md) |
| **Phase 5** | **Safety Gates & Group Workflows** | DCS no-fly buffer, guest claim magic-links, youth releases, Nitrox analyzer logs, and buddy team pairing. | [`phase-5-safety-gates-and-group-workflows.md`](phase-5-safety-gates-and-group-workflows.md) |
| **Phase 6** | **Advanced Ops & Ecosystem Synergy**| Multi-day passes (`octo/packages`), hotel pickups (`octo/pickups`), equipment stock quotas, offline PWA, and automatic post-dive logbook creation. | [`phase-6-advanced-ops-and-ecosystem-synergy.md`](phase-6-advanced-ops-and-ecosystem-synergy.md) |

---

## 3. Global Quality & Verification Standards

Every sub-plan must satisfy the following non-negotiable verification gates before being marked complete:

1. **Alembic Sequential Migrations (Starting at 0094):**
   * The codebase currently contains migrations up to `0093_add_facebook_login_fields.py`.
   * Sequential migrations for the booking system MUST follow:
     * Phase 1: `0094_create_user_gear_profiles.py`
     * Phase 2: `0095_create_octo_core_booking_models.py`
     * Phase 4: `0096_create_trip_briefing_table.py`
     * Phase 5: `0097_add_safety_and_group_claim_fields.py`
     * Phase 6: `0098_create_advanced_ops_models.py`
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
