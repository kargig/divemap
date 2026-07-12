# Owner Experience Shortcuts and Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement frictionless shortcuts and context-adaptive layouts for diving center owners on Divemap, introducing a direct "My Shop" navigation button, a dedicated dashboard snippet on the home page, and unified manager roster controls on the editing page.

**Architecture:** Create a backend endpoint GET `/api/v1/diving-centers/managed` to fetch centers owned or managed by the current user, extend the frontend client, add dynamic conditionally-rendered shortcuts to Desktop/Mobile navbars, update the Home page hero view, and integrate the team management component directly into the center edit layout.

**Tech Stack:** Python (FastAPI, SQLAlchemy), React, React Query, Tailwind CSS.

---

### Task 1: Backend GET `/managed` Endpoint Implementation

**Files:**
- Modify: `backend/tests/test_diving_centers.py`
- Modify: `backend/app/routers/diving_centers.py`

- [ ] **Step 1: Write the failing tests**
  Add the following test methods inside `backend/tests/test_diving_centers.py` to assert correct fetching of owned/managed centers:

```python
    def test_get_my_managed_diving_centers_success(self, client, auth_headers, test_user, test_diving_center, db_session):
        """Test getting diving centers owned or managed by the current user."""
        from app.models import OwnershipStatus, DivingCenterManager
        
        # Make test_user the approved owner of the center
        test_diving_center.owner_id = test_user.id
        test_diving_center.ownership_status = OwnershipStatus.approved
        db_session.commit()

        # Query endpoint
        response = client.get("/api/v1/diving-centers/managed", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == test_diving_center.id
        assert data[0]["is_manager"] is True
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd backend && ./docker-test-github-actions.sh tests/test_diving_centers.py`
  Expected: FAIL with `404 Not Found` for `/api/v1/diving-centers/managed` (or conflict with dynamic route)

- [ ] **Step 3: Write minimal implementation**
  Add the `/managed` route at the very top of `backend/app/routers/diving_centers.py` (before any dynamic route like `/{diving_center_id}`) to avoid conflicts:

```python
@router.get("/managed", response_model=List[DivingCenterResponse])
async def get_my_managed_diving_centers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all diving centers owned or managed by the current user."""
    # 1. Fetch centers owned
    owned_centers = db.query(DivingCenter).filter(
        and_(DivingCenter.owner_id == current_user.id, DivingCenter.ownership_status == OwnershipStatus.approved)
    ).all()

    # 2. Fetch centers managed (from DivingCenterManager)
    managed_centers = db.query(DivingCenter).join(
        DivingCenterManager, DivingCenter.id == DivingCenterManager.diving_center_id
    ).filter(DivingCenterManager.user_id == current_user.id).all()

    # Combine lists avoiding duplicates
    all_centers = {c.id: c for c in owned_centers + managed_centers}.values()

    response_list = []
    for center in all_centers:
        logo_full_url = r2_storage.get_photo_url(center.logo_url) if center.logo_url else None
        
        response_list.append(
            DivingCenterResponse(
                id=center.id,
                name=center.name,
                description=center.description,
                address=center.address,
                email=center.email,
                phone=center.phone,
                website=center.website,
                latitude=center.latitude,
                longitude=center.longitude,
                country=center.country,
                region=center.region,
                city=center.city,
                logo_url=center.logo_url,
                logo_full_url=logo_full_url,
                ownership_status=center.ownership_status.value if center.ownership_status else None,
                owner_username=center.owner.username if center.owner else None,
                is_manager=True
            )
        )
    return response_list
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd backend && ./docker-test-github-actions.sh tests/test_diving_centers.py`
  Expected: PASS

- [ ] **Step 5: Commit**
  Stage `backend/app/routers/diving_centers.py` and `backend/tests/test_diving_centers.py`.

---

### Task 2: Frontend Service Layer Extension

**Files:**
- Modify: `frontend/src/services/divingCenters.js`

- [ ] **Step 1: Write client method**
  Add the `getManagedDivingCenters` API client method:

```javascript
/**
 * Fetch all diving centers owned or managed by the logged-in user.
 * @returns {Promise<Array>} List of managed diving centers
 */
export const getManagedDivingCenters = async () => {
  const response = await api.get('/api/v1/diving-centers/managed');
  return response.data;
};
```

