# API Catalog (RFC 9727) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `api-catalog` agent skill by serving a compliant `linkset+json` file at `/.well-known/api-catalog` to facilitate automated API discovery.

**Architecture:** Since Nginx is already configured to serve `/.well-known/` statically from `frontend/public/.well-known/` (e.g., for `assetlinks.json`), the most robust and performant approach is to serve `api-catalog` as a static file rather than proxying a `.well-known` route to the Python backend. Nginx will be updated to return the required `Content-Type: application/linkset+json` for this specific file.

**Tech Stack:** Static JSON, Nginx

---

### Task 1: Create the Static API Catalog File

**Files:**
- Create: `frontend/public/.well-known/api-catalog`

- [ ] **Step 1: Write the Linkset JSON file**
Create the file `frontend/public/.well-known/api-catalog` (no file extension, to exactly match the RFC route). Include the core Divemap API details mapping to the OpenAPI spec, documentation, and health endpoints.

```json
{
  "linkset": [
    {
      "anchor": "https://divemap.gr/api/v1/",
      "service-desc": [
        {"href": "https://divemap.gr/openapi.json", "type": "application/vnd.oai.openapi+json;version=3.1.0"}
      ],
      "service-doc": [
        {"href": "https://divemap.gr/docs", "type": "text/html"}
      ],
      "status": [
        {"href": "https://divemap.gr/api/v1/health", "type": "application/json"}
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit the file**
```bash
git add frontend/public/.well-known/api-catalog
git commit -m "feat: add static api-catalog for RFC 9727 discovery"
```

### Task 2: Configure Nginx Content-Type

**Files:**
- Modify: `nginx/dev.conf`
- Modify: `nginx/prod.conf`

**Context:** By default, Nginx serves extensionless files as `application/octet-stream`. We must force `application/linkset+json` for this file to satisfy the skill validation.

- [ ] **Step 1: Update dev.conf**
In `nginx/dev.conf`, locate the `.well-known` block and add an exact location match for the `api-catalog`.

```nginx
        # Allow access to .well-known (for Let's Encrypt, Apple/Android App Links, etc.)
        location = /.well-known/api-catalog {
            root /usr/share/nginx/html;
            add_header Content-Type "application/linkset+json" always;
            allow all;
        }

        location ^~ /.well-known/ {
            root /usr/share/nginx/html;
            allow all;
        }
```

- [ ] **Step 2: Update prod.conf**
In `nginx/prod.conf`, apply the exact same configuration as in Step 1.

```nginx
        # Allow access to .well-known (for Let's Encrypt, Apple/Android App Links, etc.)
        location = /.well-known/api-catalog {
            root /usr/share/nginx/html;
            add_header Content-Type "application/linkset+json" always;
            allow all;
        }

        location ^~ /.well-known/ {
            root /usr/share/nginx/html;
            allow all;
        }
```

- [ ] **Step 3: Commit Nginx changes**
```bash
git add nginx/dev.conf nginx/prod.conf
git commit -m "chore: configure Nginx to serve api-catalog with linkset Content-Type"
```

### Task 3: Verification

- [ ] **Step 1: Restart Nginx locally**
```bash
docker-compose down && docker-compose up -d --build nginx
```

- [ ] **Step 2: Verify Endpoint and Headers**
```bash
curl -sI http://localhost/.well-known/api-catalog
```
**Expected Output:**
- `HTTP/1.1 200 OK`
- `Content-Type: application/linkset+json`

- [ ] **Step 3: Verify Content**
```bash
curl -s http://localhost/.well-known/api-catalog | grep "linkset"
```
**Expected Output:** The JSON payload defined in Task 1.