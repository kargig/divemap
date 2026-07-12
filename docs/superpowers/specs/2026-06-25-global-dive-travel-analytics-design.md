# Design Specification: Global Dive Travel Analytics (Countries Visited & Distribution)

**Date:** June 25, 2026  
**Status:** Approved Design (Approach 1 - Split Integration)  
**Author:** Gemini CLI Agent  
**Location:** `docs/superpowers/specs/2026-06-25-global-dive-travel-analytics-design.md`

---

## 1. Executive Summary

Scuba divers are global explorers. To celebrate and visualize their diving travels, we are introducing "Global Dive Travel Analytics" inside Divemap. Following our Split Integration strategy, we will:
1. **Public Profile Badge (`/users/{username}`):** Display a summary card/metric showing **Countries Visited** alongside the existing total dives, points, and unique sites stats.
2. **Advanced Analytics Tab (`/users/{username}/analytics`):** Render an interactive **Country Distribution Pie/Donut Chart** displaying the exact proportion of dives logged in each nation.

These additions leverage the existing `country` index inside the `dive_sites` table to run performant, indexed SQL aggregations on the read path.

---

## 2. Goals & Non-Goals

### Goals
- Automatically count the number of unique countries a user has dived in (excluding private dives).
- Dynamically aggregate dive distributions across visited countries on the backend.
- Render "Countries Visited" on the public profile stats panel.
- Build a beautiful, responsive, brand-consistent interactive **Pie/Donut Chart** of country distributions inside the Advanced Analytics view using Recharts.
- Ensure backwards compatibility for divers who have only dived in a single country or have no country metadata in their sites.

### Non-Goals
- We are not modifying the SQL schema; the `country` column in the `dive_sites` table already exists and is fully indexed.

---

## 3. System Architecture & Flows

Computations are split across the Profile loading and Advanced Analytics loading endpoints:

### A. User Profile Flow (`/api/users/{username}`)
- **Backend:** Queries unique country count with a fast, indexed distinct count join between `dives` and `dive_sites`.
- **Frontend:** Renders a list item `"Countries Visited: X"` in `UserProfile.jsx` right under `"Dive sites visited: Y"`.

### B. Advanced Analytics Flow (`/api/users/{username}/analytics`)
- **Backend:** Groups and counts dives grouped by `DiveSite.country`. Returns list of `{"country": "Greece", "count": 42}` in `AdvancedAnalyticsResponse`.
- **Frontend:** Renders a gorgeous, responsive, custom-colored `<PieChart>` donut with localized percentage indicators.

---

## 4. Detailed Design

### 4.1 Backend Schema Changes (`backend/app/schemas/__init__.py`)

#### 1. UserProfileStats Schema Extension:
```python
class UserProfileStats(BaseModel):
    # ... existing fields
    countries_visited_count: int = 0
```

#### 2. AdvancedAnalyticsResponse Schema Extension:
```python
class AdvancedAnalyticsResponse(BaseModel):
    # ... existing fields
    country_distribution: List[Dict[str, Any]] = []  # [{"country": "Greece", "count": 142}]
```

---

### 4.2 Backend Implementation (`backend/app/routers/users.py`)

#### 1. Public Profile Country Counting:
Inside `get_user_public_profile`, we add:
```python
    countries_visited_count = db.query(func.count(distinct(DiveSite.country))).join(
        Dive, Dive.dive_site_id == DiveSite.id
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        DiveSite.country.isnot(None),
        DiveSite.country != ""
    ).scalar() or 0
```

#### 2. Advanced Analytics Country Distribution:
Inside `get_user_advanced_analytics`, we add:
```python
    country_query = db.query(DiveSite.country, func.count(Dive.id)).join(
        Dive, Dive.dive_site_id == DiveSite.id
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        DiveSite.country.isnot(None),
        DiveSite.country != ""
    ).group_by(DiveSite.country).all()
    
    country_distribution = [
        {"country": country, "count": count}
        for country, count in country_query
    ]
```

---

### 4.3 Frontend Design & UI Components

#### 1. Profile Integration (`frontend/src/pages/UserProfile.jsx`)
Insert a new metadata entry right beside "Dive sites visited":
```jsx
<div className='flex justify-between items-center'>
  <div className='flex items-center gap-2'>
    <Globe size={16} className='text-gray-400' />
    <span className='text-gray-600'>Countries Visited:</span>
  </div>
  <span className='font-semibold flex-1 text-right'>
    {profile.stats.countries_visited_count || 0}
  </span>
</div>
```

#### 2. Donut Country Chart (`frontend/src/components/CountryDistributionChart.jsx`)
- Rendered on the advanced analytics tab.
- Uses Recharts `<PieChart>` and `<Pie>` with `innerRadius='60%'` and `outerRadius='80%'` to draw a modern, hollow Donut.
- Applies customized blue/teal color scaling matching Divemap's aquatic brand.
- Features a responsive sidebar legend and counts summary.

---

## 5. Verification & Testing

### Backend TDD Tests (`backend/tests/test_analytics_adv.py`)
- Extend our advanced analytics tests to verify `countries_visited_count` and `country_distribution` map counts accurately for mock dives.

### Frontend Verification Standards
- Run `make lint-frontend` to verify pristine compilation.
- Open `http://localhost/users/admin/analytics` and verify the donut is visually perfect, has responsive layouts, and zero console messages.
