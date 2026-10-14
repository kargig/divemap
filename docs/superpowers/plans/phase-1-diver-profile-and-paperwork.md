# Phase 1: Diver Gear Profile & Encrypted Paperwork Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundational diver biometrics profile, canonical cylinder/gas mappings with bidirectional unit conversions, GDPR Article 9 envelope encryption service with MultiFernet key rotation, local agency questionnaires/waivers engine, and a frontend profile gear editor.

**Architecture:** 
1. Re-use `TANK_SIZES` and `GAS_MIXES` from `frontend/src/utils/diveConstants.js` in a shared backend constants module `backend/app/constants/cylinders.py`.
2. Mathematical conversion helpers in `backend/app/utils/unit_conversion.py` enabling divers and dive center managers to input and view biometrics in their preferred unit systems without losing precision.
3. Dedicated `UserGearProfile` database table storing canonical metric SI units alongside preferred unit display settings.
4. AES-256-GCM / Fernet envelope encryption wrapping each diver's medical record with a unique Data Encryption Key (DEK) and a Master Key (MEK) supporting zero-downtime `MultiFernet` rotation.
5. Local DMSC 2020 medical screening schemas and Jinja2 legal waivers for PADI (10086, 10175 EU) and Universal templates.
6. React component `UserGearProfileEditor.jsx` inside the user profile page with a live single-click Metric/Imperial toggle.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, Cryptography (Fernet / MultiFernet), Jinja2, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-divemap-octo-booking-system-design.md` (Sections 3.2, 3.5, 3.6, 4, 5)

**Dependencies:** None. This is the foundational phase.

## Global Constraints

- **No Raw Pytest on Host:** Always run backend tests via `./docker-test-github-actions.sh [test_file]`. Never run direct pytest commands that connect to the development database.
- **Git Restrictions:** NEVER execute `git add` or `git commit`. All commit steps prepare `commit-message.txt` for the user to execute manually.
- **Frontend Verification:** Every frontend page modified or created MUST be verified using Chrome DevTools MCP (`navigate_page`, `take_snapshot`) and confirmed to produce zero browser console errors (`list_console_messages`).
- **Canonical Storage:** All biometric and equipment values are stored canonically in metric SI units (`height_cm`, `weight_kg`, `shoe_size_eu`, `estimated_lead_kg`).

---

### Task 1: Canonical Cylinder Definitions & Bidirectional Unit Conversion Engine

**Files:**
- Create: `backend/app/constants/cylinders.py`
- Create: `backend/app/utils/unit_conversion.py`
- Test: `backend/tests/test_unit_conversion_and_cylinders.py`

**Interfaces:**
- Consumes: `frontend/src/utils/diveConstants.js` (`TANK_SIZES` and `GAS_MIXES` definitions).
- Produces: 
  - `TANK_SIZES_BY_ID`, `GAS_MIXES_BY_ID`, `get_tank_spec(tank_id)`, `get_gas_mix_spec(gas_id)`
  - `cm_to_feet_inches(cm)`, `feet_inches_to_cm(ft, in)`, `kg_to_lbs(kg)`, `lbs_to_kg(lbs)`, `eu_to_us_men_shoe(eu)`, `us_men_to_eu_shoe(us)`
  - `format_dual_measurement(val, metric_unit, imperial_unit)`

- [ ] **Step 1: Write the failing tests for cylinders and unit conversions**

Create `backend/tests/test_unit_conversion_and_cylinders.py`:
```python
import pytest
from app.constants.cylinders import (
    TANK_SIZES_BY_ID,
    GAS_MIXES_BY_ID,
    get_tank_spec,
    get_gas_mix_spec,
)
from app.utils.unit_conversion import (
    cm_to_feet_inches,
    feet_inches_to_cm,
    kg_to_lbs,
    lbs_to_kg,
    eu_to_us_men_shoe,
    us_men_to_eu_shoe,
    format_dual_measurement,
)

def test_cylinder_constants_exist():
    assert "12" in TANK_SIZES_BY_ID
    assert TANK_SIZES_BY_ID["12"]["size"] == 12
    assert TANK_SIZES_BY_ID["12"]["material"] == "steel"
    
    assert "al80" in TANK_SIZES_BY_ID
    assert TANK_SIZES_BY_ID["al80"]["size"] == 11.1
    assert TANK_SIZES_BY_ID["al80"]["material"] == "alu"
    
    assert "15" in TANK_SIZES_BY_ID
    assert get_tank_spec("15")["name"] == "15 Liters"
    
    assert "ean32" in GAS_MIXES_BY_ID
    assert get_gas_mix_spec("ean32")["o2"] == 32

