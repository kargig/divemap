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
- **Stacking by Default**: Use `flex-col` or `grid-cols-1` for mobile.
- **Responsive Ordering**: Use `flex flex-col lg:grid` combined with `order-N` classes to move critical sidebar content (e.g., "Community Impact") to the top on mobile while keeping it in the sidebar on desktop.
- **Header Density**: In headers, use `flex-col lg:flex-row` to stack titles and actions on mobile, but utilize horizontal space on desktop by pushing high-density stats (e.g., "Certification Overview") to the far right.
- **Space-Saving Padding**: Use `p-4` or `p-3` for mobile containers, increasing to `p-6` or `p-8` on larger screens.

## 3. Typography & Iconography
- **Icon Standardization**: Refer to the `ui-icons` memory. Use icons to replace or accompany text for high-density information (e.g., `TrendingUp` for Max Depth, `Waves` for Total Dives).
- **Selective Abbreviation**: Prioritize short names or acronyms on mobile (e.g., "PADI" vs. full organization name).
- **Structured Data Parsing**: For complex backend data (e.g., JSON strings for tanks/gases), implement helper functions to parse and display human-readable, compact strings instead of raw output.

## 4. Forms & Interactive Elements
- **Unique Form IDs**: When Add and Edit forms coexist, prefix all field IDs (e.g., `id="add_is_active"`) to avoid label-to-input linkage conflicts in the DOM.
- **Hit Area (44x44px)**: Ensure all buttons and links are easy to tap. Use `p-2` or `min-h-[44px]` for small icons.
- **Button Groups**: Stack buttons vertically on mobile if they are wide (`flex flex-col gap-2 sm:flex-row`).

## 5. Library Specifics (Ant Design)
- **Card Component**: Use `variant='borderless'` instead of the deprecated `bordered={false}`.
- **Statistic Component**: Use `styles={{ content: { ... } }}` instead of the deprecated `valueStyle`.
- **List Component**: Prefer standard `Array.map()` with custom `div` structures over the `List` component for better long-term compatibility and styling flexibility.
- **Modal Component**: Use `destroyOnHidden` instead of the deprecated `destroyOnClose`.

## 6. Implementation Checklist
- [ ] Does it work on a 320px wide viewport (iPhone SE)?
- [ ] Is there any horizontal scrolling?
- [ ] Are all touch targets at least 44px?
- [ ] Are all form IDs unique across coexisting components?
- [ ] Are icons used consistently per `ui-icons` standards?
- [ ] Are long labels abbreviated or hidden on mobile?
- [ ] Do buttons wrap or stack correctly?
