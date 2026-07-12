# Design Specification: Collaborative Dive Site Lists

## 1. Overview & Use Case
The "Collaborative Dive Site Lists" feature extends the curated lists functionality by enabling scuba divers to share private lists with their accepted dive buddies and collaborate on creating and maintaining them. 

### Primary Use Case
A group of dive buddies planning a liveaboard or road trip can collaboratively assemble and maintain a list of target dive sites for their upcoming trip. 
* Any collaborator can add sites, edit site-specific notes, and reorder the list.
* The list displays on the profiles of all collaborators who choose to show it.
* Real-time notifications and chat systems keep buddies informed of additions.

---

## 2. Core Constraints & Principles

1. **Only Accepted Buddies:** A user can only add other users as collaborators if they have an `ACCEPTED` relationship in the `user_friendships` table.
2. **Owner Primacy:** Only the original creator (the list owner) can rename/delete the list, change its global privacy setting (`is_public`), or manage the collaborator roster.
3. **Collaborator Empowerment:** Collaborators can co-edit list contents (add sites, edit notes, reorder items) but cannot destroy the collection or rename it.
4. **Individual Profile Visibility:** For a collaborative list marked public by its owner, each collaborator has individual control over whether it appears on their own public profile page (`show_on_profile`).
5. **No System List Sharing:** Default lists ("My Favorites", "My Wishlist") cannot be shared.

---

## 3. Database Architecture & Schema Design

To represent the many-to-many relationship between lists and collaborators, we will introduce a new junction table, `dive_site_list_collaborators`, and add appropriate relationships.

### 3.1 Collaborators Association Model (`backend/app/models.py`)

We will define `DiveSiteListCollaborator` to store collaborator mappings, roles, and profile display preferences:

```python
class DiveSiteListCollaborator(Base):
    __tablename__ = "dive_site_list_collaborators"
    __table_args__ = (
        sa.UniqueConstraint('list_id', 'user_id', name='uq_list_collaborator'),
    )

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("dive_site_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), default="editor", nullable=False)  # "editor", "viewer" (for future expansion)
    show_on_profile = Column(Boolean, default=True, nullable=False)  # Individual collaborator's choice
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    list = relationship("DiveSiteList", back_populates="collaborators")
    user = relationship("User", back_populates="collaborating_lists")
```

### 3.2 Model Relationship Extensions

We will update existing models in `backend/app/models.py`:

*   **`User` Class:**
    ```python
    collaborating_lists = relationship(
        "DiveSiteListCollaborator",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    ```
*   **`DiveSiteList` Class:**
    ```python
    collaborators = relationship(
        "DiveSiteListCollaborator",
        back_populates="list",
        cascade="all, delete-orphan"
    )
    ```

### 3.3 Alembic Schema Migration (`backend/migrations/versions/0092_add_list_collaborators.py`)

A migration script will be created to generate the table:

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
```

---

## 4. API Endpoints & Contract Design

Endpoints will reside under `/api/v1/lists` and integrate with public user profiles.

### 4.1 Pydantic Schemas (`backend/app/schemas/`)

We will define new and updated schemas:

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

# Updated response model to include collaborators list
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
    is_collaborator: bool = False  # True if the requesting user is a collaborator
    role: Optional[str] = None      # Role of the requesting user ("owner", "editor", etc.)

    model_config = ConfigDict(from_attributes=True)
```

### 4.2 Endpoints Roster (`backend/app/routers/lists.py`)

#### `GET /api/v1/lists/my-lists` (Authenticated)
*   **Behavior:** Updated to return BOTH the lists owned by the user AND the lists they are collaborating on.
*   **SQL Optimization:** Performs a single query with outer joins or unions to avoid N+1 queries.

#### `GET /api/v1/lists/{list_id}` (Public / Optional Auth)
*   **Privacy Rules:** If the list is private, authorization is granted if:
    1. `current_user.id == list.user_id` (Owner)
    2. `current_user.is_admin == True` (Admin)
    3. The requesting user has an active row in `dive_site_list_collaborators` for this `list_id`.

