# Design Spec: Full Dark Mode & Theme Preference System

**Date:** 2026-10-19  
**Status:** In Review  
**Branch:** `feature/full-dark-theme-mode`  
**Related Components:** ThemeContext, Navigation Controls (Desktop & Mobile), User Profile, Tailwind Configuration, Ant Design (`antd` & `antd-mobile`) Theme Providers, Map Layers & Tiles (Leaflet / MiniMap), Recharts Visualizations, Cloudflare Turnstile, EasyMDE, Chat Emoji Picker.

---

## 1. Intent & The "Why"

Divemap currently provides a light theme designed with ocean-blue and clean gray surfaces. However:
1. **Light Sensitivity & Glare Elimination:** Many divers, boat operators, and enthusiasts use laptops and mobile phones in low-light environments (e.g. night dive preparation, liveaboard cabins at night) or suffer from photophobia/light sensitivity. A bright `#ffffff` / `#f9fafb` screen creates severe glare, eye strain, and visual fatigue.
2. **First-Class Choice (Not a Replacement):** Dark mode must exist alongside the existing light theme as an optional, user-selectable preference. The light theme remains the default for standard browsing unless the user or device requests otherwise.
3. **Prevention of Broken Hybrid States:** Previous default Tailwind configuration operated in `media` mode, activating isolated `dark:*` classes against hardcoded white cards for any user whose laptop was set to dark mode. The application requires a cohesive, class-driven theme engine (`html.dark`) where all surfaces, typography, cards, modals, third-party libraries, and map tiles transition together.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
- **Three-Way User Choice:** Support `system` (default), `light`, and `dark` modes across all client platforms.
- **Persistent Preference:** Persist user selection in `localStorage` for guests and authenticated users, with zero flash of unstyled content (FOUC) on page reloads.
- **Accessible & Soothing Aesthetic:** Use deep slate and oceanic trench navy tones (`slate-900` `#0f172a` / `slate-800` `#1e293b` / `#001a2a`) rather than harsh pitch-black (`#000000`), preventing haloing while meeting WCAG AA/AAA contrast ratios (>4.5:1 text, >3:1 UI components).
- **Intuitive Theme Controls:**
  - Desktop: Top-right navbar icon button (Sun/Moon/Laptop) with an accessible 3-option dropdown in the utility cluster beside notifications.
  - Mobile: Full-width segmented 3-way pill toggle (`[ ☀️ Light | 🌙 Dark | 💻 System ]`) inside the mobile navigation drawer.
  - Profile: Explicit theme selector card under Account Settings.
- **Comprehensive Library & Component Synchronization:**
  - Desktop Ant Design (`antd`) using `theme.darkAlgorithm`.
  - Mobile Ant Design (`antd-mobile`) using `data-prefers-color-scheme="dark"`.
  - Cloudflare Turnstile dynamically adopting `resolvedTheme`.
  - Chat Emoji Picker (`@emoji-mart/react`) dynamically adopting `resolvedTheme`.
  - EasyMDE Markdown Editor dark styling for logs and reviews.
  - Recharts dive profiles and analytics charts utilizing dark gridlines, axis labels, and tooltip cards.
- **Theme-Aware Interactive Maps:** Support a dark basemap tile layer (CartoDB Dark Matter) while retaining the Map Layers panel so users can switch to OpenStreetMap, OpenTopoMap (terrain), or Esri Satellite at any time.

### 2.2 Non-Goals
- **Replacing Light Mode:** Light mode is preserved in its entirety without visual regression.
- **High-Contrast Pure-Black OLED Mode:** A separate stark black `#000000` mode is out of scope for this phase; the focus is an oceanic, accessible dark theme.
- **Forced Map Inversion:** Map tiles will not be inverted via CSS filter hacks (which garble marine satellite and topo colors); dedicated clean vector/tile basemaps will be used.

### 2.3 Anti-Goals (What would make this fail)
- **FOUC (Flash of White):** Blinding white flashes during initial load before React mounts.
- **Illegible Muddy Badges:** Repeating the 1.07:1 contrast issue where light text sits on light surfaces or dark text sits on dark surfaces.
- **Incomplete Surface Coverage:** Having dark page wrappers with isolated blinding white cards, form inputs, markdown editors, or third-party modals.
- **Blinding Map Popups:** Leaving Leaflet popups or zoom controls in default `#ffffff` against dark basemaps.
- **Loss of Map Coastal Detail:** Defaulting to dark maps without allowing divers to inspect shallow reefs or topographic island contours.

---

## 3. Decisions Made with User

1. **Default State:** New visitors default to **System**, following `prefers-color-scheme`. If their OS changes from day to night, Divemap responds automatically.
2. **User Overrides:** Users can explicitly pick **Light**, **Dark**, or **System** at any time.
3. **Placement:**
   - Desktop: Top-right navbar toolbar alongside notifications and chat.
   - Mobile: Dedicated touch-friendly segmented toggle in the navigation drawer.
