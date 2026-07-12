# Design Specification: User Curated Dive Site Lists (Favorites & Wishlists)

## 1. Overview
This feature introduces curated user lists of dive sites. Users can organize dive sites into system-generated default lists ("My Favorites", "My Wishlist") or create their own custom lists (e.g., "Athens Cave Dives", "Red Sea Bucket List"). 

Lists can be either **public** or **private**, and users have fine-grained control over whether their public lists are displayed on their public profiles. The system tracks list views asynchronously to identify popular lists, which admins can monitor in their dashboard.

### Core Enhancements Included:
1. **Direct "Save to List" Dropdown:** Easy bookmarking of dive sites directly from detail pages.
2. **Interactive Map per List:** Lists render with their own split-screen interactive map plotting saved sites.
3. **Social Sharing & SEO:** Beautiful social media embedding with Open Graph (OG) tag support and clean, user-branded SEO URLs.
4. **Custom List Notes & Ordering:** Drag-and-drop sorting and personalized notes per dive site in a list.

---

## 2. System Architecture & Database Design

To ensure relational integrity and high performance, we use a normalized two-table structure: `DiveSiteList` and `DiveSiteListItem`.

### 2.1 Database Models (`backend/app/models.py`)

#### `DiveSiteList`
Represents the collection metadata.
```python
class DiveSiteList(Base):
    __tablename__ = "dive_site_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    slug = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    show_on_profile = Column(Boolean, default=True, nullable=False)
    system_type = Column(String(50), nullable=True, default=None)  # "favorites", "wishlist", or NULL
    view_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="dive_site_lists")
    items = relationship(
        "DiveSiteListItem", 
        back_populates="list", 
        cascade="all, delete-orphan", 
        order_by="DiveSiteListItem.display_order"
    )
```

#### `DiveSiteListItem`
Represents the join table between `DiveSiteList` and `DiveSite`, holding the order and custom annotations.
```python
class DiveSiteListItem(Base):
    __tablename__ = "dive_site_list_items"
    __table_args__ = (
        UniqueConstraint("list_id", "dive_site_id", name="uq_list_dive_site"),
    )

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("dive_site_lists.id", ondelete="CASCADE"), nullable=False)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    list = relationship("DiveSiteList", back_populates="items")
    dive_site = relationship("DiveSite")
```

### 2.2 System List Initialization
When a new user registers or when an existing user first logs in / accesses their profile, the system will verify and automatically initialize two standard lists:
1. **My Favorites** (`system_type="favorites"`, `is_public=True`, `show_on_profile=True`)
2. **My Wishlist** (`system_type="wishlist"`, `is_public=False`, `show_on_profile=False`)

*Rule:* Users cannot rename or delete these predefined lists, but they can toggle their visibility settings.

---

## 3. API Contract & Routing Design

The API uses flat endpoints under `/api/v1/lists` and integrates public profile list fetching into `/api/v1/users/{username}/lists`.

### 3.1 Pydantic Schemas (`backend/app/schemas/`)

```python
class DiveSiteListItemResponse(BaseModel):
    id: int
    list_id: int
    dive_site_id: int
    notes: Optional[str] = None
    display_order: int
    dive_site: DiveSiteResponse
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DiveSiteListResponse(BaseModel):
    id: int
    user_id: int
    username: str
    title: str
    slug: str
    description: Optional[str] = None
    is_public: bool
    show_on_profile: bool
    system_type: Optional[str] = None
    view_count: int
    created_at: datetime
    updated_at: datetime
    items: List[DiveSiteListItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

class DiveSiteListCreate(BaseModel):
    title: str = Field(..., max_length=100)
    description: Optional[str] = None
    is_public: bool = True
    show_on_profile: bool = True

class DiveSiteListUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    show_on_profile: Optional[bool] = None

class DiveSiteListItemCreate(BaseModel):
    dive_site_id: int
    notes: Optional[str] = None

class DiveSiteListItemUpdate(BaseModel):
    notes: Optional[str] = None
    display_order: Optional[int] = None

class DiveSiteListReorder(BaseModel):
    item_ids: List[int]

class DiveSiteListMembershipResponse(BaseModel):
    list_id: int
    title: str
    system_type: Optional[str] = None
    is_in_list: bool
```

### 3.2 Endpoints Summary

#### User-Scoped Public Lists
*   **`GET /api/v1/users/{username}/lists`** (Public)
    *   *Description:* Retrieves lists belonging to `{username}`.
    *   *Permissions:* If request contains valid JWT for the profile owner, returns ALL lists. Otherwise, returns only public lists with `show_on_profile=True`.

#### Lists Management Router (`/api/v1/lists`)
*   **`GET /api/v1/lists/my-lists`** (Authenticated)
    *   *Description:* Returns all lists (custom + system) owned by the current active user.
*   **`POST /api/v1/lists`** (Authenticated)
    *   *Description:* Create a custom list.
