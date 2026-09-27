# Divemap Native Booking Platform & OCTO 1.0 Supplier Specification

- **Date:** 2026-09-27
- **Status:** Approved Draft for Implementation Planning (Enhanced with Real-World Scuba Ops, Multi-Day Packages, Inventory Allocation & Offline Manifests)
- **Author:** AI Software Architect & Senior Security Engineer
- **Target Subsystem:** Divemap Booking Platform (Native OCTO Supplier, Scuba Operations & Diver Logbook Integration)

---

## 1. Executive Summary & Objectives

This specification defines the architecture, data models, security controls, and operational workflows for expanding Divemap with a native, OCTO-compliant booking and operations platform (Model B).

### Core Goals:
1. **Universal Travel Interoperability (OCTO 1.0):** Implement an open **OCTO 1.0 Supplier API** (`docs.octo.travel`) directly on Divemap so diving centers can manage and sell dive trips, multi-day packages, courses, and excursions, and external aggregators/OTAs (Viator, GetYourGuide, Bokun, TourRadar) can connect seamlessly via standard capabilities (`octo/pricing`, `octo/content`, `octo/webhooks`, `octo/questions`, `octo/waivers`, `octo/packages`, `octo/pickups`, `octo/promotions`).
2. **Multi-Day Packages, Passes & Course Scheduling (`octo/packages`):** Support real-world vacation bookings where divers purchase 3-Day/6-Dive or 5-Day/10-Dive passes with flexible slot redemption, as well as multi-session certifications (e.g. PADI/SSI Open Water: eLearning, confined water pool, open water training dives).
3. **Hotel & Resort Transfer Logistics (`octo/pickups`):** Support resort area transfer logistics with pickup points, scheduled shuttle pickup times, custom hotel names/addresses, and dedicated driver manifests.
4. **Physical Equipment Inventory Allocation:** Go beyond sizing capture by enforcing center-level stock quotas for rental equipment (e.g., maximum available Size M BCDs, 5mm suits, 15L tanks, torches, and rental dive computers), preventing dockside shortages and double-booking.
5. **Zero-Friction Intake & Pre-Fill:** Leverage Divemap's existing diver database (`UserCertification`, logged `Dive` records) and biometrics gear profiles (`UserGearProfile`) to automatically pre-fill certification numbers, dive currency (total dives, date of last dive), and equipment sizing.
6. **Multi-Party Group Bookings & Guest Claim Workflow:** Support lead bookers purchasing multiple seats while ensuring every individual adult diver receives a secure, direct magic-link to complete their own legal liability waiver, biometric sizing, and medical questionnaire independently.
7. **Scuba Decompression & Flying Safety (No-Fly Window):** Enforce strict post-dive surface interval validation against outbound flight schedules (minimum 12 hours for single no-deco dive, 18–24 hours for repetitive/multi-day dives) to eliminate Decompression Sickness (DCS) risk.
8. **Staff-to-Diver Ratio Monitoring (Safety & Agency Standards):** Enforce and monitor legal instructor/guide-to-diver ratios on the trip operations dashboard (e.g., DSD/Try Dive 4:1 / 2:1 in open water, Junior divers 2:1, Training Courses 8:1, Certified Fun Dives 6:1 or 8:1 per Divemaster).
9. **Inactive Diver Currency & Mandatory Refresher Policy:** Detect inactive divers based on `date_of_last_dive` and configurable thresholds (>180 or >365 days), automatically prompting or requiring a "Scuba Refresher / ReActivate" session before deep boat trips.
10. **Mandatory Personal Dive Computer & Safety Gear Policy:** Enforce modern maritime safety rules requiring each diver to carry an individual dive computer (no buddy sharing), with explicit rental add-ons for computers, SMB/spools, and torches.
11. **Dive Insurance Verification & Short-Term Coverage:** Record policy numbers and expiration dates for dive insurance (DAN, DiveAssure) where legally mandated (e.g., Spain, Egypt, Maldives), with an option to purchase 1-Day/1-Week short-term dive insurance add-ons.
12. **Nitrox Gas Verification & Cylinder Sign-Off:** Enforce Enriched Air Nitrox certification verification and provide a dedicated digital/printable Nitrox Analyzer Log sheet (Cylinder Serial #, measured $O_2\%$, MOD at 1.4 bar $PPO_2$, diver signature) before departure.
13. **Local Agency Questionnaires & Minor/Guardian Waivers:** Store and manage declarative questionnaire schemas and Jinja2 legal waivers locally for **PADI**, **SSI**, **GUE**, and **Universal DMSC 2020**, with automatic minor detection (age < 18) triggering mandatory legal guardian co-signatures and junior depth limits (12m for ages 10–11).
14. **GDPR Article 9 Medical Security & Retention:** Treat medical questionnaires as Special Category Health Data, implementing **Envelope Encryption (DEK/MEK)**, zero-downtime key rotation via `MultiFernet`, strict role-based center verification workflows, and statutory retention purging policies.
15. **Offshore Offline Boat Mode & PWA Synchronization:** Enable boat captains and divemasters to access passenger rosters, roll-call check-ins, emergency contacts, and medical badges on tablets/phones while offshore with zero cellular connectivity, automatically syncing when returning to port.
16. **Post-Dive Automatic Logbook Sync (Divemap Synergy):** Once a trip is marked `COMPLETED` on the center manifest, automatically generate draft `Dive` log entries in verified divers' Divemap accounts with pre-filled site, depth, duration, gas, and guide sign-off.

---

## 2. Architecture & System Overview

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │                    DIVEMAP FRONTEND                    │
                                    │   (Site/Center Explorer -> Trip Schedule -> Booking)   │
                                    └───────────────────────────┬────────────────────────────┘
                                                                │
                                                                ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │                    DIVEMAP BACKEND                     │
                                    │              (FastAPI + SQLAlchemy + MySQL)            │
                                    └─────────────┬────────────────────────────┬─────────────┘
                                                  │                            │
                                                  ▼                            ▼
                      ┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
                      │          OCTO Supplier Layer         │     │       Center Booking Ops Layer       │
                      │  (Standard /api/v1/octo endpoints,   │     │ (Daily Manifest, Buddy Pairing,      │
                      │   Webhooks, Capabilities & Schemas)  │     │  Nitrox Log, Weather Site Diversion) │
                      └───────────────────┬──────────────────┘     └──────────────────┬───────────────────┘
                                          │                                           │
                                          ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                 SHARED CORE SERVICES                                                   │
├─────────────────────────────────────────┬──────────────────────────────────────┬───────────────────────────────────────┤
│        Diver Paperwork Engine           │       Envelope Encryption            │        Pre-Dive Briefing Engine       │
│  • DMSC 2020 Medical Screening          │  • AES-256-GCM / Fernet              │  • Dive Site Topography & Hazards     │
│  • PADI / SSI / GUE / CMAS Waivers      │  • MultiFernet Zero-Downtime Key Rot │  • Open-Meteo Marine Forecast         │
│  • Youth & Guardian Co-Signatures       │  • Statutory Purging Lifecycle       │  • Emergency Action Plan (EAP/Chamber)│
│  • Guest Claim Token Magic-Links        │  • Private R2 / S3 Document Vault    │  • AWS EventBridge + SQS + Lambda     │
├─────────────────────────────────────────┼──────────────────────────────────────┼───────────────────────────────────────┤
│     Physical Inventory Allocator        │       Offshore Offline PWA Sync      │       Post-Dive Logbook Bridge        │
│  • BCD / Wetsuit / Fin Stock Buckets    │  • IndexedDB Manifest Cache          │  • One-click trip to draft `Dive` logs│
│  • 15L / Nitrox Cylinder Pools          │  • Offline Roll-Call & Nitrox Signoff│  • Pre-filled max depth, time, temp   │
│  • Rental Dive Computer & Torch Pools   │  • Auto-Reconciliation on dock Wi-Fi │  • Verified Divemaster signature stamp│
└─────────────────────────────────────────┴──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Data Models & Database Schema

All database models reside in `backend/app/models.py` and are managed via Alembic sequential migrations.

### 3.1 Center Settings, Equipment Inventory & Trip Catalog

#### `DivingCenterBookingSettings`
* `id` (Integer, Primary Key)
* `diving_center_id` (Integer, ForeignKey("diving_centers.id"), unique, index)
* `is_booking_enabled` (Boolean, default=True)
* `default_currency` (String(3), default="EUR") # Base currency for center products & payments (EUR, USD, EGP, GBP, THB)
* `payment_mode` (String(30), default="PAY_ON_ARRIVAL") # PAY_ON_ARRIVAL, CARD_GUARANTEE_ONLY, DEPOSIT_ONLY, FULL_ONLINE
* `deposit_percentage` (DECIMAL(5, 2), default=0.00)
* `timezone` (String(50), default="UTC") # e.g. "Europe/Athens", "Asia/Bangkok"
* `default_agency_bundle` (String(50), default="UNIVERSAL_DMSC") # PADI, SSI, GUE, UNIVERSAL_DMSC
* `preferred_unit_system` (String(10), default="METRIC") # Center manager display preference: METRIC vs IMPERIAL
* `preferred_shoe_system` (String(10), default="EU") # Center manager display preference: EU, US, UK
* `hold_duration_minutes` (Integer, default=20)
* `min_surface_interval_hours` (Integer, default=18) # Default pre-flight buffer enforced at checkout
* `refresher_threshold_days` (Integer, default=365) # Days since last dive requiring refresher/tune-up
* `refresher_enforcement_mode` (String(20), default="WARN") # WARN, MANDATORY_BLOCK, MANDATORY_UPSELL
* `require_nitrox_cert_check` (Boolean, default=True) # Require verified Nitrox cert for enriched air
* `require_dive_insurance` (Boolean, default=False) # Legally mandatory in Spain, Egypt, Maldives
* `require_personal_dive_computer` (Boolean, default=True) # Mandates 1 computer per diver
* `max_guide_ratio_fun_dive` (Integer, default=6) # Max divers per dive guide (typically 6 or 8)
* `max_guide_ratio_dsd` (Integer, default=4) # Max students per instructor for Try Dives (2 in open water)
* `briefing_lead_hours` (Integer, default=24) # Hours before departure to draft briefing
* `reconfirmation_lead_hours` (Integer, default=24) # Hours before departure to send reconfirmation SMS/email
* `cancellation_policy_tiers` (sa.JSON, nullable=True) # e.g. [{"hours_before": 48, "refund_pct": 100}, {"hours_before": 24, "refund_pct": 50}, {"hours_before": 0, "refund_pct": 0}]
* `default_eap_hyperbaric_chamber` (String(255), nullable=True) # Name & 24/7 hotline of nearest chamber
* `default_eap_coast_guard_channel` (String(50), default="VHF 16")
* `created_at`, `updated_at` (DateTime(timezone=True))

#### `DivingCenterVessel` (Boat & Fleet Management for Port Authority Compliance)
* `id` (Integer, Primary Key)
* `diving_center_id` (Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
* `name` (String(100), nullable=False) # e.g. "Aegean Explorer", "Poseidon RIB"
* `registration_number` (String(100), nullable=False) # Port registry number, IMO, or national maritime hull ID
* `call_sign` (String(50), nullable=True) # Marine VHF call sign
* `home_port` (String(100), nullable=True) # Official home port / berth
* `licensed_capacity` (Integer, nullable=False) # Maximum certified souls on board (passengers + crew)
* `is_active` (Boolean, default=True)
* `created_at`, `updated_at` (DateTime(timezone=True))

#### `CenterEquipmentInventory` (Rental Stock Capacity Protection)
* `id` (Integer, Primary Key)
* `diving_center_id` (Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
* `item_type` (String(30), nullable=False) # BCD, WETSUIT, FINS, REGULATOR, TANK_15L, TANK_AL80, DIVE_COMPUTER, TORCH, SMB
* `size_or_variant` (String(20), nullable=False) # XS, S, M, ML, L, XL, XXL, or "5mm_M", "DIN", "15L", "GENERIC"
* `total_quantity` (Integer, nullable=False, default=0) # Total owned physical stock
* `maintenance_quantity` (Integer, default=0) # Out for servicing/inspection
* `created_at`, `updated_at` (DateTime(timezone=True))
* UniqueConstraint("diving_center_id", "item_type", "size_or_variant")

#### `OctoProduct`
* `id` (String(36), Primary Key) # Standard UUID
* `diving_center_id` (Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
* `dive_site_id` (Integer, ForeignKey("dive_sites.id", ondelete="SET NULL"), nullable=True, index=True) # Primary dive site
* `alternate_dive_site_ids` (sa.JSON, nullable=True) # List of contingency site IDs if primary site is weathered out
* `title` (String(255), nullable=False)
* `description` (Text, nullable=True)
* `product_type` (String(50), default="GUIDED_BOAT_TRIP") # GUIDED_BOAT_TRIP, GUIDED_SHORE_TRIP, COURSE, TRY_DIVE_DSD, MULTI_DAY_PACKAGE, SNORKEL_PASSENGER
* `is_package` (Boolean, default=False) # Flag for octo/packages support
* `package_sessions_count` (Integer, default=1) # e.g. 6 dives for a 6-dive package, 3 days for Open Water
* `agency_code` (String(50), nullable=True) # PADI, SSI, GUE, CMAS (overrides center default)
* `waiver_bundle_id` (String(50), nullable=False, default="dmsc_recreational")
* `min_certification_level_id` (Integer, ForeignKey("certification_levels.id"), nullable=True)
* `min_logged_dives` (Integer, default=0)
* `min_age` (Integer, default=10) # Minimum legal age to participate
* `junior_max_depth_meters` (DECIMAL(5, 2), default=12.0) # Depth cap for ages 10-11
* `min_participants` (Integer, default=1) # Minimum booking party quota required to run departure
* `max_depth_meters` (DECIMAL(5, 2), nullable=True)
* `pickup_available` (Boolean, default=False) # octo/pickups capability flag
* `pickup_required` (Boolean, default=False)
* `additional_mandatory_fees` (sa.JSON, nullable=True) # e.g. [{"name": "Marine Park Entrance Fee", "amount": 10.0, "currency": "EUR", "payment_method": "CASH_ON_ARRIVAL"}]
* `is_active` (Boolean, default=True)
* `created_at`, `updated_at` (DateTime(timezone=True))

#### `OctoPickupPoint` (Hotel Shuttle Logistics - `octo/pickups`)
* `id` (String(36), Primary Key)
* `diving_center_id` (Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
* `name` (String(255), nullable=False) # e.g. "Main Pier Meeting Spot", "Hilton Resort Lobby", "Town Hall Bus Stop"
* `address` (String(500), nullable=True)
* `latitude` (DECIMAL(9, 6), nullable=True)
* `longitude` (DECIMAL(9, 6), nullable=True)
* `directions` (Text, nullable=True) # "Wait outside reception near the diving shuttle banner"
* `minutes_prior` (Integer, default=30) # Minutes before departure to meet
* `is_active` (Boolean, default=True)

#### `OctoPackage` & `OctoPackageItem` (`octo/packages` Capability)
Used for multi-day dive packages (e.g. 5-Day / 10-Dive Pass) and multi-session certification courses (e.g. PADI Open Water Diver).
* `OctoPackageItem`:
  * `id` (String(36), Primary Key)
  * `package_product_id` (String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
  * `sub_product_id` (String(36), ForeignKey("octo_products.id"), nullable=False) # Concrete session/trip
  * `sub_option_id` (String(36), ForeignKey("octo_options.id"), nullable=True)
  * `session_sequence` (Integer, default=1) # 1 = Pool, 2 = Open Water Dives 1-2, 3 = Open Water Dives 3-4
  * `session_title` (String(255), nullable=False) # "Confined Pool Session", "Boat Dives 1 & 2"
  * `quantity` (Integer, default=1)

#### `OctoOption`
* `id` (String(36), Primary Key)
* `product_id` (String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
* `title` (String(255), nullable=False) # e.g. "Morning 2-Tank Departure", "Afternoon 1-Tank Shallow"
* `meeting_time` (Time, nullable=False) # e.g. 08:30:00
* `departure_time` (Time, nullable=False) # e.g. 09:00:00
* `duration_minutes` (Integer, default=240)
* `max_capacity` (Integer, default=12) # Vessel/seat cap

#### `OctoUnit`
* `id` (String(36), Primary Key)
* `product_id` (String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
* `unit_type` (String(50), nullable=False) # DIVER_OWN_GEAR, DIVER_RENTAL_GEAR, STUDENT, PASSENGER_SNORKELER
* `title` (String(255), nullable=False) # "Certified Diver (Own Equipment)", "Non-Diving Boat Passenger"
* `retail_price` (DECIMAL(10, 2), nullable=False)
* `net_price` (DECIMAL(10, 2), nullable=True) # B2B OTA wholesale rate (octo/pricing)
* `currency` (String(3), default="EUR")
* `tax_percentage` (DECIMAL(5, 2), default=0.00)

#### `OctoProductExtra`
* `id` (String(36), Primary Key)
* `product_id` (String(36), ForeignKey("octo_products.id", ondelete="CASCADE"), nullable=False, index=True)
* `title` (String(255), nullable=False) # e.g. "15L Cylinder Upgrade", "Nitrox Fills (2 tanks)", "Rental Dive Computer", "1-Day Dive Insurance (DAN)"
* `extra_type` (String(50), nullable=False) # TANK_UPGRADE, NITROX_FILL, DIVE_COMPUTER_RENTAL, TORCH_RENTAL, SMB_RENTAL, DIVE_INSURANCE, PRIVATE_GUIDE, PHOTO_PACKAGE
* `inventory_item_type` (String(30), nullable=True) # Maps to CenterEquipmentInventory for stock deduction
* `price` (DECIMAL(10, 2), nullable=False)
* `currency` (String(3), default="EUR")
* `is_mandatory` (Boolean, default=False)
* `is_active` (Boolean, default=True)

#### `OctoAvailabilitySlot`
* `id` (String(36), Primary Key)
* `product_id` (String(36), ForeignKey("octo_products.id"), nullable=False, index=True)
* `option_id` (String(36), ForeignKey("octo_options.id"), nullable=False, index=True)
* `vessel_id` (Integer, ForeignKey("diving_center_vessels.id", ondelete="SET NULL"), nullable=True, index=True) # Assigned boat
* `start_datetime` (DateTime(timezone=True), nullable=False, index=True)
* `end_datetime` (DateTime(timezone=True), nullable=False)
* `seats_total` (Integer, nullable=False)
* `seats_available` (Integer, nullable=False) # Dynamic count with DB row-locking concurrency
* `min_participants` (Integer, default=1) # Minimum quota threshold for confirmed trip
* `is_closed` (Boolean, default=False)
* `is_weather_cancelled` (Boolean, default=False) # Marked True if weathered out
* `diverted_dive_site_id` (Integer, ForeignKey("dive_sites.id"), nullable=True) # Alternate site if primary is diverted
* `lead_guide_user_id` (Integer, ForeignKey("users.id"), nullable=True)
* `assigned_guide_user_ids` (sa.JSON, nullable=True) # List of staff/guide user IDs on duty to satisfy legal ratios
* `boat_captain_name` (String(100), nullable=True)

#### Hold Expiry & Automatic Capacity Reclamation (Anti-Phantom Lockout Engine)
When a booking is held (`POST /bookings` -> `status="ON_HOLD"`), `seats_available` on `OctoAvailabilitySlot` is decremented inside a `SELECT ... FOR UPDATE` row lock. To prevent abandoned holds from permanently depleting seat capacity:
1. **Lazy Reclamation on Query:** Every availability query (`POST /availability`, `POST /availability/calendar`) and hold attempt executes a rapid reclamation check for expired holds (`status = 'ON_HOLD' AND utc_hold_expiration < NOW()`):
   * Restores `seats_available = seats_available + expired_held_seats` on the affected slot.
   * Transitions those bookings to `status = 'EXPIRED'`.
2. **Periodic Worker Sweep:** An hourly/5-min SQS task sweeps stale holds across all active slots.

#### Rental Equipment Allocation & Concurrency Logic
Real-time rental equipment stock availability is computed dynamically against `CenterEquipmentInventory`:
* $\text{Allocated Stock} = \text{COUNT}(\text{units with item size in active } \texttt{ON\_HOLD} \text{ or } \texttt{CONFIRMED} \text{ bookings for overlapping slot window})$.
* $\text{Available Units} = \text{total\_quantity} - \text{maintenance\_quantity} - \text{Allocated Stock}$.
* If $\text{Available Units} < \text{requested}$, checkout triggers an equipment quota error preventing dockside shortages.

---

### 3.2 Diver Biometrics & Booking Records

#### `UserGearProfile` (Named Multi-Configuration Equipment Profiles)
Divers can maintain multiple named gear configurations (e.g., "Default", "Tropical Travel 3mm", "Cold Water 7mm", "Technical Twins") with one designated as primary (`is_default`). During checkout, the diver can switch configurations with a single click, instantly updating all rental sizing, cylinder choices, and lead weights for that trip.

* `id` (Integer, Primary Key)
* `user_id` (Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
* `name` (String(100), nullable=False, default="Default") # Configuration name
* `is_default` (Boolean, default=False, nullable=False) # Flags the primary/default configuration
* UniqueConstraint: `("user_id", "name")`
* `date_of_birth` (Date, nullable=True)
* `preferred_unit_system` (String(10), default="METRIC") # METRIC (cm, kg, m, bar, °C) vs IMPERIAL (ft/in, lbs, ft, psi, °F)
* `preferred_shoe_system` (String(10), default="EU") # EU, US_MEN, US_WOMEN, UK
* `height_cm` (Integer, nullable=True) # Stored canonically in cm
* `weight_kg` (Integer, nullable=True) # Stored canonically in kg
* `shoe_size_eu` (DECIMAL(3, 1), nullable=True) # Stored canonically in EU
* `wetsuit_gender` (String(10), nullable=True) # MEN, WOMEN, UNISEX
* `wetsuit_size` (String(10), nullable=True) # XS, S, M, ML, L, XL, XXL
* `wetsuit_thickness` (String(10), default="5mm") # 3mm, 5mm, 7mm
* `bcd_size` (String(10), nullable=True) # XS, S, M, L, XL
* `fin_type` (String(20), default="OPEN_HEEL") # FULL_FOOT, OPEN_HEEL
* `regulator_fitting` (String(10), default="DIN") # DIN, YOKE
* `preferred_tank_id` (String(20), default="12") # Re-uses canonical tank ID from TANK_SIZES ('12', '15', 'al80', etc.)
* `preferred_gas_mix_id` (String(20), default="air") # Re-uses canonical gas mix ID from GAS_MIXES ('air', 'ean32', etc.)
* `estimated_lead_kg` (DECIMAL(4, 1), nullable=True) # Stored canonically in kg
* `has_own_dive_computer` (Boolean, default=False)
* `has_own_smb` (Boolean, default=False)
* `insurance_provider` (String(100), nullable=True) # e.g. DAN Europe, DiveAssure
* `insurance_policy_number` (String(100), nullable=True)
* `insurance_expiry_date` (Date, nullable=True) # Validated if center requires active insurance
* `emergency_contact_name` (String(255), nullable=True)
* `emergency_contact_phone` (String(50), nullable=True)
* `emergency_contact_relation` (String(100), nullable=True)

#### `OctoBooking`
* `uuid` (String(36), Primary Key) # OCTO UUID
* `diving_center_id` (Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
* `product_id` (String(36), ForeignKey("octo_products.id"), nullable=False)
* `option_id` (String(36), ForeignKey("octo_options.id"), nullable=False)
* `availability_id` (String(36), ForeignKey("octo_availability_slots.id"), nullable=True) # Nullable if open-dated package
* `package_id` (String(36), ForeignKey("octo_products.id"), nullable=True) # Linked package if redeeming package
* `user_id` (Integer, ForeignKey("users.id"), nullable=True, index=True) # Lead booker (nullable for guest/OTA bookings)
* `contact_full_name` (String(255), nullable=True) # Lead traveler/booker name from OTA or guest checkout
* `contact_email` (String(255), nullable=True)
* `contact_phone` (String(50), nullable=True)
* `booking_notes` (Text, nullable=True)
* `status` (String(30), nullable=False, default="ON_HOLD") # ON_HOLD, CONFIRMED, CANCELLED, EXPIRED, REDEEMED
* `utc_hold_expiration` (DateTime(timezone=True), nullable=True)
* `payment_mode` (String(30), default="PAY_ON_ARRIVAL") # PAY_ON_ARRIVAL, CARD_GUARANTEE, ONLINE_PAID
* `payment_status` (String(30), default="PENDING_AT_CHECKIN") # PENDING_AT_CHECKIN, CARD_PREAUTHORIZED, PAID_IN_FULL, REFUNDED
* `card_guarantee_token` (String(255), nullable=True) # Stripe SetupIntent / Customer token to prevent no-shows
* `security_deposit_hold_token` (String(255), nullable=True) # Equipment damage deposit hold
* `reconfirmation_status` (String(30), default="PENDING") # PENDING, RECONFIRMED_BY_DIVER, NO_RESPONSE
* `pickup_point_id` (String(36), ForeignKey("octo_pickup_points.id"), nullable=True)
* `pickup_hotel_name` (String(255), nullable=True)
* `pickup_notes` (Text, nullable=True)
* `total_amount` (DECIMAL(10, 2), nullable=False) # Retail charged
* `net_amount` (DECIMAL(10, 2), nullable=True) # Wholesale net to center after OTA commission
* `currency` (String(3), default="EUR")
* `cancellation_reason` (Text, nullable=True)
* `created_at`, `updated_at` (DateTime(timezone=True))

#### `BookingPackageSchedule` (Multi-Day Package Session Allocations)
* `id` (String(36), Primary Key)
* `booking_uuid` (String(36), ForeignKey("octo_bookings.uuid", ondelete="CASCADE"), nullable=False, index=True)
* `package_item_id` (String(36), ForeignKey("octo_package_items.id"), nullable=False)
* `availability_id` (String(36), ForeignKey("octo_availability_slots.id"), nullable=False, index=True)
* `session_number` (Integer, nullable=False) # e.g. Session 1 of 5
* `session_status` (String(30), default="SCHEDULED") # SCHEDULED, COMPLETED, NO_SHOW, WEATHER_RESCHEDULED

#### `OctoBookingExtraItem`
* `id` (String(36), Primary Key)
* `booking_uuid` (String(36), ForeignKey("octo_bookings.uuid", ondelete="CASCADE"), nullable=False, index=True)
* `extra_id` (String(36), ForeignKey("octo_product_extras.id"), nullable=False)
* `quantity` (Integer, default=1)
* `unit_price` (DECIMAL(10, 2), nullable=False)
* `total_price` (DECIMAL(10, 2), nullable=False)

#### `OctoBookingUnitItem`
* `id` (String(36), Primary Key)
* `booking_uuid` (String(36), ForeignKey("octo_bookings.uuid", ondelete="CASCADE"), nullable=False, index=True)
* `unit_id` (String(36), ForeignKey("octo_units.id"), nullable=False)
* `user_id` (Integer, ForeignKey("users.id"), nullable=True) # Linked Divemap profile (if claimed)
* `claim_token` (String(64), unique=True, index=True, nullable=True) # Magic link token for guest completion
* `claim_status` (String(30), default="CLAIMED") # INVITED, CLAIMED
* `diver_full_name` (String(255), nullable=False)
* `diver_email` (String(255), nullable=True)
* `diver_phone` (String(50), nullable=True)
* `date_of_birth` (Date, nullable=False) # Mandatory for age gating and youth releases
* `diver_nationality` (String(100), nullable=True)
* `passport_number` (String(100), nullable=True)
* `is_minor` (Boolean, default=False) # True if age < 18 on dive date
* `is_junior` (Boolean, default=False) # True if age 10-11 (strict 12m depth restriction)
* `guardian_full_name` (String(255), nullable=True)
* `guardian_relationship` (String(50), nullable=True)
* `guardian_signed_at` (DateTime(timezone=True), nullable=True)
* `outbound_flight_datetime` (DateTime(timezone=True), nullable=True) # For DCS no-fly validation
* `certification_agency` (String(50), nullable=True)
* `certification_level` (String(100), nullable=True)
* `certification_number` (String(100), nullable=True)
* `total_logged_dives` (Integer, default=0)
* `date_of_last_dive` (Date, nullable=True)
* `requires_refresher` (Boolean, default=False) # Evaluated at intake if date_of_last_dive exceeds threshold
* `refresher_completed_at` (Date, nullable=True)
* `insurance_verified` (Boolean, default=False)
* `has_personal_dive_computer` (Boolean, default=True)
* `equipment_sizing` (sa.JSON, nullable=True) # Wetsuit, BCD, Fins, Regulator, Tanks
* `selected_tank_id` (String(20), default="12")
* `selected_gas_mix_id` (String(20), default="air")
* `nitrox_certified` (Boolean, default=False)
* `nitrox_analyzed_o2_percent` (DECIMAL(4, 1), nullable=True) # Filled upon tank analysis sign-off
* `nitrox_mod_meters` (DECIMAL(5, 2), nullable=True) # Maximum Operating Depth calculated
* `nitrox_signed_at` (DateTime(timezone=True), nullable=True)
* `buddy_unit_item_id` (String(36), nullable=True) # Paired dive buddy
* `assigned_guide_name` (String(100), nullable=True) # Lead Divemaster or Instructor
* `onboard_checkin_status` (Boolean, default=False) # Boat roll-call boarding toggle
* `waiver_id` (String(100), nullable=True)
* `waivers_complete` (Boolean, default=False)
* `signed_waiver_path` (String(500), nullable=True) # Private R2 path
* `signed_at` (DateTime(timezone=True), nullable=True)

#### `DiverMedicalRecord` (Envelope-Encrypted)
* `id` (Integer, Primary Key)
* `booking_unit_item_id` (String(36), ForeignKey("octo_booking_unit_items.id"), unique=True, nullable=False)
* `user_id` (Integer, ForeignKey("users.id"), nullable=True) # Nullable for guest bookers
* `status` (String(30), default="PENDING") # CLEARED, FLAGGED_CONTACT_CENTER, PHYSICIAN_APPROVED
* `verification_status` (String(30), default="NOT_REQUIRED") # NOT_REQUIRED, PENDING_CENTER_REVIEW, APPROVED, REJECTED
* `verified_by_user_id` (Integer, ForeignKey("users.id"), nullable=True) # Staff member who checked doctor note
* `verified_at` (DateTime(timezone=True), nullable=True)
* `medical_exam_date` (Date, nullable=True) # Date of physician check (valid for 12 months)
* `reusable_consent` (Boolean, default=False) # Explicit GDPR consent to reuse clearance for 12 months
* `encrypted_dek` (Text, nullable=False) # Envelope-encrypted symmetric key
* `encrypted_answers` (LargeBinary, nullable=False) # AES-256-GCM ciphertext
* `physician_clearance_file_path` (String(500), nullable=True) # Uploaded doctor PDF
* `expires_at` (DateTime(timezone=True), nullable=False) # 12 months from exam or questionnaire
* `audit_signature_hash` (String(64), nullable=False) # SHA-256 of submission envelope

---

### 3.3 Pre-Dive Briefing & Emergency Action Plan (EAP) Records

#### `TripBriefing`
* `id` (Integer, Primary Key)
* `availability_id` (String(36), ForeignKey("octo_availability_slots.id"), unique=True, nullable=False)
* `status` (String(30), default="DRAFT_PENDING_REVIEW") # DRAFT_PENDING_REVIEW, APPROVED_DISPATCHED
* `active_dive_site_id` (Integer, ForeignKey("dive_sites.id"), nullable=False) # May differ from product if diverted
* `meeting_notes` (Text, nullable=True)
* `site_profile_notes` (Text, nullable=True)
* `hazards_and_safety_notes` (Text, nullable=True)
* `marine_life_highlights` (sa.JSON, nullable=True) # Species IDs and tags
* `weather_forecast_data` (sa.JSON, nullable=True) # Wind, waves, temps from Open-Meteo
* `crew_manifest` (sa.JSON, nullable=True) # [{"role": "SKIPPER", "name": "Captain Nikos", "license": "GR-89123"}, {"role": "LEAD_INSTRUCTOR", "name": "Elena P.", "license": "PADI-MI-394812"}]
* `emergency_action_plan` (sa.JSON, nullable=True) # {"hyperbaric_chamber": "Athens Naval Hospital (+30 210 ...)", "coast_guard_vhf": "VHF 16", "mrcc_phone": "+30 210 ...", "onboard_oxygen_verified": True}
* `contingency_notes` (Text, nullable=True) # Weather diversion rationale if moved to alternate site
* `compiled_pdf_path` (String(500), nullable=True)
* `dispatched_at` (DateTime(timezone=True), nullable=True)
* `dispatched_by_user_id` (Integer, ForeignKey("users.id"), nullable=True)

---

### 3.4 Webhook Subscriptions (`OctoWebhookSubscription`)

To fully satisfy external travel aggregators (Viator, GetYourGuide, Bokun) under `octo/webhooks`:
* `id` (String(36), Primary Key)
* `diving_center_id` (Integer, ForeignKey("diving_centers.id"), nullable=False, index=True)
* `url` (String(500), nullable=False)
* `event_types` (sa.JSON, nullable=False) # ["BOOKING_UPDATE", "AVAILABILITY_UPDATE", "PRODUCT_UPDATE"]
* `secret_key` (String(100), nullable=False) # Used for HMAC SHA-256 payload signing
* `is_active` (Boolean, default=True)
* `created_at`, `updated_at` (DateTime(timezone=True))

---

### 3.5 Cylinder & Gas Mapping Architecture (Reusing `TANK_SIZES` & `GAS_MIXES`)

To maintain complete consistency across dive profiles, analytics, and booking equipment manifests, Divemap **re-uses the existing cylinder and gas definitions**:

* **Source of Truth in Frontend:** `frontend/src/utils/diveConstants.js` (`TANK_SIZES` and `GAS_MIXES`).
* **Source of Truth in Backend:** A shared Python dictionary `backend/app/constants/cylinders.py` mirroring `TANK_SIZES` and `GAS_MIXES` with exact matching IDs:
  * **Cylinders:**
    * Single Tanks: `'3'` (3L Pony), `'al40'` (5.7L Alu), `'alu7'` (7L Alu), `'7'` (7L Steel), `'8.5'` (8.5L Steel), `'10'` (10L Steel), `'al80'` (11.1L Alu), `'12'` (12L Steel - *Default*), `'15'` (15L Steel), `'18'` (18L Steel).
    * Double Tanks: `'14'` (Double 7s), `'17'` (Double 8.5s), `'20_double'` (Double 10s), `'double_al80'` (Double AL80), `'24'` (Double 12s), `'30'` (Double 15s), `'36'` (Double 18s).
  * **Gas Mixes:** `'air'` (21% O2 - *Default*), `'ean28'`, `'ean32'`, `'ean36'`, `'nx50'`, `'oxy'`, `'tx2135'`, `'tx1845'`, `'tx1555'`.
* **Application in Booking & Manifests:**
  * During booking intake, the diver selects their preferred cylinder and gas mix from this standardized list (pre-filled from their `UserGearProfile`).
  * The center's Day-of-Dive packing manifest groups and aggregates tanks using these exact IDs (e.g. `8x 12 (12L Steel)`, `4x 15 (15L Steel)`, `2x al80 (AL80 Alu - EAN32)`).

---

### 3.6 Dual-Unit System & Metric/Imperial Conversion Architecture

To ensure divers from any country can enter and view data comfortably without friction, the intake wizard, user profiles, and operational documents support **bidirectional metric and imperial conversions**:

#### 1. Conversion Rules & Canonical Storage
* **Canonical DB Representation:** All biometric and equipment values are stored in canonical metric SI units in the database (`height_cm`, `weight_kg`, `shoe_size_eu`, `estimated_lead_kg`). This prevents fragmented data and allows instant aggregation across international participants.
* **Conversion Formulae:**
  * **Height:** $1	ext{ ft} = 30.48	ext{ cm}$, $1	ext{ in} = 2.54	ext{ cm}$. Frontend displays a dual input (`Feet` + `Inches`) or a single `cm` input based on the active toggle.
  * **Body Weight & Lead Ballast:** $1	ext{ kg} = 2.20462	ext{ lbs}$ ($1	ext{ lb} \approx 0.453592	ext{ kg}$).
  * **Shoe Sizing Matrix:** Standard cross-conversion between EU (35–48), US Men (3.5–14), US Women (5–15.5), and UK (3–13.5).
  * **Depth:** $1	ext{ meter} \approx 3.28084	ext{ feet}$.
  * **Tank Pressure:** $1	ext{ bar} = 14.5038	ext{ psi}$.
  * **Temperature:** $T_{^\circ	ext{F}} = (T_{^\circ	ext{C}} 	imes 9/5) + 32$.

#### 2. Interactive Frontend Toggle
* The booking intake form and Profile Gear Editor feature an immediate unit switcher:
  `[ Metric (cm / kg / EU) | Imperial (ft-in / lbs / US) ]`
* Toggling the switch instantly converts displayed values on the fly without loss of precision.

#### 3. Operational Documents & Briefing PDFs
* **Pre-Dive Briefing PDF:** Always displays dual units so every diver can easily read the dive profile regardless of their background:
  * e.g., *"Max Depth: 30m (98ft)"*, *"Water Temp: 22°C (72°F)"*, *"Wind: 12 knots (6 m/s)"*.
* **Day-of-Dive Boat Packing Manifest:**
  * Displays lead weights in both formats for crew convenience: e.g., *"John Doe: 6 kg (13 lbs)"*.

#### 4. Diving Center Operational Dashboard Preference (Dynamic Manager Presentation)
* The diving center manager sets their own operational preference in `DivingCenterBookingSettings` (`preferred_unit_system`: `METRIC` vs `IMPERIAL`, and `preferred_shoe_system`: `EU`, `US`, `UK`).
* When the manager views the **Boat Manifest**, **Diver Roster**, **Equipment Crates**, or **Diver Details modal**:
  * All measurements (body weight, height, lead ballast, shoe size) are automatically translated and rendered in the **center manager's preferred system**, regardless of what system the diver used when booking!
  * **Example A (Mediterranean Center - Metric):** An American diver books and enters $175	ext{ lbs}$, $5'\ 11"$, US Men shoe size 10.5, and $8	ext{ lbs}$ of lead. The center manager sees: **$79	ext{ kg}$**, **$180	ext{ cm}$**, **EU 44**, and **$4	ext{ kg}$ lead**. A subtle tooltip or subtitle displays the original diver input: `79 kg (orig: 175 lbs)`.
  * **Example B (Caribbean Center - Imperial):** A European diver books and enters $182	ext{ cm}$, $80	ext{ kg}$, EU 43, and $6	ext{ kg}$ lead. The manager sees: **$6'\ 0"$, $176	ext{ lbs}$, US Men 9.5, and $13	ext{ lbs}$ lead**.
* All boat-wide aggregations (e.g. Total Lead Ballast needed on board) sum in the center's preferred unit.

---

## 4. Sensitive Health Data, Security Controls & Retention (GDPR Article 9)

### 4.1 Envelope Encryption with Zero-Downtime MultiFernet Rotation
1. **Per-Record DEK Generation:**
   ```python
   dek = Fernet.generate_key()
   ```
2. **Master Key Wrapper:**
   The master key string in `.env` supports key version lists:
   ```bash
   BOOKING_MEDICAL_MASTER_KEYS="primary_key_v2,fallback_key_v1"
   ```
3. **Encryption Pipeline:**
   * Answers serialized to UTF-8 JSON.
   * Encrypted via Fernet(DEK).
   * DEK encrypted via `MultiFernet([Fernet(k) for k in master_keys])`.
   * Resulting `encrypted_dek` stored in DB.
4. **Key Rotation Command:**
   An administrative migration script re-encrypts stored DEKs to the latest primary key in seconds without decrypting or exposing medical payloads:
   ```python
   def rotate_medical_master_keys(db: Session, multi_fernet: MultiFernet):
       for record in db.query(DiverMedicalRecord).all():
           record.encrypted_dek = multi_fernet.rotate(record.encrypted_dek.encode()).decode()
       db.commit()
   ```

### 4.2 Medical Flagging Logic (DMSC 2020) & Zero-Knowledge Staff Clearance
* **Screening Evaluation:**
  * If Question 1–10 are all `NO` -> `status = "CLEARED"`.
  * If any Question is `YES` -> `status = "FLAGGED_CONTACT_CENTER"`.
* **Zero-Knowledge Clearance:**
  * Dive center staff only see status badges (`CLEARED`, `FLAGGED_CONTACT_CENTER`, `PHYSICIAN_APPROVED`).
  * The raw answers to individual medical questions are **never rendered to dive center staff** or stored in plaintext logs.

### 4.3 Center Staff Physician Verification Workflow
* When a flagged diver uploads an official doctor clearance PDF:
  1. The record is marked `verification_status = "PENDING_CENTER_REVIEW"`.
  2. Dive center managers (strictly authorized role) can view the uploaded physician certificate inside a secure, watermarked viewer.
  3. The manager verifies the doctor's license, stamp, and "Fit to Dive" sign-off, recording `verified_by_user_id` and timestamp.
  4. The status transitions to `PHYSICIAN_APPROVED`.

### 4.4 GDPR Retention, Anonymization & Purging Policy
* **Statutory Requirement:** Maritime and sports injury liability claims in the EU and US have limitation periods of 3–5 years, requiring centers to prove signed liability releases existed.
* **Separation of Legal vs. Medical Records:**
  * **Encrypted Medical Answers:** Purged **12 months** after the examination expiration date.
  * **Signed Legal Waivers & Audit Hashes:** Retained for **5 years** in private R2 object storage with immutable versioning, then permanently expunged.
  * If a user requests GDPR account deletion ("Right to be Forgotten"), non-medical user profile data is anonymized, while the historical legal waiver archive is locked in compliance with legal obligation exceptions (GDPR Art. 17(3)(b)).

### 4.5 Emergency Incident Dossier (PDF Export) for Port Authorities & Hyperbaric Doctors
* **Maritime & Clinical Emergency Protocol:** In the event of a dive accident, decompression illness, or coast guard investigation, center managers must immediately produce the complete emergency docket.
* **Endpoint:** `GET /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants/{participant_id}/emergency-dossier`
* **ReportLab Document Architecture:**
  1. **Official Jurisdiction & Emergency Header:** Port Authority, Coast Guard, and Attending Hyperbaric Physician notification.
  2. **Diver Identification & Emergency Contacts:** Legal full name, DOB, nationality, passport/ID, email, phone/WhatsApp, and next of kin.
  3. **Full Decrypted DMSC 2020 Medical Screening:** All 10 clinical questions with explicit status (`✓ NO (CLEAN)` vs `⚠️ YES (FLAGGED)`), decrypted on-the-fly under manager authorization.
  4. **Physician Approval & Staff Clearance Audit Log:** Examining doctor name, clinic/hospital, physical inspection confirmation, authorizing staff member username, clearance timestamp, and clinical restrictions/notes.
  5. **Executed Liability Waiver & Risk Release:** Signer name, timestamp, waiver bundle reference, and SHA-256 digital audit hash.
  6. **Equipment & Gas Configuration:** Assigned cylinder, breathing gas mix, valve fitting (DIN/Yoke), and lead ballast weight system (`INTEGRATED` vs `BELT`).
  7. **Official Declaration & Sign-off:** Signatures and official center stamp boxes for duty manager and coast guard investigators.

### 4.6 Scuba Safety Gate: Mandatory Medical Clearance Before Boarding
* **Strict Safety Rule:** Any diver with an unresolved medical questionnaire (`FLAGGED_CONTACT_CENTER`) **cannot be boarded onto the boat** under any circumstances without verified physician or staff clearance.
* **Enforcement:**
  * **Backend Gate (`center_booking_ops.py`):** `POST .../participants/{id}/toggle-checkin` rejects boarding attempts for flagged divers with HTTP 400 (`Safety Gate: Diver has an unresolved medical flag`).
  * **Frontend Gate (`BoatManifestTable.jsx`):** Boarding toggle transforms into a disabled `🚫 Medical Hold` alert button with tooltip and click alert routing staff to the physician clearance review modal.

---

## 5. Local Agency Questionnaires, Waivers & Safety Gate Engine

Templates are stored in the filesystem at `backend/app/templates/booking/`:

### 5.1 Questionnaire Schemas
* `dmsc_2020_medical.json`: Defines the 10 core questions, branching diagnostic boxes (A–G), and physician evaluation requirements.
* `gue_medical_screening.json`: Stricter screening including non-smoker declaration, prescription drug checks, and swim fitness acknowledgment.
* `equipment_sizing.json`: Sizing inputs:
  * Height, weight, shoe size (EU).
  * Thermal suit: Wetsuit size (XS–XXL, or `None (Own Suit)`), thickness (3mm, 5mm, 7mm).
  * Buoyancy & Cylinder: BCD size (XS–XL, or `None (Own BCD)`), preferred cylinder (10L, 12L, 15L, AL80), gas mix (Air, EAN32), regulator fitting (DIN, YOKE).
  * Ballast: Lead weight (kg) and **Weight System** (`INTEGRATED` BCD Pockets vs. `BELT` Traditional Nylon Webbing).
* `nitrox_agreement.json`: Verification of Nitrox certification, MOD understanding, and gas analysis acknowledgment.
* `no_fly_interval.json`: Captures `outbound_flight_datetime`, comparing with dive completion time:
  * Minimum 12 hours for single no-decompression dive.
  * Minimum 18 hours (recommended 24 hours) for multiple repetitive dives.
  * **Safety Gate:** If `flight_time - dive_end_time < min_surface_interval`, the system flags an unresolvable safety alert, requiring date modification or signed high-risk refusal.

### 5.2 Legal Waiver Jinja2 Templates
* **PADI:**
  * `waivers/padi/10086_certified_diver_release.html.j2` (Certified guided dives)
  * `waivers/padi/10175_eu_statement_of_risk.html.j2` (EU/EFTA Statement of Risk)
  * `waivers/padi/10072_training_release.html.j2` (Training courses)
  * `waivers/padi/10060_safe_diving_practices.html.j2` (Safe diving rules)
  * `waivers/padi/10271_youth_diving_responsibility.html.j2` (Mandatory co-signature for minors < 18)
* **SSI:**
  * `waivers/ssi/ssi_responsible_diver_code.html.j2`
  * `waivers/ssi/ssi_non_training_release.html.j2`
  * `waivers/ssi/ssi_youth_addendum.html.j2`
* **GUE:**
  * `waivers/gue/gue_liability_release.html.j2`
  * `waivers/gue/gue_insurance_verification.html.j2`
* **Universal:**
  * `waivers/universal/generic_dive_center_waiver.html.j2`
  * `waivers/universal/equipment_rental_liability.html.j2` (Terms for lost/damaged computers, regulators, or torches)

### 5.3 Multi-Party Guest Claim Workflow
When a lead booker books multiple slots:
1. Lead booker completes payment or card guarantee.
2. For Seats #2, #3, etc., Divemap generates a secure `claim_token` (e.g. cryptographically random 64-char string).
3. System triggers email / WhatsApp invitation links to each guest:
   `https://divemap.blue/bookings/{uuid}/claim?token={claim_token}`
4. Guests click the link:
   * Existing Divemap users log in and import their profile/certifications instantly.
   * New guest divers complete a quick mobile-optimized intake (Name, DOB, sizing, DMSC medical questionnaire, e-signature waiver).
5. The trip manifest marks guest completion in real time: `Paperwork: 3/4 Completed`.

### 5.4 Junior Diver Safety & Depth Restriction Rules (ISO 24801 / Agency Limits)
* **Ages 10–11 (Junior Open Water):**
  * System marks `is_junior = True`.
  * **Strict Depth Cap:** Automatically enforces `max_depth <= 12m (40ft)`. The trip booking blocks selection of deep dive sites (>12m) unless booked as a private guided shallow profile.
  * **Parent/Guardian Ratio:** Mandates a 1-on-1 or 2-on-1 buddy pairing with an adult certified diver or dedicated dive professional.
* **Ages 12–14 (Junior Advanced / Open Water):**
  * Maximum depth restricted to 18m (or 21m for Junior Advanced).
  * Mandatory legal guardian co-signature on agency youth releases (`waivers/padi/10271_youth_diving_responsibility.html.j2`).

### 5.5 Inactive Diver Refresher / Tune-up Gating
* **Evaluation:** At checkout, the booking engine compares `date_of_last_dive` against `refresher_threshold_days` (default: 365 days; configurable per center).
* **Modes:**
  * `WARN`: Displays a high-visibility badge on diver voucher and manifest: *"Last dived 18 months ago. Review recommended."*
  * `MANDATORY_UPSELL`: Automatically adds a *"Scuba Skills Refresher / ReActivate Session"* to the cart if booking open water boat trips.
  * `MANDATORY_BLOCK`: Disallows booking deep/advanced boat trips until a pool/shallow tune-up slot is scheduled.

### 5.6 Mandatory Personal Dive Computer & Safety Gear Policy
* Under ISO and maritime rules (e.g. Egypt CDWS, Mediterranean regulations), **each diver must carry an individual dive computer**. Buddy sharing is strictly prohibited.
* If a diver indicates in their `UserGearProfile` or intake that they do not own a dive computer, the booking flow automatically adds a *"Rental Dive Computer"* line item or flags a mandatory dockside rental agreement.
* Center inventory models automatically deduct rented dive computers from the center's computer pool.

### 5.7 Unified Diver Gear Configuration Architecture (`DiverGearConfigForm` & Dedicated Operations Page)
* **Single Authoritative Source of Truth (`DiverGearConfigForm.jsx`):**
  * Extracted reusable component shared across the platform to eliminate feature disparity between user gear profiles, booking checkouts, and center operations.
  * **Core Capabilities:**
    * **Dynamic Metric $\leftrightarrow$ Imperial Unit Conversion:** Automatic bidirectional synchronization of height (cm vs ft/in), weight (kg vs lbs), lead ballast (kg vs lbs), and shoe sizes (EU vs US).
    * **Integrated Buoyancy & Salinity Estimator:** Physics engine computing buoyant displacement from diver body weight, suit thickness factor (`SUIT_FACTORS`), water body density (Aegean/Med, Red Sea, Caribbean, Baltic, Freshwater), and cylinder buoyancy empty at 50 bar reserve.
    * **Cylinder & Breathing Gas Selection:** Canonical tank options (10L, 12L, 15L, AL80, 2x12L Twinset), Nitrox eligibility gating, and DIN (5/8" threaded) vs. Yoke (A-clamp) valve fitting toggles.
    * **Ballast & Weight System:** 0.5kg precision increments and selection between `INTEGRATED` (BCD weight pockets) vs `BELT` (traditional nylon webbing belt).
    * **Thermal Suit & Sizing:** Wetsuit cut (Men/Unisex vs Women), size (XS–XXL, or `None (Own Suit)`), thickness (3mm shorty, 3mm full, 5mm full, 7mm semi-dry, drysuit), BCD size (XS–XL, or `None (Own BCD)`), and Fin style (`OPEN_HEEL` with booties vs `FULL_FOOT` barefoot).
    * **Personal Safety Equipment:** Checkboxes tracking individual dive computer ownership and Surface Marker Buoy (SMB) + spool ownership.
    * **Emergency Contacts & Insurance:** Next of kin full name and phone/WhatsApp; dive insurance provider (DAN Europe, DiveAssure), policy #, and expiration date.
* **Dual View Center Operations Interface:**
  * **Quick Modal (`DiverDetailsModal.jsx`):** Employs `DiverGearConfigForm` for rapid, in-place dockside adjustments during roll-call without losing scroll position on the manifest table.
  * **Dedicated Operations Page (`TripParticipantDetailsPage.jsx`):** Full-screen two-column workspace at `/manage/centers/:centerId/trips/:tripId/participants/:participantId` featuring breadcrumbs back to the trip manifest, complete credentials, DMSC 2020 medical review with physician clearance approval, executed liability waiver with audit hash, emergency incident dossier export, and the full gear configuration editor.

### 5.8 5-Step Guided Booking Wizard Flow & Wide Container Architecture (`BookingWizard.jsx`)
* **Responsive Wide Container Standard:**
  * Aligned with Divemap's established UI standards (`max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-6`), eliminating cramped containers.
  * Desktop 12-column grid layout dividing the screen into an 8-column primary stepped form pane and a 4-column persistent sticky booking summary.
* **5-Step Progressive Guided Flow:**
  * **Step 1: Diver Credentials & Identification:**
    * Equipment Tier selection (`Certified Diver (Own Gear)` vs `Certified Diver (Full Equipment Rental)`).
    * Diver identity: Full Legal Name, Date of Birth (mandatory for maritime compliance), Nationality, Email, Phone, Passport/ID #.
    * Official Certification Credentials: Organization Agency (filtered to core progression tracks), Qualification Level, and C-Card #.
  * **Step 2: Equipment Needed for Rent & Sizing:**
    * Saved gear profile quick-loader.
    * Primary Cylinder (10L, 12L, 15L, AL80), Gas Mix (Air 21% vs EAN32 Nitrox with qualification validation), Regulator Valve fitting (DIN vs Yoke).
    * Ballast Lead (kg) & Weight System (`INTEGRATED` pockets vs `BELT` webbing).
    * Thermal Suit: Anatomical Cut (`Men's / Unisex` vs `Women's Cut`), Size (`XS`–`XXL`), Thickness (`3mm Shorty`, `3mm Full`, `5mm Full`, `7mm Semi-Dry`).
    * BCD: Anatomical Cut (`Men's / Unisex` vs `Women's Cut`), Size (`XXS`–`XL`).
    * Footwear: Fin Style (`OPEN_HEEL` with booties vs `FULL_FOOT` barefoot), Shoe / Fin Size (EU).
    * Auxiliary Rental Gear: **`Rent Primary Dive Torch / Light (Opt)`** checkbox.
  * **Step 3: Emergency Contact & Dive Insurance:**
    * Emergency Contact (Next of Kin): Full Legal Name, Phone / WhatsApp (with international prefix), Relationship.
    * Dive Accident & Hyperbaric Evacuation Insurance:
      * Option A: *"I have my own active dive insurance"* (Provider e.g. DAN Europe/DiveAssure, Policy #, Expiration Date).
      * Option B: *"I need daily insurance from the dive center"* (automatic daily hyperbaric evacuation coverage arranged on morning check-in).
  * **Step 4: Diver Medical Screening (DMSC 2020):**
    * Standardized 10-point WRSTC / UHMS / EUBS self-declaration protected with GDPR Article 9 envelope encryption.
    * Real-time clearance evaluation (`✓ CLEARED` vs `⚠️ FLAGGED FOR REVIEW`).
  * **Step 5: Liability Waiver, Risk Release & Final Review:**
    * Complete pre-flight reservation summary card.
    * Digital Express Assumption of Risk & Liability Release with typed electronic signature and audit hash.
    * Pay on arrival confirmation (zero charges online, pay at center counter).
* **Interactive Stepper Bar & Validation:**
  * Top progress bar with visual step numbers, labels, active highlights, and green completed checkmarks.
  * Strict validation gating step transitions (preventing progression without required name, D.O.B., certification credentials, or emergency contact).

---

## 6. Pre-Dive Briefing & Emergency Action Plan Pipeline (AWS SQS + EventBridge)

Zero new background daemon services are added. We utilize Divemap's existing AWS integration (`sqs_service.py`, `eventbridge_service.py`, `ses_service.py`).

### 6.1 Scheduled Draft Generation
1. **EventBridge Rule:** Executes hourly, sending an SQS task: `CHECK_UPCOMING_BRIEFINGS`.
2. **Draft Compiler (`BriefingService`):**
   * Identifies trips departing within 24–48 hours that lack a briefing.
   * Gathers dive site depth, access points, bottom structure, and tagged marine life from `dive_sites`.
   * Gathers marine weather forecast (wind speed, wind gusts, wave height, swell direction, water temp) via `OpenMeteoService`.
   * Pulls site-specific **Emergency Action Plan (EAP)**: nearest decompression chamber contact, VHF channel 16, maritime rescue coordination phone.
   * Creates a `TripBriefing` in `DRAFT_PENDING_REVIEW` status.
   * Sends an email notification to the center manager: *"Briefing draft ready for review for tomorrow's dive"*.

### 6.2 Manager Review & Dispatch
1. Center manager opens `/manage/centers/{id}/trips/{trip_id}/briefing`.
2. Manager reviews weather, assigns boat crew (Skipper and Lead Divemaster), edits notes or safety instructions.
3. Manager clicks **"Approve & Dispatch Briefing"**.
4. Divemap pushes task `DISPATCH_TRIP_BRIEFING` to AWS SQS.
5. SQS triggers Lambda / SES:
   * Compiles HTML into a PDF attachment stored in private R2.
   * Emails the briefing to all confirmed divers on the boat manifest.
   * Posts an in-app notification to divers' Divemap dashboards.

---

## 7. Dive Trip Operations Dashboard, Roster & Vessel Manifest

Each scheduled dive trip has a dedicated, rich operations dashboard at `/manage/centers/{center_id}/trips/{trip_id}`. This serves as the single pane of glass for dive center managers, boat captains, and divemasters before and on the day of the dive.

### 7.1 Trip Overview, Quotas & Weather Contingency
* **Header Information:** Trip title, active dive site (with link to Divemap site page), date, meeting time, boat name, skipper, and lead instructor/divemaster.
* **Minimum Quota Indicator:** Real-time gauge:
  * e.g., `3 / 4 Minimum Divers Required (Pending Quota)` vs `8 / 12 Seats Booked (Trip Confirmed)`.
* **Staff-to-Diver Ratio Gauge:** Real-time compliance check comparing booked certified divers, try-divers, and juniors against on-duty pros.
  * e.g., `6 Divers : 1 Pro (🟢 In Safe Ratio)` vs `10 Divers : 1 Pro (🔴 Exceeds 6:1 Ratio - Extra Guide Required!)`.
* **Live Marine Forecast Widget:** Mini weather card showing wave height, wind speed/direction, swell, and water temperature from Open-Meteo.
* **Contingency / Site Diversion Action Bar:**
  * **"Divert Trip to Alternative Site"**: Dropdown of pre-configured sheltered contingency dive sites. Diverting updates the trip in one click, recalculates weather, and pushes an SMS/Email notice to participants: *"Notice: Due to southerly swell, today's boat trip is diverted to North Bay Reef"*.
  * **"Weather Delay / Reschedule"**: Postpones departure by X hours or moves trip to the following morning.
  * **"Force Majeure Cancellation (Weathered Out)"**: One-click bulk cancellation that releases held deposits or issues full credit vouchers without penalties.
  * **"+ Add Diver"**: Button opening manual booking modal for walk-in, phone, or WhatsApp divers.
  * **"Pre-Dive Briefing"**: Status badge (`DRAFT READY` / `APPROVED & SENT`) with 1-click review and dispatch.
  * **"Port Authority Manifest"**: 1-click download of compliant maritime passenger & crew PDF/CSV.
  * **"Nitrox Log Sheet"**: 1-click printable analyzer log sheet for dockside cylinder sign-offs.

### 7.2 Participant Management, Buddy Teams & Safety Warnings
The central view is an interactive roster of all divers booked on the trip.

**Mobile-First Responsive Layout (Strictly No Horizontal Scrolling):**
In strict compliance with Divemap UX guidelines, horizontal scrolling (`overflow-x-auto`) is forbidden on mobile devices. The manifest renders responsively:
* **Desktop / Tablet (`hidden md:block`):** Full interactive multi-column data table with sorting, quick toggles, and popover menus.
* **Mobile Viewports (`block md:hidden`):** Touch-friendly vertical card-stack. Each participant is rendered as a clean, full-width card with wrapped badge clusters (`flex-wrap gap-1.5`), prominent single-touch boarding and payment checkmarks, and tap-to-expand equipment sizing and buddy details.

| Column | Information & Actions |
| :--- | :--- |
| **Diver & Contact** | Legal full name, DOB / Age badge, nationality, phone/WhatsApp, hotel/villa room #, pickup shuttle badge. |
| **Certification & Safety** | Agency badge (PADI, SSI, GUE), cert #, depth qualification check (🟢 In Limits / 🔴 Exceeds Depth). |
| **Dive Currency & Refresher** | Total dives count, days since last dive badge (🟢 < 180d, 🟡 180-365d, 🔴 > 365d alert / Refresher needed). |
| **No-Fly Alert** | Outbound flight time badge: 🟢 Safe (>24h) \| 🔴 **DCS Risk: Flight in 14h!** |
| **Gear Check** | Boolean verification badge: 🟢 **OK** (All equipment verified present at bench) \| 🟡 **Pending** (Awaiting equipment check). |
| **Medical Status** | 🟢 **Self-Cleared** (DMSC 10-No) \| 🔵 **Doctor Approved** (view certificate) \| 🔴 **Medical Hold** (Boarding Gate Blocked). |
| **Equipment & Tank** | Assigned tank (`12L Steel Air`, `15L EAN32`), valve adapter alerts, rental package status, personal computer check. |
| **Nitrox Sign-Off** | Status badge: 🟢 **Analyzed & Signed (32.1% / MOD 33m)** \| 🟡 **Pending dockside analysis**. |
| **Buddy & Guide** | Drag-and-drop selector: Buddy pair assignment (e.g. `Buddy: Jane Doe`) & assigned Divemaster (`Guide: Elena`). |
| **Payment Status** | Paid online, Card Guaranteed, or *"Due on Arrival: €80.00"* with 1-click **"Mark Paid"** toggle. |
| **Onboard Roll-Call** | Interactive checkmark toggle: **"Checked-In / On Board"** for boat boarding control. |
| **Actions** | Dropdown: **View Details** \| **Edit Participant** \| **Move to Another Trip** \| **Remove / Cancel**. |

### 7.3 Multi-View Operational Architecture (Manifest, Gear Inspection & Crate Loadout)
Dive operations are organized into three dedicated, URL-driven view tabs (`/manage/centers/:centerId/trips/:tripId/:tab`):

#### 1. Tab 1: Boat Manifest & Roll Call (`/manifest`)
* Official maritime and harbor master manifest view.
* Tracks legal identity, DOB, certifications, medical boarding safety gate, payment collection, and boat boarding roll-call.
* Displays the **Gear Check** boolean column (`✓ OK` vs `⚠️ Pending`).

#### 2. Tab 2: Individual Diver Gear Inspection & Handover Checklist (`/gear-check`)
* Dedicated view for equipment counter and dive bench staff conducting the pre-boarding equipment handover with each diver.
* Ensures no diver boards the boat without all essential equipment (mask, booties, weights, dive torch).
* **Per-Diver Inspection Cards:** Detailed top-to-bottom equipment breakdown:
  * Primary Cylinder & Valve (`12L Air DIN` vs `15L EAN32 Yoke insert required`) + Stage cylinders.
  * Regulators (Rental DIN/Yoke vs Diver's own regulator).
  * BCD (`Men's / Unisex` vs `Women's Cut`, Size, or Own BCD).
  * Lead Ballast: Exact kg, system (`Integrated Pockets` vs `Nylon Belt`), and block breakdown (`2x2kg + 1x1kg + 1x0.5kg`).
  * Thermal Suit: Cut (`Women's` vs `Men's`), thickness (`3mm Shorty`, `5mm Full`, `Drysuit`), Hood, Gloves, Socks.
  * Footwear & Fins: Style (`Open-Heel` vs `Full-Foot`), Booties EU size.
  * Kit Accessories: Rental/Own Mask, Snorkel, **Rental Dive Torch**, DPV Scooter, Dive Computer, SMB & Spool, and Emergency Contact.
* **1-Click Master Handover Toggle:**
  * Staff click **"Confirm All Gear Present" $\leftrightarrow$ "✓ All Gear Verified Present"** to certify the diver has their complete kit before boat transfer.
  * Backed by `POST /api/v1/centers/{center_id}/booking-ops/trips/{trip_id}/participants/{participant_id}/toggle-gear-check`.

#### 3. Tab 3: Dockside Crate Packing Loadout (`/crates`)
An aggregated logistical tab designed specifically for dive shop equipment technicians and boat crew packing the vessel:
* **Top-to-Bottom Scuba Equipment Breakdown (Must vs Opt):**
  * **Head & Face:** Dive Mask (Must), Snorkel (Opt), Neoprene Thermal Hood (Opt: S–XL).
  * **Breathing & Regulators:** Primary Cylinders (Must), Stage / Decompression Cylinders (Opt: 7L, AL80, EAN50, 100% O2), First & Second Stage Regulators (Must: DIN vs Yoke).
  * **Buoyancy & Ballast:** BCD (Must: Men's/Unisex vs Women's Cut, XXS–XL), Lead Ballast (Must: 2kg, 1kg, 0.5kg trim blocks), Weight System (Must: Integrated Pockets vs Traditional Webbing Belt).
  * **Thermal & Exposure:** Wetsuits / Semi-Dry / Drysuit (Must: Men's/Unisex vs Women's Anatomical Cut, 3mm/5mm/7mm, XS–XXL), Dive Gloves (Opt: S–XL), Neoprene Socks / Fin Liners (Opt).
  * **Footwear & Fins:** Fins (Must: Open-Heel with Booties vs Full-Foot Barefoot), Neoprene Booties (Must with open-heel fins: EU size).
  * **Specialty & Propulsion:** Rental Dive Torch (Opt), Diver Propulsion Vehicle / Scooter (Opt).
* **Configurable Crate / Bag Partitioning (1 to 5 Crates):**
  * Center managers can dynamically configure the number of transport crates (1 to 5) to match their boat deck layout:
    * **1 Crate (Master All-in-One):** All rental suits, BCDs, regulators, fins, and small accessories in a single container (for small RIBs or private charters).
    * **2 Crates:** Crate 1 (Suits & BCDs), Crate 2 (Regulators, Fins, Boots, Masks & Small Gear).
    * **3 Crates (Standard Center Ops):** Crate 1 (Suits & Hoods), Crate 2 (BCDs & Regulators), Crate 3 (Fins, Boots, Masks & Small Gear).
    * **4 Crates:** Crate 1 (Suits & Hoods), Crate 2 (BCDs), Crate 3 (Regulators & DPV Tech), Crate 4 (Fins, Boots, Masks & Snorkels).
    * **5 Crates (Dedicated Compartments):** Crate 1 (Suits), Crate 2 (BCDs), Crate 3 (Regulators), Crate 4 (Fins & Boots), Crate 5 (Masks, Snorkels, Hoods, Gloves, Torches & Tech).
  * *Note:* Cylinders and Lead Weight buckets are always staged separately outside the crates in boat racks and ballast bins.
* **Emergency Contact & Dive Insurance Compliance:**
  * Every diver manifest includes verified emergency contact (next of kin name, phone, relationship) and dive accident insurance status (Own active policy details vs Dive center daily hyperbaric evacuation coverage).
* **Main Certifications Progression:**
  * Official certification levels are filtered strictly to core qualification progression tracks (e.g. Scuba Diver, OWD, AOWD, Rescue Diver, Master Scuba Diver, Divemaster, OWSI, Tec 40/45/50/Trimix), omitting non-core specialty cards and non-certification intro experiences.

### 7.4 One-Click Coast Guard / Port Authority Export (Vessel & Crew Compliant)
Generates an official maritime passenger and crew manifest PDF/CSV compliant with Mediterranean port laws (e.g. Greece Law 3409/2005 & 4688/2020, Spain, Italy) and Egypt CDWS:
* **Vessel Details:** Vessel Name, Port Registration / IMO Number, Call Sign, Home Port, Passenger Capacity.
* **Crew Roster:**
  * Skipper Name, License / Certificate Number.
  * Lead Instructor / Divemaster Names, Agency Membership Numbers, Oxygen Provider / First Aid Credentials.
* **Passenger / Diver Roster:** Legal Full Names, Dates of Birth, Passport/National ID Numbers, Nationalities, Emergency Contacts, and Diving Certification Levels.
* **Emergency Safety Checklist:** Onboard Oxygen Kit Verified (Yes/No), First Aid Kit Verified, VHF Radio Check Complete, Lifejackets & Liferaft Capacity Confirmed.

### 7.5 Offshore Offline Boat Mode & PWA Synchronization
* **The Reality:** Dive vessels travel to offshore reefs and islands where there is zero cellular signal.
* **PWA Architecture:**
  1. The operations roster is stored locally in client-side **IndexedDB** whenever the center manager or boat captain opens the app in port.
  2. The service worker caches static assets, emergency action plans, and the day's passenger manifests.
  3. While at sea, staff can toggle onboard check-ins, record dockside/boat Nitrox analysis readings, verify buddy pairs, and access diver emergency contacts completely offline.
  4. Changes are queued in a local `sync_queue`. Once the device reconnects to dock Wi-Fi or cellular network, Divemap automatically dispatches a batch reconciliation request to `/api/v1/centers/{center_id}/booking-ops/sync-offline`.

### 7.6 Post-Dive Automatic Logbook Sync (Divemap Ecosystem Synergy)
* When a dive guide or center manager marks a trip as **`COMPLETED`** from the manifest dashboard:
  1. Divemap identifies all checked-in, verified participants with linked Divemap accounts (`user_id`).
  2. The system automatically creates a **Draft `Dive` log** in each diver's account with:
     * Dive Site ID & Name.
     * Date, start time, bottom time, and max depth (recorded from trip profile or dive guide entry).
     * Water temperature and weather conditions from the trip briefing.
     * Gas mix used (Air or analyzed Nitrox $O_2\%$) saved to `gas_bottles_used`.
     * Digital Dive Center verification stamp and assigned Divemaster/Instructor signature stamp.
  3. **Database Schema Extension on `dives` Table:**
     To support official digital verification stamps, the `dives` table is extended via sequential Alembic migration:
     * `is_verified` (Boolean, default=False, index=True)
     * `verified_by_center_id` (Integer, ForeignKey("diving_centers.id", ondelete="SET NULL"), nullable=True, index=True)
     * `verified_by_user_id` (Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True) # Divemaster/Instructor
     * `verified_at` (DateTime(timezone=True), nullable=True)
  4. Divers receive a push notification: *"Your dive at Blue Hole is logged and verified by Aegean Divers! Tap to review and confirm."*

---

## 8. API Specification

### 8.1 OCTO 1.0 Supplier Endpoints (`/api/v1/octo`)
* `GET /suppliers/{center_id}`: Returns supplier profile and supported capabilities (`octo/pricing`, `octo/content`, `octo/webhooks`, `octo/questions`, `octo/waivers`, `octo/packages`, `octo/pickups`, `octo/promotions`).
* `GET /suppliers/{center_id}/products`: Lists bookable products (single trips, packages, courses).
* `GET /suppliers/{center_id}/products/{product_id}`: Product details, options, units, extras/add-ons, package includes, questions schema, waivers, and pickup points.
* `POST /availability`: Queries real-time seat and equipment availability for product/option/date range.
* `POST /availability/calendar`: Queries aggregated month availability, starting rates, and closed dates.
* `POST /bookings`: Holds seats (`ON_HOLD`), validates capacity and equipment stock via row locking, returns hold expiration.
* `GET /bookings/{uuid}`: Retrieves full booking state.
* `POST /bookings/{uuid}/confirm`: Finalizes booking, records payments/guarantees, updates status to `CONFIRMED`.
* `POST /bookings/{uuid}/cancel`: Cancels booking and releases held capacity and rental stock.
* `POST /bookings/{uuid}/extend`: Extends hold window for pending paperwork.
* `POST /webhooks`: Registers external OTA webhook subscriptions.
* `GET /webhooks`: Lists active webhook subscriptions.
* `DELETE /webhooks/{webhook_id}`: Deletes a webhook subscription.

### 8.2 Diver Profile, Group Claim & Booking Endpoints (`/api/v1/bookings`)
* `GET /my-gear-profile`: Diver's saved biometric sizing, computer ownership, and preferences.
* `PUT /my-gear-profile`: Updates saved gear profile.
* `GET /templates/{agency}/{bundle_id}`: Retrieves questions schema and waiver HTML.
* `GET /{uuid}/claim/{claim_token}`: Validates guest invitation token and retrieves booking details.
* `POST /{uuid}/claim/{claim_token}`: Submits guest diver sizing, DOB, medical questionnaire, and digital waiver.
* `POST /{uuid}/submit-paperwork`: Submits encrypted medical responses, e-signatures, and flight details.
* `POST /{uuid}/redeem-package-session`: Selects a departure slot for a multi-day package pass.
* `GET /{uuid}/voucher`: Digital voucher with QR code and pickup meeting instructions.
* `GET /{uuid}/briefing`: Download compiled pre-dive briefing PDF.

### 8.3 Center Booking Ops Endpoints (`/api/v1/centers/{center_id}/booking-ops`)
* `GET /trips/{trip_id}/manifest`: Live boat roster, badges, buddy teams, gear crate manifest, pickup list.
* `POST /trips/{trip_id}/participants`: Add diver manually (existing Divemap user or walk-in guest).
* `PUT /trips/{trip_id}/participants/{participant_id}`: Edit participant details (sizing, tanks, lead weight, notes).
* `DELETE /trips/{trip_id}/participants/{participant_id}`: Remove/cancel diver and release held seat/gear capacity.
* `POST /trips/{trip_id}/participants/{participant_id}/move`: Move/reassign participant to a different trip slot.
* `POST /trips/{trip_id}/participants/{participant_id}/toggle-checkin`: Toggle roll-call onboard status.
* `POST /trips/{trip_id}/assign-buddies`: Bulk assign buddy pairs and designated dive guides.
* `POST /trips/{trip_id}/log-nitrox`: Log measured cylinder $O_2\%$, calculated MOD, and diver verification.
* `GET /trips/{trip_id}/participants/{participant_id}/medical`: Inspect medical clearance & doctor PDF (strictly authorized center managers).
* `PUT /trips/{trip_id}/participants/{participant_id}/verify-medical`: Center staff approval/rejection of uploaded doctor certificate.
* `POST /trips/{trip_id}/divert-site`: Divert trip to alternative contingency dive site and notify divers.
* `POST /trips/{trip_id}/weather-cancel`: Force majeure cancellation, releasing bookings and issuing credit vouchers.
* `POST /trips/{trip_id}/complete-trip`: Marks trip completed and triggers post-dive auto-logbook sync.
* `POST /sync-offline`: Batch reconciliation of offline boarding and Nitrox sign-offs from mobile PWA.
* `GET /trips/{trip_id}/manifest/export-port-authority`: Generates official Coast Guard PDF/CSV.
* `GET /trips/{trip_id}/briefing`: Fetches draft briefing with weather.
* `PUT /trips/{trip_id}/briefing`: Updates custom notes and assignments.
* `POST /trips/{trip_id}/briefing/dispatch`: Queues briefing dispatch to SQS.
* `POST /bookings/{booking_id}/mark-paid`: Toggles payment status to `PAID_AT_CHECKIN`.
* `GET /inventory`: Lists center physical equipment stock, maintenance counts, and current allocations.
* `PUT /inventory`: Updates center physical stock quantities per size/variant.

---

## 9. Verification & Testing Strategy

1. **Unit & Encryption Tests:**
   * Test envelope encryption of medical data with AES-256-GCM.
   * Verify zero-downtime key rotation via `MultiFernet`.
   * Verify DMSC 2020 10-question evaluation logic and flagging.
   * Verify statutory purging job deleting medical responses >12 months while preserving signed waivers.
2. **Scuba Safety Gate Tests:**
   * Test Decompression Sickness (DCS) no-fly buffer validation: ensure error/warning when `flight_time - dive_end_time < min_surface_interval`.
   * Test Junior Diver depth cap: ensure 10-11 year olds cannot book trips exceeding 12m without warning/restriction.
   * Test Inactive Diver refresher prompt: verify trigger when `date_of_last_dive > refresher_threshold_days`.
   * Test Nitrox cert gate: ensure non-certified divers cannot select enriched air gas mixes.
   * Test Minor gate: ensure participants under 18 require legal guardian name and co-signature.
   * Test Staff-to-diver ratio calculations: ensure warnings when guide ratios exceed configured limits.
3. **Inventory & Concurrency Tests:**
   * Test equipment inventory deduction: verify that when 5 Size M BCDs are booked from a total stock of 5, a 6th diver attempting to book Size M is blocked or notified of sizing unavailability.
   * Test seat capacity race condition prevention using database row locks (`SELECT ... FOR UPDATE`).
4. **OCTO Standard Compliance Tests:**
   * Test two-step booking lifecycle (`POST /bookings` -> `ON_HOLD` -> `POST /bookings/{uuid}/confirm`).
   * Test `octo/packages` product schema and multi-session redemption.
   * Test `octo/pickups` points retrieval and booking selection.
   * Test standard error payloads (`INVALID_AVAILABILITY_ID`, `INVALID_HOLD_EXPIRATION`, `AVAILABILITY_UNAVAILABLE`).
   * Verify `octo/webhooks` dispatch on booking status changes and availability updates.
5. **Briefing, Operations & Ecosystem Tests:**
   * Mock Open-Meteo weather API response and verify correct synthesis with `DiveSite` data and Emergency Action Plan.
   * Test site diversion workflow: update active site, verify weather re-query, and check notification dispatch.
   * Test Coast Guard export PDF generation ensuring crew members, vessel details, and divers are formatted correctly.
   * Test trip completion and automated draft `Dive` log creation for all checked-in divers.
6. **Isolated Docker Backend Testing:**
   * Run all migrations and tests in the isolated test environment per project standards (`cd backend && ./docker-test-github-actions.sh`).
