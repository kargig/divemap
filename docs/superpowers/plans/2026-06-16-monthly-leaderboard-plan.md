# Monthly Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement interactive monthly user leaderboards on Divemap, updating the home page to highlight current month contributors and adding period-based filtering options to the main leaderboard screen.

**Architecture:** Add a caching `/users/monthly` GET API endpoint on the backend filtering the activities' timestamps within the requested month, extend the frontend API client layer, configure the Home page to query the current month's contributors, and refactor the Leaderboard page with period switching tabs.

**Tech Stack:** Python (FastAPI, SQLAlchemy), React, React Query, Tailwind CSS.

---

### Task 1: Backend API Endpoint Implementation

**Files:**
- Modify: `backend/tests/test_leaderboard.py`
- Modify: `backend/app/routers/leaderboard.py`

- [ ] **Step 1: Write the failing tests**
  Add the following test methods inside `backend/tests/test_leaderboard.py` as part of the `TestLeaderboard` class to verify monthly calculations:

```python
    def test_get_monthly_leaderboard_success(self, client, db_session, test_user):
        """Test getting monthly leaderboard for a specific month with data."""
        from datetime import datetime, timezone
        from app.models import Dive, DiveSite, OwnershipStatus
        
        # This month (current date)
        now = datetime.now(timezone.utc)
        
        # Log a dive in current month (10 pts)
        dive = Dive(user_id=test_user.id, dive_date=now.date(), created_at=now)
        db_session.add(dive)
        db_session.commit()
        
        # Log a dive in previous month (should not be counted in this month's leaderboard)
        from datetime import timedelta
        prev_month_date = now - timedelta(days=45)
        old_dive = Dive(user_id=test_user.id, dive_date=prev_month_date.date(), created_at=prev_month_date)
        db_session.add(old_dive)
        db_session.commit()

        # Query current month's leaderboard
        response = client.get(f"/api/v1/leaderboard/users/monthly?year={now.year}&month={now.month}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) > 0
        entry = next(e for e in data["entries"] if e["user_id"] == test_user.id)
        # Should only count the current month's dive (10 pts), not the old one
        assert entry["points"] == 10
        assert entry["rank"] == 1

    def test_get_monthly_leaderboard_empty(self, client):
        """Test monthly leaderboard for a month with no activity."""
        # Query next year (guaranteed empty)
        response = client.get("/api/v1/leaderboard/users/monthly?year=2030&month=1")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["entries"]) == 0
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd backend && ./docker-test-github-actions.sh tests/test_leaderboard.py`
  Expected: FAIL with `AttributeError` or `404 Not Found` for `/api/v1/leaderboard/users/monthly`

- [ ] **Step 3: Write minimal implementation**
  Add the `/users/monthly` route under the other user routes in `backend/app/routers/leaderboard.py`:

```python
@router.get("/users/monthly", response_model=LeaderboardUserResponse)
@cache(expire=600)  # 10 minutes cache
async def get_monthly_leaderboard(
    year: Optional[int] = Query(None, ge=1900, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get the monthly user leaderboard based on unified points system for a specific year and month."""
    import calendar
    from datetime import datetime, timezone
    from sqlalchemy import and_

    # Default to current UTC month/year if not specified
    if not year or not month:
        now = datetime.now(timezone.utc)
        year = year or now.year
        month = month or now.month

    _, last_day = calendar.monthrange(year, month)
    start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_date = datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    # Count subqueries with created_at filter
    dives_sub = db.query(Dive.user_id, func.count(Dive.id).label("cnt")).filter(and_(Dive.created_at >= start_date, Dive.created_at <= end_date)).group_by(Dive.user_id).subquery()
    sites_sub = db.query(DiveSite.created_by.label("user_id"), func.count(DiveSite.id).label("cnt")).filter(and_(DiveSite.created_at >= start_date, DiveSite.created_at <= end_date)).group_by(DiveSite.created_by).subquery()
    centers_sub = db.query(DivingCenter.owner_id.label("user_id"), func.count(DivingCenter.id).label("cnt")).filter(and_(DivingCenter.created_at >= start_date, DivingCenter.created_at <= end_date)).group_by(DivingCenter.owner_id).subquery()
    
    edits_sub = db.query(DiveSiteEditRequest.requested_by_id.label("user_id"), func.count(DiveSiteEditRequest.id).label("cnt")).filter(
        and_(
            DiveSiteEditRequest.status == 'approved',
            DiveSiteEditRequest.created_at >= start_date,
            DiveSiteEditRequest.created_at <= end_date
        )
    ).group_by(DiveSiteEditRequest.requested_by_id).subquery()

    d_media_sub = db.query(Dive.user_id, func.count(DiveMedia.id).label("cnt")).join(
        DiveMedia, Dive.id == DiveMedia.dive_id
    ).filter(
        and_(
            DiveMedia.created_at >= start_date,
            DiveMedia.created_at <= end_date
        )
    ).group_by(Dive.user_id).subquery()

    s_media_sub = db.query(SiteMedia.user_id, func.count(SiteMedia.id).label("cnt")).filter(
        and_(SiteMedia.created_at >= start_date, SiteMedia.created_at <= end_date)
    ).group_by(SiteMedia.user_id).subquery()
    
    s_ratings_sub = db.query(SiteRating.user_id, func.count(SiteRating.id).label("cnt")).filter(
        and_(SiteRating.created_at >= start_date, SiteRating.created_at <= end_date)
    ).group_by(SiteRating.user_id).subquery()

    c_ratings_sub = db.query(CenterRating.user_id, func.count(CenterRating.id).label("cnt")).filter(
        and_(CenterRating.created_at >= start_date, CenterRating.created_at <= end_date)
    ).group_by(CenterRating.user_id).subquery()
    
    s_comments_sub = db.query(SiteComment.user_id, func.count(SiteComment.id).label("cnt")).filter(
        and_(SiteComment.created_at >= start_date, SiteComment.created_at <= end_date)
    ).group_by(SiteComment.user_id).subquery()

    c_comments_sub = db.query(CenterComment.user_id, func.count(CenterComment.id).label("cnt")).filter(
        and_(CenterComment.created_at >= start_date, CenterComment.created_at <= end_date)
    ).group_by(CenterComment.user_id).subquery()

    # Calculate total points in SQL
    total_points_expr = (
        func.coalesce(dives_sub.c.cnt, 0) * POINTS["DIVE_LOGGED"] +
        func.coalesce(sites_sub.c.cnt, 0) * POINTS["DIVE_SITE_CREATED"] +
        func.coalesce(centers_sub.c.cnt, 0) * POINTS["DIVING_CENTER_CREATED"] +
        func.coalesce(edits_sub.c.cnt, 0) * POINTS["DIVE_SITE_EDITED"] +
        func.coalesce(d_media_sub.c.cnt, 0) * POINTS["DIVE_MEDIA_ADDED"] +
        func.coalesce(s_media_sub.c.cnt, 0) * POINTS["SITE_MEDIA_ADDED"] +
        (func.coalesce(s_ratings_sub.c.cnt, 0) + func.coalesce(c_ratings_sub.c.cnt, 0)) * POINTS["REVIEW_POSTED"] +
        (func.coalesce(s_comments_sub.c.cnt, 0) + func.coalesce(c_comments_sub.c.cnt, 0)) * POINTS["COMMENT_POSTED"]
    ).label("total_points")

    query = db.query(
        User.id,
        User.username,
        User.avatar_url,
        User.avatar_type,
        User.google_avatar_url,
        total_points_expr
    ).outerjoin(dives_sub, User.id == dives_sub.c.user_id)\
     .outerjoin(sites_sub, User.id == sites_sub.c.user_id)\
     .outerjoin(centers_sub, User.id == centers_sub.c.user_id)\
     .outerjoin(edits_sub, User.id == edits_sub.c.user_id)\
     .outerjoin(d_media_sub, User.id == d_media_sub.c.user_id)\
     .outerjoin(s_media_sub, User.id == s_media_sub.c.user_id)\
     .outerjoin(s_ratings_sub, User.id == s_ratings_sub.c.user_id)\
     .outerjoin(c_ratings_sub, User.id == c_ratings_sub.c.user_id)\
     .outerjoin(s_comments_sub, User.id == s_comments_sub.c.user_id)\
     .outerjoin(c_comments_sub, User.id == c_comments_sub.c.user_id)\
     .filter(total_points_expr > 0)\
     .order_by(desc("total_points"))\
     .limit(limit)

    results = query.all()
    
    entries = []
    for i, row in enumerate(results):
        entry = LeaderboardUserEntry(
            user_id=row.id,
            username=row.username,
            avatar_url=row.avatar_url,
            avatar_type=row.avatar_type or AvatarType.google,
            count=row.total_points,
            points=row.total_points,
            rank=i + 1
        )
        from collections import namedtuple
        UserMock = namedtuple('UserMock', ['avatar_url', 'avatar_type', 'google_avatar_url'])
        mock_user = UserMock(avatar_url=row.avatar_url, avatar_type=row.avatar_type, google_avatar_url=row.google_avatar_url)
        entry_dict = entry.model_dump()
        populated = populate_avatar_full_url(mock_user, entry_dict)
        entries.append(LeaderboardUserEntry(**populated))
            
    return LeaderboardUserResponse(
        metric=f"monthly_{year}_{month:02d}",
        entries=entries,
        updated_at=datetime.now(timezone.utc)
    )
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `cd backend && ./docker-test-github-actions.sh tests/test_leaderboard.py`
  Expected: PASS

- [ ] **Step 5: Commit**
  Stage `backend/app/routers/leaderboard.py` and `backend/tests/test_leaderboard.py`.

---

### Task 2: Frontend Service Layer Extension

**Files:**
- Modify: `frontend/src/services/leaderboard.js`

- [ ] **Step 1: Write minimal implementation**
  Add the `getMonthlyLeaderboard` endpoint service function:

```javascript
/**
 * Fetch the monthly user leaderboard based on unified points system.
 * @param {Object} params - Query parameters
 * @param {number} params.year - Year of leaderboard (default current year)
 * @param {number} params.month - Month of leaderboard (default current month)
 * @param {number} params.limit - Max number of entries
 * @returns {Promise<Object>} Leaderboard data
 */
