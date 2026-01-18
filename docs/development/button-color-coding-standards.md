# Button Color Coding Standards

**Last Updated:** January 17, 2026
**Version:** 2.0

## Overview

This document defines the standardized button component and color scheme for the Divemap application. To ensure consistency, all buttons should use the shared `Button` component located at `frontend/src/components/ui/Button.js`.

## The Button Component

All new and existing buttons should be migrated to use the `Button` component:

```jsx
import Button from '../components/ui/Button';
```

### Props API

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | string | `'primary'` | Visual style (see below) |
| `size` | string | `'md'` | Size: `'xs'`, `'sm'`, `'md'`, `'lg'` |
| `icon` | ReactNode | `null` | Icon component (e.g., `<Edit />`) placed before text |
| `to` | string | `null` | If provided, renders as a React Router `<Link>` |
| `onClick` | func | `null` | Click handler for standard buttons |
| `disabled` | bool | `false` | Disables interaction and applies opacity |

## Standard Variants

### 1. Primary (`variant="primary"`)
**Visual:** Solid Blue (`bg-blue-600`, `text-white`)
**Usage:**
- **Main Call to Action:** The single most important action on a page (e.g., "Get Driving Directions").
- **Edit Actions:** All "Edit" buttons for detailed entities (Dive Sites, Dives, etc.) are Primary to make them visually distinct for administrators/owners.
- **Form Submission:** "Save Changes", "Create", "Submit".

```jsx
<Button variant="primary" icon={<Edit className="h-4 w-4" />}>
  Edit
</Button>
```

### 2. Secondary (`variant="secondary"`)
**Visual:** White with Gray Border (`bg-white`, `border-gray-300`, `text-gray-700`)
**Usage:**
- **Secondary Actions:** "Share", "Copy", "Export".
- **Navigation:** "Cancel", "Back".
- **Alternative Options:** When a primary action exists, peer actions should be secondary.

```jsx
<Button variant="secondary" icon={<Share2 className="h-4 w-4" />}>
  Share
</Button>
```

### 3. Danger (`variant="danger"`)
**Visual:** Solid Red (`bg-red-600`, `text-white`)
**Usage:**
- **Destructive Actions:** "Delete", "Remove", "Block".
- **Critical Warnings:** Actions that cannot be undone.

```jsx
<Button variant="danger" icon={<Trash2 className="h-4 w-4" />}>
  Delete
</Button>
```

### 4. White (`variant="white"`)
**Visual:** White with Blue Border (`bg-white`, `border-blue-600`, `text-blue-600`)
**Usage:**
- **Alternative Primary:** Used when a button needs to stand out against a busy background or sit next to a Primary button without competing for dominance (e.g., "Full Map View" next to "Get Directions").

```jsx
<Button variant="white" icon={<Map className="h-4 w-4" />}>
  View Map
</Button>
```

### 5. Ghost (`variant="ghost"`)
**Visual:** Transparent (`text-gray-500`, hover `bg-gray-100`)
**Usage:**
- **Low Priority:** Tertiary actions, icon-only buttons in toolbars, or quiet navigation links.

## Action-Specific Standards

To maintain a consistent user experience, specific actions MUST always map to the following variants:

| Action | Required Variant | Rationale |
|---|---|---|
| **Edit** | `primary` | Visual prominence for owners/admins to quickly identify management controls. |
| **Delete** | `danger` | Clear warning of destructive capability. |
| **Share** | `secondary` | Useful but optional utility; should not compete with Edit/View. |
| **Copy** | `secondary` | Utility action. |
| **Export** | `secondary` | Utility action. |
| **Cancel** | `secondary` / `ghost` | Safe exit path, distinct from the primary "Save". |

## Icon Standards

- **Library:** `lucide-react`
- **Size:** Standard icon size inside buttons is `h-4 w-4` (16px).
- **Spacing:** The `Button` component handles icon-to-text spacing automatically (`mr-1.5`).

## Implementation Checklist

When adding a new button:
1.  Import `Button` from `components/ui/Button`.
2.  Choose the semantic variant (Primary for main goal, Secondary for utilities, Danger for deletion).
3.  Pass an icon prop if applicable (preferred for major actions).
4.  Do **not** use raw `<button>` or `<Link>` elements with Tailwind classes unless absolutely necessary for a custom non-standard UI element.