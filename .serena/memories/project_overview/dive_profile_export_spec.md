# Dive Profile Export Specification & Plan (Updated with Subsurface Schema)

## 1. Specification

### 1.1 Objective
Enable users to export dive profiles in standard formats compatible with popular dive log software and devices:
- **Subsurface XML** (`.xml`)
- **Garmin FIT** (`.fit`)
- **Suunto JSON** (`.json`)

### 1.2 Data Structures & Schemas

#### A. Subsurface XML
A standard XML format widely used by open-source dive loggers. Based on Subsurface `core/save-xml.cpp`:
- **Root**: `<divelog program="divemap" version="3">` (Version 3 is the current standard)
- **`<divesites>`**: (Optional, but good to have)
  - `<site uuid="..." name="..." gps="lat, lon" description="..." />`
- **`<dives>`**: Contains `<dive>` elements.
  - **`<dive>` Attributes**: `number`, `date` (YYYY-MM-DD), `time` (HH:MM:SS), `duration` ("X:XX min"), `tags` (comma separated), `divesiteid` (uuid linking to divesites).
  - **`<dive>` Children**:
    - `<buddy>`, `<suit>`, `<notes>`, `<divemaster>`: Text elements.
    - `<cylinder size="X l" workpressure="X bar" description="..." o2="X%" start="X bar" end="X bar" />`
    - `<weightsystem weight="X kg" description="..." />`
    - **`<divecomputer model="..." deviceid="...">`**:
      - `<depth max="X.X m" mean="X.X m" />`
      - `<temperature air="X.X C" water="X.X C" />`
      - `<event time="X:XX min" name="..." type="..." value="..." />`
      - **`<sample>`**: Time-series data points.
        - Attributes: `time` ("X:XX min"), `depth` ("X.X m").
        - Optional Attributes: `temp` ("X.X C"), `ndl`, `tts`, `stoptime`, `stopdepth`, `po2`, `cns`.

#### B. Garmin FIT (.fit)
A binary format used by Garmin (e.g., Descent series). Writing this requires the `garmin-fit-sdk` python library.
- **file_id message**: Required header indicating Activity (type 4), Manufacturer (1 for Garmin).
- **dive_settings message** (258): Global configuration (water type, GF, etc.).
- **dive_summary message** (268): Post-dive summary (avg/max depth in mm).
- **session message**: Overall time, max depth, etc.
- **record message** (0x14): Time-series data points containing:
  - `timestamp`: UTC datetime.
  - `depth`: Depth in millimeters.
  - `temperature`: Temperature in Celsius.

#### C. Suunto JSON
A structured JSON format used internally by the Suunto App and exportable via tools like SuuntoLink.
- **Header**: `{"activityId": "...", "startTime": "UTC ISO", "duration": seconds, "device": {...}}`
- **Summary**: `{"maxDepth": meters, "avgDepth": meters, "minTemperature": C}`
- **Samples**: Array of objects `[{"time": seconds_offset, "depth": meters, "temperature": C}]`

### 1.3 Components to Add
- `backend/requirements.txt`: Add `garmin-fit-sdk`.
- `backend/app/services/dive_export_service.py`: Contains formatting logic for the three schemas.
- `backend/app/routers/dives/dives_profiles.py`: New `GET /{dive_id}/export/{format}` endpoint.

---

## 2. Implementation Plan

### Phase 1: Backend Infrastructure
1. Update `requirements.txt` to include `garmin-fit-sdk`.
2. Create `DiveExportService` class.

### Phase 2: Implement Exporters
1. **`export_to_subsurface`**: Generate XML string mapping `profile_data['samples']` to `<sample>` tags.
2. **`export_to_fit`**: Use `garmin_fit_sdk.Encoder` to write `file_id`, `dive_summary`, `session`, and iterate samples to write `record` messages converting depth to mm.
3. **`export_to_suunto_json`**: Construct and serialize the Suunto JSON dict structure using `orjson`.

### Phase 3: Router Integration
1. Add endpoint `@router.get("/{dive_id}/export/{format}")`.
2. Check `current_user` vs `dive.user_id` / `dive.is_private`.
3. Fetch raw profile, parse via `DiveProfileParser`.
4. Call `DiveExportService` and return `Response` with `Content-Disposition: attachment`.

### Phase 4: Frontend Integration
1. Add an "Export" dropdown to the Dive Details view.
2. Add links targeting the backend endpoint.