#### `PUT /api/v1/lists/{list_id}` (Authenticated)
*   **Behavior:** Only the list **owner** can modify list-wide metadata (Title, Description, Global Privacy, global profile placement). Returns `403 Forbidden` if co-editors attempt to edit metadata.

#### Item Mutating Endpoints:
*   `POST /api/v1/lists/{list_id}/items` (Add Item)
*   `PUT /api/v1/lists/{list_id}/items/{item_id}` (Edit Notes/Display Order)
*   `DELETE /api/v1/lists/{list_id}/items/{item_id}` (Remove Item)
*   `PUT /api/v1/lists/{list_id}/reorder` (Bulk Reorder)
*   **Authorization Rule:** Allowed if the authenticated user is the list **owner** OR is listed as an active collaborator with role `"editor"`.

#### Collaborator Management Endpoints:
*   `GET /api/v1/lists/{list_id}/collaborators` (Authenticated)
    *   *Returns:* List of active collaborators.
*   `POST /api/v1/lists/{list_id}/collaborators` (Authenticated)
    *   *Action:* Adds a collaborator.
    *   *Validation:*
        1. Current user must be the **owner**.
        2. Target user must exist.
        3. Target user must be an `ACCEPTED` buddy of the owner.
    *   *Side Effects:* Dispatches email and push notifications, and writes a system message to their chat.
*   `DELETE /api/v1/lists/{list_id}/collaborators/{user_id}` (Authenticated)
    *   *Action:* Removes a collaborator.
    *   *Authorization:* Current user must be either the list **owner** OR the collaborator themselves (letting collaborators "leave" a list).
*   `PUT /api/v1/lists/{list_id}/collaborators/preference` (Authenticated)
    *   *Action:* Lets the collaborator toggle their local `show_on_profile` field.

---

## 5. Security & Authorization Logic

We will write a standard security dependency `get_list_write_permission` to protect item routes:

```python
def check_list_write_permission(list_id: int, user: User, db: Session) -> DiveSiteList:
    lst = db.query(DiveSiteList).filter(DiveSiteList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    
    # 1. Owner & Admin check
    if lst.user_id == user.id or user.is_admin:
        return lst
        
    # 2. Collaborator check
    collab = db.query(DiveSiteListCollaborator).filter(
        DiveSiteListCollaborator.list_id == list_id,
        DiveSiteListCollaborator.user_id == user.id,
        DiveSiteListCollaborator.role == "editor"
    ).first()
    
    if not collab:
        raise HTTPException(status_code=403, detail="You do not have write access to this list")
        
    return lst
```

---

## 6. Notifications & Chat Integration

To keep buddies in the loop, adding a buddy to a list executes three notification triggers:

### 6.1 Web Push Notification
Dispatched via `notification_service.py`:
*   **Payload:**
    ```json
    {
      "title": "New Shared List",
      "body": "{owner_username} added you as a collaborator on '{list_title}'",
      "data": {
        "url": "/users/{owner_username}/lists/{list_id}/{list_slug}"
      }
    }
    ```

### 6.2 Email Notification
Sent via `email_service.py`:
*   **Subject:** `You've been added to a collaborative list: {list_title}`
*   **Body:** A stylized HTML email alerting the buddy that they can now co-plan and edit the list.

### 6.3 Chat System Integration (`backend/app/routers/chat.py`)
To integrate list planning into the existing chat feeds:
1. Search for an existing direct 1-on-1 chat room (`UserChatRoom`) between the owner and the newly added collaborator.
2. If a room exists, insert a specialized system message with a structured payload:
    *   `message_type`: `"system_shared_list"`
    *   `content`: `"{owner_username} added you as a collaborator on the list '{list_title}'."`
    *   `metadata`: `{"list_id": list_id, "list_slug": list_slug, "list_title": list_title}`
3. The frontend chat client renders this message type as an interactive rich-text card with a direct button pointing to `/users/{owner_username}/lists/{list_id}`.

