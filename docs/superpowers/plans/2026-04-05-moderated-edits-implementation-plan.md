# Moderated Dive Site Edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement a trust-gated "shadow copy" edit system for dive sites, allowing untrusted users to propose changes (site data or media) that require moderator approval, while trusted users' changes apply immediately.

**Architecture:** A new `DiveSiteEditRequest` model captures pending edits. The existing `PUT /dive_sites/{id}` and `POST/PATCH/DELETE /dive_sites/{id}/media` endpoints evaluate an `is_trusted_contributor()` helper. If trusted, changes apply immediately. If untrusted, a pending request is created and a 202 response is returned. New admin endpoints allow moderators to review and apply these requests.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, Alembic, Pytest

---

### Task 1: Create Data Model and Alembic Migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/alembic/env.py` (if necessary to import models)
- Create: `backend/migrations/versions/XXXX_add_dive_site_edit_requests.py`

- [x] **Step 1: Write the failing test for the model**

```python
# Create new file: backend/tests/test_moderation_models.py
from app.models import DiveSiteEditRequest

def test_dive_site_edit_request_model(db_session, test_user, test_dive_site):
    request = DiveSiteEditRequest(
        dive_site_id=test_dive_site.id,
        requested_by_id=test_user.id,
        status="pending",
        edit_type="site_data",
        proposed_data={"description": "new text"}
    )
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)

    assert request.id is not None
    assert request.status == "pending"
    assert request.edit_type == "site_data"
    assert request.proposed_data["description"] == "new text"
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_moderation_models.py`
Expected: FAIL (ImportError or OperationalError missing table)

- [x] **Step 3: Write minimal implementation (Models)**

Add to `backend/app/models.py`:
```python
import enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON

class EditRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class EditRequestType(str, enum.Enum):
    site_data = "site_data"
    media_addition = "media_addition"
    media_update = "media_update"
    media_deletion = "media_deletion"

class DiveSiteEditRequest(Base):
    __tablename__ = "dive_site_edit_requests"

    id = Column(Integer, primary_key=True, index=True)
    dive_site_id = Column(Integer, ForeignKey("dive_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(EditRequestStatus), default=EditRequestStatus.pending, nullable=False, index=True)
    edit_type = Column(Enum(EditRequestType), default=EditRequestType.site_data, nullable=False)
    # Use JSON type, SQLAlchemy will map to JSON/JSONB depending on dialect
    proposed_data = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    dive_site = relationship("DiveSite", backref="edit_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
```

- [x] **Step 4: Generate Alembic Migration**

Run: `docker-compose exec backend alembic revision --autogenerate -m "add dive site edit requests"`
Rename the generated file in `backend/migrations/versions/` to follow the sequential pattern (e.g., `0054_...`) and change the revision IDs accordingly.
Review the migration file to ensure it only contains the `dive_site_edit_requests` table creation and enums.

- [x] **Step 5: Run test to verify it passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_moderation_models.py`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/app/models.py backend/migrations/versions/* backend/tests/test_moderation_models.py
git commit -m "feat: add DiveSiteEditRequest model and migration"
```

---

### Task 2: Implement Trust Evaluation Helper

**Files:**
- Modify: `backend/app/auth.py`
- Modify: `backend/tests/test_auth.py`

- [x] **Step 1: Write the failing test**

```python
# Add to backend/tests/test_auth.py
from app.auth import is_trusted_contributor
from app.models import User, DiveSite, Dive, DivingCenter, DiveRoute

def test_is_trusted_contributor(db_session, test_user, test_dive_site):
    # Base case: Untrusted
    assert not is_trusted_contributor(test_user, test_dive_site)

    # Case: Owner
    test_dive_site.created_by = test_user.id
    assert is_trusted_contributor(test_user, test_dive_site)
    test_dive_site.created_by = 9999 # Reset

    # Case: Admin
    test_user.is_admin = True
    assert is_trusted_contributor(test_user, test_dive_site)
    test_user.is_admin = False

    # Case: Activity (has a dive)
    new_dive = Dive(user_id=test_user.id, dive_site_id=test_dive_site.id, date="2023-01-01")
    db_session.add(new_dive)
    db_session.commit()
    assert is_trusted_contributor(test_user, test_dive_site)
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_auth.py::test_is_trusted_contributor`
Expected: FAIL (ImportError or Assertion Error)

