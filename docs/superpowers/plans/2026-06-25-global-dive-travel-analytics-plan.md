# Global Dive Travel Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a split visual integration displaying unique visited countries summary count on the user public profile, and a responsive Donut Pie Chart breakdown on the advanced analytics page.

**Architecture:** Extend FastAPI `/api/users/{username}` and `/api/users/{username}/analytics` to query countries visited via database joins, then add stats chips and Recharts `<PieChart>` to render these data points cleanly.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Pydantic), React (Tailwind CSS, Recharts)

## Global Constraints
- Automatic git commits are forbidden. Always ask for confirmation before preparing commit messages.
- DO NOT use `git add` or `git restore` under any circumstance.
- Every frontend modification MUST be verified by visiting the affected page using Chrome DevTools and ensuring Zero Console Errors.
- SQLite is NOT supported for backend testing. Use the ephemeral MySQL-backed docker script `./docker-test-github-actions.sh`.

---

### Task 1: Update API Contracts & Pydantic Schemas

**Files:**
- Modify: `backend/app/schemas/__init__.py:770-821`

**Interfaces:**
- Consumes: None (Updates output schemas)
- Produces: Updated schemas supporting:
  - `UserProfileStats.countries_visited_count` (int, default 0)
  - `AdvancedAnalyticsResponse.country_distribution` (List[Dict[str, Any]], default [])

- [ ] **Step 1: Write the schema modifications**

Edit `backend/app/schemas/__init__.py` using `replace` tool:

Add `countries_visited_count` to `UserProfileStats`:
```python
<<<<
class UserProfileStats(BaseModel):
    dive_sites_rated: int
    comments_posted: int
    dive_sites_created: int
    dives_created: int
    diving_centers_owned: int
    site_comments_count: int
    site_ratings_count: int
    total_dives_claimed: int
    buddy_dives_count: int
    unique_dive_sites_logged: int = 0
    total_points: Optional[int] = 0
    leaderboard_rank: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
====
class UserProfileStats(BaseModel):
    dive_sites_rated: int
    comments_posted: int
    dive_sites_created: int
    dives_created: int
    diving_centers_owned: int
    site_comments_count: int
    site_ratings_count: int
    total_dives_claimed: int
    buddy_dives_count: int
    unique_dive_sites_logged: int = 0
    countries_visited_count: int = 0
    total_points: Optional[int] = 0
    leaderboard_rank: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
>>>>
```

Add `country_distribution` to `AdvancedAnalyticsResponse`:
```python
<<<<
class AdvancedAnalyticsResponse(BaseModel):
    depth_density_heatmap: List[Dict[str, Any]] = []
    sac_vs_depth: List[Dict[str, Any]] = []
    duration_vs_depth: List[Dict[str, Any]] = []
    temp_vs_suit: List[Dict[str, Any]] = []
    dives_per_year: List[Dict[str, Any]] = []
    sac_over_time: List[Dict[str, Any]] = []
    depth_over_time: List[Dict[str, Any]] = []
    dives_per_gas_config: List[Dict[str, Any]] = [] # [{"config": "Single 12L", "count": 10}]
    weight_vs_gear: List[Dict[str, Any]] = [] # [{"gear": "Wetsuit + Single 12L", "weight": 4.5}]
    weight_over_time: List[Dict[str, Any]] = [] # [{"date": "2024-05", "weight": 5.0, "gear": "Wetsuit + Single 12L"}]
    dive_style_radar: List[Dict[str, Any]] = [] # [{"subject": "Reef & Eco", "value": 15, "fullMark": 100}]
    boat_dive_pct: Optional[float] = 0.0
    shore_dive_pct: Optional[float] = 0.0
    gas_mix_heatmap: List[Dict[str, Any]] = [] # [{"mix": "Nitrox 32", "depth_bin": "18-30m", "count": 14}]
====
class AdvancedAnalyticsResponse(BaseModel):
    depth_density_heatmap: List[Dict[str, Any]] = []
    sac_vs_depth: List[Dict[str, Any]] = []
    duration_vs_depth: List[Dict[str, Any]] = []
    temp_vs_suit: List[Dict[str, Any]] = []
    dives_per_year: List[Dict[str, Any]] = []
    sac_over_time: List[Dict[str, Any]] = []
    depth_over_time: List[Dict[str, Any]] = []
    dives_per_gas_config: List[Dict[str, Any]] = [] # [{"config": "Single 12L", "count": 10}]
    weight_vs_gear: List[Dict[str, Any]] = [] # [{"gear": "Wetsuit + Single 12L", "weight": 4.5}]
    weight_over_time: List[Dict[str, Any]] = [] # [{"date": "2024-05", "weight": 5.0, "gear": "Wetsuit + Single 12L"}]
    dive_style_radar: List[Dict[str, Any]] = [] # [{"subject": "Reef & Eco", "value": 15, "fullMark": 100}]
    boat_dive_pct: Optional[float] = 0.0
    shore_dive_pct: Optional[float] = 0.0
    gas_mix_heatmap: List[Dict[str, Any]] = [] # [{"mix": "Nitrox 32", "depth_bin": "18-30m", "count": 14}]
    country_distribution: List[Dict[str, Any]] = [] # [{"country": "Greece", "count": 42}]
>>>>
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_privacy.py`
Expected: Passes cleanly.

