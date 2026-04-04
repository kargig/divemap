# UI Button Standardization

## Overview
This skill provides the official guidelines for styling, sizing, and positioning buttons across the Divemap frontend. Consistent button usage ensures a predictable and professional user experience, particularly across varying screen sizes.

## Core Component Usage
Whenever possible, use the reusable `<Button>` component (`frontend/src/components/ui/Button.jsx`). It inherently supports both `<button>` elements and `react-router-dom` `<Link>` components (via the `to` prop).

## Button Variants and Colors
The system defines standard variants that dictate the color scheme and semantic meaning of the button:

1. **`primary` (Solid Blue)**
   - **Use Case:** The main call-to-action on a page or section (e.g., "Create", "Save", "Edit", "Submit").
   - **Classes:** `text-white bg-blue-600 hover:bg-blue-700 border-transparent`
   - **Icon:** Always white/currentColor.

2. **`secondary` (White/Gray Outline)**
   - **Use Case:** Secondary actions, alternative choices, or utility actions (e.g., "Share", "Cancel", "Following").
   - **Classes:** `text-gray-700 bg-white border border-gray-300 hover:bg-gray-50`

3. **`danger` (Solid Red)**
   - **Use Case:** Destructive actions (e.g., "Delete", "Archive").
   - **Classes:** `text-white bg-red-600 hover:bg-red-700 border-transparent`

4. **`ghost` (No Background/Border)**
   - **Use Case:** Low-priority actions or inline icon buttons.
   - **Classes:** `text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-transparent shadow-none`

5. **`white` (White Fill, Blue Outline)**
   - **Use Case:** Specific toggles or actions requiring high contrast but secondary hierarchy (e.g., "Follow for Updates").
   - **Classes:** `bg-white border border-blue-600 text-blue-600 hover:bg-blue-50`

## Responsive Sizing Standards
Button sizing must adapt to the viewport to maintain comfortable touch targets on mobile while preventing oversized, clunky UI on desktop.

### Mobile View (< 640px)
- **Size:** `size="sm"`
- **Padding/Text:** `px-3 py-1.5 text-xs sm:text-sm`
- **Width:**
  - For inline action bars (e.g., top of Detail pages): Allow buttons to naturally size to their content (`flex-wrap`).
  - For stacked card actions (e.g., inside summary boxes): Use `className="flex-1"` within a `flex` container to ensure buttons stretch evenly across the full width, creating massive touch targets.

### Desktop View (>= 640px)
- **Size:** `size="md"` (Default)
- **Padding/Text:** `px-3 py-2 text-sm`
- **Width:** Use `className="sm:flex-none"` so buttons stop stretching and revert to wrapping their text content tightly.

## Iconography in Buttons
- **Positioning:** Icons should be placed on the left side of the text.
- **Spacing:** Add a small margin (`mr-1.5` or `mr-2`) between the icon and text.
- **Sizing:** Use standard sizing `h-4 w-4` (or `h-3.5 w-3.5` on mobile `sm:h-4 sm:w-4`).

## Naming Conventions
- Keep button labels concise and action-oriented.
- **Do not repeat context:** Use "Edit" instead of "Edit Center" or "Edit Site". The surrounding context (e.g., being on a Diving Center page) already implies what is being edited.

## Example: Responsive Action Bar
When implementing a row of actions (like "Message Us" and "Follow"):

```jsx
<div className='flex flex-wrap gap-2 mt-3 w-full'>
  <Button
    variant='primary'
    size='sm' // Forces mobile-first padding
    className='flex-1 sm:flex-none shadow-sm' // Stretches on mobile, compact on desktop
    icon={<MessageSquare className='h-4 w-4' />}
  >
    Message Us
  </Button>
  <Button
    variant='secondary'
    size='sm'
    className='flex-1 sm:flex-none shadow-sm'
    icon={<Bell className='h-4 w-4' />}
  >
    Follow
  </Button>
</div>
```