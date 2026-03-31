# Feature Specification: Soft Delete for Dive Sites

## 1. Overview
Currently, deleting a dive site attempts a "Hard Delete" (physical removal from the database). This frequently fails with 500 errors due to complex database relationships and risks data loss for other users who have linked their dive logs or routes to that site.

This feature introduces a **Soft Delete** mechanism as the default behavior for users, while reserving **Hard Delete** capabilities for Administrators.

## 2. Core Mechanism
A new column `deleted_at` (DateTime, nullable) will be added to the `DiveSite` model.
- **Active Site:** `deleted_at IS NULL`
- **Soft Deleted Site:** `deleted_at` contains the timestamp of deletion.

## 3. User Roles & Deletion Types

### Regular Users (Creators)
- Can only perform a **Soft Delete** on sites they created.
- The site is "hidden" from global search, maps, and lists.
- Existing data linking to this site (dives, routes) remains intact.

### Administrators
- Can perform a **Soft Delete** (for general cleanup).
- Can perform a **Hard Delete** (physical removal) for spam, security issues (XSS), or duplicates.
- Hard Delete will trigger a cascade cleanup of related metadata but preserve critical user history (Dive Logs).

---

## 4. Entity Impact Specification

| Entity | On Soft Delete of Site | On Hard Delete of Site (Admin Only) |
| :--- | :--- | :--- |
| **Dive Log Entries** (`Dive`) | **Preserved.** Stays linked. Site name is still visible in the logbook via the relationship. | **Preserved.** Foreign key is set to `NULL` (`ondelete="SET NULL"`). The original site name should be backed up into the `Dive.name` field if not already present. |
| **Dive Routes** (`DiveRoute`) | **Preserved but Hidden.** Routes remain linked and are visible to Admins. A clear banner must be displayed on the route page/detail if the parent site is hidden. | **Deleted.** Hard deletion of a site implies the location is invalid/spam. Routes are removed (`CASCADE`). |
| **Comments** (`SiteComment`) | **Preserved but Inaccessible.** The site will return a 404 or access error if accessed directly. | **Deleted.** Removed along with the site (`CASCADE`). |
| **Site Media** (`SiteMedia`) | **Preserved.** | **Deleted.** Physical files should also be cleaned up from storage (`CASCADE`). |
| **Dive Trips** (`ParsedDive`) | **Preserved.** | **Unlinked.** Set `dive_site_id` to `NULL`. |
| **Site Ratings** (`SiteRating`) | **Preserved.** | **Deleted.** (`CASCADE`). |
| **Aliases** (`DiveSiteAlias`) | **Preserved.** | **Deleted.** (`CASCADE`). |

---

## 5. Technical Implementation Plan

### Phase 1: Database Migration (✅ Complete)
1. [x] Add `deleted_at` column to `dive_sites` table.
2. [x] Update foreign key constraints in the database to support the intended behaviors:
    - `dives.dive_site_id`: `ON DELETE SET NULL`
    - `dive_routes.dive_site_id`: `ON DELETE CASCADE`
    - `site_comments.dive_site_id`: `ON DELETE CASCADE`
    - `site_media.dive_site_id`: `ON DELETE CASCADE`
    - `site_ratings.dive_site_id`: `ON DELETE CASCADE`

### Phase 2: Backend Logic (✅ Complete)
1. [x] **Query Filtering:** Update `GET /dive-sites` and Search endpoints to add a default filter: `where deleted_at is null`.
    - [x] **Admin Override:** Allow Admins to bypass this filter in `GET /dive-sites` by passing the `include_archived=true` query parameter.
2. [x] **Access Control:** Update `GET /dive-sites/{id}` to return a 404 Not Found (or 403 Forbidden) if `deleted_at` is set, unless the requesting user is an Admin (Admins can view and restore archived sites).
3. [x] **Deletion & Restore Logic:**
    - [x] Update `DELETE /dive-sites/{id}`:
        - [x] If `current_user.is_admin` and `force=true`: Execute physical `db.delete()`.
        - [x] Else: Execute `dive_site.deleted_at = utcnow()`.
    - [x] Add `POST /dive-sites/{id}/restore`:
        - [x] Restricted to `is_admin`. Sets `deleted_at = None` to unarchive a site.

### Phase 3: UI/UX Updates (✅ Complete)
1. [x] **Admin Dashboard (List View):**
    - [x] Add an "Include Archived (Soft Deleted) Sites" checkbox filter (enabled by default for Admins) to show hidden sites.
    - [x] Display a prominent red "ARCHIVED" badge next to the site name in the table for soft-deleted sites.
    - [x] Replace the red "Delete" action button with a yellow "Restore" (`RotateCcw`) button for archived sites.
2. [x] **Dive Site Detail Page:**
    - [x] Display an "ARCHIVED" badge next to the page title for Admins viewing an archived site. Regular users see a 404 page.
    - [x] Render a red "Archive" button next to the "Edit" button for the site creator and Admins on active sites.
    - [x] Hide the "Archive" and "Share" buttons if the site is already archived.
    - [x] Display a yellow "Restore" button for Admins if the site is archived, allowing direct unarchiving from the detail page.
3. [x] **Route Banner:** When an Admin views a dive route that belongs to a hidden site, a prominent yellow banner must be displayed (e.g., "Warning: This route belongs to an archived dive site and is currently hidden from the public"). Regular users should see a 404.
4. [x] **Dive Logs:** In the user's dive log list, if a site is archived, show the name with a suffix: `Agios Onoufrios (Archived)`.
5. [x] **Safety Warnings:** When a user clicks delete or archive, the confirmation modal should explicitly explain that their dives will be preserved but the site will be hidden from others.

## 6. Security Considerations (✅ Complete)
- [x] Hard deletion must be strictly guarded by the `is_admin` dependency.
- [x] Soft-deleted sites should still be protected against unauthorized edits (only creator or admin can modify/restore).
- [x] Ensure that during hard-delete, the `RouteAnalytics` child records are also cleaned up to prevent the 500 error previously observed.
