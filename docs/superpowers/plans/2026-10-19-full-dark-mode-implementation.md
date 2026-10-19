# Full Dark Mode & Theme Preference System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a first-class, accessible dark theme alongside the existing light theme with a three-way user choice (`system`, `light`, `dark`), persistent `localStorage` caching, zero FOUC, Ant Design & `antd-mobile` synchronization, dark basemap tiles, and high-contrast WCAG AA/AAA data visualizations.

**Architecture:** A lightweight `ThemeContext` manages the user preference and resolved theme, synchronizing `document.documentElement` (`class="dark"` and `data-prefers-color-scheme="dark"`). An inline `<script>` in `index.html` prevents white flashes before React hydrates. Both desktop Ant Design (`theme.darkAlgorithm`) and `antd-mobile` are kept in lockstep. Interactive maps default to ESRI Dark Gray Canvas under dark theme with full layer-switcher freedom.

**Tech Stack:** React 18, Tailwind CSS v3 (`darkMode: 'class'`), Ant Design (`antd`), Ant Design Mobile (`antd-mobile`), Leaflet / React-Leaflet, Recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-full-dark-mode-design.md`

## Global Constraints

- **Non-destructive:** Light mode must remain completely intact without visual regression.
- **Tailwind Mode:** `darkMode: 'class'` in `tailwind.config.js` is strictly required; never revert to `media` mode.
- **Zero FOUC:** Dark mode must activate before initial HTML render when saved in `localStorage` or requested by system.
- **No Direct Commits:** Prepare commit messages in `commit-message.txt`; never execute `git add` or `git commit` directly.
- **Browser & Console Verification:** Every page modification must be verified via Chrome DevTools MCP with zero console errors.

## Review Focus

1. **FOUC on Reload:** Hard reload on a dark preference must never display a flash of white background.
2. **`antd-mobile` Drawer Glare:** Mobile navigation drawer must render with dark surfaces, not default white.
3. **Turnstile Widget Mismatch:** Cloudflare Turnstile must match active dark theme rather than rendering a white box.
4. **Recharts Tooltip Inversion:** Dive profile charts and analytics tooltips must not render dark text on dark tooltip backgrounds or white rectangles over dark charts.
5. **Leaflet Popup Tip & Box:** Leaflet marker popups must render with dark slate backgrounds and matching dark pointing tips.

---

### Task 1: Core Theme Engine, Bootstrap & Dual-UI Providers

**Files:**
- Create: `frontend/src/contexts/ThemeContext.jsx`
- Create: `frontend/src/contexts/ThemeContext.test.jsx`
- Modify: `frontend/index.html:12-25`
- Modify: `frontend/src/App.jsx:1-60, 205-230`

**Interfaces:**
- Produces: `useTheme() -> { theme: 'system'|'light'|'dark', resolvedTheme: 'light'|'dark', setTheme: (theme) => void }`
- Produces: `ThemeProvider` wrapping the React application root.

- [x] **Step 1: Write unit tests for `ThemeContext`**
  Cover initial state from `localStorage`, fallback to `'system'`, media query listener changes, setting new theme, and updating DOM attributes (`classList.add('dark')` and `setAttribute('data-prefers-color-scheme', 'dark')`).

- [x] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- run src/contexts/ThemeContext.test.jsx`
  Expected: FAIL with "Cannot find module './ThemeContext'".

- [x] **Step 3: Implement `ThemeContext.jsx`**
  Implement `ThemeContext`, `ThemeProvider`, and `useTheme()`. Listen to `(prefers-color-scheme: dark)` changes when `theme === 'system'`.

- [x] **Step 4: Update `index.html` with zero-flicker script**
  Add inline `<script>` in `<head>` setting `classList.add('dark')` and `setAttribute('data-prefers-color-scheme', 'dark')` before React mounts.

- [x] **Step 5: Integrate `ThemeProvider` and Ant Design `ConfigProvider` in `App.jsx`**
  Wrap `AppContent` with `ThemeProvider` and dynamic Ant Design `<ConfigProvider theme={{ algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, token: ... }}>`. Add `dark:bg-slate-900` to the root container.

