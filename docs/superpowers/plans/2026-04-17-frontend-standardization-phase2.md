# Frontend Standardization Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 2 of the frontend standardization report to eliminate custom CSS buttons, standardize form and action button paddings, enforce accessible mobile touch targets, and unify Admin pages.

**Architecture:** We will enhance the existing `frontend/src/components/ui/Button.jsx` to cover all our required styling variants, including replacing `.btn-primary` and the legacy blue colors. We will remove `.btn-primary` and `.btn-secondary` from `index.css`. We will fix the micro touch targets in `TripCard.jsx` to meet accessibility guidelines. Finally, we will standardize `AdminUsers.jsx` as a proof-of-concept for Admin Panel unification.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Update the UI Button Component

**Files:**
- Modify: `frontend/src/components/ui/Button.jsx`

- [ ] **Step 1: Enhance `Button.jsx`**

Update `frontend/src/components/ui/Button.jsx` to include the standard sizes defined in the report and implement the new `divemap-blue` styling. 

Replace the `variants` and `sizes` objects:

```jsx
  const variants = {
    primary: 'border border-transparent text-white bg-divemap-sky hover:bg-divemap-blue focus:ring-divemap-sky shadow-sm transition-all',
    secondary: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-divemap-blue shadow-sm transition-all',
    danger: 'border border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-sm transition-all',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 shadow-none border-transparent transition-all',
    white: 'bg-white border border-divemap-blue text-divemap-blue hover:bg-blue-50 shadow-sm transition-all', 
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };
```

### Task 2: Purge Legacy CSS Buttons

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Delete `.btn-primary` and `.btn-secondary`**

Remove the following blocks from `frontend/src/index.css`:

```css
/* Enhanced Button Styling */
.btn-primary {
  background: linear-gradient(135deg, #56b4e9 0%, #0072b2 100%);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #0072b2 0%, #004d7a 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 114, 178, 0.3);
}

.btn-secondary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}
```

### Task 3: Fix Mobile Touch Targets in TripCard

**Files:**
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Expand touch targets for Edit/Delete buttons**

In `frontend/src/components/TripCard.jsx`, find the edit and delete buttons and ensure their touch target is at least 44x44px (`min-h-[44px] min-w-[44px]`) on mobile, while keeping the visual padding tight if needed.

Update the `onEdit` button:
```jsx
// Before
                    <button
                      onClick={() => onEdit?.(trip)}
                      className='p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                      title='Edit Trip'
                    >
                      <Edit className='h-4 w-4' />
                    </button>
// After
                    <button
                      onClick={() => onEdit?.(trip)}
                      className='min-h-[44px] min-w-[44px] flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                      title='Edit Trip'
                    >
                      <Edit className='h-5 w-5' />
                    </button>
```

Update the `onDelete` button:
```jsx
// Before
                    <button
                      onClick={() => onDelete?.(trip.id)}
                      className='p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors'
                      title='Delete Trip'
                    >
                      <X className='h-4 w-4' />
                    </button>
// After
                    <button
                      onClick={() => onDelete?.(trip.id)}
                      className='min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:bg-red-50 rounded-md transition-colors'
                      title='Delete Trip'
                    >
                      <X className='h-5 w-5' />
                    </button>
```

### Task 4: Standardize Admin Page Typography

**Files:**
- Modify: `frontend/src/pages/AdminUsers.jsx`

- [ ] **Step 1: Add PageTitle to AdminUsers**

In `frontend/src/pages/AdminUsers.jsx`:

1. Import `PageTitle`:
```jsx
import PageTitle from '../components/PageTitle';
```

2. Replace the `h1`:
```jsx
// Before:
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>User Management</h1>

// After:
          <PageTitle>User Management</PageTitle>
```