- [x] **Step 3: Write minimal implementation**

Add to `backend/app/auth.py`:
```python
from app.models import User, DiveSite

def is_trusted_contributor(user: User, dive_site: DiveSite) -> bool:
    if user.is_admin or user.is_moderator:
        return True
    if dive_site.created_by == user.id:
        return True

    # Lightweight Activity Check
    has_activity = (
        len(user.dives) >= 1 or
        len(user.created_sites) >= 1 or
        len(user.diving_centers) >= 1 or
        len(user.auth_audit_logs) >= 1 # Note: User model does not currently have dive_routes relationship, check models.py!
        # Wait, need to fix relationship check. Safer to query explicitly if relationship isn't eager loaded.
    )
    return has_activity
```
*Self-correction during implementation*: Relying on `len(user.dives)` requires eager loading. It's safer to query the DB directly to prevent N+1 or DetachedInstance errors.

Update implementation in `backend/app/auth.py`:
```python
from sqlalchemy.orm import Session
from app.models import User, DiveSite, Dive, DivingCenter, DiveRoute

def is_trusted_contributor(db: Session, user: User, dive_site: DiveSite) -> bool:
    if user.is_admin or user.is_moderator:
        return True
    if dive_site.created_by == user.id:
        return True

    # Explicit DB counts for lightweight activity check
    dive_count = db.query(Dive).filter(Dive.user_id == user.id).count()
    site_count = db.query(DiveSite).filter(DiveSite.created_by == user.id).count()
    center_count = db.query(DivingCenter).filter(DivingCenter.owner_id == user.id).count()
    route_count = db.query(DiveRoute).filter(DiveRoute.created_by == user.id).count()

    return (dive_count + site_count + center_count + route_count) >= 1
```

- [x] **Step 4: Fix test for DB Session injection**

Update test in `backend/tests/test_auth.py` to pass `db_session`:
```python
def test_is_trusted_contributor(db_session, test_user, test_dive_site):
    assert not is_trusted_contributor(db_session, test_user, test_dive_site)
    # ... update all calls to include db_session ...
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_auth.py::test_is_trusted_contributor`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/app/auth.py backend/tests/test_auth.py
git commit -m "feat: implement is_trusted_contributor helper"
```

---

### Task 3: Intercept `PUT /dive_sites/{id}` Endpoint

**Files:**
- Modify: `backend/app/routers/dive_sites.py`
- Modify: `backend/tests/test_dive_sites.py` (or create new)

- [x] **Step 1: Write the failing test**

```python
# Add to backend/tests/test_dive_sites_moderation.py
def test_untrusted_user_put_returns_202(client, test_dive_site, untrusted_user_token_headers, db_session):
    payload = {"description": "Untrusted edit"}
    response = client.put(f"/api/v1/dive-sites/{test_dive_site.id}", json=payload, headers=untrusted_user_token_headers)

    assert response.status_code == 202
    assert "submitted for moderation" in response.json()["message"]

    # Verify DB wasn't changed immediately
    db_session.refresh(test_dive_site)
    assert test_dive_site.description != "Untrusted edit"
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_dive_sites_moderation.py`
Expected: FAIL (currently returns 403 Forbidden for untrusted users)

- [x] **Step 3: Write minimal implementation**

Modify `update_dive_site` in `backend/app/routers/dive_sites.py`:
```python
# Add imports
from app.auth import is_trusted_contributor
from app.models import DiveSiteEditRequest, EditRequestStatus, EditRequestType
from app.services.notification_service import NotificationService # Assuming this exists

