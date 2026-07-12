# Collaborative Dive Site Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the dive site lists feature to allow users to add accepted buddies as collaborators (co-editors) on their custom lists, including instant web push, email, and chat system notifications, and fully integrated co-editing frontend controls.

**Architecture:** Introduction of the `DiveSiteListCollaborator` association model with appropriate relationships on `User` and `DiveSiteList`. Updates to routing security logic and CRUD permissions, combined with notifications triggered upon changes.

**Tech Stack:** Python (FastAPI, SQLAlchemy, Alembic, Pydantic V2), React (React Router DOM, Tailwind CSS, OpenLayers, lucide-react, react-hot-toast).

## Global Constraints
* **Validation & Schemas:** Use Pydantic models in `backend/app/schemas/` for backend contract validation; use Zod schemas in `frontend/src/utils/formHelpers.js` for frontend validation.
* **Database Migrations:** SEQUENTIAL naming pattern (e.g., `0092_add_list_collaborators.py`).
* **Testing Command:** Run isolated MySQL tests via `cd backend && ./docker-test-github-actions.sh [testfile]`. Never run standard host-based `pytest`.
* **Zero Console Errors:** Always visit modified pages in the browser using MCP tools to ensure zero console or linting errors.

---

## File Structure & Dependencies

- **`backend/app/models.py`**: Declares `DiveSiteListCollaborator` model. Adds relationships on `User` and `DiveSiteList`.
- **`backend/migrations/versions/0092_add_list_collaborators.py`**: Migration definition.
- **`backend/app/schemas/__init__.py`**: Houses Pydantic schemas.
- **`backend/app/routers/lists.py`**: Core API implementation and permissions.
- **`frontend/src/api.js`**: Frontend API calls.
- **`frontend/src/pages/UserListDetail.jsx`**: Collaborative workspace and roster page.
- **`frontend/src/pages/Profile.jsx`**: User private dashboard shared list controls.
- **`frontend/src/components/SaveToListModal.jsx`**: Shared list selection.

---

### Task 1: Database Model and Alembic Migration

**Files:**
* Modify: `backend/app/models.py`
* Create: `backend/migrations/versions/0092_add_list_collaborators.py`

**Interfaces:**
* Produces: `DiveSiteListCollaborator` SQLAlchemy model, and active relationships `collaborating_lists` on `User` and `collaborators` on `DiveSiteList`.

- [ ] **Step 1: Declare DB Model in models.py**
Add `DiveSiteListCollaborator` to `backend/app/models.py` under list models:
```python
class DiveSiteListCollaborator(Base):
    __tablename__ = "dive_site_list_collaborators"
    __table_args__ = (
        sa.UniqueConstraint('list_id', 'user_id', name='uq_list_collaborator'),
    )

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("dive_site_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), default="editor", nullable=False)
    show_on_profile = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    list = relationship("DiveSiteList", back_populates="collaborators")
    user = relationship("User", back_populates="collaborating_lists")
```

Add bidirectional relationships in `backend/app/models.py`:
In class `User`:
```python
collaborating_lists = relationship("DiveSiteListCollaborator", back_populates="user", cascade="all, delete-orphan")
```
In class `DiveSiteList`:
```python
collaborators = relationship("DiveSiteListCollaborator", back_populates="list", cascade="all, delete-orphan")
```

- [ ] **Step 2: Create Sequential Alembic Migration File**
Create `backend/migrations/versions/0092_add_list_collaborators.py` on the host:
```python
"""add list collaborators

Revision ID: 0092
Revises: 0091
Create Date: 2026-07-10 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0092'
down_revision = '0091'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'dive_site_list_collaborators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('list_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='editor'),
        sa.Column('show_on_profile', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['list_id'], ['dive_site_lists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('list_id', 'user_id', name='uq_list_collaborator')
    )
    op.create_index('ix_dive_site_list_collaborators_id', 'dive_site_list_collaborators', ['id'], unique=False)
    op.create_index('ix_dive_site_list_collaborators_list_id', 'dive_site_list_collaborators', ['list_id'], unique=False)
    op.create_index('ix_dive_site_list_collaborators_user_id', 'dive_site_list_collaborators', ['user_id'], unique=False)

def downgrade():
    op.drop_table('dive_site_list_collaborators')
```

- [ ] **Step 3: Run schema creation via Docker testing harness to verify migration successfully runs**
Run: `cd backend && ./docker-test-github-actions.sh tests/test_sanity.py`
Expected output: `All tests passed!` (ensures the schema builds cleanly)

