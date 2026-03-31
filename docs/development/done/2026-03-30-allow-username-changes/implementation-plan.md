# Allow Username Changes Implementation Plan

## Goal
Allow users to change their usernames from their profile page while ensuring security, preventing impersonation of system accounts, and handling authentication state correctly. This PR also improves the initial username generation for new Google SSO registrations.

## Rationale for Username Restrictions
### Why are periods (`.`) not allowed in usernames?
1. **URL Routing Conflicts:** Usernames are often used directly in URL paths (e.g., `http://localhost/users/first.last`). Periods in URLs can cause routing engines or web servers (like Nginx or Express/FastAPI) to misinterpret the end of the URL as a file extension request (e.g., trying to serve a file named `last` instead of routing to a user profile).
2. **Subdomain/DNS Confusion:** In more advanced architectures where usernames might be mapped to subdomains (e.g., `first.last.divemap.com`), periods break DNS resolution and wildcard SSL certificates.
3. **Database & API Filtering:** Periods can sometimes interfere with poorly sanitized regex searches or split functions in backend logic.
4. **Consistency:** Enforcing a strict alphanumeric plus underscore (`^[a-zA-Z0-9_]+$`) pattern is a web standard that guarantees maximum compatibility across all current and future integrations.

## Implementation Steps

### 1. Backend: Update User Schemas
- **File:** `backend/app/schemas/__init__.py` (or wherever `UserUpdate` is defined)
- **Action:** Add `username` to the `UserUpdate` Pydantic model.
- **Validation:** 
  - `min_length=3`
  - `max_length=50`
  - `pattern=r"^[a-zA-Z0-9_]+$"` (Alphanumeric and underscores only)

### 2. Backend: Implement API Logic & Restrictions
- **File:** `backend/app/routers/users.py` -> `update_user_me` endpoint
- **Action:** Add logic to handle the `username` field if it's present in the update request.
- **Blacklist Check:** 
  - Define a set of restricted usernames: `{"admin", "divemap", "moderator", "system", "support", "root"}`.
  - If the requested username (case-insensitive) matches any restricted name, raise an `HTTPException(400)`.
- **Uniqueness Check:**
  - Query the database to ensure the requested username is not already taken by another user.
  - If taken, raise an `HTTPException(400)`.

### 3. Backend: Improve Google Username Generation
- **File:** `backend/app/google_auth.py` -> `_generate_valid_username` function
- **Problem:** Currently truncates the email prefix at the first dot (e.g., `first.last@gmail.com` -> `first`).
- **Fix:** Replace dots with underscores instead of truncating (e.g., `first.last@gmail.com` -> `first_last`). This creates more recognizable and desirable auto-assigned usernames, addressing Issue #185.

### 4. Frontend: Enable Username Editing & Validation
- **File:** `frontend/src/pages/Profile.jsx`
- **Action:** 
  - Remove the `disabled` attribute and styling from the username `<input>`.
- **File:** `frontend/src/utils/formHelpers.js` (or wherever `profileSchema` is defined)
- **Action:** 
  - Add `username` validation to the Zod schema matching the backend rules.
  - Add a custom `.refine()` check to provide immediate frontend feedback if a user tries to type a restricted username (e.g., "admin").

### 5. Frontend: Handle User Confirmation & Logout
- **Rationale:** Since the authentication token payload encodes the `username`, changing the username invalidates the current token. While we could try to hot-swap tokens, logging the user out is a cleaner, more secure approach that guarantees the global state (like React Context) is fully reset.
- **Action:**
  - In `Profile.jsx`, intercept the form submission if the `username` field has been modified.
  - Display a confirmation modal/dialog warning the user: *"Changing your username will log you out and require you to log back in. Any links to your current public profile will break. Are you sure you want to proceed?"*
  - If confirmed, submit the update request.
  - On successful response from the backend, immediately call the logout function (e.g., clearing local storage and calling `logout()` from `useAuth`) and redirect the user to the `/login` page with a success toast message indicating they need to log in with their new username.

## Impact Analysis
- **Global State:** Because the user will be explicitly logged out upon changing their username, we do **not** need to manually update the React `AuthContext` global state. The logout process will clear the state, and the subsequent fresh login will cleanly repopulate it with the new username.
- **Database:** Foreign keys link to the user's `id`, not their `username`, so historical data (dives, trips, etc.) will safely remain attached to the user.
- **Chat/Mentions:** Old chat messages that explicitly typed `@old_username` as raw text will not automatically update. However, dynamic UI elements displaying the user's name will fetch the new username based on the user ID.