# Inside update_dive_site
@router.put("/{dive_site_id}")
async def update_dive_site(...):
    dive_site = db.query(DiveSite).filter(DiveSite.id == dive_site_id).first()
    if not dive_site:
        raise HTTPException(status_code=404, detail="Dive site not found")

    # NEW MODERATION LOGIC
    if not is_trusted_contributor(db, current_user, dive_site):
        # Serialize only provided fields
        update_data = site_update.dict(exclude_unset=True)

        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.site_data,
            proposed_data=update_data
        )
        db.add(edit_request)
        db.commit()

        # Notify admins
        ns = NotificationService()
        await ns.notify_admins_pending_edit(edit_request.id, db) # Create this dummy method or use existing

        # The endpoint previously returned a DiveSiteResponse, so we must return JSON directly
        # or handle a Union response. The easiest way is returning JSONResponse for the 202.
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"message": "Your changes have been submitted for moderation."}
        )

    # ... existing trusted user update logic ...
```

- [x] **Step 4: Update Notification Service (Stub)**

Add to `backend/app/services/notification_service.py`:
```python
    async def notify_admins_pending_edit(self, edit_request_id: int, db: Session):
        pass # Implementation details depend on current notification system
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_dive_sites_moderation.py`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/app/routers/dive_sites.py backend/app/services/notification_service.py backend/tests/test_dive_sites_moderation.py
git commit -m "feat: intercept untrusted dive site updates with 202 status"
```

---

### Task 4: Intercept Media Endpoints

**Files:**
- Modify: `backend/app/routers/dive_sites.py`
- Modify: `backend/tests/test_dive_sites_moderation.py`

- [x] **Step 1: Write the failing tests**

```python
# Add to backend/tests/test_dive_sites_moderation.py
def test_untrusted_media_addition_returns_202(client, test_dive_site, untrusted_user_token_headers):
    payload = {"media_type": "photo", "url": "http://example.com/img.jpg"}
    response = client.post(f"/api/v1/dive-sites/{test_dive_site.id}/media", json=payload, headers=untrusted_user_token_headers)
    assert response.status_code == 202
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_dive_sites_moderation.py::test_untrusted_media_addition_returns_202`
Expected: FAIL (returns 403 Forbidden)

- [x] **Step 3: Write minimal implementation**

Modify `add_dive_site_media` in `backend/app/routers/dive_sites.py`:
```python
@router.post("/{dive_site_id}/media")
async def add_dive_site_media(...):
    # ... dive site existence check ...

    if not is_trusted_contributor(db, current_user, dive_site):
        update_data = media.dict()
        edit_request = DiveSiteEditRequest(
            dive_site_id=dive_site_id,
            requested_by_id=current_user.id,
            status=EditRequestStatus.pending,
            edit_type=EditRequestType.media_addition,
            proposed_data=update_data
        )
        db.add(edit_request)
        db.commit()
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=202, content={"message": "Media addition submitted for moderation."})

    # ... existing logic ...
```
*(Apply similar logic to `update_dive_site_media` using `EditRequestType.media_update` and `delete_dive_site_media` using `EditRequestType.media_deletion`, packaging the `media_id` in the `proposed_data`.)*

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_dive_sites_moderation.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/routers/dive_sites.py backend/tests/test_dive_sites_moderation.py
git commit -m "feat: intercept untrusted media changes with 202 status"
```

---

### Task 5: Create Moderation Admin Endpoints

**Files:**
- Modify: `backend/app/routers/admin.py`
- Modify: `backend/tests/test_admin.py`

- [x] **Step 1: Write the failing tests**

```python
# Add to backend/tests/test_admin_moderation.py
def test_admin_can_approve_edit_request(client, admin_token_headers, db_session, test_dive_site, untrusted_user):
    from app.models import DiveSiteEditRequest, EditRequestStatus, EditRequestType
    req = DiveSiteEditRequest(
        dive_site_id=test_dive_site.id, requested_by_id=untrusted_user.id,
        status=EditRequestStatus.pending, edit_type=EditRequestType.site_data,
        proposed_data={"description": "Admin approved this"}
    )
    db_session.add(req)
    db_session.commit()

    response = client.post(f"/api/v1/admin/edit-requests/{req.id}/approve", headers=admin_token_headers)
    assert response.status_code == 200

    db_session.refresh(test_dive_site)
    assert test_dive_site.description == "Admin approved this"
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_admin_moderation.py`
Expected: FAIL (404 Not Found endpoint doesn't exist)

- [x] **Step 3: Write minimal implementation**

Add to `backend/app/routers/admin.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from app.database import get_db
from app.auth import get_current_active_user, is_admin_or_moderator # Assuming these exist
from app.models import User, DiveSiteEditRequest, EditRequestStatus, EditRequestType, DiveSite, SiteMedia

