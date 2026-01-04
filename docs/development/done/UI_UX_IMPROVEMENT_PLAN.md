# UI/UX Improvement Plan

## Card Layout Standardization Report

This report identifies inconsistencies in card layouts across the three main listing pages: **Dive Log**, **Dive Sites**, and **Dive Routes**. The goal is to standardize the placement of key details (Rating, Stats, Creator, Tags) to ensure a unified user experience.

| Feature | Dive Log (`/dives`) | Dive Sites (`/dive-sites`) | Dive Routes (`/dive-routes`) | **Standard** |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | Title + Kicker (Site) | Title + Kicker (Location) | Title + Kicker (Site) | Title + Context Kicker |
| **Rating** | Top Right (Star Icon + Value) | Stats Strip (Star Icon + Value) | *N/A* (No rating yet) | **Top Right** (Star Icon + Value) |
| **Stats Strip** | Border-Y, Icons + Label + Value | Border-Y, Icons + Label + Value | Border-Y, Icons + Label + Value | Border-Y, Icons + Label + Value |
| **Creator** | Footer (Right), "User Icon + Name" | Footer (Left), "User Icon + Name" | Footer (Left), "User Icon + Name" | **Footer (Left)**, "User Icon + Name" |
| **Tags** | Footer (Left), Pill Style | Footer (Left), Pill Style | *N/A* | Footer (Left), Pill Style |
| **Actions** | Footer (Right), "View Details" | Footer (Right), "View Details" | Footer (Right), "View Route" | Footer (Right), Contextual Action |

### Planned Changes

1.  **Dive Sites:**
    *   **Move Rating:** Move the Rating display from the Stats Strip to the Top Right corner of the card header (List View).
    *   *Grid View:* Ensure consistency with List View adjustments where applicable.

2.  **Dive Routes:**
    *   *No changes needed for Rating as routes don't currently display ratings.*
    *   Ensure Creator placement is consistent (Left).

3.  **General:**
    *   Verify CSS classes for spacing and typography match exactly across all three components.

---

## Completed Tasks

### Phase 1: Foundations (CSS/Tailwind)
- [x] Analyze `tailwind.config.js` and `index.css`.
- [x] Create/Update `tailwind.config.js` with semantic colors.
- [x] Clean up `index.css`.

### Phase 2: Dives List Refactor (Cleaner, De-boxed)
- [x] Create `PageHeader.js`.
- [x] Create `EmptyState.js`.
- [x] Refactor `Dives.js` List View.
- [x] Refactor `Dives.js` Grid View.

### Phase 3: Dive Sites List Refactor (Hierarchy, Kickers)
- [x] Refactor `DiveSites.js` List View.
- [x] Refactor `DiveSites.js` Grid View.
- [x] Make Location Breadcrumbs clickable.

### Phase 4: Nav & Global Polish (Home semantics, Empty States)
- [x] Refactor `Home.js` (Billboard Hero).
- [x] Update `Navbar.js` (Mobile Menu).
- [x] Standardize `LoadingSkeleton.js`.

### Phase 5: Navigation Refinement (Implemented)
- [x] Implement "Diving" Dropdown in `Navbar.js`.
- [x] Rename "Dives" to "Dive Log" in menu.
- [x] Add "Dive Routes" link (Implemented new page).
- [x] Update Mobile Menu to support the new nesting.

### Phase 6: Hero & Header Overhaul
- [x] Replace `HeroSection` with `PageHeader` in `Dives.js`.
- [x] Replace `HeroSection` with `PageHeader` in `DiveSites.js`.

### Phase 7: Dive Routes Implementation
- [x] Create `DiveRoutes.js` page.
- [x] Add `getDiveRoutes` to `api.js`.
- [x] Register route in `App.js`.
- [x] Implement List/Grid views with `ResponsiveFilterBar`.
- [x] Fix "Back" navigation in `RouteDetail.js`.
- [x] Standardize Creator/Stats display.

### Phase 8: Card Standardization (Current)
- [x] Move Rating in `DiveSites.js` to Top Right (Header).
- [x] Verify Creator placement consistency.
- [x] Standardize Pagination Controls in `DiveRoutes.js` (Added top/bottom controls with page size selector).