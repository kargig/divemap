# Cloudflare Workers & R2 Storage Guide

Divemap utilizes Cloudflare Workers and R2 Object Storage to serve static assets directly from the edge. This entirely bypasses the Fly.io infrastructure, meaning zero compute cost for serving these files, instant global delivery, and high availability.

Currently, we maintain two active workers:
1. **LLM Content Worker** (`divemap-llm-worker`)
2. **Presentations Worker** (`divemap-presentations-worker`)

---

## 1. Presentations Worker (`divemap-presentations-worker`)

### Purpose
Intercepts any request to `https://divemap.gr/presentations/*` and serves the file directly from the `divemap-presentations` R2 bucket. It applies an aggressive 1-year cache control header (`max-age=31536000, immutable`), which is ideal for published PDFs and slide decks.

### How to Upload a New Presentation
To host a new presentation (e.g., `my_slides.pdf`), you must upload it to the R2 bucket using the Wrangler CLI.

1. Ensure you are authenticated with Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Upload the file to the remote bucket:
   ```bash
   # Syntax: npx wrangler r2 object put <bucket-name>/<destination-name> --file <local-file> --content-type "<mime-type>" --remote
   
   npx wrangler r2 object put divemap-presentations/my_slides.pdf \
     --file ./my_slides.pdf \
     --content-type "application/pdf" \
     --remote
   ```
3. The file is instantly available at: `https://divemap.gr/presentations/my_slides.pdf`

*Note: The `--remote` flag is critical. Without it, Wrangler will default to uploading to a local development emulator instead of the actual Cloudflare cloud.*

### How to Update the Worker Code
If you need to change the caching headers or add new logic to the worker itself:

1. Navigate to the worker directory:
   ```bash
   cd divemap-presentations-worker/
   ```
2. Modify `src/index.js` or `wrangler.toml`.
3. Deploy the changes to Cloudflare:
   ```bash
   npx wrangler deploy
   ```

---

## 2. LLM Content Worker (`divemap-llm-worker`)

### Purpose
Intercepts requests for AI crawler files (`/llms.txt`, `/sitemap.xml`, `/dive-sites.md`, etc.) and serves them from the `divemap-prod` R2 bucket. It applies a 24-hour `stale-while-revalidate` cache. This protects the FastAPI backend from being hammered by aggressive AI scrapers.

### How Content is Updated (Automated)
Unlike the presentations worker, you **do not** manually upload files for the LLM worker.

The content is generated and uploaded automatically by the backend script `backend/generate_static_content.py`. 
- This script pulls the latest data from the MySQL database.
- It formats the data into Markdown.
- It uses the `boto3` (S3 compatible) client to upload the files directly to the `divemap-prod` R2 bucket under the `llm_content/` prefix.

### How to Force a Content Update
To manually refresh the data served by the worker:
1. SSH into the production backend or run the script locally against the production database:
   ```bash
   cd backend/
   python generate_static_content.py
   ```
2. *Optional:* If you need the changes to appear instantly (bypassing the 24-hour edge cache), you must purge the Cloudflare cache for those specific URLs via the Cloudflare Dashboard.

### How to Update the Worker Code
1. Navigate to the worker directory:
   ```bash
   cd divemap-llm-worker/late-moon-cc3c/
   ```
2. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
3. Modify `src/index.ts` or `wrangler.jsonc`.
4. Deploy the changes:
   ```bash
   npx wrangler deploy
   ```

---

## Troubleshooting

- **404 Not Found on R2 Uploads:** Ensure you used the `--remote` flag when running `wrangler r2 object put`.
- **PWA Interception:** If the Divemap PWA is installed on a device, the Service Worker might try to intercept the request and return the React app (`index.html`) instead of the PDF. Ensure the path (e.g., `/^\/presentations\/?.*$/`) is included in the `navigateFallbackDenylist` array within `frontend/vite.config.mjs`.
- **Worker Not Intercepting:** Check the `routes` array in the worker's `wrangler.toml`/`wrangler.jsonc` file. It must exactly match the domain (e.g., `divemap.gr/presentations/*`).
