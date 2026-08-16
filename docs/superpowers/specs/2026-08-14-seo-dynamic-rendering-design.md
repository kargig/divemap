# Design Spec: SEO Dynamic Rendering for All Public Routes

**Date:** Friday 14 August 2026  
**Status:** Approved by User  
**Target File:** `docs/superpowers/specs/2026-08-14-seo-dynamic-rendering-design.md`  

---

## 1. Overview & Business Goal

To improve SEO indexing and Core Web Vitals on [divemap.blue](https://divemap.blue), we are replacing the static-generation pre-rendering strategy with a live **Dynamic Rendering Engine**.

Instead of pre-rendering thousands of static HTML files in a background script and syncing them to Cloudflare R2, we will intercept all **public GET requests** at Nginx and proxy them to a fast, database-backed pre-rendering endpoint on the FastAPI backend. 

### Key Architectural Improvements:
1. **Zero-Lag Dynamic Updates:** As soon as a user edits a dive site or submits a review, search engine crawlers and normal users receive 100% fresh pre-rendered HTML on their next request. No background crons or stale sync.
2. **Improved FCP/LCP for Humans:** Real users visiting a public page get fully populated server-rendered HTML immediately (improving First Contentful Paint and eliminating empty-shell layout shifts). Once the JS bundle loads, the React SPA seamlessly boots and replaces `#root`, enabling full interactivity.
3. **Robust Internal Template Resolution:** FastAPI dynamically fetches the built SPA shell `index.html` directly from Nginx over the internal network and caches it in memory permanently. This prevents hardcoupling frontend builds into the backend image.
4. **Nginx Edge Caching:** We use Nginx `proxy_cache` to cache successful pre-rendered pages for **10 minutes**, ensuring bot crawls or sudden human traffic waves never overload the database.

---

## 2. System Architecture & Request Flow

```
                                  [ Human or Bot GET Request ]
                                              │
                                              ▼
                                         ┌─────────┐
                                         │  Nginx  │
                                         └────┬────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     │ Is GET on:                                      │
                     │ / or /dive-sites* or /diving-centers* or        │
                     │ /dive-routes* or /about or /help or /privacy?   │
                     └────────────────────────┬────────────────────────┘
                                              │
                             ┌────────────────┴────────────────┐
                             ▼ Yes                             ▼ No
                     ┌───────────────┐                  ┌──────────────┐
                     │ Check Nginx   │                  │ Serve SPA    │
                     │ proxy_cache   │                  │ Shell (Disk) │
                     └───────┬───────┘                  └──────────────┘
                             │
               ┌─────────────┴─────────────┐
               ▼ Hit                       ▼ Miss
       ┌──────────────┐            ┌───────────────────────────────────────────┐
       │ Serve Cached │            │ Proxy GET to FastAPI:                     │
       │ HTML (< 5ms) │            │ /api/v1/seo/html/{path}                   │
       └──────────────┘            └───────────────────┬───────────────────────┘
                                                       │
                                                       ▼
                                           ┌───────────────────────┐
                                           │ FastAPI Backend       │
                                           ├───────────────────────┤
                                           │ 1. Uses Cached        │
                                           │    index.html template│
                                           │ 2. Queries MySQL live │
                                           │ 3. Generates metadata │
                                           │    & HTML inside #root│
                                           └───────────┬───────────┘
                                                       │
                                                       ▼
                                           ┌───────────────────────┐
                                           │   HTMLResponse (200)  │
                                           └───────────────────────┘
```

---

## 3. Detailed Component Designs

### A. FastAPI: Dynamic Pre-rendering Endpoint

We will create a new router at `backend/app/routers/seo.py` mounted as `/api/v1/seo` in `app/main.py`.

#### 1. In-Memory SPA Template Resolution
The endpoint requires the built `index.html` from the frontend to use as a skeleton.
* On first request or on startup, FastAPI performs an async internal HTTP request using `httpx.AsyncClient` to `http://nginx/index.html` (in prod) or `http://frontend:5173/` (in development).
* The resolved template is cached in a global variable.
* **Fallback:** If the network request fails or times out (e.g. during standalone backend test suites), it falls back to checking local candidates (`nginx/frontend-build/index.html` or `frontend/dist/index.html`) or a minimal HTML skeleton.

#### 2. Route Parsing & MySQL Data Layer
The route `GET /api/v1/seo/html/{path:path}` will parse the requested public route:
* **Home (`""` or `"/"`):** Fetch popular/approved dive sites to populate featured links.
* **Dive Sites Catalog (`"dive-sites"`):** Query MySQL for the top 100 approved, undeleted dive sites.
* **Dive Site Detail (`"dive-sites/{id}/{slug}"`):** Fetch the specific `DiveSite` with ratings and difficulty.
* **Diving Centers Catalog (`"diving-centers"`):** Query top 100 diving centers.
* **Diving Center Detail (`"diving-centers/{id}/{slug}"`):** Fetch the specific `DivingCenter`.
* **Dive Routes Catalog & Detail:** Similar mapping to `DiveRoute`.
* **Static Pages (`"about"`, `"help"`, `"privacy"`):** Return corresponding static text inside the template shell.

#### 3. Reusing existing `static_html.py`
We will import and utilize the existing HTML generation and parsing helpers from `backend/static_html.py`:
* `render_seo_page`: Injects dynamic head, JSON-LD, and main body into the SPA index.html.
* `render_dive_site_main`, `render_diving_center_main`, `render_dive_route_main`, `render_homepage_main`, `render_listing_main`.
* `dive_site_schema`, `diving_center_schema`, `dive_route_schema`.

---

### B. Nginx Caching & Proxy Setup

We will modify both `nginx/dev.conf` and `nginx/prod.conf`.

#### 1. Setup Cache Zone
Inside the `http` block of `nginx/prod.conf`:
```nginx
# Cache zone for pre-rendered SEO pages
proxy_cache_path /var/cache/nginx/seo_cache keys_zone=seo_cache:10m max_size=100m inactive=60m use_temp_path=off;
```

#### 2. Intercept Public GET Requests
Instead of returning `@spa` directly, we intercept public routes:
```nginx
# Intercept Homepage
location = / {
    proxy_cache seo_cache;
    proxy_cache_valid 200 301 10m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_bypass $arg_nocache;
    
    proxy_pass http://backend/api/v1/seo/html/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    add_header X-Cache-Status $upstream_cache_status;
}

# Intercept Catalogs and Details
location ~ ^/(dive-sites|diving-centers|dive-routes|about|help|privacy)(/.*)?$ {
    # If it's a static assets directory, let default try_files serve it
    if ($uri ~* "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|json)$") {
        break;
    }
    
    # Only proxy GET/HEAD requests
    limit_except GET {
        root /usr/share/nginx/html;
        rewrite ^ /index.html break;
    }

    proxy_cache seo_cache;
    proxy_cache_valid 200 301 10m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_bypass $arg_nocache;

    proxy_pass http://backend/api/v1/seo/html$uri;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    add_header X-Cache-Status $upstream_cache_status;
}
```

---

## 4. React SPA & Hydration Safety

* **ReactDOM.createRoot Compatibility:** When the React bundle executes, it mounts over the pre-rendered elements in `<div id="root">`. Because it reads the active URL via `window.location.pathname`, the React Router correctly mounts the corresponding component in the client without mismatch issues.
* **No Server-Side Layout Flickers:** By injecting the pre-rendered HTML into the initial response, users see real text, styles, and content immediately rather than a loading spinner.

---

## 5. Verification Checklist

1. **Local Dynamic Retrieval:**
   `curl -s http://localhost/dive-sites/104/agia-anna-naxos` returns the fully pre-rendered body with `<div id="root">` containing real content, breadcrumbs, and schema.org JSON-LD.
2. **Nginx Cache Hits:**
   Inspect response headers:
   `curl -I http://localhost/` -> Look for `X-Cache-Status: MISS` (first request) and `X-Cache-Status: HIT` (subsequent requests).
3. **No-Cache Bypass:**
   `curl -I http://localhost/?nocache=1` -> Always returns `X-Cache-Status: BYPASS`.
4. **404 Semantics:**
   `curl -I http://localhost/dive-sites/999999/non-existent` returns `HTTP/1.1 404 Not Found`.

---

## 6. Phase 1 Implementation Plan
1. **Revert Old Static Generation logic** in production configs.
2. **Implement FastAPI router** `backend/app/routers/seo.py`.
3. **Register SEO router** in `backend/app/main.py`.
4. **Update `nginx/dev.conf`** to add dynamic proxy rules.
5. **Update `nginx/prod.conf`** with proxy_cache configurations.
6. **Add Automated Integration Tests** to verify bot/human pre-rendering responses and HTTP semantics.
