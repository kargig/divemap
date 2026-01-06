# Divemap SEO Improvement Proposals

This document outlines a strategic plan to improve the Search Engine Optimization (SEO) of the Divemap platform. Currently, the application is a Client-Side Rendered (CSR) React app with limited metadata and no automated discovery mechanisms for search engines.

## Current State Analysis
- **Framework:** React (Vite) with `react-helmet-async` installed but underutilized.
- **Metadata:** Only `document.title` is dynamically updated via a custom hook (`usePageTitle`).
- **Sitemap:** Missing.
- **Social Sharing:** No Open Graph (OG) or Twitter Card tags are present.
- **Structured Data:** No JSON-LD or Schema.org implementation.
- **Discovery:** `robots.txt` exists but does not point to a sitemap.

---

## Proposal 1: Static Sitemap Generation (Critical)

**Priority:** Critical | **Effort:** Low | **Location:** Backend (Python Script) & Cloudflare Worker

Instead of a dynamic endpoint (which hits the DB on every request), we will reuse and rename the "LLM Content" generation pattern to a more general "Static Content" generator. This is more performant and leverages your existing R2 integration.

### Implementation Details:
1. **Modify `backend/generate_static_content.py` (formerly `generate_llm_content.py`):**
   - Add logic to generate a compliant `sitemap.xml` string.
   - Include all public Dive Sites, Diving Centers, and static routes.
   - Save it locally to `backend/llm_content/sitemap.xml`.
   - Upload it to R2 (bucket: `divemap-content`, key: `sitemap.xml`) using the existing `upload_to_r2` function.

2. **Serving Strategy (Hybrid):**
   - **Cloudflare Worker Enhancement:** Update `divemap-llm-worker` to intercept requests for `/sitemap.xml` and serve them directly from R2. This completely offloads SEO traffic from the backend.
   - **Nginx Fallback:** Maintain the proxy in `nginx/prod.conf` as a fallback for local development or if the worker fails.

3. **Automation:**
   - Ensure `generate_static_content.py` runs on a schedule (e.g., daily cron) or is triggered by a "Publish" event in the Admin UI.

### Impact:
- **Performance:** Zero database load for search engine crawlers.
- **Reliability:** Sitemap is always available, even if the DB is under load.
- **Consistency:** Follows the exact same architectural pattern as your `llms.txt` and `dive-sites.md` files.

---

## Proposal 2: Comprehensive Metadata & Social Tags (Critical)

**Priority:** Critical | **Effort:** Medium | **Location:** Frontend (React)

When a user shares a dive site on Facebook or Twitter, it currently looks like a generic link. Metadata is also the primary source for search result snippets.

### Implementation Details:
1. Create a centralized `SEO` component using `react-helmet-async`.
2. Replace the current `usePageTitle` hook with this component.
3. **Supported Meta Tags (Comprehensive):**
   - **Standard:** `title`, `description`, `canonical`, `robots`.
   - **Open Graph:** `og:site_name` ("Divemap"), `og:locale` ("en_US"), `og:type`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:width`, `og:image:height`.
   - **Twitter:** `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
   - **Article (for content):** `article:published_time`, `article:modified_time`, `article:author`.
4. **In Detail Pages:**
   - **Dive Sites:** `Divemap - [Name] - [Region]` | Desc: "[Name], [Difficulty] site in [Country]..."
   - **Diving Centers:** `[Center Name] - [City]` | Desc: "Dive center in [City] offering..."
   - **Dive Routes:** `Route: [Route Name] at [Site Name]` | Desc: "Underwater navigation map for [Route Name]..."
   - **Public Dives:** `Dive Log: [Site Name] by [User]` | Desc: "Dive log from [Date]. Max depth: [Depth]m..."
   - **Dive Trips:** `Dive Trip: [Trip Name] - [Date]` | Desc: "Join the [Trip Name] at [Site Name] on [Date]. Organized by..."

---

## Proposal 3: JSON-LD Structured Data (High)

**Priority:** High | **Effort:** Medium | **Location:** Frontend (React)

Structured data helps search engines understand the *intent* of a page, enabling rich snippets like star ratings and location maps in search results.