---

### Task 2: Backend Logic - Country Counting & Distribution

**Files:**
- Modify: `backend/app/routers/users.py:716-725` (inside public profile), `1090-1346` (inside analytics)
- Modify: `backend/tests/test_analytics_adv.py` (add TDD test coverage)

**Interfaces:**
- Consumes: User's dive site country database fields.
- Produces: Populated `countries_visited_count` and `country_distribution` fields inside the router responses.

- [ ] **Step 1: Add TDD assertion to backend test**

Edit `backend/tests/test_analytics_adv.py` using `replace` tool:

```python
<<<<
    # Assert gas mix heatmap has mapped nitrox bin
    assert "gas_mix_heatmap" in data
    assert len(data["gas_mix_heatmap"]) > 0
====
    # Assert gas mix heatmap has mapped nitrox bin
    assert "gas_mix_heatmap" in data
    assert len(data["gas_mix_heatmap"]) > 0
    
    # Assert country distribution
    assert "country_distribution" in data
    countries = [item["country"] for item in data["country_distribution"]]
    assert "Greece" in countries
>>>>
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_analytics_adv.py`
Expected: FAIL on `country_distribution` assertions.

- [ ] **Step 3: Implement Country calculations inside backend router**

Edit `backend/app/routers/users.py`:

Add unique country counting to `get_user_public_profile` (around line 716-720):
```python
<<<<
    # Calculate count of unique visited dive sites
    unique_dive_sites_logged = db.query(func.count(distinct(Dive.dive_site_id))).filter(
        Dive.user_id == user.id,
        Dive.dive_site_id.isnot(None)
    ).scalar() or 0

    # Leaderboard and gamification data
====
    # Calculate count of unique visited dive sites
    unique_dive_sites_logged = db.query(func.count(distinct(Dive.dive_site_id))).filter(
        Dive.user_id == user.id,
        Dive.dive_site_id.isnot(None)
    ).scalar() or 0

    # Calculate unique countries visited
    from app.models import DiveSite
    countries_visited_count = db.query(func.count(distinct(DiveSite.country))).join(
        Dive, Dive.dive_site_id == DiveSite.id
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        DiveSite.country.isnot(None),
        DiveSite.country != ""
    ).scalar() or 0

    # Leaderboard and gamification data
>>>>
```

And update mapping initialization inside `stats = UserProfileStats(...)` (around line 735):
```python
<<<<
        buddy_dives_count=buddy_dives_count or 0,
        unique_dive_sites_logged=unique_dive_sites_logged,
        total_points=total_points,
====
        buddy_dives_count=buddy_dives_count or 0,
        unique_dive_sites_logged=unique_dive_sites_logged,
        countries_visited_count=countries_visited_count,
        total_points=total_points,
>>>>
```

