# Specification: Smart Gear Profile Integration & Equipment Gap Resolver

- **Date:** 2026-10-14
- **Status:** Approved Design for Phased Implementation
- **Author:** AI Software Architect & Senior Diving Operations Engineer
- **Parent Specifications:**
  - `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md`
  - `docs/superpowers/plans/2026-09-27-divemap-octo-booking-plan-of-plans.md`

---

## 1. Executive Summary & Problem Statement

In real-world scuba diving, very few divers fit into a binary category of *"100% Own Gear"* or *"100% Full Rental Package"*. Divers frequently travel with a subset of their equipment (e.g., mask, computer, fins, and wetsuit) while renting heavy equipment like BCDs and regulators from the local dive center. Furthermore, seasoned divers maintain multiple gear configurations:
- **Summer / Tropical Setup:** 3mm wetsuit, open-heel travel fins, single cylinder.
- **Winter / Cold Water Setup:** 7mm semi-dry or drysuit, thick boots, heavy lead ballast.
- **Technical / Twinset Setup:** Backplate & wing, DIN regulators, stage bottles.

### Key Operational Challenges Addressed:
1. **Regulator Valve Mismatch (DIN vs Yoke):**
   A diver bringing their own high-end DIN regulator arriving on a boat with standard Yoke-only valves is stranded unless an insert is removed or an adapter is available. Conversely, a Yoke regulator requires an insert in a DIN valve. The booking system must explicitly capture the diver's regulator fitting (`DIN` vs `YOKE`) and instruct the dive center staff to configure the cylinder valve accordingly.
2. **Equipment Gap Calculation:**
   The booking engine must automatically compare the diver's selected gear profile against the required dive kit, computing:
   - **What the diver brings on board** (Green / Diver Owned).
   - **What the center must prepare and pack** (Blue/Amber / Center Rental).
3. **Seamless Multi-Profile Switching at Checkout:**
   Divers must be able to switch between their saved profiles (e.g., *"Summer 3mm"* vs *"Winter 7mm"*) in the booking wizard with one click, automatically updating sizing, rental needs, and pricing.

---

## 2. Architecture & Data Model Extensions

### 2.1 Database Schema: `user_gear_profiles` Extensions
Extend `UserGearProfile` in `backend/app/models.py` with explicit gear item ownership flags:

```python
# Ownership flags added to UserGearProfile:
has_own_mask = Column(Boolean, default=True, nullable=False)
has_own_wetsuit = Column(Boolean, default=False, nullable=False)
has_own_regulator = Column(Boolean, default=False, nullable=False)
# regulator_fitting already exists: Column(String(10), default="DIN", nullable=True) # "DIN" vs "YOKE"
has_own_bcd = Column(Boolean, default=False, nullable=False)
has_own_fins = Column(Boolean, default=False, nullable=False)
has_own_boots = Column(Boolean, default=False, nullable=False)
has_own_torch = Column(Boolean, default=False, nullable=False)
# has_own_dive_computer and has_own_smb already exist

# Weight & Ballast options:
# weight_system already exists: Column(String(20), default="INTEGRATED") # "INTEGRATED", "OWN_BELT", "NEEDS_BELT"
has_own_lead_weights = Column(Boolean, default=False, nullable=False) # False for traveling divers needing center lead blocks
```

### 2.2 Alembic Migration `0104`
- Migration file: `backend/migrations/versions/0104_add_gear_profile_ownership_flags.py`
- Down revision: `'0103'`
- Adds boolean columns to `user_gear_profiles`: `has_own_mask`, `has_own_wetsuit`, `has_own_regulator`, `has_own_bcd`, `has_own_fins`, `has_own_boots`, `has_own_torch`, `has_own_lead_weights`.

### 2.3 Weight & Ballast Handling Architecture
1. **Ballast Carrier (`weight_system`)**:
   - `INTEGRATED`: Diver uses quick-release BCD pockets (own or rental BCD). 0 belts required from center.
   - `OWN_BELT`: Diver brings personal nylon or rubber belt. 0 belts required from center.
   - `NEEDS_BELT`: Center must pack a rental weight belt with buckle.
2. **Lead Blocks (`has_own_lead_weights`)**:
   - If `has_own_lead_weights == False` (standard for ~95% of traveling divers):
     - Center provides raw lead blocks (e.g. 6.0 kg allocated as 2x 2kg + 2x 1kg blocks).
     - Renders under **🔵 Rental Gear Required (Center Provided)**.
     - Tallied into the boat's lead crate on `GearPackingManifest.jsx`.
   - If `has_own_lead_weights == True` (local diver bringing lead from home):
     - 0 kg of lead requested from dive center.
     - Renders under **🟢 Bringing Own Gear (Diver Provided)**.
     - Excluded from the boat crate weight tally.

