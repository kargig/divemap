# Design Spec: SEO Indexing Fixes (Crawl Budget + Geo Hubs)

**Date:** 2026-09-25  
**Status:** Approved for implementation (Approach 1)  
**Branch / worktree:** `feature/seo-indexing-fixes`  
**Related:** GSC Coverage 2026-09-25 (45 indexed / 2606 not indexed; 2581 Discovered–not indexed)

---

## 1. Goals

Raise Google’s willingness to crawl and index high-value Divemap pages by:

1. Shrinking and re-prioritizing the sitemap (crawl budget).
2. Adding **path-based geo hubs** that are uniquely indexable (no duplicate-canonical traps).
3. Prerendering `/map` as a lightweight landing page.
4. Preserving **in-app search** and verifying it with Chrome DevTools.

## 2. Non-goals

- Google Indexing API as an indexing strategy (JobPosting/BroadcastEvent only).
- Stable R2 OG CDN (follow-up).
- 301 from `?country=` → path hubs (query params remain for UI).
- `noindex` on thin dive logs (sitemap exclusion is enough for this milestone).
- Off-site link building.

## 3. Decisions

| Topic | Choice |
| --- | --- |
| Success scope | Sitemap crawl-budget **+** geo hubs |
| Geo URL model | **Approach 1:** additive path hubs; query params keep working for UI/search |
| Canonical | Path hub when country/region set; never put `?country=` / `?region=` in sitemap |
| Substantial dive log | Profile data **OR** notes ≥ 100 chars **OR** ≥ 1 media item; user enabled & not private |
| `/map` | Prerender lightweight landing; keep in sitemap |

## 4. URL & canonical rules

### Path hubs (indexable)

- `/dive-sites/{country-slug}` — e.g. `/dive-sites/greece`
- `/dive-sites/{country-slug}/{region-slug}` — e.g. `/dive-sites/greece/east-attica`

Slugs = existing `slugify()` of the stored country/region strings. Resolve by matching slugify(DB value) == path segment among distinct approved-site values.

### Detail routes (unchanged)

- `/dive-sites/{numericId}/{site-slug}` remains canonical for individual sites.
- Non-numeric first segment → geo hub (not DiveSiteDetail).

### Query params (UI only)

- `?search=`, tags, difficulty, ratings, view, etc. continue to work on listing **and** hubs.
- When on a path hub, **do not** also put `country`/`region` in the query string (path is source of truth).
- When on `/dive-sites` with `?country=` / `?region=`, client canonical points at the matching path hub (if resolvable) to avoid duplicate indexing.

### Breadcrumbs / JSON-LD

- Site detail breadcrumbs link to path hubs, not `?country=` URLs.

## 5. Sitemap rules

**Include (higher priority):** `/`, `/dive-sites`, geo hubs (0.85), dive sites/centers (0.9), tools/about/help, `/map` (0.7).

**Include (filtered):** public dive logs that are substantial (priority 0.3).

**Exclude / demote:** `/login`, `/register` (remove from sitemap). Never include query-string URLs.

## 6. Prerender

- Extend `seo.py` dive-sites branch: non-numeric segment → geo hub HTML + `CollectionPage`/`ItemList` JSON-LD.
- Add `map` branch: unique title/description, links to `/dive-sites` and top country hubs.
- Nginx: add `map` to the SEO location regex (or `location = /map`).

## 7. Search safety

- Geo hubs **reuse** `DiveSites` list + same API filters; only path↔filter sync is added.
- Global navbar search and on-page `DesktopSearchBar` / `search_query` must keep working on hubs.
- Verification: Chrome DevTools — type in site search on `/dive-sites`, a country hub, and a region hub; confirm network requests and results.

## 8. Success signals

- Sitemap URL count drops (especially `/dives/...`).
- GSC “Discovered – not indexed” no longer ≈ full sitemap size.
- Geo hubs appear as Discovered/Crawled (ideally Indexed) within weeks.
- No search regressions in DevTools checklist.
