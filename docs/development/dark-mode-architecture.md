# Dark Mode Architecture & Implementation Guide

## Overview

Divemap features a first-class, accessible dark theme system implemented alongside the standard light theme. The system gives users explicit choice between **Light**, **Dark**, and **System** (OS preference) themes while ensuring:
1. **Zero FOUC (Flash of Unstyled Content)** on page reloads.
2. **Synchronized Dual-UI Frameworks**: Seamlessly keeps Tailwind CSS, desktop Ant Design, and Ant Design Mobile in theme alignment.
3. **WCAG 2.1 AA/AAA Accessibility**: Strict contrast compliance (≥ 4.5:1 for body text, ≥ 3.0:1 for large text/icons) with adapted colorblind-safe (Okabe-Ito) palettes.
4. **Theme-Aware Data Visualizations & Maps**: Automatic switching of Leaflet basemaps to ESRI Dark Gray Canvas, dark CSS overrides for popups/controls, and themed Recharts graphs.

---

## Architecture & Implementation

### 1. Zero-FOUC Head Script (`frontend/index.html`)
To prevent visual flashes of white content before React mounts, an inline script executes synchronously in the document `<head>`:

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('divemap_theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = saved === 'dark' || (!saved && prefersDark) || (saved === 'system' && prefersDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-prefers-color-scheme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.removeAttribute('data-prefers-color-scheme');
      }
    } catch (e) {}
  })();
</script>
```

### 2. State & Engine (`ThemeContext.jsx`)
- **Key**: `divemap_theme` stored in `localStorage` (`'light'`, `'dark'`, `'system'`).
- **Media Query Listener**: Listens for changes via `window.matchMedia('(prefers-color-scheme: dark)')` when theme is set to `'system'`.
- **Decoupled Events**: Dispatches a `window.CustomEvent('divemap_theme_change', { detail: resolvedTheme })` for listeners outside React context.
- **Hook**: `useTheme()` exposes:
  - `theme`: `'light' | 'dark' | 'system'` (the user's setting)
  - `resolvedTheme`: `'light' | 'dark'` (the active computed mode)
  - `setTheme(newTheme)`: Updates preference and persistence.

### 3. Dual Component Library Sync (`App.jsx`)
Ant Design requires explicit algorithm binding to render dark dialogs, dropdowns, and date pickers:

```jsx
<ConfigProvider
  theme={{
    algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#0072B2', // Okabe-Ito True Blue
    },
  }}
>
```
`antd-mobile` automatically respects `document.documentElement.getAttribute('data-prefers-color-scheme') === 'dark'`.

### 4. Interactive Maps (`LeafletMapView.jsx`, `MiniMap.jsx`, `MapLayersPanel.jsx`)
- **Dark Basemap**: Integrated **ESRI World Dark Gray Canvas** (`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`).
- **Auto-Switching Precedence**:
  1. URL parameter (`?layer=...`)
  2. User's manual selection in the session layer panel
  3. Automatic theme default (`dark` canvas when dark mode is active, satellite/streets when light mode is active).
- **CSS Overrides (`index.css`)**: In dark mode, `.dark .leaflet-popup-content-wrapper`, `.dark .leaflet-popup-tip`, `.dark .leaflet-bar a`, and `.dark .leaflet-control-attribution` are styled with slate backgrounds and clear borders.

### 5. Charts & Telemetry (`chartTheme.js`)
Recharts components (`AdvancedDiveProfileChart`, `TissueSaturationChart`, `AdvancedAnalytics`) utilize centralized chart tokens:
- **Grid Lines**: `rgba(255, 255, 255, 0.12)` in dark mode vs `rgba(0, 0, 0, 0.08)` in light mode.
- **Axes & Ticks**: `#94a3b8` (slate-400) in dark mode vs `#6b7280` (gray-500) in light mode.
- **Tooltips**: Dark slate backgrounds (`#1e293b`) with light text (`#f8fafc`).
- **HTML2Canvas Exports**: Canvas background is explicitly set to `#0f172a` in dark mode to prevent black/transparent image rendering.

