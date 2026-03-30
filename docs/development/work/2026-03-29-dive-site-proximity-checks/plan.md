# Implementation Plan: Dive Site Proximity Validation & Moderation

**Date:** March 29, 2026
**Goal:** Prevent duplicate dive sites by enforcing a geographic proximity check (e.g., < 50m). Guide users to create "Dive Routes" for existing sites instead. Allow users to insist on creating a new site, but enforce a "pending moderation" state requiring Admin/Moderator approval.

---

## 🏗️ Phase 1: Database Schema & Core Models
Before we can enforce moderation, the system needs to distinguish between "approved" and "pending" dive sites.

1. **Update `DiveSite` SQLAlchemy Model (`backend/app/models.py`)**
   - Add a `status` column: `status = Column(Enum('approved', 'pending', 'rejected', name='dive_site_status'), default='approved', nullable=False, index=True)`.
   - Ensure existing dive sites are migrated to the `'approved'` status.
2. **Database Migration (`backend/migrations/`)**
   - Create an Alembic migration using `create_migration.py`.
   - The migration must backfill all current rows to `'approved'`.
3. **Update Base Query Filters**
   - Modify the main `get_dive_sites` query and `global_search` queries in `routers/dive_sites.py` and `routers/search.py` to strictly filter by `status == 'approved'`.
   - Update `get_dive_site` (by ID) to return `404` for `'pending'` sites unless the `current_user` is the creator, an admin, or a moderator.

---

## ⚙️ Phase 2: Backend Validation & API Logic
The backend must enforce the 50m hard limit and provide the data necessary to guide the user towards creating dive routes instead.

1. **Proximity Check Endpoint (Background UX)**
   - Create a fast, read-only endpoint: `GET /api/v1/dive-sites/check-proximity?lat={lat}&lng={lng}&radius_m=50`
   - Use MySQL's `ST_Distance_Sphere` to quickly return a list of nearby approved dive sites. This enables the frontend to perform background checks *while* the user is interacting with the map, rather than waiting for submission.
2. **Update `DiveSiteCreate` Schema (`backend/app/schemas/__init__.py`)**
   - Add a new boolean field: `force_create: bool = Field(False, description="Bypass proximity check and submit for moderation")`.
3. **Modify `create_dive_site` API (`backend/app/routers/dive_sites.py`)**
   - During the `POST` request, execute a spatial query looking for dive sites within 50 meters of the submitted coordinates.
   - **If nearby sites exist AND `force_create == False`:**
     - Return a `409 Conflict` HTTP status code.
     - Include a custom JSON payload containing the `nearby_sites` array (id, name, distance).
   - **If nearby sites exist AND `force_create == True`:**
     - Proceed with creation, but force the `db_dive_site.status = 'pending'`.
     - Log the action and trigger an admin notification task (`_send_pending_moderation_notification`).
   - **If NO nearby sites exist:**
     - Proceed with standard creation (`db_dive_site.status = 'approved'`).

---

## 💻 Phase 3: Frontend Guidance & "Background" Checks
The frontend needs to gracefully handle the 409 Conflict error and proactively warn users using the new background proximity endpoint.

1. **Real-Time Map Feedback (`CreateDiveSite.jsx` & `DiveSiteMap.jsx`)**
   - Implement a debounced `useQuery` hook that calls the `check-proximity` endpoint whenever the user moves the "New Dive Site" map pin.
   - **UI Impact:** If the pin drops within 50m of an existing site, immediately display a floating info-box: *"Did you know? [Site Name] is already right here! Consider adding a new Dive Route to it instead."*
2. **Handling the 409 Submission Conflict (`CreateDiveSite.jsx`)**
   - If the user ignores the real-time warnings and submits, catch the `409 Conflict` response.
   - Stop the submission and display a prominent **"Duplicate Detected" Modal**.
3. **The Guidance Modal UX**
   - **Header:** "This location is extremely close to existing dive sites."
   - **List:** Show the conflicting sites with their distances (e.g., "Scuba Wreck - 12m away").
   - **Action 1 (Primary - Green):** "Create Dive Route for [Site Name]"
     - On click: Save the user's form data to `sessionStorage`, redirect them to `/dive-sites/{id}/routes/create`, and optionally pre-fill their description.
   - **Action 2 (Secondary - Gray):** "Cancel & Discard"
   - **Action 3 (Tertiary/Link - Red):** "I'm sure this is a distinct site. Submit for review."
     - On click: Re-submit the POST request with `force_create: true`.
4. **User Profile Updates (`UserProfile.jsx`)**
   - Add a "Pending Contributions" tab so users can see the dive sites they forced through, marked with a "Pending Moderation" badge.

---

## 🛡️ Phase 4: Admin Moderation Workflow
Administrators and moderators need tools to review, approve, or reject these forced submissions.

1. **Admin APIs (`backend/app/routers/admin/`)**
   - `GET /api/v1/admin/dive-sites/pending`: List all sites with `status == 'pending'`.
   - `POST /api/v1/admin/dive-sites/{id}/approve`: Changes status to `'approved'` and triggers the standard creation notifications/emails.
   - `POST /api/v1/admin/dive-sites/{id}/reject`: Soft-deletes the site or changes status to `'rejected'`, sending an email to the user explaining why it was marked as a duplicate.
2. **Admin Dashboard UI (`AdminDiveSites.jsx`)**
   - Add a "Pending Review" toggle or dedicated tab to the Admin Dive Sites table.
   - Include quick-action buttons for "Approve" and "Reject".
   - Create a specialized "Review View" that shows the pending site on a map *alongside* the existing 50m conflicting sites to help the admin easily verify if it's a true duplicate.
3. **Notification System Integration (`services/notification_service.py`)**
   - Send in-app notifications and/or emails to users when their pending site changes status.

---

## 🧪 Testing Strategy
1. **Backend Integration Tests:**
   - Create tests in `test_dive_sites.py` verifying the 50m boundary logic using `pytest`.
   - Verify `moderation_needed=False` correctly raises a 409.
   - Verify `moderation_needed=True` sets status to pending and returns 200/201.
2. **Frontend Component Tests:**
   - Mock the 409 response and assert the Guidance Modal renders the correct routing options.ce_create=False` correctly raises a 409.
   - Verify `force_create=True` sets status to pending and returns 200/201.
2. **Frontend Component Tests:**
   - Mock the 409 response and assert the Guidance Modal renders the correct routing options.