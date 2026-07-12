# Analytics Refactoring and New Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the backend to split advanced analytics into a new endpoint, enhance the Analytics UI header, and add three new charts for gas configurations and diving weights.

**Architecture:** Create `AdvancedAnalyticsResponse` in the schema. Move the `advanced_query` and data processing loop from `get_user_public_profile` into a new `get_user_advanced_analytics` endpoint, adding regex extraction for weights and JSON parsing for tank configs. Update the frontend `api.js` to fetch this new endpoint. Update `UserAnalytics.jsx` to display a large avatar header and render the three new Recharts components added to `AdvancedAnalytics.jsx`.

**Tech Stack:** Python, FastAPI, SQLAlchemy, React, Tailwind CSS, Recharts

---

### Task 1: Update Backend Schema

**Files:**
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Create AdvancedAnalyticsResponse**

In `backend/app/schemas/__init__.py`, remove the advanced fields from `DivingStatsResponse` and create the new `AdvancedAnalyticsResponse` schema.

```python
class DivingStatsResponse(BaseModel):
    max_depth: Optional[float] = None
    longest_dive_minutes: Optional[int] = None
    total_bottom_time_minutes: Optional[int] = None
    most_active_month: Optional[str] = None # e.g. "August 2024 (15 dives)"
    favorite_sites: List[FavoriteDiveSite] = []
    activity_heatmap: Dict[str, int] = {} # Date (YYYY-MM-DD) -> Dive Count
    suit_preferences: Dict[str, int] = {} # SuitType -> Count
    gear_preferences: Dict[str, int] = {}

class AdvancedAnalyticsResponse(BaseModel):
    depth_density_heatmap: List[Dict[str, Any]] = []
    sac_vs_depth: List[Dict[str, Any]] = []
    duration_vs_depth: List[Dict[str, Any]] = []
    temp_vs_suit: List[Dict[str, Any]] = []
    dives_per_year: List[Dict[str, int]] = []
    sac_over_time: List[Dict[str, Any]] = []
    depth_over_time: List[Dict[str, Any]] = []
    dives_per_gas_config: List[Dict[str, int]] = [] # [{"config": "Single 12L", "count": 10}]
    weight_vs_suit: List[Dict[str, Any]] = [] # [{"suit": "Wetsuit", "weight": 4.5}]
    weight_over_time: List[Dict[str, Any]] = [] # [{"date": "2024-05", "weight": 5.0, "suit": "Wetsuit"}]
```

- [ ] **Step 2: Commit**

```bash
echo "refactor(backend): separate AdvancedAnalyticsResponse from DivingStatsResponse schema" > commit-message.txt
```

### Task 2: Refactor Backend Endpoints and Add Data Extraction

**Files:**
- Modify: `backend/app/routers/users.py`

- [ ] **Step 1: Clean up get_user_public_profile**

In `backend/app/routers/users.py`, inside `get_user_public_profile`, delete the entire section marked `# Advanced Analytics Data (SAC, Temp, Duration, Time-Series)`. 

Remove the advanced parameters from the `DivingStatsResponse` instantiation in `get_user_public_profile`:
```python
    diving_stats = DivingStatsResponse(
      max_depth=float(stats_row.max_depth) if stats_row and stats_row.max_depth else None,
      longest_dive_minutes=int(stats_row.longest_dive_minutes) if stats_row and stats_row.longest_dive_minutes else None,
      total_bottom_time_minutes=int(stats_row.total_bottom_time_minutes) if stats_row and stats_row.total_bottom_time_minutes else None,
      most_active_month=most_active_month,
      favorite_sites=favorite_sites,
      activity_heatmap=activity_heatmap,
      suit_preferences=suit_preferences,
      gear_preferences=gear_preferences
    )
```

- [ ] **Step 2: Create get_user_advanced_analytics endpoint**

Add the new endpoint below `get_user_public_profile`:

