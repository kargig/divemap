# Button Styling Standards

This document outlines the standard colors and usage rules for buttons across the Divemap frontend to ensure visual hierarchy and brand consistency.

## Color Definitions

- **Primary Button:** `#0072B2` (`divemap-blue`). Core brand "True Blue" from the Okabe-Ito palette.
- **Secondary Button:** White background with `gray-300` border and `gray-700` text. Hover: `bg-gray-50`.
- **Danger Button:** Red (`#DC2626` / Tailwind `red-600`). Used for destructive actions.

## Rules for Button Selection

1.  **Single Primary Action:** Each page MUST have only ONE Primary button. This identifies the most important action for the user on that screen.
2.  **Add/Suggest Actions:**
    - On list/index pages, "Add" or "Suggest" buttons (e.g., "Suggest a New Site") should be **Primary**.
    - Other high-level actions on the same page (e.g., "Explore on Map") must be **Secondary**.
3.  **Details & Edit Pages:**
    - On **Detail** pages, the **"Edit"** button is the Primary action.
    - On **Edit/Create** form pages, the **"Save"**, **"Update"**, or **"Create"** button is the Primary action.
    - Inline "Add" actions within forms (e.g., "Add Dive", "Add Tag", "Add Gear") MUST be **Secondary** to avoid competing with the main form submission.
4.  **Destructive Actions:** "Delete", "Archive", or "Remove" actions should always use the **Danger Red** classification.
5.  **Navigation/Utility:** "Cancel", "Back", "Share", and external links (e.g., "Get Directions") should generally be **Secondary** or **Ghost** variants.

## Component Implementation

Prefer using the custom `<Button>` component from `src/components/ui/Button.jsx`:
```jsx
<Button variant='primary'>Save Changes</Button>
<Button variant='secondary'>Cancel</Button>
<Button variant='danger'>Delete</Button>
```
If using raw `<button>` elements, apply Tailwind classes consistent with the definitions above.
