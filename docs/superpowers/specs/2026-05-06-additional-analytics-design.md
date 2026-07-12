# Design Spec: Advanced Dive Analytics Charts

**Date:** 2026-05-06
**Status:** Draft
**Topic:** Implementation of three new advanced analytics charts for public user profiles: SAC vs. Depth, Duration vs. Depth, and Temperature vs. Suit.

## 1. Overview
Adding three new visualizations to the User Profile "Diving Statistics" section to provide deeper insights into a diver's habits, gas consumption efficiency, and thermal protection choices.

## 2. Requirements & Visualization Strategy

### 2.1 Air Consumption (SAC Rate) vs. Depth Trend
- **Type:** Scatter Plot (using Recharts).
- **X-Axis:** Maximum Depth (Meters).
- **Y-Axis:** SAC Rate (L/min).
- **Data Source:** Extracted from `dive_information` ("SAC: X.X l/min"). If structured `gas_bottles_used` exists, attempt to calculate the "Real SAC" using `app.physics.calculate_sac` for higher accuracy.

### 2.2 Depth Distribution vs. Dive Duration
- **Type:** Bubble Chart (using Recharts ScatterChart with Z-axis for size).
- **X-Axis:** Duration (Minutes).
- **Y-Axis:** Maximum Depth (Meters).
- **Z-Axis (Size):** Number of dives matching that specific Depth/Duration intersection (rounded to nearest 5m/5min to create meaningful clusters).

### 2.3 Temperature vs. Exposure Suit
- **Type:** Grouped Bar Chart or Categorical Scatter Plot (using Recharts).
- **X-Axis:** Suit Type (e.g., Wetsuit, Drysuit).
- **Y-Axis:** Water Temperature (°C).
- **Data Source:** Temperature extracted via regex from `dive_information` ("Water Temp: X.X C"). Suit Type directly from the `Dive.suit_type` column.
- *Note:* Since "Comfort Rating" does not exist in the schema, this will map observed temperatures to the suits worn.

## 3. Architecture & Implementation

### 3.1 Backend Data Pipeline (`backend/app/routers/users.py`)
- **Schema Update:** Update `DivingStatsResponse` to include three new lists of dictionaries representing the chart data points.
- **Extraction Logic:** Inside `get_user_public_profile`, iterate through the user's public dives.
    - Use `re.search` to parse `Water Temp` and `SAC` from `Dive.dive_information`.
    - Group the Data for the Bubble chart.
- **Performance:** Avoid N+1 queries; do all regex parsing in Python memory using the already fetched `Dive` records.

### 3.2 Frontend (`frontend/src/components/AdvancedAnalytics.jsx`)
- Create a new component file to house all three Recharts visualizations to keep `UserProfile.jsx` clean.
- Use `recharts` library (`ScatterChart`, `Scatter`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`).
- Ensure charts are responsive using `ResponsiveContainer`.
- Use the `Divemap Blue` and related neutral colors for styling.

## 4. Testing & Validation
- **Unit Tests:** Verify the regex extraction logic works against varying string formats (e.g., missing spaces).
- **Visual Verification:** Check responsiveness on mobile viewports using MCP tools.