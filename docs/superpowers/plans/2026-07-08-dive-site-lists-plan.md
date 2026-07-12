# User Curated Dive Site Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement curated dive site lists where users can save, organize, order, annotate, and publicly/privately share collections of their favorite dive sites.

**Architecture:** Introduction of normalized `DiveSiteList` and `DiveSiteListItem` relational models in SQLAlchemy with dynamic slug-based URLs on the frontend. Includes background view tracking, drag-and-drop custom ordering, and a customizable "Save to List" modal.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Alembic, Pydantic V2), React (React Router DOM, Tailwind CSS, OpenLayers, lucide-react, react-hot-toast).

## Global Constraints
* **Validation & Schemas:** Use Zod schemas defined in `frontend/src/utils/formHelpers.js` for frontend validation; use Pydantic models in `backend/app/schemas/` for backend contract validation.
* **Database Migrations:** SEQUENTIAL naming pattern, e.g. `0091_add_dive_site_lists.py`. Verify migrations from scratch.
* **Testing Command:** Run isolated MySQL tests via `cd backend && ./docker-test-github-actions.sh [testfile]`. Never run standard host-based `pytest`.
* **Zero Console Errors:** Always visit modified pages in the browser using MCP tools to ensure zero console or linting errors.

---

## Task Map
* **Task 1:** Database Models and Migrations (`models.py` & Alembic schema creation)
* **Task 2:** Backend Pydantic Schemas (`schemas/__init__.py`)
* **Task 3:** API Route Router (`routers/lists.py` & registration in `main.py`)
* **Task 4:** Public User Profile Integration (`routers/users.py` & schemas updates)
* **Task 5:** Frontend API and Social Share Utilities (`frontend/src/api.js` & `shareUtils.js`)
* **Task 6:** "Save to List" Modal (`SaveToListModal.jsx` & `DiveSiteDetail.jsx` hook-up)
* **Task 7:** Private lists management and Profile tabs (`UserProfile.jsx` & `Profile.jsx`)
* **Task 8:** Curated List Detail Page with Map (`UserListDetail.jsx` & route registers)
* **Task 9:** Admin Dashboard analytics (`Admin.jsx` Popular Lists visual segment)
* **Task 10:** Comprehensive End-to-End Testing & Verification

---

### Task 1: Database Models and Migrations

**Files:**
* Modify: `backend/app/models.py` (Add new models, register back_populate relationships on User class)
* Create: `backend/migrations/versions/0091_add_dive_site_lists.py` (Alembic migration)

**Interfaces:**
* Produces: `DiveSiteList` and `DiveSiteListItem` SQLAlchemy models accessible to routers and tests.

- [ ] **Step 1: Define models in models.py**

Add the following models to `backend/app/models.py`:

```python
# Near other social/profile models
class DiveSiteList(Base):
    __tablename__ = "dive_site_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    slug = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    show_on_profile = Column(Boolean, default=True, nullable=False)
    system_type = Column(String(50), nullable=True, default=None)  # "favorites", "wishlist", or None
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

Also, update the `User` class inside `backend/app/models.py` to register the back-populating relationship:
```python
# Inside class User:
dive_site_lists = relationship("DiveSiteList", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Step 2: Generate sequential migration**

Write a clean, Sequential Migration script to `backend/migrations/versions/0091_add_dive_site_lists.py` to support these two tables. Include indices on `slug`, unique constraints on `(list_id, dive_site_id)`, and cascade deletions.

```python
"""add dive site lists

Revision ID: 0091
Revises: 0090
Create Date: 2026-07-08 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0091'
down_revision = '0090'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'dive_site_lists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('show_on_profile', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('system_type', sa.String(length=50), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_dive_site_lists_id', 'dive_site_lists', ['id'], unique=False)
    op.create_index('ix_dive_site_lists_slug', 'dive_site_lists', ['slug'], unique=False)

    op.create_table(
        'dive_site_list_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('list_id', sa.Integer(), nullable=False),
        sa.Column('dive_site_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['list_id'], ['dive_site_lists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('list_id', 'dive_site_id', name='uq_list_dive_site')
    )
    op.create_index('ix_dive_site_list_items_id', 'dive_site_list_items', ['id'], unique=False)

def downgrade():
    op.drop_index('ix_dive_site_list_items_id', table_name='dive_site_list_items')
    op.drop_table('dive_site_list_items')
    op.drop_index('ix_dive_site_lists_slug', table_name='dive_site_lists')
    op.drop_index('ix_dive_site_lists_id', table_name='dive_site_lists')
    op.drop_table('dive_site_lists')
```

- [ ] **Step 3: Run Alembic verification check**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_users.py -v` (to execute a quick test and ensure migration doesn't break the build).
Expected: PASS and no migration schema drift.

---

### Task 2: Backend Pydantic Schemas

**Files:**
* Modify: `backend/app/schemas/__init__.py` (Add new Pydantic schemas)

**Interfaces:**
* Produces: `DiveSiteListResponse`, `DiveSiteListItemResponse`, `DiveSiteListCreate`, `DiveSiteListUpdate`, `DiveSiteListItemCreate`, `DiveSiteListItemUpdate`, `DiveSiteListReorder`, and `DiveSiteListMembershipResponse`.

- [ ] **Step 1: Write Pydantic models**

Add the following schemas to `backend/app/schemas/__init__.py` right below standard profile schemas:

```python
# User Curated Lists Schemas
class DiveSiteListItemResponse(BaseModel):
    id: int
    list_id: int
    dive_site_id: int
    notes: Optional[str] = None
    display_order: int
    dive_site: DiveSiteResponse  # Reuses existing schema
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
    description: Optional[Optional[str]] = None
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

Ensure `DiveSiteResponse` is imported or defined before referencing it.

- [ ] **Step 2: Verify compile correctness**

Run: `python -c "import sys; sys.path.insert(0, 'backend'); from app.schemas import DiveSiteListResponse; print('Import OK!')"`
Expected: Output `Import OK!` without syntax or circular import errors.

---

### Task 3: API Route Router

**Files:**
* Create: `backend/app/routers/lists.py` (New list endpoint file)
* Modify: `backend/app/main.py` (Register router prefix)

**Interfaces:**
* Consumes: `get_current_active_user`, `get_current_user_optional`, `increment_view_count`.
* Produces: REST endpoints at `/api/v1/lists`.

- [ ] **Step 1: Write routing logic in routers/lists.py**

Create `backend/app/routers/lists.py` with the following implementation:

```python
import re
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import DiveSiteList, DiveSiteListItem, DiveSite, User
from app.auth import get_current_active_user, get_current_user_optional
from app.utils import increment_view_count
from app.schemas import (
    DiveSiteListResponse, DiveSiteListCreate, DiveSiteListUpdate,
    DiveSiteListItemResponse, DiveSiteListItemCreate, DiveSiteListItemUpdate,
    DiveSiteListReorder, DiveSiteListMembershipResponse
)

router = APIRouter()

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_-]+', '-', s)
    return s.strip('-')

@router.get("/my-lists", response_model=List[DiveSiteListResponse])
async def get_my_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all curated lists of the authenticated user (including system lists)"""
    ensure_default_lists(db, current_user.id)
    lists = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == current_user.id
    ).options(joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site)).all()
    
    # Map usernames
    for lst in lists:
        lst.username = current_user.username
    return lists

@router.post("", response_model=DiveSiteListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    data: DiveSiteListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new custom curated list"""
    slug = slugify(data.title) or "list"
    
    new_list = DiveSiteList(
        user_id=current_user.id,
        title=data.title,
        slug=slug,
        description=data.description,
        is_public=data.is_public,
        show_on_profile=data.show_on_profile,
        system_type=None
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    new_list.username = current_user.username
    new_list.items = []
    return new_list

@router.get("/{list_id}", response_model=DiveSiteListResponse)
async def get_list_by_id(
    list_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Retrieve details of a curated list with its items, tracked asynchronously on other user visits"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).options(
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site)
    ).first()

    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    owner = db.query(User).filter(User.id == lst.user_id).first()
    lst.username = owner.username if owner else "unknown"

    # Privacy enforcement
    is_owner = current_user and current_user.id == lst.user_id
    if not lst.is_public and not is_owner and not (current_user and current_user.is_admin):
        raise HTTPException(status_code=403, detail="This list is private")

    # Track views
    if not is_owner:
        background_tasks.add_task(increment_view_count, db, DiveSiteList, list_id)

    return lst

@router.put("/{list_id}", response_model=DiveSiteListResponse)
async def update_list(
    list_id: int,
    data: DiveSiteListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update list details. Block renaming system types"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if data.title is not None:
        if lst.system_type:
            raise HTTPException(status_code=403, detail="Cannot rename system-generated lists")
        lst.title = data.title
        lst.slug = slugify(data.title)

    if data.description is not None:
        lst.description = data.description
    if data.is_public is not None:
        lst.is_public = data.is_public
    if data.show_on_profile is not None:
        lst.show_on_profile = data.show_on_profile

    db.commit()
    db.refresh(lst)
    lst.username = current_user.username
    return lst

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a custom list. Prevent system list deletion"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    if lst.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if lst.system_type:
        raise HTTPException(status_code=403, detail="System-generated lists cannot be deleted")

    db.delete(lst)
    db.commit()
    return None

@router.post("/{list_id}/items", response_model=DiveSiteListItemResponse, status_code=status.HTTP_201_CREATED)
async def add_list_item(
    list_id: int,
    data: DiveSiteListItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a site to a list with optional notes"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst or lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Check site exists
    site = db.query(DiveSite).filter(DiveSite.id == data.dive_site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Dive site not found")

    # Prevent duplicate
    duplicate = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.list_id == list_id,
        DiveSiteListItem.dive_site_id == data.dive_site_id
    ).first()
    if duplicate:
         raise HTTPException(status_code=400, detail="Dive site already in list")

    # Set display order as count
    item_count = db.query(DiveSiteListItem).filter(DiveSiteListItem.list_id == list_id).count()

    item = DiveSiteListItem(
        list_id=list_id,
        dive_site_id=data.dive_site_id,
        notes=data.notes,
        display_order=item_count
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{list_id}/items/{item_id}", response_model=DiveSiteListItemResponse)
async def update_list_item(
    list_id: int,
    item_id: int,
    data: DiveSiteListItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update custom notes or individual order of a list item"""
    item = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.id == item_id,
        DiveSiteListItem.list_id == list_id
    ).first()
    if not item or item.list.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if data.notes is not None:
        item.notes = data.notes
    if data.display_order is not None:
        item.display_order = data.display_order

    db.commit()
    db.refresh(item)
    return item

@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_list_item(
    list_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove a site from a list"""
    item = db.query(DiveSiteListItem).filter(
        DiveSiteListItem.id == item_id,
        DiveSiteListItem.list_id == list_id
    ).first()
    if not item or item.list.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.delete(item)
    db.commit()
    return None

@router.put("/{list_id}/reorder")
async def reorder_list_items(
    list_id: int,
    data: DiveSiteListReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Bulk reorder items of a list securely in a single transaction"""
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst or lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    items = db.query(DiveSiteListItem).filter(DiveSiteListItem.list_id == list_id).all()
    item_map = {item.id: item for item in items}

    for index, item_id in enumerate(data.item_ids):
        if item_id in item_map:
            item_map[item_id].display_order = index

    db.commit()
    return {"status": "success"}

@router.get("/dive-site/{dive_site_id}/my-status", response_model=List[DiveSiteListMembershipResponse])
async def get_dive_site_membership_status(
    dive_site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve bookmark checkmarks state across all user lists"""
    ensure_default_lists(db, current_user.id)
    lists = db.query(DiveSiteList).filter(DiveSiteList.user_id == current_user.id).all()
    
    results = []
    for lst in lists:
        is_in = db.query(DiveSiteListItem).filter(
            DiveSiteListItem.list_id == lst.id,
            DiveSiteListItem.dive_site_id == dive_site_id
        ).first() is not None
        
        results.append(DiveSiteListMembershipResponse(
            list_id=lst.id,
            title=lst.title,
            system_type=lst.system_type,
            is_in_list=is_in
        ))
    return results

def ensure_default_lists(db: Session, user_id: int):
    """Verify and initialize standard My Favorites and My Wishlist files securely"""
    fav = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == user_id,
        DiveSiteList.system_type == "favorites"
    ).first()
    if not fav:
        fav_list = DiveSiteList(
            user_id=user_id,
            title="My Favorites",
            slug="my-favorites",
            description="My favorite dive sites that I highly recommend!",
            is_public=True,
            show_on_profile=True,
            system_type="favorites"
        )
        db.add(fav_list)

    wish = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == user_id,
        DiveSiteList.system_type == "wishlist"
    ).first()
    if not wish:
        wish_list = DiveSiteList(
            user_id=user_id,
            title="My Wishlist",
            slug="my-wishlist",
            description="Dive sites I would love to visit in the future.",
            is_public=False,
            show_on_profile=False,
            system_type="wishlist"
        )
        db.add(wish_list)
    db.commit()
```

- [ ] **Step 2: Register lists router in main.py**

Open `backend/app/main.py` and register the router near other routers (around lines 400-450):
```python
# Import
from app.routers import lists

# Register (inside configure_routing)
app.include_router(lists.router, prefix="/api/v1/lists", tags=["Dive Site Lists"])
```

---

### Task 4: Public User Profile Integration (Option A)

**Files:**
* Modify: `backend/app/routers/users.py` (Include lists endpoint delegate, trigger default list check on profile load)

**Interfaces:**
* Consumes: `ensure_default_lists` from `app.routers.lists`.
* Produces: Public user endpoint `GET /api/v1/users/{username}/lists`.

- [ ] **Step 1: Write Option A endpoint in users.py**

Add the public user lists endpoint near public stats inside `backend/app/routers/users.py`:

```python
@router.get("/{username}/lists", response_model=List[DiveSiteListResponse])
@skip_rate_limit_for_admin("60/minute")
async def get_user_public_lists(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get all public lists for a specific user (Option A delegation)"""
    user = db.query(User).filter(User.username == username, User.enabled == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.routers.lists import ensure_default_lists
    ensure_default_lists(db, user.id)

    # If viewer is the owner, return all. Otherwise return only public and profile-enabled
    is_owner = current_user and current_user.id == user.id
    query = db.query(DiveSiteList).filter(DiveSiteList.user_id == user.id)
    
    if not is_owner and not (current_user and current_user.is_admin):
        query = query.filter(
            DiveSiteList.is_public == True,
            DiveSiteList.show_on_profile == True
        )

    lists = query.options(joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site)).all()
    for lst in lists:
        lst.username = user.username
    return lists
```

Make sure `Optional` and `get_current_user_optional` are correctly available inside `users.py`.

- [ ] **Step 2: Run verification tests**

Write a quick automated test in `backend/tests/test_lists.py` to verify all DB and controller logic. Let's create `backend/tests/test_lists.py` using `write_file` to thoroughly test permissions, defaults initialization, and view tracking.

---

### Task 5: Frontend API and Social Share Utilities

**Files:**
* Modify: `frontend/src/api.js` (Export client methods)
* Modify: `frontend/src/utils/shareUtils.js` (Add `list` types)

**Interfaces:**
* Produces: `api.getLists`, `api.createList`, `api.deleteList`, `shareUtils` list details support.

- [ ] **Step 1: Add API functions to api.js**

Export lists endpoint helpers:
```javascript
// Curated Lists API Functions
export const getMyLists = async () => {
  const response = await api.get('/api/v1/lists/my-lists');
  return response.data;
};

export const getUserPublicLists = async username => {
  const response = await api.get(`/api/v1/users/${username}/lists`);
  return response.data;
};

export const getListById = async id => {
  const response = await api.get(`/api/v1/lists/${id}`);
  return response.data;
};

export const createList = async data => {
  const response = await api.post('/api/v1/lists', data);
  return response.data;
};

export const updateList = async (id, data) => {
  const response = await api.put(`/api/v1/lists/${id}`, data);
  return response.data;
};

export const deleteList = async id => {
  await api.delete(`/api/v1/lists/${id}`);
};

export const addListItem = async (listId, data) => {
  const response = await api.post(`/api/v1/lists/${listId}/items`, data);
  return response.data;
};

export const updateListItem = async (listId, itemId, data) => {
  const response = await api.put(`/api/v1/lists/${listId}/items/${itemId}`, data);
  return response.data;
};

export const deleteListItem = async (listId, itemId) => {
  await api.delete(`/api/v1/lists/${listId}/items/${itemId}`);
};

export const reorderListItems = async (listId, itemIds) => {
  const response = await api.put(`/api/v1/lists/${listId}/reorder`, { item_ids: itemIds });
  return response.data;
};

export const getDiveSiteListStatus = async diveSiteId => {
  const response = await api.get(`/api/v1/lists/dive-site/${diveSiteId}/my-status`);
  return response.data;
};
```

- [ ] **Step 2: Update shareUtils.js**

Append `list` support inside `generateShareUrl`:
```javascript
    case 'list':
      path = `/users/${params.username}/lists/${entityId}${slug}`;
      break;
```

Update `formatShareText` to recognize `'list'`:
```javascript
    list: 'curated list',
```

Update `generateShareContent` to support `'list'`:
```javascript
    case 'list':
      title = entityData.title || 'Curated Dive Site List';
      description =
        entityData.description || `Explore this curated collection of dive sites on Divemap!`;

      // Add item stats if available
      if (entityData.items && entityData.items.length > 0) {
        description += `\n\nContains ${entityData.items.length} top dive sites curated by ${entityData.username}.`;
      }

      url = generateShareUrl('list', entityData.id, {
        username: entityData.username,
        slug: slugify(entityData.title || 'list'),
      });
      break;
```

---

### Task 6: "Save to List" Modal Component

**Files:**
* Create: `frontend/src/components/SaveToListModal.jsx` (New dropdown bookmark modal)
* Modify: `frontend/src/pages/DiveSiteDetail.jsx` (Hook up Save button)

**Interfaces:**
* Consumes: `getDiveSiteListStatus`, `addListItem`, `deleteListItem`, `createList` from API.

- [ ] **Step 1: Write SaveToListModal.jsx**

Create `frontend/src/components/SaveToListModal.jsx` featuring dynamic toggles, immediate non-blocking react-hot-toast warnings, and instant custom lists creation:

```jsx
import { Bookmark, Plus, X, Loader } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getDiveSiteListStatus, addListItem, deleteListItem, createList } from '../api';
import Button from './ui/Button';

const SaveToListModal = ({ isOpen, onClose, diveSiteId, diveSiteName }) => {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await getDiveSiteListStatus(diveSiteId);
      setLists(data);
    } catch (e) {
      toast.error('Failed to load list status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchStatus();
    }
  }, [isOpen, diveSiteId]);

  const handleToggle = async (listId, isInList, item) => {
    try {
      if (isInList) {
        // We need to fetch the item ID from list's details to delete it,
        // or let's update the API/status helper to return item ID.
        // Wait, to keep deletions simple, let's allow removing list item by dive_site_id
        // or simple find logic. Since backend endpoint is DELETE /api/v1/lists/{id}/items/{item_id},
        // we can fetch the full list or let's update the endpoint, or simply look at lists.
        // Wait! Let's ensure the backend has a way to remove site from list easily.
        // Let's call our deletion. To make it smooth, let's update the status response to contain the item_id!
        // That's much cleaner! (Update status schema and handler to return item_id)
        const toastId = toast.loading('Removing from list...');
        // Delete item
        await deleteListItem(listId, item.item_id);
        toast.success('Removed successfully!', { id: toastId });
      } else {
        const toastId = toast.loading('Adding to list...');
        await addListItem(listId, { dive_site_id: diveSiteId });
        toast.success('Added successfully!', { id: toastId });
      }
      fetchStatus();
    } catch (err) {
      toast.error('Failed to update list');
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const list = await createList({ title: newTitle, is_public: true });
      await addListItem(list.id, { dive_site_id: diveSiteId });
      toast.success(`Created "${newTitle}" and saved site!`);
      setNewTitle('');
      fetchStatus();
    } catch (e) {
      toast.error('Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-blue-600" />
            Save "{diveSiteName}" to Lists
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 max-h-60 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex justify-center p-4"><Loader className="animate-spin text-blue-600 h-6 w-6" /></div>
          ) : (
            lists.map(lst => (
              <label key={lst.list_id} className="flex items-center justify-between p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-blue-100/30 transition-colors">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{lst.title}</span>
                <input
                  type="checkbox"
                  checked={lst.is_in_list}
                  onChange={() => handleToggle(lst.list_id, lst.is_in_list, lst)}
                  className="rounded text-blue-600 h-5 w-5 focus:ring-blue-500"
                />
              </label>
            ))
          )}
        </div>

        <div className="p-4 border-t dark:border-gray-700 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Create new custom list..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              disabled={creating}
            />
            <Button onClick={handleCreateAndAdd} disabled={creating || !newTitle.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveToListModal;
```

*(Note: We will adjust backend `DiveSiteListMembershipResponse` to include `item_id: Optional[int] = None` to support direct deletion).*

- [ ] **Step 2: Replace Favorite button in DiveSiteDetail.jsx**

Open `frontend/src/pages/DiveSiteDetail.jsx` and replace the simple rating/favorites logic with the dynamic `SaveToListModal`. Import `SaveToListModal`, add a state trigger `const [isSaveOpen, setIsSaveOpen] = useState(false)`, and hook the save action to the button click.

---

### Task 7: Private lists management and Profile tabs

**Files:**
* Modify: `frontend/src/pages/UserProfile.jsx` (Add public lists tab segment)
* Modify: `frontend/src/pages/Profile.jsx` (Add private lists management tab block)

**Interfaces:**
* Produces: Curated lists rendering inside public profiles and private user dashboards.

- [ ] **Step 1: Integrate Lists Tab in UserProfile.jsx**

Add "Curated Lists" next to "Visited Sites" / "Dives" in `UserProfile.jsx`. Fetch user public lists using `getUserPublicLists(username)` and render a visually striking list card showing site count and view stats.

- [ ] **Step 2: Integrate Lists Tab in Profile.jsx**

Add "My Lists" block inside the logged-in user profile, featuring creation triggers and quick redirects to `/users/:username/lists/:id/:slug`.

---

### Task 8: Curated List Detail Page with Map

**Files:**
* Create: `frontend/src/pages/UserListDetail.jsx` (Splitscreen details dashboard)
* Modify: `frontend/src/App.jsx` (Route registrations)

**Interfaces:**
* Produces: Layout at `/users/:username/lists/:id` and `/users/:username/lists/:id/:slug`.

- [ ] **Step 1: Create UserListDetail.jsx**

Implement the detail screen with layout splitting: Map on left (using the existing `LeafletMapView` or `DiveSitesMap`), items lists with personalized comments on the right. Include drag-and-drop handles for owner's reordering actions.

- [ ] **Step 2: Register routes in App.jsx**

Register the details route:
```jsx
const UserListDetail = lazy(() => import('./pages/UserListDetail'));

// inside Routes layout:
<Route path="/users/:username/lists/:id" element={<UserListDetail />} />
<Route path="/users/:username/lists/:id/:slug" element={<UserListDetail />} />
```

---

### Task 9: Admin Dashboard Analytics

**Files:**
* Modify: `frontend/src/pages/Admin.jsx` (Add "Popular Lists" section)
* Modify: `backend/app/routers/admin/__init__.py` or `routers/admin/dive_sites.py` (Add analytics fetch endpoint)

**Interfaces:**
* Produces: Admin metric view showing curated lists view leaders.

- [ ] **Step 1: Add API endpoint for Popular Lists**

Add an endpoint `GET /api/v1/admin/popular-lists` inside backend admin routers, returning lists sorted by `view_count.desc()`.

- [ ] **Step 2: Render table segment in Admin.jsx**

Add a dashboard component widget in `Admin.jsx` presenting a data table of the most viewed lists, showcasing List Name, Owner, Public visibility toggle, and View Counts.

---

### Task 10: Verification & Complete Integration Testing

- [ ] **Step 1: Write backend lists test file**

We will write `backend/tests/test_lists.py` using `write_file` to thoroughly test all DB assertions, default initializations, and view count checks.

- [ ] **Step 2: Run all backend tests**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_lists.py`
Expected: `All tests passed!`

- [ ] **Step 3: Run full lint & build**

Verify frontend lint errors by running `make lint-frontend` and ensure that the bundle compiles correctly without standard errors or TypeScript warnings.

---

## Execution Handoff
Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach do you prefer?