Add Country Distribution aggregation to `get_user_advanced_analytics` (right before the return statement at the bottom of the function):
```python
<<<<
    return AdvancedAnalyticsResponse(
      depth_density_heatmap=depth_density_heatmap,
      sac_vs_depth=sac_vs_depth,
      duration_vs_depth=duration_vs_depth,
      temp_vs_suit=temp_vs_suit,
      dives_per_year=dives_per_year,
      sac_over_time=sac_over_time,
      depth_over_time=depth_over_time,
      dives_per_gas_config=dives_per_gas_config,
      weight_vs_gear=weight_vs_gear,
      weight_over_time=weight_over_time,
      dive_style_radar=dive_style_radar,
      boat_dive_pct=boat_dive_pct,
      shore_dive_pct=shore_dive_pct,
      gas_mix_heatmap=gas_mix_heatmap
    )
====
    # 3. Country Distribution aggregation
    from app.models import DiveSite
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

    return AdvancedAnalyticsResponse(
      depth_density_heatmap=depth_density_heatmap,
      sac_vs_depth=sac_vs_depth,
      duration_vs_depth=duration_vs_depth,
      temp_vs_suit=temp_vs_suit,
      dives_per_year=dives_per_year,
      sac_over_time=sac_over_time,
      depth_over_time=depth_over_time,
      dives_per_gas_config=dives_per_gas_config,
      weight_vs_gear=weight_vs_gear,
      weight_over_time=weight_over_time,
      dive_style_radar=dive_style_radar,
      boat_dive_pct=boat_dive_pct,
      shore_dive_pct=shore_dive_pct,
      gas_mix_heatmap=gas_mix_heatmap,
      country_distribution=country_distribution
    )
>>>>
```

*Note:* Update the test setup in `backend/tests/test_analytics_adv.py` to link `dive1` with a mock dive site containing `country="Greece"`.

- [ ] **Step 4: Run backend tests to verify they pass successfully**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_analytics_adv.py`
Expected: `All tests passed! 🎉`

---

### Task 3: Create the `CountryDistributionChart` Frontend Component

**Files:**
- Create: `frontend/src/components/CountryDistributionChart.jsx`

**Interfaces:**
- Consumes: `data: Array` containing `[{"country": "Greece", "count": 142}]` as prop.
- Produces: Beautiful, responsive Donut Pie Chart breakdown with customized colors.

- [ ] **Step 1: Write the component code**

Create `frontend/src/components/CountryDistributionChart.jsx` with:

```jsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Globe } from 'lucide-react';

