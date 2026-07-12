# Shearwater Database Import Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new import connector for the Divemap backend that allows users to upload a Shearwater Cloud SQLite database (`.db`) file and import their dive logs, complete with metadata (location, site, notes, buddy) and high-resolution depth/temperature profile samples.

**Architecture:** We will implement an SQLite database parser in a new module `backend/app/routers/dives/imports/shearwater.py` that queries the `dive_details` and `log_data` tables. The parser will decompress the `data_bytes_1` binary blobs (Petrel Native Format `sw-pnf`) using Python's standard `gzip` and unpack the 32-byte records using `struct` to extract detailed sample time-series data. It will then apply coordinate-based site resolution and duplicate detection before returning standard JSON matching `GarminFITResponse`.

**Tech Stack:** FastAPI, SQLite3 (Python standard library), Gzip, Struct, SQLAlchemy, Pydantic, Orjson.

## Global Constraints
- Use the virtual environment at `backend/divemap_venv` for all backend development.
- NEVER stage or commit changes unless explicitly instructed.
- All testing MUST be run using `./docker-test-github-actions.sh` inside the `backend/` directory to prevent database loss.
- No database migrations are required as we are populating existing models.

---

### Task 1: Create the Shearwater Import Parser and Endpoint

**Files:**
- Create: `backend/app/routers/dives/imports/shearwater.py`
- Modify: `backend/app/routers/dives/imports/__init__.py`

**Interfaces:**
- Consumes: None (accepts an uploaded `.db` file in a POST request)
- Produces: `import_shearwater_db` POST endpoint under `/import/shearwater-db` returning `GarminFITResponse`

- [ ] **Step 1: Write the parser and endpoint code**

We will create the file `backend/app/routers/dives/imports/shearwater.py` containing the 32-byte PNF record parsing logic, the SQLite extractor, and the FastAPI endpoint.

