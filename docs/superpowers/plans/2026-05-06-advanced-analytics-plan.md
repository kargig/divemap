# Advanced Dive Analytics Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three advanced Recharts-based analytics visualizations (SAC vs Depth, Duration vs Depth, Temp vs Suit) on the User Profile.

**Architecture:** The backend will extract `SAC` and `Water Temp` via regex from the `dive_information` text field (and calculate Real SAC using physics when possible), format the data into three separate lists, and update `DivingStatsResponse`. The frontend will render these datasets using the Recharts library inside a new `AdvancedAnalytics.jsx` component.

**Tech Stack:** Python, FastAPI, SQLAlchemy, React, Tailwind CSS, Recharts

---

### Task 1: Update Backend Schema

**Files:**
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Update DivingStatsResponse**

Add three new fields to `DivingStatsResponse` in `backend/app/schemas/__init__.py`:

```python
class DivingStatsResponse(BaseModel):
    max_depth: Optional[float] = None
    longest_dive_minutes: Optional[int] = None
    total_bottom_time_minutes: Optional[int] = None
    most_active_month: Optional[str] = None
    favorite_sites: List[FavoriteDiveSite] = []
    activity_heatmap: Dict[str, int] = {}
    depth_density_heatmap: List[Dict[str, Any]] = []
    suit_preferences: Dict[str, int] = {}
    gear_preferences: Dict[str, int] = {}
    sac_vs_depth: List[Dict[str, Any]] = [] # [{"depth": 25.0, "sac": 14.5}]
    duration_vs_depth: List[Dict[str, Any]] = [] # [{"duration": 45, "depth": 20, "count": 2}]
    temp_vs_suit: List[Dict[str, Any]] = [] # [{"suit": "Wetsuit", "temp": 22.0}]
```

- [ ] **Step 2: Commit**

```bash
echo "feat(backend): add advanced analytics fields to DivingStatsResponse" > commit-message.txt
```

### Task 2: Implement Backend Extraction Logic

**Files:**
- Modify: `backend/app/routers/users.py`

- [ ] **Step 1: Add imports**

At the top of `backend/app/routers/users.py`, ensure we have the necessary imports for regex and physics calculations. Add this near the top:

```python
import json
from app.physics import calculate_sac
```

- [ ] **Step 2: Add extraction logic in get_user_public_profile**

Locate the section where `depths_query` is defined for the depth density heatmap. Below the `depth_density_heatmap` calculation, add the following logic:

```python
    # 4.6 Advanced Analytics Data (SAC, Temp, Duration)
    advanced_query = db.query(
        Dive.max_depth,
        Dive.duration,
        Dive.suit_type,
        Dive.dive_information,
        Dive.gas_bottles_used,
        Dive.average_depth
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False
    ).all()

    sac_vs_depth = []
    temp_vs_suit = []
    
    # For Bubble Chart: Group by (Duration rounded to 5, Depth rounded to 5)
    bubble_counts = {}

    for d_max, d_dur, d_suit, d_info, d_gas, d_avg in advanced_query:
        # Bubble Chart processing
        if d_max is not None and d_dur is not None:
            # Round to nearest 5
            rounded_dur = int(round(float(d_dur) / 5.0) * 5)
            rounded_depth = int(round(float(d_max) / 5.0) * 5)
            b_key = f"{rounded_dur}|{rounded_depth}"
            bubble_counts[b_key] = bubble_counts.get(b_key, 0) + 1

        # Regex Extraction from dive_information
        extracted_sac = None
        extracted_temp = None

        if d_info:
            # Extract Temp
            temp_match = re.search(r"Water Temp:\s*([0-9.]+)", str(d_info))
            if temp_match:
                extracted_temp = float(temp_match.group(1))

            # Extract reported SAC
            sac_match = re.search(r"SAC:\s*([0-9.]+)", str(d_info))
            if sac_match:
                extracted_sac = float(sac_match.group(1))

        # Attempt to calculate Real SAC if structured gas data and required params exist
        if d_gas and d_dur and d_avg:
            try:
                if str(d_gas).startswith('{'):
                    gas_data = json.loads(d_gas)
                    if gas_data.get('mode') == 'structured':
                        bg = gas_data.get('back_gas', {})
                        t_vol = float(bg.get('tank', 0))
                        p_start = float(bg.get('start_pressure', 0))
                        p_end = float(bg.get('end_pressure', 0))
                        
                        # Very basic sanity check to avoid bad data crashing
                        if t_vol > 0 and p_start > p_end > 0:
                            calculated_sac = calculate_sac(
                                depth_meters=float(d_avg),
                                duration_minutes=float(d_dur),
                                tank_volume=t_vol,
                                start_pressure=p_start,
                                end_pressure=p_end
                            )
                            if calculated_sac > 0:
                                extracted_sac = calculated_sac
            except Exception:
                pass # Fallback to reported SAC if JSON parsing or math fails

        # Append valid points
        if extracted_sac and d_max:
            sac_vs_depth.append({"depth": float(d_max), "sac": round(extracted_sac, 2)})

        if extracted_temp and d_suit:
            s_name = d_suit.value if hasattr(d_suit, 'value') else str(d_suit)
            temp_vs_suit.append({"suit": s_name, "temp": extracted_temp})

    # Format Bubble Chart data
    duration_vs_depth = [
        {"duration": int(k.split('|')[0]), "depth": int(k.split('|')[1]), "count": v}
        for k, v in bubble_counts.items()
    ]
```

