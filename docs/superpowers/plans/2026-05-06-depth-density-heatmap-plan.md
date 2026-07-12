# Depth Density Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 2D density heatmap visualization comparing a user's Maximum Depth against Average Depth to reveal their diving patterns.

**Architecture:** We will update the backend `UserPublicProfileResponse` schema to include heatmap data. The backend will fetch raw max/avg depth pairs for a user's public dives and bin them into predefined ranges using Python logic. The frontend will render this data using a new React component built with CSS Grid and Tailwind CSS.

**Tech Stack:** Python, FastAPI, SQLAlchemy, React, Tailwind CSS

---

### Task 1: Update Backend Schemas

**Files:**
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Update DivingStatsResponse**

Add the `depth_density_heatmap` field to `DivingStatsResponse`.

```python
class DivingStatsResponse(BaseModel):
    max_depth: Optional[float] = None
    longest_dive_minutes: Optional[int] = None
    total_bottom_time_minutes: Optional[int] = None
    most_active_month: Optional[str] = None # e.g. "August 2024 (15 dives)"
    favorite_sites: List[FavoriteDiveSite] = []
    activity_heatmap: Dict[str, int] = {} # Date (YYYY-MM-DD) -> Dive Count
    depth_density_heatmap: List[Dict[str, Any]] = [] # [{"max_bin": "...", "avg_bin": "...", "count": 1}]
    suit_preferences: Dict[str, int] = {} # SuitType -> Count
    gear_preferences: Dict[str, int] = {} # GearType -> Count
```

- [ ] **Step 2: Commit**

```bash
echo "feat(backend): add depth_density_heatmap to DivingStatsResponse" > commit-message.txt
```

### Task 2: Implement Backend Binning Logic

**Files:**
- Modify: `backend/app/routers/users.py`

- [ ] **Step 1: Implement binning logic in get_user_public_profile**

Find the `activity_heatmap` logic block. Below it, add the logic to fetch raw depth data and bin it.

```python
    # 4.5 Depth Density Heatmap (Max vs Avg Depth)
    depths_query = db.query(
        Dive.max_depth,
        Dive.average_depth
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False,
        Dive.max_depth.isnot(None),
        Dive.average_depth.isnot(None)
    ).all()

    def get_max_bucket(depth):
        if depth < 5: return "0-5"
        if depth < 10: return "5-10"
        if depth < 15: return "10-15"
        if depth < 20: return "15-20"
        if depth < 25: return "20-25"
        if depth < 30: return "25-30"
        if depth < 35: return "30-35"
        if depth < 40: return "35-40"
        if depth < 50: return "40-50"
        if depth < 60: return "50-60"
        if depth < 80: return "60-80"
        return "80+"

    def get_avg_bucket(depth):
        if depth < 5: return "0-5"
        if depth < 10: return "5-10"
        if depth < 15: return "10-15"
        if depth < 20: return "15-20"
        if depth < 25: return "20-25"
        if depth < 30: return "25-30"
        if depth < 35: return "30-35"
        return "35-40+"

    heatmap_counts = {}
    for max_d, avg_d in depths_query:
        max_b = get_max_bucket(float(max_d))
        avg_b = get_avg_bucket(float(avg_d))
        
        # Key by a string tuple representation for aggregation
        key = f"{max_b}|{avg_b}"
        heatmap_counts[key] = heatmap_counts.get(key, 0) + 1

    depth_density_heatmap = [
        {"max_bin": k.split('|')[0], "avg_bin": k.split('|')[1], "count": v}
        for k, v in heatmap_counts.items()
    ]
```

- [ ] **Step 2: Add `depth_density_heatmap` to `DivingStatsResponse` instantiation**

In the same file, locate `diving_stats = DivingStatsResponse(...)` and add the new parameter:

```python
    diving_stats = DivingStatsResponse(
      max_depth=float(stats_row.max_depth) if stats_row and stats_row.max_depth else None,
      longest_dive_minutes=int(stats_row.longest_dive_minutes) if stats_row and stats_row.longest_dive_minutes else None,
      total_bottom_time_minutes=int(stats_row.total_bottom_time_minutes) if stats_row and stats_row.total_bottom_time_minutes else None,
      most_active_month=most_active_month,
      favorite_sites=favorite_sites,
      activity_heatmap=activity_heatmap,
      depth_density_heatmap=depth_density_heatmap,
      suit_preferences=suit_preferences,
      gear_preferences=gear_preferences
    )
```

- [ ] **Step 3: Run backend tests to ensure no regressions**

Run: `cd backend && ./docker-test-github-actions.sh`
Expected: "All tests passed!" (If failures occur, read `backend/test-failures.txt` and fix).

- [ ] **Step 4: Commit**

```bash
echo "feat(backend): implement binning logic for depth density heatmap" > commit-message.txt
```

### Task 3: Create Frontend Component

**Files:**
- Create: `frontend/src/components/DepthDensityHeatmap.jsx`

- [ ] **Step 1: Write the React component**

Create the file `frontend/src/components/DepthDensityHeatmap.jsx` with the following content:

