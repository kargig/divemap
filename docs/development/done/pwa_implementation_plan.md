# PWA Implementation Plan for Divemap (Android Focus)

## Executive Summary

The Divemap application currently possesses a basic `manifest.json` but lacks the critical **Service
Worker** infrastructure required to function as a Progressive Web Application (PWA). To enable Android
installation (Add to Home Screen), offline capabilities, and a native-app-like experience, we must
integrate the `vite-plugin-pwa` library.

**Current Status:**
*   ✅ Basic Manifest (Name, Icons, Colors).
*   ✅ HTTPS (Production environment).
*   ❌ Service Worker (Crucial for installability and offline support).
*   ❌ Rich Install UI (Screenshots and detailed description missing from manifest).
*   ❌ Offline Fallback.

---

## 1. Technical Requirements & Dependencies

We will utilize **`vite-plugin-pwa`**. This plugin abstracts the complexity of Workbox (Google's PWA library) and integrates seamlessly with the Vite build process.

### New Dependencies
*   `vite-plugin-pwa`: Main plugin for PWA generation and manifest management.
*   `workbox-window`: Helper library for handling Service Worker updates and lifecycle events within
the React application.

---

## 2. Implementation Strategy

### Phase 1: Configuration (`frontend/vite.config.js`)

We will integrate the PWA plugin into the Vite configuration. This plugin will take over the
management of the `manifest.json`, ensuring better asset cache-busting and automatic generation of the
Service Worker.

**Key Configurations:**
*   **Strategy:** `generateSW` - Automatically caches all build assets (JS, CSS, HTML).
*   **RegisterType:** `prompt` - Notifies the user when a new version of the app is available,
allowing them to reload when convenient. This prevents data loss if a user is in the middle of a task.
*   **Manifest Injection:** The plugin will generate the manifest dynamically. Content will be
migrated from the static `public/manifest.json`.

### Phase 2: Manifest Enhancement (Android Specifics)

To trigger the **Rich Install UI** on Android (Play Store style installation dialog), the manifest
needs specific enhancements.

**Required Additions:**
1.  **`id`**: A stable identifier for the application (e.g., `/`).
2.  **`screenshots`**: Utilization of existing images in `public/help-screenshots/`.
    *   *Requirement:* At least one mobile (narrow) and one desktop (wide) screenshot.
3.  **`categories`**: Defined as `["travel", "sports", "navigation"]`.
4.  **`description`**: A descriptive summary for the installation dialog.
5.  **`purpose: "any maskable"`**: Added to icon definitions to support Android adaptive icons,
preventing white borders.

### Phase 3: Service Worker Registration
The Service Worker must be registered in the application entry point to enable PWA features.

**Logic Flow:**
1.  Import registration logic from the PWA plugin.
2.  Implement a UI component (Toast/Modal) to handle the "New Content Available" state.
3.  Call the registration function in `src/index.js`.

---

## 3. Detailed Specifications

### A. Dependency Installation
```bash
docker exec divemap_frontend npm install vite-plugin-pwa workbox-window -D
```

### B. Updated `vite.config.js` Snippet
```javascript
import { VitePWA } from 'vite-plugin-pwa';

// Add to plugins array:
VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicons/*.ico', 'favicons/*.png', 'help-screenshots/*.png'],
  manifest: {
    name: 'Divemap - Scuba Dive Site Review Platform',
    short_name: 'Divemap',
    description: 'Discover, rate and review dive sites and diving centers.',
    theme_color: '#2563eb',
    background_color: '#ffffff',
    display: 'standalone',
    id: '/',
    icons: [
      {
        src: '/favicons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/favicons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    screenshots: [
      {
        src: "/help-screenshots/dive-sites-map-view.png",
        sizes: "1280x720", // Confirm actual dimensions
        type: "image/png",
        form_factor: "wide",
        label: "Explore Dive Sites"
      },
      {
        src: "/help-screenshots/dives-logging-interface.png",
        sizes: "1280x720",
        type: "image/png",
        label: "Log Your Dives"
      }
    ]
  }
})
```

### C. Registration Component (`src/components/PWAUpdater.jsx`)
A small component to handle the update logic and provide user feedback.

---

## 4. Verification Plan

1.  **Lighthouse Audit:**
    *   Execute Chrome DevTools -> Lighthouse -> "Progressive Web App".
    *   Target: 100% PWA score.
2.  **Manifest Validation:**
    *   Verify through Chrome DevTools -> Application -> Manifest.
    *   Ensure no warnings for icons or screenshots.
3.  **Service Worker Test:**
    *   Check Status: "Activated and is running".
    *   **Offline Mode:** Enable offline in the Network tab and reload the page. The app must load from cache.
4.  **Android Device Testing:**
    *   Access the site via Chrome on Android.
    *   Verify the installation prompt appears.
    *   Confirm the app functions without the browser UI (address bar).

## 5. Deployment Considerations
*   **SW Updates:** Ensure `sw.js` is served with `Cache-Control: no-cache`.
*   **Static Manifest:** Delete the existing `frontend/public/manifest.json` once the PWA plugin is fully configured to avoid conflicts.

## 6. User Verification Guide

To manually verify the PWA functionality, you must serve the **production build**, as the Service Worker and Manifest are generated during the build process (unless `devOptions` is enabled).

### Step 1: Build and Serve
Run the following commands from the project root:

```bash
# 1. Build the frontend
docker exec divemap_frontend npm run build

# 2. Serve the 'dist' folder locally (using Python for simplicity)
# This serves the application on http://localhost:4173
python3 -m http.server 4173 --directory frontend/dist
```

### Step 2: Verify in Chrome
1.  Open Chrome and navigate to `http://localhost:4173`.
2.  **Manifest Check:**
    *   Open DevTools (`F12`).
    *   Go to **Application** tab > **Manifest**.
    *   Verify the App Name, Icons, and Screenshots ("Wide" and "Mobile") are present.
    *   Ensure there are no errors/warnings.
3.  **Service Worker Check:**
    *   Go to **Application** tab > **Service Workers**.
    *   Verify you see a worker for `http://localhost:4173`.
    *   Status should be **"Activated and is running"**.
4.  **Installability:**
    *   Look for the "Install" icon in the right side of the URL bar (Omnibox).
    *   Click it to see the "Rich Install UI" with the screenshots we configured.

### Step 3: Cleanup
Press `Ctrl+C` in your terminal to stop the Python server.

