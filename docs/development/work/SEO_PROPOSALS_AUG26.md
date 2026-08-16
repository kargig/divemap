# Divemap SEO Proposals — August 2026

**Status:** Active plan  
**Supersedes:** `SEO_PROPOSALS.md` (proposals 1–5 marked Done; remaining items carried forward below)  
**Trigger:** Google Search Console report — **2,550 pages "Discovered - currently not indexed"**, most with **Last crawled: N/A** (first detected 2026-06-02).

---

## GSC Diagnosis

Google Search Console shows almost the entire sitemap (~2,611 URLs) in **Discovered - currently not indexed**. Example URLs include `/about`, `/dive-routes`, and individual detail pages — all with **Last crawled: N/A**.

| Signal | Meaning |
| :--- | :--- |
| **Discovered** | Google found the URL (almost certainly via `sitemap.xml`). |
| **Last crawled: N/A** | Google has **not yet fetched** the page. This is not a rendering/indexing-quality rejection — it is a **crawl prioritisation** problem. |
| **2.55K affected** | Roughly equals sitemap size → Google knows about the URLs but is ignoring most of them. |

This is distinct from **Crawled - currently not indexed** (Google fetched the page but chose not to index it). We likely have both problems queued up: pages Google never crawls, and pages that — if crawled — would look identical because of CSR.

### Why Google is not crawling

1. **Low domain authority / new site.** Google allocates limited crawl budget to unknown domains. Submitting 2,600 URLs via sitemap does not mean Google will crawl them.
2. **Every URL returns the same initial HTML.** The SPA shell (`index.html`) has one generic `<title>` and `<meta description>` for all routes. Google has no HTML signal that `/dive-routes/11/keratea-cavern-swim-route` differs from `/about`.
3. **Weak crawl graph in raw HTML.** The only crawlable links in the initial HTML are six nav links on the loading fallback. Detail pages are not linked from server HTML — only reachable via sitemap or JS navigation.
4. **Split domain signals.** Both `divemap.gr` and `divemap.blue` serve HTTP 200 with the same SPA. No 301 canonical redirect. Authority is diluted.
5. **Sitemap overshoot.** Dumping every user profile, dive log, and list into one flat sitemap tells Google to discover thousands of low-value URLs before the site has proven trust.

### What the previous plan got wrong

Proposals 1–5 in `SEO_PROPOSALS.md` built excellent **client-side** SEO (Helmet, JSON-LD, OG tags, sitemap). That work helps **after** Google renders JavaScript — but GSC shows Google is not even **fetching** the pages. Client-side metadata cannot fix a crawl-priority problem.

---

## Current Production State (verified 2026-08-14)

| Asset | Status | Problem |
| :--- | :--- | :--- |
| `sitemap.xml` | ✅ 2,611 URLs on `divemap.blue` | Too large, flat, no tiering |
| `robots.txt` | ✅ Points to sitemap | Cloudflare managed rules also present |
| `react-helmet-async` | ✅ On detail pages | Client-side only; invisible in first HTML response |
| JSON-LD | ✅ On detail pages | Client-side only |
| `index.html` fallback | ✅ Generic loading + 6 nav links | Not page-specific |
| Markdown negotiation | ✅ `Accept: text/markdown` | Google sends `Accept: text/html` — unused |
| `generate_static_content.py` | ✅ Generates sitemap + markdown | Uploads flat files to R2; served by LLM worker. Not for app HTML. |
| Dual domains | ❌ `.gr` and `.blue` both 200 | Duplicate origin, split authority |

---

## Rejected approaches (do not implement)

These were considered and discarded:

| Approach | Why it is wrong |
| :--- | :--- |
| **One static HTML file per URL** (disk, R2, or nginx image) | URLs are dynamic (one per DB row). Content changes with the DB. N files to generate, store, and stale-sync. |
| **Bake SEO HTML into the nginx image like JS** | JS is **one program** for every URL (responsive mobile/tablet/desktop). SEO HTML is **per-URL content**. Serving a static snapshot instead of the SPA replaces the product for those routes. |
| **Cloudflare worker serves HTML from R2** | The LLM worker exists to offload scraper files (`sitemap.xml`, `*.md`, `llms.txt`) from Fly. App routes (`/dive-sites/104/...`) already go through nginx. Intercepting them in the worker splits the site and does not help humans. |
| **Full SSR / Next.js rewrite** | Solves unique HTML, but is a frontend rewrite. Not required. |

