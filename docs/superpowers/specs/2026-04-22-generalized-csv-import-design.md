# Design Spec: Generalized CSV Import Engine

## Objective
Implement a resilient, user-configurable CSV import system for Divemap. While initially targeted at SSI exports, the system is designed to handle any CSV log format through dynamic field mapping and intelligent entity resolution.

## User Workflow
1. **Upload**: User selects a `.csv` file in the `ImportDivesModal`.
2. **Map Fields**: System proposes mappings based on header similarity. User confirms or adjusts which CSV column maps to which Divemap field (Max Depth, Date, Buddy, etc.).
3. **Review**: System parses the CSV and presents a list of dives. Users verify fuzzy matches for Dive Sites and Diving Centers.
4. **Finalize**: Dives are saved to the database.

## Technical Components

### 1. Backend: Flexible Parsing & Matching (`backend/app/routers/dives/dives_import.py`)
- **Header Detection**: Peek at headers and sample data to propose mappings.
- **Entity Resolution (Intelligent Splitter)**:
    - Primary: Match against `DivingCenter` (name/aliases).
    - Secondary: Match against `User` (username).
    - Fallback: Store as plain text in `dive_information`.
- **Unit Conversion**: Automatic detection and conversion of `m` and `ft` for depths.
- **Robust Date Parsing**: Sequential attempt of multiple formats:
    - `%d. %b %Y %H:%M` (SSI format: 06. Dec 2025 20:27)
    - `%Y-%m-%d %H:%M:%S`
    - `%d/%m/%Y %H:%M`
    - ISO 8601 fallbacks.

### 2. Frontend: Mapping UI (`frontend/src/components/ImportDivesModal.jsx`)
- **Mapping Table**: 
    - Columns: CSV Header | Sample Value | Divemap Field (Dropdown).
    - "Ignore" and "Append to Notes" options for unmapped columns.
- **State Management**: Track `field_mapping` object and pass it to the processing endpoint.
- **Memory**: Save mapping configurations to `localStorage` keyed by the sorted header string to provide "Smart Defaults" on repeat uploads.

### 3. Security & Constraints
- **Sanitization**: All text inputs are cleaned via `nh3` to prevent XSS.
- **CSV Injection Protection**: Strip/Escape leading symbols (`=`, `+`, `-`, `@`) to prevent malicious formula execution in spreadsheet software.
- **Resource Limits**:
    - Max File Size: 5 MB (safely handles 5,000+ dives).
    - Max Row Count: 5,000 dives per import.
    - Max Cell Length: 2,000 characters.

## Success Criteria
- Successfully import the provided `divessi.csv` with accurate site matching.
- Correctly parse depths from "25.5 m (84 ft)" into "25.5".
- Correctly split/match "AQUALIZED DIVE ADVENTURES IKE" as a Diving Center.
- Allow importing a hypothetical CSV with different headers (e.g., "SiteLocation" instead of "Dive Site").

## Security & Performance
- Standard CSRF and Auth protections via existing FastAPI dependency injection.
- Use `orjson` for high-performance processing of large CSV datasets.