- [ ] **Step 3: Add new fields to `DivingStatsResponse` instantiation**

Update the `DivingStatsResponse` instantiation in the same file to include the three new variables:

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
      gear_preferences=gear_preferences,
      sac_vs_depth=sac_vs_depth,
      duration_vs_depth=duration_vs_depth,
      temp_vs_suit=temp_vs_suit
    )
```

- [ ] **Step 4: Run backend tests to ensure no regressions**

Run: `cd backend && ./docker-test-github-actions.sh`
Expected: "All tests passed!" 

- [ ] **Step 5: Commit**

```bash
echo "feat(backend): implement regex extraction and SAC calculation for advanced analytics" > commit-message.txt
```

### Task 3: Create Frontend Component

**Files:**
- Create: `frontend/src/components/AdvancedAnalytics.jsx`

- [ ] **Step 1: Write the React component**

Create `frontend/src/components/AdvancedAnalytics.jsx`:

```jsx
import React from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis 
} from 'recharts';

const AdvancedAnalytics = ({ sacData, durationData, tempData }) => {
  const hasSacData = sacData && sacData.length > 0;
  const hasDurationData = durationData && durationData.length > 0;
  const hasTempData = tempData && tempData.length > 0;

  if (!hasSacData && !hasDurationData && !hasTempData) return null;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-md text-sm">
          {data.sac && <p><strong>Depth:</strong> {data.depth}m<br/><strong>SAC:</strong> {data.sac} L/min</p>}
          {data.count && <p><strong>Duration:</strong> {data.duration}m<br/><strong>Max Depth:</strong> {data.depth}m<br/><strong>Dives:</strong> {data.count}</p>}
          {data.suit && <p><strong>Suit:</strong> {data.suit}<br/><strong>Temp:</strong> {data.temp}°C</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mt-8 space-y-8">
      
      {/* SAC vs Depth */}
      {hasSacData && (
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <h3 className="text-md font-semibold text-gray-800 mb-1">Air Consumption (SAC) vs. Depth</h3>
          <p className="text-xs text-gray-500 mb-4">Tracking gas efficiency (L/min) at deeper depths.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" dataKey="depth" name="Depth" unit="m" tick={{fontSize: 10}} stroke="#9ca3af" />
                <YAxis type="number" dataKey="sac" name="SAC" unit="L" tick={{fontSize: 10}} stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="SAC" data={sacData} fill="#2563eb" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Duration vs Depth Bubble Chart */}
      {hasDurationData && (
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <h3 className="text-md font-semibold text-gray-800 mb-1">Depth Distribution vs. Duration</h3>
          <p className="text-xs text-gray-500 mb-4">Bubble size represents the number of dives at that specific depth/time profile.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" dataKey="duration" name="Duration" unit="m" tick={{fontSize: 10}} stroke="#9ca3af" />
                <YAxis type="number" dataKey="depth" name="Depth" unit="m" tick={{fontSize: 10}} stroke="#9ca3af" />
                <ZAxis type="number" dataKey="count" range={[40, 400]} name="Dives" />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Dives" data={durationData} fill="#0ea5e9" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Temp vs Suit Scatter */}
      {hasTempData && (
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <h3 className="text-md font-semibold text-gray-800 mb-1">Temperature vs. Exposure Suit</h3>
          <p className="text-xs text-gray-500 mb-4">Thermal protection choices based on water temperature.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis type="category" dataKey="suit" name="Suit" tick={{fontSize: 10}} stroke="#9ca3af" />
                <YAxis type="number" dataKey="temp" name="Temp" unit="°C" tick={{fontSize: 10}} stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Temp" data={tempData} fill="#8b5cf6" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdvancedAnalytics;
```

- [ ] **Step 2: Commit**

```bash
echo "feat(frontend): create AdvancedAnalytics component with Recharts" > commit-message.txt
```

### Task 4: Integrate Component into User Profile

**Files:**
- Modify: `frontend/src/pages/UserProfile.jsx`

- [ ] **Step 1: Import the component**

Add the import near the top of `frontend/src/pages/UserProfile.jsx`:

```javascript
import AdvancedAnalytics from '../components/AdvancedAnalytics';
```

- [ ] **Step 2: Render the component**

Find the section where the `DepthDensityHeatmap` is rendered:

```javascript
                {/* Depth Density Heatmap */}
                {profile.diving_stats.depth_density_heatmap && profile.diving_stats.depth_density_heatmap.length > 0 && (
                  <div className='mt-8 pt-6 border-t border-gray-100'>
                    <DepthDensityHeatmap data={profile.diving_stats.depth_density_heatmap} />
                  </div>
                )}
```

Add the new component right below it, passing the three datasets:

```javascript
                {/* Advanced Analytics */}
                <AdvancedAnalytics 
                  sacData={profile.diving_stats.sac_vs_depth} 
                  durationData={profile.diving_stats.duration_vs_depth} 
                  tempData={profile.diving_stats.temp_vs_suit} 
                />
```

- [ ] **Step 3: Run Frontend Linter**

Run: `make lint-frontend`
Expected: Completes without new errors.

- [ ] **Step 4: Commit**

```bash
echo "feat(frontend): integrate AdvancedAnalytics into user profile page" > commit-message.txt
```