`generate_static_content.py` + R2 + LLM worker stay as they are: **markdown, sitemap, robots, llms.txt only**.

---

## Proposal A: Dynamic HTML for crawlers (CRITICAL)

**Priority:** P0 — blocks all other SEO progress  
**Effort:** Medium  
**Impact:** High  
**Status:** Not implemented. Earlier static-file work (`backend/static_html.py`, worker HTML routes) was the wrong model and should be reverted, not finished.

Google must receive **unique, content-rich HTML in the first response** for each public URL. Humans must keep the React SPA (responsive UI, maps, auth).

This is the same idea as markdown negotiation: **one renderer, path in, document out** — not a file per page.

### Who gets what

```
Human     → nginx → SPA index.html → React (mobile / tablet / desktop)
Crawler   → nginx → backend HTML renderer → unique title, body, JSON-LD for that path
AI agent  → nginx → existing markdown negotiation (Accept: text/markdown)
```

The SPA is never replaced for browsers. Search engines do not need a static site.

### Analog: markdown negotiation (already in production)

| | Markdown (agents) | SEO HTML (search engines) |
| :--- | :--- | :--- |
| Trigger | `Accept: text/markdown` | Crawler User-Agent, or inject-into-SPA-shell for HTML GETs |
| Handler | One FastAPI endpoint | One FastAPI endpoint |
| Data | Path → catalog `.md` from `llm_content` (R2/worker) | Path → **one DB row**, HTML built on request |
| Files on disk | A handful of catalogs | **None per entity** |

### Recommended implementation

**Backend:** one endpoint, e.g. `GET /api/v1/seo/html/{path:path}` (or nginx rewrite of public routes for crawlers).

1. Parse the path (`dive-sites` + id, `diving-centers` + id, …).
2. Load that entity from MySQL (404 if missing/unpublished).
3. Return HTML with unique `<title>`, meta description, canonical (from `Host`), Open Graph, JSON-LD, `<h1>`, body text, and a few real `<a href>` links.

Canonical URLs use the request host so the same renderer works for `.blue` / `.gr` until Proposal B consolidates domains.

**Nginx:** for crawler User-Agents (Googlebot, Bingbot, etc.) on public catalog routes, proxy to that endpoint. Everyone else keeps `@spa` → `index.html`.

**Preferred variant (inject into SPA shell):** renderer fills `#root` inside the existing built `index.html` and still emits the JS/CSS tags. Crawlers see content without JS. After JS runs, React hydrates and the real app takes over. Users still get mobile/desktop JS. Requires a copy of the built `index.html` on the backend **or** nginx `sub_filter` / SSI — pick the simpler of the two at implementation time.

### Scope — paths the renderer must handle

| Route pattern | Example | Priority |
| :--- | :--- | :--- |
| `/` | Homepage | P0 |
| `/dive-sites` | Listing (limited link list in HTML) | P0 |
| `/dive-sites/:id/:slug` | Detail | P0 |
| `/diving-centers` | Listing | P0 |
| `/diving-centers/:id/:slug` | Detail | P0 |
| `/dive-routes` | Listing | P0 |
| `/dive-routes/:id/:slug` | Detail | P0 |
| `/dives/:id/:slug` | Public dive log | P1 |
| `/dive-trips/:id/:slug` | Trip detail | P1 |
| `/about`, `/help`, `/privacy` | Static pages | P1 |
| `/users/:username` | Profile | P2 |
| `/users/:username/lists/:id/:slug` | Curated list | P2 |

Listing HTML should include a bounded set of real links (e.g. first 50–100 entities), not the entire catalog.

### Response shape (crawler HTML)

```html
<title>Divemap - Agia Anna - Naxos, Greece</title>
<meta name="description" content="Shore dive at Agia Anna, Naxos. Max depth 18m..." />
<link rel="canonical" href="https://divemap.blue/dive-sites/104/agia-anna-naxos-south-aegean-greece" />
<script type="application/ld+json">{ ... Place schema ... }</script>
<main>
  <h1>Agia Anna</h1>
  <p>Region: Naxos, South Aegean, Greece</p>
  <p>Max depth: 18m · Difficulty: Open Water</p>
  <p>Full description…</p>
  <nav>
    <a href="/dive-sites">All Dive Sites</a>
    <a href="/dive-sites?country=Greece">Dive Sites in Greece</a>
  </nav>
</main>
```

