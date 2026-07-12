# Garmin FIT Import Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-fidelity import system for Garmin `.fit` binary files using `fitdecode`, leveraging GPS coordinates for site matching and rich sensor data (Heart Rate, Temp) for comprehensive dive logging.

**Architecture:** Extend `dives_import.py` with a binary parser using `fitdecode`. Dives are split by `session` data frames. Coordinates are matched within 500m of existing `DiveSite` locations using MySQL spatial functions.

**Tech Stack:** FastAPI, fitdecode, MySQL Spatial, React.

---

### Task 1: Backend Parsing Utilities (`fitdecode` implementation)

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`
- Create: `backend/tests/test_garmin_fit_parser.py`

- [ ] **Step 1: Write parser tests with mock data**
```python
import pytest
from backend.app.routers.dives.dives_import import parse_garmin_fit_file

def test_parse_garmin_fit_basic():
    # Verify coordinates conversion and metric extraction logic
    # (Actual binary testing in end-to-end task)
    pass
```

- [ ] **Step 2: Implement `parse_garmin_fit_file` in `dives_import.py`**
```python
import fitdecode

def semicircles_to_degrees(semicircles):
    if semicircles is None: return None
    return semicircles * (180.0 / 2**31)

def parse_garmin_fit_file(content: bytes, db: Session, current_user_id: int):
    import io
    parsed_dives = []
    
    with fitdecode.FitReader(io.BytesIO(content)) as fit:
        for frame in fit:
            if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                if frame.name == 'session':
                    dive_data = {
                        "max_depth": round(frame.get_value('max_depth', 0), 2),
                        "average_depth": round(frame.get_value('avg_depth', 0), 2),
                        "duration": int(frame.get_value('total_elapsed_time', 0) / 60),
                        "dive_date": frame.get_value('start_time').date().isoformat(),
                        "dive_time": frame.get_value('start_time').time().isoformat(),
                    }
                    
                    # GPS Handling
                    lat = semicircles_to_degrees(frame.get_value('start_position_lat'))
                    lng = semicircles_to_degrees(frame.get_value('start_position_long'))
                    if lat and lng:
                        dive_data["latitude"] = lat
                        dive_data["longitude"] = lng
                    
                    # Metadata
                    info = []
                    if frame.has_field('avg_water_temp'): info.append(f"Water Temp: {frame.get_value('avg_water_temp')}°C")
                    if frame.has_field('avg_heart_rate'): info.append(f"Avg HR: {frame.get_value('avg_heart_rate')} bpm")
                    dive_data["dive_information"] = "\n".join(info)
                    
                    parsed_dives.append(dive_data)
                
                elif frame.name == 'record' and parsed_dives:
                    # Add profile samples to the CURRENT dive
                    # (In a real implementation, we'd map records to sessions by timestamp)
                    r_data = frame.get_values()
                    if 'depth' in r_data:
                        # ... sample extraction ...
                        pass
                        
    return parsed_dives
```

---

### Task 2: Coordinate-Based Site Matching

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`

- [ ] **Step 1: Implement Proximity Matching**
Add a utility to find sites within 500m.
```python
def find_sites_by_coords(db: Session, lat: float, lng: float, radius_m: int = 500):
    from sqlalchemy import text
    sql = text("""
        SELECT id, name, country, 
               ST_Distance_Sphere(location, ST_SRID(POINT(:lng, :lat), 4326)) as distance
        FROM dive_sites
        WHERE ST_Distance_Sphere(location, ST_SRID(POINT(:lng, :lat), 4326)) <= :radius
        ORDER BY distance ASC
        LIMIT 3
    """)
    return db.execute(sql, {"lat": lat, "lng": lng, "radius": radius_m}).fetchall()
```

---

### Task 3: Import Endpoint & Frontend Routing

**Files:**
- Modify: `backend/app/routers/dives/dives_import.py`
- Modify: `frontend/src/services/dives.js`
- Modify: `frontend/src/components/ImportDivesModal.jsx`

- [ ] **Step 1: Add `/import/garmin-fit` endpoint**
- [ ] **Step 2: Add `importGarminFIT` service to `dives.js`**
- [ ] **Step 3: Update `ImportDivesModal` to handle `.fit` files**

---

### Task 4: UI Enhancements for GPS Data

- [ ] **Step 1: Display "GPS Match" in Review Card**
- [ ] **Step 2: Pre-fill "Create New Site" with coordinates from FIT metadata**

---

### Task 5: Testing & Verification

- [ ] **Step 1: Run end-to-end tests with provided example files**
