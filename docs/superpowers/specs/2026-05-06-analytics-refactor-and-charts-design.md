# Design Spec: Analytics Refactoring and New Charts

**Date:** 2026-05-06
**Status:** Draft
**Topic:** Splitting the heavy analytics processing into a dedicated API endpoint, upgrading the Analytics page UI, and adding three new charts for Gas Configurations and Weight Distributions.

## 1. Overview
The current `get_user_public_profile` endpoint is overloaded, calculating complex Regex and physics math for advanced analytics even when the user is just viewing the basic profile. This spec separates the concerns and introduces new visualizations for technical tracking.

## 2. Architecture & Implementation

### 2.1 Backend Refactoring (`backend/app/routers/users.py`)
- **New Schema:** Create `AdvancedAnalyticsResponse` in `schemas/__init__.py` to house all the advanced charts data (`sac_vs_depth`, `depth_density_heatmap`, etc.). Remove these fields from `DivingStatsResponse`.
- **New Endpoint:** Create `GET /api/v1/users/{username}/analytics`.
    - This endpoint will run the `advanced_query`.
    - It will parse SAC, Water Temp, and the new Weight data via Regex.
    - It will parse Tank data from JSON/Text to categorize gas configurations.
    - It will return the `AdvancedAnalyticsResponse`.
- **Profile Cleanup:** Remove the `advanced_query` and all associated complex processing loops from `get_user_public_profile`.

### 2.2 New Backend Data Parsing
- **Weight Extraction:** Regex `r"Weight[s]?:\s*([0-9.]+)\s*kg"` against `dive_information`.
- **Tank Configuration Parsing:**
    - Parse `gas_bottles_used`. 
    - Identify tank sizes (e.g., 12L, 15L, S80, D12, D7).
    - Identify if it's a twinset (Doubles) or single.
    - Identify if stages are attached (`+ Stage`).
    - Standardize output labels (e.g., "Single 12L", "D12 + Stage").

### 2.3 New Charts (Frontend)
- **Dives per Gas Configuration:**
    - Type: `BarChart`
    - X-Axis: Tank Config Label.
    - Y-Axis: Dive Count.
- **Weight vs Suit Configuration:**
    - Type: `BarChart`
    - X-Axis: Suit Type.
    - Y-Axis: Average Weight in Kg. (We will average the weight per suit to keep the chart clean and actionable).
- **Weight Evolution Over Time (Colored by Suit):**
    - Type: `ScatterChart`
    - X-Axis: Dive Date (Time-series).
    - Y-Axis: Weight in Kg.
    - Points: Colored categorically based on the Suit type worn during that dive.

### 2.4 UI Updates (`UserAnalytics.jsx`)
- Refactor the header to use a large `Avatar` (size `xl`, `w-32 h-32`) and prominent username (`text-3xl`), mirroring the `UserProfile.jsx` layout.
- Fetch data from the new `/api/v1/users/{username}/analytics` endpoint in addition to the basic profile endpoint (or exclusively, if the new endpoint returns enough basic info to populate the header).

## 3. Testing & Validation
- **Backend:** Ensure `get_user_public_profile` still returns the basic profile correctly. Verify the new endpoint returns the correct JSON structure without crashing on malformed regex.
- **Frontend:** Ensure all 9 charts render correctly. Verify the Avatar loads.