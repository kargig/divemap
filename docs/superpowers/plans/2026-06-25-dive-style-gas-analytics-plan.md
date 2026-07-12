# Advanced Dive Style & Gas Mix Heatmap Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive, visually cohesive extension of user advanced dive analytics introducing a balanced 8-axis (octagonal) Dive Style Radar Chart and a safety-integrated Gas Mix vs. Depth Heatmap.

**Architecture:** Extend the FastAPI `/analytics` read path to dynamically process dive tags and parsed gas bottles, then render these on the React frontend using highly interactive and responsive Recharts and Tailwind matrix grids.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Pydantic), React (Tailwind CSS, Recharts)

## Global Constraints
- Automatic git commits are forbidden. Always ask for confirmation before preparing commit messages.
- DO NOT use `git add` or `git restore` under any circumstance.
- Every frontend modification MUST be verified by visiting the affected page using Chrome DevTools and ensuring Zero Console Errors.
- SQLite is NOT supported for backend testing. Use the ephemeral MySQL-backed docker script `./docker-test-github-actions.sh`.

---

### Task 1: Update API Contracts & Pydantic Schemas

**Files:**
- Modify: `backend/app/schemas/__init__.py:811-821`

**Interfaces:**
- Consumes: None (Updates output schema)
- Produces: `AdvancedAnalyticsResponse` with:
  - `dive_style_radar: List[Dict[str, Any]] = []`
  - `boat_dive_pct: Optional[float] = 0.0`
  - `shore_dive_pct: Optional[float] = 0.0`
  - `gas_mix_heatmap: List[Dict[str, Any]] = []`

- [ ] **Step 1: Write the schema changes**

Edit `backend/app/schemas/__init__.py` using `replace` tool:

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
>>>>
```

- [ ] **Step 2: Run backend test environment compilation to verify schema integration**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_privacy.py`
Expected: `All tests passed!` or test suite compiles cleanly without syntax or import errors.

---

### Task 2: Backend Logic - Aggregation & Parsing

**Files:**
- Modify: `backend/app/routers/users.py:1090-1346`
- Create: `backend/tests/test_analytics_adv.py`

**Interfaces:**
- Consumes: User's public dive tags and structured/unstructured gas column details.
- Produces: Aggregated radar chart dimensions, logistics percentages, and gas-vs-depth heatmap matrix data inside the output response.

- [ ] **Step 1: Write the failing TDD test case first**

Create `backend/tests/test_analytics_adv.py` with:

```python
import pytest
from fastapi import status
from app.models import Dive, AvailableTag, DiveTag

def test_user_advanced_analytics_extensions(client, db_session, test_user, normal_user_token):
    # Setup test tags
    reef_tag = db_session.query(AvailableTag).filter(AvailableTag.name == "Reef").first()
    if not reef_tag:
        reef_tag = AvailableTag(name="Reef")
        db_session.add(reef_tag)
    
    wreck_tag = db_session.query(AvailableTag).filter(AvailableTag.name == "Wreck").first()
    if not wreck_tag:
        wreck_tag = AvailableTag(name="Wreck")
        db_session.add(wreck_tag)
        
    db_session.commit()

    # Create dummy dives
    dive1 = Dive(
        user_id=test_user.id,
        max_depth=15.0,
        average_depth=10.0,
        duration=45,
        dive_date="2026-06-01",
        is_private=False,
        gas_bottles_used='{"mode": "structured", "back_gas": {"tank": "12", "start_pressure": 200, "end_pressure": 50, "gas": {"o2": 32, "he": 0}}}'
    )
    db_session.add(dive1)
    db_session.flush()

    # Assign tags
    db_session.add(DiveTag(dive_id=dive1.id, tag_id=reef_tag.id))
    db_session.add(DiveTag(dive_id=dive1.id, tag_id=wreck_tag.id))
    db_session.commit()

    response = client.get(
        f"/api/users/{test_user.username}/analytics",
        headers={"Authorization": f"Bearer {normal_user_token}"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Assert radar style contains expected subjects
    assert "dive_style_radar" in data
    subjects = [item["subject"] for item in data["dive_style_radar"]]
    assert "Reef & Eco" in subjects
    assert "Wreck & History" in subjects
    
    # Assert gas mix heatmap has mapped nitrox bin
    assert "gas_mix_heatmap" in data
    assert len(data["gas_mix_heatmap"]) > 0
```

