---
name: mobile-first-design
description: Guidelines and patterns for implementing high-quality, "mobile-first" responsive user interfaces in the Divemap project using Tailwind CSS. Use this skill when designing or refactoring components and pages to ensure they are visually striking, functional, and touch-optimized on all devices.
---

# Mobile-First Design Principles for Divemap

This skill codifies the standards for responsive development in the Divemap project, emphasizing a mobile-first approach with Tailwind CSS and Ant Design.

## 1. Core Philosophy: Mobile-First
- **Start Small (Unprefixed)**: Define base styles for mobile first using unprefixed utilities. These apply to all screen sizes.
- **Progressive Enhancement**: Use breakpoints (`sm:`, `md:`, `lg:`, `xl:`) only to add complexity or adjust layout as screen real estate increases.
- **Avoid `sm:` for Base Mobile**: `sm:` targets 640px+, which is often wider than mobile phones in portrait mode. Mobile styles MUST be unprefixed.

## 2. Layout & Spatial Composition
- **Stacking by Default**: Use `flex-col` or `grid-cols-1` for mobile. Switch to horizontal layouts (`flex-row`, `grid-cols-N`) only at larger breakpoints.
- **Responsive Ordering**: Use `flex flex-col lg:grid` combined with `order-N` classes to move critical sidebar content (e.g., "Community Impact") to the top on mobile while keeping it in the sidebar on desktop.
- **Header Density**: In headers, use `flex-col lg:flex-row` to stack titles and actions on mobile, but utilize horizontal space on desktop by pushing high-density stats (e.g., "Certification Overview") to the far right.
- **Sticky Actions**: Use `sticky top-0` or `sticky bottom-0` for critical mobile UI like navigation or "Save" buttons.
- **Safe Area Insets**: For modern mobile displays, use safe area utilities like `pb-[env(safe-area-inset-bottom)]`.
- **Responsive Spacing**: Use tighter padding (`p-3`, `p-4`) on mobile, increasing to (`p-6`, `p-8`) on larger screens.
- **Container Control**: Use `.container mx-auto` to maintain consistent max-widths and center content.
- **Overflow Management**: Prevent horizontal scrolling with `overflow-x-hidden` or controlled `overflow-x-auto`.

## 3. Typography & Iconography
- **Fluid Typography**: Consider using `clamp()` for headers that scale smoothly (e.g., `text-[clamp(1.5rem,5vw,2.5rem)]`).
- **Line Height (Leading)**: Use `leading-relaxed` or `leading-loose` on mobile to improve legibility.
- **Icon Standardization**: Refer to the `ui-icons` memory. Use icons to replace or accompany text (e.g., `TrendingUp` for Depth, `Waves` for Total Dives).
- **Selective Abbreviation**: Prioritize acronyms on mobile (e.g., "PADI" vs. "Professional Association...").
- **Visual Hierarchy**: Use bold headers and high-contrast accents to guide the eye on small screens.

## 4. Forms & Interactive Elements
- **Touch Targets (44x44px)**: Ensure all buttons/links are easy to tap. Use `p-2` or `min-h-[44px]`.
- **Active Feedback**: Always define `active:scale-95` to provide immediate visual confirmation.
- **Form Fields**: Use full-width inputs on mobile to maximize typing comfort.
- **Unique Form IDs**: Prefix all field IDs (e.g., `id="add_is_active"`) to avoid label linkage conflicts.
- **Screen Reader Context**: Use `sr-only` for labels that are visually redundant but necessary for a11y.

## 5. Component Patterns
- **Account Stats**: Use `flex justify-between items-center` for key-value pairs. Ensure values are right-aligned.
- **Certifications**: Use high-density cards. Abbreviate organizations and use status dots instead of badges.
- **Modals**: Merge related actions (like Edit + Toggle) into a single modal.
- **Data Parsing**: Use helper functions to parse complex JSON strings into compact, human-readable labels.

## 6. Library Specifics (Ant Design)
- **Card Component**: Use `variant='borderless'` instead of `bordered={false}`.
- **Statistic Component**: Use `styles={{ content: { ... } }}` instead of `valueStyle`.
- **List Component**: Prefer standard `Array.map()` with custom `div` structures over the `List` component.
- **Modal Component**: Use `destroyOnHidden` instead of `destroyOnClose`.

## 7. Implementation Checklist
- [ ] Does it work on a 320px wide viewport (iPhone SE)?
- [ ] Is there any horizontal scrolling?
- [ ] Are all touch targets at least 44px?
- [ ] Is the most critical information visible first? (Responsive Ordering)
- [ ] Does it handle the "notch" area? (Safe Area Insets)
- [ ] Are all form IDs unique across coexisting components?
- [ ] Are icons used consistently per `ui-icons` standards?
- [ ] Are long labels abbreviated or hidden on mobile?
- [ ] Do buttons wrap or stack correctly?
