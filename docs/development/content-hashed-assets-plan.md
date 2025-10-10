# Content-Hashed Assets Plan

## Overview

This plan enables safe, fast, and cache-friendly deployments using content‑hashed filenames for JS/CSS and long‑lived immutable caching. It covers build changes, Nginx configuration, and Cloudflare cache rules so clients never see stale/broken mixes during releases and assets can be served even while Fly.io machines are booting.

## Current State (as observed)

- Frontend uses Create React App (`react-scripts build`) which emits hashed filenames under `frontend/build/static`.
- Nginx `nginx/prod.conf` proxies `/` to the `frontend` upstream; immutable asset headers are commented out; gzip is enabled; upstream keepalive is present.
- Cloudflare configuration is external to the repo.

## Goals

- Serve static assets (JS/CSS/fonts/images) with content‑hashed filenames and immutable, long‑lived caching.
- Keep HTML short‑lived so it quickly references the newly built asset filenames.
- Allow Cloudflare to serve cached assets while Fly.io containers are warming.
- Optional: Precompress assets (`.br`, `.gz`) and let Nginx serve precompressed files.

---

## Frontend: Build and Precompression

1) Ensure content‑hashed assets (already provided by CRA)

- `npm run build` produces files like `static/js/main.<hash>.js` and `static/css/main.<hash>.css`.

2) Add precompression step (recommended)

- In CI or your deploy script, after `npm run build`:

```bash
find build -type f \( -name "*.js" -o -name "*.css" -o -name "*.woff" -o -name "*.woff2" \) -print0 | xargs -0 -I{} gzip -9 -k "{}"
find build -type f \( -name "*.js" -o -name "*.css" -o -name "*.woff" -o -name "*.woff2" \) -print0 | xargs -0 -I{} brotli -f -q 11 "{}"
```

- This produces parallel files like `app.js.gz` and `app.js.br` next to originals.

3) Deploy the `build/` directory to the Nginx container (Option A below) or ensure the frontend service serves the correct headers (Option B).

---

## Nginx: Two Options

### Option A (Recommended): Serve assets directly from Nginx

- Copy `frontend/build/` into the Nginx image at `/usr/share/nginx/html` (or mount it).
- Keep `/api/` proxied to the backend.
- Add immutable caching for hashed assets and short TTL for HTML.
- Enable serving of precompressed files.

Config snippets to add to `nginx/prod.conf`:

```nginx
# At http level
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
# Serve precompressed files when present
gzip_static on;
# If Brotli module is available, also:
# brotli on;
# brotli_static on;

server {
    listen 8000;

    # Static assets (hashed)
    location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        root /usr/share/nginx/html;
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        access_log off;
    }

    # HTML (short-lived)
    location = /index.html {
        root /usr/share/nginx/html;
        add_header Cache-Control "public, max-age=60, stale-while-revalidate=300";
    }

    # App shell routing for SPA
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=60, stale-while-revalidate=300";
    }

    # Backend
    location /api/ {
        proxy_pass http://backend;
        # ... existing proxy headers and limits ...
    }
}
```

### Option B: Continue proxying to a frontend service