- [ ] **Step 2: Verify test fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_analytics_adv.py`
Expected: FAIL with `KeyError: 'dive_style_radar'` (fields missing from final returned dict).

- [ ] **Step 3: Implement parsing & aggregation logic in backend user router**

Modify `backend/app/routers/users.py` right before the `return AdvancedAnalyticsResponse(...)` line at the very end of `get_user_advanced_analytics`:

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
      weight_over_time=weight_over_time
    )
====
    # 1. Dive Style Radar Aggregation
    style_counts = {
        "Reef & Eco": 0,
        "Wreck & History": 0,
        "Deep & Technical": 0,
        "Drift & Wall": 0,
        "Cave & Overhead": 0,
        "Night & Shadow": 0,
        "Photography": 0,
        "Training": 0
    }
    boat_dives = 0
    shore_dives = 0
    total_logistics_dives = 0

    # Query all tags associated with these dives
    dive_ids = [row[0] for row in advanced_query] if advanced_query else []
    all_dive_tags = []
    if dive_ids:
        all_dive_tags = db.query(DiveTag.dive_id, AvailableTag.name).join(AvailableTag).filter(
            DiveTag.dive_id.in_(dive_ids)
        ).all()

    # Map tag names to dimensions
    for d_id, tag_name in all_dive_tags:
        lower_tag = tag_name.lower()
        if any(term in lower_tag for term in ["reef", "coral", "shallow", "fish", "flora", "marine"]):
            style_counts["Reef & Eco"] += 1
        elif any(term in lower_tag for term in ["wreck", "shipwreck", "rust", "iron", "metal"]):
            style_counts["Wreck & History"] += 1
        elif any(term in lower_tag for term in ["deep", "deco", "tech", "technical"]):
            style_counts["Deep & Technical"] += 1
        elif any(term in lower_tag for term in ["drift", "wall", "current"]):
            style_counts["Drift & Wall"] += 1
        elif any(term in lower_tag for term in ["cave", "cavern", "overhead", "cenote"]):
            style_counts["Cave & Overhead"] += 1
        elif "night" in lower_tag:
            style_counts["Night & Shadow"] += 1
        elif "photography" in lower_tag or "photo" in lower_tag:
            style_counts["Photography"] += 1
        elif "training" in lower_tag or "course" in lower_tag:
            style_counts["Training"] += 1
        elif "boat" in lower_tag:
            boat_dives += 1
            total_logistics_dives += 1
        elif "shore" in lower_tag:
            shore_dives += 1
            total_logistics_dives += 1

    dive_style_radar = [
        {"subject": k, "value": v, "fullMark": max(style_counts.values()) if style_counts.values() and max(style_counts.values()) > 0 else 100}
        for k, v in style_counts.items()
    ]
    
    boat_dive_pct = round((boat_dives / total_logistics_dives) * 100.0, 1) if total_logistics_dives > 0 else 0.0
    shore_dive_pct = round((shore_dives / total_logistics_dives) * 100.0, 1) if total_logistics_dives > 0 else 0.0

    # 2. Gas Mix vs Max Depth Heatmap
    gas_mix_counts = {}
    
    def parse_gas_mix(gas_str):
        if not gas_str:
            return "Air"
        try:
            if str(gas_str).startswith('{'):
                data = json.loads(gas_str)
                if data.get('mode') == 'structured':
                    bg = data.get('back_gas', {})
                    gas = bg.get('gas', {})
                    o2 = gas.get('o2')
                    he = gas.get('he')
                    
                    if o2 is not None:
                        o2_val = float(o2)
                        he_val = float(he) if he is not None else 0
                        
                        if he_val > 0:
                            return "Trimix"
                        elif o2_val <= 21:
                            return "Air"
                        elif o2_val == 32:
                            return "Nitrox 32"
                        elif o2_val == 36:
                            return "Nitrox 36"
                        elif 21 < o2_val <= 50:
                            return "Nitrox (Other)"
                        elif o2_val > 50:
                            return "Deco Gas"
        except:
            pass
            
        lower_str = str(gas_str).lower()
        if 'trimix' in lower_str or 'tx' in lower_str:
            return "Trimix"
        elif 'nitrox 32' in lower_str or 'ean32' in lower_str or 'nx32' in lower_str:
            return "Nitrox 32"
        elif 'nitrox 36' in lower_str or 'ean36' in lower_str or 'nx36' in lower_str:
            return "Nitrox 36"
        elif 'nitrox' in lower_str or 'nx' in lower_str or 'ean' in lower_str:
            return "Nitrox (Other)"
        elif 'o2' in lower_str or 'oxygen' in lower_str or 'deco' in lower_str:
            return "Deco Gas"
        return "Air"

    def get_gas_depth_bin(depth):
        if depth is None:
            return None
        d = float(depth)
        if d <= 18: return "0-18m"
        if d <= 30: return "18-30m"
        if d <= 40: return "30-40m"
        if d <= 50: return "40-50m"
        return "50m+"

    for d_id, d_max, d_dur, d_suit, d_info, d_gas, d_avg, d_date in advanced_query:
        if d_max is not None:
            gas_mix_label = parse_gas_mix(d_gas)
            depth_bin = get_gas_depth_bin(d_max)
            if depth_bin:
                key = f"{gas_mix_label}|{depth_bin}"
                gas_mix_counts[key] = gas_mix_counts.get(key, 0) + 1

    gas_mix_heatmap = [
        {"mix": k.split('|')[0], "depth_bin": k.split('|')[1], "count": v}
        for k, v in gas_mix_counts.items()
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
      gas_mix_heatmap=gas_mix_heatmap
    )
>>>>
```

