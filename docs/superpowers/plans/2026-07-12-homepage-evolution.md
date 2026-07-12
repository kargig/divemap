# Homepage Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and polish the Divemap homepage into a highly dynamic, immersive, and interactive experience for first-time visitors while preserving user privacy and mobile responsiveness.

**Architecture:** We will create a responsive, fluid 3-Slide Morphing Hero Carousel inside `Home.jsx` combining brand introduction, the fuzzy search bar, live community statistics, and the daily featured widget with slow-moving wave SVG bottom masks and micro-bubbles CSS animations. Below the features grid, we will add the "Scuba Sandbox" tabbed micro-calculator card, and replace the redundant bottom CTA with a privacy-safe "Live Pulse" recent activity widget loaded from a new public backend endpoint.

**Tech Stack:** React (Vite, Tailwind CSS, Lucide Icons, Axios, React Query), Python (FastAPI, SQLAlchemy, MySQL).

## Global Constraints

- **Browser Verification:** Every frontend modification MUST be verified by visiting the affected page(s) using the browser MCP tools.
- **Console Errors:** Check the browser console for errors after every navigation or interaction; zero console errors are the target.
- **No Horizontal Scrolling on Mobile:** Horizontal scrolling on mobile is strictly forbidden; use wrapping, grids, or vertical stacking to fit contents.
- **Privacy First (Zero-PII Compliance):** No sensitive relational PII (like friendship connections) is displayed. All displayed items use public usernames and public site names. No emails, real names, coordinates, or private logs are exposed.
- **Ecosystem tool utilization:** Always use existing linting and formatting commands (e.g. `make lint-frontend`) to verify the frontend.

---

### Task 1: Backend Endpoint for Public Recent Activity

**Files:**
- Modify: `backend/app/main.py:780-820`
- Test: `backend/tests/test_public_recent_activity.py`

**Interfaces:**
- Consumes: SQLAlchemy Models (`Dive`, `SiteRating`, `DiveSite`, `User`)
- Produces: API GET Endpoint `/api/v1/public/recent-activity` returning a list of the 4 most recent public events formatted as:
  ```json
  [
    {
      "event_type": "dive_logged" | "site_review" | "site_added",
      "username": "Alex_Diver",
      "site_id": 142,
      "site_name": "Blue Hole",
      "rating": 5,
      "created_at": "2026-07-12T14:32:00Z"
    }
  ]
  ```

- [ ] **Step 1: Create the failing unit test file**

Write `/home/kargig/src/divemap/backend/tests/test_public_recent_activity.py` to assert correct responses and PII sanitization.

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_get_public_recent_activity(client: TestClient):
    response = client.get("/api/v1/public/recent-activity")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 4
    for item in data:
        # Assert strict PII compliance
        assert "email" not in item
        assert "first_name" not in item
        assert "last_name" not in item
        assert "coordinates" not in item
        assert "event_type" in item
        assert "username" in item
        assert "site_id" in item
        assert "site_name" in item
