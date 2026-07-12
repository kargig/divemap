# Design Specification: Advanced Dive Style & Gas Mix Heatmap Analytics

**Date:** June 25, 2026
**Status:** Approved Design (Approach 1)
**Author:** Gemini CLI Agent
**Location:** `docs/superpowers/specs/2026-06-25-dive-style-gas-analytics-design.md`

---

## 1. Executive Summary

Divemap provides a comprehensive suite of advanced dive analytics. To elevate the platform's utility for both recreational and technical divers, we are introducing two new key metrics to the advanced user analytics page:
1. **Dive Style Radar Chart:** Maps logged dive tags to eight balanced ecological, interest, and skill dimensions (*Reef & Eco*, *Wreck & History*, *Deep & Technical*, *Drift & Wall*, *Cave & Overhead*, *Night & Shadow*, *Photography*, and *Training*) derived from the 16 seeded database tags. It also identifies the user's primary "Diver Persona" (archetypes).
2. **Gas Mix vs. Maximum Depth Heatmap:** Visualizes gas usage frequencies across standard depth bands, featuring an intelligent safety indicator that highlights cells exceeding a gas's safe Maximum Operating Depth (MOD).

These visual enhancements will be implemented using Approach 1 (Integrated Component Strategy), maintaining strict visual consistency with the existing design system.

---

## 2. Goals & Non-Goals

### Goals
- Fully automate tag aggregation on the backend and categorize them into 8 thematic diving style axes.
- Auto-extract structured and text-fallback gas mixes from dive logs to match against depth bands.
- Provide a responsive, beautiful, interactive 8-axis (octagonal) radar visualization using the pre-installed Recharts library.
- Build a visually cohesive Gas Mix Heatmap following the Tailwind-based styling of the existing Depth Density Heatmap.
- Ensure type-safety, robust error-handling, and backwards compatibility for logs lacking gas details.

### Non-Goals
- We are not altering the underlying database schema; all analytics are calculated dynamically on the read path.
- We are not implementing real-time continuous decompression planning calculators.

---

## 3. System Architecture

All computations are integrated directly into the existing user analytics lifecycle:

```
[React Browser /analytics]
       │
       ▼ (GET request)
[FastAPI: /api/users/{username}/analytics]
       │
       ├─► Queries user's non-private Dives
       ├─► Calculates standard analytics (SAC, yearly, depths)
       ├─► [NEW] Aggregates dive tag style dimensions (8-axis octagon)
       └─► [NEW] Parses gas bottles JSON and maps to depth bands
       │
       ▼ (AdvancedAnalyticsResponse JSON payload)
[React Components]
       ├─► DepthDensityHeatmap
       ├─► [NEW] DiveStyleRadar (Recharts RadarChart)
       ├─► [NEW] GasMixHeatmap (Tailwind Grid Matrix with MOD safety flags)
       └─► AdvancedAnalytics (Scatter, Area, Bar charts)
```

---

## 4. Detailed Design & Implementation Plan

### 4.1 Backend Data Aggregation

We will update the `/api/users/{username}/analytics` endpoint in `backend/app/routers/users.py`:

#### 1. Dive Style Radar Aggregation Algorithm (8-Axis Octagon)
We map the 16 seeded database tags to eight core dimensions:
- **Reef & Eco:** `Reef`, `Marine Life`, `Shallow`
- **Wreck & History:** `Wreck`
- **Deep & Technical:** `Deep`, `Deco`, `Tech`
- **Drift & Wall:** `Drift`, `Wall`
- **Cave & Overhead:** `Cave`, `Cavern`
- **Night & Shadow:** `Night Dive`
- **Photography:** `Photography`
- **Training:** `Training`

For each matching dive tag, we increment the category count. The response will be a normalized list of objects:
`[{"subject": "Reef & Eco", "value": X, "fullMark": Y}, ...]`

*Note on Logistics:* `Boat Dive` and `Shore Dive` are popular entries but relate to logistics rather than core interest styles. We will return them as a percentage ratio (`boat_dive_pct` and `shore_dive_pct`) to render a neat logistics text badge.