const COLORS = ['#1d4ed8', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#6366f1', '#8b5cf6'];

const CountryDistributionChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className='text-gray-500 text-sm mt-2'>No country information available in your dive logs.</p>;
  }

  // Sort descending by count
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const totalDives = sortedData.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      const percentage = ((entry.count / totalDives) * 100).toFixed(1);
      return (
        <div className='bg-white p-3 border border-gray-100 shadow-lg rounded-md text-sm'>
          <p className='font-semibold text-gray-800'>{entry.country}</p>
          <p className='text-gray-600 text-xs mt-1'>
            Dives: <span className='font-semibold'>{entry.count}</span> ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow animate-fade-in text-center'>
      <h3 className='text-md font-semibold text-gray-800 mb-1 flex items-center justify-center gap-2'>
        <Globe className='w-5 h-5 text-blue-600' />
        Global Dive Travel Distribution
      </h3>
      <p className='text-xs text-gray-500 mb-6'>
        Proportion of logged dives across visited nations.
      </p>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 items-center'>
        {/* Pie/Donut Chart Container */}
        <div className='h-60 w-full flex justify-center relative'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={sortedData}
                dataKey='count'
                nameKey='country'
                cx='50%'
                cy='50%'
                innerRadius='60%'
                outerRadius='80%'
                paddingAngle={3}
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Inner Donut Text */}
          <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
            <span className='text-2xl font-bold text-gray-800'>{totalDives}</span>
            <span className='text-[10px] text-gray-400 uppercase tracking-wider font-semibold'>Total Dives</span>
          </div>
        </div>

        {/* Custom Sidebar Legend Summary */}
        <div className='flex flex-col justify-center text-left gap-3 max-h-60 overflow-y-auto pr-2'>
          {sortedData.slice(0, 6).map((entry, index) => {
            const pct = ((entry.count / totalDives) * 100).toFixed(1);
            return (
              <div key={entry.country} className='flex items-center justify-between text-xs pb-1.5 border-b border-gray-50'>
                <div className='flex items-center gap-2'>
                  <span 
                    className='w-3 h-3 rounded-full shrink-0' 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <span className='font-medium text-gray-700 truncate max-w-[120px]'>{entry.country}</span>
                </div>
                <span className='text-gray-500 font-semibold'>
                  {entry.count} <span className='text-gray-400 font-normal text-[10px]'>({pct}%)</span>
                </span>
              </div>
            );
          })}
          {sortedData.length > 6 && (
            <div className='text-[10px] text-gray-400 font-medium text-center pt-1.5'>
              + {sortedData.length - 6} other countries visited
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountryDistributionChart;
```

---

### Task 4: Integrate Visited Countries Summary into User Profile page

**Files:**
- Modify: `frontend/src/pages/UserProfile.jsx:744-755`

**Interfaces:**
- Consumes: `profile.stats.countries_visited_count` parameter.
- Produces: Rendered summary metric labeled "Countries Visited" on the main public profile stats sidebar list.

- [ ] **Step 1: Write the profile modifications**

Edit `frontend/src/pages/UserProfile.jsx` using `replace` tool:

```jsx
<<<<
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <Map size={16} className='text-gray-400' />
                    <span className='text-gray-600'>Dive sites visited:</span>
                  </div>
                  <span className='font-semibold flex-1 text-right'>
                    {profile.stats.unique_dive_sites_logged || 0}
                  </span>
                </div>
====
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <Map size={16} className='text-gray-400' />
                    <span className='text-gray-600'>Dive sites visited:</span>
                  </div>
                  <span className='font-semibold flex-1 text-right'>
                    {profile.stats.unique_dive_sites_logged || 0}
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <Globe size={16} className='text-gray-400' />
                    <span className='text-gray-600'>Countries visited:</span>
                  </div>
                  <span className='font-semibold flex-1 text-right'>
                    {profile.stats.countries_visited_count || 0}
                  </span>
                </div>
>>>>
```

*Note:* Make sure to import `Globe` from `lucide-react` at the top of the file!

Add `Globe` import to `lucide-react` imports (around line 2-10):
```javascript
<<<<
import { Activity, ArrowLeft } from 'lucide-react';
====
import { Activity, ArrowLeft, Globe } from 'lucide-react';
>>>>
```

---

### Task 5: Integrate Country Donut Chart into User Analytics page

**Files:**
- Modify: `frontend/src/pages/UserAnalytics.jsx`

**Interfaces:**
- Consumes: `analytics.country_distribution` parameter and `CountryDistributionChart` component.
- Produces: Beautiful, visual country proportion breakdown displayed on the advanced analytics tab.

- [ ] **Step 1: Write the analytics page integration**

Edit `frontend/src/pages/UserAnalytics.jsx` using `replace` tool:

Add `CountryDistributionChart` import at the top:
```jsx
<<<<
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
import DiveStyleRadar from '../components/DiveStyleRadar';
import GasMixHeatmap from '../components/GasMixHeatmap';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
====
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
import DiveStyleRadar from '../components/DiveStyleRadar';
import GasMixHeatmap from '../components/GasMixHeatmap';
import CountryDistributionChart from '../components/CountryDistributionChart';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
>>>>
```

And render it in the analytics layout container:
```jsx
<<<<
          {/* Gas Mix vs Max Depth Heatmap */}
          {analytics?.gas_mix_heatmap && analytics.gas_mix_heatmap.length > 0 ? (
            <GasMixHeatmap data={analytics.gas_mix_heatmap} />
          ) : null}

          {/* Other Advanced Analytics */}
          <AdvancedAnalytics
====
          {/* Gas Mix vs Max Depth Heatmap */}
          {analytics?.gas_mix_heatmap && analytics.gas_mix_heatmap.length > 0 ? (
            <GasMixHeatmap data={analytics.gas_mix_heatmap} />
          ) : null}

          {/* Global Dive Travel Donut Chart */}
          {analytics?.country_distribution && analytics.country_distribution.length > 0 ? (
            <CountryDistributionChart data={analytics.country_distribution} />
          ) : null}

          {/* Other Advanced Analytics */}
          <AdvancedAnalytics
>>>>
```

- [ ] **Step 2: Run linter and verify pristine compile**

Run: `make lint-frontend`
Expected: `✅ Linting complete. No errors found.`

- [ ] **Step 3: Verify the changes load correctly**

Navigate: `mcp_chrome-devtools_navigate_page` to local profile `http://localhost/users/admin` and analytics `http://localhost/users/admin/analytics`.
Snapshot: verify beautiful visual rendering of unique countries visited and distribution donut chart, with zero console errors.