```python
from app.schemas import AdvancedAnalyticsResponse

@router.get("/{username}/analytics", response_model=AdvancedAnalyticsResponse)
@skip_rate_limit_for_admin("60/minute")
async def get_user_advanced_analytics(
    request: Request,
    username: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == username, User.enabled == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    import json
    import re
    from app.physics import calculate_sac
    
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

    # Data structures
    sac_vs_depth = []
    temp_vs_suit = []
    weight_over_time = []
    
    bubble_counts = {}
    year_counts = {}
    gas_config_counts = {}
    
    sac_monthly_acc = {}
    depth_monthly_acc = {}
    weight_suit_acc = {}
    heatmap_counts = {}

    def get_max_bucket(depth):
        if depth < 10: return "0-10"
        if depth < 20: return "10-20"
        if depth < 30: return "20-30"
        if depth < 40: return "30-40"
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
        return "30+"

    def parse_tank_config(gas_str):
        if not gas_str: return None
        is_doubles = False
        has_stage = False
        size_label = ""
        
        try:
            if gas_str.startswith('{'):
                data = json.loads(gas_str)
                if data.get('mode') == 'structured':
                    tank = str(data.get('back_gas', {}).get('tank', '')).lower()
                    stages = data.get('stages', [])
                    has_stage = len(stages) > 0
                    
                    if 'double' in tank or 'twin' in tank or tank.startswith('d') or tank in ['14', '16', '20', '24', '30']:
                        is_doubles = True
                        if '14' in tank or '7' in tank: size_label = "D7"
                        elif '24' in tank or '12' in tank: size_label = "D12"
                        elif '16' in tank or '8' in tank: size_label = "D8"
                        elif '20' in tank or '10' in tank: size_label = "D10"
                        else: size_label = "Doubles"
                    else:
                        if '80' in tank: size_label = "S80"
                        elif '40' in tank: size_label = "S40"
                        elif '15' in tank: size_label = "Single 15L"
                        elif '12' in tank: size_label = "Single 12L"
                        elif '10' in tank: size_label = "Single 10L"
                        else: size_label = f"Single {tank.upper()}" if tank else "Single"
                    
                    return f"{size_label}{' + Stage' if has_stage else ''}"
        except:
            pass

        # Text fallback
        lower_str = gas_str.lower()
        has_stage = 'stage' in lower_str or '+' in lower_str
        is_doubles = 'double' in lower_str or 'twin' in lower_str or 'd12' in lower_str or 'd7' in lower_str
        
        if is_doubles:
            size_label = "D12" if '12' in lower_str else ("D7" if '7' in lower_str else "Doubles")
        else:
            size_label = "S80" if '80' in lower_str else ("Single 15L" if '15' in lower_str else ("Single 12L" if '12' in lower_str else "Single"))
            
        return f"{size_label}{' + Stage' if has_stage else ''}"


    for d_max, d_dur, d_suit, d_info, d_gas, d_avg, d_date in advanced_query:
        date_str = d_date.strftime("%Y-%m-%d") if d_date else None
        month_str = d_date.strftime("%Y-%m") if d_date else None
        
        if d_date:
            year_str = str(d_date.year)
            year_counts[year_str] = year_counts.get(year_str, 0) + 1

        if d_max is not None and d_dur is not None:
            rounded_dur = int(round(float(d_dur) / 5.0) * 5)
            rounded_depth = int(round(float(d_max) / 5.0) * 5)
            b_key = f"{rounded_dur}|{rounded_depth}"
            bubble_counts[b_key] = bubble_counts.get(b_key, 0) + 1

        if d_max is not None and d_avg is not None:
            max_b = get_max_bucket(float(d_max))
            avg_b = get_avg_bucket(float(d_avg))
            key = f"{max_b}|{avg_b}"
            heatmap_counts[key] = heatmap_counts.get(key, 0) + 1

        extracted_sac = None
        extracted_temp = None
        extracted_weight = None

        if d_info:
            temp_match = re.search(r"Water Temp:\s*([0-9.]+)", str(d_info))
            if temp_match:
                extracted_temp = float(temp_match.group(1))

            sac_match = re.search(r"SAC:\s*([0-9.]+)", str(d_info))
            if sac_match:
                extracted_sac = float(sac_match.group(1))
                
            weight_match = re.search(r"Weight[s]?:\s*([0-9.]+)\s*kg", str(d_info), re.IGNORECASE)
            if weight_match:
                extracted_weight = float(weight_match.group(1))

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
                            calculated_sac = calculate_sac(float(d_avg), float(d_dur), t_vol, p_start, p_end)
                            if calculated_sac > 0:
                                extracted_sac = calculated_sac
            except:
                pass 

        if extracted_sac and d_max:
            sac_val = round(extracted_sac, 2)
            sac_vs_depth.append({"depth": float(d_max), "sac": sac_val})
            if month_str:
                sac_monthly_acc.setdefault(month_str, []).append(sac_val)

        s_name = d_suit.value if hasattr(d_suit, 'value') else str(d_suit) if d_suit else None

        if extracted_temp and s_name:
            temp_vs_suit.append({"suit": s_name, "temp": extracted_temp})

        if extracted_weight and s_name:
            weight_suit_acc.setdefault(s_name, []).append(extracted_weight)
            if date_str:
                weight_over_time.append({"date": date_str, "weight": extracted_weight, "suit": s_name})

        if d_max and d_avg and month_str:
            acc = depth_monthly_acc.setdefault(month_str, {"max": [], "avg": []})
            acc["max"].append(float(d_max))
            acc["avg"].append(float(d_avg))
            
        config_label = parse_tank_config(d_gas)
        if config_label:
            gas_config_counts[config_label] = gas_config_counts.get(config_label, 0) + 1

    depth_density_heatmap = [
        {"max_bin": k.split('|')[0], "avg_bin": k.split('|')[1], "count": v}
        for k, v in heatmap_counts.items()
    ]
    duration_vs_depth = [
        {"duration": int(k.split('|')[0]), "depth": int(k.split('|')[1]), "count": v}
        for k, v in bubble_counts.items()
    ]
    dives_per_year = [
        {"year": k, "count": v} 
        for k, v in sorted(year_counts.items())
    ]
    dives_per_gas_config = [
        {"config": k, "count": v} 
        for k, v in sorted(gas_config_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    weight_vs_suit = [
        {"suit": k, "weight": round(sum(v) / len(v), 2)} 
        for k, v in weight_suit_acc.items()
    ]
    sac_over_time = [
        {"date": k, "sac": round(sum(v) / len(v), 2)} 
        for k, v in sorted(sac_monthly_acc.items())
    ]
    depth_over_time = [
        {"date": k, "max": round(sum(v["max"]) / len(v["max"]), 2), "avg": round(sum(v["avg"]) / len(v["avg"]), 2)} 
        for k, v in sorted(depth_monthly_acc.items())
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
      weight_vs_suit=weight_vs_suit,
      weight_over_time=weight_over_time
    )
```

