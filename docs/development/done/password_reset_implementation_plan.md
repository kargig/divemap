# Password Reset Feature Implementation Plan

## Overview
Implement a secure password reset flow allowing users to reset their password via email verification. The feature must handle security concerns like rate limiting, token expiration, and user privacy (no account enumeration).

## Database
- [x] Create `PasswordResetToken` model in `backend/app/models.py`
    - `id`: Integer, Primary Key
    - `user_id`: Integer, ForeignKey to users.id
    - `token_hash`: String, Unique, Index (store hashed token only)
    - `expires_at`: DateTime
    - `created_at`: DateTime
    - `used_at`: DateTime (nullable)
    - `ip_address`: String (for audit/rate limiting)
- [x] Create Alembic migration for the new table (0067_add_password_reset_tokens.py)

## Backend
- [x] Create `PasswordResetRequest` and `PasswordResetConfirm` schemas in `backend/app/schemas/auth.py`
- [x] Create email templates in `backend/app/templates/emails/`
    - `password_reset.html`
    - `password_reset.txt`
    - `password_changed.html` (for post-reset notification)
    - `password_changed.txt`
- [x] Update `EmailService` in `backend/app/services/email_service.py` to support password reset and confirmation emails
- [x] Implement logic in `backend/app/routers/auth.py`
    - `request_password_reset(email_or_username, ip_address)`: Generate token, hash it, store hash, send raw token.
    - `verify_reset_token(token)`: Hash incoming token, compare with stored hash.
    - `reset_password(token, new_password)`: Validate, update password, invalidate all user sessions.
- [x] Add API endpoints in `backend/app/routers/auth.py`
    - `POST /api/v1/auth/forgot-password`
        - Rate limit: 5 per day per IP
        - Input: `email_or_username`
        - Logic: Check user. If Google auth, ignore but return success. **If 'admin' username, ignore but return success.** Generate token. Send email. Log request to `AuthAuditLog`.
    - `GET /api/v1/auth/verify-reset-token?token=...`
        - Verify if token is valid and not expired
    - `POST /api/v1/auth/reset-password`
        - Input: `token`, `new_password`
        - Logic:
            1. Validate token (expiry 30m).
            2. Update password.
            3. Invalidate token (mark used).
            4. **Revoke all active Refresh Tokens** for the user.
            5. Send "Password Changed" confirmation email.
            6. Log action to `AuthAuditLog`.

## Frontend
- [x] Update `frontend/src/services/auth.js`
    - Add `forgotPassword(emailOrUsername)`
    - Add `verifyResetToken(token)`
    - Add `resetPassword(token, newPassword)`
- [x] Create `frontend/src/pages/ForgotPassword.js`
    - Form with username/email input
    - Success message (generic)
- [x] Create `frontend/src/pages/ResetPassword.js`
    - Verify token validity on mount
    - Form with new password input (aligned with `commonSchemas.password`)
    - Success message + redirect to login
- [x] Add routes in `frontend/src/App.js`
    - `/forgot-password`
    - `/reset-password`
- [x] Add "Forgot Password?" link to `frontend/src/pages/Login.js`

## Security & Validation
- [x] **Token Storage:** Store only SHA-256 hashes of tokens in DB.
- [x] **Session Management:** Invalidate all existing sessions (Refresh Tokens) on password reset.
- [x] **Notifications:** Send email on successful password change.
- [x] **Audit:** Log reset requests and successes in `AuthAuditLog`.
- [x] **Admin Restriction:** Specifically block 'admin' user from password reset.
- [x] Ensure rate limiting is active and functional
- [x] Verify token expiration (30 minutes)
- [x] Ensure Google auth users don't get emails but requesting doesn't reveal account type
- [x] Verify "User not found" returns generic success message (prevent enumeration)
- [x] Validate new password strength on reset (consistent with Register page)