### 2.3 Extended Checkout Context (`GET /api/v1/bookings/{uuid}/checkout-context`)
Enhance response payload to include the full catalog of the diver's saved profiles:
```json
{
  "user_gear_profiles": [
    {
      "id": 12,
      "name": "Summer 3mm Travel",
      "is_default": true,
      "preferred_unit_system": "METRIC",
      "height_cm": 180,
      "weight_kg": 78,
      "shoe_size_eu": 43.0,
      "wetsuit_gender": "MEN",
      "wetsuit_size": "M",
      "wetsuit_thickness": "3mm",
      "bcd_size": "M",
      "fin_type": "OPEN_HEEL",
      "regulator_fitting": "DIN",
      "has_own_mask": true,
      "has_own_snorkel": true,
      "has_own_wetsuit": true,
      "has_own_regulator": false,
      "has_own_bcd": false,
      "has_own_fins": true,
      "has_own_boots": true,
      "has_own_dive_computer": true,
      "has_own_torch": false,
      "has_own_smb": true,
      "estimated_lead_kg": 4.0
    },
    {
      "id": 15,
      "name": "Winter 7mm Cold Water",
      "is_default": false,
      "..." : "..."
    }
  ]
}
```

---

## 3. Booking Wizard UX: The Smart Gear Gap Resolver (Step 2)

### 3.1 Profile Selector Header
At the top of Step 2 (Equipment & Sizing), authenticated divers see a profile dropdown:
```
┌────────────────────────────────────────────────────────────────────────┐
│  ⚙️ ACTIVE GEAR PROFILE                                                │
│  Select Setup: [ Summer 3mm Travel (Primary)                 ▼ ]       │
│  "Sizing and ownership preferences auto-filled from your profile."     │
└────────────────────────────────────────────────────────────────────────┘
```
Selecting a different profile immediately recalculates sizing, ownership flags, and prices without leaving the checkout flow.

### 3.2 Dual-Tone Color-Coded Gear Checklist
The equipment section presents a unified, color-coded visual checklist:

```
┌────────────────────────────────────────────────────────────────────────┐
│  🟢 BRINGING YOUR OWN GEAR (Diver Provided)                             │
│  ✓ Mask & Snorkel                                                      │
│  ✓ 3mm Wetsuit (Men's Size M)                                          │
│  ✓ Open-Heel Fins & Boots (Size 43)                                    │
│  ✓ Wrist Dive Computer                                                 │
│  ✓ Surface Marker Buoy (SMB)                                           │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  🔵 RENTAL GEAR REQUIRED (Supplied by Center)                          │
│                                                                        │
│  [✓] BCD / Buoyancy Compensator ────────────── Size: [ M ▼ ]  (+€10)   │
│  [✓] Regulator Set (Octo + SPG) ───────────── Valve: [ DIN ▼ ] (+€10)  │
│  [ ] Primary Dive Torch ───────────────────── [ Add Torch +€5 ]        │
│                                                                        │
│  Valve Setting for Boat Crew:                                          │
│  Cylinder Valve Required: [ DIN 200/300 Bar (Threaded) ]               │
│  ℹ️ "Your regulator has a DIN connection. The center will provide a     │
│      tank with the insert removed."                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Regulator & Cylinder Valve Binding Rules
1. **Diver Brings Own Regulator (`has_own_regulator = True`)**:
   - `regulator_fitting` (DIN vs YOKE) is read from their profile.
   - The cylinder valve requirement is locked to match their regulator.
   - If `regulator_fitting == "DIN"`, tank note specifies: `"Provide DIN valve (remove yoke insert)"`.
   - If `regulator_fitting == "YOKE"`, tank note specifies: `"Provide Yoke valve (insert in place)"`.
2. **Diver Rents Regulator (`has_own_regulator = False`)**:
   - Diver can select their preferred valve standard (`DIN` recommended / `YOKE`).
   - Center supplies a matching regulator set and configured cylinder valve.

---

## 4. Center Operations & Roster Integration

### 4.1 Boat Manifest Table (`BoatManifestTable.jsx`)
On the center's operational roster:
- **Valve Column:** Displays high-contrast badge: `DIN` (blue) or `YOKE` (amber).
- **Gear Status Column:** Displays color-coded item badges:
  - 🟢 `Own: Suit, Fins, Mask, Comp`
  - 🔵 `Rental: BCD (M), Reg (DIN)`

### 4.2 Crate Packing Checklist (`GearPackingManifest.jsx`)
- Tally of crates automatically excludes items the diver brings on their own.
- **Valve Fittings Summary:**
  - `DIN Regulators: X`
  - `Yoke Regulators: Y`
  - `Yoke Inserts Needed: Y` (prompts crew: *"Pack Yx DIN-to-Yoke threaded insert(s) + 8mm hex key in boat tool box."*)

---

## 5. Implementation Phasing

1. **Phase 1: Database Model & Alembic Migration 0104**
   - Add ownership columns to `UserGearProfile`.
   - Write and apply migration `0104_add_gear_profile_ownership_flags.py`.
2. **Phase 2: User Profile Gear Form Update**
   - Update `UserGearProfileModal.jsx` / `DiverGearConfigForm.jsx` with checkboxes for gear ownership.
3. **Phase 3: Checkout Context & Pricing Bridge**
   - Update `GET /checkout-context` to serialize all user gear profiles.
   - Update `SubmitPaperworkRequest` to accept the selected profile ID and granular ownership map.
4. **Phase 4: Booking Wizard Sizing & Checklist UI**
   - Add gear profile switcher dropdown in Step 2.
   - Implement dual-tone color-coded checklist (Green = Own vs Blue = Rental).
   - Implement valve fitting synchronization (DIN/Yoke).
5. **Phase 5: Automated Testing & Verification**
   - Unit tests for model and migration in isolated Docker.
   - API tests verifying pricing calculation and gear gap payload.
   - Frontend linting & Chrome DevTools MCP browser testing with 0 console errors.