---

## Design System & Surface Tokens

All components follow standardized surface and text token hierarchies:

| Element | Light Mode Utility | Mandatory Dark Mode Utility | Computed Hex / Contrast | Usage |
|---|---|---|---|---|
| **Page Canvas** | `bg-gray-50` | `dark:bg-slate-900` | `#0f172a` canvas | Full-page background (`AppContent`, main containers) |
| **Card / Surface** | `bg-white` | `dark:bg-slate-800` | `#1e293b` base card | Content cards, modals, sidebars, popovers |
| **Inner Well / Sub-card** | `bg-gray-50` / `bg-gray-100` | `dark:bg-slate-750` / `dark:bg-slate-900/60` | `#162032` / inset well | Input wells, stat badges, list items |
| **Borders** | `border-gray-100` / `border-gray-200` | `dark:border-slate-700` | `#334155` divider | Card borders, table dividers, panel outlines |
| **Primary Text / Headings** | `text-gray-900` | `dark:text-slate-100` | `#f1f5f9` (> 13:1) | Page titles (`h1`), card headers (`h2`, `h3`, bold titles) |
| **Key Metrics & Form Labels** | `text-gray-800` / `text-gray-700` | `dark:text-slate-200` | `#e2e8f0` (> 11:1) | Durations, max/avg depths, tank stats, form labels |
| **Body Text / Descriptions** | `text-gray-700` / `text-gray-600` | `dark:text-slate-300` | `#cbd5e1` (> 8:1) | Descriptions, readable body copy, explanations |
| **Secondary / Muted Text** | `text-gray-500` / `text-gray-400` | `dark:text-slate-400` | `#94a3b8` (> 4.5:1 AA) | Metadata, timestamps, subordinate counts, icons |
| **Form Inputs & Selects** | `bg-white border-gray-300 text-gray-900` | `dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100` | `#1e293b` input | Text inputs, dropdowns, textareas |
| **Input Placeholders** | `placeholder-gray-400` | `dark:placeholder-slate-400` | Accessible placeholder | Form placeholder text |
| **Link Accent** | `text-blue-600` | `dark:text-sky-400` / `dark:text-blue-400` | Hyperlinks, active tab indicators, hover states |

### Semantic Badges & Pills
- **Info / Primary Badge**: `bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800`
- **Success Badge**: `bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-800`
- **Warning Badge**: `bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900`
- **Danger / Deco Badge**: `bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800`

### Strict Anti-Patterns (Contrast Traps)
1. **Never write bare `text-gray-900`, `text-gray-800`, or `text-gray-700`** inside any card or container without its paired `dark:text-slate-100` or `dark:text-slate-200`. In dark mode, `text-gray-700` compiles to dark gray `#374151` on a `#1e293b` slate card, creating illegible low-contrast text (contrast ratio < 1.3:1).
2. **Never leave inputs as plain `bg-white border-gray-300`** in JSX. They will shine as glaring white boxes on dark forms.
3. **Never use `text-blue-800` or `text-purple-800`** on dark pills without adding `dark:text-sky-200` or `dark:text-purple-200`. Deep jewel tones in light mode become unreadable on dark backgrounds.

### Okabe-Ito Colorblind Tag Palette (Dark Mode Luminance)

To maintain accessibility on dark surfaces (`dark:bg-slate-800`), tag pill text colors use 200-shade luminance:

| Tag Type | Dark Background | Dark Text (200-shade) | Minimum Contrast |
|---|---|---|---|
| **Blue** | `rgba(0, 77, 122, 0.25)` | `#bfdbfe` | > 6.0:1 |
| **Orange** | `rgba(154, 52, 18, 0.25)` | `#fed7aa` | > 5.5:1 |
| **Green** | `rgba(4, 120, 87, 0.25)` | `#a7f3d0` | > 5.8:1 |
| **Vermillion** | `rgba(185, 28, 28, 0.25)` | `#fecaca` | > 6.2:1 |
| **Purple** | `rgba(112, 26, 117, 0.25)` | `#f5d0fe` | > 6.0:1 |
| **Yellow** | `rgba(133, 77, 14, 0.25)` | `#fef08a` | > 7.0:1 |
| **Sky** | `rgba(3, 105, 161, 0.25)` | `#bae6fd` | > 6.5:1 |