```jsx
import React from 'react';

const MAX_DEPTH_BINS = [
  "0-5", "5-10", "10-15", "15-20", "20-25", "25-30", 
  "30-35", "35-40", "40-50", "50-60", "60-80", "80+"
];

const AVG_DEPTH_BINS = [
  "0-5", "5-10", "10-15", "15-20", "20-25", "25-30", 
  "30-35", "35-40+"
];

const DepthDensityHeatmap = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-sm mt-2">Not enough dive data to generate heatmap.</p>;
  }

  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Helper to get color intensity based on count
  const getColor = (count) => {
    if (count === 0) return 'bg-gray-50';
    
    const ratio = count / maxCount;
    if (ratio <= 0.2) return 'bg-blue-100';
    if (ratio <= 0.4) return 'bg-blue-300';
    if (ratio <= 0.6) return 'bg-blue-500';
    if (ratio <= 0.8) return 'bg-blue-700';
    return 'bg-blue-900';
  };

  // Convert array to dictionary for easy lookup
  const dataMap = data.reduce((acc, item) => {
    acc[`${item.max_bin}|${item.avg_bin}`] = item.count;
    return acc;
  }, {});

  return (
    <div className="mt-6">
      <h3 className="text-md font-semibold text-gray-800 mb-2">Depth Density Heatmap</h3>
      <p className="text-xs text-gray-500 mb-4">Max Depth vs. Average Depth (Meters)</p>
      
      <div className="flex overflow-x-auto pb-2">
        <div className="flex">
          {/* Y-Axis Labels (Avg Depth) */}
          <div className="flex flex-col justify-end gap-1 pr-2 pt-6">
            {AVG_DEPTH_BINS.map(label => (
              <div key={label} className="h-6 flex items-center justify-end text-xs text-gray-500 w-12 text-right">
                {label}
              </div>
            ))}
          </div>

          {/* Grid Area */}
          <div>
            {/* X-Axis Labels (Max Depth) */}
            <div className="flex gap-1 mb-2 ml-1">
              {MAX_DEPTH_BINS.map(label => (
                <div key={label} className="w-6 flex items-end justify-center text-[10px] text-gray-500 origin-bottom-left -rotate-45 h-8">
                  {label}
                </div>
              ))}
            </div>

            {/* Matrix */}
            <div className="flex gap-1 ml-1">
              {MAX_DEPTH_BINS.map(maxBin => (
                <div key={maxBin} className="flex flex-col gap-1">
                  {AVG_DEPTH_BINS.map(avgBin => {
                    const count = dataMap[`${maxBin}|${avgBin}`] || 0;
                    // Don't render cells where Avg Depth > Max Depth
                    const avgStart = parseInt(avgBin.split('-')[0]);
                    const maxStart = parseInt(maxBin.split('-')[0]);
                    
                    if (avgStart > maxStart) {
                       return <div key={`${maxBin}-${avgBin}`} className="w-6 h-6 bg-white border border-gray-100 opacity-50" />;
                    }

                    return (
                      <div
                        key={`${maxBin}-${avgBin}`}
                        className={`w-6 h-6 rounded-sm ${getColor(count)} transition-all hover:ring-2 hover:ring-gray-400`}
                        title={count > 0 ? `${count} dive(s): Max ${maxBin}m, Avg ${avgBin}m` : `0 dives`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepthDensityHeatmap;
```

- [ ] **Step 2: Commit**

```bash
echo "feat(frontend): create DepthDensityHeatmap component" > commit-message.txt
```

### Task 4: Integrate Component into User Profile

**Files:**
- Modify: `frontend/src/pages/UserProfile.jsx`

- [ ] **Step 1: Import the component**

Add the import near the top of `frontend/src/pages/UserProfile.jsx`:

```javascript
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
```

- [ ] **Step 2: Render the component**

Find the section where the `ActivityHeatmap` is rendered:

```javascript
              {/* Activity Heatmap */}
              {profile.diving_stats.activity_heatmap && Object.keys(profile.diving_stats.activity_heatmap).length > 0 && (
                <div className='mt-8 pt-6 border-t border-gray-100'>
                  <h3 className='text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider'>
                    Diving Activity (Last 12 Months)
                  </h3>
                  <ActivityHeatmap data={profile.diving_stats.activity_heatmap || {}} />
                </div>
              )}
```

Add the new component right below it:

```javascript
              {/* Depth Density Heatmap */}
              {profile.diving_stats.depth_density_heatmap && profile.diving_stats.depth_density_heatmap.length > 0 && (
                <div className='mt-8 pt-6 border-t border-gray-100'>
                  <DepthDensityHeatmap data={profile.diving_stats.depth_density_heatmap} />
                </div>
              )}
```

- [ ] **Step 3: Run Frontend Linter**

Run: `make lint-frontend`
Expected: Completes without new errors.

- [ ] **Step 4: Commit**

```bash
echo "feat(frontend): integrate DepthDensityHeatmap into user profile" > commit-message.txt
```