```

- [ ] **Step 2: Run test to verify it fails**

Run inside the backend context:
`cd backend && ./docker-test-github-actions.sh tests/test_public_recent_activity.py`
Expected: FAIL with `404 Not Found` (endpoint not defined)

- [ ] **Step 3: Implement the FastAPI GET Endpoint**

Modify `backend/app/main.py` below the `/api/v1/stats` endpoint to query and return public recent activities safely.

```python
@app.get("/api/v1/public/recent-activity")
async def get_public_recent_activity(db: Session = Depends(get_db)):
    """Get the 4 most recent public community activities securely with zero PII leakage."""
    try:
        activities = []

        # 1. Recent public dive logs
        recent_dives = (
            db.query(Dive)
            .filter(Dive.is_private == False, Dive.dive_site_id != None)
            .order_by(Dive.created_at.desc())
            .limit(4)
            .all()
        )
        for d in recent_dives:
            activities.append({
                "event_type": "dive_logged",
                "username": d.user.username if d.user else "Anonymous",
                "site_id": d.dive_site_id,
                "site_name": d.dive_site.name if d.dive_site else "Unknown Site",
                "rating": None,
                "created_at": d.created_at.isoformat() if d.created_at else None
            })

        # 2. Recent public site ratings
        recent_ratings = (
            db.query(SiteRating)
            .order_by(SiteRating.created_at.desc())
            .limit(4)
            .all()
        )
        for r in recent_ratings:
            activities.append({
                "event_type": "site_review",
                "username": r.user.username if r.user else "Anonymous",
                "site_id": r.dive_site_id,
                "site_name": r.dive_site.name if r.dive_site else "Unknown Site",
                "rating": int(r.score / 2) if r.score else None,  # Conver scale 1-10 to 1-5 stars
                "created_at": r.created_at.isoformat() if r.created_at else None
            })

        # 3. Recent newly added public dive sites
        recent_sites = (
            db.query(DiveSite)
            .order_by(DiveSite.created_at.desc())
            .limit(4)
            .all()
        )
        for s in recent_sites:
            activities.append({
                "event_type": "site_added",
                "username": s.user.username if s.user else "Anonymous",
                "site_id": s.id,
                "site_name": s.name,
                "rating": None,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })

        # Combine, sort, and truncate to the 4 most recent public events
        activities = [a for a in activities if a["created_at"] is not None]
        activities.sort(key=lambda x: x["created_at"], reverse=True)
        return activities[:4]

    except Exception as e:
        return []
