# Specification: Annual Medical Questionnaire & Per-Center Physician Approval Engine

- **Date:** 2026-10-13
- **Status:** Approved Design for Phased Implementation
- **Author:** AI Software Architect & Senior Safety Engineer
- **Parent Specifications:**
  - `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md`
  - `docs/superpowers/plans/2026-09-27-divemap-octo-booking-plan-of-plans.md`

---

## 1. Executive Summary & Regulatory Rules

Under WRSTC / DMSC 2020 diving medical guidelines and maritime liability laws, diver medical questionnaires follow two distinct operational tracks:

1. **Fully Cleared Divers (10 "NO" Answers):**
   - Valid for **1 year (365 days)** globally across all diving centers on Divemap.
   - For every subsequent trip within 365 days, divers can fast-track with a 1-click affirmative declaration: *"My physical and medical condition has not changed since my declaration on [Date]"*.
   - A departure-specific immutable snapshot is created for that trip's manifest, satisfying harbor master and insurance requirements.

2. **Flagged Divers (1 or more "YES" Answers):**
   - **No Automatic Cross-Center Clearance:** A flagged questionnaire can **never** be automatically applied across different diving centers.
   - **Physician Clearance Required:** The diver must provide an official, signed Medical Physician Examination Certificate approving them for scuba diving.
   - **Center Sovereign Discretion:** Each individual diving center manager must review the physician certificate and make their own sovereign decision whether to approve the diver on their boats.
   - **Center-Specific 1-Year Validity:** When a center manager reviews the doctor's document and approves the diver, that approval is recorded specifically for **that diving center** for up to 1 year (`expires_at = now() + 365 days`). Center A's approval does not bind Center B.

---

## 2. Architecture & Data Models

### 2.1 User-Level Canonical Medical Profile (`user_medical_profiles`)
Stores the authenticated diver's authoritative annual declaration.

```python
class UserMedicalProfile(Base):
    __tablename__ = "user_medical_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    # Status: CLEARED (all 10 NO) vs FLAGGED (1+ YES)
    status = Column(String(30), nullable=False) # 'CLEARED' | 'FLAGGED'
    
    # Envelope encryption (AES-256-GCM DEK encrypted with master MultiFernet KMS)
    encrypted_dek = Column(Text, nullable=False)
    encrypted_answers = Column(LargeBinary, nullable=False)
    
    # Uploaded physician certificate (optional/if flagged)
    physician_certificate_url = Column(String(500), nullable=True)
    
    completed_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False) # completed_at + 365 days
    audit_signature_hash = Column(String(64), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    user = relationship("User", backref=sa.orm.backref("annual_medical_profile", uselist=False))
```

### 2.2 Per-Center Diver Approval (`center_diver_medical_approvals`)
Records a specific diving center's manager approval for a flagged diver.

```python
class CenterDiverMedicalApproval(Base):
    __tablename__ = "center_diver_medical_approvals"

    id = Column(Integer, primary_key=True, index=True)
    diving_center_id = Column(Integer, ForeignKey("diving_centers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    approved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    physician_name = Column(String(255), nullable=True)
    physician_clinic = Column(String(255), nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    approved_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False) # approved_at + 365 days
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        sa.UniqueConstraint("diving_center_id", "user_id", name="uix_center_user_medical_approval"),
    )
    
    diving_center = relationship("DivingCenter")
    user = relationship("User", foreign_keys=[user_id])
    approved_by_user = relationship("User", foreign_keys=[approved_by_user_id])
```

### 2.3 Departure-Level Snapshot (`diver_medical_records`)
Existing table linked to `OctoBookingUnitItem` (`booking_unit_item_id`).
- When diver books a trip:
  - If `UserMedicalProfile.status == 'CLEARED'` and diver affirms *"No change"*:
    Clones encrypted DEK/answers into this departure's `DiverMedicalRecord` with status `'CLEARED'`.
  - If `UserMedicalProfile.status == 'FLAGGED'`:
    - Checks `center_diver_medical_approvals` for `(trip.diving_center_id, diver.user_id)`.
    - If active approval exists: clones with status `'PHYSICIAN_APPROVED'`.
    - If no approval exists for this center: creates with status `'FLAGGED_CONTACT_CENTER'`. Manifest displays 🔴 **"Medical Hold / Awaiting Center Approval"**.

