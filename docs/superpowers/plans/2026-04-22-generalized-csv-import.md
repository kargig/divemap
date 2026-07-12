# Generalized CSV Import Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a resilient, user-configurable CSV import system that handles any CSV log format through dynamic field mapping and intelligent entity resolution, with strong security protections against CSV injection and DoS.

**Architecture:** A two-step import process: 1. Header & Sample detection to let the user map CSV columns to database fields. 2. Processing mapped data with a robust backend parser that handles unit conversion, multi-format dates, and entity splitting (Buddy/Center).

**Tech Stack:** FastAPI, Pydantic, nh3 (Sanitization), React (React Query), Tailwind CSS.

---

### Task 1: Security Utilities & Constraints

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`
- Test: `backend/tests/test_csv_import_security.py`

- [ ] **Step 1: Write security utility tests**
```python
import pytest
from backend.app.routers.dives.dives_import import protect_csv_formula, sanitize_csv_cell

def test_protect_csv_formula():
    assert protect_csv_formula("=SUM(1,2)") == "'=SUM(1,2)"
    assert protect_csv_formula("+123") == "'+123"
    assert protect_csv_formula("Regular text") == "Regular text"

def test_sanitize_csv_cell():
    assert sanitize_csv_cell("<script>alert(1)</script>Hello") == "Hello"
    assert sanitize_csv_cell("Normal value") == "Normal value"
```

- [ ] **Step 2: Run tests to verify failure**
Run: `pytest backend/tests/test_csv_import_security.py -v`

- [ ] **Step 3: Implement security utilities in `dives_import.py`**
```python
def protect_csv_formula(value: str) -> str:
    if not value: return value
    if value.startswith(('=', '+', '-', '@')):
        return f"'{value}"
    return value

def sanitize_csv_cell(value: str) -> str:
    if not value: return value
    # Use existing nh3 cleaner
    import nh3
    clean_val = nh3.clean(value, tags=set())
    return protect_csv_formula(clean_val)
```

- [ ] **Step 4: Verify tests pass**
Run: `pytest backend/tests/test_csv_import_security.py -v`

---

### Task 2: CSV Header Detection Endpoint

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Add Schemas for Header Detection**
Add to `backend/app/schemas/__init__.py`:
```python
class CSVHeaderResponse(BaseModel):
    headers: List[str]
    sample_data: List[Dict[str, str]]
    total_rows: int
```

- [ ] **Step 2: Implement `/import/csv-headers` endpoint**
```python
@router.post("/import/csv-headers", response_model=CSVHeaderResponse)
async def get_csv_headers(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(400, "File must be a CSV")
    
    # Limit file size (5MB)
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 5MB)")
    
    import csv
    import io
    
    try:
        text_content = content.decode('utf-8-sig') # Handle BOM
        stream = io.StringIO(text_content)
        reader = csv.DictReader(stream)
        
        headers = reader.fieldnames or []
        sample_data = []
        row_count = 0
        
        for row in reader:
            if row_count < 3:
                sample_data.append({k: sanitize_csv_cell(v) for k, v in row.items()})
            row_count += 1
            if row_count >= 5000: break # Hard limit
            
        return {
            "headers": headers,
            "sample_data": sample_data,
            "total_rows": row_count
        }
    except Exception as e:
        raise HTTPException(400, f"Failed to parse CSV: {str(e)}")
```

---

### Task 3: Intelligent Parsing Utilities

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`

- [ ] **Step 1: Implement Depth and Date Parsers**
```python
def parse_csv_depth(value: str) -> Optional[float]:
    if not value: return None
    # Handle "25.5 m (84 ft)" or "100 ft"
    try:
        val_clean = value.lower().replace(',', '.')
        numeric_match = re.search(r'(\d+\.?\d*)', val_clean)
        if not numeric_match: return None
        num = float(numeric_match.group(1))
        
        if 'ft' in val_clean and 'm' not in val_clean.split('ft')[0]:
            return round(num * 0.3048, 2)
        return num
    except: return None

def parse_csv_date_time(value: str) -> tuple[Optional[date], Optional[time]]:
    if not value: return None, None
    from dateutil import parser
    try:
        # Try formats like "06. Dec 2025 20:27"
        dt = parser.parse(value, dayfirst=True)
        return dt.date(), dt.time()
    except: return None, None
```