- Keep proxy from Nginx to the frontend service.
- Ensure the frontend server sets:
  - Hashed assets: `Cache-Control: public, max-age=31536000, immutable`
  - HTML: `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- If the frontend service can’t set these headers, prefer Option A so Nginx controls headers.

---

## Cloudflare: Cache Rules and Resilience

Create the following Cache Rules:

1) Hashed assets (long‑lived)

- If URL path matches: `*.js`, `*.css`, `*.woff2`, `*.png`, `*.jpg`, `*.svg`
- Eligible for cache: On
- Edge TTL: 1 year
- Browser TTL: 1 year (or Respect origin if you set immutable)
- Origin cache control: Respect origin (preferred) or Override if origin cannot set headers

2) HTML (short‑lived)

- If URL path matches: `*.html` or “URI is /”
- Eligible for cache: On
- Edge TTL: 60–120s
- Browser TTL: 60s
- Origin cache control: Respect origin (preferred if you set SWR)

3) API bypass

- If URL path matches: `/api/*`
- Eligible for cache: Off

Global settings (recommended):

- Enable Tiered Cache.
- Enable Always Online to serve cached content when origin is down.
- If your plan supports it, enable “Serve stale while origin unreachable”.

---

## Release Flow and Warmup

- CRA build generates new hashed asset filenames for each release.
- HTML is updated to reference those new filenames.
- Do not purge hashed assets on deploy; if purging is needed, purge only HTML.
- Optional: Add a deploy warmup step to prime cache:
```bash
# Warm index.html and a couple of top assets
curl --fail --silent --show-error --compressed https://your.domain/
curl --fail --silent --show-error --compressed https://your.domain/static/js/main.*.js
curl --fail --silent --show-error --compressed https://your.domain/static/css/main.*.css
```

---

## Why clients won’t see stale/broken content

- Hashed filenames ensure that when content changes, the URL changes. Old HTML references old assets (which remain cached and valid). New HTML (short TTL) references new assets.
- Cloudflare caches assets at the edge with long TTLs; HTML is refreshed quickly to point at the new filenames.
- During cold starts, Cloudflare can serve cached assets (and HTML if previously cached) even if Fly.io machines are warming.

---

## Action List (minimal, safe changes)

1) Frontend
- Keep CRA build. Add precompression in CI after `npm run build` (optional but recommended).
- Ensure `deploy.sh` (or CI) copies `build/` to Nginx image or artifact.

2) Nginx
- Adopt Option A if possible:
  - Copy `build/` into `/usr/share/nginx/html` in the Nginx image.
  - Add the static and HTML locations with the headers above.
  - Enable `gzip_static on;` and `brotli_static on;` (if module present).

3) Cloudflare
- Add Cache Rules for assets, HTML, and API bypass as specified.
- Turn on Tiered Cache and Always Online.

4) Deploy and verify
- Deploy, then verify headers:
```bash
curl -I https://your.domain/static/js/main.<hash>.js | grep -i cache-control
curl -I https://your.domain/ | grep -i cache-control
```
- Validate that Cloudflare cache HITs appear for assets after first fetch.

---

## Implementation Summary

### Files Created/Modified

**Frontend:**
- `frontend/scripts/precompress-assets.sh` - Precompression script for gzip
- `frontend/package.json` - Added `build:with-compression` script

**Nginx:**
- `nginx/Dockerfile.prod` - Updated to copy frontend build
- `nginx/prod.conf` - Added static asset locations with immutable headers, enabled `gzip_static`

**Scripts:**
- `scripts/build-with-static-assets.sh` - Complete build process
- `scripts/warmup-cache.sh` - Cloudflare cache warmup

### Usage Instructions

1. **Build with static assets:**
   ```bash
   ./scripts/build-with-static-assets.sh
   ```

2. **Build Nginx image:**
   ```bash
   docker build -f nginx/Dockerfile.prod -t divemap-nginx nginx/
   ```

3. **Warm up cache (after deployment):**
   ```bash
   DOMAIN=your-domain.com PROTOCOL=https ./scripts/warmup-cache.sh
   ```

### Implementation Status

✅ **COMPLETED:**
- Frontend build with content-hashed filenames
- Precompression script for gzip files
- Nginx configuration with static asset serving
- Docker image build with frontend assets
- Cache warmup script
- Build automation script

🔄 **REMAINING:**
- Cloudflare cache rules configuration
- Production deployment and testing
- Performance monitoring

### Next Steps

1. **Cloudflare Configuration** (Phase 4) - Set up cache rules as specified
2. **Deploy and Test** - Verify headers and cache behavior
3. **Monitor Performance** - Check cache hit rates and cold start improvements

---

## Notes

- If the Brotli module isn't in your Nginx build, `.gz` still helps; Cloudflare re‑compresses to Brotli for clients.
- Keep CSP aligned with any asset hosting changes; in this plan, assets remain same-origin.
- No backend changes are required for content hashing; backend remains behind `/api/`.

---

## Phased Implementation Plan (with Tasks)

### Phase 1 — Plan & Prep

- [x] Decide Nginx strategy: Option A (serve `build/` directly) - **CHOSEN**
- [x] Confirm Nginx Brotli module availability: No Brotli, using `gzip_static` + Cloudflare Brotli - **CHOSEN**
- [ ] Define Cloudflare Cache Rules (assets long‑lived, HTML short‑lived, API bypass).
- [ ] Identify top endpoints and assets to warm post‑deploy.
- [ ] Align CSP/CORS expectations (no external asset host changes required).

### Phase 2 — Frontend Build Changes

- [x] Ensure CRA build runs in CI/CD (already emits hashed filenames) - **COMPLETED**
- [x] Add postbuild precompression step for `.js`, `.css`, `.woff`, `.woff2` (gzip only) - **COMPLETED**
- [x] Publish `build/` as an artifact for Nginx image (Option A - **CHOSEN**) - **COMPLETED**
- [x] Document build outputs (hashed filenames) and verify index.html references them - **COMPLETED**

### Phase 3 — Nginx Configuration & Image

- [x] If Option A: copy `frontend/build/` into Nginx image under `/usr/share/nginx/html` - **CHOSEN**
- [x] Add static locations with immutable headers for assets (`max-age=31536000, immutable`) - **COMPLETED**
- [x] Add short‑lived headers for HTML and SPA fallback (`/index.html`, `stale-while-revalidate=300`) - **COMPLETED**
- [x] Enable `gzip_static on;` (no brotli - **CHOSEN**) - **COMPLETED**
- [x] Keep `/api/` proxy to backend and retain upstream keepalive and timeouts - **COMPLETED**
- [x] Add or keep `/loading.html` for graceful boot behavior - **COMPLETED**

### Phase 4 — Cloudflare Configuration

- [ ] Create Cache Rule: assets (`*.js, *.css, *.woff2, *.png, *.jpg, *.svg`) → Edge TTL 1y, Browser TTL 1y, Respect origin if headers set.
- [ ] Create Cache Rule: HTML (including `/`) → Edge TTL 60–120s, Browser TTL 60s, Respect origin (SWR if origin set).
- [ ] Create Cache Rule: `/api/*` → Bypass cache.
- [ ] Enable Tiered Cache and Always Online; enable "serve stale while origin unreachable" if available.

#### Detailed Cloudflare Setup Instructions

**Step 1: Access Cloudflare Dashboard**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Login with your account credentials
3. Click on your domain name (e.g., `divemap.com`)

**Step 2: Create Cache Rule for Static Assets**
1. Navigate to **"Caching"** → **"Cache Rules"**
2. Click **"Create rule"**
3. Rule name: `Static Assets - Long Cache`
4. Configure Expression:
   - **Field**: `URI Path`
   - **Operator**: `starts with`
   - **Value**: `/static/`
5. Configure Cache Eligibility: **"Eligible for cache"**
6. Configure Edge TTL:
   - **Mode**: `Ignore cache-control header and use this TTL`
   - **TTL Duration**: `1 year`
7. Configure Browser TTL:
   - **Mode**: `Override origin`
   - **TTL Duration**: `1 year`
8. Configure Additional Settings:
   - **Do not serve stale content while updating**: `Off` (allows serving stale content)
   - **Respect Strong ETags**: `On`
9. Click **"Deploy"**

**Step 3: Create Cache Rule for HTML Files**
1. Click **"Create rule"**
2. Rule name: `HTML Files - Short Cache`
3. Configure Expression:
   - **Field**: `URI Path`
   - **Operator**: `equals`
   - **Value**: `/`
4. Configure Cache Eligibility: **"Eligible for cache"**
5. Configure Edge TTL:
   - **Mode**: `Ignore cache-control header and use this TTL`
   - **TTL Duration**: `2 minutes`
6. Configure Browser TTL:
   - **Mode**: `Override origin`
   - **TTL Duration**: `1 minute`
7. Configure Additional Settings:
   - **Do not serve stale content while updating**: `Off` (allows serving stale content)
8. Click **"Deploy"**

**Step 4: Create Cache Rule for SPA Routes**
1. Click **"Create rule"**
2. Rule name: `SPA Routes - Short Cache`
3. Configure Expression:
   - **Field**: `URI Path`
   - **Operator**: `starts with`
   - **Value**: `/dives`
4. Add additional conditions by clicking **"Add condition"**:
   - **Field**: `URI Path`
   - **Operator**: `starts with`
   - **Value**: `/dive-sites`
   - **Logic**: Select **"OR"** (we want to match ANY of these paths)
5. Continue adding conditions for each SPA route with **"OR"** logic:
   - `/diving-centers` (OR)
   - `/profile` (OR)
   - `/help` (OR)
6. Configure Cache Eligibility: **"Eligible for cache"**
7. Configure Edge TTL:
   - **Mode**: `Ignore cache-control header and use this TTL`
   - **TTL Duration**: `2 minutes`
8. Configure Browser TTL:
   - **Mode**: `Override origin`
   - **TTL Duration**: `1 minute`
9. Configure Additional Settings:
   - **Do not serve stale content while updating**: `Off` (allows serving stale content)
10. Click **"Deploy"**

**Step 5: Create Cache Rule for API Endpoints**
1. Click **"Create rule"**
2. Rule name: `API Endpoints - Bypass Cache`
3. Configure Expression:
   - **Field**: `URI Path`
   - **Operator**: `starts with`
   - **Value**: `/api/`
4. Configure Cache Eligibility: **"Bypass cache"**
5. Click **"Deploy"** (no additional settings available for bypass cache)

**Step 6: Create Cache Rule for Health Endpoint**
1. Click **"Create rule"**
2. Rule name: `Health Endpoint - Short Cache`
3. Configure Expression:
   - **Field**: `URI Path`
   - **Operator**: `equals`
   - **Value**: `/health`
4. Configure Cache Eligibility: **"Eligible for cache"**
5. Configure Edge TTL:
   - **Mode**: `Ignore cache-control header and use this TTL`
   - **TTL Duration**: `30 seconds`
6. Configure Browser TTL:
   - **Mode**: `Override origin`
   - **TTL Duration**: `30 seconds`
7. Configure Additional Settings:
   - **Do not serve stale content while updating**: `On` (prevents serving stale content)
8. Click **"Deploy"**

**Step 7: Enable Advanced Cache Features**
1. Navigate to **"Caching"** → **"Configuration"**
2. Enable **"Tiered Cache"**: Toggle **"On"**
3. Enable **"Always Online"**: Toggle **"On"**

**Step 8: Configure Compression**
1. Navigate to **"Speed"** → **"Optimization"**
2. Enable **"Brotli"**: Toggle **"On"**
3. Enable Auto Minify:
   - **JavaScript**: `On`
   - **CSS**: `On`
   - **HTML**: `On`

**Step 9: Configure Security Headers**
1. Navigate to **"Security"** → **"Headers"**
2. Click **"Create rule"**
3. Rule name: `Security Headers`
4. Configure Conditions:
   - **Field**: `URI Path`
   - **Operator**: `starts with`
   - **Value**: `/`
5. Configure Headers:
   - **X-Frame-Options**: `DENY`
   - **X-Content-Type-Options**: `nosniff`
   - **X-XSS-Protection**: `1; mode=block`
   - **Referrer-Policy**: `strict-origin-when-cross-origin`
6. Click **"Deploy"**

**Step 10: Test Configuration**
```bash
# Test static asset caching
curl -I https://your-domain.com/static/js/main.97fc5e21.js
# Expected: CF-Cache-Status: HIT, Cache-Control: public, max-age=31536000, immutable

# Test HTML caching
curl -I https://your-domain.com/
# Expected: CF-Cache-Status: HIT, Cache-Control: public, max-age=120

# Test API bypass
curl -I https://your-domain.com/api/v1/health
# Expected: CF-Cache-Status: DYNAMIC

# Test SPA routes
curl -I https://your-domain.com/dives
# Expected: CF-Cache-Status: HIT, Cache-Control: public, max-age=120
```

**Step 11: Monitor Performance**
1. Navigate to **"Analytics"** → **"Web Analytics"**
2. Monitor key metrics:
   - Cache hit ratio (should be 80-95% for static assets)
   - Response times
   - Bandwidth savings (should be 60-80%)

**Expected Results:**
- ✅ Static assets: Cached for 1 year at edge
- ✅ HTML files: Cached for 2 minutes at edge
- ✅ SPA routes: Cached for 2 minutes at edge
- ✅ API calls: Bypass cache completely
- ✅ Health endpoint: Cached for 30 seconds
- ✅ Compression: Brotli + Gzip working
- ✅ Cold starts: Much faster (assets served from edge)

### Phase 5 — Warmup & Release Flow

- [x] Add deploy warmup step to fetch `/`, `main.*.js`, and `main.*.css` (compressed) to prime cache - **COMPLETED**
- [x] If using Fly, add `release_command` warmup or a one‑shot job during deploy - **COMPLETED**
- [ ] Avoid purging hashed assets; purge only HTML if necessary.
- [ ] Announce change window and rollback plan.

### Phase 6 — Verification & Monitoring

- [ ] Verify headers at origin and via Cloudflare (check `Cache-Control`, `CF-Cache-Status`).
- [ ] Confirm `.gz`/`.br` are served when supported (`Content-Encoding`).
- [ ] Validate SPA routing and `/api/` bypass caching.
- [ ] Observe first‑hit vs subsequent‑hit latency and edge cache hit rates.
- [ ] Document any deviations and finalize runbooks.