4. **Interactive Maps:**
   - Automatically provide and select a dark basemap (CartoDB Dark Matter) in dark theme.
   - Allow user to switch back to OpenStreetMap, OpenTopoMap, or Satellite using the Map Layers panel.
   - Evaluate coastal detail in Greek diving areas (Attica/Saronic, Cyclades, Crete) to ensure reef boundaries and coastlines remain clear.

---

## 4. Architecture & Technical Design

### 4.1 Zero-Flicker Bootstrapping (`index.html`)
To eliminate white flashes during initial load before React mounts, and synchronize both Tailwind (`.dark`) and `antd-mobile` (`data-prefers-color-scheme`):
```html
<script>
  (function() {
    try {
      const stored = localStorage.getItem('divemap_theme') || 'system';
      const isDark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-prefers-color-scheme', 'dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f172a');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-prefers-color-scheme', 'light');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0072B2');
      }
    } catch (_) {}
  })();
</script>
```

### 4.2 Theme Management Engine (`frontend/src/contexts/ThemeContext.jsx`)
- **Persistence Scope:** Client-first via `localStorage.getItem('divemap_theme')`. This guarantees instant, zero-latency theme activation without requiring database migrations or API overhead for guests and logged-in users alike.
- State: `theme` (`'system' | 'light' | 'dark'`), initialized from `localStorage`.
- Computed: `resolvedTheme` (`'light' | 'dark'`), listening to `window.matchMedia('(prefers-color-scheme: dark)')` change events when `theme === 'system'`.
- Method: `setTheme(newTheme)`. Updates state, sets `localStorage.setItem('divemap_theme', newTheme)`, toggles `.dark` class and `data-prefers-color-scheme` on `document.documentElement`, and dispatches a custom event for map tile synchronization.

### 4.3 Desktop Navbar & Mobile Drawer Controls
- **Desktop Navbar (`NavbarDesktopControls.jsx`):** Compact icon button (h-9 w-9) in the right-hand utility group alongside the Notification Bell and Messages icon. Clicking opens an accessible 3-option dropdown menu.
- **Mobile Navigation Drawer (`NavbarMobileControls.jsx`):** A dedicated touch-friendly 3-way segmented pill selector inside the drawer, avoiding header crowding on small mobile screens.
- **User Settings (`Profile.jsx`):** Appearance card under Account Settings with 3 radio options.

### 4.4 Ant Design Synchronization (`antd` and `antd-mobile`)
Wrap application roots in Ant Design's `ConfigProvider`:
```jsx
import { ConfigProvider, theme as antdTheme } from 'antd';

<ConfigProvider
  theme={{
    algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#0072B2',
      colorBgBase: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
      colorBgContainer: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff',
      colorBorder: resolvedTheme === 'dark' ? '#334155' : '#e2e8f0',
      fontFamily: '"DM Sans", system-ui, sans-serif',
    },
  }}
>
  <AppContent />
</ConfigProvider>
```

### 4.5 Standardized Surface & Typography Tokens
All shared layout components and pages must adopt consistent dark pairings:

| UI Layer | Light Mode | Dark Mode Pair |
| :--- | :--- | :--- |
| **App Shell & Page Background** | `bg-gray-50` (`#f9fafb`) | `dark:bg-slate-900` (`#0f172a`) |
| **Cards & Modals** | `bg-white` (`#ffffff`) | `dark:bg-slate-800` (`#1e293b`) |
| **Elevated / Secondary Surfaces** | `bg-gray-50` / `bg-blue-50/50` | `dark:bg-slate-800/80` or `dark:bg-slate-900/60` |
| **Borders & Dividers** | `border-gray-200` / `border-gray-100` | `dark:border-slate-700` |
| **Headings (`PageTitle`, h1-h3)** | `text-gray-900` | `dark:text-slate-100` |
| **Body & Supporting Text** | `text-gray-600` / `text-gray-500` | `dark:text-slate-400` |
| **Form Inputs & Selects** | `bg-white border-gray-300 text-gray-900` | `dark:bg-slate-700 dark:border-slate-600 dark:text-white` |
| **Interactive Hover (Lists)** | `hover:bg-blue-100/50` | `dark:hover:bg-blue-900/40` |

### 4.6 Interactive Map Layers & Dark Basemap (`MapLayersPanel.jsx`, `LeafletMapView.jsx`)
Add CartoDB Dark Matter to available tile layers:
```javascript
{
  id: 'dark',
  name: 'Dark Matter',
  description: 'CartoDB dark basemap for night viewing',
  icon: <Moon className='w-5 h-5' />,
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
}
```
**Layer Precedence Rules**:
1. **URL Override**: If the URL contains an explicit `?layer=...`, that layer is honored.
2. **User Manual Choice**: If the user clicks a specific layer in `MapLayersPanel` (e.g., Satellite), that selection is preserved in session state.
3. **Theme Default**: If the user has not manually selected a layer for the session:
   - When `resolvedTheme === 'dark'`, the map defaults to `'dark'` (CartoDB Dark Matter).
   - When `resolvedTheme === 'light'`, the map defaults to `'street'` (OpenStreetMap).