### Implementation Details:
1. **Dive Sites (`/dive-sites/:id`):**
   - Use **`Schema.org/TouristAttraction`** (for popular sites) or **`Schema.org/Place`** combined with **`BodyOfWater`**.
   - **Key Properties:**
     - `@type`: `["Place", "BodyOfWater", "TouristAttraction"]`
     - `name`: Site Name
     - `geo`: `{ "@type": "GeoCoordinates", "latitude": "...", "longitude": "..." }`
     - `aggregateRating`: `{ "@type": "AggregateRating", "ratingValue": "...", "reviewCount": "..." }`
     - `description`: Short description.
     - `containsPlace`: If it contains sub-sites or routes.
   - **Breadcrumbs:** Include a `BreadcrumbList` schema linking `Home > Dive Sites > [Region] > [Country] > [Site Name]`.

2. **Diving Centers (`/diving-centers/:id`):**
   - Use **`Schema.org/SportsActivityLocation`** or **`Schema.org/LocalBusiness`**. (Note: `DiveShop` does not exist).
   - **Key Properties:**
     - `@type`: `["SportsActivityLocation", "LocalBusiness"]`
     - `priceRange`: `$$`
     - `address`: Full postal address.
     - `telephone`: Contact number.
     - `geo`: Coordinates.
   - **Breadcrumbs:** Include a `BreadcrumbList` schema linking `Home > Diving Centers > [City] > [Name]`.

3. **Dive Routes (`/dive-sites/:id/route/:routeId`):**
   - Use **`Schema.org/CreativeWork`** (as a Map/Guide).
   - **Key Properties:**
     - `@type`: `["CreativeWork", "Guide"]`
     - `about`: Link to the *Dive Site* entity.
     - `name`: Route Name.
     - `description`: Navigation instructions.

4. **Public Dives (`/dives/:id`):**
   - Use **`Schema.org/Review`** (if it contains a rating) or **`Schema.org/CreativeWork`** (Log).
   - **Key Properties:**
     - `@type`: `Review`
     - `itemReviewed`: Link to the *Dive Site* entity.
     - `reviewRating`: `{ "@type": "Rating", "ratingValue": "..." }`
     - `author`: `{ "@type": "Person", "name": "..." }`
     - `datePublished`: Dive Date.

5. **Dive Trips (`/dive-trips/:id`):**
   - Use **`Schema.org/SportsEvent`**.
   - **Key Properties:**
     - `name`: Trip Name
     - `startDate` / `endDate`
     - `location`: The Dive Site or Center.
   - **Breadcrumbs:** Include a `BreadcrumbList` schema linking `Home > Dive Trips > [Name]`.

---

## Proposal 4: Canonical URLs (High)

**Priority:** High | **Effort:** Low | **Location:** Frontend (React)

Prevent duplicate content penalties caused by tracking parameters or multiple URL patterns (e.g., `/map?type=dive-sites` vs `/dive-sites`).

### Implementation Details:
1. In the `SEO` component, always include a `<link rel="canonical" href="..." />` tag.
2. Ensure it points to the clean, primary URL of the resource.

---

## Proposal 5: Robots.txt & Discovery (Medium)

**Priority:** Medium | **Effort:** Low | **Location:** Frontend/Infrastructure

Direct crawlers efficiently and block them from low-value or private paths.

### Implementation Details:
1. Update `frontend/public/robots.txt` to include:
   ```txt
   Sitemap: https://divemap.com/sitemap.xml
   User-agent: *
   Disallow: /api/
   Disallow: /admin/
   ```

---

## Proposal 6: Image Alt Text & Accessibility Audit (Medium)

**Priority:** Medium | **Effort:** Medium | **Location:** Frontend (React)

Image search is a major traffic driver for travel/recreational sites.

### Implementation Details:
1. Audit the `DiveSiteDetail.js` media gallery.
2. Ensure user-uploaded photos use their description as `alt` text.
3. If no description exists, fallback to a descriptive pattern: `Scuba diving at [Dive Site Name] - [Region]`.

---

## Summary Work Order

| Step | Action | Impact |
| :--- | :--- | :--- |
| 1 | **Backend:** Implement `/sitemap.xml` | High discovery of deep links. |
| 2 | **Frontend:** Deploy `SEO` component with Helmet | Better social sharing and CTR. |
| 3 | **Frontend:** Implement JSON-LD for Dive Sites | Rich snippets (stars) in Google. |
| 4 | **Frontend:** Self-referencing Canonical tags | SEO stability. |
| 5 | **Frontend:** Global metadata audit (Home, About) | Professional brand appearance. |
