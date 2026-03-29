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

## 3. Condensed Mobile View Standards (List & Detail Pages)
To maximize data density on mobile devices without sacrificing usability, apply the following "condensed" styling patterns to listing pages (Dive Sites, Dives, Centers, Routes) and detail views:

- **Static Filter Bars:** Avoid `sticky` floating filter/search bars on mobile as they cause jumpy scroll behavior and consume screen real estate. Use a static inline layout (`bg-white border border-gray-200 rounded-xl shadow-sm mb-4`).
- **Micro-Navigation (Sticky Icon Grids):** Instead of long, text-heavy horizontal scroll tabs, use an "app-like" micro-navigation bar. Combine a standardized Lucide icon (`w-3.5 h-3.5`) stacked above a tiny, uppercase label (`text-[8px] font-bold tracking-tight`). This allows 5-6 shortcuts to fit perfectly on a single mobile screen without horizontal scrolling.
- **Smooth Deep-Linking (`scroll-mt`):** When using sticky navigation bars, jumping to an anchor (e.g., `#weather`) will cause the sticky header to overlap the content. Always add a scroll margin (e.g., `scroll-mt-16` or `scroll-mt-20`) to the target container.
- **Progressive Disclosure (Accordions):** Don't force users to scroll past massive walls of secondary data (e.g., "Nearby Dive Sites", "Top Dives", "Weather"). Hide these behind `Collapse` accordions on mobile by default. Hook up the `onClick` event on shortcut links to automatically expand the accordion when the user jumps to it.
- **Embed, Don't Segregate:** On mobile, embed critical metrics (like star ratings or shell ratings) directly into the main metadata grid or header box to create a single, unified "Title Box" instead of dedicating a large, separate card for them.
- **Condensed Icons:** Reduce utility icons (Search, Filter, Settings, MapPin, User, Calendar) from standard desktop sizes (`w-5 h-5` or `w-4 h-4`) to `w-3.5 h-3.5` or `w-3 h-3` on mobile (e.g., `w-3 h-3 sm:w-4 sm:h-4`).
- **Condensed Quick Filters & Buttons:** Reduce padding and font size for filter pills, tags, and supplementary buttons. Use `px-2 py-1 text-[10px] sm:text-xs` or `px-3 py-1.5 text-xs sm:text-sm` instead of standard bulky button sizing.
- **Card Padding:** Reduce container padding inside list cards from `p-4` or `p-6` down to `p-2 sm:p-4` or `p-3 sm:p-6`.
- **Metadata Gaps:** Tighten the spacing between metadata items (e.g., `gap-1 sm:gap-1.5` instead of `gap-2`).

## 4. Mobile Anti-Patterns (What to Avoid)
- **Avoid Bulky Sticky/Floating Filter Bars:** Sticky search/filter bars eat up 20-30% of the mobile viewport and cause "jumpy" layout shifts when scrolling. Render them as static, inline cards (`variant='inline'`) on mobile.
- **Avoid "Scale" Hacks for Responsiveness:** Do not use CSS transforms like `scale-[0.8] origin-left` to make large desktop button groups fit on mobile. This causes layout bugs and blurry text rendering. Rebuild the buttons with proper responsive utility classes (e.g., `px-3 py-1.5 text-xs sm:text-sm`).
- **Avoid Redundant Information:** Screen space is too precious for repetition. If breadcrumbs already say `Home > Greece > Attica`, do not render `<p>Attica, Greece</p>` directly underneath the Dive Site Title.
- **Avoid Custom Inline Pagination:** Never build custom pagination `<div>` blocks for individual lists. Always use the global `<Pagination />` component. It guarantees that the mobile experience (hiding verbose "Showing X of Y" labels, shrinking chevron buttons) is applied everywhere automatically.
- **Avoid Mixing Text and Icons Erratically:** In tight spaces like mobile shortcut navs, mixing long text ("Weather Conditions") with icons makes the UI look messy and causes overlap. Rely entirely on standardized icons with microscopic helper text rather than full sentences.

## 5. Typography & Iconography
- **Fluid Typography**: Consider using `clamp()` for headers that scale smoothly (e.g., `text-[clamp(1.5rem,5vw,2.5rem)]`).
- **Line Height (Leading)**: Use `leading-relaxed` or `leading-loose` on mobile to improve legibility.
- **Icon Standardization**: Refer to the `ui-icons` memory. Use icons to replace or accompany text (e.g., `TrendingUp` for Depth, `Waves` for Total Dives).
- **Selective Abbreviation**: Prioritize acronyms on mobile (e.g., "PADI" vs. "Professional Association...").
- **Visual Hierarchy**: Use bold headers and high-contrast accents to guide the eye on small screens.

## 6. Forms & Interactive Elements
- **Touch Targets (44x44px)**: Ensure all buttons/links are easy to tap. Use `p-2` or `min-h-[44px]`.
- **Active Feedback**: Always define `active:scale-95` to provide immediate visual confirmation.
- **Form Fields**: Use full-width inputs on mobile to maximize typing comfort.
- **Unique Form IDs**: Prefix all field IDs (e.g., `id="add_is_active"`) to avoid label linkage conflicts.
- **Screen Reader Context**: Use `sr-only` for labels that are visually redundant but necessary for a11y.

## 7. Component Patterns
- **Account Stats**: Use `flex justify-between items-center` for key-value pairs. Ensure values are right-aligned.
- **Certifications**: Use high-density cards. Abbreviate organizations and use status dots instead of badges.
- **Modals**: Merge related actions (like Edit + Toggle) into a single modal.
- **Data Parsing**: Use helper functions to parse complex JSON strings into compact, human-readable labels.

## 8. Library Specifics (Ant Design)
- **Card Component**: Use `variant='borderless'` instead of `bordered={false}`.
- **Statistic Component**: Use `styles={{ content: { ... } }}` instead of `valueStyle`.
- **List Component**: Prefer standard `Array.map()` with custom `div` structures over the `List` component.
- **Modal Component**: Use `destroyOnHidden` instead of `destroyOnClose`.

## 9. Implementation Checklist
- [ ] Does it work on a 320px wide viewport (iPhone SE)?
- [ ] Is there any horizontal scrolling?
- [ ] Are all touch targets at least 44px?
- [ ] Is the most critical information visible first? (Responsive Ordering)
- [ ] Does it handle the "notch" area? (Safe Area Insets)
- [ ] Are all form IDs unique across coexisting components?
- [ ] Are icons used consistently per `ui-icons` standards?
- [ ] Are long labels abbreviated or hidden on mobile?
- [ ] Do buttons wrap or stack correctly?
