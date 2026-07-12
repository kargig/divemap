# Plan for Dive Profile Exports

## Phase 1: Setup and Service Creation
1. Update `backend/requirements.txt` to include `garmin-fit-sdk`.
2. Create `backend/app/services/dive_export_service.py` to encapsulate export logic.
   - Inject `r2_storage` or let the router fetch the data and pass it to the service.

## Phase 2: Implement Exporters
1. **Subsurface XML Exporter**:
   - Create a method that takes a `Dive` model and a parsed `profile_data` dictionary.
   - Use `xml.etree.ElementTree` to construct a `<divelog>` document.
   - Map samples to `<sample time="X:XX min" depth="X.X m" temp="X.X C" />`.
2. **Garmin FIT Exporter**:
   - Initialize `garmin_fit_sdk.Encoder`.
   - Write `file_id` message.
   - Write `session` message with overall dive stats.
   - Iterate over `profile_data['samples']`, calculate real timestamps based on `Dive.dive_date` and `dive_time`, and write `record` messages with depth and temperature.
3. **Suunto JSON Exporter**:
   - Since Suunto's exact format isn't publicly documented easily, we can use a generic standard JSON representation that Suunto app can import, or if we can't find it, we can output a generic structured JSON (e.g. `{"Device": "...", "Samples": [{"Time": 0, "Depth": 0}]}`). We will need to define a best-effort Suunto/generic JSON schema.

## Phase 3: Router Integration
1. In `backend/app/routers/dives/dives_profiles.py`, add an export endpoint:
   ```python
   @router.get("/{dive_id}/export/{format}", response_class=Response)
   ```
2. Re-use existing access control checks from `get_dive_profile`.
3. Fetch raw profile, parse to dict (if XML).
4. Call `DiveExportService` based on requested format.
5. Return the file bytes with appropriate headers (e.g. `application/x-fit`, `application/xml`).

## Phase 4: Frontend Updates
1. Update the `AdvancedDiveProfileChart.jsx` or the `DiveDetail.jsx` page.
2. Add an "Export Profile" dropdown or button group with options: "Export Subsurface (XML)", "Export Garmin (FIT)", "Export JSON".
3. Trigger file download by navigating to or fetching the new backend endpoint.