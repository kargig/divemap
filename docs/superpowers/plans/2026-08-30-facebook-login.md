# Facebook Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement end-to-end Facebook (Meta) social authentication, profile avatar synchronization, account linking/unlinking, and strict multi-layer synthetic email notification guardrails for Divemap.

**Architecture:** Extend the backend with database fields (`facebook_id`, `facebook_avatar_url`), a dedicated token verification and user creation service (`facebook_auth.py`), and FastAPI authentication endpoints. Protect against sending any email to `{username}@facebook.divemap.invalid` via SES and notification settings checks. On the frontend, integrate the Facebook JavaScript SDK, update AuthContext, add Facebook login/link buttons, and gracefully hide Facebook options for users already authenticated via Google.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, Alembic, AWS SES, React 18, Vite, Tailwind CSS, Facebook JavaScript SDK v18.0.

**Spec:** `docs/superpowers/specs/2026-08-30-facebook-login-design.md`
**Admin Guide:** `docs/maintenance/facebook-oauth-setup.md`

## Global Constraints

- Never use `git add` or commit automatically (prepare `commit-message.txt` for manual execution by the user).
- Synthetic email format: `{username}@facebook.divemap.invalid` (generated from unique username).
- Strict email block: Any attempt to send emails to `.invalid` addresses must be rejected immediately.
- Hide Facebook linking on the Profile page if `user.google_id` is set.
- All backend tests MUST be run via `./docker-test-github-actions.sh [test_file]`. NEVER run pytest directly against local containers.
- All frontend changes MUST be verified with Chrome DevTools MCP ensuring zero console errors.

---

### Task 1: Database Model & Migration

**Files:**
- Modify: `backend/app/models.py:170-175`
- Create: `backend/migrations/versions/0093_add_facebook_login_fields.py`

**Interfaces:**
- Produces: `User.facebook_id` (`String(255)`, nullable, unique, indexed), `User.facebook_avatar_url` (`String(500)`, nullable).

- [ ] **Step 1: Update SQLAlchemy User model in `backend/app/models.py`**
Add `facebook_id` and `facebook_avatar_url` columns right below `google_avatar_url`:
```python
    facebook_id = Column(String(255), unique=True, index=True, nullable=True)  # Facebook OAuth ID
    facebook_avatar_url = Column(String(500), nullable=True)  # Original Facebook avatar URL
```

- [ ] **Step 2: Create Alembic migration script `0093_add_facebook_login_fields.py`**
Create `backend/migrations/versions/0093_add_facebook_login_fields.py`:
```python
"""add facebook login fields

Revision ID: 0093
Revises: 0092
Create Date: 2026-08-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0093'
down_revision = '0092'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('facebook_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_users_facebook_id'), 'users', ['facebook_id'], unique=True)
    op.add_column('users', sa.Column('facebook_avatar_url', sa.String(length=500), nullable=True))

def downgrade():
    op.drop_column('users', 'facebook_avatar_url')
    op.drop_index(op.f('ix_users_facebook_id'), table_name='users')
    op.drop_column('users', 'facebook_id')
```

- [ ] **Step 3: Verify migration against isolated database**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_auth.py
```
Expected: PASS (Verifies that all migrations up to 0093 execute without schema drift or SQL syntax errors).

- [ ] **Step 4: Prepare commit message**
Write to `commit-message.txt`:
```
Add facebook_id and facebook_avatar_url to users table

Introduce migration 0093 adding facebook_id with unique index and
facebook_avatar_url to support Meta/Facebook OAuth login.
```

---

### Task 2: Pydantic Schema Extensions

**Files:**
- Modify: `backend/app/schemas/__init__.py`

**Interfaces:**
- Consumes: `AvatarType` enum and `UserResponse` model.
- Produces: `AvatarType.facebook` and `UserResponse.facebook_avatar_url: Optional[str]`.

- [ ] **Step 1: Write test verifying schema includes facebook avatar type**
Add to a new file `backend/tests/test_facebook_schemas.py`:
```python
import pytest
from app.schemas import AvatarType, UserResponse

