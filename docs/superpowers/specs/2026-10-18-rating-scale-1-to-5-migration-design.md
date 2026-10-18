# Design Spec: Rating Scale Migration from 1–10 to 1–5

**Date:** 2026-10-18  
**Status:** In Review  
**Branch:** `feature/rating-scale-1-to-5`  
**Related Components:** Dive Sites, Diving Centers, Dive Logs, Community Verdict, StarfishRating, Subsurface Importer/Exporter, Admin Tables, Social Image Sharing, SEO JSON-LD Schemas.

---

## 1. Goals & Motivation

Divemap currently uses a 1–10 rating scale across dive sites, diving centers, and logged dives (user rating and visibility rating). However:
1. **Industry Alignment:** Almost all scuba logging platforms (Subsurface, DiveSSI, Garmin), travel platforms, and review ecosystems standardize on a **5-star (1–5) rating scale**. Subsurface XML already uses a 1–5 scale, forcing Divemap to artificially double imported ratings and halve exported ratings.
2. **Mobile UX & Tap Targets:** Rendering a 10-star rating selector on mobile screens (e.g., `StarfishRating.jsx` and `StickyRateBar.jsx`) forces compressed star sizes (20–24px) with cramped gaps (2px) to prevent layout overflows. A 5-star selector fits comfortably and cleanly on any mobile viewport (320px–430px) without cramped tap targets.
3. **Cognitive Simplicity:** Users find choosing between 1 and 5 stars more intuitive than deliberating between 7, 8, or 9 on a 10-point scale.

This specification details the end-to-end migration of all rating storage, calculation, validation, and presentation from a **1–10 scale to a 1–5 scale**, including the safe in-place migration of all existing database records.

---

## 2. Scope & Subsystems Touched

### 2.1 Database & Data Migration (Alembic)
- **Target Migration File:** `backend/migrations/versions/0106_change_ratings_to_5_scale.py` (down revision: `0105`).
- **Data Conversion Mathematical Formula:**
  All existing integer ratings in `site_ratings.score`, `center_ratings.score`, `dives.user_rating`, and `dives.visibility_rating` will be scaled down:
  $$	ext{new\_score} = \operatorname{GREATEST}(1, \operatorname{ROUND}(	ext{old\_score} / 2.0))$$
  - $10 ightarrow 5$
  - $9 ightarrow 5$
  - $8 ightarrow 4$
  - $7 ightarrow 4$
  - $6 ightarrow 3$
  - $5 ightarrow 3$
  - $4 ightarrow 2$
  - $3 ightarrow 2$
  - $2 ightarrow 1$
  - $1 ightarrow 1$
  *Note: Using `GREATEST(1, ...)` guarantees that a rating of 1 is never rounded down to 0.*
- **MySQL Constraints:**
  - Drop check constraints `site_ratings_chk_1` and `center_ratings_chk_1` (which currently enforce `score >= 1 AND score <= 10`).
  - Add new check constraints: `CHECK (score >= 1 AND score <= 5)`.
- **Database Initializer:**
  - Update `database/init.sql` check constraints for `site_ratings` and `center_ratings` to `score >= 1 AND score <= 5` for fresh environments.

### 2.2 Backend Models, Schemas & Validation
- **`backend/app/models.py`:**
  - Update column comments for `SiteRating.score`, `CenterRating.score`, `Dive.visibility_rating`, and `Dive.user_rating` from `# 1-10` to `# 1-5`.
- **`backend/app/schemas/__init__.py`:**
  - `SiteRatingCreate`: `score: float = Field(..., ge=1, le=5)` (previously `le=10`).
  - `CenterRatingCreate`: `score: float = Field(..., ge=1, le=5)` (previously `le=10`).
  - `DiveCreate`:
    - `visibility_rating: int | None = Field(None, ge=1, le=5)` (previously `le=10`).
    - `user_rating: int | None = Field(None, ge=1, le=5)` (previously `le=10`).
  - `DiveUpdate`:
    - `visibility_rating: int | None = Field(None, ge=1, le=5)` (previously `le=10`).
    - `user_rating: int | None = Field(None, ge=1, le=5)` (previously `le=10`).

### 2.3 API Query Parameters & Routers
- **`backend/app/routers/dive_sites.py`:**
  - `/api/v1/dive-sites` and `/api/v1/dive-sites/count`:
    - `min_rating: float | None = Query(None, ge=0, le=5, description="Minimum average rating (0-5)")`.
- **`backend/app/routers/diving_centers.py`:**
  - `/api/v1/diving-centers` and `/api/v1/diving-centers/count`:
    - `min_rating: float | None = Query(None, ge=0, le=5, description="Minimum average rating (0-5)")`.
    - `max_rating: float | None = Query(None, ge=0, le=5, description="Maximum average rating (0-5)")`.
- **`backend/app/routers/dives/dives_crud.py` & `dives_admin.py`:**
  - `min_rating: float | None = Query(None, ge=1, le=5)` (previously `le=10`).
  - `max_rating: float | None = Query(None, ge=1, le=5)` (previously `le=10`).

### 2.4 Importers, Exporters, Sharing & Pre-rendering
- **Subsurface Import (`backend/app/routers/dives/imports/subsurface.py`):**
  - Subsurface XML natively provides ratings on a 1–5 scale.
  - Remove `return rating * 2` from `parse_rating()`. Instead, clamp to $1 \le 	ext{rating} \le 5$ directly.
- **Subsurface Export (`backend/app/services/dive_export_service.py`):**
  - Remove division by 2: `str(dive.user_rating)` and `str(dive.visibility_rating)`.
