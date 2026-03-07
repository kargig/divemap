---
name: debug-pwa-routing
description: Diagnoses and fixes routing conflicts between the Frontend PWA Service Worker and Backend/Nginx endpoints in the Divemap project. Also handles Workbox and Manifest loading errors. Use when a URL works via curl but fails in the browser, or when seeing Manifest Syntax Errors.
---

# Debugging PWA and Manifest Routing

This skill provides instructions for handling common routing issues related to the Progressive Web App (PWA) setup, Service Workers (Workbox), and Web Manifests in the Divemap application.

## Manifest Syntax Errors

If the browser console shows:
`Manifest: Line: 1, column: 1, Syntax error.`

**The Problem:**
This occurs when the Vite PWA plugin is disabled (e.g., in development mode), causing Nginx to fall back to serving the `index.html` file for the `/manifest.webmanifest` route. The browser expects a JSON file but receives HTML, leading to a syntax error.

**The Fix:**
Ensure that Nginx explicitly intercepts requests for the manifest when it doesn't exist and returns an empty JSON object with the correct content type.

In `nginx/dev.conf`:

```nginx
        # Web Manifest - Correct Content-Type and MUST NOT be cached
        location = /manifest.webmanifest {
            proxy_pass http://frontend/manifest.webmanifest;
            proxy_set_header Host $host;
            proxy_intercept_errors on;
            error_page 404 = /empty-manifest.json;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Content-Type application/manifest+json;
            expires off;
        }

        location = /empty-manifest.json {
            return 200 '{}';
            add_header Content-Type application/manifest+json;
        }
```

## Workbox Debug Logs

Logs like `workbox Using CacheFirst to respond to...` or `workbox The navigation route is not being used...` are **informational debug logs** produced by the Workbox library when the site is running in development mode.

These logs are harmless and indicate the Service Worker is deciding how to route requests. They do not require a fix.

## General PWA Routing Rules

Always ensure that backend API routes, static assets, and dynamic backend content (like sitemaps or LLM text files) are excluded from the PWA's `navigateFallback` catch-all in `vite.config.js`. If the PWA intercepts an API call, it will incorrectly serve the React `index.html` instead of the JSON data.