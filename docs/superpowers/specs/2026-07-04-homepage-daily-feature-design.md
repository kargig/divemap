# Specification: Homepage Daily Feature Section

## Status: Approved
## Date: 2026-07-04

---

## 🗺️ Overview & Goals
The objective of this feature is to keep the Divemap home page feeling fresh, dynamic, and community-focused. Rather than displaying a static user leaderboard, the corresponding section on the home page will dynamically select and render one of six curated dynamic widgets based on the calendar day of the month.

### Key Goals:
1. **Freshness:** Ensure the homepage changes daily to highlight different aspects of the community.
2. **Performance:** Only load the API queries necessary for the active daily widget to conserve server resources and network bandwidth.
3. **Familiar Patterns:** Match the existing homepage layout styles and reuse existing core components.
4. **Consistency & Standards:** Use standardized Lucide icons as defined in the UI icon memory.
5. **No Mobile Scrolling:** Ensure layout responds beautifully with wrapping rather than horizontal overflows on narrow screens.

---

## 🎨 Architectural Design

### 1. Deterministic Selection
The selected highlight is computed on render using the current day of the month:
```javascript
const activeWidgetIndex = new Date().getDate() % 6;
```

This maps to one of six curated configuration objects:

| Index | ID | Title | Icon | Source Endpoint | Destination Redirect |
|---|---|---|---|---|---|
| `0` | `leaderboard` | Top Contributors This Month | `Trophy` / `Medal` | `GET /leaderboard/users/monthly` | `/leaderboard` |
| `1` | `sites` | Recently Added Dive Sites | `MapPin` | `GET /dive-sites` | `/dive-sites` |
| `2` | `dives` | Recent Logged Dives | `Avatar` | `GET /dives` | `/dives` |
| `3` | `routes` | Recently Added Dive Routes | `Compass` | `GET /dive-routes` | `/dive-routes` |
| `4` | `centers` | Recently Verified Diving Centers | `Anchor` | `GET /diving-centers` | `/diving-centers` |
| `5` | `top_users` | Top Divers by Logged Dives | `Award` | `GET /leaderboard/users/category/dives` | `/leaderboard` |

---

## 🔙 Backend Query Extension
To support fetching recently claimed/verified diving centers:
- A new `only_claimed: Optional[bool]` parameter is added to `GET /api/v1/diving-centers/`.
- If set to `True`, the database query filters for active owners and approved ownership states:
  ```python
  query = query.filter(
      and_(
          DivingCenter.owner_id.isnot(None),
          DivingCenter.ownership_status == OwnershipStatus.approved
      )
  )
  ```

---

## 🎨 Frontend Component Design

### 1. Standardized Iconography
*   **Recent Sites:** `MapPin`
*   **Recent Routes:** `Compass`
*   **Recent Centers:** `Anchor` with custom verified checkmark badge.
*   **Prolific Divers:** `Award`

### 2. High-Fidelity Responsive Grid
Cards utilize a 3-column responsive grid layout:
`className='grid grid-cols-1 sm:grid-cols-3 gap-6'`

Individual cards use standardized paddings, transitions, and text truncations for name safety:
`className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group flex items-center space-x-4 min-w-0'`