- [x] **Step 6: Run tests to verify they pass**
  Run: `cd frontend && npm test -- run src/contexts/ThemeContext.test.jsx`
  Expected: PASS

---

### Task 2: Desktop Navbar, Mobile Drawer & Settings Controls

**Files:**
- Create: `frontend/src/components/ThemeToggle.jsx`
- Create: `frontend/src/components/ThemeToggle.test.jsx`
- Modify: `frontend/src/components/NavbarDesktopControls.jsx:1-50, 180-230`
- Modify: `frontend/src/components/NavbarMobileControls.jsx:1-60, 320-370`
- Modify: `frontend/src/pages/Profile.jsx:300-360`

**Interfaces:**
- Consumes: `useTheme` from `../contexts/ThemeContext`
- Produces: `ThemeToggle` desktop dropdown button and mobile segmented pill.

- [x] **Step 1: Write unit tests for `ThemeToggle`**
  Verify clicking options updates `setTheme('light')`, `setTheme('dark')`, `setTheme('system')` and renders correct active checkmark.

- [x] **Step 2: Run test to verify it fails**
  Run: `cd frontend && npm test -- run src/components/ThemeToggle.test.jsx`
  Expected: FAIL.

- [x] **Step 3: Implement `ThemeToggle.jsx`**
  Build desktop adaptive icon dropdown (Sun / Moon / Monitor) with Lucide icons. Build mobile 3-way segmented pill.

- [x] **Step 4: Embed `ThemeToggle` in `NavbarDesktopControls.jsx` and `NavbarMobileControls.jsx`**
  Mount compact button next to `NotificationBell` on desktop (subsequently moved to the right of logout). Mount segmented pill in the mobile drawer.

- [x] **Step 5: Add Appearance card to `Profile.jsx`**
  Add Appearance card under Account Settings with segmented toggle control.

- [x] **Step 6: Run tests and verify**
  Run: `cd frontend && npm test -- run src/components/ThemeToggle.test.jsx`
  Expected: PASS

---

### Task 3: Embedded Widgets, Forms & Markdown Editor Theming

**Files:**
- Modify: `frontend/src/components/Turnstile.jsx:10-40, 190-230`
- Modify: `frontend/src/pages/Login.jsx:355-370`
- Modify: `frontend/src/pages/Register.jsx:385-400`
- Modify: `frontend/src/components/UserChat/ChatRoom.jsx:380-400`
- Modify: `frontend/src/components/ui/MarkdownEditor.css`

**Interfaces:**
- Consumes: `useTheme` from `../contexts/ThemeContext`

- [x] **Step 1: Update `Turnstile.jsx` to dynamically track `resolvedTheme`**
  Support `theme='auto'`, synchronizing with `resolvedTheme`. Style verified container with `dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300`.

- [x] **Step 2: Update `Login.jsx` and `Register.jsx` Turnstile calls**
  Pass dynamic `theme={resolvedTheme}`.

- [x] **Step 3: Update `ChatRoom.jsx` Emoji-Mart Picker**
  Pass dynamic `theme={resolvedTheme}` to `<Picker ... />`.

- [x] **Step 4: Add EasyMDE dark overrides in `MarkdownEditor.css`**
  Add `.dark .editor-toolbar`, `.dark .CodeMirror`, `.dark .editor-preview` styled with `bg-slate-800 text-slate-100 border-slate-700`.

- [x] **Step 5: Verify via `make lint-frontend`**
  Run: `make lint-frontend`
  Expected: PASS with 0 lint errors.

---

### Task 4: Interactive Maps & Leaflet Dark Overrides

**Files:**
- Modify: `frontend/src/components/MapLayersPanel.jsx:5-45`
- Modify: `frontend/src/components/LeafletMapView.jsx:760-800, 1320-1340`
- Modify: `frontend/src/components/MiniMap.jsx`
- Modify: `frontend/src/pages/IndependentMapView.jsx`
- Modify: `frontend/src/index.css:1700-1760`