- [ ] **Step 4: Commit DB changes**
Run git commit with subject `"Add list collaborators database schema and migration"`

---

### Task 2: Backend Pydantic Schemas

**Files:**
* Modify: `backend/app/schemas/__init__.py`

**Interfaces:**
* Produces: `CollaboratorResponse`, `AddCollaboratorRequest`, `UpdateCollaboratorPreference` schemas, and updated `UserDiveSiteListResponse`.

- [ ] **Step 1: Write schemas in app/schemas/__init__.py**
Add the following classes to `backend/app/schemas/__init__.py` (near other list-related schemas):
```python
class CollaboratorResponse(BaseModel):
    id: int
    user_id: int
    username: str
    role: str
    show_on_profile: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AddCollaboratorRequest(BaseModel):
    username: str = Field(..., description="Username of the buddy to add")

class UpdateCollaboratorPreference(BaseModel):
    show_on_profile: bool
```

Update `UserDiveSiteListResponse` to include the collaborators array:
```python
class UserDiveSiteListResponse(BaseModel):
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
    collaborators: List[CollaboratorResponse] = []
    is_collaborator: bool = False
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 2: Commit Schema updates**
Run git commit with message `"Add Pydantic schemas for collaborative lists"`

---

### Task 3: API Route Implementation

**Files:**
* Modify: `backend/app/routers/lists.py`

**Interfaces:**
* Produces: Updated endpoints and collaborator management APIs.

- [ ] **Step 1: Implement write security check helper**
Add `check_list_write_permission` to `backend/app/routers/lists.py`:
```python
def check_list_write_permission(list_id: int, user: User, db: Session) -> DiveSiteList:
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    
    # Owner & Admin bypass
    if lst.user_id == user.id or user.is_admin:
        return lst
        
    # Collaborator validation
    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == user.id,
        DiveSiteListCollaborator.role == "editor"
    ).first()
    
    if not collab:
        raise HTTPException(status_code=403, detail="You do not have write access to this list")
    return lst
```

- [ ] **Step 2: Update existing list routes**
In `get_my_lists` endpoint, query both owned lists and co-edited lists:
```python
@router.get("/my-lists", response_model=List[UserDiveSiteListResponse])
async def get_my_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ensure_default_lists(db, current_user.id)
    
    # Query owned lists
    owned_lists = db.query(DiveSiteList).filter(
        DiveSiteList.user_id == current_user.id
    ).options(
        joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site),
        joinedload(DiveSiteList.collaborators).joinedload(DiveSiteListCollaborator.user)
    ).all()
    
    # Query collaborating lists
    collab_mappings = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.user_id == current_user.id
    ).options(
        joinedload(DiveSiteListCollaborator.list).joinedload(DiveSiteList.items).joinedload(DiveSiteListItem.dive_site),
        joinedload(DiveSiteListCollaborator.list).joinedload(DiveSiteList.collaborators).joinedload(DiveSiteListCollaborator.user)
    ).all()
    
    collab_lists = [c.list for c in collab_mappings if c.list]
    
    all_lists = owned_lists + collab_lists
    
    for lst in all_lists:
        owner = db.query(User).filter(User.id == lst.user_id).first()
        lst.username = owner.username if owner else "unknown"
        lst.is_collaborator = (lst.user_id != current_user.id)
        lst.role = "owner" if lst.user_id == current_user.id else "editor"
        # Map collaborators models to schema matching response
        lst.collaborators_list = [
            CollaboratorResponse(
                id=c.id,
                user_id=c.user_id,
                username=c.user.username,
                role=c.role,
                show_on_profile=c.show_on_profile,
                created_at=c.created_at
            ) for c in lst.collaborators
        ]
    return all_lists
```

Update read permissions in `get_list_by_id`:
```python
    # Under privacy logic:
    is_owner = current_user and current_user.id == lst.user_id
    is_collab = False
    if current_user:
        is_collab = db.query(DiveSiteListCollaborator).filter(
            DiveSiteListCollaborator.list_id == list_id,
            DiveSiteListCollaborator.user_id == current_user.id
        ).count() > 0

    if not lst.is_public and not is_owner and not is_collab and not (current_user and current_user.is_admin):
        raise HTTPException(status_code=403, detail="This list is private")