---

## Status & Progress

### Completed Features & Pages
- [x] **Theme Context & Engine**: `ThemeContext.jsx`, synchronous `<head>` script, Ant Design `ConfigProvider` dark algorithm.
- [x] **Theme Toggle Controls**:
  - Desktop: Icon dropdown located to the right of the navbar `Logout` button.
  - Mobile: Segmented pill in navigation drawer.
  - Settings: Segmented pill in User Profile appearance settings.
- [x] **Navigation & Search**:
  - Global navbar search results (`GlobalSearchBar.jsx`, `Combobox.jsx`).
  - Search highlights, category headers, loading states, empty messages.
- [x] **Interactive Maps**:
  - ESRI World Dark Gray Canvas added to `MapLayersPanel`, `MiniMap`, and `LeafletMapView`.
  - Dark mode default basemap auto-switching.
  - Leaflet CSS overrides for popups, tips, zoom controls, and attributions.
- [x] **Telemetry & Data Visualizations**:
  - Recharts theme tokens (`chartTheme.js`).
  - Dive profile charts, tissue saturation compartment graphs, advanced analytics.
- [x] **Form Controls & Inputs**:
  - `FormField` labels, text inputs, selects, textareas, checkboxes.
  - EasyMDE markdown editor dark styles (`MarkdownEditor.css`).
  - Cloudflare Turnstile dynamic theme tracking.
  - Chat emoji-mart picker theme sync.
- [x] **Core Explorer Views**:
  - `/dives`: Dive cards (list and grid views), quick filter pills, sorting bar.
  - `/dive-sites`: Dive site cards, descriptions, difficulty badges, expandable desktop filters panel.
- [x] **Core Detail Pages**:
  - Dive Site Details (`/dive-sites/:id/:slug`)
  - Dive Details (`/dives/:id/:slug`)
  - Diving Center Details (`/diving-centers/:id/:slug`)
  - Dive Route Details (`/dive-routes/:id/:slug`)
  - Public User Profile (`/users/:username`)
- [x] **User Management & Community**:
  - User Settings (`/profile`)
  - Buddy Management (`/buddies`)
  - Community Leaderboard (`/leaderboard`)
  - Edit Dive Site (`/dive-sites/:id/edit`)
- [x] **Informational & Policy Pages**:
  - Help Center & User Guide (`/help`)
  - API Documentation (`/api-docs`)
  - Changelog (`/changelog`)
  - About (`/about`)
  - Privacy Policy (`/privacy`)

---

## Pending & Future Considerations

The following optional enhancements can be considered for future iterations:

1. **User Profile Cloud Sync (Backend Persistence)**:
   - *Current State*: Theme preference is persisted client-side in `localStorage` (`divemap_theme`).
   - *Future Work*: Add an optional `preferred_theme` field to the User model / API schema to synchronize preferences across devices upon login.
2. **Android PWA / TWA Theme Bar Dynamic Sync**:
   - *Current State*: The `<meta name="theme-color">` is statically set to brand blue `#0072B2`.
   - *Future Work*: Dynamically update the `<meta name="theme-color">` tag content to `#0f172a` when dark mode is active to tint the native Android system status bar.
3. **Print & PDF Export Styling**:
   - *Current State*: Print styles utilize standard browser print stylesheets.
   - *Future Work*: Force light-theme styling (`@media print { ... }`) on printable dive log summaries and digital vouchers to conserve printer ink.
4. **Admin Dashboard Sub-Views**:
   - *Current State*: Main application and admin entry routes are themed.
   - *Future Work*: Deeply audit less-frequented secondary admin views (e.g., raw database drift tools or custom audit tabs) if specialized custom styling is introduced.