---

## 3. Workflow & UX Design

### 3.1 Booking Wizard Step 4 (DMSC Medical Questionnaire)

```
Case 1: User has active UserMedicalProfile with status == 'CLEARED' (< 365 days old)
┌────────────────────────────────────────────────────────────────────────┐
│  ✓ Annual Medical Declaration on File (DMSC 2020)                       │
│  Completed on 12 May 2026 • Valid until 12 May 2027 (211 days left)    │
│                                                                        │
│  (●) No Change in Health Status                                        │
│      "I confirm that my physical and medical condition has not changed │
│       since my declaration on 12 May 2026."                           │
│                                                                        │
│  (○) My Health Status Has Changed                                      │
│      "I have experienced a new illness, surgery, or medical condition."│
│      [ Opens interactive 10-question modal to submit updated form ]    │
└────────────────────────────────────────────────────────────────────────┘
-> Selecting "No Change" immediately satisfies Step 4 with 1 click!

Case 2: User has active UserMedicalProfile with status == 'FLAGGED'
┌────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Medical Screening Flagged — Physician Approval Required            │
│  Your annual questionnaire noted conditions requiring a doctor's signoff.
│                                                                        │
│  Center Status for Athens Riviera Divers:                              │
│  [ If already approved by Athens Riviera Divers within 365 days ]:      │
│    🟢 Approved by Center Manager on 02 Jun 2026 (Valid until 02 Jun 2027)│
│                                                                        │
│  [ If NOT yet approved by this center ]:                               │
│    🟡 Awaiting Manager Review                                          │
│    "Each dive center must independently review your physician document.│
│     Your booking will be placed on Medical Hold until the center staff │
│     verifies your clearance."                                          │
│    [ Upload / Update Physician Certificate ]                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Center Operations Dashboard (`/manifest` & `/medical-review`)

1. **Manifest Roster Column (`BoatManifestTable.jsx`)**:
   - 🟢 **Self-Cleared (Annual)**: Diver completed 10-No questionnaire within 365 days.
   - 🔵 **Doctor Approved (Center 1-Yr)**: Approved by this center's manager based on physician clearance.
   - 🔴 **Medical Hold (Unapproved Center)**: Flagged diver has not yet been approved by this diving center's manager.
2. **Medical Review & 1-Year Clearance Modal (`/medical-review`)**:
   - Center manager inspects flagged conditions and views the uploaded physician certificate.
   - Action Button: **"Grant 1-Year Medical Approval for [Center Name]"**:
     - Form: Physician Name, Clinic/Hospital, Expiry Date (default: 365 days), and Notes.
     - On submission:
       - Creates/updates `center_diver_medical_approvals` record.
       - Turns current departure status to 🔵 `PHYSICIAN_APPROVED`.
       - All future bookings by this diver with **this center** for the next 365 days automatically recognize the approval!
3. **Emergency Incident Dossier (`/emergency-dossier`)**:
   - In case of accident or decompression illness, manager clicks **"Export Emergency Dossier PDF"**.
   - Decrypts the diver's annual questionnaire, contact numbers, allergies/medications, and physician clearance for hyperbaric chamber doctors.

---

## 4. Implementation Phasing

- **Phase 5A: Database Schema & Migrations**
  - Create `user_medical_profiles` and `center_diver_medical_approvals`.
  - Sequential Alembic migration (`0103_add_annual_and_center_medical_clearances.py`).
- **Phase 5B: Backend Service & Endpoints**
  - Fast-track copy logic in `backend/app/routers/bookings.py`.
  - Per-center verification & 1-year approval endpoints in `backend/app/routers/center_booking_ops.py`.
  - Standalone annual declaration endpoints in `backend/app/routers/users.py`.
- **Phase 5C: Frontend Wizard & Profile Integration**
  - Fast-track radio selection in `BookingWizard.jsx`.
  - Annual medical card in `UserProfile.jsx` and `DiverGearProfilesPage.jsx`.
  - 1-Year approval action in center operations modal (`MedicalReviewModal.jsx`).
- **Phase 5D: Automated Tests & Verification**
  - Unit tests verifying that CLEARED auto-copies across centers, while FLAGGED is blocked until the specific center manager grants 1-year approval.
  - Browser DevTools MCP verification with 0 console errors.
