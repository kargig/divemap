# Implementation Plan: Personal Access Tokens (PATs)

## Step 0: Documenting the Plan
*   Before writing any code, this plan will be copied to `docs/development/work/2026-03-pat-implementation.md` to serve as a permanent design record.

## Objective
Implement Personal Access Tokens (PATs) to allow users to authenticate and interact with the Divemap API programmatically (via CLI, `curl`, Python, etc.) without needing to bypass the Cloudflare Turnstile CAPTCHA required for the standard web login flow.

## 1. Architectural Decisions & Answers to User Questions

### How many PATs should each user be able to create?
*   **Recommendation:** Limit to **10 active PATs** per user.
*   **Reasoning:** 10 is enough for a power user to have distinct tokens for different scripts or devices (e.g., "Deployment Script", "Local CLI", "Home Assistant"). Enforcing a limit prevents database bloat and encourages users to delete old/unused tokens (good hygiene).

### How long should each PAT live?
*   **Recommendation:** Offer fixed durations upon creation: **7 days, 30 days, 90 days, 1 year, and "Never expire"** (though "Never" should show a UI warning).
*   **Reasoning:** Giving users control over expiration ensures tokens aren't kept alive indefinitely unless explicitly requested. Shorter lifespans limit the damage if a token is accidentally leaked in a public script or repository.

### How and when do PATs expire?
*   **Mechanism:** The database schema will include an `expires_at` column (`DateTime`).
*   **Enforcement:** Expiration is evaluated *at authentication time*. When a request comes in with a PAT, the backend checks if `datetime.now(utc) > token.expires_at`. If true, the token is rejected with a `401 Unauthorized` (or `403 Forbidden` "Token Expired") response. We do not need a background worker to actively delete expired tokens.

### How do rate limits work with PATs?
*   **Recommendation:** PAT requests should be subject to a strict API rate limit, distinct from standard web browsing limits. For example, `100 requests / minute` per `user_id`.
*   **Reasoning:** Using the existing `slowapi` rate limiter, we can key the limit on the authenticated `User.id` rather than the IP address, ensuring that a user running a script from home doesn't accidentally block their web browsing session from the same IP.

### Additional Security Considerations
*   **Token Visibility:** The actual token string (e.g., `dm_pat_xyz123`) is only shown to the user **once** upon creation. After that, the backend only stores a bcrypt hash of the token.
*   **Revocation:** Users must be able to instantly revoke (delete or mark inactive) any PAT via the frontend UI.
*   **Last Used Tracking:** Store a `last_used_at` timestamp. This helps users identify which tokens are stale and safe to revoke.

---

## 2. Backend Changes (FastAPI/Database)

### Database Schema (`app/models.py`)
Create a new `PersonalAccessToken` model:
*   `id` (Integer, Primary Key)
*   `user_id` (Integer, ForeignKey to `users.id`, indexed)
*   `name` (String, required - e.g., "Python Script")
*   `token_hash` (String, required, unique, indexed) - Bcrypt hash of the actual token.
*   `expires_at` (DateTime, nullable)
*   `last_used_at` (DateTime, nullable)
*   `created_at` (DateTime, auto-now_add)
*   `is_active` (Boolean, default=True)

*Require an Alembic migration (`alembic revision --autogenerate -m "add_pat_table"`).*

### Schemas (`app/schemas/pats.py`)
*(Addressing User Feedback #2)*: Instead of cluttering `__init__.py`, we will create a dedicated schema file `app/schemas/pats.py` for better modularity:
*   `PATCreate`: `{ name: str, expires_in_days: int | None }`
*   `PATResponse`: `{ id: int, name: str, expires_at: datetime, last_used_at: datetime, created_at: datetime }`
*   `PATCreateResponse`: Inherits `PATResponse` but adds `token: str` (the plain text token, returned only once).
*(We will export these via `__init__.py` as needed).*

### Authentication Dependency (`app/dependencies.py` or `routers/auth.py`)
Update the core authentication mechanism (e.g., `get_current_active_user`):
1.  Check for the standard `Authorization: Bearer <JWT>` header.
2.  If it's a JWT, proceed normally.
3.  If the token starts with the PAT prefix (e.g., `dm_pat_`), query the `PersonalAccessToken` table by hashing the provided token and matching `token_hash`.
4.  Verify the PAT is active and not expired.
5.  Fetch the associated `User`.
6.  Update `last_used_at`.

### New API Endpoints (`routers/users.py` or new `routers/pats.py`)
*   `GET /api/v1/users/me/tokens`: List all active PATs for the current user.
*   `POST /api/v1/users/me/tokens`: Create a new PAT. Enforce the limit (max 10).
*   `DELETE /api/v1/users/me/tokens/{token_id}`: Revoke/delete a specific PAT.

---

## 3. Frontend Changes (React)

### UI/UX Updates & Ant Design (antd) Components
*(Addressing User Feedback #3)*: We will use standard Ant Design components for a consistent administrative UI in the User Settings/Profile area:

1.  **Token List:**
    *   **`Table`**: To display the list of tokens clearly.
    *   **`Tag`**: To visually indicate token status (e.g., `<Tag color="success">Active</Tag>`, `<Tag color="error">Expired</Tag>`).
    *   **`Popconfirm`**: Wrapped around a "Revoke" `Button` to prevent accidental deletion (`"Are you sure you want to revoke this token?"`).
2.  **Create Token Flow:**
    *   **`Button`**: "Generate New Token" to trigger the modal.
    *   **`Modal`**: To house the creation form.
    *   **`Form`** & **`Form.Item`**: For validation and layout.
    *   **`Input`**: For the Token Name.
    *   **`Select`**: For the Expiration dropdown (7 days, 30 days, etc.).
3.  **Success State (The Token Reveal):**
    *   **`Modal`**: (Can reuse the same modal or open a new success modal).
    *   **`Alert`** (type="warning"): "Copy this token now. You will not be able to see it again."
    *   **`Typography.Text`** (with `copyable={true}` prop): This provides a built-in, out-of-the-box copy-to-clipboard experience for the generated token string (`dm_pat_xyz123`).
    *   **`message`** or **`notification`**: For success/error toast popups during API calls.

---

## 4. Testing Strategy

### Backend Tests (`tests/test_pats.py`)
*   **Creation:** Test successful creation and the max-limit constraint.
*   **Authentication:** Test accessing a protected endpoint using the PAT as a Bearer token.
*   **Expiration:** Create a token with an `expires_at` in the past. Attempt to authenticate. Verify it fails with 401.
*   **Revocation:** Delete a token. Attempt to authenticate. Verify it fails.

### Frontend Tests
*   Verify the `Table` renders correctly.
*   Verify the `Modal` `Form` enforces the required name field.

---

## 5. Documentation

### API Documentation (`docs/api/`)
*   Create/update markdown explaining how to authenticate using a PAT.
*   Provide clear `curl` and Python (`requests`) examples.

### OpenAPI/Swagger (FastAPI)
*   Ensure the Swagger UI reflects that endpoints accept either standard OAuth2 JWTs or Personal Access Tokens via the Bearer scheme.

---
## Approval Request
Does this revised plan look good? Once approved, the first action taken will be copying this plan to `docs/development/work/2026-03-pat-implementation.md`.