*   **`GET /api/v1/lists/{list_id}`** (Public / Optional Auth)
    *   *Description:* Fetches the details of a specific list, including its items.
    *   *Permissions:* Private lists throw `403 Forbidden` if requested by anyone but the owner or site admins.
    *   *View Tracking:* If the requester is anonymous or any user other than the list's owner, triggers:
        `background_tasks.add_task(increment_view_count, db, DiveSiteList, list_id)`
*   **`PUT /api/v1/lists/{list_id}`** (Authenticated)
    *   *Description:* Update list meta.
    *   *Restrictions:* System lists cannot be renamed.
*   **`DELETE /api/v1/lists/{list_id}`** (Authenticated)
    *   *Description:* Delete list.
    *   *Restrictions:* System lists throw `403 Forbidden` if deletion is attempted.
*   **`POST /api/v1/lists/{list_id}/items`** (Authenticated)
    *   *Description:* Save a dive site to this list.
*   **`PUT /api/v1/lists/{list_id}/items/{item_id}`** (Authenticated)
    *   *Description:* Update notes or ordering for a single item.
*   **`DELETE /api/v1/lists/{list_id}/items/{item_id}`** (Authenticated)
    *   *Description:* Delete item from the list.
*   **`PUT /api/v1/lists/{list_id}/reorder`** (Authenticated)
    *   *Description:* Bulk reorders items based on sequential array.
*   **`GET /api/v1/lists/dive-site/{dive_site_id}/my-status`** (Authenticated)
    *   *Description:* Helper to see which lists currently contain this site, returning a list of `DiveSiteListMembershipResponse`.

---

## 4. Frontend Component & Navigation Design

### 4.1 Route Declarations (`frontend/src/App.jsx`)
We will add two core routes:
1. Private management / view: `/profile/lists` or integrated in profile layout.
2. Public browsable: `/users/:username/lists/:id` and `/users/:username/lists/:id/:slug`.

### 4.2 Page Components
*   **`UserListDetail.jsx`:**
    *   **Interactive Maps:** A split-screen layout with an OpenLayers-based Map on the left (rendering the sites in the list) and list details on the right. Clicking a map marker scrolls/highlights the corresponding card.
    *   **Owner Workspace:** In-place editable titles, toggles, notes text-areas, drag-handles for reordering, and deletes. Uses `framer-motion` for smooth reordering animations.
    *   **Outside view:** Static view presenting the curator's profile card, social sharing widget, list metadata, and beautiful site cards displaying custom user annotations.
*   **`SaveToListModal.jsx`:**
    *   Replaces the simple legacy "Favorite" button on `/dive-sites/:id` with a bookmarking dropdown.
    *   Lists all available lists with checkmarks. Saving/removing occurs instantly via API hooks.
    *   Includes a fast creation field at the bottom to spawn a new list instantly without context-switching.
*   **`UserProfile.jsx` Integration:**
    *   Adds a dedicated "Curated Lists" tab on the user profile next to "Visited Sites" and "Dives".
    *   Lists public, profile-enabled collections with their view metrics and site counts.

---

## 5. SEO, Open Graph & Social Sharing

Shared lists need highly engaging preview snippets on platforms like Facebook, X (Twitter), and messaging apps.

*   **Dynamic Meta Injection:** We will configure the shared URL route on the frontend (or backend if SSR/meta injection is handled there) to inject specific SEO tags:
    *   `og:title`: `"{List Title} - Curated by {username}"`
    *   `og:description`: `"Check out this list of {count} dive sites on Divemap, curated by {username}. Includes: {site1}, {site2}, and more!"`
    *   `og:image`: A beautiful regional representation or map mockup.
*   **Sharing Widget:** A small floating widget or button beside the title offering options to copy list links or share directly to standard social media APIs.

---

## 6. Performance & Scalability Design

1. **Asynchronous View Counter:** List views are incremented using `background_tasks` so that analytics recording never blocks page rendering performance.
2. **Batch Reordering:** Ordering updates are sent as a single bulk request (`PUT /reorder`) instead of multiple single-item network requests, reducing DB transaction overhead.
3. **Optimized DB Queries:** When fetching user lists, items are pre-fetched (`joinedload`) to prevent N+1 queries.

---

## 7. Testing & Verification Plan

### 7.1 Backend (Pytest)
We will create a comprehensive suite `backend/tests/test_lists.py` to assert:
1. Automatic system lists creation on user register/init.
2. Valid permissions: private lists are strictly inaccessible to non-owners, whereas public lists can be queried anonymously.
3. Duplicate prevention: adding the same site to a list twice should return a 400 validation error.
4. Correct view tracking: anonymous/outside visits increment the view count, whereas owner visits do not.
5. Order integrity: bulk reordering updates indices correctly.

### 7.2 Frontend Verification
1. We will use the browser MCP tool to load the newly created pages and verify that:
    * `/users/:username/lists/:id` loads correctly without errors.
    * The console is free of layout or React warnings.
    * Toggle operations and inline edits correctly mutate local state and sync to backend.
