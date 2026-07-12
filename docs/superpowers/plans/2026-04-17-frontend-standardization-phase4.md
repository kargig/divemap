# Frontend Standardization Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 4 of the frontend standardization report focusing on unifying the Action Buttons in `DiveSiteDetail.jsx`.

**Architecture:** The `DiveSiteDetail` page is currently using raw `<button>` tags with hardcoded Tailwind padding and red-outline styling for the "Archive" and "Restore" actions, breaking the visual consistency established in Phase 2. We will refactor these to use the standard `<Button variant='danger' size='sm'>` and add a new `warning` variant to `<Button>` to properly support the yellow "Restore" action.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Expand `<Button>` with Warning Variant

**Files:**
- Modify: `frontend/src/components/ui/Button.jsx`

- [ ] **Step 1: Add `warning` to the variants object**
Add `warning` variant to `variants` and update `PropTypes`.

```jsx
// Before
    danger: 'border border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-sm transition-all',
// After
    danger: 'border border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-sm transition-all',
    warning: 'border border-transparent text-white bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500 shadow-sm transition-all',
```

```jsx
// Before
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost', 'white']),
// After
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'warning', 'ghost', 'white']),
```

### Task 2: Standardize `DiveSiteDetail.jsx` Action Buttons

**Files:**
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`

- [ ] **Step 1: Replace raw buttons with `<Button>` component**
In the `shouldShowEdit`, `shouldShowDelete`, and `shouldShowRestore` blocks, replace the custom raw buttons with our standard `<Button>` component.

```jsx
// Before
                {shouldShowEdit && (
                  <Button
                    to={`/dive-sites/${id}/edit`}
                    variant='primary'
                    icon={<Edit className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                    className='px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm'
                  >
                    Edit
                  </Button>
                )}
// After
                {shouldShowEdit && (
                  <Button
                    to={`/dive-sites/${id}/edit`}
                    variant='primary'
                    size='sm'
                    icon={<Edit className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                  >
                    Edit
                  </Button>
                )}
```

```jsx
// Before
                {shouldShowDelete && (
                  <button
                    onClick={handleDelete}
                    className='inline-flex items-center px-3 py-1.5 border border-red-300 text-xs sm:text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm transition-colors'
                    title='Archive dive site'
                  >
                    <Trash2 className='h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5' />
                    Archive
                  </button>
                )}
// After
                {shouldShowDelete && (
                  <Button
                    onClick={handleDelete}
                    variant='danger'
                    size='sm'
                    icon={<Trash2 className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                    title='Archive dive site'
                  >
                    Archive
                  </Button>
                )}
```

```jsx
// Before
                {shouldShowRestore && (
                  <button
                    onClick={handleRestore}
                    className='inline-flex items-center px-3 py-1.5 border border-yellow-400 text-xs sm:text-sm font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 shadow-sm transition-colors'
                    title='Restore dive site'
                  >
                    <RotateCcw className='h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5' />
                    Restore
                  </button>
                )}
// After
                {shouldShowRestore && (
                  <Button
                    onClick={handleRestore}
                    variant='warning'
                    size='sm'
                    icon={<RotateCcw className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                    title='Restore dive site'
                  >
                    Restore
                  </Button>
                )}
```