- [ ] **Step 2: Implement Entity Resolution (Buddy/Center)**
```python
def resolve_entity(db, value: str):
    if not value: return None, None
    from app.models import DivingCenter, User
    
    # Try Diving Center first (Exact then Fuzzy)
    center = db.query(DivingCenter).filter(DivingCenter.name.ilike(value)).first()
    if center: return center.id, "center"
    
    # Try User match
    user = db.query(User).filter(User.username.ilike(value)).first()
    if user: return user.id, "buddy"
    
    return None, None
```

---

### Task 4: Dynamic CSV Processing Endpoint

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`

- [ ] **Step 1: Implement flexible processing logic**
Update `confirm_import_dives` or create a new `process_csv_data` endpoint that accepts a mapping.
```python
@router.post("/import/process-csv")
async def process_csv_import(
    file: UploadFile = File(...),
    mapping: str = Form(...), # JSON string of {csv_col: divemap_field}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    field_map = orjson.loads(mapping)
    # ... read CSV again (ensure limits) ...
    parsed_dives = []
    for row in reader:
        dive_data = {
            "is_private": False,
            "dive_information": ""
        }
        unmapped_info = []
        
        for csv_col, val in row.items():
            field = field_map.get(csv_col)
            val = sanitize_csv_cell(val)
            
            if field == "max_depth": dive_data["max_depth"] = parse_csv_depth(val)
            elif field == "dive_date": 
                d, t = parse_csv_date_time(val)
                dive_data["dive_date"] = d.strftime("%Y-%m-%d") if d else None
                dive_data["dive_time"] = t.strftime("%H:%M:%S") if t else None
            elif field == "dive_site_name":
                # Use existing find_dive_site_by_import_id
                match = find_dive_site_by_import_id(val, db, val)
                dive_data["dive_site_id"] = match["id"] if match else None
                dive_data["proposed_sites"] = match.get("proposed_sites") if match else None
                if not match: dive_data["unmatched_dive_site"] = {"name": val}
            elif field == "mixed_entity":
                eid, etype = resolve_entity(db, val)
                if etype == "center": dive_data["diving_center_id"] = eid
                elif etype == "buddy": dive_data["buddies"] = [eid]
                else: unmapped_info.append(f"Buddy/Center: {val}")
            elif field == "notes": dive_data["dive_information"] += f"{val}\n"
            else: unmapped_info.append(f"{csv_col}: {val}")
            
        if unmapped_info:
            dive_data["dive_information"] += "\nImported Details:\n" + "\n".join(unmapped_info)
            
        parsed_dives.append(dive_data)
        
    return {"dives": parsed_dives, "available_dive_sites": ...}
```

---

### Task 5: Frontend Integration

**Files:**
- Modify: `frontend/src/services/dives.js`
- Modify: `frontend/src/components/ImportDivesModal.jsx`

- [ ] **Step 1: Add API services**
```javascript
export const getCSVHeaders = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/v1/dives/import/csv-headers', formData);
  return response.data;
};

export const processCSVImport = async ({ file, mapping }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  const response = await api.post('/api/v1/dives/import/process-csv', formData);
  return response.data;
};
```

- [ ] **Step 2: Add Mapping UI to `ImportDivesModal`**
Introduce a new `currentStep === 'mapping'` state. Render a table with selects for each detected header.
Pre-populate with fuzzy header matches (e.g., "Depth" -> `max_depth`).

- [ ] **Step 3: Implement Mapping Persistence**
Save the final `mapping` object to `localStorage` keyed by a hash of the CSV headers.
On file upload, check `localStorage` for a matching header signature and pre-fill the mapping UI.

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Test with SSI CSV**
Verify `divessi.csv` parses correctly.
Verify "AQUALIZED DIVE ADVENTURES IKE" resolves to a Diving Center if it exists in DB.

- [ ] **Step 2: Verify Formula Injection protection**
Upload a CSV with `=1+1` in a cell. Verify it appears as `'=1+1` in the database notes.