- [ ] **Step 3: Run backend tests**

Run: `cd backend && ./docker-test-github-actions.sh`
Expected: Tests pass.

- [ ] **Step 4: Commit**

```bash
echo "refactor(backend): split advanced analytics to new endpoint and extract tank/weight data" > commit-message.txt
```

### Task 3: Update Frontend API and Page Component

**Files:**
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/pages/UserAnalytics.jsx`

- [ ] **Step 1: Add API endpoint to `api.js`**

In `frontend/src/api.js`, add:
```javascript
export const getUserAdvancedAnalytics = async username => {
  const response = await api.get(`/users/${username}/analytics`);
  return response.data;
};
```
And export it along with `getUserPublicProfile`.

- [ ] **Step 2: Update UserAnalytics.jsx imports**

In `frontend/src/pages/UserAnalytics.jsx`, update the import:
```javascript
import { getUserPublicProfile, getUserAdvancedAnalytics } from '../api';
```

- [ ] **Step 3: Update UserAnalytics.jsx data fetching**

```javascript
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch both concurrently
        const [profileData, analyticsData] = await Promise.all([
          getUserPublicProfile(username),
          getUserAdvancedAnalytics(username)
        ]);
        setProfile(profileData);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.detail || 'Failed to load user analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);
```

- [ ] **Step 4: Update UserAnalytics.jsx UI Header**

Change the header to match `UserProfile.jsx` size, and update the data passing to use the `analytics` state instead of `profile.diving_stats`:

```javascript
  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in'>
      {/* Header */}
      <div className='mb-8 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-6 w-full text-center sm:text-left gap-4'>
        <div className='shrink-0 relative'>
           <Link 
            to={`/users/${username}`} 
            className='absolute -top-2 -left-2 z-10 p-1.5 bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm'
            title='Back to Profile'
          >
            <ArrowLeft className='w-4 h-4' />
          </Link>
          <Avatar
            src={profile.avatar_full_url || profile.avatar_url}
            username={username}
            size='xl'
            className='sm:w-32 sm:h-32 shadow-md'
          />
        </div>
        <div className='flex-1 min-w-0 w-full pt-2'>
          <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 truncate mb-2'>
            {username}
          </h1>
          <h2 className='text-xl text-gray-600 flex items-center justify-center sm:justify-start gap-2'>
            <Activity className='w-6 h-6 text-blue-600' />
            Advanced Analytics
          </h2>
        </div>
      </div>

      {/* Analytics Content */}
      <div className='space-y-8 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-inner'>
        
        {/* Depth Density Heatmap */}
        {analytics?.depth_density_heatmap && analytics.depth_density_heatmap.length > 0 ? (
          <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-2 sm:p-6 hover:shadow-md transition-shadow'>
            <DepthDensityHeatmap data={analytics.depth_density_heatmap} />
          </div>
        ) : null}

        {/* Other Advanced Analytics */}
        <AdvancedAnalytics
          sacData={analytics?.sac_vs_depth}
          durationData={analytics?.duration_vs_depth}
          tempData={analytics?.temp_vs_suit}
          yearlyData={analytics?.dives_per_year}
          sacTimeData={analytics?.sac_over_time}
          depthTimeData={analytics?.depth_over_time}
          gasConfigData={analytics?.dives_per_gas_config}
          weightSuitData={analytics?.weight_vs_suit}
          weightTimeData={analytics?.weight_over_time}
        />
      </div>
    </div>
  );
