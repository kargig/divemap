# Design Spec: Depth Density Heatmap (2D Histogram)

**Date:** 2026-05-06
**Status:** Draft
**Topic:** Implementation of a behavioral analytics heatmap for public user profiles, comparing Maximum Depth against Average Depth.

## 1. Overview
The Depth Density Heatmap is a visualization tool designed to reveal a diver's behavioral patterns, skill consistency, and "Diver Persona" by plotting Maximum Depth against Average Depth across their logged history.

## 2. Requirements

### 2.1 Visualization Strategy
- **X-Axis:** Maximum Depth (Meters)
- **Y-Axis:** Average Depth (Meters)
- **Grid:** A 2D grid of cells where each cell represents a depth range pair.
- **Color Intensity:** Frequency of dives. More dives in a specific profile result in a deeper shade of the project's brand color (True Blue).
- **Scale:**
    - **Max Depth Buckets (X):** 0-10, 10-20, 20-30, 30-40, 40-50, 50-60, 60-80, 80+.
    - **Average Depth Buckets (Y):** 0-5, 5-10, 10-15, 15-20, 20-25, 25-30, 30+.

### 2.2 Success Criteria
- The heatmap must be visible on the public `UserProfile` page.
- It must accurately reflect the user's non-private dive data.
- It must be responsive and follow the "Mobile-First" design guidelines (no horizontal scrolling).
- It must use the standard `Divemap Blue Style` for color scaling.

## 3. Architecture & Implementation

### 3.1 Backend (Python/FastAPI/SQLAlchemy)
- **Data Structure:** Update `DivingStatsResponse` in `backend/app/schemas/__init__.py` to include `depth_density_heatmap: List[Dict[str, int]]`.
- **Query Logic:** 
    - Use `backend/app/routers/users.py` in the `get_user_public_profile` function.
    - Query raw `max_depth` and `average_depth` for all `is_private=False` dives for the user.\n    - Perform the custom binning logic (the irregular buckets like 60-80) in Python. This maximizes testability and maintainability over complex SQL `CASE` statements.\n- \*\*Performance:\*\* While we fetch raw tuples, the payload size per user is small enough (hundreds to low thousands of records) that Python processing is highly performant.

### 3.2 Frontend (React/Tailwind)
- **Component:** Create `frontend/src/components/DepthDensityHeatmap.jsx`.
- **Layout:** Use CSS Grid with Tailwind CSS.
    - Rows: Average Depth (Top to Bottom).
    - Columns: Maximum Depth (Left to Right).
- **Styling:**
    - Tooltips on hover showing the exact dive count and depth range.
    - Dynamic background color intensity based on frequency relative to the user's most frequent profile.

### 3.3 Integration
- Integrate the new component into `frontend/src/pages/UserProfile.jsx`.
- Place it within the "Diving Statistics" section.

## 4. Testing & Validation
- **Unit Tests:** Verify the binning logic in the backend.
- **Visual Verification:** Use browser MCP tools to ensure the heatmap renders correctly on desktop and mobile viewports.
- **Console Check:** Zero console errors target.

## 5. Future Considerations
- Filters for "Location", "Dive Suit", or "Time-Series" elements as discussed in brainstorming.