def test_weight_conversion():
    assert round(kg_to_lbs(75.0), 1) == 165.3
    assert round(lbs_to_kg(165.347), 1) == 75.0
    # Lead weight test
    assert round(kg_to_lbs(4.0), 1) == 8.8
    assert round(lbs_to_kg(8.818), 1) == 4.0

def test_height_conversion():
    feet, inches = cm_to_feet_inches(180)
    assert feet == 5 and inches == 11
    assert feet_inches_to_cm(5, 11) == 180

def test_shoe_conversion():
    assert eu_to_us_men_shoe(43.0) == 9.5
    assert us_men_to_eu_shoe(9.5) == 43.0

def test_format_dual_measurement():
    formatted = format_dual_measurement(30.0, "m", "ft")
    assert "30m" in formatted and "98ft" in formatted
```

- [ ] **Step 2: Run test in isolated Docker to verify it fails**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_unit_conversion_and_cylinders.py
```
Expected: FAIL with `ModuleNotFoundError: No module named 'app.constants.cylinders'`.

- [ ] **Step 3: Implement canonical cylinder constants**

Create `backend/app/constants/cylinders.py`:
```python
"""
Canonical Cylinder and Gas Mix Constants for Divemap.
Mirrors frontend/src/utils/diveConstants.js to ensure 100% ID consistency.
"""
from typing import Dict, Any

TANK_SIZES = [
    {"id": "3", "name": "3 Liters (Pony)", "size": 3, "defaultPressure": 232, "material": "steel", "emptyWeight": 4.0},
    {"id": "al40", "name": "AL40 (5.7L)", "size": 5.7, "defaultPressure": 207, "material": "alu", "emptyWeight": 6.9},
    {"id": "alu7", "name": "ALU7 (7L)", "size": 7, "defaultPressure": 207, "material": "alu", "emptyWeight": 8.8},
    {"id": "7", "name": "7 Liters Steel", "size": 7, "defaultPressure": 232, "material": "steel", "emptyWeight": 8.0},
    {"id": "8.5", "name": "8.5 Liters", "size": 8.5, "defaultPressure": 232, "material": "steel", "emptyWeight": 10.5},
    {"id": "10", "name": "10 Liters", "size": 10, "defaultPressure": 232, "material": "steel", "emptyWeight": 12.0},
    {"id": "al80", "name": "AL80 (11.1L)", "size": 11.1, "defaultPressure": 207, "material": "alu", "emptyWeight": 14.3},
    {"id": "12", "name": "12 Liters", "size": 12, "defaultPressure": 232, "material": "steel", "emptyWeight": 14.0},
    {"id": "14", "name": "Double 7s (14L)", "size": 14, "defaultPressure": 232, "material": "steel", "emptyWeight": 17.0, "isDoubles": True},
    {"id": "15", "name": "15 Liters", "size": 15, "defaultPressure": 232, "material": "steel", "emptyWeight": 16.5},
    {"id": "17", "name": "Double 8.5s (17L)", "size": 17, "defaultPressure": 232, "material": "steel", "emptyWeight": 21.0, "isDoubles": True},
    {"id": "18", "name": "18 Liters", "size": 18, "defaultPressure": 232, "material": "steel", "emptyWeight": 20.0},
    {"id": "20_double", "name": "Double 10s (20L)", "size": 20, "defaultPressure": 232, "material": "steel", "emptyWeight": 24.0, "isDoubles": True},
    {"id": "double_al80", "name": "Double AL80 (22.2L)", "size": 22.2, "defaultPressure": 207, "material": "alu", "emptyWeight": 28.6, "isDoubles": True},
    {"id": "24", "name": "Double 12s (24L)", "size": 24, "defaultPressure": 232, "material": "steel", "emptyWeight": 28.0, "isDoubles": True},
    {"id": "30", "name": "Double 15s (30L)", "size": 30, "defaultPressure": 232, "material": "steel", "emptyWeight": 33.0, "isDoubles": True},
    {"id": "36", "name": "Double 18s (36L)", "size": 36, "defaultPressure": 232, "material": "steel", "emptyWeight": 40.0, "isDoubles": True},
]

TANK_SIZES_BY_ID: Dict[str, Dict[str, Any]] = {t["id"]: t for t in TANK_SIZES}

GAS_MIXES = [
    {"id": "air", "name": "Air (21%)", "o2": 21, "he": 0},
    {"id": "ean28", "name": "EAN28", "o2": 28, "he": 0},
    {"id": "ean32", "name": "EAN32 (Nitrox)", "o2": 32, "he": 0},
    {"id": "ean36", "name": "EAN36", "o2": 36, "he": 0},
    {"id": "nx50", "name": "Nitrox 50%", "o2": 50, "he": 0},
    {"id": "oxy", "name": "Oxygen (100%)", "o2": 100, "he": 0},
    {"id": "tx2135", "name": "Tx 21/35", "o2": 21, "he": 35},
    {"id": "tx1845", "name": "Tx 18/45", "o2": 18, "he": 45},
    {"id": "tx1555", "name": "Tx 15/55", "o2": 15, "he": 55},
]

GAS_MIXES_BY_ID: Dict[str, Dict[str, Any]] = {g["id"]: g for g in GAS_MIXES}

def get_tank_spec(tank_id: str) -> Dict[str, Any]:
    return TANK_SIZES_BY_ID.get(tank_id, TANK_SIZES_BY_ID["12"])

def get_gas_mix_spec(gas_id: str) -> Dict[str, Any]:
    return GAS_MIXES_BY_ID.get(gas_id, GAS_MIXES_BY_ID["air"])
```