**Interfaces:**
- Consumes: `useTheme` from `../contexts/ThemeContext`
- Produces: ESRI Dark Gray Canvas tile layer and Leaflet dark UI rules.

- [x] **Step 1: Add ESRI Dark Canvas layer to `MapLayersPanel.jsx`**
  Add `{ id: 'dark', name: 'Dark Gray Canvas', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', ... }`.

- [x] **Step 2: Implement theme-aware basemap default in `LeafletMapView.jsx` and `MiniMap.jsx`**
  Default to `'dark'` when `resolvedTheme === 'dark'` unless user explicitly selected another layer during session.

- [x] **Step 3: Add Leaflet dark CSS overrides in `index.css`**
  Add `.dark .leaflet-popup-content-wrapper`, `.dark .leaflet-popup-tip`, `.dark .leaflet-bar a`, and attribution overrides.

- [x] **Step 4: Verify Greek dive maps (Attica, Cyclades, Crete) in browser**
  Navigate to `/map` and `/dive-sites/6` via Chrome DevTools MCP. Verify coastlines and markers on ESRI Dark Canvas.

---

### Task 5: Data Visualizations & Analytics Recharts Dark Styling

**Files:**
- Create: `frontend/src/utils/chartTheme.js`
- Modify: `frontend/src/components/AdvancedDiveProfileChart.jsx:40-120, 930-970`
- Modify: `frontend/src/components/AdvancedAnalytics.jsx:145-200`
- Modify: `frontend/src/components/TissueSaturationChart.jsx:50-95`

**Interfaces:**
- Produces: `chartThemeTokens` for light/dark grids, axes, tooltips, and export backgrounds.

- [x] **Step 1: Create `chartTheme.js`**
  Export theme color constants for grid, axis, tooltip background/border/text, and cursor fill.

- [x] **Step 2: Update `AdvancedDiveProfileChart.jsx`**
  Use dynamic grid/axis colors and dark tooltip. Ensure `html2canvas` export sets explicit background matching theme.

- [x] **Step 3: Update `AdvancedAnalytics.jsx` and `TissueSaturationChart.jsx`**
  Replace hardcoded white tooltips and light gridlines with dynamic theme tokens.

---

### Task 6: Surface Theming, Contrast Audits & Detail Pages

**Files:**
- Modify: `frontend/src/pages/DiveSites.jsx`
- Modify: `frontend/src/pages/Dives.jsx`
- Modify: `frontend/src/pages/DiveDetail.jsx`
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`
- Modify: `frontend/src/pages/DivingCenterDetail.jsx`
- Modify: `frontend/src/pages/RouteDetail.jsx`
- Modify: `frontend/src/pages/UserProfile.jsx`
- Modify: `frontend/src/pages/Profile.jsx`
- Modify: `frontend/src/pages/Buddies.jsx`
- Modify: `frontend/src/pages/LeaderboardPage.jsx`
- Modify: `frontend/src/pages/EditDiveSite.jsx`
- Modify: `frontend/src/pages/Help.jsx`
- Modify: `frontend/src/pages/API.jsx`
- Modify: `frontend/src/pages/Changelog.jsx`
- Modify: `frontend/src/pages/About.jsx`
- Modify: `frontend/src/pages/Privacy.jsx`

- [x] **Step 1: Apply standardized dark surface tokens to high-traffic and detail pages**
  Update page wrappers to `dark:bg-slate-900`, cards to `dark:bg-slate-800 dark:border-slate-700`, headings to `dark:text-slate-100`.

- [x] **Step 2: Contrast audits across all core views**
  Audit WCAG 2.1 AA/AAA contrast ratios (>4.5:1 text, >3:1 UI elements) using Chrome DevTools MCP script evaluation. Remediate low-contrast tags, badge text, muted labels, and cURL code snippets.

- [x] **Step 3: Reposition navbar theme toggle**
  Place `ThemeToggle` to the right of the `Logout` button on desktop.

- [x] **Step 4: Run all unit tests and linting**
  `make lint-frontend` (0 errors) and Vitest suite (13/13 passing).
