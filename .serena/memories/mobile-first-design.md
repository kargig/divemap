# Mobile-First Design Principles for Divemap

This skill provides guidelines and patterns for implementing high-quality, responsive, and "mobile-first" user interfaces in the Divemap project using Tailwind CSS.

## 1. Core Philosophy: Mobile-First
- **Unprefixed First**: Start with mobile-only styles (unprefixed classes). These apply to all screen sizes.
- **Progressive Enhancement**: Use `sm:`, `md:`, `lg:`, `xl:` breakpoints to add complexity and space as the screen gets larger.
- **Avoid `sm:` for Mobile**: Remember that `sm:` targets 640px+, which is often larger than many mobile phones in portrait mode.

## 2. Layout & Spacing
- **Responsive Padding**: Use `p-4` or `p-3` for mobile containers, increasing to `p-6` or `p-8` on larger screens (e.g., `p-4 sm:p-6`).
- **Stacking by Default**: Use `flex-col` or `grid-cols-1` for mobile, and switch to horizontal layouts only when there is enough room (e.g., `flex-col sm:flex-row`).
- **Vertical Spacing**: Use `space-y-4` or `gap-4` to ensure elements are clearly separated on narrow screens.

## 3. Typography & Information Density
- **Fluid Font Sizes**: Use `text-sm` for secondary info and `text-base` for primary content on mobile. Increase to `md:text-lg` where appropriate.
- **Selective Visibility**: Hide non-essential information on mobile using `hidden md:block` or similar.
- **Abbreviation**: Use short names or acronyms on mobile (e.g., `SCUBAPRO` vs `SP`).
- **Iconography**: Use icons to replace text for common actions to save horizontal real estate.

## 4. Interactive Elements (Touch Targets)
- **Minimum Target Size**: Ensure buttons and interactive links have a minimum hit area of 44x44px.
- **Button Groups**: Stack buttons on mobile if they are too wide (e.g., `flex flex-col sm:flex-row`).
- **Action Placement**: Place critical actions where they are easy to reach with a thumb (bottom of the screen or right side).

## 5. Components Patterns
- **Cards**: Use full-width cards on mobile with minimal shadows to maximize space.
- **Modals**: On very small screens, modals should be full-screen or slide up from the bottom.
- **Stats & Grids**: Use `grid-cols-2` for key-value pairs to reduce vertical scroll.

## 6. Implementation Checklist
- [ ] Does it work on a 320px wide screen?
- [ ] Is there any horizontal scrolling?
- [ ] Are all buttons clickable without hitting neighbors?
- [ ] Is the most important info at the top?
- [ ] Are organization names abbreviated if needed?