export const getMonthlyLeaderboard = async (params = {}) => {
  const response = await api.get('/api/v1/leaderboard/users/monthly', { params });
  return response.data;
};
```

- [ ] **Step 2: Verify linting**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage `frontend/src/services/leaderboard.js`.

---

### Task 3: Home Page Integration

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: Update Home page contributors**
  Import `getMonthlyLeaderboard` instead of `getOverallLeaderboard` (or in addition to it) and update the contributors query to fetch the current month's leaderboard:

```javascript
// Replace import of getOverallLeaderboard with getMonthlyLeaderboard or import both:
import { getMonthlyLeaderboard } from '../services/leaderboard';
```

Replace the `useQuery` call for `overallData`:

```javascript
  const { data: overallData, isLoading: isLeaderboardLoading } = useQuery(
    ['leaderboard', 'monthly-current'],
    () => {
      const now = new Date();
      return getMonthlyLeaderboard({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        limit: 3,
      });
    }
  );
```

Update headers/labels in the UI from "Top Contributors" to "Top Contributors This Month" to make it extremely clear that it shows the current month's leaderboards:

```jsx
            <h2 className='text-3xl font-bold text-gray-900'>Top Contributors This Month</h2>
```

- [ ] **Step 2: Verify linting**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage `frontend/src/pages/Home.jsx`.

---

### Task 4: Leaderboard Page Period Selection Refactoring

**Files:**
- Modify: `frontend/src/pages/LeaderboardPage.jsx`

- [ ] **Step 1: Implement period state & UI switching**
  Refactor `LeaderboardPage.jsx` to dynamically determine the current month and previous 3 months. Let the user switch between these periods and "Overall" via tabs or selector, updating both the top 3 hero display and the Top Divers table accordingly.

In `LeaderboardPage.jsx`, import `getMonthlyLeaderboard` as well:

```javascript
import {
  getOverallLeaderboard,
  getCategoryLeaderboard,
  getCenterLeaderboard,
  getMonthlyLeaderboard, // New service function
} from '../services/leaderboard';
```

At the top of the component, implement the dynamic list of periods and the state hook:

```javascript
  // Generate periods for selection dynamically
  const periods = (() => {
    const arr = [];
    const now = new Date();
    
    // Monthly periods
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('default', { month: 'long' });
      arr.push({
        label: i === 0 ? `Current Month (${monthName} ${d.getFullYear()})` : `${monthName} ${d.getFullYear()}`,
        value: `monthly_${d.getFullYear()}_${d.getMonth() + 1}`,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        type: 'monthly'
      });
    }
    
    // Overall period
    arr.push({
      label: 'Overall (All-Time)',
      value: 'overall',
      type: 'overall'
    });
    
    return arr;
  })();

  const [selectedPeriod, setSelectedPeriod] = useState(periods[0].value);