If using the inject-into-SPA-shell variant, the same markup sits inside `#root` and the hashed JS bundle tags remain so humans hydrate.

### What NOT to do

- Do not generate or store one HTML file per dive site / center / route.
- Do not COPY SEO HTML into `nginx/frontend-build/` or the nginx Docker image.
- Do not add worker routes for `/dive-sites*`, `/diving-centers*`, `/dive-routes*`.
- Do not serve crawler HTML to normal browsers in place of the SPA (unless it is the inject-into-shell variant that still loads React).
- Do not migrate to Next.js as a prerequisite.
- Do not use Cloudflare Browser Rendering as the primary strategy.

### Acceptance criteria

- [ ] A Googlebot User-Agent `curl` of a dive site URL returns that site’s `<h1>` and a unique `<title>` with **no JavaScript execution**.
- [ ] A normal browser User-Agent to the same URL still receives the SPA (`index.html` + hashed JS) and the responsive app.
- [ ] Missing/unpublished IDs return HTTP 404 for crawler HTML (not the SPA 200 shell).
- [ ] Google Search Console URL Inspection → **Live test** shows unique title + description + body text.
- [ ] Within 4 weeks of deploy, "Discovered - currently not indexed" count stops growing; some URLs move to "Indexed".

---

## Proposal B: Canonical Domain Consolidation (CRITICAL)

**Priority:** P0  
**Effort:** Low  
**Impact:** High

Pick **one** canonical domain. Recommended: **`divemap.blue`** (already used in production sitemap and GSC).

### Actions

1. **301 redirect** all `divemap.gr` traffic to `divemap.blue` (Cloudflare redirect rule or nginx).
2. Update `BASE_URL` in `generate_static_content.py` to read from env var (`CANONICAL_BASE_URL`), defaulting to `https://divemap.blue`.
3. Update `frontend/public/robots.txt` sitemap line (currently `divemap.gr`).
4. Update all hardcoded `divemap.gr` references in markdown/LLM content, email templates, and app config over time.
5. Canonical in crawler HTML uses the request `Host` (or, after this proposal, always `divemap.blue`).
6. In Google Search Console, set `.blue` as the preferred domain; add `.gr` property and confirm redirect.

### Acceptance criteria

- [ ] `curl -sI https://divemap.gr/dive-sites` returns `301` → `https://divemap.blue/dive-sites`.
- [ ] All sitemap `<loc>` entries use `divemap.blue`.
- [ ] No `divemap.gr` URLs in newly generated static content.

---

## Proposal C: Tiered Sitemap Strategy (HIGH)

**Priority:** P1  
**Effort:** Low–Medium  
**Impact:** High

Stop submitting 2,600 URLs in one flat sitemap to a low-authority domain. Google discovers them all but crawls none.

### New structure: Sitemap Index

```
/sitemap.xml              → sitemap index (points to sub-sitemaps)
/sitemap-core.xml         → ~20 URLs: /, /about, /dive-sites, /diving-centers, /dive-routes, /dives, /help, /privacy
/sitemap-dive-sites.xml   → all dive site detail pages
/sitemap-centers.xml      → all diving center detail pages
/sitemap-routes.xml       → all dive route detail pages
/sitemap-dives.xml        → public dives only (exclude private/unlisted)
/sitemap-trips.xml        → dive trips
/sitemap-users.xml        → user profiles (P2 — consider omitting initially)
/sitemap-lists.xml          → curated lists (P2 — consider omitting initially)
```

### Phase the rollout

| Phase | Submit to GSC | Target count | When |
| :--- | :--- | :--- | :--- |
| 1 | `sitemap-core.xml` + `sitemap-dive-sites.xml` | ~500–800 | Immediately after Proposal A deploy |
| 2 | `+ sitemap-centers.xml` + `sitemap-routes.xml` | +500 | 2 weeks later, if Phase 1 URLs get crawled |
| 3 | `+ sitemap-dives.xml` + `sitemap-trips.xml` | +rest | 4 weeks later |
| 4 | User profiles & lists | defer | Only after site shows consistent indexing |

### Sitemap quality rules

- `<lastmod>` must reflect actual content change date (already partially done).
- Remove deleted/unpublished entities.
- Remove `/login`, `/register`, `/admin/*`, `/notifications` (already blocked in robots.txt — also exclude from sitemap).
- Do **not** include URLs that still return identical SPA-shell HTML for crawlers.

