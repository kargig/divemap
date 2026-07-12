# GPX / KML Frontend Import Implementation Plan

## Overview
This document outlines the plan for implementing a client-side import feature for GPX and KML files in the Divemap application. This allows users to upload dive routes and Points of Interest (POIs) created in external tools (like GPS trackers or Google Earth) directly into the `RouteCanvas` editor.

By parsing these files entirely in the browser, users can immediately visualize the imported data, modify segment colors/types, fix comments, and adjust markers (e.g., assigning a 'wreck' icon) before saving the finalized route to the backend. This approach ensures zero server overhead, low latency, and an interactive "Preview & Edit" workflow.

## Objectives
1. Allow users to select `.gpx` or `.kml` files from their device.
2. Parse the XML-based content into standard GeoJSON `FeatureCollection` format using `@tmcw/togeojson`.
3. Normalize the resulting GeoJSON data to comply with our backend schema (e.g., stripping 3D/altitude data to ensure strict 2D coordinate arrays).
4. Inject the normalized features directly into the `RouteCanvas` state so they are rendered on the Leaflet map and can be interactively edited.
5. Provide default styling and properties to imported paths and waypoints.

## Tech Stack & Libraries
*   **Library:** `@tmcw/togeojson` (A robust, maintained library for converting GPX and KML to GeoJSON).
*   **Browser APIs:** `FileReader` (to read the file), `DOMParser` (to parse XML string to a DOM object).

## Step-by-Step Implementation

### Phase 1: Dependency Installation
1.  Navigate to `frontend/`.
2.  Install the required parsing library:
    ```bash
    npm install @tmcw/togeojson
    ```

### Phase 2: Create the Import Utility Service
Create a new utility file in `frontend/src/utils/` (e.g., `geoImportUtils.js`). This module will handle file reading, XML parsing, conversion, and normalization.

**Key functions to implement:**
*   `readFileAsText(file)`: Wraps the `FileReader` API in a Promise.
*   `parseGeoFile(file)`:
    *   Determines if the file is GPX or KML based on the extension or MIME type.
    *   Reads the content.
    *   Parses the text to an XML Document using `new DOMParser().parseString(...)`.
    *   Calls either `gpx(xmlDoc)` or `kml(xmlDoc)` from `@tmcw/togeojson`.
*   `normalizeImportedGeoJSON(featureCollection)`:
    *   Iterate over each feature in the collection.
    *   **Coordinate Normalization:** The backend `DiveRouteCreate` schema strictly requires 2D coordinates `[longitude, latitude]`. GPX/KML often include altitude/depth `[longitude, latitude, altitude]`. The utility must strip the third coordinate from `Point`, `LineString`, `Polygon`, etc.
    *   **Property Mapping (Points):** If the feature is a `Point` (representing a waypoint/POI):
        *   Extract `<name>` or `<desc>` properties (often mapped to `feature.properties.name` or `feature.properties.desc` by the converter) and set them as `feature.properties.comment` (our schema).
        *   Set a default `markerType` to `'generic'` or attempt to map known keywords (e.g., if the name contains "wreck", set `markerType: 'wreck'`).
    *   **Property Mapping (LineStrings):** If the feature is a path (`LineString` or `MultiLineString`):
        *   Set default visual properties required by the canvas (e.g., default `color`, `weight`, and `segmentType`).

### Phase 3: Update `RouteCanvas.jsx` UI
Modify the editor toolbar in `frontend/src/components/RouteCanvas.jsx` to include an "Import GPX/KML" button.

*   Add a hidden `<input type="file" accept=".gpx,.kml" />` element.
*   Add a styled button (e.g., "Import File") that triggers the hidden input's click event.
*   Attach an `onChange` handler to process the selected file.

### Phase 4: State Integration in `RouteCanvas`
When a file is selected and successfully parsed by the utility:

1.  Take the normalized GeoJSON features and adapt them to the internal state structure expected by `react-leaflet-draw` and the custom canvas state.
2.  If `RouteCanvas` maintains drawn items as Leaflet layers, use `L.geoJSON(normalizedFeatures)` to create layers and then add them to the `drawnItems` feature group (or equivalent state management).
3.  Ensure that adding these new features triggers the existing `onChange` or update handlers so that the parent component (`CreateDiveRoute` / `EditDiveSite`) registers the new data.
4.  Optionally, call `map.fitBounds(importedLayer.getBounds())` to automatically pan and zoom the map to the newly imported route.
5.  Show a success toast notification (e.g., "Imported X segments and Y points").

### Phase 5: Error Handling
*   Handle invalid files (e.g., unparseable XML, unsupported formats).
*   Handle files with no valid geographic data.
*   Display clear error messages using `react-hot-toast` if the import fails.

## Considerations
*   **Performance:** Importing very large GPX tracks (thousands of points) might slow down the Leaflet canvas. While `RouteCanvas` might not currently implement clustering, users can manually simplify or edit the track. If performance becomes an issue later, we can explore track simplification algorithms (like Douglas-Peucker) during the import normalization step.
*   **Validation:** Since the editing happens entirely client-side, the existing backend validation on the `POST /api/v1/dive-routes` endpoint will naturally catch any lingering structural issues when the user clicks "Save", providing a safe fallback.
