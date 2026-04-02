# B2C Profile Management and Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide diving center owners with management tools (tabs) on their profile, integrate the center's identity into trip details, and display upcoming trips on the center's profile.

**Architecture:** 
1. Re-use center identity blocks: Extract the top header of `DivingCenterDetail.jsx` into `DivingCenterSummaryCard.jsx` and use it in `TripDetail.jsx`.
2. Add tabs to `DivingCenterDetail.jsx`: "Overview", "Upcoming Trips", and (for owners/managers) "Management".
3. In "Upcoming Trips", re-use trip rendering logic (ideally by creating a `TripCard` component, but for speed, we can re-use the API and rendering logic).
4. In "Management", allow owners to send text-based custom broadcasts.

**Tech Stack:** React (Tailwind CSS), FastAPI.

---

### Task 1: Create Diving Center Summary Component

**Files:**
- Create: `frontend/src/components/DivingCenterSummaryCard.jsx`
- Modify: `frontend/src/pages/TripDetail.jsx`

- [ ] **Step 1: Create Summary Component**
Create `frontend/src/components/DivingCenterSummaryCard.jsx`. This component should take a `center` object and a `user` object. It should display the center's logo, name, location, and the "Message Us" and "Follow" buttons if the user is authenticated. Make sure to hook up the necessary React Query mutations for chat creation and following, just like in `DivingCenterDetail.jsx`.

- [ ] **Step 2: Use in TripDetail**
Modify `frontend/src/pages/TripDetail.jsx`. Inside the `{activeTab === 'diving-center' && (...)}` block, replace the simple text layout with `<DivingCenterSummaryCard center={divingCenter} user={user} />`.

- [ ] **Step 3: Run Frontend Linter**
Run: `make lint-frontend`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/DivingCenterSummaryCard.jsx frontend/src/pages/TripDetail.jsx
git commit -m "feat(ui): enrich diving center tab on trip details"
```

### Task 2: Add Tabs to Diving Center Profile

**Files:**
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

- [ ] **Step 1: Add Tab State**
In `DivingCenterDetail.jsx`, add `const [activeTab, setActiveTab] = useState('overview');`.

- [ ] **Step 2: Add Tab Navigation UI**
Add a tab navigation bar below the header section:
```jsx
<div className="border-b border-gray-200 mt-6 mb-6">
  <nav className="-mb-px flex space-x-8">
    <button
      onClick={() => setActiveTab('overview')}
      className={`${activeTab === 'overview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
    >
      Overview
    </button>
    <button
      onClick={() => setActiveTab('trips')}
      className={`${activeTab === 'trips' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
    >
      Upcoming Trips
    </button>
    {shouldShowEdit && (
      <button
        onClick={() => setActiveTab('manage')}
        className={`${activeTab === 'manage' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
      >
        Management
      </button>
    )}
  </nav>
</div>
```

- [ ] **Step 3: Wrap Existing Content**
Wrap the current description, contact info, ratings, and comments sections inside `{activeTab === 'overview' && ( ... )}`.

- [ ] **Step 4: Run Frontend Linter**
Run: `make lint-frontend`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/DivingCenterDetail.jsx
git commit -m "feat(ui): add tabs to diving center profile"
```

### Task 3: Implement Upcoming Trips Tab

**Files:**
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`
- Modify: `frontend/src/services/newsletters.js`

- [ ] **Step 1: Add API Fetch Logic**
In `DivingCenterDetail.jsx`, use `useQuery` to fetch trips for this center.
```javascript
  import { getParsedTrips } from '../services/newsletters';
  const { data: upcomingTripsData } = useQuery(
    ['center-trips', id],
    () => getParsedTrips({ diving_center_id: id, start_date: new Date().toISOString().split('T')[0] }),
    { enabled: activeTab === 'trips' }
  );
  const upcomingTrips = upcomingTripsData?.items || [];
```

- [ ] **Step 2: Render Trips**
Inside the `activeTab === 'trips'` block, map over `upcomingTrips` and display them using a simplified card (e.g., Trip Name, Date, Price, and a Link to the Trip Detail page).

- [ ] **Step 3: Commit**
```bash
git add frontend/src/pages/DivingCenterDetail.jsx
git commit -m "feat(ui): show upcoming trips on center profile"
```

### Task 4: Implement Management Tab & Broadcast Text API

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/routers/diving_centers.py`
- Modify: `frontend/src/services/divingCenters.js`
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`

- [ ] **Step 1: Backend Text Broadcast Schema**
Add to `backend/app/schemas/__init__.py`:
```python
class BroadcastTextRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
```

- [ ] **Step 2: Backend Text Broadcast Endpoint**
Add `POST /api/v1/diving-centers/{id}/broadcast/text` in `diving_centers.py` that behaves similarly to `broadcast_trip_to_followers` but accepts `BroadcastTextRequest` and sends a `message_type="TEXT"` to the broadcast room. (Ensure it also sends an SQS notification).

- [ ] **Step 3: Frontend API Client**
In `frontend/src/services/divingCenters.js`, add `broadcastTextMessage(centerId, message)`.

- [ ] **Step 4: Management Tab UI**
In `DivingCenterDetail.jsx` under `activeTab === 'manage'`, display:
1. "Broadcast Announcement" section with a textarea and "Send Broadcast" button. Connect it to a `useMutation` that calls `broadcastTextMessage`.
2. A generic placeholder text: "Follower management coming soon...".

- [ ] **Step 5: Run Tests**
Run: `cd backend && ./docker-test-github-actions.sh` and `make lint-frontend`.
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add backend/app/schemas/__init__.py backend/app/routers/diving_centers.py frontend/src/services/divingCenters.js frontend/src/pages/DivingCenterDetail.jsx
git commit -m "feat(b2c): add text broadcast management to center profile"
```