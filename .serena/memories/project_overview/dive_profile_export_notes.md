# Dive Profile Export Formats
The system currently stores raw profiles (either imported JSON or Subsurface XML) in Cloudflare R2 (`profile_xml_path`). Wait, that's not exactly true. `DiveProfileParser` actually parses Subsurface XML into a dictionary representation, but the original XML (or a JSON representation) is still stored in R2.
Wait, let's look at `dives_profiles.py` and `dives_imports`.

Current storage logic:
- `Dive.profile_xml_path` contains the R2 key.
- If it ends in `.json`, it's considered an imported JSON profile.
- If it doesn't, it's considered XML (usually Subsurface).
- The `get_dive_profile` route parses it on the fly and returns a JSON payload representing the profile to the frontend.

Requirements:
- Export dives and profiles in Subsurface XML format.
- Export dives and profiles in Garmin .fit format.
- Export dives and profiles in Suunto JSON format.

Let's research these formats and see what is needed to export.
- Subsurface XML: We have `DiveProfileParser` which reads it, we need something to write it. We can probably use `xml.etree.ElementTree` to construct it, similar to `RouteExportService.export_to_gpx`.
- Garmin .fit: The `.fit` format is binary. We would likely need a library like `fitparse` or `fitbenchmarking`? Actually, `fitparse` is for reading. Writing `.fit` is complex. `fit` library (from ant) might be needed. Wait, python `fit` writing libraries: `fit-tool`, `fitwriter`, etc. I need to investigate if there's a good python library for writing `.fit` files.
- Suunto JSON: It's just a JSON structure. We just need to know the schema.

Data needed to build exports:
The `Dive` model has metadata (depth, time, date, etc.). The profile data (time, depth, temperature) is stored in R2. We need to fetch the profile from R2, merge it with `Dive` metadata, and format it.