def test_avatar_type_has_facebook():
    assert AvatarType.facebook == "facebook"
    assert "facebook" in [e.value for e in AvatarType]

def test_user_response_accepts_facebook_avatar():
    data = {
        "id": 1,
        "username": "testuser",
        "email": "test@facebook.divemap.invalid",
        "enabled": True,
        "is_admin": False,
        "is_moderator": False,
        "facebook_avatar_url": "https://graph.facebook.com/picture.jpg"
    }
    user = UserResponse(**data)
    assert user.facebook_avatar_url == "https://graph.facebook.com/picture.jpg"
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_schemas.py
```
Expected: FAIL (`AttributeError: type object 'AvatarType' has no attribute 'facebook'`).

- [ ] **Step 3: Update `AvatarType` and `UserResponse` in `backend/app/schemas/__init__.py`**
Update `AvatarType`:
```python
class AvatarType(str, enum.Enum):
    google = "google"
    facebook = "facebook"
    custom = "custom"
    library = "library"
```
And add `facebook_avatar_url: Optional[str] = None` to `UserResponse`:
```python
    google_avatar_url: Optional[str] = None
    facebook_avatar_url: Optional[str] = None
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_schemas.py
```
Expected: PASS.

- [ ] **Step 5: Prepare commit message**
Write to `commit-message.txt`:
```
Add facebook to AvatarType enum and UserResponse schema

Extend AvatarType to include facebook and add facebook_avatar_url
to UserResponse schema.
```

---

### Task 3: Backend Facebook Auth Service

**Files:**
- Create: `backend/app/facebook_auth.py`
- Test: `backend/tests/test_facebook_auth.py`

**Interfaces:**
- Produces:
  - `verify_facebook_token(token: str) -> dict`
  - `get_or_create_facebook_user(db: Session, fb_user_info: dict) -> User`

- [ ] **Step 1: Write unit tests for `facebook_auth.py`**
Create `backend/tests/test_facebook_auth.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from app.facebook_auth import verify_facebook_token, get_or_create_facebook_user, FacebookAuthError
from app.models import User, NotificationPreference

def test_verify_facebook_token_success():
    with patch('requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "fb_123456",
            "name": "Jane Doe",
            "picture": {"data": {"url": "https://cdn.facebook.com/avatar.jpg"}}
        }
        mock_get.return_value = mock_response
        
        info = verify_facebook_token("valid_token")
        assert info["id"] == "fb_123456"
        assert info["name"] == "Jane Doe"
        assert info["picture_url"] == "https://cdn.facebook.com/avatar.jpg"

