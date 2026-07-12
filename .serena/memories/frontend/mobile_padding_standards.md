# Frontend Mobile Layout, Padding, and Spacing Standards

To prevent horizontal and vertical content squishing and ensure optimal mobile view data density, Divemap enforces a strict centralized padding and vertical rhythm model.

## 1. Central Layout Responsibility
In `frontend/src/App.jsx`, the global `<main>` element automatically wraps all standard (non-admin) page views with the project's standard horizontal padding:
```jsx
<main className={`${isAdminPath ? 'w-full max-w-none px-0' : 'container mx-auto px-4 sm:px-6 lg:px-8'} py-4 sm:py-8 pt-16`}>
```
This baseline padding supplies:
- **Mobile (unprefixed):** `px-4` (16px, matching Android Material Design 3 and iOS HIG side margin).
- **Tablet (`sm:`):** `px-6` (24px).
- **Desktop (`lg:`):** `px-8` (32px).

## 2. No Horizontal Padding in Page Wrappers
Individual non-admin page components MUST NEVER duplicate horizontal padding classes in their top-level page divs.
- **Anti-Pattern (Double Padding):**
  ```jsx
  // WRONG: Adds another 16px of padding on mobile, shrinking content to 240px wide!
  <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
  ```
- **Standard Layout Pattern:**
  ```jsx
  // CORRECT: Rely completely on <main>'s layout padding. Only declare max-width and vertical margin/padding.
  <div className='max-w-7xl mx-auto py-4 sm:py-8 animate-fade-in'>
  ```
- **Customized Breakpoint Pattern:**
  If a page requires custom responsive horizontal paddings on larger screens but standard padding on mobile, use `px-0` as the baseline mobile prefix:
  ```jsx
  // CORRECT: 0 padding on mobile (utilizing <main>'s px-4), increasing on sm/lg/xl breakpoints.
  <div className='max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
  ```

## 3. Typography & Spacing Requirements (Vertical Rhythm)
On small mobile screens, vertical screen height is extremely precious. Loose or exaggerated spacing creates huge "empty voids" and forces excessive scrolling. 

### A. Line Height (Leading) Standards
- **Body Text Leading:** Use a line height of **`1.5`** (`leading-relaxed`) for standard body, description, and paragraph text. This meets WCAG 2.1 AA readability requirements on narrow viewports.
- **Heading Leading:** Use tighter line height, typically **`1.1` to `1.2`** (`leading-none` or `leading-tight`) for titles, headers, and heading tags (H1-H4). Large font sizes naturally need less relative leading to avoid breaking and feeling disjointed.

### B. Gap & Section Spacing Standards
- **Page Layout Gaps:** Do not use loose, static vertical gaps. Instead, use responsive Tailwind space-y utilities:
  - *Standard Page Blocks:* `space-y-4 sm:space-y-6` or `space-y-4 sm:space-y-8` (instead of static `space-y-6` or `space-y-8`).
  - *List Gaps (Cards/Feed items):* `space-y-3 sm:space-y-4` (instead of static `space-y-4`).
- **Inner Component Grid/Flex Gaps:**
  - *Standard Card Grid Gaps:* `gap-2 sm:gap-4` or `gap-3 sm:gap-6` (instead of static `gap-4` or `gap-6`).
  - *Responsive Column Margins:* Avoid static margins. Use responsive top/bottom margins, e.g., `mt-2 sm:mt-0` when layout columns stack on mobile.

## 4. High Density Mobile Cards & Components
- **Card Padding:** Standard card widgets inside page components should shrink their inset padding on mobile:
  - *Sizing:* `p-3 sm:p-4` or `p-3 sm:p-6` instead of static `p-4` or `p-6`.
- **Horizontal Components:** In headers, search bars, and toggle cards, items must be responsive (e.g. `flex flex-col sm:flex-row`). Stacking elements vertically and giving them full width (`w-full`) on mobile makes them easy, touch-friendly tap targets, and prevents awkward squeezing and truncations.
