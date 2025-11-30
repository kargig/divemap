# Button Color Coding Standards

**Last Updated:** November 30, 2025  
**Version:** 1.0

## Overview

This document defines the standardized color scheme for buttons across all forms and pages in the Divemap application. Consistent button colors improve user experience by providing visual cues about button actions and maintaining a cohesive design language.

## Color Scheme

### Primary Blue (`#0072B2` - Okabe-Ito Blue)
**Purpose:** Primary actions and main form submissions

**Colorblind-Safe:** Yes - Approved Okabe-Ito color palette

**Use for:**
- Save Changes
- Update [Entity]
- Create [Entity]
- Submit main form actions
- Primary call-to-action buttons

**Examples:**
- "Save Changes" in edit forms
- "Update Dive" in dive edit form
- "Create Diving Center" in create forms
- Main form submission buttons

**Implementation:**
```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  className='px-6 py-2 text-white rounded-md disabled:opacity-50'
  style={{ backgroundColor: UI_COLORS.primary }}
  onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#005a8a')}
  onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.primary)}
>
  Save Changes
</button>
```

### Success Green (`#009E73` - Okabe-Ito Bluish Green)
**Purpose:** Secondary/auxiliary actions, add/create operations, and auto-detect/suggest features

**Colorblind-Safe:** Yes - Approved Okabe-Ito color palette

**Use for:**
- All "Add" buttons (toggle and submit)
- Auto-detect/suggest actions
- Auxiliary form actions
- Create operations within forms (not main form submission)

**Examples:**
- "Add Alias" (toggle and submit)
- "Add Media" (toggle and submit)
- "Add Tag" (toggle and submit)
- "Add Gear Rental" (toggle and submit)
- "Add Organization"
- "Add Diving Center" (within forms)
- "Suggest Country & Region from Coordinates"
- "Re-detect from Coordinates"

**Implementation:**
```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  className='px-4 py-2 text-white rounded-md disabled:opacity-50'
  style={{ backgroundColor: UI_COLORS.success }}
  onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')}
  onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
>
  Add Item
</button>
```

### Neutral Gray (`#374151` - Dark Gray)
**Purpose:** Cancel and neutral actions

**Colorblind-Safe:** Yes - Approved neutral color from Okabe-Ito palette

**Use for:**
- All "Cancel" buttons
- Secondary/tertiary actions
- Neutral operations that don't commit changes

**Examples:**
- "Cancel" in all forms
- Cancel buttons in modal forms
- Cancel buttons in inline forms

**Implementation:**
```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  className='px-4 py-2 text-white rounded-md'
  style={{ backgroundColor: UI_COLORS.neutral }}
  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1f2937'}
  onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.neutral}
>
  Cancel
</button>
```

## Colorblind Accessibility

All button colors use the **Okabe-Ito colorblind-safe palette** as defined in `docs/development/colorblind-accessibility-guide.md`:

- **Primary Blue:** `#0072B2` (Okabe-Ito Blue) - High contrast, distinguishable by all colorblind types
- **Success Green:** `#009E73` (Okabe-Ito Bluish Green) - Distinct from blue, avoids red-green issues
- **Neutral Gray:** `#374151` (Dark Gray) - High contrast for readability

These colors are imported from `frontend/src/utils/colorPalette.js` using the `UI_COLORS` constant to ensure consistency and accessibility.

## Implementation Guidelines

### Button Hierarchy

1. **Primary Action (Blue):** The main action that commits/saves changes
2. **Secondary Actions (Green):** Supporting actions like adding items, auto-detection
3. **Cancel Actions (Gray):** Actions that discard changes or navigate away

### Consistency Rules

1. **Same Action Type = Same Color**
   - All "Add" buttons should be green
   - All "Cancel" buttons should be gray
   - All primary save/submit buttons should be blue

2. **Toggle and Submit Consistency**
   - If a form has both a toggle button (to show form) and a submit button (to submit form), both should use the same color
   - Example: "Add Media" toggle and "Add Media" submit both use green

3. **No Purple, Orange, or Red for Standard Actions**
   - Purple, orange, and red are reserved for special cases (warnings, errors, special features)
   - Standard form actions should only use blue, green, or gray

