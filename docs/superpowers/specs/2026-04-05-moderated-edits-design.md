# Divemap: Moderated Dive Site Edits Design Spec

## 1. Overview
Currently, dive sites can only be edited by Admins, Moderators, or the original creator. This project implements a trust-based "shadow copy" edit system. "Trusted" users (determined by platform activity) can edit sites directly. Edits from "untrusted" users are captured as pending requests that require moderator approval before being applied to the live database.

## 2. Architecture & Data Model
A new "side-car" table will hold proposed changes, preventing modifications to the core `DiveSite` table until approved.

**New Table: `DiveSiteEditRequest`**
- `id`: Integer, Primary Key
- `dive_site_id`: Integer, ForeignKey to `dive_sites.id` (Indexed, Cascade Delete)
- `requested_by_id`: Integer, ForeignKey to `users.id` (Indexed)
- `status`: Enum string (`pending`, `approved`, `rejected`), defaults to `pending`

- `edit_type`: Enum string (`site_data`, `media_addition`, `media_update`, `media_deletion`), defaults to `site_data`
- `proposed_data`: JSON / JSONB field storing the partial update dictionary.
- `created_at`: DateTime, defaults to `func.now()`
- `reviewed_at`: DateTime, Nullable
- `reviewed_by_id`: Integer, ForeignKey to `users.id`, Nullable

## 3. Trust Logic & Permissions
A new helper function `is_trusted_contributor(db_session, user_id, dive_site_id)` will be created.

**A user is TRUSTED if any of the following are true:**
1. They are an `is_admin` or `is_moderator`.
2. They are the `created_by` owner of the specific `DiveSite` being edited.
3. They meet the "Lightweight Activity" criteria (≥1 record in any of the following):
   - `Dive` (`user_id == user.id`)
   - `DiveSite` (`created_by == user.id`)
   - `DivingCenter` (`owner_id == user.id`)
   - `DiveRoute` (`created_by == user.id`)
4. *(Future)*: They are an active subscriber.

## 4. API Workflow

### 4.1 Modifying `PUT /dive_sites/{id}`
The existing endpoint will become context-aware.
1. Resolve the `DiveSite`.
2. Evaluate `is_trusted_contributor()`.
3. **If Trusted:** Proceed with the standard immediate update. Return `200 OK`.
4. **If Untrusted:**
   - Serialize the incoming `DiveSiteUpdate` payload to JSON (excluding nulls/unchanged fields).
   - Insert a new `DiveSiteEditRequest` with `status='pending'`.
   - Dispatch an internal notification to Admins and Moderators alerting them to the pending request.
   - Return `202 Accepted` with a message: *"Your changes have been submitted for moderation."*



### 4.2 Modifying Media Endpoints
The existing media endpoints (`POST /dive_sites/{id}/media`, `PATCH /dive_sites/{id}/media/{media_id}`, `DELETE /dive_sites/{id}/media/{media_id}`) will also utilize the trust helper.
1. Evaluate `is_trusted_contributor()`.
2. **If Trusted:** Proceed with the standard immediate media addition/update/deletion. Return `200/201`.
3. **If Untrusted:**
   - For `POST` (add): Create a `DiveSiteEditRequest` with `edit_type='media_addition'` and store the `SiteMediaCreate` payload in `proposed_data`.
   - For `PATCH` (update): Create a request with `edit_type='media_update'` and store the `SiteMediaUpdate` payload (along with the `media_id`).
   - For `DELETE`: Create a request with `edit_type='media_deletion'` storing the `media_id`.
   - Return `202 Accepted` with the moderation message.

### 4.2 Moderation Endpoints
New administrative endpoints for handling requests:
- `GET /admin/edit-requests`: Lists all requests where `status='pending'`.
- `POST /admin/edit-requests/{id}/approve`:
  - Retrieves the `DiveSiteEditRequest`.
  - Deserializes `proposed_data` and applies it to the associated `DiveSite`.
  - Determines the action based on `edit_type` (`site_data` applies to `DiveSite`, media types apply to `SiteMedia`).
  - Updates `DiveSiteEditRequest` status to `approved`, sets `reviewed_at` and `reviewed_by_id`.
- `POST /admin/edit-requests/{id}/reject`:
  - Updates status to `rejected`, sets `reviewed_at` and `reviewed_by_id`.

## 5. Frontend & UI Implications
- The main Edit Form logic remains unchanged.
- Form submission handlers must handle the `202 Accepted` response gracefully by displaying a "Pending Moderation" toast/alert rather than reflecting the changes immediately in the local UI state.
- A new "Moderation Dashboard" interface will be required to consume the `GET /admin/edit-requests` endpoint.

## 6. Testing Strategy
- Unit tests for the `is_trusted_contributor` logic simulating various user activity states.
- API tests verifying `PUT /dive_sites/{id}` returns `200` for trusted users and `202` for untrusted users without modifying the underlying site data.
- API tests verifying the moderation `approve` endpoint correctly patches the live site data.