### 4.7 Leaflet Dark CSS Overrides (`src/index.css`)
Leaflet's default styles inject `#ffffff` backgrounds for popups and toolbars. Override these under `.dark`:
```css
.dark .leaflet-popup-content-wrapper {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border: 1px solid #334155;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}

.dark .leaflet-popup-tip {
  background-color: #1e293b !important;
  border: 1px solid #334155;
}

.dark .leaflet-container a.leaflet-popup-close-button {
  color: #94a3b8 !important;
}

.dark .leaflet-bar a {
  background-color: #1e293b !important;
  color: #f1f5f9 !important;
  border-bottom: 1px solid #334155 !important;
}

.dark .leaflet-control-attribution {
  background-color: rgba(15, 23, 42, 0.8) !important;
  color: #94a3b8 !important;
}

.dark .leaflet-control-attribution a {
  color: #38bdf8 !important;
}
```

### 4.8 Embedded Widgets (Cloudflare Turnstile & Emoji Picker)
- **Turnstile (`components/Turnstile.jsx`, `pages/Login.jsx`, `pages/Register.jsx`):**
  Update default prop to `theme = 'auto'`, expand `propTypes.oneOf(['light', 'dark', 'auto'])`, and synchronize with `resolvedTheme`. Ensure verified status badge uses adaptive dark tokens (`dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300`).
- **User Chat Emoji Picker (`components/UserChat/ChatRoom.jsx`):**
  Update line 389 from `theme='light'` to `theme={resolvedTheme}`.

### 4.9 Data Visualizations & Charts (Recharts)
Define theme tokens for charts in `AdvancedDiveProfileChart.jsx`, `AdvancedAnalytics.jsx`, and `TissueSaturationChart.jsx`:
- **Grids:** `#334155` in dark mode, `#e5e7eb` in light mode.
- **Axes & Ticks:** `#94a3b8` in dark mode, `#6b7280` in light mode.
- **Custom Tooltips:** Dark slate container (`bg-slate-800 border-slate-700 text-slate-100`) in dark mode.
- **Bar/Area Cursor Highlight:** Transparent dark highlight (`rgba(51, 65, 85, 0.4)`) instead of white `#f9fafb`.
- **Chart Exports (`html2canvas`):** Specify explicit canvas background color matching active theme (`#0f172a` for dark, `#ffffff` for light) to prevent washed-out PNG/PDF exports.

### 4.10 Markdown Editor Overrides (`MarkdownEditor.css`)
Provide dark theme styles for EasyMDE/CodeMirror in `components/ui/MarkdownEditor.css`:
- Toolbar: `bg-slate-800 border-slate-700 text-slate-200`
- Editor area: `bg-slate-900 text-slate-100`
- Preview pane: `bg-slate-800 text-slate-100`

---

## 5. Implementation Phases (6 Logical Phases)

### Phase 1: Core Theme Engine, Bootstrap & Dual-UI Providers
- Create `ThemeContext.jsx` with full state, `matchMedia` listener, and `localStorage` caching.
- Add zero-flicker script in `index.html` updating both `.dark` and `data-prefers-color-scheme`.
- Wrap `App.jsx` with `ThemeProvider` and Ant Design's `ConfigProvider` (`theme.darkAlgorithm`).
- Synchronize React Hot Toast (`<Toaster />`) dark colors.

### Phase 2: Navigation, Header & Settings Controls
- Desktop Navbar: Add 3-way dropdown toggle in `NavbarDesktopControls.jsx`.
- Mobile Drawer: Add 3-way segmented pill control in `NavbarMobileControls.jsx`.
- User Profile: Add Appearance card in `Profile.jsx`.

### Phase 3: Forms, Markdown Editor & Widget Integrations
- Update `Turnstile.jsx`, `Login.jsx`, and `Register.jsx` to dynamically track `resolvedTheme`.
- Update `ChatRoom.jsx` emoji picker to `resolvedTheme`.
- Add EasyMDE dark styles in `MarkdownEditor.css`.
- Audit core form components and modal wrappers.

### Phase 4: Maps, Geospatial Layers & Leaflet Overrides
- Add CartoDB Dark Matter tile layer in `MapLayersPanel.jsx` and `LeafletMapView.jsx`.
- Implement theme-aware basemap default with session override preservation.
- Add Leaflet dark CSS overrides (popups, tips, zoom controls, attribution) in `index.css`.
- Test Greek diving regions (Saronic Gulf, Cyclades, Crete) to verify coastal rendering.

### Phase 5: Data Visualizations & Analytics (Recharts)
- Update `AdvancedDiveProfileChart.jsx` grid, axis, tooltip, and `html2canvas` export backgrounds.
- Update `AdvancedAnalytics.jsx` and `TissueSaturationChart.jsx` tooltips and cursor fills.

### Phase 6: Contrast Audits, Unit Tests & Browser Verification
- Unit test `ThemeContext` with Vitest (initial load, system changes, toggle, caching).
- Run Chrome DevTools MCP visual inspection across `/`, `/dive-sites`, `/dives`, `/map`, `/resources/tags`.
- Verify 0 console errors, 0 FOUC, and full WCAG AA contrast compliance.
