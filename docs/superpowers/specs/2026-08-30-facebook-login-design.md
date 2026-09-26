# Design Specification: Facebook Login Integration

* **Status:** Draft / Pending Review
* **Author:** Gemini CLI
* **Date:** 2026-08-30
* **Target Version:** 1.0.0
* **Administrator Guide:** [Facebook Login Setup](../../maintenance/facebook-oauth-setup.md)

---

## 1. Overview & Objectives

This specification outlines the integration of Facebook (Meta) authentication within the Divemap application. The primary goals are:
1. Enable frictionless login and registration via Facebook on both web and mobile platforms.
2. Respect user privacy by avoiding requesting email addresses unless provided and requested explicitly.
3. Use a synthetic email address format (`{username}@facebook.divemap.invalid`) to satisfy existing database non-nullable constraints.
4. Establish bulletproof, layer-by-layer protections to ensure synthetic emails are never accidentally messaged or emailed.
5. Provide user-friendly, non-intrusive prompts to add a real email if they try to enable email notifications.
6. Enable existing password-authenticated users to link and unlink their Facebook accounts.
7. Avoid UI noise by hiding Facebook integration options for users who already have Google linked.

---

## 2. Database Schema Modifications

A sequential database migration (`backend/migrations/versions/0093_add_facebook_login_fields.py`) will add the following columns to the `users` table:

*   `facebook_id = Column(String(255), unique=True, index=True, nullable=True)`
*   `facebook_avatar_url = Column(String(500), nullable=True)`

### 2.1. Model Mapping (SQLAlchemy)
In `backend/app/models.py`, the `User` class will include:
```python
facebook_id = Column(String(255), unique=True, index=True, nullable=True)  # Facebook OAuth ID
facebook_avatar_url = Column(String(500), nullable=True)  # Original Facebook avatar URL
```

---

## 3. Core Backend Implementation

### 3.1. Schema Changes (`backend/app/schemas/__init__.py`)
Extend `AvatarType` to support `facebook`:
```python
class AvatarType(str, enum.Enum):
    google = "google"
    facebook = "facebook"
    custom = "custom"
    library = "library"
```
Ensure that `facebook_avatar_url` is added as an optional field in `UserResponse` and other user schemas.

### 3.2. Facebook Verification Module (`backend/app/facebook_auth.py`)
This module will configure and handle communication with the Facebook Graph API:

*   **Config Validation:**
    ```python
    FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID")
    FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET")
    ```
*   **Verification:**
    Send an HTTPS `GET` request to:
    `https://graph.facebook.com/v18.0/me?fields=id,name,picture.type(large)&access_token={token}`
    *   If Facebook returns an HTTP error (e.g. invalid or expired access token), raise an authentication exception.
    *   If successful, extract `id`, `name`, and `picture.data.url`.
*   **User Resolution:**
    *   Check if a user exists with the returned `facebook_id`.
    *   If found, update their `facebook_avatar_url` (always fresh from Facebook) and return the user.
    *   If not found:
        *   Derive a clean alphanumeric username from their name (e.g., `^[a-zA-Z0-9_]+$`). Resolve collisions by appending numeric increments (`john_doe`, `john_doe_1`).
        *   Synthesize their email as `{username}@facebook.divemap.invalid`.
        *   Generate a randomized password hash (for security/non-nullable constraint).
        *   Create the `User` record with `avatar_type=AvatarType.facebook`, `facebook_avatar_url` and `avatar_url` populated.
        *   Set `email_notifications_opted_out = True` (opt out of emails globally).
        *   Call `create_default_notification_preferences(user.id, db)` which sets individual email notification preferences to `False`.