# Assuming router exists, otherwise create it
@router.get("/edit-requests")
async def get_pending_edit_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_moderator):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # Use joinedload to prevent N+1 queries when serializing the requester and the dive site
    return db.query(DiveSiteEditRequest)\
        .options(
            joinedload(DiveSiteEditRequest.requested_by),
            joinedload(DiveSiteEditRequest.dive_site)
        )\
        .filter(DiveSiteEditRequest.status == EditRequestStatus.pending)\
        .all()

@router.post("/edit-requests/{request_id}/approve")
async def approve_edit_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not (current_user.is_admin or current_user.is_moderator):
        raise HTTPException(status_code=403, detail="Forbidden")

    edit_req = db.query(DiveSiteEditRequest).filter(DiveSiteEditRequest.id == request_id).first()
    if not edit_req or edit_req.status != EditRequestStatus.pending:
        raise HTTPException(status_code=404, detail="Pending request not found")

    if edit_req.edit_type == EditRequestType.site_data:
        dive_site = db.query(DiveSite).filter(DiveSite.id == edit_req.dive_site_id).first()
        for key, value in edit_req.proposed_data.items():
            setattr(dive_site, key, value)

    elif edit_req.edit_type == EditRequestType.media_addition:
        media = SiteMedia(dive_site_id=edit_req.dive_site_id, **edit_req.proposed_data)
        db.add(media)

    # ... handle media_update and media_deletion ...

    edit_req.status = EditRequestStatus.approved
    edit_req.reviewed_at = datetime.utcnow()
    edit_req.reviewed_by_id = current_user.id
    db.commit()
    return {"message": "Approved"}

@router.post("/edit-requests/{request_id}/reject")
async def reject_edit_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # ... standard reject logic setting status and reviewed_by ...
    pass
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_admin_moderation.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin_moderation.py
git commit -m "feat: add admin endpoints to review edit requests"
```


## Future Follow-ups

### Tag Moderation
- [x] 1. The tag endpoints in `backend/app/routers/tags.py` need to be updated to evaluate `is_trusted_contributor()` instead of strictly requiring `is_admin_or_moderator()`.
- [x] 2. New `EditRequestType` enums (e.g., `tag_addition`, `tag_removal`) should be added to the `DiveSiteEditRequest` model.
- [x] 3. Untrusted users attempting to modify tags should have their requests queued, returning a `202 Accepted`.
- [x] 4. The Admin Moderation Dashboard and backend approval logic (`/api/v1/admin/dive-sites/edit-requests/{request_id}/approve`) must be expanded to process and apply these pending tag changes.

### Media Refinement
- [x] 1. Intercept `PATCH /dive_sites/{id}/media/{media_id}` for descriptions.
- [x] 2. Intercept `DELETE /dive_sites/{id}/media/{media_id}`.

### Notification Completeness
- [x] 1. Implement actual email/push dispatch in `ns.notify_admins_pending_edit()` rather than just a stub.

---

## Phase 2: Frontend & Refinement

### Task 6: Build Admin Moderation Dashboard (Frontend)

**Files:**
- Create: `frontend/src/pages/AdminEditRequests.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Admin.jsx`

- [x] **Step 1: Create the AdminEditRequests page**
Create a component that fetches the pending requests via `GET /api/v1/admin/dive-sites/edit-requests`. It should render a list of cards or a table showing the `requested_by.username`, the `dive_site.name`, the `edit_type`, and the `proposed_data` (formatted nicely as a JSON tree or diff view).
Add "Approve" and "Reject" buttons that call the respective POST endpoints and refresh the list on success.

- [x] **Step 2: Add routing in App.jsx**
Add a route for `/admin/edit-requests` protected by the `AdminRoute` wrapper.

- [x] **Step 3: Link from Admin Dashboard**
Add a new card in `frontend/src/pages/Admin.jsx` for "Pending Edits" pointing to `/admin/edit-requests`.

- [x] **Step 4: Commit**
```bash
git commit -m "feat: add admin moderation dashboard for dive site edits"
```