### Acceptance criteria

- [ ] Sitemap index validates in Google Search Console without errors.
- [ ] Within 2 weeks, GSC shows "Last crawled" dates (not N/A) for core + top dive site URLs.

---

## Proposal D: Crawlable Internal Linking in Crawler HTML (HIGH)

**Priority:** P1  
**Effort:** Medium  
**Impact:** High

Google discovers URLs from links, not just sitemaps. The SPA provides almost no crawl paths in raw HTML. The **crawler HTML renderer** (Proposal A) must emit real `<a href>` links.

### Listing responses

`/dive-sites`, `/dive-routes`, `/diving-centers` crawler HTML should include a bounded list:

```html
<ul>
  <li><a href="/dive-sites/104/agia-anna-naxos-south-aegean-greece">Agia Anna — Naxos, Greece</a></li>
  <li><a href="/dive-sites/4/egypt-south-sinai-ss-thistlegorm">SS Thistlegorm — Egypt</a></li>
</ul>
```

First 50–100 items is enough; the rest stay in the SPA.

### Detail responses

Each crawler HTML detail document should include:

- Breadcrumb links: `Home > Dive Sites > Greece > Naxos > Agia Anna`
- Links to country/region filtered listing pages
- Links to 3–5 related dive sites or nearby centers (from existing DB relationships)

### Homepage

Crawler HTML for `/` should go beyond the six nav links in `index.html`:

- Featured / popular dive sites (top 10 by rating or dive count)
- Recently added sites
- Regional landing links (`/dive-sites?country=Greece`)

### Acceptance criteria

- [ ] Googlebot `curl` of `/dive-sites` HTML finds 50+ unique internal `<a href>` links without executing JS.
- [ ] Detail crawler HTML contains ≥3 internal links to other public pages.

---

## Proposal E: Request Indexing for Seed URLs (QUICK WIN)

**Priority:** P1  
**Effort:** Trivial  
**Impact:** Medium (bootstraps crawl)  
**Depends on:** Proposal A (crawler HTML must exist before requesting indexing)

After deploying the crawler HTML renderer:

1. In Google Search Console → URL Inspection, manually request indexing for:
   - `/`
   - `/dive-sites`
   - `/diving-centers`
   - `/dive-routes`
   - Top 20 dive sites by rating/dive count
2. Repeat weekly for the next 50 highest-value pages.
3. Submit updated sitemap in GSC after each `generate_static_content.py` run.
4. Register with **Bing Webmaster Tools** and submit the same sitemap.
5. Consider **IndexNow** (Bing/Yandex) — add a key file and ping on content updates.

Do not request indexing for all 2,600 URLs manually — focus on seed pages that build crawl trust.

---

## Proposal F: Fix HTTP Semantics for Missing Pages (MEDIUM)

**Priority:** P2  
**Effort:** Low–Medium  
**Impact:** Medium

The SPA returns HTTP 200 for all routes, including non-existent IDs. Google may crawl junk URLs from the sitemap (deleted entities) and lose trust.

### Actions

1. Omit deleted/unpublished entities from the sitemap (already intended — verify).
2. Crawler HTML renderer returns **404** for missing/unpublished IDs (Proposal A).
3. Custom 404 HTML for crawlers (and SPA `NotFound` for humans) with links back to main sections.

---

## Proposal G: Carry-Forward Items from Previous Plan (MEDIUM)

These remain valid but are **secondary** until Proposals A–D are done.

| Old # | Item | Priority | Notes |
| :--- | :--- | :--- | :--- |
| 6 | Image alt text audit | P2 | Meaningful once pages are indexed |
| 7 | UGC link `rel="nofollow ugc"` | P2 | Spam prevention |
| 8 | Visual breadcrumbs | P1 | Include in crawler HTML (Proposal D), not just React |
| 9 | Custom 404 page | P2 | Merged into Proposal F |
| 10 | URL slugs | Done | Already using `/dive-sites/:id/:slug` |

---

## Implementation Roadmap

### Phase 1 — Unblock crawling (target: 2 weeks)