#### 2. Gas Mix vs. Max Depth Heatmap Algorithm
For each logged dive, we categorize the **Gas Mix** and **Max Depth**:
- **Gas Mix Categories:**
  - `Air` (O2 <= 21%, He = 0)
  - `Nitrox 28` (O2 matches 28%, He = 0)
  - `Nitrox 32` (O2 matches 32%, He = 0)
  - `Nitrox 36` (O2 matches 36%, He = 0)
  - `Nitrox (Other)` (21% < O2 <= 50%, O2 != 28, 32, 36, He = 0)
  - `Trimix` (He > 0)
  - `Deco Gas` (O2 > 50%, He = 0)
- **Depth Bands:**
  - `0-18m`
  - `18-30m`
  - `30-40m`
  - `40-50m`
  - `50m+`

We count occurrence frequencies of all combinations.

---

### 4.2 API Contract & Schema Changes

We add the new schemas to `backend/app/schemas/__init__.py`:

```python
class AdvancedAnalyticsResponse(BaseModel):
    # ... existing fields
    dive_style_radar: List[Dict[str, Any]] = []  # [{"subject": "Reef & Eco", "value": X, "fullMark": Y}]
    boat_dive_pct: Optional[float] = 0.0
    shore_dive_pct: Optional[float] = 0.0
    gas_mix_heatmap: List[Dict[str, Any]] = []   # [{"mix": "Nitrox 32", "depth_bin": "18-30m", "count": 42}]
```

---

### 4.3 Frontend Design & UI Integration

We will build and style these visuals to be identical in theme, spacing, and interactivity to the existing charts:

#### 1. `DiveStyleRadar` Component (`frontend/src/components/DiveStyleRadar.jsx`)
- Rendered right below the Depth Heatmap.
- Uses Recharts `<RadarChart>` wrapped in `<ResponsiveContainer>`.
- Palette matches the brand blue:
  - Fill: `rgba(37, 99, 235, 0.3)`
  - Stroke: `#2563eb` (primary blue brand)
  - Dots: `#1d4ed8`
  - PolarGrid stroke: `#e2e8f0`

#### 2. `GasMixHeatmap` Component (`frontend/src/components/GasMixHeatmap.jsx`)
- Styled identically to `DepthDensityHeatmap.jsx` to maintain a cohesive matrix-heatmap theme.
- Displays a clean visual grid of **Gas Mixes (Y-axis)** vs. **Max Depth Buckets (X-axis)**.
- **Maximum Operating Depth (MOD) Warning Logic:**
  - If breathing gas is Nitrox with high O2 fraction, a partial pressure of oxygen ($PO_2$) limit of **1.4 bar** is standard for active diving, and **1.6 bar** for decompression.
  - If a cell's pairing represents a depth exceeding the gas's MOD at $PO_2 = 1.4$ bar:
    - Nitrox 32 MOD = 33.7m (depth bucket `30-40m` or deeper)
    - Nitrox 36 MOD = 28.8m (depth bucket `18-30m` or deeper)
  - We flag these cells with a subtle, warning-red border and a `⚠️ MOD` label, teaching divers about oxygen toxicity safety in their profile!

---

## 5. Verification & Testing Strategy

### Backend Unit Tests
- Create test cases in `backend/tests/test_analytics.py` (running under isolated docker container protecting the live database).
- Verify mock dives with various tags return correct radar Subject frequencies.
- Verify dives with structured `gas_bottles_used` map exactly to Nitrox and Trimix bins.
- Verify backward compatibility (empty fields return valid empty/default lists).

### Frontend Verification Standards
- Build and run Vite compilation without warning flags.
- Open the `/users/MMaresca/analytics` page inside the headless browser MCP tool.
- Check and ensure **Zero Console Errors** are outputted under `list_console_messages`.
- Verify responsive viewports (Desktop/Mobile) scale charts and prevent any horizontal scrolling.

---

## 6. Security & Privacy Review
- All parsed fields are retrieved strictly from public non-private dives.
- Any private dives are filtered out at the SQL database layer to respect user privacy controls.
