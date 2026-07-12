# User Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive, gamified leaderboard system in Divemap to highlight top users and diving centers.

**Architecture:** A new FastAPI router for backend aggregations with short-term TTL caching, and a responsive React dashboard using a grid layout and TanStack Tables for the frontend.

**Tech Stack:** FastAPI, SQLAlchemy, cachetools, React (Vite), Tailwind CSS, TanStack Table, Lucide Icons.

---

### Task 1: Preparation

- [ ] **Step 1: Create Feature Branch**
    Run: `git checkout -b feature/user-leaderboard`
    *Note: Already completed, but included for completeness.*

- [ ] **Step 2: Install Backend Dependencies**
    Modify: `backend/requirements.txt`
    Add: `cachetools==5.3.3`
    Run: `pip install -r backend/requirements.txt`

### Task 2: Backend Schemas

**Files:**
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Define Leaderboard Schemas**
    Add the following schemas to `backend/app/schemas/__init__.py`:

```python
class LeaderboardUserEntry(BaseModel):
    user_id: int
    username: str
    avatar_url: Optional[str] = None
    count: int
    points: Optional[int] = None
    rank: int

class LeaderboardCenterEntry(BaseModel):
    center_id: int
    name: str
    logo_url: Optional[str] = None
    count: int
    rank: int

class LeaderboardResponse(BaseModel):
    metric: str
    entries: List[Union[LeaderboardUserEntry, LeaderboardCenterEntry]]
    updated_at: datetime
```

### Task 3: Backend Router (Aggregations & Caching)

**Files:**
- Create: `backend/app/routers/leaderboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Implement Leaderboard Logic with Caching**
    Create `backend/app/routers/leaderboard.py` with the following structure:
    - Use `cachetools.TTLCache(maxsize=100, ttl=600)` for 10-minute caching.
    - Implement functions for overall points, dives, sites, centers, edits, reviews, and comments.

- [ ] **Step 2: Register Router in Main App**
    Modify `backend/app/main.py` to include the new router:
    ```python
    from app.routers import leaderboard
    app.include_router(leaderboard.router, prefix="/api/v1/leaderboard", tags=["Leaderboard"])
    ```

### Task 4: Backend Testing (TDD)

**Files:**
- Create: `backend/tests/test_leaderboard.py`

- [ ] **Step 1: Write failing tests for Leaderboard endpoints**
- [ ] **Step 2: Run tests to verify failures**
    Run: `./backend/docker-test-github-actions.sh tests/test_leaderboard.py`
- [ ] **Step 3: Fix implementation to pass tests**
- [ ] **Step 4: Verify all tests pass**

### Task 5: Frontend Service

**Files:**
- Create: `frontend/src/services/leaderboard.js`

- [ ] **Step 1: Implement fetch functions**
    Add methods for `getOverallLeaderboard()`, `getCategoryLeaderboard(metric)`, and `getCenterLeaderboard()`.

### Task 6: Frontend Table Component

**Files:**
- Create: `frontend/src/components/tables/LeaderboardTable.jsx`

- [ ] **Step 1: Implement reusable TanStack Table**
    - Columns: Rank, User/Center (with Avatar/Logo), Count/Points.
    - Responsive: Hide certain columns on mobile if necessary.

### Task 7: Leaderboard Dashboard Page

**Files:**
- Create: `frontend/src/pages/LeaderboardPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Implement Responsive Grid View**
    - **Hero Section:** Top 3 Overall Users (large cards).
    - **Grid:** Category cards (Dives, Sites, Reviews, Comments) each showing Top 5.
    - **Mobile:** Single column stack. Desktop: 2 or 3 column grid.
- [ ] **Step 2: Add Route Registration**
    Register `/leaderboard` in `App.jsx`.

### Task 8: Navigation & Iconography

**Files:**
- Modify: `frontend/src/components/Navbar.jsx`

- [ ] **Step 1: Add Leaderboard Link**
    Add `<Trophy />` icon and "Leaderboard" text to desktop and mobile nav.
- [ ] **Step 2: Standardize Icons in Leaderboard UI**
    - Dives: `Notebook`
    - Sites: `MapPin`
    - Centers: `Warehouse`
    - Edits: `Edit`
    - Reviews: `Star`
    - Comments: `MessageCircle`

### Task 9: Final Verification

- [ ] **Step 1: Run Frontend Tests**
- [ ] **Step 2: Verify Responsive Design via Browser MCP**
    - Check Mobile (320px) and Desktop viewports.
    - Ensure zero console errors.
- [ ] **Step 3: Final Lint Check**
    Run: `make lint-frontend`
