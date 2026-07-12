# Markdown Content Negotiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Markdown for Agents" specification by intercepting `Accept: text/markdown` requests and serving accurate, token-counted Markdown documents.

**Architecture:** Nginx will intercept the `Accept: text/markdown` header and rewrite the request to a new FastAPI endpoint (`/api/v1/agent/negotiate/{path}`). The FastAPI endpoint will read the corresponding Markdown file from `llm_content/`, lazily load `tiktoken` to count the exact tokens (caching the result), and return the document with the required `x-markdown-tokens` and `Content-Type: text/markdown` headers.

**Tech Stack:** FastAPI, Nginx, tiktoken

---

### Task 1: Add Dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add tiktoken to requirements**
Add `tiktoken>=0.7.0` to the end of the `backend/requirements.txt` file.

```text
tiktoken>=0.7.0
```

- [ ] **Step 2: Commit**
```bash
git add backend/requirements.txt
# Do not commit immediately, prepare for manual user commit as per instructions.
```

### Task 2: Create the Agent Router

**Files:**
- Create: `backend/app/routers/agent.py`

- [ ] **Step 1: Write the router implementation**
Create `backend/app/routers/agent.py` with the following content. Notice the lazy import of `tiktoken` inside the token counting function to save memory on startup.

```python
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
import os
import time
from functools import lru_cache

router = APIRouter()

# Map requested paths to local markdown files
PATH_MAP = {
    "": "llms.txt",
    "/": "llms.txt",
    "dive-sites": "dive-sites.md",
    "diving-centers": "diving-centers.md",
    "dives": "dives.md",
    "dive-routes": "dive-routes.md"
}

@lru_cache(maxsize=10)
def _count_tokens_cached(file_path: str, mtime: float) -> str:
    """
    Reads the file and counts tokens using tiktoken.
    The mtime parameter ensures the cache is invalidated if the file changes.
    Tiktoken is imported lazily to avoid loading large dictionaries into memory 
    for worker processes that never serve agent traffic.
    """
    try:
        import tiktoken
    except ImportError:
        # Fallback heuristic if tiktoken is not installed
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return str(len(content) // 4)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = len(enc.encode(content, disallowed_special=()))
    return str(tokens)

@router.get("/negotiate/{path:path}")
async def negotiate_markdown(request: Request, path: str):
    """
    Serves markdown files to AI agents based on the requested path.
    Includes exact token counts for context window management.
    """
    # Clean the path
    clean_path = path.strip("/")
    
    # Check if the requested path corresponds to a known top-level markdown resource.
    # If the user asks for /dive-sites/123, we still serve the dive-sites.md catalog.
    mapped_file = "llms.txt" # Default to homepage
    for key, filename in PATH_MAP.items():
        if key and clean_path.startswith(key):
            mapped_file = filename
            break

    # Determine full path
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "llm_content"))
    file_path = os.path.join(base_dir, mapped_file)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Markdown representation not found.")

    # Get file modification time for cache invalidation
    mtime = os.path.getmtime(file_path)
    
    # Get exact token count (cached)
    token_count = _count_tokens_cached(file_path, mtime)

    # Read content
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Build response with required agent headers
    headers = {
        "x-markdown-tokens": token_count,
        "Cache-Control": "public, max-age=300",
        "Vary": "Accept"
    }

    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers=headers
    )
```

### Task 3: Update Main App

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add lazy loading function**
Add the `load_agent_router` function and integrate it into `lazy_router_loading`.

```python
# Add this near the other load_*_router functions
def load_agent_router():
    """Load agent router lazily when first accessed"""
    if not hasattr(app, '_agent_router_loaded'):
        print("🔧 Loading agent router lazily...")
        router_start = time.time()

        from app.routers import agent
        app.include_router(agent.router, prefix="/api/v1/agent", tags=["Agent Content Negotiation"])

        app._agent_router_loaded = True
        router_time = time.time() - router_start
        print(f"✅ Agent router loaded lazily in {router_time:.2f}s")
```

- [ ] **Step 2: Update middleware**
Add the trigger to the `lazy_router_loading` middleware in `main.py`:

```python
    # Load agent router
    if (path.startswith("/api/v1/agent") or is_docs) and not hasattr(app, '_agent_router_loaded'):
        load_agent_router()
```

### Task 4: Configure Nginx Routing

**Files:**
- Modify: `nginx/dev.conf`
- Modify: `nginx/prod.conf`

- [ ] **Step 1: Update Nginx configs**
In both `nginx/dev.conf` and `nginx/prod.conf`, modify the `location /` block to intercept the `Accept: text/markdown` header.

Add this logic *inside* the `location /` block, before `try_files`:

```nginx
        # SPA routing - serve index.html for all other routes
        location / {
            # Markdown Content Negotiation for AI Agents
            if ($http_accept ~* "text/markdown") {
                rewrite ^/(.*)$ /api/v1/agent/negotiate/$1 break;
                proxy_pass http://backend;
            }

            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            # ... existing headers ...
```

- [ ] **Step 2: Restart Services**
Run `docker-compose down && docker-compose up -d --build nginx backend` to apply changes.

### Task 5: Validation

- [ ] **Step 1: Test the endpoint**
Run `curl -sI -H "Accept: text/markdown" http://localhost/`
Expected output must include:
- `HTTP/1.1 200 OK`
- `content-type: text/markdown; charset=utf-8`
- `x-markdown-tokens: [number]`

- [ ] **Step 2: Test deep link**
Run `curl -sI -H "Accept: text/markdown" http://localhost/dive-sites`
Expected output must be similar to above, proving it routes to `dive-sites.md`.
