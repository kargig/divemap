# Specification: Anonymous User Promos & PWA/TWA Targeting System

## Status: Approved
## Date: 2026-07-13

---

## 🗺️ Overview & Goals
The objective of this feature is to improve user adoption and registration rates on the Divemap platform by strategically prompting anonymous visitors. Rather than displaying intrusive, blocking overlays immediately upon landing, the system employs a gentle, conversion-oriented targeting framework based on user behavior and platform characteristics.

### Key Goals:
1. **Engagement-first (The Three-Page Rule):** Only show promos after a visitor has visited at least 3 pages in their current session, ensuring they are engaged and interested.
2. **Platform-Tailored CTAs:**
   - **Android Mobile Browser:** Prioritize PWA app installation by intercepting and presenting the native installation prompt.
   - **iOS Safari Browser:** Show a clear, floating bubble tooltip pointing to the Safari share menu guiding them on how to "Add to Home Screen".
   - **Desktop/Tablet:** Display a slim, elegant banner nudging them to create a free account to track dives, certifications, and find buddies.
3. **Suppression for Logged-In Users:** Completely suppress all promos and in-feed cards if a user is logged in.
4. **Suppression inside Standalone Mode:** Suppress installation banners if the application is already running in `standalone` (installed PWA/TWA) mode.
5. **Native In-Feed Promo Cards:** Conditionally inject stylized card prompts directly inside high-traffic feed layouts (e.g., Dive Sites Explorer list), blending seamlessly with standard content.
6. **Progressive Fallback Dismissal (User Control):** Respect the user's decision with a progressive display gap. When dismissed, the banner is hidden and only displayed again at specific cumulative page views:
   - Initial View: Renders on page view 3.
   - Dismissal 1: Re-appears at cumulative page view 7.
   - Dismissal 2: Re-appears at cumulative page view 12.
   - Dismissal 3: Re-appears at cumulative page view 18.
   - Dismissal 4: Re-appears at cumulative page view 25.
   - Dismissal 5: Stopped displaying completely (permanent suppression).
   - *Note:* Session page views (resetting per tab) must be `>= 3` for any reappearances to prevent immediate spamming on new session loads.

---

## 📱 Platform Detection & Targeting Matrix

All platform and eligibility checks are performed client-side. We utilize a combination of user-agent parsing, media queries, document referrers, and URL parameters to segment visitors:

### 1. Platform Detection Rules

```javascript
// Check if the application is running in installed / standalone mode
const isStandalone = 
  window.matchMedia('(display-mode: standalone)').matches || 
  window.navigator.standalone === true;

// Basic OS checks
const isAndroid = /Android/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isMobile = isAndroid || isIOS || /Mobi|Android/i.test(navigator.userAgent);
```

### 2. Manifest Tracking Adjustments (First-Load Referrer)
To accurately track and separate Web PWA launches from Play Store Android TWA launches, we configure the start URLs in the respective manifests to contain query parameters:
- **Web PWA Manifest (`frontend/vite.config.mjs`):** `start_url: "/?utm_source=pwa"`
- **Android TWA Manifest (`divemap-android/twa-manifest.json`):** `"startUrl": "/?utm_source=android-twa"`

When the application mounts, if the query contains `utm_source`, we store the platform string in `sessionStorage` and sanitise the browser address bar immediately:
```javascript
const urlParams = new URLSearchParams(window.location.search);
const utmSource = urlParams.get('utm_source');
if (utmSource === 'android-twa' || utmSource === 'pwa') {
  sessionStorage.setItem('divemap_platform', utmSource);
  window.history.replaceState({}, document.title, window.location.pathname);
}
```

### 3. Segment Matrix

| Segment | `isStandalone` | `isAndroid` | `isIOS` | Eligibility Trigger | visual Presentation | CTA Action |
|:---|:---|:---|:---|:---|:---|:---|
| **Desktop / General** | `false` | `false` | `false` | `pageViewCount >= 3` | Bottom Slide-in Slim Banner | Redirect to `/register` |
| **Android Mobile Browser** | `false` | `true` | `false` | `pageViewCount >= 3` | Bottom Slide-in Banner with Install CTA | Triggers PWA install prompt |
| **iOS Safari Browser** | `false` | `false` | `true` | `pageViewCount >= 3` | Anchored Bubble Tooltip pointing to share menu | Shows overlay instruction modal on click |
| **Installed Web PWA** | `true` | `any` | `any` | *Suppressed* | None | None |
| **Installed Android TWA**| `true` | `true` | `false` | *Suppressed* | None | None |
| **Logged-In User** | `any` | `any` | `any` | *Suppressed* | None | None |

---

## 🎨 Component Architecture

We will implement two modular, self-contained components within the frontend:

```
frontend/src/
├── components/
│   ├── PromoBannerManager.jsx         # Manages tracking state, event listeners, and renders bottom banners/tooltips.
│   └── ui/
│       └── InFeedPromoCard.jsx        # Custom native-styled inline promotional card injected in list views.
```