- [ ] **Step 4: Implement bidirectional unit conversion utilities**

Create `backend/app/utils/unit_conversion.py`:
```python
"""
Bidirectional Unit Conversion Helpers for Scuba Sizing and Dive Metrics.
"""
from typing import Tuple

def kg_to_lbs(kg: float) -> float:
    return kg * 2.20462262

def lbs_to_kg(lbs: float) -> float:
    return lbs / 2.20462262

def cm_to_feet_inches(cm: int) -> Tuple[int, int]:
    total_inches = round(cm / 2.54)
    feet = total_inches // 12
    inches = total_inches % 12
    return feet, inches

def feet_inches_to_cm(feet: int, inches: int) -> int:
    total_inches = (feet * 12) + inches
    return round(total_inches * 2.54)

def eu_to_us_men_shoe(eu_size: float) -> float:
    return round((eu_size - 33.5) * 2) / 2.0

def us_men_to_eu_shoe(us_size: float) -> float:
    return round((us_size + 33.5) * 2) / 2.0

def meters_to_feet(m: float) -> float:
    return m * 3.28084

def feet_to_meters(ft: float) -> float:
    return ft / 3.28084

def bar_to_psi(bar: float) -> float:
    return bar * 14.5038

def psi_to_bar(psi: float) -> float:
    return psi / 14.5038

def celsius_to_fahrenheit(c: float) -> float:
    return (c * 9.0 / 5.0) + 32.0

def format_dual_measurement(val_metric: float, unit_metric: str, unit_imperial: str) -> str:
    if unit_metric == "m" and unit_imperial == "ft":
        ft = round(meters_to_feet(val_metric))
        return f"{int(val_metric) if val_metric.is_integer() else val_metric}m ({ft}ft)"
    elif unit_metric == "kg" and unit_imperial == "lbs":
        lbs = round(kg_to_lbs(val_metric), 1)
        return f"{val_metric}kg ({lbs}lbs)"
    elif unit_metric == "°C" and unit_imperial == "°F":
        f = round(celsius_to_fahrenheit(val_metric))
        return f"{val_metric}°C ({f}°F)"
    return f"{val_metric} {unit_metric}"
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_unit_conversion_and_cylinders.py
```
Expected: `All tests passed!`.

- [ ] **Step 6: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add canonical cylinder constants and bidirectional unit conversion engine

Defines TANK_SIZES and GAS_MIXES in backend/app/constants/cylinders.py
matching frontend/src/utils/diveConstants.js. Adds conversion helpers in
backend/app/utils/unit_conversion.py.
```

---

### Task 2: `UserGearProfile` Database Model & Sequential Alembic Migration

**Files:**
- Modify: `backend/app/models.py`
- Create: Sequential migration file (e.g. `backend/migrations/versions/0094_create_user_gear_profiles.py`)
- Test: `backend/tests/test_user_gear_profile_model.py`

**Interfaces:**
- Consumes: `User` model (`backend/app/models.py`).
- Produces: `UserGearProfile` model.

- [ ] **Step 1: Write model test**

Create `backend/tests/test_user_gear_profile_model.py`:
```python
import pytest
from sqlalchemy.orm import Session
from app.models import User, UserGearProfile