- **Social Media Image Generator (`backend/app/services/social_image_service.py`):**
  - Update overlays: `f"VIS: {dive.visibility_rating}/5"` and `f"RATING: {dive.user_rating}/5"`.
- **Social Share Content (`backend/app/services/share_service.py` & `frontend/src/utils/shareUtils.js`):**
  - Update generated share descriptions: `Rating: {rating}/5`.
- **Static SEO & Pre-rendering (`backend/static_html.py` & `backend/generate_static_content.py`):**
  - Update meta descriptions and markdown summaries: `Rated {avg_rating:.1f}/5`.

### 2.5 Frontend UI Components & Forms
- **`frontend/src/components/ui/StarfishRating.jsx`:**
  - Ant Design Rate component: change `count={10}` to `count={5}`.
  - Adjust default icon sizing and padding for generous, touch-friendly tap targets.
- **`frontend/src/components/CommunityVerdict.jsx`:**
  - Display: change `/ 10` to `/ 5`.
  - Progress percentage calculation: `const percent = average_rating ? (average_rating / 5) * 100 : 0;`.
  - Color thresholds:
    - Green: $\ge 4.0$ (previously $\ge 8$)
    - Amber/Orange: $\ge 3.0$ (previously $\ge 6$)
    - Red: $< 3.0$ (previously $< 6$)
  - Verdict copy thresholds:
    - $\ge 4.5$: *"A community favorite! 🏆"* (previously $\ge 9$)
    - $\ge 3.5$: *"Highly recommended by divers."* (previously $\ge 7$)
- **`frontend/src/pages/DivingCenterDetail.jsx`:**
  - `renderStars`: Change star buttons from `[1..10]` to `[1, 2, 3, 4, 5]`.
  - SEO JSON-LD schema: `bestRating: '5'` (previously `'10'`).
  - Text description: `Rated ${center.average_rating.toFixed(1)}/5...`.
- **`frontend/src/pages/DiveDetail.jsx`:**
  - SEO JSON-LD schema: `bestRating: '5'` (previously `'10'`).
- **`frontend/src/pages/DiveSiteDetail.jsx`:**
  - Meta description: `Rated ${Number(diveSite.average_rating).toFixed(1)}/5...`.
- **Forms & Validation (`frontend/src/utils/formHelpers.js`, `CreateDive.jsx`, `EditDive.jsx`):**
  - Zod schemas: `num >= 1 && num <= 5` for `visibility_rating` and `user_rating`.
  - Input labels: `Visibility Rating (1-5)`, `Your Rating (1-5)`.
  - Input fields: `min='1' max='5' placeholder='4'`.
- **Filter Bars (`DiveSitesFilterBar.jsx`, `DivingCentersFilterBar.jsx`, `ResponsiveFilterBar.jsx`, `AdminDivesDesktop.jsx`):**
  - Update input placeholders to `Min rating (1-5)`.
  - Update validation errors to `Rating must be between 0 and 5`.
- **All Admin & List Displays showing `/10`:**
  - Update `AdminDiveSitesTable.jsx`, `AdminDivingCentersTable.jsx`, `AdminDiveSites.jsx`, `AdminDivingCenters.jsx`, `AdminDivesDesktop.jsx`, `AdminDivesMobile.jsx`, `AdminGeneralStatistics.jsx`, `DiveInfoGrid.jsx`, `DiveSiteSidebar.jsx`, `DivingCenterSummaryCard.jsx`, `ImportDivesModal.jsx`, `DiveTrips.jsx`.

---

## 3. Data Integrity & Backward Compatibility

- **Dynamic Average Calculations:**
  Divemap calculates average ratings dynamically using `func.avg(score)` from `site_ratings` and `center_ratings`. By converting individual row scores in the database during migration, all averages immediately reflect the 1–5 scale without needing to touch or invalidate cached summary columns.
- **Downgrade Safety:**
  The migration script includes a full `downgrade()` implementation that reverses the check constraints and scales ratings back up using `LEAST(10, score * 2)`.

---

## 4. Verification Plan

1. **Database Migration Verification:**
   - Execute `0106_change_ratings_to_5_scale.py` in test environment via `./docker-test-github-actions.sh`.
   - Verify all existing ratings in `site_ratings`, `center_ratings`, and `dives` are properly scaled between 1 and 5.
   - Verify check constraints prevent inserting scores $< 1$ or $> 5$.
2. **Backend Unit & Integration Tests:**
   - Run backend test suite via `cd backend && ./docker-test-github-actions.sh`.
   - Update tests in:
     - `test_dive_sites.py` (ratings creation, invalid ratings $> 5$, min rating query).
     - `test_dives.py` (dive log creation with ratings $\le 5$).
     - `test_dive_profile_parser.py` & `test_dive_import_with_profiles.py` (Subsurface 1:1 rating parsing).
     - `test_dive_export_service.py` (Subsurface export format).
     - `test_static_html.py` (asserts `/5` in HTML meta/schema).
     - `test_chat_executors.py`.
   - Ruff linting: `backend/divemap_venv/bin/ruff check .`
3. **Frontend Verification:**
   - Run `make lint-frontend` to verify zero ESLint errors.
   - Use Chrome DevTools MCP:
     - Navigate to dive site details, test rating submission via `StarfishRating` (5 stars).
     - Check `CommunityVerdict` gauge and `/ 5` formatting.
     - Navigate to diving center details, test rating submission.
     - Navigate to `/dives/create` and `/dives/:id/edit`, verify `1-5` inputs and Zod validation.
     - Navigate to filter bars, test filtering with min rating $\le 5$.
     - Verify zero console errors in `list_console_messages`.