- [ ] **Step 2: Verify linting**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage `frontend/src/services/divingCenters.js`.

---

### Task 3: Navbar "My Shop" Dynamic Shortcuts (Suggestion A)

**Files:**
- Modify: `frontend/src/components/NavbarDesktopControls.jsx`
- Modify: `frontend/src/components/NavbarMobileControls.jsx`

- [ ] **Step 1: Update Desktop Navbar**
  Import `getManagedDivingCenters` and check if there are managed centers to conditionally render the "My Shop" shortcut link:

```javascript
import { getManagedDivingCenters } from '../services/divingCenters';
```

At the top of the component, query the managed centers:
```javascript
  const { data: managedCenters = [] } = useQuery(
    ['my-managed-diving-centers', user?.id],
    getManagedDivingCenters,
    {
      enabled: !!user,
      staleTime: 10 * 60 * 1000, // 10 minutes cache
    }
  );

  const primaryCenter = managedCenters[0];
```

Insert the "My Shop" shortcut link before the global search or in the desktop links list if `primaryCenter` exists:
```jsx
        {primaryCenter && (
          <Link
            to={`/diving-centers/${primaryCenter.id}/${slugify(primaryCenter.name)}`}
            className='flex items-center space-x-1 text-white hover:text-blue-200 transition-colors font-bold'
          >
            <Building className='h-6 w-6 text-yellow-300' />
            <span className='text-sm'>My Shop</span>
          </Link>
        )}
```

- [ ] **Step 2: Update Mobile Navbar**
  Perform similar implementation inside `NavbarMobileControls.jsx` to render a gorgeous "My Shop" shortcut link under mobile drawers/dropdowns.

- [ ] **Step 3: Verify linting**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 4: Commit**
  Stage the modifications.

---

### Task 4: Home Page Portal Adaptive Snip (Suggestion B)

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: Implement Owner/Manager Greeting Dashboard Snippet**
  Import `getManagedDivingCenters` inside `Home.jsx` and render a high-signal management card at the top of the page below the main banner if the user is a business manager, showing shortcuts to announcements and trip logging.

```javascript
import { getManagedDivingCenters } from '../services/divingCenters';
```

Query the user's shops:
```javascript
  const { data: managedCenters = [] } = useQuery(
    ['my-managed-diving-centers', user?.id],
    getManagedDivingCenters,
    {
      enabled: !!user,
      staleTime: 10 * 60 * 1000,
    }
  );

  const primaryCenter = managedCenters[0];
```

If `primaryCenter` is loaded, display the business portal snippet card below the hero section:
```jsx
      {primaryCenter && (
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-4'>
          <div className='bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
            <div>
              <h3 className='text-xs font-bold uppercase tracking-wider text-blue-600 mb-1'>Business Portal</h3>
              <h2 className='text-2xl font-bold text-gray-900'>Welcome back to {primaryCenter.name}!</h2>
              <p className='text-sm text-gray-500 mt-1 leading-relaxed'>
                Manage your storefront details, create dive trips for followers, post announcements, or manage shop staff managers.
              </p>
            </div>
            <div className='flex gap-3 flex-wrap w-full md:w-auto'>
              <Link
                to={`/diving-centers/${primaryCenter.id}/edit`}
                className='inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm px-4 py-2 border border-gray-200 rounded-xl transition-all shadow-sm w-full sm:w-auto justify-center'
              >
                <Settings className='h-4 w-4' />
                <span>Edit Profile</span>
              </Link>
              <Link
                to={`/diving-centers/${primaryCenter.id}/aegean-sea-dive-center?tab=manage`}
                className='inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-sm w-full sm:w-auto justify-center'
              >
                <Bell className='h-4 w-4' />
                <span>Shop Roster & Team</span>
              </Link>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Verify linting**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage the Home page updates.

---

### Task 5: Roster Management Integration on Edit Page (Suggestion C)

**Files:**
- Modify: `frontend/src/pages/EditDivingCenter.jsx`

- [ ] **Step 1: Add "Team Management" tab to profile edit sidebar**
  Integrate the dynamic team manager roster fields directly inside `/diving-centers/{id}/edit` so that the shop owner has one unified workspace to configure both public profile details and authorized staff managers.

- [ ] **Step 2: Verify linting & browser rendering**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage the edit layout modifications.