```

Update item endpoints (`add_list_item`, `update_list_item`, `remove_list_item`, `reorder_list_items`) to replace:
`lst.user_id != current_user.id` -> calls `check_list_write_permission(list_id, current_user, db)`.

- [ ] **Step 3: Add Collaborator Management Endpoints**
```python
@router.post("/{list_id}/collaborators", response_model=CollaboratorResponse, status_code=status.HTTP_201_CREATED)
async def add_list_collaborator(
    list_id: int,
    data: AddCollaboratorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst or lst.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only list owners can manage collaborators")

    # Predefined lists cannot have collaborators
    if lst.system_type:
        raise HTTPException(status_code=403, detail="System lists cannot have collaborators")

    target_user = db.query(User).filter(User.username == data.username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce accepted friendships
    friendship = db.query(UserFriendship).filter(
        ((UserFriendship.user_id == current_user.id) & (UserFriendship.friend_id == target_user.id)) |
        ((UserFriendship.user_id == target_user.id) & (UserFriendship.friend_id == current_user.id)),
        UserFriendship.status == "ACCEPTED"
    ).first()
    if not friendship:
        raise HTTPException(status_code=400, detail="You can only collaborate with accepted buddies")

    # Check already exists
    exists = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == target_user.id
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="User is already a collaborator")

    collab = DiveSiteListCollaborator(
        list_id=list_id,
        user_id=target_user.id,
        role="editor",
        show_on_profile=True
    )
    db.add(collab)
    db.commit()
    db.refresh(collab)
    collab.username = target_user.username
    
    # TODO Task 4 Side Effects (Push notifications, Email, Chat Message) go here!
    
    return collab

@router.delete("/{list_id}/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_list_collaborator(
    list_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    if lst.user_id != current_user.id and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == user_id
    ).first()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    db.delete(collab)
    db.commit()
    return None

@router.put("/{list_id}/collaborators/preference", response_model=CollaboratorResponse)
async def update_collaborator_profile_preference(
    list_id: int,
    data: UpdateCollaboratorPreference,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == current_user.id
    ).first()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    collab.show_on_profile = data.show_on_profile
    db.commit()
    db.refresh(collab)
    collab.username = current_user.username
    return collab
```

- [ ] **Step 4: Commit route updates**
Run git commit with message `"Implement collaborative list endpoints and checking helpers"`

---

### Task 4: Notifications and Chat Side Effects

**Files:**
* Modify: `backend/app/routers/lists.py` (Implement async activity notifications and chat insertions)

**Interfaces:**
* Produces: Push notification triggers, emails, direct messaging system inserts.

- [ ] **Step 1: Implement notify_collaborative_list_activity helper**
Add the helper to `backend/app/routers/lists.py`:
```python
async def notify_collaborative_list_activity(list_id: int, initiator_id: int, action: str, details: str, db: Session):
    lst = db.query(DiveSiteList).options(
        joinedload(DiveSiteList.collaborators).joinedload(DiveSiteListCollaborator.user)
    ).filter(DiveSiteList.id == list_id).first()
    if not lst:
        return
        
    initiator = db.query(User).filter(User.id == initiator_id).first()
    initiator_username = initiator.username if initiator else "Someone"

    participants = {lst.user_id} | {c.user_id for c in lst.collaborators}
    target_users = participants - {initiator_id}
    
    owner = db.query(User).filter(User.id == lst.user_id).first()
    owner_username = owner.username if owner else "unknown"

    message_body = ""
    if action == "add":
        message_body = f"{initiator_username} added {details} to the list '{lst.title}'."
    elif action == "edit_notes":
        message_body = f"{initiator_username} updated notes for {details} in the list '{lst.title}'."
    elif action == "remove":
        message_body = f"{initiator_username} removed {details} from the list '{lst.title}'."
    elif action == "reorder":
        message_body = f"{initiator_username} reordered the dive sites in the list '{lst.title}'."

    from app.services.notification_service import NotificationService
    notif_service = NotificationService()

    for uid in target_users:
        notif_service.create_notification(
            user_id=uid,
            category="collaborative_list",
            title=f"List Updated: {lst.title}",
            message=message_body,
            link_url=f"/users/{owner_username}/lists/{lst.id}/{lst.slug}",
            entity_type="dive_site",
            db=db
        )
```

In item mutations, trigger:
`background_tasks.add_task(notify_collaborative_list_activity, list_id, current_user.id, "add", site.name, db)`

- [ ] **Step 2: Hook up invitations triggers**
When a collaborator is added inside `add_list_collaborator`:
```python
    # Push Notification & Email
    from app.services.notification_service import NotificationService
    notif_service = NotificationService()
    notif_service.create_notification(
        user_id=target_user.id,
        category="collaborative_list",
        title="New Shared List",
        message=f"{current_user.username} added you as an editor on '{lst.title}'",
        link_url=f"/users/{current_user.username}/lists/{lst.id}/{lst.slug}",
        db=db
    )
    
    # Send system message in active chat room
    from app.routers.chat import get_active_dm_room_for_users, send_chat_message_internal
    room = get_active_dm_room_for_users(current_user.id, target_user.id, db)
    if room:
        send_chat_message_internal(
            room_id=room.id,
            sender_id=current_user.id,
            message_type="system_shared_list",
            content=f"{current_user.username} added you as a collaborator on '{lst.title}'.",
            metadata={"list_id": lst.id, "list_slug": lst.slug, "list_title": lst.title},
            db=db
        )
```

- [ ] **Step 3: Commit notifications changes**
Run git commit with message `"Add notification and chat message hooks for shared list activities"`

---

### Task 5: Frontend API client hookups

**Files:**
* Modify: `frontend/src/api.js`

**Interfaces:**
* Produces: `addListCollaborator`, `removeListCollaborator`, and `updateCollaboratorPreference` functions.

- [ ] **Step 1: Write functions in frontend/src/api.js**
Add these calls to `frontend/src/api.js`:
```javascript
export const addListCollaborator = async (listId, username) => {
  const response = await api.post(`/api/v1/lists/${listId}/collaborators`, { username });
  return response.data;
};

export const removeListCollaborator = async (listId, userId) => {
  await api.delete(`/api/v1/lists/${listId}/collaborators/${userId}`);
};

export const updateCollaboratorPreference = async (listId, showOnProfile) => {
  const response = await api.put(`/api/v1/lists/${listId}/collaborators/preference`, { show_on_profile: showOnProfile });
  return response.data;
};
```

- [ ] **Step 2: Commit Frontend API updates**
Run git commit with message `"Add list collaborators endpoints to frontend Axios client"`

---

### Task 6: Frontend List Details Page Refactoring

**Files:**
* Modify: `frontend/src/pages/UserListDetail.jsx`

**Interfaces:**
* Produces: Responsive UI with collaborator indicators, add menus, and role-based write controls.

- [ ] **Step 1: Refactor UserListDetail.jsx to check collaborators list**
Update state loading and check `is_collaborator` or `role === 'editor'` returned by list API. Expose item editing features if the user has editor or owner role.
Render a row of circular profile bubbles at the top for current list collaborators.
Add a plus button (+) next to them for the owner to add an accepted buddy.

- [ ] **Step 2: Implement Collaborator management dropdown in details screen**
Clicking the (+) lists buddies. Uses standard `lucide-react` icons and beautiful hover styles (`hover:bg-blue-100/50`).

- [ ] **Step 3: Verify zero errors inside UserListDetail**
Open browser, navigate, and review console outputs using Chrome DevTools MCP.

- [ ] **Step 4: Commit UI changes**
Run git commit with message `"Enhance list detail UI with collaborator indicators and edit panels"`

---

### Task 7: Frontend Profile Preferences and Badging

**Files:**
* Modify: `frontend/src/pages/Profile.jsx`

**Interfaces:**
* Produces: List rows decorated with multi-user badges and collaborative profile show toggles.

- [ ] **Step 1: Integrate collaborative lists in Profile.jsx**
Decorate collaborative lists with a `Users` Lucide icon. Expose a toggle to trigger `updateCollaboratorPreference` directly from the user's dashboard of co-edited lists.

- [ ] **Step 2: Verify zero errors inside Profile**
Visit profile page in browser and inspect console messages.

- [ ] **Step 3: Commit profile updates**
Run git commit with message `"Add badging and toggles for collaborative lists in profile dashboard"`

---

### Task 8: Comprehensive Backend Verification Tests

**Files:**
* Create: `backend/tests/test_collaborative_lists.py`

**Interfaces:**
* Produces: A flawless test suite ensuring all API operations, permissions, and notifications operate properly.

- [ ] **Step 1: Write backend tests in backend/tests/test_collaborative_lists.py**
Write unit tests covering list owner metadata restrictions, editor co-editing capabilities, non-buddy additions blockage, and notifications dispatch checking.

- [ ] **Step 2: Run verification harness to verify everything is passing**
Run: `cd backend && ./docker-test-github-actions.sh tests/test_collaborative_lists.py`
Expected: `All tests passed!`

- [ ] **Step 3: Commit and lock in the feature**
Run git commit with message `"Add robust backend test suite for collaborative lists"`

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-collaborative-dive-site-lists-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach would you prefer to initiate?