```python
import sqlite3
import gzip
import struct
import json
import logging
import tempfile
import os
from pathlib import Path
from fastapi import Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Tuple

from ..dives_shared import router, get_db, get_current_user, User, Dive
from app.schemas import GarminFITResponse
from app.models import DiveSite, DivingCenter
from .common import find_existing_dive, find_sites_by_coords
from .gas_utils import create_structured_gas_data

logger = logging.getLogger(__name__)

BLOCK_SIZE = 32
SAMPLE_INTERVAL_SEC = 10

# Bit flags in the per-sample status byte (block[12])
STATUS_GASSWITCH     = 0x01
STATUS_PPO2_EXTERNAL = 0x02
STATUS_SETPOINT_HIGH = 0x04
STATUS_SC            = 0x08
STATUS_OC            = 0x10

_DIVE_MODE_LABELS = [
    "CC / BO",          # 0  M_CC
    "OC Technical",     # 1  M_OC_TEC
    "Gauge",            # 2  M_GAUGE
    "PPO2 Display",     # 3  M_PPO2
    "SC / BO",          # 4  M_SC
    "CC / BO 2",        # 5  M_CC2
    "OC Rec",           # 6  M_OC_REC
    "Freedive",         # 7  M_FREEDIVE
]

def decompress_sw_pnf(blob: bytes) -> Optional[bytes]:
    if len(blob) < 8:
        return None
    try:
        # Strip 4-byte LE size prefix and gunzip
        return gzip.decompress(blob[4:])
    except Exception as e:
        logger.error(f"Failed to decompress Shearwater PNF blob: {e}")
        return None

def parse_pnf_samples(decompressed_data: bytes) -> List[Dict[str, Any]]:
    samples = []
    sample_index = 0
    
    for i in range(0, len(decompressed_data), BLOCK_SIZE):
        block = decompressed_data[i:i+BLOCK_SIZE]
        if len(block) != BLOCK_SIZE:
            break
        tag = block[0]
        if tag == 0x01:
            # Parse scuba sample
            time_sec = sample_index * SAMPLE_INTERVAL_SEC
            depth_be = struct.unpack_from(">H", block, 1)[0]
            first_stop_m = block[4]
            tts = block[6]
            ppo2_cg = block[8]
            o2_pct = block[9]
            he_pct = block[10]
            ndl_or_fs = block[7]
            water_temp = struct.unpack_from("b", block, 14)[0]
            status_byte = block[12]
            cns_cg = block[23]
            
            # Form standard sample structure
            samples.append({
                "time_minutes": round(time_sec / 60.0, 3),
                "depth": round(depth_be / 10.0, 2),
                "temperature": float(water_temp),
                "ndl_minutes": float(ndl_or_fs) if first_stop_m == 0 else 0.0,
                "stopdepth": float(first_stop_m) if first_stop_m > 0 else None,
                "in_deco": first_stop_m > 0,
                "tts_minutes": float(tts),
                "cns_percent": round(cns_cg, 1),
                "fraction_o2": o2_pct / 100.0,
                "fraction_he": he_pct / 100.0
            })
            sample_index += 1
            
    return samples

def parse_shearwater_sqlite(db_path: str) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if necessary tables exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dive_details'")
    if not cursor.fetchone():
        conn.close()
        raise ValueError("Database missing 'dive_details' table")
        
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='log_data'")
    if not cursor.fetchone():
        conn.close()
        raise ValueError("Database missing 'log_data' table")
        
    query = """
        SELECT 
            d.DiveId, d.DiveDate, d.Depth, d.DiveLengthTime, d.Location, d.Site, d.Buddy, d.Notes,
            l.data_bytes_1, l.calculated_values_from_samples, l.data_bytes_3
        FROM dive_details AS d
        LEFT JOIN log_data AS l ON d.DiveId = l.log_id
        ORDER BY d.DiveDate ASC
    """
    
    rows = cursor.execute(query).fetchall()
    parsed_dives = []
    
    for row in rows:
        dive_id = row['DiveId']
        dive_date_raw = row['DiveDate']
        max_depth = float(row['Depth']) if row['Depth'] else 0.0
        duration_sec = int(row['DiveLengthTime']) if row['DiveLengthTime'] else 0
        location = row['Location'] or ""
        site = row['Site'] or ""
        buddy = row['Buddy'] or ""
        notes = row['Notes'] or ""
        
        # Parse start date & time from raw timestamp/string
        # Shearwater uses formats like "2021-10-10 11:57:21"
        dive_date = ""
        dive_time = ""
        if dive_date_raw:
            try:
                dt = datetime.strptime(dive_date_raw, "%Y-%m-%d %H:%M:%S")
                dive_date = dt.date().isoformat()
                dive_time = dt.strftime("%H:%M:%S")
            except Exception:
                try:
                    dt = datetime.strptime(dive_date_raw, "%Y-%m-%d %H-%M-%S")
                    dive_date = dt.date().isoformat()
                    dive_time = dt.strftime("%H:%M:%S")
                except Exception:
                    pass
                    
        # Fallback to timestamps from metadata in data_bytes_3
        b3_data = {}
        if row['data_bytes_3']:
            try:
                b3_data = json.loads(row['data_bytes_3'].decode('utf-8'))
            except Exception:
                pass
                
        if not dive_date and b3_data.get('StartTime'):
            try:
                dt = datetime.utcfromtimestamp(b3_data['StartTime'])
                dive_date = dt.date().isoformat()
                dive_time = dt.strftime("%H:%M:%S")
            except Exception:
                pass
                
        # Parse calculated summary values (temps, average depth)
        avg_depth = 0.0
        min_temp = None
        max_temp = None
        if row['calculated_values_from_samples']:
            try:
                calc_val = json.loads(row['calculated_values_from_samples'])
                avg_depth = calc_val.get('AverageDepth', 0.0)
                min_temp = calc_val.get('MinTemp')
                max_temp = calc_val.get('MaxTemp')
            except Exception:
                pass
                
        # Parse PNF binary samples
        samples = []
        if row['data_bytes_1']:
            decompressed = decompress_sw_pnf(row['data_bytes_1'])
            if decompressed:
                samples = parse_pnf_samples(decompressed)
                
        # Parse Cylinders / GasMixes
        # By default, extract first cylinder O2/He from samples or fallback to 21% air
        o2_percent = 21
        he_percent = 0
        cylinders = []
        
        # Parse cylinders from TankProfileData if available
        # It has a standard layout with GasProfiles and TankData
        # We can reconstruct cylinder sizes and gas compositions from it
        # We parse the first gas mix as primary
        try:
            cursor.execute("SELECT TankProfileData FROM dive_details WHERE DiveId = ?", (dive_id,))
            tprofile = cursor.fetchone()
            if tprofile and tprofile[0]:
                tp_data = json.loads(tprofile[0])
                gas_p = tp_data.get("GasProfiles", [])
                if gas_p:
                    o2_percent = gas_p[0].get("O2Percent", 21)
                    he_percent = gas_p[0].get("HePercent", 0)
                
                # Check for tanks
                tanks = tp_data.get("TankData", [])
                for i, t in enumerate(tanks):
                    g = t.get("GasProfile", {})
                    cylinders.append({
                        "size": 12.0, # default to standard 12L cylinder
                        "o2": g.get("O2Percent", 21),
                        "he": g.get("HePercent", 0),
                        "start": None,
                        "end": None,
                        "index": i
                    })
        except Exception:
            pass
            
        if not cylinders:
            cylinders.append({
                "size": 12.0,
                "o2": o2_percent,
                "he": he_percent,
                "start": None,
                "end": None,
                "index": 0
            })
            
        gas_bottles_used = create_structured_gas_data(cylinders)
        
        # Build dive info text description
        info_parts = []
        info_parts.append(f"Source: Shearwater Database")
        if avg_depth:
            info_parts.append(f"Avg Depth: {round(avg_depth, 2)} m")
        if min_temp:
            info_parts.append(f"Water Temp: {min_temp} C")
        info_parts.append(f"Max Depth: {round(max_depth, 2)} m")
        
        dive_dict = {
            "dive_date": dive_date,
            "dive_time": dive_time,
            "duration": int(duration_sec // 60) if duration_sec else 0,
            "max_depth": round(max_depth, 2),
            "average_depth": round(avg_depth, 2),
            "location": location,
            "site": site,
            "notes": notes,
            "o2_percent": o2_percent,
            "he_percent": he_percent,
            "cylinders": cylinders,
            "gas_bottles_used": gas_bottles_used,
            "dive_information": "\n".join(info_parts),
            "profile_data": {
                "samples": samples,
                "events": [],
                "cylinders": cylinders,
                "calculated_max_depth": round(max_depth, 2),
                "calculated_avg_depth": round(avg_depth, 2),
                "calculated_duration_minutes": round(duration_sec / 60.0, 1),
                "sample_count": len(samples),
                "temperature_range": {"min": min_temp, "max": max_temp}
            }
        }
        parsed_dives.append(dive_dict)
        
    conn.close()
    return parsed_dives

@router.post("/import/shearwater-db", response_model=GarminFITResponse)
async def import_shearwater_db(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import dives from a Shearwater Cloud SQLite database file.
    """
    if not file.filename.lower().endswith('.db') and not file.filename.lower().endswith('.sqlite'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a SQLite .db or .sqlite database file"
        )
        
    # Save UploadFile to a temporary file
    temp_fd, temp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(temp_fd, 'wb') as tmp:
            tmp.write(await file.read())
            
        # Parse Shearwater DB
        try:
            parsed_dives = parse_shearwater_sqlite(temp_path)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Error parsing Shearwater database: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse Shearwater database: {e}"
            )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    # Pre-fetch list of user dives for duplicate detection and sites/centers
    user_dives = db.query(Dive).filter(Dive.user_id == current_user.id).all()
    all_sites = db.query(DiveSite.id, DiveSite.name, DiveSite.country, DiveSite.region).all()
    all_centers = db.query(DivingCenter).all()
    
    for dive in parsed_dives:
        # Check for duplicates using common utility
        if dive.get("dive_date"):
            existing = find_existing_dive(
                db, current_user.id,
                dive["dive_date"],
                dive.get("dive_time"),
                dive.get("duration"),
                dive.get("max_depth"),
                user_dives=user_dives
            )
            if existing:
                dive["existing_dive_id"] = existing.id
                dive["skip"] = True
                
    # Format and return the standard response
    dive_sites_for_selection = [
        {
            "id": site.id,
            "name": site.name,
            "country": site.country,
            "region": site.region
        }
        for site in all_sites
    ]

    diving_centers_for_selection = [
        {"id": dc.id, "name": dc.name, "country": dc.country}
        for dc in all_centers
    ]
    
    return {
        "message": f"Successfully parsed {len(parsed_dives)} dives from Shearwater database",
        "dives": parsed_dives,
        "available_dive_sites": dive_sites_for_selection,
        "available_diving_centers": diving_centers_for_selection
    }
```

