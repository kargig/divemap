# Design Spec: Garmin FIT Import Engine

## Objective
Implement a high-fidelity import system for Garmin `.fit` binary files. This system leverages GPS data and rich sensor metrics (Heart Rate, Temp) to provide a superior import experience compared to text-based formats.

## User Workflow
1. **Upload**: User selects one or more `.fit` files.
2. **Auto-Split**: The system detects multiple dive sessions within a single file and presents them as separate entries.
3. **Coordinate Matching**: 
    - System searches for existing dive sites within a **500m radius**.
    - Nearest 3 sites are proposed to the user.
    - If no site is found, coordinates are pre-filled for easy site creation.
4. **Review**: User verifies depth samples, metrics, and site selection.
5. **Finalize**: Dives and high-resolution profiles are saved.

## Technical Components

### 1. Backend: Binary Parsing (`backend/app/routers/dives/dives_import.py`)
- **Library**: `fitparse` for reading binary activity files.
- **Coordinate Conversion**: Convert semicircles to decimal degrees (`degrees = semicircles * (180 / 2^31)`).
- **Metric Extraction**:
    - `session` level: max/avg depth, duration, temperature, avg heart rate.
    - `record` level: time-series depth and temperature samples for the profile chart.
- **Radius Search**: Use geospatial query (ST_Distance_Sphere) or a bounding box approximation to find sites within 500m.

### 2. Frontend: GPS-Aware Review (`frontend/src/components/ImportDivesModal.jsx`)
- **File Type Detection**: Accept `.fit` and route to `api.post('/import/garmin-fit')`.
- **Enhanced Review Card**: Show "Coordinates Found" badge and distance to matched sites.
- **Creation Shortcut**: "Create New Site" button pre-populates latitude/longitude from the FIT metadata.

### 3. Security & Integrity
- **File Validation**: Verify FIT header signature before parsing.
- **Resource Limits**: 
    - Max 10 FIT files per batch.
    - Sanitization of all extracted string metadata (device names, etc.) via `nh3`.

## Success Criteria
- Successfully split a single FIT file into multiple dive records.
- Correctly identify a dive site within 500m of the GPS start point.
- Parse depth samples into a valid JSON profile for the frontend chart.
- Handle files with missing GPS data gracefully (falling back to manual name search).
