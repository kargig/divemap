# Design Spec: Time-Series Dive Analytics

**Date:** 2026-05-06
**Status:** Draft
**Topic:** Adding three time-series visualizations to the Advanced Analytics page: Dives per Year, SAC over time, and Depth Evolution.

## 1. Overview
Expanding the User Analytics page with longitudinal data to track a diver's progression, frequency, and gas efficiency over their diving career.

## 2. Requirements & Visualization Strategy

### 2.1 Dives Per Year
- **Type:** Bar Chart.
- **X-Axis:** Year (extracted from `dive_date`).
- **Y-Axis:** Total Dive Count.
- **Goal:** Quickly visualize activity peaks and dips across years.

### 2.2 Evolution of SAC Over Time
- **Type:** Line Chart.
- **X-Axis:** Dive Date.
- **Y-Axis:** SAC Rate (L/min).
- **Goal:** Show the trend of gas efficiency as the diver gains experience.

### 2.3 Evolution of Average & Max Depth Over Time
- **Type:** Line Chart (Multi-line).
- **X-Axis:** Dive Date.
- **Y-Axis:** Depth in meters. **Reversed** (0 at the top, increasing depth downwards) to mimic actual underwater profiles.
- **Lines:** 
    - Max Depth (Darker blue).
    - Average Depth (Lighter blue/cyan).
- **Goal:** Show depth progression and the expanding envelope of a diver's experience.

## 3. Architecture & Implementation

### 3.1 Backend Data Pipeline (`backend/app/routers/users.py`)
- **Query Update:** Add `Dive.dive_date` to the existing `advanced_query` in `get_user_public_profile`. Add an `order_by(Dive.dive_date.asc())` to ensure chronological ordering for line charts.
- **Schema Update (`DivingStatsResponse`):** Add:
    - `dives_per_year: List[Dict[str, int]]` (e.g., `[{"year": "2024", "count": 20}]`)
    - `sac_over_time: List[Dict[str, Any]]` (e.g., `[{"date": "2024-05-06", "sac": 12.5}]`)
    - `depth_over_time: List[Dict[str, Any]]` (e.g., `[{"date": "2024-05-06", "max": 30, "avg": 15}]`)
- **Processing Logic:** 
    - Aggregate dive counts by year for `dives_per_year`.
    - Append successful SAC calculations to `sac_over_time` along with the formatted date.
    - Append max and avg depths to `depth_over_time` along with the formatted date.

### 3.2 Frontend (`frontend/src/components/AdvancedAnalytics.jsx`)
- **Updates:** Add three new chart blocks to the `AdvancedAnalytics` component.
- **Libraries:** Use Recharts `LineChart`, `Line`, `BarChart`, `Bar`.
- **Y-Axis Reversal:** Apply `reversed={true}` to the YAxis of the Depth Evolution chart.
- **Date Formatting:** Format the X-axis ticks to avoid clutter if there are many dives (e.g., showing only Month/Year or staggering ticks).

## 4. Testing & Validation
- **Backend:** Verify the test suite passes with the new schema fields and query changes.
- **Frontend:** Verify charts render correctly without console errors and that the depth chart is properly reversed.