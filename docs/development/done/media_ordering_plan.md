# Implementation Plan: Dive Site Media Ordering

## 1. Overview
The goal is to allow authorized users (Admin, Moderator, Dive Site Owner) to customize the display order of photos and videos on the Dive Site Details page.
Critically, this ordering must support **interleaving** media from two different sources:
1.  **Site Media:** Uploaded directly to the dive site (Admin/Owner).
2.  **Dive Media:** Linked automatically from users' dive logs.

## 2. Architecture & Database Design

### The "Mixed Source" Challenge
Since `SiteMedia` and `DiveMedia` reside in different database tables, we cannot simply add a sort order column to the tables themselves (especially since `DiveMedia` belongs to a Dive, not directly to the Dive Site context for sorting purposes).

### Solution: JSON Order List on Parent
We will store the presentation order as a JSON array on the `DiveSite` model. This allows us to reference items from both tables in a single, ordered list.

**Schema Change:**
Add a new column to the `dive_sites` table:
-   **Column Name:** `media_order`
-   **Type:** `JSON` (Nullable)
-   **Structure:** Array of identifiers stringified or objects.
    -   Format: `["site_1", "dive_50", "site_2", "dive_51"]`
    -   Prefix `site_` denotes `SiteMedia` ID.
    -   Prefix `dive_` denotes `DiveMedia` ID.

## 3. Backend Implementation (`backend/`)

### 3.1. Database Migration
-   Create an Alembic migration to add `media_order` (JSON) column to `DiveSite` model.

### 3.2. API Endpoint: Reorder Media
**Route:** `PUT /api/v1/dive-sites/{id}/media/order`

**Request Body:**
```json
{
  "order": ["site_10", "dive_5", "site_12"]
}
```

**Logic:**
1.  **Permission Check:** Verify `current_user` is Admin, Moderator, or Creator of the dive site.
2.  **Validation:** Ensure the list format is valid. (We do *not* strictly need to validate every ID exists at this stage, as "ghost" IDs are handled during read).
3.  **Update:** Save the list to `dive_site.media_order`.

### 3.3. Update Media Retrieval (`GET /api/v1/dive-sites/{id}/media`)
**Current Logic:** Fetches `SiteMedia`, then `DiveMedia`, and concatenates them.
**New Logic:**
1.  Fetch all `SiteMedia` and `DiveMedia` as before.
2.  Retrieve `dive_site.media_order`.
3.  **Sort:**
    -   Create a "Map" or "Dict" of all fetched media items using keys like `site_{id}` and `dive_{id}`.
    -   Iterate through the `media_order` list. If the key exists in the map, add it to the `sorted_results` list and remove from the map.
    -   **Handle New/Unsorted Items:** Any items remaining in the map (newly uploaded or not yet sorted) are appended to the end of `sorted_results` (defaulting to chronological order).
4.  Return the sorted list.

### 3.4. Handling Deletions
**Scenario:** A photo is deleted.
1.  **Backend Change:** When `DELETE /.../media/{id}` is called:
    -   Perform the deletion of the row.
    -   (Optional but recommended) Load the `DiveSite`, remove the specific ID string (e.g., `site_10`) from the `media_order` JSON, and save.
2.  **Fallback:** If the cleanup step is skipped or fails, the `GET` logic (3.3) handles it gracefully: it simply won't find `site_10` in the fetched media map and will skip it, effectively "closing the gap" automatically.

## 4. Frontend Implementation (`frontend/`)

### 4.1. Libraries
-   Install **`dnd-kit`** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`). It is a modern, lightweight, and accessible drag-and-drop library for React.

### 4.2. UI Components (`EditDiveSite.js`)
-   **Transformation:** Convert the existing "Manage Media" list into a `SortableContext`.
-   **Grid/List View:** Ensure the media items are displayed in a container that supports drag-and-drop (likely a grid of thumbnails).
-   **Drag Handle:** Add a visual indicator (grip icon) or allow dragging the whole thumbnail.

### 4.3. State Management
-   **Local State:** Maintain the `media` array in local state to allow instant UI updates during drag operations.
-   **On Drag End:**
    1.  Calculate new array order locally.
    2.  Update UI immediately (optimistic UI).
    3.  Generate the ID list (e.g., `['site_1', 'dive_5']`).
    4.  Call the new API endpoint `PUT /media/order`.
    5.  Handle error: If API fails, revert the order and toast error.

## 5. User Permissions
-   **Frontend:** The drag-and-drop interface is only active/visible if `canEdit` is true (Admin, Moderator, Owner).
-   **Backend:** Strict dependency check on the `PUT` endpoint.

## 6. Execution Steps
1.  **Backend:** Create Migration & Update Model.
2.  **Backend:** Implement `PUT` reorder endpoint.
3.  **Backend:** Update `GET` endpoint to apply sorting.
4.  **Frontend:** Install `dnd-kit`.
5.  **Frontend:** Implement Drag-and-Drop in `EditDiveSite.js`.
6.  **Verify:** Test mixing sources, saving, reloading, and deleting items.