def test_create_and_retrieve_user_gear_profile(db: Session, test_user: User):
    profile = UserGearProfile(
        user_id=test_user.id,
        preferred_unit_system="METRIC",
        preferred_shoe_system="EU",
        height_cm=180,
        weight_kg=75,
        shoe_size_eu=43.0,
        wetsuit_gender="MEN",
        wetsuit_size="L",
        wetsuit_thickness="5mm",
        bcd_size="M",
        fin_type="OPEN_HEEL",
        regulator_fitting="DIN",
        preferred_tank_id="12",
        preferred_gas_mix_id="air",
        estimated_lead_kg=4.0,
        insurance_provider="DAN Europe",
        insurance_policy_number="12345678",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    
    assert profile.id is not None
    assert profile.preferred_tank_id == "12"
    assert profile.insurance_provider == "DAN Europe"
```

- [ ] **Step 2: Add `UserGearProfile` class to `backend/app/models.py`**

```python
class UserGearProfile(Base):
    __tablename__ = "user_gear_profiles"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    preferred_unit_system = Column(String(10), default="METRIC") # METRIC vs IMPERIAL
    preferred_shoe_system = Column(String(10), default="EU")     # EU, US_MEN, US_WOMEN, UK
    
    height_cm = Column(Integer, nullable=True) # Stored canonically in cm
    weight_kg = Column(Integer, nullable=True) # Stored canonically in kg
    shoe_size_eu = Column(DECIMAL(3, 1), nullable=True) # Stored canonically in EU
    
    wetsuit_gender = Column(String(10), nullable=True)   # MEN, WOMEN, UNISEX
    wetsuit_size = Column(String(10), nullable=True)     # XS, S, M, ML, L, XL, XXL
    wetsuit_thickness = Column(String(10), default="5mm") # 3mm, 5mm, 7mm
    bcd_size = Column(String(10), nullable=True)         # XS, S, M, L, XL
    fin_type = Column(String(20), default="OPEN_HEEL")   # FULL_FOOT, OPEN_HEEL
    regulator_fitting = Column(String(10), default="DIN") # DIN, YOKE
    
    preferred_tank_id = Column(String(20), default="12") # Re-uses TANK_SIZES ID
    preferred_gas_mix_id = Column(String(20), default="air") # Re-uses GAS_MIXES ID
    estimated_lead_kg = Column(DECIMAL(4, 1), nullable=True)
    
    has_own_dive_computer = Column(Boolean, default=False)
    has_own_smb = Column(Boolean, default=False)
    
    insurance_provider = Column(String(100), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    insurance_expiry_date = Column(Date, nullable=True)
    
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    emergency_contact_relation = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", backref=backref("gear_profile", uselist=False, cascade="all, delete-orphan"))
```

- [ ] **Step 3: Create sequential migration file**

Find the latest migration in `backend/migrations/versions/`. Current latest is `0093_add_facebook_login_fields.py`, so create `0094_create_user_gear_profiles.py` creating the table with constraints.

- [ ] **Step 4: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_user_gear_profile_model.py
```
Expected: `All tests passed!`.

- [ ] **Step 5: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add UserGearProfile database model and migration

Stores diver biometrics, equipment sizing, tank preferences, and insurance data
canonically in metric SI units.
```

---

### Task 3: Sensitive Medical Envelope Encryption Service with MultiFernet Key Rotation

**Files:**
- Create: `backend/app/services/booking_medical_encryption_service.py`
- Test: `backend/tests/test_medical_encryption_service.py`

**Interfaces:**
- Consumes: `os.environ["BOOKING_MEDICAL_MASTER_KEYS"]`.
- Produces: 
  - `BookingMedicalEncryptionService.encrypt_answers(dict) -> (encrypted_dek: str, encrypted_payload: bytes)`
  - `BookingMedicalEncryptionService.decrypt_answers(encrypted_dek: str, encrypted_payload: bytes) -> dict`
  - `BookingMedicalEncryptionService.rotate_dek(encrypted_dek: str) -> str`

- [ ] **Step 1: Write tests for envelope encryption and MultiFernet rotation**

Create `backend/tests/test_medical_encryption_service.py` testing envelope encryption, decryption, and rotation. (Use the complete test code specified in Task 3 of the main plan).

- [ ] **Step 2: Implement `BookingMedicalEncryptionService`**

Create `backend/app/services/booking_medical_encryption_service.py`.

- [ ] **Step 3: Run test in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_medical_encryption_service.py
```
Expected: `All tests passed!`.

- [ ] **Step 4: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add envelope encryption service for diver medical records

Implements AES-256-GCM envelope encryption with per-record DEK generation
and zero-downtime MultiFernet key rotation.
```

---

### Task 4: Local Agency Questionnaire Schemas & Legal Waivers Engine

**Files:**
- Create: `backend/app/templates/booking/questionnaires/dmsc_2020_medical.json`
- Create: `backend/app/templates/booking/waivers/padi/10086_certified_diver_release.html.j2`
- Create: `backend/app/templates/booking/waivers/padi/10175_eu_statement_of_risk.html.j2`
- Create: `backend/app/templates/booking/waivers/universal/generic_dive_center_waiver.html.j2`
- Create: `backend/app/services/waiver_service.py`
- Test: `backend/tests/test_waiver_service.py`

**Interfaces:**
- Consumes: Jinja2 template environment.
- Produces: 
  - `WaiverService.evaluate_dmsc_medical(answers) -> ("CLEARED" | "FLAGGED_CONTACT_CENTER")`
  - `WaiverService.render_waiver(bundle_id, context) -> str`

- [ ] **Step 1: Write tests for DMSC evaluation and waiver rendering**

Create `backend/tests/test_waiver_service.py`.

- [ ] **Step 2: Create questionnaire schema `dmsc_2020_medical.json`**

Define the 10 questions and diagnostic boxes A-G.

- [ ] **Step 3: Create Jinja2 waiver templates for PADI and universal waivers**

- [ ] **Step 4: Implement `WaiverService`**

- [ ] **Step 5: Run tests in isolated Docker**

Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_waiver_service.py
```
Expected: `All tests passed!`.

- [ ] **Step 6: Prepare commit draft**

Write commit message to `commit-message.txt`:
```
Add DMSC 2020 questionnaire schema and legal waiver rendering engine

Implements medical screening evaluation logic and Jinja2 templates for PADI
and universal dive waivers.
```

---

### Task 5: Diver Gear Profile API Endpoints

**Files:**
- Create: `backend/app/routers/diver_gear_profile.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_diver_gear_profile_api.py`

**Interfaces:**
- Consumes: Current authenticated `User` dependency, `UserGearProfile`.
- Produces: 
  - `GET /api/v1/bookings/gear-profiles` & `POST /gear-profiles`
  - `GET/PUT/DELETE /api/v1/bookings/gear-profiles/{id}`
  - `POST /api/v1/bookings/gear-profiles/{id}/set-default`
  - `GET /api/v1/bookings/my-gear-profile` & `PUT /my-gear-profile`
  - `GET /api/v1/bookings/cylinders` & `GET /api/v1/bookings/gas-mixes`

- [x] **Step 1: Write API tests**
- [x] **Step 2: Implement router in `backend/app/routers/diver_gear_profile.py`**
- [x] **Step 3: Register router in `backend/app/main.py`**
- [x] **Step 4: Run tests in isolated Docker**
- [x] **Step 5: Prepare commit draft**

---

### Task 6: Frontend Diver Gear Configurations Page & Modal

**Files:**
- Create: `frontend/src/pages/DiverGearProfilesPage.jsx`
- Create: `frontend/src/components/UserGearProfileModal.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Profile.jsx`
- Test: Frontend verification via Chrome DevTools MCP & unit tests

**Interfaces:**
- Consumes: `/api/v1/bookings/gear-profiles/...`.
- Produces: Multi-profile management page at `/profile/gear` with presets, live Metric/Imperial switcher, and primary profile selection.

- [x] **Step 1: Implement `UserGearProfileModal.jsx` with presets and live conversion**
- [x] **Step 2: Implement `DiverGearProfilesPage.jsx` with card grid and default toggle**
- [x] **Step 3: Register `/profile/gear` route in `frontend/src/App.jsx`**
- [x] **Step 4: Add Gear Configurations card and sidebar link to `frontend/src/pages/Profile.jsx`**
- [x] **Step 5: Run frontend lint (`make lint-frontend`)**
- [x] **Step 6: Verify in browser with Chrome DevTools MCP (0 console errors)**

---

### Phase 1 Verification Checklist
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_unit_conversion_and_cylinders.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_user_gear_profile_model.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_medical_encryption_service.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_waiver_service.py` passes.
- [x] `cd backend && ./docker-test-github-actions.sh tests/test_diver_gear_profile_api.py` passes.
- [x] `make lint-frontend` passes with zero errors.
- [x] Chrome DevTools browser verification passes with zero console errors.