- [ ] **Step 2: Register the new router in `backend/app/routers/dives/imports/__init__.py`**

We will open `backend/app/routers/dives/imports/__init__.py` and import the new module:
```python
from . import shearwater
```

- [ ] **Step 3: Run Alembic schema check to confirm no database conflicts**

Execute Alembic's validation script to make sure schema is in sync:
Run: `cd backend && ./run_alembic_check.sh`
Expected: Return with success, indicating no schema discrepancies.

- [ ] **Step 4: Commit changes**

Commit files representing Task 1.

---

### Task 2: Write Integration Tests and Verify Behavior

**Files:**
- Create: `backend/tests/test_shearwater_import.py`

**Interfaces:**
- Consumes: `import_shearwater_db` FastAPI endpoint, `Shearwater.db` real sample file
- Produces: Verified parsing correctness, duplicate-detection, and site-mapping behaviors.

- [ ] **Step 1: Write integration tests in `backend/tests/test_shearwater_import.py`**

```python
import os
import pytest
from fastapi import status
from app.models import Dive

def test_shearwater_import_success(client, auth_headers, db_session, test_user):
    # Retrieve the path to the real Shearwater.db file in the workspace
    db_path = "/home/kargig/src/divemap/Shearwater.db"
    assert os.path.exists(db_path), f"Sample file not found at {db_path}"
    
    with open(db_path, "rb") as f:
        response = client.post(
            "/api/import/shearwater-db",
            headers=auth_headers,
            files={"file": ("Shearwater.db", f, "application/x-sqlite3")}
        )
        
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "Successfully parsed 259 dives from Shearwater database" in data["message"]
    assert len(data["dives"]) == 259
    
    # Verify the details of the first parsed dive
    first_dive = data["dives"][0]
    assert first_dive["dive_date"] == "2021-10-10"
    assert first_dive["dive_time"] == "11:57:21"
    assert first_dive["duration"] == 67 # 4053s // 60
    assert first_dive["max_depth"] == 28.3
    assert first_dive["average_depth"] == 11.33 # from calculated_values_from_samples
    assert first_dive["location"] == "Attiki"
    assert first_dive["site"] == "Porto Ennea"
    assert len(first_dive["profile_data"]["samples"]) > 0
    
    # First sample validation
    first_sample = first_dive["profile_data"]["samples"][0]
    assert first_sample["time_minutes"] == 0.0
    assert first_sample["depth"] == 0.0 # start at surface
    
    # Ensure second sample matches a depth of 2.7m or similar (non-zero depth as the dive progressed)
    second_sample = first_dive["profile_data"]["samples"][1]
    assert second_sample["time_minutes"] > 0.0

def test_shearwater_import_invalid_file(client, auth_headers):
    # Upload an empty non-db file to trigger validation
    response = client.post(
        "/api/import/shearwater-db",
        headers=auth_headers,
        files={"file": ("invalid.txt", b"invalid data", "text/plain")}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "must be a SQLite" in response.json()["detail"]

def test_shearwater_import_duplicate_detection(client, auth_headers, db_session, test_user):
    # Create an existing dive that matches the first dive in the database
    existing_dive = Dive(
        user_id=test_user.id,
        dive_date="2021-10-10",
        dive_time="11:57:21",
        duration=67,
        max_depth=28.3
    )
    db_session.add(existing_dive)
    db_session.commit()
    
    db_path = "/home/kargig/src/divemap/Shearwater.db"
    with open(db_path, "rb") as f:
        response = client.post(
            "/api/import/shearwater-db",
            headers=auth_headers,
            files={"file": ("Shearwater.db", f, "application/x-sqlite3")}
        )
        
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    first_dive = data["dives"][0]
    
    # Assert duplicate detection marked it as skip and referenced the existing ID
    assert first_dive.get("skip") is True
    assert first_dive.get("existing_dive_id") == existing_dive.id
```

- [ ] **Step 2: Run test suite to verify the new integration tests pass**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_shearwater_import.py`
Expected: All 3 tests pass perfectly.

- [ ] **Step 3: Run frontend linting to make sure there are no frontend issues (if any relevant lines were modified)**

Run: `make lint-frontend` (using our project task runner)
Expected: Success with no relevant linting issues.

- [ ] **Step 4: Commit and complete task**

Commit remaining files and summarize integration work.
