# Time-Series Dive Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dives per Year, SAC Evolution, and Depth Evolution (with reversed Y-axis) charts to the Advanced Analytics page.

**Architecture:** The backend will update the `advanced_query` in `get_user_public_profile` to include `Dive.dive_date` and order the results chronologically. It will format this data into three new lists in `DivingStatsResponse`. The frontend will render these new datasets as `BarChart` and `LineChart` components within `AdvancedAnalytics.jsx`.

**Tech Stack:** Python, FastAPI, SQLAlchemy, React, Tailwind CSS, Recharts

---

### Task 1: Update Backend Schema & Data Logic

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/routers/users.py`

- [ ] **Step 1: Update DivingStatsResponse**

In `backend/app/schemas/__init__.py`, add the new fields to `DivingStatsResponse`.

```python
class DivingStatsResponse(BaseModel):
    # ... existing fields ...
    sac_vs_depth: List[Dict[str, Any]] = []
    duration_vs_depth: List[Dict[str, Any]] = []
    temp_vs_suit: List[Dict[str, Any]] = []
    dives_per_year: List[Dict[str, int]] = [] # [{"year": "2024", "count": 20}]
    sac_over_time: List[Dict[str, Any]] = [] # [{"date": "2024-05-06", "sac": 12.5}]
    depth_over_time: List[Dict[str, Any]] = [] # [{"date": "2024-05-06", "max": 30, "avg": 15}]
```

- [ ] **Step 2: Update query and extraction logic in get_user_public_profile**

In `backend/app/routers/users.py`, find the `advanced_query`. Add `Dive.dive_date` to the select list and add an `order_by`.

```python
    # 4.6 Advanced Analytics Data (SAC, Temp, Duration, Time-Series)
    advanced_query = db.query(
        Dive.max_depth,
        Dive.duration,
        Dive.suit_type,
        Dive.dive_information,
        Dive.gas_bottles_used,
        Dive.average_depth,
        Dive.dive_date
    ).filter(
        Dive.user_id == user.id,
        Dive.is_private == False
    ).order_by(Dive.dive_date.asc()).all()

    sac_vs_depth = []
    temp_vs_suit = []
    sac_over_time = []
    depth_over_time = []
    
    # For Bubble Chart: Group by (Duration rounded to 5, Depth rounded to 5)
    bubble_counts = {}
    
    # For Yearly bar chart
    year_counts = {}

    for d_max, d_dur, d_suit, d_info, d_gas, d_avg, d_date in advanced_query:
        # Date processing
        date_str = d_date.strftime("%Y-%m-%d") if d_date else None
        if d_date:
            year_str = str(d_date.year)
            year_counts[year_str] = year_counts.get(year_str, 0) + 1

        # Bubble Chart processing
        if d_max is not None and d_dur is not None:
            rounded_dur = int(round(float(d_dur) / 5.0) * 5)
            rounded_depth = int(round(float(d_max) / 5.0) * 5)
            b_key = f"{rounded_dur}|{rounded_depth}"
            bubble_counts[b_key] = bubble_counts.get(b_key, 0) + 1

        # Regex Extraction from dive_information
        extracted_sac = None
        extracted_temp = None

        if d_info:
            temp_match = re.search(r"Water Temp:\s*([0-9.]+)", str(d_info))
            if temp_match:
                extracted_temp = float(temp_match.group(1))

            sac_match = re.search(r"SAC:\s*([0-9.]+)", str(d_info))
            if sac_match:
                extracted_sac = float(sac_match.group(1))

        # Attempt to calculate Real SAC if structured gas data
        if d_gas and d_dur and d_avg:
            try:
                if str(d_gas).startswith('{'):
                    gas_data = json.loads(d_gas)
                    if gas_data.get('mode') == 'structured':
                        bg = gas_data.get('back_gas', {})
                        t_vol = float(bg.get('tank', 0))
                        p_start = float(bg.get('start_pressure', 0))
                        p_end = float(bg.get('end_pressure', 0))
                        
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
                pass 

        # Append valid points
        if extracted_sac and d_max:
            sac_val = round(extracted_sac, 2)
            sac_vs_depth.append({"depth": float(d_max), "sac": sac_val})
            if date_str:
                sac_over_time.append({"date": date_str, "sac": sac_val})

        if extracted_temp and d_suit:
            s_name = d_suit.value if hasattr(d_suit, 'value') else str(d_suit)
            temp_vs_suit.append({"suit": s_name, "temp": extracted_temp})

        if d_max and d_avg and date_str:
            depth_over_time.append({
                "date": date_str, 
                "max": float(d_max), 
                "avg": float(d_avg)
            })

    # Format remaining charts
    duration_vs_depth = [
        {"duration": int(k.split('|')[0]), "depth": int(k.split('|')[1]), "count": v}
        for k, v in bubble_counts.items()
    ]
    dives_per_year = [
        {"year": k, "count": v} 
        for k, v in sorted(year_counts.items())
    ]
