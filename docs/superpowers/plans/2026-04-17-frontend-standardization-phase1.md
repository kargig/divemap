# Frontend Standardization Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Phase 1 of the frontend standardization report to unify page titles, enforce minimum mobile legibility (min 12px), and deploy the "Outfit" display font for major headers.

**Architecture:** We will create a `PageTitle` component to serve as the single source of truth for H1 styling across the app. We will replace all hardcoded tiny text classes (`text-[9px]`, `text-[10px]`, `text-[11px]`) with `text-xs` (12px) to meet accessibility guidelines. Finally, we'll apply the `font-display` Tailwind class to `PageTitle` and marketing hero headers.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Create `PageTitle` Component

**Files:**
- Create: `frontend/src/components/PageTitle.jsx`
- Modify: `frontend/src/components/PageHeader.jsx`

- [ ] **Step 1: Create `PageTitle` Component**

```jsx
import React from 'react';
import PropTypes from 'prop-types';

const PageTitle = ({ children, icon: Icon, className = '' }) => {
  return (
    <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2 sm:gap-3 ${className}`}>
      {Icon && (
        <Icon className='w-6 h-6 sm:w-8 sm:h-8 text-gray-700' aria-hidden='true' />
      )}
      <span>{children}</span>
    </h1>
  );
};

PageTitle.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
  className: PropTypes.string,
};

export default PageTitle;
```

- [ ] **Step 2: Integrate `PageTitle` into `PageHeader.jsx`**

Replace the hardcoded `h1` in `frontend/src/components/PageHeader.jsx` to use `PageTitle`:

```jsx
// ... import PageTitle ...
import PageTitle from './PageTitle';

// ... inside component ...
        {/* Title Group */}
        <div className='flex-1 min-w-0'>
          <PageTitle icon={TitleIcon}>
            {title}
          </PageTitle>
        </div>
```

### Task 2: Deploy "Outfit" Font & Standardize H1s

**Files:**
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/pages/DiveSiteDetail.jsx`
- Modify: `frontend/src/components/HeroSection.jsx`

- [ ] **Step 1: Add `font-display` to Home Hero (`frontend/src/pages/Home.jsx`)**

```jsx
// Desktop
<h1 className='text-3xl md:text-5xl lg:text-5xl font-display font-extrabold tracking-tight text-gray-900 drop-shadow-sm'>

// Mobile
<h1 className='text-3xl font-display font-extrabold tracking-tight mb-4'>
```

- [ ] **Step 2: Update `DiveSiteDetail.jsx` H1**

Replace the hardcoded small `h1` in `frontend/src/pages/DiveSiteDetail.jsx`:
```jsx
// Before:
<h1 className='text-[17px] sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words leading-tight'>
// After:
<h1 className='text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 break-words leading-tight'>
```

- [ ] **Step 3: Update `HeroSection.jsx` H1**

In `frontend/src/components/HeroSection.jsx`:
```jsx
// Before:
<h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${textColor} mb-4`}>{title}</h1>
// After:
<h1 className={`text-3xl sm:text-4xl lg:text-5xl font-display font-bold ${textColor} mb-4`}>{title}</h1>
```

### Task 3: Enforce Minimum Legibility (Remove Tiny Text)

**Files:**
- Modify: `frontend/src/components/DiveSiteCard.jsx`
- Modify: `frontend/src/pages/Dives.jsx`
- Modify: `frontend/src/components/TripCard.jsx`

- [ ] **Step 1: Replace tiny text in `DiveSiteCard.jsx`**

Replace all instances of `text-[9px]`, `text-[10px]`, `text-[11px]` with `text-xs`. Adjust `sm:text-xs` to `sm:text-sm` where appropriate to maintain hierarchy.

- [ ] **Step 2: Replace tiny text in `Dives.jsx`**

Replace all `text-[9px]`, `text-[10px]`, `text-[11px]` with `text-xs`. Adjust `sm:text-xs` to `sm:text-sm` where appropriate to maintain hierarchy.

- [ ] **Step 3: Replace tiny text in `TripCard.jsx`**

Replace all `text-[10px]` and `text-[11px]` with `text-xs`. Adjust `sm:text-xs` to `sm:text-sm` where appropriate to maintain hierarchy.