```

- [ ] **Step 5: Run Frontend Linter**

Run: `make lint-frontend`
Expected: Completes without errors.

- [ ] **Step 6: Commit**

```bash
echo "feat(frontend): integrate new analytics endpoint and update UI header" > commit-message.txt
```

### Task 4: Add New Charts to AdvancedAnalytics Component

**Files:**
- Modify: `frontend/src/components/AdvancedAnalytics.jsx`

- [ ] **Step 1: Update component props**

In `frontend/src/components/AdvancedAnalytics.jsx`, update the signature to accept the three new props: `gasConfigData`, `weightSuitData`, `weightTimeData`. 
Also add `hasGasConfigData = gasConfigData && gasConfigData.length > 0;` etc. to the boolean checks, and add them to the final `if (!hasSacData && ...)` return null check.

- [ ] **Step 2: Render Gas Config Bar Chart**

Append to the bottom of the return statement (before the final `</div>`):
```jsx
      {/* Gas Config Bar Chart */}
      {hasGasConfigData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>Dives per Gas Configuration</h3>
          <p className='text-xs text-gray-500 mb-4'>Frequency of specific tank setups.</p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={gasConfigData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis dataKey='config' tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <YAxis tick={{ fontSize: 10 }} stroke='#9ca3af' allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '0.375rem', border: '1px solid #f3f4f6', fontSize: '14px' }}
                />
                <Bar name='Dives' dataKey='count' fill='#10b981' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Render Weight vs Suit Bar Chart**

```jsx
      {/* Weight vs Suit Bar Chart */}
      {hasWeightSuitData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>Average Weight per Suit</h3>
          <p className='text-xs text-gray-500 mb-4'>Average lead carried (Kg) based on thermal protection.</p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={weightSuitData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis dataKey='suit' tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <YAxis unit="kg" tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <Tooltip
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '0.375rem', border: '1px solid #f3f4f6', fontSize: '14px' }}
                />
                <Bar name='Avg Weight (kg)' dataKey='weight' fill='#f59e0b' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Render Weight Evolution Scatter Chart**

```jsx
      {/* Weight Evolution Scatter */}
      {hasWeightTimeData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>Weight Evolution Over Time</h3>
          <p className='text-xs text-gray-500 mb-4'>Historical weight changes mapped to suit configurations.</p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis dataKey='date' type="category" tick={{ fontSize: 10 }} stroke='#9ca3af' tickFormatter={val => val.substring(0, 7)} />
                <YAxis dataKey='weight' type="number" unit="kg" tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className='bg-white p-3 border border-gray-100 shadow-lg rounded-md text-sm'>
                          <p><strong>Date:</strong> {data.date}<br/><strong>Suit:</strong> {data.suit}<br/><strong>Weight:</strong> {data.weight} kg</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* We use a single Scatter and map over points to color by suit */}
                <Scatter name='Weight' data={weightTimeData}>
                  {weightTimeData.map((entry, index) => (
                    <cell key={`cell-${index}`} fill={getSuitColor(entry.suit, index)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Run Frontend Linter**

Run: `make lint-frontend`
Expected: Completes without errors.

- [ ] **Step 6: Commit**

```bash
echo "feat(frontend): implement gas config and weight distribution charts" > commit-message.txt
```