| # | Task | Owner | Deliverable |
| :--- | :--- | :--- | :--- |
| 1 | Revert leftover static-file / worker HTML work | Backend + worker | Remove `static_html.py` generation from prod path; drop worker routes for app URLs |
| 2 | Canonical domain 301 redirect | Infra | `divemap.gr` → `divemap.blue` |
| 3 | Fix `CANONICAL_BASE_URL` / sitemap `BASE_URL` | Backend | `generate_static_content.py` (markdown/sitemap only) |
| 4 | Crawler HTML renderer for P0 paths | Backend | One FastAPI endpoint, DB lookup per request |
| 5 | Nginx: Googlebot/Bingbot → renderer; others → SPA | Infra | `nginx/prod.conf` |
| 6 | Tiered sitemap index | Backend | `sitemap.xml` → sub-sitemaps |
| 7 | Deploy + verify with `curl` (bot vs browser) and GSC | All | Checklist in Proposal A |

### Phase 2 — Expand coverage (target: +2 weeks)

| # | Task | Deliverable |
| :--- | :--- | :--- |
| 8 | Renderer coverage for centers, routes, trips (if not in P0) | Same endpoint, more path parsers |
| 9 | Internal linking in crawler HTML | Breadcrumbs + related links |
| 10 | Submit Phase 1 sitemaps to GSC + Bing | Manual |
| 11 | Request indexing for seed URLs | 25 URLs/week |

### Phase 3 — Optimise & monitor (ongoing)

| # | Task | Deliverable |
| :--- | :--- | :--- |
| 12 | Add Phase 2/3 sub-sitemaps as indexing improves | GSC monitoring |
| 13 | UGC nofollow, alt text, 404 page | Frontend |
| 14 | Monthly GSC review: indexed count, crawl stats, Core Web Vitals | Report |

---

## Success Metrics

Track in Google Search Console weekly:

| Metric | Current (2026-08-07) | Target (2026-10-01) | Target (2026-12-01) |
| :--- | :--- | :--- | :--- |
| Indexed pages | ~0 (2.55K discovered, not indexed) | ≥100 | ≥1,000 |
| "Discovered - not indexed" | 2,550 | <2,000 | <500 |
| URLs with "Last crawled" date | ~0 | ≥50 | ≥500 |
| Impressions (28-day) | (check GSC) | 10× current | 50× current |
| Average position | (check GSC) | — | Top 20 for branded + long-tail dive site queries |

---

## Verification Checklist (run after Phase 1 deploy)

```bash
UA_BOT='Googlebot/2.1 (+http://www.google.com/bot.html)'
UA_BROWSER='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
URL='https://divemap.blue/dive-sites/104/agia-anna-naxos-south-aegean-greece'

# 1. Crawler sees unique title and h1 (no JS)
curl -sL -A "$UA_BOT" "$URL" | grep -o '<title>[^<]*</title>'
curl -sL -A "$UA_BOT" "$URL" | grep -o '<h1[^>]*>[^<]*</h1>'

# 2. JSON-LD in crawler HTML
curl -sL -A "$UA_BOT" "$URL" | grep 'application/ld+json'

# 3. Browser still gets the SPA
curl -sL -A "$UA_BROWSER" "$URL" | grep -E 'assets/index-|type="module"'

# 4. Canonical domain redirect
curl -sI https://divemap.gr/dive-sites | grep -i location

# 5. Sitemap valid
curl -sL https://divemap.blue/sitemap.xml | head -20

# 6. Listing crawler HTML has internal links
curl -sL -A "$UA_BOT" https://divemap.blue/dive-sites | grep -c '<a href="/dive-sites/'
```

Then in Google Search Console:

- URL Inspection → Live Test on 5 detail pages → confirm unique title, description, and rendered HTML content.
- Sitemaps → confirm 0 errors.
- Page Indexing → watch "Discovered - currently not indexed" count over 4 weeks.

---

## Summary

The previous SEO work built the right **client-side** metadata layer. Google Search Console proves that layer is never reached: **2,550 URLs are discovered but not crawled**.

The fix is not more Helmet tags, a bigger sitemap, or a static HTML file per URL. The SPA stays the client for people. Search engines get **HTML generated on request** from the DB — one renderer, same pattern as markdown negotiation.

1. **Dynamic crawler HTML** for public paths (Proposal A).
2. **One canonical domain** (Proposal B).
3. **Smaller, tiered sitemaps** that match the site's current crawl budget (Proposal C).
4. **Crawlable internal links** in crawler HTML (Proposal D).

Everything else — alt text, nofollow, breadcrumbs in React — matters only after Google starts fetching and indexing pages.
