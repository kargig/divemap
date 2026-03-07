---
name: ui-navbar-guidelines
description: Standards and UX principles for modifying the desktop and mobile navigation bars. Use when asked to add, remove, or rearrange items in the header, or when tasked with saving horizontal space in the UI.
---

# Navbar UX Guidelines

This skill outlines the standard design principles and layout rules for modifying the main navigation bar in the Divemap project. 

## 1. Do Not Merge Messages and Notifications

While both involve alerts, they serve entirely different user intents and must remain as separate, distinct icons on the top level of the UI.
*   **Messages (`MessageSquare`):** Synchronous, peer-to-peer communication. High urgency.
*   **Notifications (`Bell`):** Asynchronous system broadcasts (new sites, trips). Lower urgency.
*   **Rule:** Never merge these into a single "Inbox" dropdown. Both must be visible to display their respective unread badge counts (`unreadChatCount` and `unreadCount`).

## 2. Desktop Real Estate Optimization

The desktop navbar has limited horizontal space, especially for users on smaller laptops. If you need to add a new section, use these strategies to save space:

### Consolidation (The "Explore" Pattern)
Group related secondary pages into overarching dropdown menus rather than placing them on the top level.
*   **Example:** "Dive Sites", "Dive Routes", "Diving Centers", and "Dive Trips" should all live under a single `Dive / Explore` (`Compass` icon) dropdown. 

### Icon-Only Actions
Action buttons on the right side of the navbar should rely exclusively on easily recognizable icons, completely removing text labels.
*   **Rule:** Use standard icons (Messages, Bell, Info, Profile Avatar, Logout).
*   **Accessibility:** You *must* include a descriptive `title` attribute (e.g., `title="Logout"`) on the `<button>` or `<Link>` element so browsers display a tooltip on hover.

### Logical Grouping & Dividers
*   Group core platform actions (Messages, Notifications).
*   Group user/system actions (Admin, Info, Profile).
*   **The Logout Button:** The Logout button must ALWAYS be the absolute right-most element in the navbar, visually separated from the rest of the navigation items. 

## 3. Mobile Drawer Principles

The mobile navigation (hamburger menu) functions differently than the desktop view.

*   **Rule 1: Avoid Redundancy:** The top-level sticky header on mobile already contains the `MessageSquare` and `Bell` icons. Do not duplicate these links inside the slide-out drawer list, as it wastes space and causes confusion.
*   **Rule 2: Grouping Match:** The categorization inside the mobile accordion (`Collapse` components) should perfectly mirror the dropdown structure used on the desktop navbar (e.g., the "Dive / Explore" grouping).