```

- [ ] **Step 4: Run test to verify it passes**

Run:
`cd backend && ./docker-test-github-actions.sh tests/test_public_recent_activity.py`
Expected: PASS and prints `All tests passed!`

- [ ] **Step 5: Commit backend changes**

Prepare a commit for the backend endpoint and tests.

---

### Task 2: Frontend API Integration

**Files:**
- Modify: `frontend/src/api.js`

**Interfaces:**
- Consumes: `/api/v1/public/recent-activity` Endpoint
- Produces: `export const getRecentActivity = async () => { ... }`

- [ ] **Step 1: Write API function**

Add the endpoint helper to `frontend/src/api.js` below `/api/v1/stats` or at the end of the file.

```javascript
export const getRecentActivity = async () => {
  const response = await api.get('/api/v1/public/recent-activity');
  return response.data;
};
```

- [ ] **Step 2: Verify code style**

Run: `make lint-frontend` inside project root to ensure no linting warnings are generated.

---

### Task 3: Refactor Home.jsx and Implement Morphing Hero Carousel

**Files:**
- Modify: `frontend/src/pages/Home.jsx:600-670`

**Interfaces:**
- Consumes: `getRecentActivity` from `api.js` and existing components/hooks.
- Produces: Fluid, state-managed 3-slide morphing hero banner.

- [ ] **Step 1: Add Carousel State and Hover Listeners**

Modify `frontend/src/pages/Home.jsx` to load and manage carousel rotation state.
```javascript
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);
```

- [ ] **Step 2: Implement Slide 1 (Intro + Fuzzy Search Integration)**

Ensure the existing `<FuzzySearchInput />` or similar search bar is embedded inline.
```jsx
{activeSlide === 0 && (
  <div className="hero-slide active transition-all duration-500 text-center">
    <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md mb-4">
      <span class="text-white text-3xl">🤿</span>
    </div>
    <h1 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight text-gray-900 mb-4">
      Discover Amazing <span className="text-blue-600">Dive Sites</span>
    </h1>
    <p className="text-gray-600 text-base max-w-md mx-auto mb-6">
      Explore the world's best scuba locations, read reviews from fellow divers, and find your next underwater adventure.
    </p>
    <div className="max-w-md mx-auto px-4">
      {/* Existing fuzzy search box in project */}
      <FuzzySearchInput className="shadow-lg rounded-xl" placeholder="Search for Blue Hole, Zenobia..." />
    </div>
  </div>
)}
```

- [ ] **Step 3: Implement Slide 2 (Community Stats Card)**

Render the interactive counters directly inside slide 2.
```jsx
{activeSlide === 1 && (
  <div className="hero-slide active transition-all duration-500 text-center px-4">
    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 inline-block">
      Our Growing Community
    </span>
    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Real-time Dive Statistics</h2>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
      <Link to="/dives" className="text-center bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all">
        <div className="text-2xl font-extrabold text-blue-600">
          <AnimatedCounter targetValue={stats?.dives || 0} isBackendAvailable={isBackendAvailable} />
        </div>
        <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px] mt-1">Dives Logged</div>
      </Link>
      <Link to="/dive-sites" className="text-center bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all">
        <div className="text-2xl font-extrabold text-blue-600">
          <AnimatedCounter targetValue={stats?.dive_sites || 0} isBackendAvailable={isBackendAvailable} />
        </div>
        <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px] mt-1">Dive Sites</div>
      </Link>
      <Link to="/dive-sites" className="text-center bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all">
        <div className="text-2xl font-extrabold text-blue-600">
          <AnimatedCounter targetValue={stats?.reviews || 0} isBackendAvailable={isBackendAvailable} />
        </div>
        <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px] mt-1">Reviews</div>
      </Link>
      <Link to="/diving-centers" className="text-center bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all col-span-1">
        <div className="text-2xl font-extrabold text-blue-600">
          <AnimatedCounter targetValue={stats?.diving_centers || 0} isBackendAvailable={isBackendAvailable} />
        </div>
        <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px] mt-1">Centers</div>
      </Link>
      <Link to="/dive-trips" className="text-center bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all col-span-2 md:col-span-1">
        <div className="text-2xl font-extrabold text-blue-600">
          <AnimatedCounter targetValue={stats?.dive_trips || 0} isBackendAvailable={isBackendAvailable} />
        </div>
        <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px] mt-1">Organized Trips</div>
      </Link>
    </div>
  </div>
)}
```

- [ ] **Step 4: Implement Slide 3 (Daily Featured Widget)**

Render `DailyFeatureSnippet` directly in Slide 3.
```jsx
{activeSlide === 2 && (
  <div className="hero-slide active transition-all duration-500 text-center px-4 max-w-3xl mx-auto">
    <div className="flex items-center justify-center gap-2 mb-2">
      <span className="bg-yellow-400 text-yellow-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
        ★ Daily Feature
      </span>
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {currentWidget.category}
      </span>
    </div>
    <h2 className="text-2xl font-bold text-gray-900 mb-4">{currentWidget.title}</h2>
    <div className="mb-6">
      <DailyFeatureSnippet />
    </div>
    <Link to={currentWidget.ctaLink} className="text-sm font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
      {currentWidget.ctaText} →
    </Link>
  </div>
)}
```

- [ ] **Step 5: Apply animated Wave SVG Bottom Mask and micro-bubbles styling**

Render wave mask overlay and circular micro-bubbles at the bottom of the hero wrapper div in `Home.jsx`. Add the CSS animation definitions inside `index.css` or inline styles.

---

### Task 4: Remove Redundant Old Sections

**Files:**
- Modify: `frontend/src/pages/Home.jsx:798-874`, `Home.jsx:893-925`

- [ ] **Step 1: Locate and Delete Stats Banner Section**

Surgically remove lines 798-874 of `frontend/src/pages/Home.jsx` which rendered the old standalone Stats section.

- [ ] **Step 2: Locate and Delete Daily Feature Section**

Surgically remove lines 893-925 of `frontend/src/pages/Home.jsx` which rendered the old standalone Daily Feature section.

- [ ] **Step 3: Run linter verification**

Run: `make lint-frontend` to verify no orphaned tags or variables remain.

---

### Task 5: Implement "Scuba Sandbox" Interactive Component

**Files:**
- Create: `frontend/src/components/calculators/ScubaSandbox.jsx`
- Modify: `frontend/src/pages/Home.jsx` (embed ScubaSandbox)
- Test: `frontend/src/components/calculators/ScubaSandbox.test.jsx`

**Interfaces:**
- Consumes: `calculateMOD` and other formulas from `utils/physics.js`.
- Produces: `<ScubaSandbox />` component displaying interactive tab-based calculators (MOD, Best Mix, Weight).

- [ ] **Step 1: Create ScubaSandbox.jsx**

Write the complete code for the lightweight tabbed calculator component.

```jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { calculateMOD } from '../../utils/physics';