### Disabled States

All buttons should include disabled state styling:

```jsx
disabled:opacity-50 disabled:cursor-not-allowed
```

### Button Sizing

- **Primary buttons (Save/Submit):** `px-6 py-2` (larger, more prominent)
- **Secondary buttons (Add/Cancel):** `px-4 py-2` (standard size)
- **Icon buttons:** `px-4 py-2` with icon spacing

## Code Examples

### Primary Action Button

```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  type='submit'
  disabled={isLoading}
  className='flex items-center px-6 py-2 text-white rounded-md disabled:opacity-50'
  style={{ backgroundColor: UI_COLORS.primary }}
  onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#005a8a')}
  onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.primary)}
>
  <Save className='w-4 h-4 mr-2' />
  {isLoading ? 'Saving...' : 'Save Changes'}
</button>
```

### Add Action Button (Toggle)

```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  type='button'
  onClick={() => setShowForm(!showForm)}
  className='flex items-center px-4 py-2 text-white rounded-md'
  style={{ backgroundColor: UI_COLORS.success }}
  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#007a5c'}
  onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.success}
>
  <Plus className='w-4 h-4 mr-2' />
  Add Alias
</button>
```

### Add Action Button (Submit)

```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  type='button'
  onClick={handleAdd}
  disabled={isLoading}
  className='px-4 py-2 text-white rounded-md disabled:opacity-50'
  style={{ backgroundColor: UI_COLORS.success }}
  onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')}
  onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
>
  {isLoading ? 'Adding...' : 'Add Alias'}
</button>
```

### Cancel Button

```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  type='button'
  onClick={handleCancel}
  className='px-4 py-2 text-white rounded-md'
  style={{ backgroundColor: UI_COLORS.neutral }}
  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1f2937'}
  onMouseLeave={e => e.currentTarget.style.backgroundColor = UI_COLORS.neutral}
>
  Cancel
</button>
```

### Auto-Detect/Suggest Button

```jsx
import { UI_COLORS } from '../utils/colorPalette';

<button
  type='button'
  onClick={handleSuggest}
  disabled={!isValid}
  className='px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed'
  style={{ backgroundColor: UI_COLORS.success }}
  onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')}
  onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
>
  🗺️ Suggest Country & Region from Coordinates
</button>
```

## Special Cases

### Delete/Remove Actions

Delete and remove actions typically use red text/icons, not button backgrounds:

```jsx
<button
  type='button'
  onClick={handleDelete}
  className='text-red-600 hover:text-red-800'
  title='Delete item'
>
  <Trash2 className='w-4 h-4' />
</button>
```

### Text-Only Navigation Buttons

Back navigation and text-only buttons use text colors, not backgrounds:

```jsx
<button
  type='button'
  onClick={handleBack}
  className='flex items-center text-gray-600 hover:text-gray-800'
>
  <ArrowLeft className='h-4 w-4 mr-1' />
  Back
</button>
```

## Migration Checklist

When updating existing buttons to follow these standards:

- [ ] Identify all buttons on the page/form
- [ ] Categorize each button (Primary/Secondary/Cancel)
- [ ] Update colors to match the scheme:
  - [ ] Primary actions → Blue
  - [ ] Add/auxiliary actions → Green
  - [ ] Cancel actions → Gray
- [ ] Ensure toggle and submit buttons for the same action use the same color
- [ ] Add disabled states where appropriate
- [ ] Test button states (hover, disabled, active)
- [ ] Verify consistency across related forms

## Related Documentation

- [CSS and Styling Guide](./css-and-sticky-positioning-guide.md)
- [Colorblind Accessibility Guide](./colorblind-accessibility-guide.md)
- [Color Implementation Examples](./color-implementation-examples.md)

## Enforcement

- **Code Reviews:** All new buttons must follow this color scheme
- **Linting:** Consider adding ESLint rules to enforce button color classes
- **Documentation:** Update this guide when new patterns emerge

## Questions or Updates

If you encounter a button that doesn't fit these categories or need to add a new pattern, please:
1. Document the use case
2. Propose a color assignment
3. Update this guide with the decision

