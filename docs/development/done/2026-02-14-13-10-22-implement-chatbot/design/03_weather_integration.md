# Weather Integration Strategy

## 1. Objective
To provide "Weather-Aware" dive recommendations. The chatbot should not just find *where* to dive, but *when* and *if* it is safe/enjoyable based on marine conditions.

## 2. Technical Workflow

### 2.1. Intent Extraction
The `SearchIntent` must capture temporal information:
- **Specific Date**: "February 15th" -> `2026-02-15`
- **Relative Date**: "Tomorrow" -> (Current Date + 1)
- **Range**: "This weekend" -> [Saturday, Sunday]

### 2.2. Batch Processing Optimization
**Problem**: Calculating suitability for 50 search results requires 50 wind data points. Sequential API calls to Open-Meteo will be too slow.
**Solution**: `WindRecommendationService` & `OpenMeteoService` enhancement.

**New Method**: `fetch_wind_data_batch(locations: List[Tuple[float, float]], date: datetime)`
1.  **Grid Snap**: Round all coordinates to 0.1° precision.
2.  **Deduplicate**: Group unique grid points (multiple dive sites might share the same 0.1° grid cell).
3.  **Chunking**: If > 50 unique points, break into chunks (Open-Meteo limit).
4.  **Fetch**: Execute API call(s).
5.  **Map Back**: Map the results back to the original dive sites.

### 2.3. Suitability Ranking
For each candidate site:
1.  Get cached/fetched wind data (Speed, Direction, Gusts).
2.  Get site metadata (`shore_direction`).
3.  Calculate `suitability` (Good/Caution/Avoid) using existing logic.
4.  **Sorting Algorithm**:
    - Primary Sort: Suitability (Good > Caution > Unknown > Avoid).
    - Secondary Sort: Rating / Relevance.

### 2.4. Reasoning Injection
The LLM needs to know *why* a site is good.
- **Input to LLM**:
  ```json
  {
    "name": "Blue Hole",
    "suitability": "Good",
    "weather_reasoning": "Wind is 5kt Offshore (Safe). Waves 0.2m.",
    "url": "..."
  }
  ```
- **Generated Output**: "I recommend **Blue Hole** because the offshore winds today create calm conditions suitable for beginners."

## 3. Fallbacks
- **No Date**: Default to "Today" but explicitly state "Based on current conditions...".
- **API Failure**: If Open-Meteo is down, return search results with a disclaimer: "Weather data currently unavailable."
- **No Shore Direction**: Suitability = "Unknown". LLM should say "Please check local conditions as shore orientation is unknown."