```

- [ ] **Step 3: Update `DivingStatsResponse` instantiation**

In the same file, update the return response:

```python
    diving_stats = DivingStatsResponse(
      # ... existing assignments
      temp_vs_suit=temp_vs_suit,
      dives_per_year=dives_per_year,
      sac_over_time=sac_over_time,
      depth_over_time=depth_over_time
    )
```

- [ ] **Step 4: Run backend tests**

Run: `cd backend && ./docker-test-github-actions.sh`
Expected: "All tests passed!"

- [ ] **Step 5: Commit**

```bash
echo "feat(backend): implement time-series data extraction for analytics" > commit-message.txt
```

### Task 2: Update Frontend Component

**Files:**
- Modify: `frontend/src/components/AdvancedAnalytics.jsx`
- Modify: `frontend/src/pages/UserAnalytics.jsx`

- [ ] **Step 1: Add new imports**

In `frontend/src/components/AdvancedAnalytics.jsx`, update the recharts imports:
```jsx
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line
} from 'recharts';
```

- [ ] **Step 2: Update component props**

In `frontend/src/components/AdvancedAnalytics.jsx`, update the function signature:
```jsx
const AdvancedAnalytics = ({ sacData, durationData, tempData, yearlyData, sacTimeData, depthTimeData }) => {
  const hasSacData = sacData && sacData.length > 0;
  const hasDurationData = durationData && durationData.length > 0;
  const hasTempData = tempData && tempData.length > 0;
  const hasYearlyData = yearlyData && yearlyData.length > 0;
  const hasSacTimeData = sacTimeData && sacTimeData.length > 0;
  const hasDepthTimeData = depthTimeData && depthTimeData.length > 0;

  if (!hasSacData && !hasDurationData && !hasTempData && !hasYearlyData && !hasSacTimeData && !hasDepthTimeData) return null;
```

- [ ] **Step 3: Render the new charts**

Append these three blocks to the bottom of the `AdvancedAnalytics` return statement (before the final `</div>`):

```jsx
      {/* Dives per Year Bar Chart */}
      {hasYearlyData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>
            Dives per Year
          </h3>
          <p className='text-xs text-gray-500 mb-4'>
            Annual dive activity and progression.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={yearlyData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <YAxis tick={{ fontSize: 10 }} stroke='#9ca3af' allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '0.375rem', border: '1px solid #f3f4f6', fontSize: '14px' }}
                />
                <Bar name="Dives" dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SAC Evolution Line Chart */}
      {hasSacTimeData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>
            SAC Evolution
          </h3>
          <p className='text-xs text-gray-500 mb-4'>
            Air consumption rate changes over time.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={sacTimeData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }} 
                  stroke='#9ca3af' 
                  tickFormatter={(val) => val.substring(0, 7)} // Show YYYY-MM
                />
                <YAxis unit="L" tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <Tooltip
                  contentStyle={{ borderRadius: '0.375rem', border: '1px solid #f3f4f6', fontSize: '14px' }}
                />
                <Line type="monotone" name="SAC" dataKey="sac" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Depth Evolution Multi-Line Chart */}
      {hasDepthTimeData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>
            Depth Progression
          </h3>
          <p className='text-xs text-gray-500 mb-4'>
            Maximum and average depths reached over time.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={depthTimeData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }} 
                  stroke='#9ca3af' 
                  tickFormatter={(val) => val.substring(0, 7)}
                />
                <YAxis reversed={true} unit="m" tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <Tooltip
                  contentStyle={{ borderRadius: '0.375rem', border: '1px solid #f3f4f6', fontSize: '14px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconType="plainline" />
                <Line type="monotone" name="Max Depth" dataKey="max" stroke="#1d4ed8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" name="Avg Depth" dataKey="avg" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Update props passed from parent**

In `frontend/src/pages/UserAnalytics.jsx`, update the `AdvancedAnalytics` render block:

```jsx
        {/* Other Advanced Analytics */}
        <AdvancedAnalytics
          sacData={profile.diving_stats?.sac_vs_depth}
          durationData={profile.diving_stats?.duration_vs_depth}
          tempData={profile.diving_stats?.temp_vs_suit}
          yearlyData={profile.diving_stats?.dives_per_year}
          sacTimeData={profile.diving_stats?.sac_over_time}
          depthTimeData={profile.diving_stats?.depth_over_time}
        />
```

- [ ] **Step 5: Run Frontend Linter**

Run: `make lint-frontend`
Expected: Completes without errors.

- [ ] **Step 6: Commit**

```bash
echo "feat(frontend): add time-series charts to advanced analytics" > commit-message.txt
```