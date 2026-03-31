# Point of Interest (POI) Search Implementation Plan (Option A: JSON Querying)

## Overview
This document outlines the plan to implement a search feature allowing users and the AI Assistant to find Dive Routes based on the Points of Interest (POIs) they contain (e.g., finding routes that feature a "Wreck" or "Coral"). 

We will use **Option A (JSON Querying)**, which leverages MySQL 8.0's native JSON functions via SQLAlchemy to search directly within the `route_data` JSON column of the `dive_routes` table. This avoids complex database migrations and schema changes for now, providing a fast time-to-market while still enabling powerful search capabilities.

## 1. Backend API Implementation (`backend/app/routers/dive_routes.py`)

### 1.1 Endpoint Updates
Update the `GET /api/v1/dive-routes/` endpoint to accept new query parameters:
*   `poi_types`: `Optional[List[str]] = Query(None, description="Filter routes containing specific POI marker types (e.g., 'wreck', 'coral')")`
*   `poi_search`: `Optional[str] = Query(None, description="Search for text within POI comments")`

### 1.2 SQLAlchemy JSON Query Logic
Modify the SQLAlchemy `query` inside `list_routes` to filter based on the nested GeoJSON structure. The `route_data` column contains a `FeatureCollection` where POIs are features with `geometry.type == "Point"`.

To find a specific `markerType` (e.g., 'wreck'), we need to check if *any* feature in the `features` array has `properties.markerType` equal to the target string.

**Implementation Strategy:**
Using MySQL's `JSON_CONTAINS` function via SQLAlchemy:
```python
from sqlalchemy import func

if poi_types:
    # We want to find routes where AT LEAST ONE of the requested poi_types exists in the route_data
    # For a given marker_type 'wreck', the JSON fragment to search for inside the features array is:
    # {"properties": {"markerType": "wreck"}}
    
    poi_filters = []
    for marker_type in poi_types:
        search_fragment = f'{{"properties": {{"markerType": "{marker_type}"}}}}'
        # JSON_CONTAINS(target, candidate, path)
        poi_filters.append(func.json_contains(DiveRoute.route_data, search_fragment, '$.features'))
    
    # Use OR to match if the route has ANY of the requested POI types
    query = query.filter(or_(*poi_filters))
```

*Note: If `JSON_CONTAINS` proves difficult with SQLAlchemy dialects, we can use `JSON_SEARCH` or cast the JSON column to string for a fallback `ilike` search (e.g., `DiveRoute.route_data.cast(String).ilike('%"markerType": "wreck"%')`), though native JSON functions are safer and preferred.*

## 2. Frontend UI Implementation

### 2.1 Filter Component Updates
*   **File:** `frontend/src/components/ResponsiveFilterBar.jsx` or the specific search component used in `DiveRoutes.jsx`.
*   **New UI Element:** Add a multi-select dropdown or a group of toggleable chips labeled "Points of Interest" or "Features".
*   **Data Source:** Populate this UI element dynamically using the keys and names from `frontend/src/utils/markerTypes.js` (e.g., `Wreck`, `Cave/Cavern`, `Coral`, `Marine Life`).

### 2.2 API Client & State Management
*   **File:** `frontend/src/pages/DiveRoutes.jsx`
*   **State:** Add `poi_types` to the `filters` state object.
*   **API Call:** Update the query parameters passed to `api.get('/api/v1/dive-routes/')` to include `poi_types=wreck&poi_types=coral` when the user selects those filters.

## 3. User Experience (UX)

### 3.1 How Users Will Search
1.  **Visual Browsing:** When a user navigates to the "Dive Routes" page, they will see a new "Features" filter alongside existing filters like "Route Type" (Scuba/Freedive).
2.  **Selection:** They can open the "Features" dropdown and check the boxes for "Wreck" and "Cave".
3.  **Result Update:** The list of dive routes will immediately refresh to only show routes that contain at least one point marked with the Wreck or Cave icons. The user doesn't need to know the specific name of the wreck; the icon metadata handles the categorization.

## 4. AI Assistant Integration

Making this data accessible to the AI Assistant transforms it into a powerful semantic search engine for diving.

### 4.1 Exposing the Capability
*   **API Spec:** Once the `GET /api/v1/dive-routes/` endpoint supports `poi_types`, the OpenAPI spec (`/docs`) will automatically reflect this. 
*   **Agent Tools:** If the AI Assistant uses a tool to fetch or search dive routes (e.g., a "search_dive_routes" function), this tool's schema must be updated to accept `poi_types` as an array of strings.

### 4.2 How the AI Will Use It
When a user asks the chatbot: *"Can you find me some cool dive routes that have shipwrecks?"*

1.  **Intent Parsing:** The AI processes the natural language ("shipwrecks") and maps it to the internal marker type key (`wreck`).
2.  **Tool Execution:** The AI calls its internal route search tool, passing `poi_types=["wreck"]`.
3.  **Synthesis:** The backend returns the matching routes. The AI then synthesizes a natural language response: *"I found 3 dive routes featuring wrecks. 'Zenobia Explorer' is a highly rated one..."* providing direct links to the routes.

### 4.3 Future Enhancement: Natural Language to POI mapping
To make the AI more robust, we should ensure the AI's system prompt or tool descriptions explicitly list the available `markerType` keys (e.g., `wreck`, `cave`, `coral`, `artifacts`, `hazard`) so it knows exactly what vocabulary the backend expects when constructing its API queries.