- [ ] **Step 4: Run test to verify passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_analytics_adv.py`
Expected: `All tests passed!`

---

### Task 3: Create the `DiveStyleRadar` Frontend Component

**Files:**
- Create: `frontend/src/components/DiveStyleRadar.jsx`

**Interfaces:**
- Consumes: `data: Array` and `boat_pct: float`, `shore_pct: float` as props.
- Produces: Visual 8-axis (octagonal) Radar Chart displaying thematic styles and logistics percentage labels.

- [ ] **Step 1: Write the component code**

Create `frontend/src/components/DiveStyleRadar.jsx` with:

```jsx
import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import { Shield, Anchor, Compass } from 'lucide-react';

const DiveStyleRadar = ({ data, boatPct = 0, shorePct = 0 }) => {
  if (!data || data.length === 0) {
    return <p className='text-gray-500 text-sm mt-2'>Not enough tag data to map dive styles.</p>;
  }

  // Calculate highest count to find the primary archetype
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const topDimension = sortedData[0]?.subject || 'Explorer';
  const hasMultipleStyles = sortedData[0]?.value > 0;

  const getArchetypeLabel = dimension => {
    if (!hasMultipleStyles) return 'General Explorer';
    const labels = {
      'Reef & Eco': 'Marine Biologist & Eco Enthusiast',
      'Wreck & History': 'Sunken History Hunter',
      'Deep & Technical': 'Technical Deep Diver',
      'Drift & Wall': 'Adrenaline Drift & Wall Rider',
      'Cave & Overhead': 'Cave & Cavern Penetration Specialist',
      'Night & Shadow': 'Nocturnal Aquatic Observer',
      'Photography': 'Creative Underwater Photographer',
      'Training': 'Active Instructor / Student Learner',
    };
    return labels[dimension] || 'Adventurer';
  };

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 items-center'>
        {/* Radar Map Column */}
        <div>
          <h3 className='text-md font-semibold text-gray-800 mb-1 flex items-center gap-2'>
            <Compass className='w-5 h-5 text-blue-600' />
            Dive Style Radar Chart
          </h3>
          <p className='text-xs text-gray-500 mb-6'>
            Mappings based on your 16 active logged dive tags.
          </p>
          <div className='h-64 w-full flex justify-center'>
            <ResponsiveContainer width='100%' height='100%'>
              <RadarChart cx='50%' cy='50%' outerRadius='75%' data={data}>
                <PolarGrid stroke='#e2e8f0' />
                <PolarAngleAxis dataKey='subject' tick={{ fontSize: 9, fill: '#64748b', fontWeight: '600' }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9 }} stroke='#94a3b8' />
                <Radar
                  name='Style'
                  dataKey='value'
                  stroke='#2563eb'
                  fill='#2563eb'
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Summary & Archetype Column */}
        <div className='flex flex-col justify-between h-full py-2'>
          <div>
            <h4 className='text-sm font-semibold text-gray-700 mb-2'>Diver Persona Archetype</h4>
            <div className='inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold rounded-full mb-4'>
              <Shield className='w-3.5 h-3.5' />
              {getArchetypeLabel(topDimension)}
            </div>
            <p className='text-xs text-gray-500 leading-relaxed mb-6'>
              Your logged tags indicate a strong preference for {topDimension.toLowerCase()} diving. 
              Keep logging dives and assigning tags to see how your dive style evolves over time!
            </p>
          </div>

          {/* Logistics Summary */}
          {(boatPct > 0 || shorePct > 0) && (
            <div className='bg-gray-50 p-4 rounded-xl border border-gray-100'>
              <h5 className='text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider flex items-center gap-1.5'>
                <Anchor className='w-4 h-4 text-blue-500' />
                Logistics & Entry Preference
              </h5>
              <div className='flex gap-4 items-center text-sm'>
                {boatPct > 0 && (
                  <div className='flex-1'>
                    <div className='flex justify-between text-xs font-medium text-gray-700 mb-1'>
                      <span>Boat / Charter</span>
                      <span>{boatPct}%</span>
                    </div>
                    <div className='w-full bg-gray-200 h-1.5 rounded-full overflow-hidden'>
                      <div className='bg-blue-600 h-1.5 rounded-full' style={{ width: `${boatPct}%` }} />
                    </div>
                  </div>
                )}
                {shorePct > 0 && (
                  <div className='flex-1'>
                    <div className='flex justify-between text-xs font-medium text-gray-700 mb-1'>
                      <span>Shore / Coastal</span>
                      <span>{shorePct}%</span>
                    </div>
                    <div className='w-full bg-gray-200 h-1.5 rounded-full overflow-hidden'>
                      <div className='bg-sky-500 h-1.5 rounded-full' style={{ width: `${shorePct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiveStyleRadar;
```

---

### Task 4: Create the `GasMixHeatmap` Frontend Component

**Files:**
- Create: `frontend/src/components/GasMixHeatmap.jsx`

**Interfaces:**
- Consumes: `data: Array` of occurrences as prop.
- Produces: Visually stunning, warning-highlighted safety heatmap representation.

- [ ] **Step 1: Write the component code**

Create `frontend/src/components/GasMixHeatmap.jsx` with:

```jsx
import React from 'react';
import { HelpCircle } from 'lucide-react';

const GAS_MIXES = ['Trimix', 'Nitrox 32', 'Nitrox 36', 'Nitrox (Other)', 'Deco Gas', 'Air'];
const DEPTH_BINS = ['0-18m', '18-30m', '30-40m', '40-50m', '50m+'];

const GasMixHeatmap = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className='text-gray-500 text-sm mt-2'>Not enough gas bottle details to generate heatmap.</p>;
  }

  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Helper for color intensity matching existing standards
  const getColor = count => {
    if (count === 0) return 'bg-gray-50';
    const ratio = count / maxCount;
    if (ratio <= 0.2) return 'bg-blue-100';
    if (ratio <= 0.4) return 'bg-blue-300';
    if (ratio <= 0.6) return 'bg-blue-500';
    if (ratio <= 0.8) return 'bg-blue-700';
    return 'bg-blue-900';
  };

  // Check safe Maximum Operating Depth (MOD) based on PO2 limit of 1.4 bar
  const isMODExceeded = (mix, bin) => {
    if (mix === 'Nitrox 32' && ['30-40m', '40-50m', '50m+'].includes(bin)) return true;
    if (mix === 'Nitrox 36' && ['30-40m', '40-50m', '50m+'].includes(bin)) return true;
    if (mix === 'Deco Gas' && ['18-30m', '30-40m', '40-50m', '50m+'].includes(bin)) return true;
    return false;
  };

  // Convert array to dictionary for quick lookup
  const dataMap = data.reduce((acc, item) => {
    acc[`${item.mix}|${item.depth_bin}`] = item.count;
    return acc;
  }, {});

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow text-center'>
      <h3 className='text-md font-semibold text-gray-800 mb-1 flex items-center justify-center gap-2'>
        Gas Mix vs. Maximum Depth Heatmap
      </h3>
      <p className='text-xs text-gray-500 mb-6'>
        Breathing gas usage counts mapped to maximum depth ranges.
      </p>

      <div className='flex justify-center overflow-x-auto pb-4'>
        <div className='flex min-w-max'>
          {/* Y-Axis Labels (Gas Mixes) */}
          <div className='flex flex-col gap-1 pr-3 mt-[52px] sm:mt-[64px]'>
            {GAS_MIXES.map(mix => (
              <div
                key={mix}
                className='h-8 sm:h-12 lg:h-14 flex items-center justify-end text-[10px] sm:text-xs font-semibold text-gray-500 w-24 text-right'
              >
                {mix}
              </div>
            ))}
          </div>

          {/* Grid Matrix Area */}
          <div>
            {/* X-Axis Labels (Depth bins) */}
            <div className='flex gap-1 mb-2'>
              {DEPTH_BINS.map(bin => (
                <div key={bin} className='w-8 sm:w-16 lg:w-20 relative h-10 sm:h-12'>
                  <span className='absolute bottom-0 left-1/2 text-[10px] sm:text-xs text-gray-500 origin-bottom-left -rotate-45 whitespace-nowrap font-semibold'>
                    {bin}
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix Cells */}
            <div className='flex gap-1'>
              {DEPTH_BINS.map(bin => (
                <div key={bin} className='flex flex-col gap-1'>
                  {GAS_MIXES.map(mix => {
                    const count = dataMap[`${mix}|${bin}`] || 0;
                    const modViolation = isMODExceeded(mix, bin) && count > 0;

                    return (
                      <div
                        key={`${mix}-${bin}`}
                        className={`w-8 h-8 sm:w-16 sm:h-12 lg:w-20 lg:h-14 rounded-sm transition-all hover:ring-2 hover:ring-blue-400 group relative cursor-help flex flex-col items-center justify-center ${
                          modViolation 
                            ? 'bg-rose-50 border-2 border-rose-300 hover:ring-rose-400' 
                            : getColor(count)
                        }`}
                        title={
                          count > 0
                            ? `${count} dive(s): ${mix} used at Max depth ${bin}${modViolation ? ' (⚠️ Exceeds safe 1.4 bar MOD)' : ''}`
                            : '0 dives'
                        }
                      >
                        {count > 0 && (
                          <span
                            className={`text-[10px] sm:text-xs font-semibold ${
                              modViolation 
                                ? 'text-rose-700' 
                                : count > maxCount * 0.4 ? 'text-white' : 'text-gray-700'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                        {modViolation && (
                          <span className='text-[7px] sm:text-[9px] text-rose-600 font-bold bg-white px-0.5 rounded shadow-sm scale-90 sm:scale-100 mt-0.5'>
                            ⚠️ MOD
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-gray-500 mt-4 border-t border-gray-50 pt-4'>
        <HelpCircle className='w-4 h-4 text-gray-400' />
        <span>MOD warning dynamically flags high partial pressure of oxygen (PO2 &gt; 1.4 bar) safety limits.</span>
      </div>
    </div>
  );
};

export default GasMixHeatmap;
```

---

### Task 5: Integrate New Components & Validate

**Files:**
- Modify: `frontend/src/pages/UserAnalytics.jsx:8-133`

**Interfaces:**
- Consumes: `DiveStyleRadar` and `GasMixHeatmap` components to display them beautifully on the main user advanced analytics tab.

- [ ] **Step 1: Update page imports and layout rendering**

Edit `frontend/src/pages/UserAnalytics.jsx` using `replace` tool:

```jsx
<<<<
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
====
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
import DiveStyleRadar from '../components/DiveStyleRadar';
import GasMixHeatmap from '../components/GasMixHeatmap';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
>>>>
```

And in the rendering container:

```jsx
<<<<
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
====
        {/* Analytics Content */}
        <div className='space-y-8 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-inner'>
          {/* Depth Density Heatmap */}
          {analytics?.depth_density_heatmap && analytics.depth_density_heatmap.length > 0 ? (
            <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-2 sm:p-6 hover:shadow-md transition-shadow'>
              <DepthDensityHeatmap data={analytics.depth_density_heatmap} />
            </div>
          ) : null}

          {/* Dive Style Radar Chart */}
          {analytics?.dive_style_radar && analytics.dive_style_radar.length > 0 ? (
            <DiveStyleRadar 
              data={analytics.dive_style_radar} 
              boatPct={analytics.boat_dive_pct}
              shorePct={analytics.shore_dive_pct}
            />
          ) : null}

          {/* Gas Mix vs Max Depth Heatmap */}
          {analytics?.gas_mix_heatmap && analytics.gas_mix_heatmap.length > 0 ? (
            <GasMixHeatmap data={analytics.gas_mix_heatmap} />
          ) : null}

          {/* Other Advanced Analytics */}
          <AdvancedAnalytics
>>>>
```

- [ ] **Step 2: Run local frontend linter and make sure compile is warning-free**

Run: `make lint-frontend`
Expected: Passes cleanly or zero styling errors generated inside `frontend-lint-errors.log`.

- [ ] **Step 3: Verify the changes render beautifully inside the headless browser**

Navigate: `mcp_chrome-devtools_navigate_page` to `https://divemap.blue/users/MMaresca/analytics` (or your local URL if running, or refresh the loaded tab).
Take Snapshot: `mcp_chrome-devtools_take_snapshot`
List console logs: `mcp_chrome-devtools_list_console_messages`
Expected: All visual elements loaded, no layout squishing, and ZERO console errors outputted!