### 3.3. Endpoint Definition (`backend/app/routers/auth.py`)
```python
class FacebookLoginRequest(BaseModel):
    token: str = Field(..., description="Facebook access token from frontend")

@router.post("/facebook-login", response_model=Token)
@skip_rate_limit_for_admin("30/minute")
async def facebook_login(
    request: Request,
    response: Response,
    facebook_data: FacebookLoginRequest,
    db: Session = Depends(get_db)
):
    # Verify token
    fb_user_info = verify_facebook_token(facebook_data.token)
    user = get_or_create_facebook_user(db, fb_user_info)
    
    # Standard JWT Token Generation and Session Tracking (Same as Google Login)
    ...
```

### 3.4. Account Linking / Unlinking Endpoints (`backend/app/routers/users.py`)
*   `POST /api/v1/users/me/facebook/link`: Link the current account to Facebook. Verifies the provided token, then assigns `facebook_id` and `facebook_avatar_url` to `current_user`.
*   `DELETE /api/v1/users/me/facebook/unlink`: Clears `facebook_id` and `facebook_avatar_url`. Only permitted if the user has a password or a Google ID linked (so they are not orphaned with no login methods).

---

## 4. Layer-by-Layer Email Protections

We introduce solid guardrails across multiple logical boundaries to ensure no emails are sent to `.invalid` addresses.

### 4.1. Network/SES Layer Protection (`backend/app/services/ses_service.py`)
At the entry points of `send_email` and `send_bulk_email` inside the core email service:
```python
if to_email.endswith('.invalid'):
    logger.warning(f"Bypassing email delivery to synthetic/invalid address: {to_email}")
    return False
```
This is a zero-latency block preventing any outbound SES calls for synthetic emails.

### 4.2. API Preference Modification Block (`backend/app/routers/notifications.py`)
When updating notification preferences:
```python
if preference_update.enable_email:
    if current_user.email and current_user.email.endswith('.invalid'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot enable email notifications: You are using a synthetic/social account without a real email. Please add a valid email address to your profile first."
        )
```
This blocks preference changes on the backend.

---

## 5. Frontend Implementation

### 5.1. Facebook Auth Client Wrapper (`frontend/src/utils/facebookAuth.js`)
Handles the lazy loading and initialization of the Facebook JavaScript SDK.
*   Loads `https://connect.facebook.net/en_US/sdk.js` asynchronously.
*   Initializes via `window.FB.init`.
*   Provides `login()` which returns a Promise resolving to the Facebook access token.

### 5.2. Context Logic (`frontend/src/contexts/AuthContext.jsx`)
Exposes `loginWithFacebook` which:
1.  Sends the access token to `/api/v1/auth/facebook-login`.
2.  Stores the access token in local storage, sets the AuthContext `user` state, and displays a success toast.

### 5.3. Interface Updates
*   **Login & Register Pages:**
    *   Add a prominent Facebook Sign-In button (`bg-[#1877F2] text-white`) alongside the Google Sign-In button if `VITE_FACEBOOK_APP_ID` is present.
*   **Profile Page (`Profile.jsx`):**
    *   **Hide Facebook Option** if `user.google_id` is set.
    *   If not set, show option to **Link Facebook** (or show connected state with **Unlink Facebook**).
    *   Allow toggling avatar source back to Facebook or custom/library images.
*   **Notification Preferences Page (`Notifications.jsx`):**
    *   If the user's email ends with `.invalid`, disable email toggle inputs.
    *   Include an inline info-alert: *"To receive email notifications, please add a valid email address to your profile first."*
    *   Provide a direct link/button to focus the Email input on the user's profile settings.

---

## 6. Testing & Validation Plan

*   **Backend Pytest Suite:**
    *   Add mocked test cases in `backend/tests/test_auth.py` covering:
        *   Verify Facebook token verification and get-or-create flow.
        *   Verify username collision resolving logic.
        *   Verify password reset blocker for Facebook users.
        *   Verify preference API throws 400 when attempting to enable email notifications for `.invalid` users.
        *   Verify SES block.
*   **Frontend End-to-End/UI Audit:**
    *   Verify mock initialization of Facebook SDK.
    *   Verify responsive layout constraints (no horizontal scrolling, correct mobile padding).
    *   Check for browser console errors.