```

Set up the query dynamically based on the selection:

```javascript
  const activePeriodObj = periods.find(p => p.value === selectedPeriod) || periods[0];

  const { data: periodLeaderboardData, isLoading: isPeriodLeaderboardLoading } = useQuery(
    ['leaderboard', selectedPeriod],
    () => {
      if (activePeriodObj.type === 'overall') {
        return getOverallLeaderboard({ limit: 10 });
      } else {
        return getMonthlyLeaderboard({
          year: activePeriodObj.year,
          month: activePeriodObj.month,
          limit: 10,
        });
      }
    }
  );

  const { data: centersData, isLoading: isCentersLoading } = useQuery(
    ['leaderboard', 'centers'],
    () => getCenterLeaderboard({ limit: 5 })
  );

  const topThree = periodLeaderboardData?.entries?.slice(0, 3) || [];
```

Replace the Hero Section and the "Overall Points" table container with the dynamic selections. Introduce a gorgeous tab selector or horizontal navigation bar for periods with beautiful Tailwind styles and responsive layouts:

```jsx
      {/* Period Tabs Selector */}
      <div className='mb-8 border-b border-gray-200 overflow-x-auto scrollbar-hide'>
        <nav className='-mb-px flex space-x-6 min-w-max'>
          {periods.map(period => {
            const isActive = selectedPeriod === period.value;
            return (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`pb-4 px-1 border-b-2 font-bold text-sm sm:text-base transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {period.label}
              </button>
            );
          })}
        </nav>
      </div>
```

Update the "Hero Section" and "Top Divers (Overall)" card text so that it says "Top Divers (Selected Period)":

```jsx
        {/* Dynamic Period Points - Full List */}
        <div className='md:col-span-2 lg:col-span-1 bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden'>
          <div className='p-4 bg-blue-600 text-white flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <Trophy className='w-5 h-5' />
              <h3 className='text-xl font-bold'>
                Top Divers ({activePeriodObj.type === 'overall' ? 'All-Time' : activePeriodObj.label.replace('Current Month ', '')})
              </h3>
            </div>
          </div>
          <div className='p-2'>
            <LeaderboardTable
              data={periodLeaderboardData?.entries}
              isLoading={isPeriodLeaderboardLoading}
              metricLabel='Total Points'
            />
          </div>
        </div>
```

- [ ] **Step 2: Verify linting & browser rendering**
  Run: `make lint-frontend`
  Expected: PASS

- [ ] **Step 3: Commit**
  Stage `frontend/src/pages/LeaderboardPage.jsx`.