### 1. `PromoBannerManager.jsx`
This component will wrap the global banner rendering. It executes silently at the bottom of the layout inside `AppContent()` in `App.jsx`.

- **State Managed:**
  - `pageViewCount` (read/write from `sessionStorage` to track current session views, trigger requires `>= 3`).
  - `cumulativePageViewCount` (read/write from `localStorage` to track lifetime pages browsed across sessions).
  - `dismissalCount` (read/write from `localStorage` to track total times the user dismissed the banner, max 5).
  - `nextEligibleCumulativePageView` (read/write from `localStorage` storing the minimum cumulative page view count required to display again).
  - `deferredPrompt` (stores the browser's native `beforeinstallprompt` event).
  - `activePlatform` (detected OS/browser platform).
- **Behavior:**
  - Listens to React Router's `useLocation()` to increment `pageViewCount` on route changes.
  - Listens to `window.addEventListener('beforeinstallprompt', (e) => { ... })` to capture the native installation hook.
  - Listens to `window.addEventListener('appinstalled', () => { ... })` to dynamically clean up state and banners upon successful install.

### 2. `InFeedPromoCard.jsx`
A stylized, responsive card component that matches the padding, border, shadow, and aspect-ratio parameters of a normal `DiveSiteCard` (`DiveSiteCard.jsx`).
- **Insertion Strategy:** Rendered conditionally inside high-traffic feed files:
  - `DiveSites.jsx` (Dive Sites Explorer list and grid feeds)
  - `Dives.jsx` (Public Dive Logs list feed)
  - `DivingCenters.jsx` (Diving Centers list feed)
  - `DiveRoutes.jsx` (Dive Routes list feed)
  - *Example in list rendering:*
    ```jsx
    {items.map((item, index) => (
      <React.Fragment key={item.id}>
        <ItemCard item={item} />
        {shouldShowFeedPromo && (index - 2) % 15 === 0 && (
          <InFeedPromoCard platform={eligibility.platform} />
        )}
      </React.Fragment>
    ))}
    ```

---

## 📐 Layout & Visual Design

To guarantee cohesive, pixel-perfect layouts, we strictly adhere to the project's styling and mobile-first guidelines:

### A. Bottom-Sticky Slim Banner (Desktop & Android Browser)
- **Container Styling:** Sticky footer wrapper, high-contrast borderless circle for the close button, and optimized padding.
  - Desktop: `max-w-[450px] fixed bottom-6 right-6 z-[999]` (A floating side-card format).
  - Mobile: `fixed bottom-0 left-0 right-0 z-[999] border-t border-gray-100 rounded-none` (Maximized lateral space).
- **Visuals:** Background uses `bg-gradient-to-r from-divemap-surface to-white` with a brand-standard deep blue accent `border-l-4 border-divemap-blue` to feel premium.
- **Typography:** DM Sans, text sizes clamped properly (`text-sm` for mobile, `text-base` for desktop).

### B. iOS Safari Pulsing Tooltip
- **Positioning:** Fixed at the bottom-center of the screen, floating exactly `20px` above the bottom edge.
  - `fixed bottom-5 left-1/2 -translate-x-1/2 max-w-[90vw] w-[350px] z-[999]`
- **Design:** Styled as a speech bubble using a CSS triangular arrow (`after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-divemap-blue`).
- **Interaction:** Includes a subtle vertical bouncing/pulsing animation (`animate-bounce-gentle`).

### C. iOS Step-by-Step Guidance Modal
When an iOS user clicks `[ How to Install ]` on either a banner or an in-feed card, a beautiful modal overlay appears displaying:
1. **Step 1:** Tap Safari's share button `📤` (usually located at the bottom-center of Safari).
2. **Step 2:** Scroll down and select **"Add to Home Screen"** `➕`.

---

## 🧪 Testing & Validation Plan

We will verify both behavioral routing and platform mock scenarios:

1. **State & Dismissal Logic Tests:**
   - Assert `pageViewCount` is correctly stored in `sessionStorage` and increments on route transition.
   - Assert progressive dismissal offsets calculate correctly on dismissal mapping to cumulative targets (7, 12, 18, 25).
   - Assert `dismissalCount` increments on dismissal, and that once it reaches 5, the banner is permanently suppressed.
   - Assert that if `cumulativePageViewCount < nextEligibleCumulativePageView`, the banner remains suppressed even if the session page count is `>= 3`.
   - Assert that logging in immediately unmounts/suppresses all banners and promotional cards.
2. **Platform Verification:**
   - Override/Mock `navigator.userAgent` to verify layout differences across:
     - Android Mobile
     - iOS Safari
     - Desktop Chrome/Safari
3. **PWA Install Flow Verification:**
   - Dispatch a mock `beforeinstallprompt` event programmatically to ensure the `[ Install App ]` button is activated and successfully calls `.prompt()` upon click.
4. **Visual Quality Check:**
   - Run our standard `make lint-frontend` linter rules.
   - Load the modified routes in Chrome DevTools to inspect responsive scaling and confirm that **zero horizontal scrolling** occurs on narrow mobile screens (320px - 412px viewport width).