### 6.4 Collaborator Activity Notifications

To keep all group planners aligned, whenever any mutating action occurs on a collaborative list (add site, edit notes, delete site, or reorder), the backend will asynchronously notify all other participants of the list (the owner and all active collaborators, excluding the user who initiated the action).

#### Helper Routine
We will define a backend helper function `notify_collaborative_list_activity(list_id: int, initiator_id: int, action: str, details: str, db: Session)` that:
1. Queries the list metadata, owner ID, and collaborator roster.
2. Identifies all participant user IDs: `participants = {list.user_id} | {collab.user_id for collab in list.collaborators}`.
3. Filters out the `initiator_id` to avoid sending self-notifications: `target_users = participants - {initiator_id}`.
4. For each target user, creates a real-time system notification via `NotificationService.create_notification` and dispatches Web Push notifications:
   * **Category:** `"collaborative_list"`
   * **Title:** `"List Updated: {list_title}"`
   * **Action-specific Messages:**
     * *Add Site:* `"{initiator_username} added {site_name} to the list '{list_title}'."`
     * *Edit Notes:* `"{initiator_username} updated notes for {site_name} in the list '{list_title}'."`
     * *Remove Site:* `"{initiator_username} removed {site_name} from the list '{list_title}'."`
     * *Reorder:* `"{initiator_username} reordered the dive sites in the list '{list_title}'."`
   * **Link URL:** `/users/{owner_username}/lists/{list_id}/{list_slug}`

---

## 7. Frontend Layout & User Experience

We will modify several frontend pages using highly responsive tailwind practices.

### 7.1 List Detail Page (`frontend/src/pages/UserListDetail.jsx`)
*   **Collaborator Roster:** Displays a row of small circular profile avatars next to the owner's avatar, representing added editors.
*   **Collaborator Add Button (Owner-only):** Clicking a `+` icon opens a dropdown list of the owner's accepted buddies who are not yet collaborators, facilitating quick roster management.
*   **Permission-Aware Workspace:** 
    *   If `is_owner` or `is_collaborator` is true, display the item notes editor and drag handles.
    *   Otherwise, render a read-only view.
*   **Leave List Button (Collaborator-only):** Allows a collaborator to remove themselves from a shared list.

### 7.2 Profiles (`Profile.jsx` & `UserProfile.jsx`)
*   **"Collaborative" Badge:** Lists that are shared will feature a distinctive icon/badge (e.g., a dual-user icon) next to their title.
*   **Collaborator Preferences:** On the owner's `/profile`, they see a toggle for `show_on_profile` next to shared lists. On the collaborator's profile, they can view lists they are co-editing and toggle their individual display preference.

### 7.3 Save to List Modal (`SaveToListModal.jsx`)
*   The site detail modal will now list BOTH the lists the user owns AND the lists where they are designated as a collaborator with `"editor"` permissions, letting them bookmark sites instantly to co-planned lists.

---

## 8. Verification & Testing Strategy

### 8.1 Backend Unit Testing (`backend/tests/test_collaborative_lists.py`)
We will write a comprehensive suite verifying:
*   **Collaborator Addition:** Adding a buddy who is an active friendship connection succeeds, whereas adding a stranger returns `400`.
*   **Permission Isolation:** Owners can change privacy, edit titles, and delete lists; editors receive `403` when attempting these actions.
*   **Collaborator Actions:** Editors can successfully add, update, reorder, and remove items from the list.
*   **Profile Toggling:** Collaborators can successfully toggle `show_on_profile` and only see appropriate lists on public pages.
*   **Notifications Hook:** Checks that push, email, and chat systems are correctly triggered upon addition.

### 8.2 Frontend Verification
Using the browser MCP tools, we will load the updated pages to confirm:
*   The page loads with zero console or layout errors.
*   Collaborator management elements are hidden/shown based on roles.
*   Interactive maps display plotted sites correctly for both owner and editors.