def test_verify_facebook_token_failure():
    with patch('requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"error": {"message": "Invalid token"}}
        mock_get.return_value = mock_response
        
        with pytest.raises(FacebookAuthError):
            verify_facebook_token("bad_token")

def test_get_or_create_facebook_user_new(db_session):
    fb_info = {
        "id": "fb_999888",
        "name": "Scuba Diver",
        "picture_url": "https://cdn.facebook.com/scuba.jpg"
    }
    user = get_or_create_facebook_user(db_session, fb_info)
    assert user.facebook_id == "fb_999888"
    assert user.email == f"{user.username}@facebook.divemap.invalid"
    assert user.email_notifications_opted_out is True
    assert user.facebook_avatar_url == "https://cdn.facebook.com/scuba.jpg"
    assert user.avatar_type == "facebook"
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_auth.py
```
Expected: FAIL (`ModuleNotFoundError: No module named 'app.facebook_auth'`).

- [ ] **Step 3: Implement `backend/app/facebook_auth.py`**
Create `backend/app/facebook_auth.py`:
```python
import os
import re
import secrets
import logging
import requests
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models import User
from app.schemas import AvatarType
from app.auth import get_password_hash
from app.utils import create_default_notification_preferences

logger = logging.getLogger(__name__)

class FacebookAuthError(Exception):
    """Exception raised for Facebook authentication errors."""
    pass

def verify_facebook_token(token: str) -> Dict[str, Any]:
    """Verify Facebook user access token with Meta Graph API."""
    if not token or not token.strip():
        raise FacebookAuthError("Token is missing or empty.")

    try:
        url = "https://graph.facebook.com/v18.0/me"
        params = {
            "fields": "id,name,picture.type(large)",
            "access_token": token
        }
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if response.status_code != 200 or "error" in data:
            error_msg = data.get("error", {}).get("message", "Facebook token validation failed.")
            logger.warning(f"Facebook Graph API validation error: {error_msg}")
            raise FacebookAuthError(error_msg)
            
        picture_url = None
        if "picture" in data and "data" in data["picture"] and "url" in data["picture"]["data"]:
            picture_url = data["picture"]["data"]["url"]
            
        return {
            "id": str(data.get("id")),
            "name": data.get("name", ""),
            "picture_url": picture_url
        }
    except requests.RequestException as e:
        logger.error(f"Network error calling Facebook Graph API: {e}")
        raise FacebookAuthError("Unable to contact Facebook service.")

def _generate_valid_username(db: Session, base_name: str, fb_id: str) -> str:
    """Generate a sanitized, unique username."""
    clean = re.sub(r'[^a-zA-Z0-9_]', '', base_name.lower().replace(' ', '_'))
    if len(clean) < 3:
        clean = f"fb_user_{fb_id[:6]}"
    clean = clean[:40]

    candidate = clean
    counter = 1
    while db.query(User).filter(User.username == candidate).first() is not None:
        suffix = f"_{counter}"
        candidate = f"{clean[:50-len(suffix)]}{suffix}"
        counter += 1
    return candidate

def get_or_create_facebook_user(db: Session, fb_info: Dict[str, Any]) -> User:
    """Find existing Facebook user or register a new one with a synthetic email."""
    fb_id = fb_info["id"]
    picture_url = fb_info.get("picture_url")
    full_name = fb_info.get("name")

    user = db.query(User).filter(User.facebook_id == fb_id).first()
    if user:
        if picture_url:
            user.facebook_avatar_url = picture_url
            if user.avatar_type == AvatarType.facebook or not user.avatar_url:
                user.avatar_url = picture_url
                user.avatar_type = AvatarType.facebook
        db.commit()
        db.refresh(user)
        return user

    username = _generate_valid_username(db, full_name, fb_id)
    synthetic_email = f"{username}@facebook.divemap.invalid"
    random_password = secrets.token_urlsafe(32)

    new_user = User(
        username=username,
        name=full_name,
        email=synthetic_email,
        password_hash=get_password_hash(random_password),
        facebook_id=fb_id,
        avatar_url=picture_url,
        avatar_type=AvatarType.facebook if picture_url else None,
        facebook_avatar_url=picture_url,
        enabled=True,
        email_verified=False,
        email_notifications_opted_out=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    create_default_notification_preferences(new_user.id, db)
    return new_user
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_auth.py
```
Expected: PASS.

- [ ] **Step 5: Prepare commit message**
Write to `commit-message.txt`:
```
Add Facebook authentication verification and user creation service

Implement verify_facebook_token calling Graph API and get_or_create_facebook_user
generating unique synthetic emails with disabled notifications.
```

---

### Task 4: Email Protections (SES & Notification Safeguards)

**Files:**
- Modify: `backend/app/services/ses_service.py`
- Modify: `backend/app/routers/notifications.py`
- Test: `backend/tests/test_facebook_email_safeguards.py`

**Interfaces:**
- Consumes: `SESService.send_email`, `update_notification_preference`.
- Produces: Immediate bypass in SES and `HTTPException(400)` when attempting to enable emails on `.invalid` address accounts.

- [ ] **Step 1: Write tests for email safeguards**
Create `backend/tests/test_facebook_email_safeguards.py`:
```python
import pytest
from unittest.mock import patch
from app.services.ses_service import SESService
from app.models import User, NotificationPreference

def test_ses_service_blocks_invalid_emails():
    ses = SESService()
    # Ensure it returns False and does not invoke AWS SES
    with patch.object(ses, '_create_ses_client') as mock_client:
        result = ses.send_email(
            to_email="testuser@facebook.divemap.invalid",
            subject="Test Subject",
            html_body="<p>Test</p>"
        )
        assert result is False
        mock_client.assert_not_called()

def test_notification_preference_blocks_enabling_email_for_synthetic_user(client, db_session):
    # Create user with synthetic email
    user = User(
        username="fb_tester",
        email="fb_tester@facebook.divemap.invalid",
        password_hash="dummy",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    pref = NotificationPreference(
        user_id=user.id,
        category="system",
        enable_website=True,
        enable_email=False
    )
    db_session.add(pref)
    db_session.commit()

    with patch('app.routers.notifications.get_current_active_user', return_value=user):
        response = client.put(
            f"/api/v1/notifications/preferences/system",
            json={"enable_email": True}
        )
        assert response.status_code == 400
        assert "synthetic/social account" in response.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_email_safeguards.py
```
Expected: FAIL.

- [ ] **Step 3: Update `SESService` in `backend/app/services/ses_service.py`**
In `send_email` and `send_bulk_email`, add check at the beginning:
```python
        if to_email.endswith('.invalid'):
            logger.warning(f"Bypassing email delivery to synthetic/invalid address: {to_email}")
            return False
```

- [ ] **Step 4: Update preference toggle in `backend/app/routers/notifications.py`**
In `update_notification_preference` around line 545:
```python
    if preference_update.enable_email is not None and preference_update.enable_email:
        if current_user.email and current_user.email.endswith('.invalid'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot enable email notifications: You are using a synthetic/social account without a real email. Please add a valid email address to your profile first."
            )
```

- [ ] **Step 5: Run test to verify it passes**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_email_safeguards.py
```
Expected: PASS.

- [ ] **Step 6: Prepare commit message**
Write to `commit-message.txt`:
```
Add multi-layer email safeguards for synthetic addresses

Block outbound SES deliveries to .invalid domains and reject enabling
email notifications for synthetic accounts via the API.
```

---

### Task 5: Auth Router Endpoint (`/api/v1/auth/facebook-login`)

**Files:**
- Modify: `backend/app/routers/auth.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Produces: `POST /api/v1/auth/facebook-login` returning `Token` and setting refresh cookie.

- [ ] **Step 1: Write test for `/facebook-login` endpoint in `backend/tests/test_auth.py`**
Append to `backend/tests/test_auth.py`:
```python
@patch('app.routers.auth.verify_facebook_token')
@patch('app.routers.auth.get_or_create_facebook_user')
def test_facebook_login_success(mock_get_or_create, mock_verify, client, db_session):
    mock_verify.return_value = {
        "id": "fb_123",
        "name": "FB User",
        "picture_url": "https://avatar.url"
    }
    user = User(
        username="fb_user",
        email="fb_user@facebook.divemap.invalid",
        facebook_id="fb_123",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()
    mock_get_or_create.return_value = user

    response = client.post("/api/v1/auth/facebook-login", json={"token": "valid_fb_token"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["user"]["username"] == "fb_user"

def test_password_reset_blocked_for_facebook_user(client, db_session):
    user = User(
        username="fb_reset_user",
        email="fb_reset_user@facebook.divemap.invalid",
        facebook_id="fb_999",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()

    response = client.post("/api/v1/auth/password-reset-request", json={"email_or_username": "fb_reset_user"})
    assert response.status_code == 400
    assert "social login" in response.json()["detail"].lower()
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_auth.py
```
Expected: FAIL (`404 Not Found` for `/facebook-login`).

- [ ] **Step 3: Implement `/facebook-login` and password reset protection in `backend/app/routers/auth.py`**
In `backend/app/routers/auth.py`:
Add schema:
```python
class FacebookLoginRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Facebook user access token")
```
Add endpoint:
```python
from app.facebook_auth import verify_facebook_token, get_or_create_facebook_user, FacebookAuthError

@router.post("/facebook-login", response_model=Token)
@skip_rate_limit_for_admin("30/minute")
async def facebook_login(
    request: Request,
    response: Response,
    facebook_data: FacebookLoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate or register user via Facebook access token."""
    try:
        fb_user_info = verify_facebook_token(facebook_data.token)
        user = get_or_create_facebook_user(db, fb_user_info)
        
        if not user.enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled"
            )

        # Track access and create session token
        user.last_accessed_at = datetime.now(timezone.utc)
        db.commit()

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        refresh_token_value = create_refresh_token(
            data={"sub": user.username},
            user_id=user.id,
            db=db
        )
        set_refresh_token_cookie(response, refresh_token_value)

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user
        )
    except FacebookAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
```
In `password_reset_request`, block Facebook users similarly to Google users:
```python
    if user.google_id or user.facebook_id:
        provider = "Google" if user.google_id else "Facebook"
        logger.info(f"Password reset requested for {provider} user {user.id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This account uses {provider} social login. Please sign in with {provider}."
        )
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_auth.py
```
Expected: PASS.

- [ ] **Step 5: Prepare commit message**
Write to `commit-message.txt`:
```
Add /facebook-login endpoint and protect password reset

Implement Facebook login token exchange endpoint and prevent password
resets on Facebook-authenticated accounts.
```

---

### Task 6: Account Linking & Avatar Reset

**Files:**
- Modify: `backend/app/routers/users.py`
- Test: `backend/tests/test_facebook_linking.py`

**Interfaces:**
- Produces: `POST /api/v1/users/me/facebook/link`, `DELETE /api/v1/users/me/facebook/unlink`.
- Modifies: `DELETE /api/v1/users/me/avatar` to reset to Facebook photo if available.

- [ ] **Step 1: Write test for linking, unlinking, and avatar reset**
Create `backend/tests/test_facebook_linking.py`:
```python
import pytest
from unittest.mock import patch
from app.models import User
from app.schemas import AvatarType

@patch('app.routers.users.verify_facebook_token')
def test_link_and_unlink_facebook(mock_verify, client, db_session):
    mock_verify.return_value = {
        "id": "fb_link_123",
        "name": "Link User",
        "picture_url": "https://avatar.link/pic.jpg"
    }
    user = User(
        username="localuser",
        email="local@example.com",
        password_hash="somehash",
        enabled=True
    )
    db_session.add(user)
    db_session.commit()

    with patch('app.routers.users.get_current_active_user', return_value=user):
        # Link Facebook
        res = client.post("/api/v1/users/me/facebook/link", json={"token": "valid_token"})
        assert res.status_code == 200
        assert user.facebook_id == "fb_link_123"
        assert user.facebook_avatar_url == "https://avatar.link/pic.jpg"

        # Unlink Facebook
        res = client.delete("/api/v1/users/me/facebook/unlink")
        assert res.status_code == 200
        assert user.facebook_id is None
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_linking.py
```
Expected: FAIL (404 on link endpoint).

- [ ] **Step 3: Implement linking, unlinking, and avatar reset in `backend/app/routers/users.py`**
Add schemas and endpoints:
```python
class FacebookLinkRequest(BaseModel):
    token: str = Field(..., min_length=1)

@router.post("/me/facebook/link", response_model=UserResponse)
async def link_facebook(
    link_data: FacebookLinkRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    from app.facebook_auth import verify_facebook_token, FacebookAuthError
    try:
        fb_info = verify_facebook_token(link_data.token)
        fb_id = fb_info["id"]

        # Check if already linked to another user
        existing = db.query(User).filter(User.facebook_id == fb_id, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This Facebook account is already linked to another user."
            )

        current_user.facebook_id = fb_id
        current_user.facebook_avatar_url = fb_info.get("picture_url")
        db.commit()
        db.refresh(current_user)
        return current_user
    except FacebookAuthError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.delete("/me/facebook/unlink", response_model=UserResponse)
async def unlink_facebook(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if not current_user.password_hash and not current_user.google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unlink Facebook because you have no other login method configured."
        )

    current_user.facebook_id = None
    if current_user.avatar_type == AvatarType.facebook:
        current_user.avatar_url = None
        current_user.avatar_type = None
    current_user.facebook_avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user
```
Update `remove_avatar` in `backend/app/routers/users.py`:
```python
    if current_user.facebook_avatar_url and current_user.avatar_type == AvatarType.facebook:
        current_user.avatar_url = current_user.facebook_avatar_url
    elif current_user.google_avatar_url:
        current_user.avatar_url = current_user.google_avatar_url
        current_user.avatar_type = AvatarType.google
    elif current_user.facebook_avatar_url:
        current_user.avatar_url = current_user.facebook_avatar_url
        current_user.avatar_type = AvatarType.facebook
    else:
        current_user.avatar_url = None
        current_user.avatar_type = None
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```bash
cd backend && ./docker-test-github-actions.sh tests/test_facebook_linking.py
```
Expected: PASS.

- [ ] **Step 5: Prepare commit message**
Write to `commit-message.txt`:
```
Add Facebook account linking, unlinking, and avatar reset logic

Provide endpoints for users to link or unlink their Facebook profile
and allow resetting user avatar back to Facebook photo.
```

---

### Task 7: Frontend Facebook Authentication Utility & AuthContext

**Files:**
- Create: `frontend/src/utils/facebookAuth.js`
- Modify: `frontend/src/services/auth.jsx`
- Modify: `frontend/src/contexts/AuthContext.jsx`

**Interfaces:**
- Produces: `facebookAuth.signIn() -> Promise<string>`, `authService.facebookLogin(token)`, `loginWithFacebook(token)`.

- [ ] **Step 1: Create `frontend/src/utils/facebookAuth.js`**
```javascript
class FacebookAuth {
  constructor() {
    this.appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized || typeof window === 'undefined') return;

    return new Promise((resolve) => {
      if (window.FB) {
        this.isInitialized = true;
        resolve();
        return;
      }

      window.fbAsyncInit = () => {
        window.FB.init({
          appId: this.appId,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        this.isInitialized = true;
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    });
  }

  async signIn() {
    if (!this.appId || this.appId === 'undefined') {
      throw new Error('Facebook App ID not configured.');
    }
    await this.initialize();

    return new Promise((resolve, reject) => {
      window.FB.login((response) => {
        if (response.authResponse && response.authResponse.accessToken) {
          resolve(response.authResponse.accessToken);
        } else {
          reject(new Error('Facebook sign in was cancelled or failed.'));
        }
      }, { scope: 'public_profile' });
    });
  }
}

export const facebookAuth = new FacebookAuth();
```

- [ ] **Step 2: Add `facebookLogin`, `linkFacebook`, `unlinkFacebook` to `frontend/src/services/auth.jsx`**
```javascript
export const facebookLogin = async (token) => {
  const response = await api.post('/api/v1/auth/facebook-login', { token });
  return response.data;
};

export const linkFacebook = async (token) => {
  const response = await api.post('/api/v1/users/me/facebook/link', { token });
  return response.data;
};

export const unlinkFacebook = async () => {
  const response = await api.delete('/api/v1/users/me/facebook/unlink');
  return response.data;
};
```

- [ ] **Step 3: Expose `loginWithFacebook` in `frontend/src/contexts/AuthContext.jsx`**
In `AuthContext.jsx`, add:
```javascript
  const loginWithFacebook = async (token) => {
    try {
      const data = await authService.facebookLogin(token);
      const { access_token, user: userData } = data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      setUser(userData);
      setIsAuthenticated(true);
      toast.success(`Welcome, ${userData.name || userData.username}!`);
      return true;
    } catch (error) {
      console.error('Facebook login error:', error);
      toast.error(error.response?.data?.detail || 'Facebook login failed');
      return false;
    }
  };
```

- [ ] **Step 4: Prepare commit message**
Write to `commit-message.txt`:
```
Add frontend Facebook authentication client utility and context methods

Provide facebookAuth SDK loader and loginWithFacebook method in AuthContext.
```

---

### Task 8: Frontend UI (Buttons, Profile Linking & Notification Guardrails)

**Files:**
- Modify: `frontend/src/pages/Login.jsx` & `frontend/src/pages/Register.jsx`
- Modify: `frontend/src/pages/Profile.jsx`
- Modify: `frontend/src/components/AvatarEditor.jsx`
- Modify: `frontend/src/pages/Notifications.jsx`

**Interfaces:**
- Produces: Facebook Login buttons, conditional Profile Social Link toggles, AvatarEditor reset option, and non-invasive notification prompt.

- [ ] **Step 1: Add Facebook Login button to `Login.jsx` and `Register.jsx`**
Add brand-compliant Facebook button:
```jsx
{import.meta.env.VITE_FACEBOOK_APP_ID && (
  <Button
    type="button"
    variant="outline"
    onClick={async () => {
      try {
        const token = await facebookAuth.signIn();
        await loginWithFacebook(token);
      } catch (err) {
        console.error(err);
      }
    }}
    className="flex items-center justify-center gap-3 w-full bg-[#1877F2] text-white hover:bg-[#166FE5] border-transparent"
  >
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
    Continue with Facebook
  </Button>
)}
```

- [ ] **Step 2: Add Facebook Link / Unlink section in `Profile.jsx`**
Only display if `!user.google_id`:
```jsx
{!user.google_id && (
  <div className="flex items-center justify-between p-4 border rounded-xl dark:border-gray-700">
    <div>
      <h4 className="font-medium text-gray-900 dark:text-gray-100">Facebook Account</h4>
      <p className="text-sm text-gray-500">
        {user.facebook_id ? "Your account is connected to Facebook." : "Connect your Facebook account for quick sign-in."}
      </p>
    </div>
    {user.facebook_id ? (
      <Button variant="danger-outline" size="sm" onClick={handleUnlinkFacebook}>
        Disconnect
      </Button>
    ) : (
      <Button variant="outline" size="sm" onClick={handleLinkFacebook}>
        Connect
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 3: Update `AvatarEditor.jsx` to support Facebook avatars**
Accept `facebookAvatarUrl` prop and show:
```jsx
{hasFacebookAvatar ? 'Reset to Facebook Photo' : hasGoogleAvatar ? 'Reset to Google Photo' : 'Remove Photo'}
```

- [ ] **Step 4: Update `Notifications.jsx` email toggles and inline hint**
If `user.email?.endsWith('.invalid')`, disable the email toggle and display:
```jsx
{user.email?.endsWith('.invalid') && (
  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 rounded-lg text-sm flex items-center justify-between">
    <span>To receive email notifications, please add a valid email to your profile.</span>
    <Link to="/profile" className="font-semibold underline ml-2 shrink-0">
      Add Email
    </Link>
  </div>
)}
```

- [ ] **Step 5: Verify in browser and check for console errors**
Use Chrome DevTools MCP (`navigate_page`, `list_console_messages`) across `/login`, `/register`, `/profile`, and `/notifications` to ensure 0 console errors.

- [ ] **Step 6: Prepare commit message**
Write to `commit-message.txt`:
```
Add Facebook login buttons, profile linking, and notification hints

Integrate Facebook auth into Login, Register, Profile, AvatarEditor, and
Notifications views with responsive layout and zero console errors.
```