const SUIT_MULTIPLIERS = {
  skin: { label: 'Swimsuit / Skin', mult: 0.01, offset: 1 },
  w3mm: { label: '3mm Wetsuit', mult: 0.05, offset: 0 },
  w5mm: { label: '5mm Wetsuit', mult: 0.08, offset: 0 },
  w7mm: { label: '7mm Wetsuit', mult: 0.1, offset: 2 },
  dry: { label: 'Drysuit', mult: 0.1, offset: 4 }
};

export default function ScubaSandbox() {
  const [activeTab, setActiveTab] = useState('mod');

  // MOD State
  const [modO2, setModO2] = useState(32);
  const [modPO2, setModPO2] = useState(1.4);

  // Best Mix State
  const [mixDepth, setMixDepth] = useState(30);
  const [mixPO2, setMixPO2] = useState(1.4);

  // Weight State
  const [weightKg, setWeightKg] = useState(80);
  const [weightSuit, setWeightSuit] = useState('w5mm');
  const [weightWater, setWeightWater] = useState('salt');

  // Derived Calculations
  const calculatedMOD = calculateMOD({ o2: modO2, he: 0 }, parseFloat(modPO2));
  
  const rawBestMixO2 = (parseFloat(mixPO2) / ((mixDepth + 10) / 10)) * 100;
  const calculatedBestMix = Math.min(Math.max(Math.floor(rawBestMixO2), 21), 40);

  const suit = SUIT_MULTIPLIERS[weightSuit];
  const baseWeight = weightKg * suit.mult + suit.offset;
  const saltWaterAdj = weightWater === 'salt' ? weightKg * 0.025 : 0;
  const calculatedLeadMin = Math.max(Math.round(baseWeight + saltWaterAdj - 1), 1);
  const calculatedLeadMax = Math.round(baseWeight + saltWaterAdj + 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden max-w-xl mx-auto my-12">
      <div className="bg-blue-50/50 p-5 border-b border-gray-100 text-center">
        <h3 className="text-lg font-extrabold text-gray-900">🧮 Scuba Sandbox</h3>
        <p className="text-xs text-gray-500 mt-1">Instant, interactive dive planning calculators</p>
      </div>

      <div className="flex border-b border-gray-100">
        {['mod', 'mix', 'weight'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-3 text-xs font-bold capitalize transition-colors ${
              activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t === 'mod' ? 'Max Depth (MOD)' : t === 'mix' ? 'Nitrox Best Mix' : 'Buoyancy Weight'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'mod' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Oxygen Percentage: {modO2}%</label>
              <input type="range" min="21" max="40" value={modO2} onChange={e => setModO2(parseInt(e.target.value))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Max ppO2 Limit: {modPO2} bar</label>
              <input type="range" min="1.2" max="1.6" step="0.1" value={modPO2} onChange={e => setModPO2(parseFloat(e.target.value))} className="w-full accent-blue-600" />
            </div>
            <div className="bg-blue-50/80 p-4 rounded-xl text-center border border-blue-100/50">
              <span className="text-xs text-gray-500 block">Maximum Operating Depth</span>
              <span className="text-3xl font-black text-blue-600 mt-1 block">{calculatedMOD.toFixed(1)} m</span>
            </div>
          </div>
        )}

        {activeTab === 'mix' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Target Max Depth: {mixDepth} meters</label>
              <input type="range" min="10" max="40" value={mixDepth} onChange={e => setMixDepth(parseInt(e.target.value))} className="w-full accent-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Max ppO2 Limit: {mixPO2} bar</label>
              <input type="range" min="1.2" max="1.6" step="0.1" value={mixPO2} onChange={e => setMixPO2(parseFloat(e.target.value))} className="w-full accent-blue-600" />
            </div>
            <div className="bg-blue-50/80 p-4 rounded-xl text-center border border-blue-100/50">
              <span className="text-xs text-gray-500 block">Recommended Nitrox Blend</span>
              <span className="text-3xl font-black text-blue-600 mt-1 block">EAN{calculatedBestMix}</span>
            </div>
          </div>
        )}

        {activeTab === 'weight' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Your Weight: {weightKg} kg</label>
              <input type="range" min="40" max="120" value={weightKg} onChange={e => setWeightKg(parseInt(e.target.value))} className="w-full accent-blue-600" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-600 mb-1">Wetsuit Type</label>
                <select value={weightSuit} onChange={e => setWeightSuit(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {Object.entries(SUIT_MULTIPLIERS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-600 mb-1">Water Type</label>
                <select value={weightWater} onChange={e => setWeightWater(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <option value="salt">Salt Water (Ocean)</option>
                  <option value="fresh">Fresh Water (Lake)</option>
                </select>
              </div>
            </div>
            <div className="bg-blue-50/80 p-4 rounded-xl text-center border border-blue-100/50">
              <span className="text-xs text-gray-500 block">Recommended Lead Weight</span>
              <span className="text-2xl font-black text-blue-600 mt-1 block">{calculatedLeadMin} - {calculatedLeadMax} kg</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center">
        <Link to="/calculators" className="text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline">
          View All Advanced Calculators (Trimix, Gas Planning, SAC) →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Embed `<ScubaSandbox />` in Home.jsx**

Import and place the `<ScubaSandbox />` component directly below the main features card grid, and above the bottom recent activities section.

- [ ] **Step 3: Write simple test**

Create `frontend/src/components/calculators/ScubaSandbox.test.jsx` to assert rendering and slider computations are accurate.

---

### Task 6: Implement "Live Pulse" Recent Activity Feed

**Files:**
- Modify: `frontend/src/pages/Home.jsx` bottom section

- [ ] **Step 1: Load and Query Recent Activity**

```javascript
  const { data: recentActivity = [] } = useQuery(
    ['recent-activity'],
    getRecentActivity,
    {
      refetchInterval: 30000, // Refresh activity feed every 30s
      staleTime: 20000,
    }
  );
```

- [ ] **Step 2: Render Live Pulse Timeline**

Replace the old bottom duplicated CTA with the styled recent activity cards.
```jsx
<section className="mb-16 px-4 max-w-4xl mx-auto">
  <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
      <span className="w-3 h-3 bg-emerald-500 rounded-full absolute"></span>
      <h2 className="text-2xl font-bold text-gray-900 ml-1">Live Community Pulse</h2>
    </div>
    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Real-time Activity</span>
  </div>

  <div className="grid grid-cols-1 gap-4">
    {recentActivity.map((activity, index) => (
      <div key={index} className="bg-white p-4 rounded-2xl border border-gray-100 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors flex items-start gap-4">
        <div className="text-2xl bg-blue-50 p-2.5 rounded-xl shrink-0">
          {activity.event_type === 'dive_logged' ? '🤿' : activity.event_type === 'site_review' ? '⭐' : '🚢'}
        </div>
        <div className="min-w-0 flex-1 leading-relaxed">
          <p className="text-sm text-gray-700">
            <span className="font-extrabold text-gray-900">{activity.username}</span>{' '}
            {activity.event_type === 'dive_logged' ? 'logged a new public dive at' : activity.event_type === 'site_review' ? 'rated' : 'discovered a new dive site:'}{' '}
            <Link to={`/dive-sites/${activity.site_id}`} className="text-blue-600 font-bold hover:underline">
              {activity.site_name}
            </Link>
            {activity.rating && (
              <span className="ml-1.5 text-yellow-500 font-bold">
                {'★'.repeat(activity.rating)}
              </span>
            )}
          </p>
        </div>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 3: Verify Mobile Flow**

Ensure that all text wraps smoothly and no cards introduce horizontal scrolling.

---

### Task 7: Verification and Polish

- [ ] **Step 1: Verify entire application builds and compiles**

Compile frontend bundle using the development container context to confirm there are no broken imports or typos.

- [ ] **Step 2: Browser Verification**

Use chrome devtools `list_console_messages` to ensure zero console errors are present and verify that pages render correctly.
