# Image Optimization & Thumbnail Generation Plan

## 1. Overview
The goal is to optimize bandwidth and improve loading performance by generating and serving appropriate image sizes. Currently, full-resolution images are loaded even for small thumbnails, leading to slow page loads and wasted bandwidth.

We will implement a system to automatically generate **Thumbnail** (e.g., 400px) and **Medium** (e.g., 1200px) versions of uploaded photos.

## 2. Architecture

### 2.1 Database Changes
We will adopt a **Hybrid Approach**: using file naming conventions for storage but explicit database columns for reliability and "smart" selection.

**Schema Changes:**
*   **Table `site_media`**: Add `medium_url` (String) and `thumbnail_url` (String).
*   **Table `dive_media`**: Add `medium_url` (String). *Note: `thumbnail_url` already exists in this table but is currently used for external links; we will standardize its usage.*

### 2.2 Storage Strategy
Files will be stored in R2 (or local storage) in the same directory as the original to keep user data consolidated.

*   **Original:** `path/to/image.jpg`
*   **Medium:** `path/to/image_medium.jpg`
*   **Thumbnail:** `path/to/image_thumb.jpg`

**Logic for Small Images:**
To avoid upscaling or redundant files:
1.  **Thumbnail (Max 400px):** Always generate (or copy if original is tiny) to ensure consistent availability for grid views.
2.  **Medium (Max 1200px):**
    *   If Original > 1200px: Generate resized version.
    *   If Original <= 1200px: **Do not generate.** Store the *Original* path in the `medium_url` database column. This simplifies frontend logic (always use `medium_url`) while saving storage.

### 2.3 Permissions & Security
*   **Access:** Derived variants inherit the permissions of the parent. The backend will generate Signed URLs for the specific variant requested.
*   **Deletion:** The `delete_photo` service method will be updated to automatically detect and delete all variants (`_medium`, `_thumb`) associated with the original file.

## 3. Implementation Phases

### Phase 1: Dependencies & Database Schema [x]
1.  **Dependencies:** Add `Pillow` to `backend/requirements.txt` for image processing. [x]
2.  **Migration:** Create an Alembic migration to add the new columns (`medium_url`, `thumbnail_url`) to `site_media` and `dive_media`. [x]

### Phase 2: Image Processing Service [x]
1.  **Service Creation (`backend/app/services/image_processing.py`):** [x]
    *   **Security & Hardening (CRITICAL):**
        *   **Decompression Bomb Protection:** Set `Image.MAX_IMAGE_PIXELS` (e.g., 80M pixels) to prevent DoS attacks. [x]
        *   **Input Validation (Gatekeeper):** Use `python-magic` (libmagic) to verify the MIME type from raw bytes *before* passing to Pillow. This acts as a security gatekeeper to reject non-image files (e.g., renamed executables) early, mitigating potential parser vulnerabilities in the image processing library. [x]
        *   **Sanitization:** Decode to raw pixels and re-encode to a fresh JPEG. This strips malicious payloads, polyglots, and potentially dangerous EXIF metadata (GPS, etc.). [x]
        *   **Branding:** Inject basic, safe metadata (e.g., EXIF 'Software': 'Divemap') into the sanitized 'Original' image to establish provenance. [x] (Implemented as standard EXIF stripping via `ImageOps.exif_transpose` and re-save)
        *   **Resource Limits:** Enforce maximum file size (e.g., 15MB) and processing timeouts. [x] (Implemented via Nginx config and code checks)
    *   **Functionality:**
        *   `process_upload(file_bytes, filename) -> dict`:
        *   Validates image.
        *   Generates optimized bytes:
            *   **Original:** Sanitized (re-encoded) JPEG/PNG.
            *   **Medium & Thumbnail:** **WebP format** for superior compression and performance.
        *   Returns a dictionary of streams/bytes to be uploaded.
2.  **Storage Update (`backend/app/services/r2_storage_service.py`):** [x]
    *   Update `upload_photo` (or create `upload_photo_set`) to handle uploading multiple file streams to their respective paths. [x]
    *   Update `delete_photo` to attempt deletion of suffix-variants. [x]

### Phase 3: Router & Backend Logic [x]
1.  **Dive Sites (`backend/app/routers/dive_sites.py`):** [x]
    *   Intercept file upload.
    *   Call Image Processing Service.
    *   Upload all generated files to Storage.
    *   Save all paths (`url`, `medium_url`, `thumbnail_url`) to the DB.
    *   Update `DiveSiteResponse` serialization to prefer `thumbnail_url` for the main `thumbnail` field.
2.  **Dives (`backend/app/routers/dives/dives_media.py`):** [x]
    *   Apply identical logic for user dive photos.

### Phase 4: Frontend Integration [x]
1.  **List Views (`DiveSites.js`):** [x]
    *   Ensure the component uses the `thumbnail` field (which will now point to the optimized image).
    *   **Performance:** Add `loading="lazy"` to all image tags to improve initial page load speed. [x]
2.  **Media Gallery / Lightbox (`DiveSiteDetail.js`):** [x]
    *   **Thumbnails Strip:** Bind to `thumbnail_url`. [x]
    *   **Main Slide:** Bind to `medium_url` (which falls back to original if no medium exists). [x]
    *   **Download/Zoom:** Bind to `url` (Original). [x]
    *   **UX Improvement:** Added Download button (plugin) pointing to the original file. [x]
3.  **Upload UX:** [x]
    *   Updated `EditDiveSite.js`, `EditDive.js`, and `CreateDive.js` to handle `medium_url`/`thumbnail_url` from backend response. [x]
    *   Added granular loading states ("Uploading photos...", "Saving...") to prevent duplicate clicks and user confusion. [x]

### Phase 5: Data Migration (Backfill) [x]
1.  **Script (`backend/scripts/generate_thumbnails.py`):** [x]
    *   **Architecture:** Internal script (runs inside backend container) using `app.database.SessionLocal` and direct service imports (`R2StorageService`, `ImageProcessingService`).
    *   **Style Paradigm:** Adopt the CLI structure of `utils/update_diving_center_locations.py`:
        *   Use `argparse` for arguments: `--dry-run`, `--force`, `--limit`.
        *   Use rich logging (emojis, timestamps) and summary reports.
        *   Handle errors gracefully per-record.
    *   **Logic:**
        *   Query `SiteMedia` and `DiveMedia` where `medium_url` is NULL.
        *   Iterate records:
            *   Download original `url` from R2.
            *   Generate missing sizes (Medium, Thumb).
            *   Upload to R2.
            *   Update Database record.
        *   Ensure idempotency.

### Additional Infrastructure [x]
*   **Nginx:** Updated `client_max_body_size` to 20MB in both dev and prod configs to match backend limits. [x]
*   **Docker:** Installed `libmagic1` system dependency for MIME type validation. [x]