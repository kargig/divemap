# SEO Dynamic Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dynamic server-side rendering (dynamic rendering) on all public GET routes for both search engine bots and human visitors to improve SEO and Core Web Vitals (FCP/LCP), while deprecating and removing the obsolete pre-rendered static HTML generator and Cloudflare R2 upload pipeline.

**Architecture:** Nginx intercepts public catalog and detail GET requests (like `/`, `/dive-sites*`, `/diving-centers*`, `/dive-routes*`, etc.) and proxies them to the backend API. The FastAPI backend live-queries the database, parses the built React SPA's `index.html` shell (fetched dynamically from Nginx over the internal network and cached in memory), pre-renders the page-specific body and meta elements into the DOM, and serves it with caching enabled. For human visitors, the loaded React SPA automatically mounts over `#root` and takes over client-side navigation.

**Tech Stack:** Python, FastAPI, SQLAlchemy, MySQL, Nginx, Docker, httpx.

## Global Constraints
- **Python Environment:** Always use the virtual environment at `backend/divemap_venv`.
- **Nginx Config:** Modify both `nginx/dev.conf` (for development) and `nginx/prod.conf` (for production).
- **No Git Add:** You are STRICTLY FORBIDDEN to use `git add` or `git commit -m`. Prepare changes for manual commit.
- **Verification Rule:** Every route change must be verified via `curl` with standard browser and bot User-Agents.

---

### Task 1: Reverting Old R2/Static HTML Code & Codebase Cleanup

**Files:**
- Modify: `backend/generate_static_content.py` (remove static HTML generation, local checks, and R2 static upload block)
- Modify: `divemap-llm-worker/late-moon-cc3c/src/index.ts` (remove `seoHtmlR2Key` and `tryServeSeoHtml` logic)
- Delete: `backend/tests/test_static_html_r2.py`

**Interfaces:**
- Consumes: None
- Produces: None

- [ ] **Step 1: Delete the obsolete static HTML R2 upload test file**

Run: `rm backend/tests/test_static_html_r2.py`

- [ ] **Step 2: Modify `backend/generate_static_content.py` to remove static HTML generator triggers**

Open `backend/generate_static_content.py` and delete:
1. `static_html_present` function definition.
2. `r2_static_html_present` function definition.
3. `upload_static_html_to_r2` function definition.
4. The block on lines 519-532 that calls `generate_static_html` and `upload_static_html_to_r2`.
5. Remove unused references in `__main__` CLI argparser and freshness validation checks.

Verify by running `python backend/generate_static_content.py --help` using the virtual environment `backend/divemap_venv/bin/python` to ensure no syntax errors.

- [ ] **Step 3: Modify Cloudflare Worker `divemap-llm-worker/late-moon-cc3c/src/index.ts` to strip R2 SEO HTML handling**

Open `divemap-llm-worker/late-moon-cc3c/src/index.ts` and delete:
1. `seoHtmlR2Key` function definition.
2. `tryServeSeoHtml` function definition.
3. The block calling `tryServeSeoHtml(request, env)` inside `fetch`.

- [ ] **Step 4: Verify backend test suite still compiles and runs cleanly**

Run backend unit tests:
`cd backend && ./docker-test-github-actions.sh tests/test_static_html.py`
Expected: `All tests passed!`

---

### Task 2: Implement FastAPI Router for Dynamic SEO Pre-rendering

**Files:**
- Create: `backend/app/routers/seo.py`
- Modify: `backend/app/main.py` (include and register the SEO router)
- Test: `backend/tests/test_seo_router.py`

**Interfaces:**
- Consumes: Database models (`DiveSite`, `DivingCenter`, `DiveRoute`), rendering functions from `backend/static_html.py`
- Produces: `GET /api/v1/seo/html/{path:path}` endpoint returning `HTMLResponse`

- [ ] **Step 1: Write integration tests for the new SEO router in `backend/tests/test_seo_router.py`**

Create `backend/tests/test_seo_router.py` containing tests that mock the database session, fetch the home, details, and listing paths, and assert correct titles, breadcrumbs, JSON-LD schemas, and `X-Prerendered` headers are returned.

- [ ] **Step 2: Verify SEO router tests fail**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_seo_router.py`
Expected: FAIL (or file not found/router not imported)

- [ ] **Step 3: Implement the FastAPI SEO router in `backend/app/routers/seo.py`**

Create `backend/app/routers/seo.py`. It should:
1. Implement in-memory cache for SPA template fetching from `http://nginx/index.html` (in prod) or `http://frontend:5173/` (in dev) or fallback on disk paths, falling back to a minimal semantic template.
2. Define `GET /html/{path:path}` endpoint.
3. Decode route path, parse IDs, query database, and call the corresponding render functions in `static_html.py`.
4. Formulate the final HTML response using `render_seo_page` and inject proper caching/cache-control headers.

- [ ] **Step 4: Register SEO Router in `backend/app/main.py`**

Open `backend/app/main.py` and include the SEO router:
```python
from app.routers import seo
app.include_router(seo.router, prefix="/api/v1/seo", tags=["SEO"])
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `cd backend && ./docker-test-github-actions.sh tests/test_seo_router.py`
Expected: `All tests passed!`

---

### Task 3: Nginx Gateway Integration & Cache Configuration

**Files:**
- Modify: `nginx/dev.conf`
- Modify: `nginx/prod.conf`

**Interfaces:**
- Consumes: FastAPI `/api/v1/seo` endpoint
- Produces: Fast Nginx routing and proxy cache zone for public routes

- [ ] **Step 1: Modify `nginx/dev.conf` to configure public GET routes to proxy to SEO endpoint**

1. Set up a local `proxy_cache_path` in `nginx/dev.conf` inside the `http` block.
2. Intercept exact match GET on `/` and proxy to `http://backend/api/v1/seo/html/`.
3. Intercept `/(dive-sites|diving-centers|dive-routes|about|help|privacy)(/.*)?$` and proxy GET/HEAD requests to `http://backend/api/v1/seo/html$uri`. Exclude static asset paths (`.js`, `.css`, images).
4. Configure cache bypass on `?nocache=1`.

- [ ] **Step 2: Modify `nginx/prod.conf` to configure production proxy cache and public routes proxy**

1. In the `http` block of `nginx/prod.conf`, add:
   `proxy_cache_path /var/cache/nginx/seo_cache keys_zone=seo_cache:10m max_size=100m inactive=60m use_temp_path=off;`
2. Add precise matching location blocks for public routes mapping to `http://backend/api/v1/seo/html/` and `http://backend/api/v1/seo/html$uri`.
3. Add `proxy_cache seo_cache;` and cache duration mappings (`proxy_cache_valid 200 301 10m;`).

- [ ] **Step 3: Build, start, and verify the stack locally**

1. Run `docker-compose build nginx backend && docker-compose up -d`.
2. Verify with `curl -sI http://localhost/` -> Look for `X-Cache-Status: MISS` on first, and `HIT` on second.
3. Verify `curl -s http://localhost/dive-sites/104` fetches full pre-rendered HTML without JS execution.
4. Verify standard browser access still boots the React SPA.
