# Rating Scale Migration from 1–10 to 1–5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the rating system across the entire application stack from a 1–10 scale to a standard 5-star (1–5) scale, including migrating existing database records, updating backend validations and importers/exporters, adjusting frontend components and forms, and updating test suites.

**Architecture:**
1. Apply Alembic migration `0106_change_ratings_to_5_scale.py` to scale all existing database scores using `GREATEST(1, ROUND(score / 2.0))` and update MySQL CHECK constraints from `1..10` to `1..5`.
2. Update Pydantic schemas and FastAPI route query limits (`le=5`) in `backend/app/schemas/__init__.py` and routers (`dive_sites.py`, `diving_centers.py`, `dives_crud.py`, `dives_admin.py`).
3. Align Subsurface XML importers and exporters to native 1–5 scale without multiplying or dividing by 2, and update social image generator, share services, and static SEO metadata.
4. Update frontend components (`StarfishRating.jsx`, `CommunityVerdict.jsx`, `StickyRateBar.jsx`, `DivingCenterDetail.jsx`, `DiveDetail.jsx`), Zod form schemas (`formHelpers.js`), and all rating badges across lists and admin tables.
5. Update backend test assertions and verify with `./docker-test-github-actions.sh`, Ruff linting, and Chrome DevTools MCP browser checks.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy, Alembic, MySQL 8, React 18, Tailwind CSS, Ant Design Rate, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-rating-scale-1-to-5-migration-design.md`

## Global Constraints

- Never commit changes directly or use `git add` / `git commit` via shell commands.
- Never run pytest inside the live container; always use `cd backend && ./docker-test-github-actions.sh [tests/...]`.
- Always run Ruff linting after backend edits: `backend/divemap_venv/bin/ruff check <files>`.
- Always run frontend linting: `make lint-frontend` and check for zero errors.
- Do not introduce horizontal scrolling on mobile viewports.
- Verify frontend changes using Chrome DevTools MCP with zero console errors.

---

### Task 1: Create Alembic Migration 0106 & Update `init.sql`

**Files:**
- Create: `backend/migrations/versions/0106_change_ratings_to_5_scale.py`
- Modify: `database/init.sql`

**Interfaces:**
- Consumes: Alembic migration chain at revision `'0105'`
- Produces: Alembic revision `'0106'` scaling `score`, `user_rating`, and `visibility_rating` to $\le 5$ with new CHECK constraints

- [x] **Step 1: Write Alembic migration `0106_change_ratings_to_5_scale.py`**

Create `backend/migrations/versions/0106_change_ratings_to_5_scale.py`:

```python
"""change ratings to 5 scale

Revision ID: 0106
Revises: 0105
Create Date: 2026-10-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0106'
down_revision = '0105'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Scale existing ratings down from 1-10 to 1-5
    # Formula: GREATEST(1, ROUND(score / 2.0))
    op.execute(sa.text("UPDATE site_ratings SET score = GREATEST(1, ROUND(score / 2.0))"))
    op.execute(sa.text("UPDATE center_ratings SET score = GREATEST(1, ROUND(score / 2.0))"))
    op.execute(sa.text(
        "UPDATE dives SET user_rating = GREATEST(1, ROUND(user_rating / 2.0)) WHERE user_rating IS NOT NULL"
    ))
    op.execute(sa.text(
        "UPDATE dives SET visibility_rating = GREATEST(1, ROUND(visibility_rating / 2.0)) WHERE visibility_rating IS NOT NULL"
    ))

    # 2. Update CHECK constraints on MySQL for site_ratings and center_ratings
    try:
        op.execute(sa.text("ALTER TABLE site_ratings DROP CHECK site_ratings_chk_1"))
    except Exception as e:
        print(f"Warning: Could not drop site_ratings_chk_1: {e}")

    try:
        op.execute(sa.text("ALTER TABLE site_ratings ADD CONSTRAINT site_ratings_chk_1 CHECK (score >= 1 AND score <= 5)"))
    except Exception as e:
        print(f"Warning: Could not add site_ratings_chk_1: {e}")

    try:
        op.execute(sa.text("ALTER TABLE center_ratings DROP CHECK center_ratings_chk_1"))
    except Exception as e:
        print(f"Warning: Could not drop center_ratings_chk_1: {e}")

    try:
        op.execute(sa.text("ALTER TABLE center_ratings ADD CONSTRAINT center_ratings_chk_1 CHECK (score >= 1 AND score <= 5)"))
    except Exception as e:
        print(f"Warning: Could not add center_ratings_chk_1: {e}")


def downgrade():
    try:
        op.execute(sa.text("ALTER TABLE site_ratings DROP CHECK site_ratings_chk_1"))
    except Exception as e:
        print(f"Warning: Could not drop site_ratings_chk_1: {e}")

    try:
        op.execute(sa.text("ALTER TABLE site_ratings ADD CONSTRAINT site_ratings_chk_1 CHECK (score >= 1 AND score <= 10)"))
    except Exception as e:
        print(f"Warning: Could not add site_ratings_chk_1: {e}")

    try:
        op.execute(sa.text("ALTER TABLE center_ratings DROP CHECK center_ratings_chk_1"))
    except Exception as e:
        print(f"Warning: Could not drop center_ratings_chk_1: {e}")

    try:
        op.execute(sa.text("ALTER TABLE center_ratings ADD CONSTRAINT center_ratings_chk_1 CHECK (score >= 1 AND score <= 10)"))
    except Exception as e:
        print(f"Warning: Could not add center_ratings_chk_1: {e}")

    op.execute(sa.text("UPDATE site_ratings SET score = LEAST(10, score * 2)"))
    op.execute(sa.text("UPDATE center_ratings SET score = LEAST(10, score * 2)"))
    op.execute(sa.text(
        "UPDATE dives SET user_rating = LEAST(10, user_rating * 2) WHERE user_rating IS NOT NULL"
    ))
    op.execute(sa.text(
        "UPDATE dives SET visibility_rating = LEAST(10, visibility_rating * 2) WHERE visibility_rating IS NOT NULL"
    ))
```

- [x] **Step 2: Update `database/init.sql`**

Update `database/init.sql` check constraints:
- Change `CONSTRAINT center_ratings_chk_1 CHECK (((score >= 1) and (score <= 10)))` to `CHECK (((score >= 1) and (score <= 5)))`.
- Change `CONSTRAINT site_ratings_chk_1 CHECK (((score >= 1) and (score <= 10)))` to `CHECK (((score >= 1) and (score <= 5)))`.

- [x] **Step 3: Run migration in local environment**

Run:
```bash
docker-compose exec -T backend python run_migrations.py
```
Expected: Migration 0106 applies successfully.

---

### Task 2: Update Backend Models, Schemas & API Routers

**Files:**
- Modify: `backend/app/models.py:635,784,1147-1148`
- Modify: `backend/app/schemas/__init__.py:509,698,1247-1248,1288-1289`
- Modify: `backend/app/routers/dive_sites.py:1168-1170,2248-2250`
- Modify: `backend/app/routers/diving_centers.py:530-538,868-876`
- Modify: `backend/app/routers/dives/dives_crud.py:375-377,616-618`
- Modify: `backend/app/routers/dives/dives_admin.py:76-78,245-247`

**Interfaces:**
- Produces: API request schemas and query parameter validations capped at `le=5`.

- [x] **Step 1: Update `backend/app/models.py`**
  - Update comments on `SiteRating.score` (`# 1-5`), `CenterRating.score` (`# 1-5`), `Dive.visibility_rating` (`# 1-5 rating`), and `Dive.user_rating` (`# 1-5 rating`).

- [x] **Step 2: Update `backend/app/schemas/__init__.py`**
  - `SiteRatingCreate`: change `score: float = Field(..., ge=1, le=10)` to `le=5`.
  - `CenterRatingCreate`: change `score: float = Field(..., ge=1, le=5)`.
  - `DiveCreate`:
    - `visibility_rating: int | None = Field(None, ge=1, le=5)`
    - `user_rating: int | None = Field(None, ge=1, le=5)`
  - `DiveUpdate`:
    - `visibility_rating: int | None = Field(None, ge=1, le=5)`
    - `user_rating: int | None = Field(None, ge=1, le=5)`

- [x] **Step 3: Update `backend/app/routers/dive_sites.py`**
  - Update `min_rating: float | None = Query(None, ge=0, le=5, description="Minimum average rating (0-5)")` in both `/count` and listing endpoints.

- [x] **Step 4: Update `backend/app/routers/diving_centers.py`**
  - Update `min_rating` and `max_rating` queries to `ge=0, le=5, description="... (0-5)"`.

- [x] **Step 5: Update `backend/app/routers/dives/dives_crud.py` and `dives_admin.py`**
  - Update `min_rating` and `max_rating` queries to `ge=1, le=5`.

- [x] **Step 6: Run Ruff check on modified backend files**
```bash
backend/divemap_venv/bin/ruff check backend/app/models.py backend/app/schemas/__init__.py backend/app/routers/dive_sites.py backend/app/routers/diving_centers.py backend/app/routers/dives/dives_crud.py backend/app/routers/dives/dives_admin.py
```
Expected: PASS with 0 errors.

---

### Task 3: Update Subsurface Importers, Exporters, Sharing & Generators

**Files:**
- Modify: `backend/app/routers/dives/imports/subsurface.py:283-290`
- Modify: `backend/app/services/dive_export_service.py:99-106`
- Modify: `backend/app/services/social_image_service.py:330-337`
- Modify: `backend/app/services/share_service.py:229-252`
- Modify: `backend/static_html.py:82-86,337-341`
- Modify: `backend/generate_static_content.py:248-251,349`

- [x] **Step 1: Update `backend/app/routers/dives/imports/subsurface.py`**
```python
def parse_rating(rating):
    """Parse and validate Subsurface rating (1-5 scale) directly for Divemap"""
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        return 5
    return rating
```

- [x] **Step 2: Update `backend/app/services/dive_export_service.py`**
Remove `/ 2` division:
```python
        if dive.user_rating is not None:
            dive_elem.set("rating", str(max(1, min(5, round(float(dive.user_rating))))))
        if dive.visibility_rating is not None:
            dive_elem.set(
                "visibility", str(max(1, min(5, round(float(dive.visibility_rating)))))
            )
```

- [x] **Step 3: Update `backend/app/services/social_image_service.py`**
```python
            # Visibility
            elif key == "VISIBILITY" and dive.visibility_rating:
                metrics.append(f"VIS: {dive.visibility_rating}/5")
            # Rating
            elif key == "RATING" and dive.user_rating:
                metrics.append(f"RATING: {dive.user_rating}/5")
```

- [x] **Step 4: Update `backend/app/services/share_service.py`**
Change `/10` to `/5`:
```python
            if entity_data.get("user_rating"):
                stats.append(f"Rating: {entity_data['user_rating']}/5")
...
            if entity_data.get("average_rating"):
                stats.append(f"Rating: {entity_data['average_rating']}/5")
```

- [x] **Step 5: Update `backend/static_html.py` & `generate_static_content.py`**
In `static_html.py`:
- `parts.append(f"Rated {avg_rating:.1f}/5.")`
- `f"<p><strong>Rating:</strong> {escape_text(f'{avg_rating:.1f}/5')} "`
In `generate_static_content.py`:
- `f"- **Rating**: {avg_score:.1f}/5 ({len(site.ratings)} reviews)
"`
- `f"**Rating**: {dive.user_rating}/5
"`

- [x] **Step 6: Run Ruff check on modified files**
```bash
backend/divemap_venv/bin/ruff check backend/app/routers/dives/imports/subsurface.py backend/app/services/dive_export_service.py backend/app/services/social_image_service.py backend/app/services/share_service.py backend/static_html.py backend/generate_static_content.py
```
Expected: PASS with 0 errors.

---

### Task 4: Update Backend Test Suite & Verify

**Files:**
- Modify: `backend/tests/test_dive_sites.py`
- Modify: `backend/tests/test_dives.py`
- Modify: `backend/tests/test_dive_profile_parser.py`
- Modify: `backend/tests/test_dive_profile_integration.py`
- Modify: `backend/tests/test_dive_import_with_profiles.py`
- Modify: `backend/tests/test_dive_export_service.py`
- Modify: `backend/tests/test_static_html.py`
- Modify: `backend/tests/test_chat_executors.py`

- [x] **Step 1: Update test fixtures and expectations**
  - In `test_dive_sites.py`: update invalid score test from 15 to 6 or 8 (testing `> 5`), update `min_rating=4.0` instead of `7.0`.
  - In `test_dives.py`: update ratings `8, 9` to `4, 5`.
  - In `test_dive_profile_parser.py` & `test_dive_import_with_profiles.py`: update expected parsed rating to match raw Subsurface rating (e.g. `rating="4"` $ightarrow$ `user_rating == 4` instead of `8`).
  - In `test_dive_export_service.py`: update test values to $\le 5$.
  - In `test_static_html.py`: update expected HTML strings with `/5`.
  - In `test_chat_executors.py`: update test ratings.

- [x] **Step 2: Run backend tests via the isolated test environment**
```bash
cd backend && ./docker-test-github-actions.sh
```
Expected: `All tests passed!`. If failures occur, inspect `backend/test-failures.txt`.

---

### Task 5: Update Frontend Rating & Detail Components

**Files:**
- Modify: `frontend/src/components/ui/StarfishRating.jsx`
- Modify: `frontend/src/components/CommunityVerdict.jsx`
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`
- Modify: `frontend/src/pages/DiveDetail.jsx`
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`

- [x] **Step 1: Update `StarfishRating.jsx`**
Change `count={10}` to `count={5}`:
```jsx
        <Rate
          character={StarfishIcon}
          count={5}
          value={value}
          onChange={onChange}
          disabled={disabled || readOnly}
          allowHalf={true}
          style={{
            fontSize: size,
            display: 'inline-flex',
            gap: gap,
            flexWrap: 'nowrap',
          }}
        />
```

- [x] **Step 2: Update `CommunityVerdict.jsx`**
- Change percentage calculation:
  ```javascript
  const percent = average_rating ? (average_rating / 5) * 100 : 0;
  ```
- Change stroke color thresholds:
  ```javascript
  const strokeColor = average_rating >= 4.0 ? '#10b981' : average_rating >= 3.0 ? '#f59e0b' : '#ef4444';
  ```
- Change verdict message thresholds:
  ```javascript
  if (average_rating >= 4.5) return { text: 'A community favorite! 🏆', icon: <TrophyOutlined /> };
  if (average_rating >= 3.5) return { text: 'Highly recommended by divers.', icon: <TrophyOutlined /> };
  ```
- Change `<span className='text-xs text-gray-500'>/ 10</span>` to `/ 5`.

- [x] **Step 3: Update `DivingCenterDetail.jsx`**
- In `renderStars`: change `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(...)` to `[1, 2, 3, 4, 5].map(...)`.
- In JSON-LD schema `aggregateRating`: change `bestRating: '5'` (was `'10'`).
- In text description: `Rated ${center.average_rating.toFixed(1)}/5...`.

- [x] **Step 4: Update `DiveDetail.jsx` & `DiveSiteDetail.jsx`**
- In `DiveDetail.jsx` JSON-LD schema: `bestRating: '5'`.
- In `DiveSiteDetail.jsx`: meta description string `Rated ${Number(diveSite.average_rating).toFixed(1)}/5...`.

---

### Task 6: Update Frontend Forms, Validation & Filter Bars

**Files:**
- Modify: `frontend/src/utils/formHelpers.js:589-625`
- Modify: `frontend/src/pages/CreateDive.jsx:795-825`
- Modify: `frontend/src/pages/EditDive.jsx:1060-1090`
- Modify: `frontend/src/components/DiveSitesFilterBar.jsx:230-260,365-395`
- Modify: `frontend/src/components/DivingCentersFilterBar.jsx:130-160`
- Modify: `frontend/src/components/DivingCentersResponsiveFilterBar.jsx:345-375,530-560`
- Modify: `frontend/src/components/ResponsiveFilterBar.jsx:620-650,1270-1305`

- [x] **Step 1: Update `frontend/src/utils/formHelpers.js`**
Update Zod schemas:
```javascript
  visibility_rating: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 5;
      },
      { message: 'Visibility rating must be between 1 and 5' }
    )
...
  user_rating: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine(
      val => {
        if (!val || val === '' || val === null) return true;
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 5;
      },
      { message: 'User rating must be between 1 and 5' }
    )
```

- [x] **Step 2: Update `CreateDive.jsx` and `EditDive.jsx`**
- Change labels to: `Visibility Rating (1-5)` and `Your Rating (1-5)`.
- Change inputs to: `min='1' max='5' placeholder='4'`.

- [x] **Step 3: Update Filter Bars**
- In `DiveSitesFilterBar.jsx`, `DivingCentersFilterBar.jsx`, `DivingCentersResponsiveFilterBar.jsx`, `ResponsiveFilterBar.jsx`:
  - Placeholders: `placeholder='Min rating (1-5)'`.
  - Max validation condition: `filters.min_rating > 5`.
  - Error message: `Rating must be between 0 and 5`.

---

### Task 7: Update Rating Badges, Cards & Admin Tables

**Files:**
- Modify: `frontend/src/components/DiveInfoGrid.jsx:188,206,365,379`
- Modify: `frontend/src/components/DiveSiteSidebar.jsx:142`
- Modify: `frontend/src/components/DivingCenterSummaryCard.jsx:98`
- Modify: `frontend/src/components/ImportDivesModal.jsx:997,1003`
- Modify: `frontend/src/components/tables/AdminDiveSitesTable.jsx:295`
- Modify: `frontend/src/components/tables/AdminDivingCentersTable.jsx:251`
- Modify: `frontend/src/pages/AdminDiveSites.jsx:495`
- Modify: `frontend/src/pages/AdminDivesDesktop.jsx:248,555-605,708,824`
- Modify: `frontend/src/pages/AdminDivesMobile.jsx:136`
- Modify: `frontend/src/pages/AdminDivingCenters.jsx:402`
- Modify: `frontend/src/pages/AdminGeneralStatistics.jsx:333,346`
- Modify: `frontend/src/pages/DiveTrips.jsx:601`
- Modify: `frontend/src/utils/shareUtils.js:371,392`

- [x] **Step 1: Replace all `/10` strings with `/5` across badges, cards, and admin tables**
- Update displays:
  - `DiveInfoGrid.jsx`: `{dive.visibility_rating}/5` and `{dive.user_rating}/5`.
  - `DiveSiteSidebar.jsx`: `{dive.user_rating}/5`.
  - `DivingCenterSummaryCard.jsx`: `★ {center.average_rating.toFixed(1)}/5`.
  - `ImportDivesModal.jsx`: `{dive.visibility_rating}/5` and `{dive.user_rating}/5`.
  - `AdminDiveSitesTable.jsx`: `${site.average_rating.toFixed(1)}/5`.
  - `AdminDivingCentersTable.jsx`: `${center.average_rating.toFixed(1)}/5`.
  - `AdminDiveSites.jsx`: `${rating.toFixed(1)}/5`.
  - `AdminDivingCenters.jsx`: `${rating.toFixed(1)}/5`.
  - `AdminDivesDesktop.jsx`: `${dive.user_rating}/5`, and filters: min/max bounds `0-5`.
  - `AdminDivesMobile.jsx`: `/5`.
  - `AdminGeneralStatistics.jsx`: `${generalStats?.platform_stats?.engagement?.avg_site_rating}/5`.
  - `DiveTrips.jsx`: `{rating}/5`.
  - `shareUtils.js`: `Rating: ${entityData.user_rating}/5` and `Rating: ${entityData.average_rating}/5`.

- [x] **Step 2: Run frontend linter**
```bash
make lint-frontend
```
Expected: PASS with 0 errors.

---

### Task 8: Verification & Quality Assurance

**Files:** All modified files across frontend and backend.

- [x] **Step 1: Run full backend test suite**
```bash
cd backend && ./docker-test-github-actions.sh
```
Expected: All tests pass.

- [x] **Step 2: Run backend lint check**
```bash
make lint-backend
```
Expected: 0 errors.

- [x] **Step 3: Run frontend lint check**
```bash
make lint-frontend
```
Expected: 0 errors.

- [x] **Step 4: DevTools Browser Verification**
Using Chrome DevTools MCP:
- Navigate to a dive site details page (e.g. `/dive-sites/104`).
- Check `StarfishRating` renders 5 stars.
- Check `CommunityVerdict` circle and text display `/ 5`.
- Submit a 5-star rating and verify API response `score: 5` and updated average.
- Navigate to a diving center details page (e.g. `/diving-centers/1`).
- Check 5-star rating selector and submission.
- Navigate to `/dives/create` and verify visibility/user rating accepts 1–5 and rejects values $> 5$.
- Inspect browser console via `list_console_messages` to ensure zero errors.
