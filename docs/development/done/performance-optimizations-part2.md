# Performance Optimizations Plan - Part 2

This document outlines the detailed implementation plan for resolving backend N+1 cartesian product queries and implementing server-side request caching for static endpoints.

## 1. Eager Loading Cartesian Products (`joinedload` vs `selectinload`) (✅ FINISHED)

**Context:** SQLAlchemy's `joinedload` emits a `LEFT OUTER JOIN`. When used on One-to-Many collections, this creates a Cartesian product, returning thousands of duplicate rows that Python must deduplicate in memory, causing high CPU and memory usage.
**Action:** Replace `joinedload` with `selectinload` for all collection relationships. `selectinload` emits a highly optimized secondary `SELECT ... WHERE IN (...)` query.

### Files to Update:

#### `backend/app/routers/admin/dive_sites.py` (✅ FINISHED)
*   **Line ~56:** 
    *   *Current:* `joinedload(DiveSiteEditRequest.dive_site).joinedload(DiveSite.media)`
    *   *Change to:* `joinedload(DiveSiteEditRequest.dive_site).selectinload(DiveSite.media)`
    *   *Reason:* `media` is a collection (One-to-Many).

#### `backend/app/routers/admin/chat.py` (✅ FINISHED)
*   **Line ~90:** 
    *   *Current:* `session = db.query(ChatSession).options(joinedload(ChatSession.user), joinedload(ChatSession.messages)).filter(ChatSession.id == session_id).first()`
    *   *Change to:* `... options(joinedload(ChatSession.user), selectinload(ChatSession.messages)) ...`
    *   *Reason:* `messages` is a collection (One-to-Many).

#### `backend/app/routers/chat.py` (✅ FINISHED)
*   **Line ~155:** 
    *   *Current:* `session = db.query(ChatSession).options(joinedload(ChatSession.messages)).filter(...)`
    *   *Change to:* `session = db.query(ChatSession).options(selectinload(ChatSession.messages)).filter(...)`
    *   *Reason:* `messages` is a collection (One-to-Many).

#### `backend/app/routers/user_chat.py` (✅ FINISHED)
*   **Line ~281:** 
    *   *Current:* `joinedload(UserChatRoom.members).joinedload(UserChatRoomMember.user)`
    *   *Change to:* `selectinload(UserChatRoom.members).joinedload(UserChatRoomMember.user)`
    *   *Reason:* `members` is a collection (One-to-Many).

#### `backend/app/services/chat/executors/others.py` (✅ FINISHED)
*   **Line ~642:** 
    *   *Current:* `joinedload(DiveSite.center_relationships).joinedload(CenterDiveSite.diving_center)`
    *   *Change to:* `selectinload(DiveSite.center_relationships).joinedload(CenterDiveSite.diving_center)`
    *   *Reason:* `center_relationships` is a collection.

#### `backend/app/services/chat/executors/discovery.py` (✅ FINISHED)
*   **Line ~69:** 
    *   *Current:* `joinedload(DiveSite.ratings)`
    *   *Change to:* `selectinload(DiveSite.ratings)`
    *   *Reason:* `ratings` is a collection.

#### `backend/app/routers/dives/dives_db_utils.py` (✅ FINISHED)
*   **Line ~27-29:** 
    *   *Current:* 
        ```python
        joinedload(Dive.tags),
        joinedload(Dive.media)
        ```
    *   *Change to:* 
        ```python
        selectinload(Dive.tags),
        selectinload(Dive.media)
        ```
    *   *Reason:* `tags` and `media` are collections.


## 2. Server-Side Request Caching (✅ FINISHED)

**Context:** Static lists (like countries, regions, and system settings) are queried heavily by the frontend to populate dropdowns. Currently, these execute `SELECT DISTINCT` queries against the MySQL database every time. 
**Action:** Implement a caching layer (e.g., using `fastapi-cache2` or a custom lightweight in-memory cache) to store these responses and serve them instantly without hitting the database.

### Integration Steps: (✅ FINISHED)
1.  Add `fastapi-cache2` to `backend/requirements.txt`.
2.  Initialize the cache backend (e.g., `InMemoryBackend` or Redis if available) in `backend/app/main.py` on startup.

### Endpoints to Update:

#### `backend/app/routers/dive_sites.py` (✅ FINISHED)
*   **Function:** `get_unique_countries` (Line ~1966)
    *   *Change:* Import `from fastapi_cache.decorator import cache` and decorate the endpoint with `@cache(expire=3600)`.
    *   *Reason:* List of countries hosting dive sites changes extremely rarely. Caching for 1 hour saves constant DB hits.
*   **Function:** `get_unique_regions` (Line ~1978)
    *   *Change:* Decorate with `@cache(expire=3600)`.
    *   *Reason:* Same as countries.

#### `backend/app/routers/settings.py` (✅ FINISHED)
*   **Function:** `list_settings` (Line ~53)
    *   *Change:* Decorate with `@cache(expire=300)`.
    *   *Reason:* Application settings are read constantly but updated rarely. A 5-minute cache provides instant reads while keeping configuration relatively fresh.

#### `backend/app/routers/system.py` (✅ FINISHED)
*   **Function:** `get_general_statistics` (Line ~42) and `get_platform_stats` (Line ~547)
    *   *Change:* Decorate with `@cache(expire=300)`.
    *   *Reason:* Admin dashboards and platform stats perform heavy aggregations (e.g., counting total users, total dives). Caching these for 5 minutes prevents database CPU spikes if multiple admins open the dashboard or refresh the page.

---
**Note:** Ensure that when implementing caching, the cache key accurately reflects any query parameters (like `search` or `country` filters for the regions endpoint). `fastapi-cache2` handles this out of the box.
