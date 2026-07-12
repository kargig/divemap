# Subtle Accent Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Subtle Accent Badge next to the main title in 5 search/list pages supporting infinite scrolling (Dive Sites, Diving Centers, Dives, Dive Trips, Dive Routes).

**Architecture:** Extend the reusable `PageTitle` and `PageHeader` components to accept a `badge` prop, and then update each list page to pass its dynamic `totalCount` (obtained from its React Query infinite query) as the badge value.

**Tech Stack:** React, Tailwind CSS, Lucide Icons, React Query.

---

### Task 1: Update PageTitle Component

**Files:**
- Modify: `frontend/src/components/PageTitle.jsx`

- [ ] **Step 1: Modify `PageTitle.jsx` implementation to accept and render `badge`**
  Add the `badge` prop and render it inside the title element using the specified Tailwind styles. Update `propTypes`.

  ```jsx
  import PropTypes from 'prop-types';
  import React from 'react';

  /**
   * PageTitle Component
   *
   * The standardized H1 for the entire application.
   * Uses the 'Outfit' display font and maintains consistent responsive sizing.
   */
  const PageTitle = ({ children, icon: Icon, badge, className = '' }) => {
    return (
      <h1
        className={`text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 tracking-tight flex items-center flex-wrap gap-2 sm:gap-3 ${className}`}
      >
        <div className='flex items-center gap-2 sm:gap-3'>
          {Icon && <Icon className='w-6 h-6 sm:w-8 sm:h-8 text-gray-700' aria-hidden='true' />}
          <span>{children}</span>
        </div>
        {badge !== undefined && badge !== null && (
          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-semibold bg-blue-50 text-blue-600 border border-blue-100 transition-all duration-300'>
            {typeof badge === 'number' ? badge.toLocaleString() : badge}
          </span>
        )}
      </h1>
    );
  };

  PageTitle.propTypes = {
    children: PropTypes.node.isRequired,
    icon: PropTypes.elementType,
    badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    className: PropTypes.string,
  };

  export default PageTitle;
  ```

- [ ] **Step 2: Commit changes to PageTitle**
  ```bash
  git commit -m "feat: add badge prop and styles to PageTitle component"
  ```

---

### Task 2: Update PageHeader Component

**Files:**
- Modify: `frontend/src/components/PageHeader.jsx`

- [ ] **Step 1: Modify `PageHeader.jsx` to pass `badge` to `PageTitle`**
  Update `PageHeader` signature, usage of `PageTitle`, and its `propTypes`.

  ```jsx
  const PageHeader = ({
    title,
    titleIcon: TitleIcon,
    badge, // Added prop
    breadcrumbItems = [],
    actions = [],
    className = '',
  }) => {
    return (
      <div className={`mb-4 sm:mb-8 ${className}`}>
        {/* Navigation Context */}
        {breadcrumbItems.length > 0 && (
          <div className='mb-2 sm:mb-4'>
            <Breadcrumbs items={breadcrumbItems} />
          </div>
        )}

        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6'>
          {/* Title Group */}
          <div className='flex-1 min-w-0'>
            <PageTitle icon={TitleIcon} badge={badge}>{title}</PageTitle>
          </div>
  ```

  Update propTypes:
  ```jsx
  PageHeader.propTypes = {
    title: PropTypes.string.isRequired,
    titleIcon: PropTypes.elementType,
    badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    breadcrumbItems: PropTypes.array,
    actions: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        onClick: PropTypes.func,
        to: PropTypes.string,
        icon: PropTypes.elementType,
        variant: PropTypes.oneOf(['primary', 'secondary', 'ghost']),
        ariaLabel: PropTypes.string,
      })
    ),
    className: PropTypes.string,
  };
  ```

- [ ] **Step 2: Commit changes to PageHeader**
  ```bash
  git commit -m "feat: support and forward badge prop in PageHeader component"
  ```

---

### Task 3: Integrate Badge in Dive Sites Page

**Files:**
- Modify: `frontend/src/pages/DiveSites.jsx`

- [ ] **Step 1: Modify `DiveSites.jsx` to pass the dynamic `totalCount` to `PageHeader`**
  Locate `PageHeader` in `DiveSites.jsx` (around line 609-612) and add:
  `badge={isLoading ? null : totalCount}`

- [ ] **Step 2: Commit changes to DiveSites**
  ```bash
  git commit -m "feat: show matching totalCount badge on Dive Sites page"
  ```

---

### Task 4: Integrate Badge in Diving Centers Page

**Files:**
- Modify: `frontend/src/pages/DivingCenters.jsx`

- [ ] **Step 1: Modify `DivingCenters.jsx` to pass the dynamic `totalCount` to `PageHeader`**
  Locate `PageHeader` in `DivingCenters.jsx` (around line 337-340) and add:
  `badge={isLoading ? null : totalCount}`

- [ ] **Step 2: Commit changes to DivingCenters**
  ```bash
  git commit -m "feat: show matching totalCount badge on Diving Centers page"
  ```

---

### Task 5: Integrate Badge in Dives Page

**Files:**
- Modify: `frontend/src/pages/Dives.jsx`

- [ ] **Step 1: Modify `Dives.jsx` to pass the dynamic `totalCount` to `PageHeader`**
  Locate `PageHeader` in `Dives.jsx` (around line 753-756) and add:
  `badge={isLoading ? null : totalCount}`

- [ ] **Step 2: Commit changes to Dives**
  ```bash
  git commit -m "feat: show matching totalCount badge on Dives list page"
  ```

---

### Task 6: Integrate Badge in Dive Trips Page

**Files:**
- Modify: `frontend/src/pages/DiveTrips.jsx`

- [ ] **Step 1: Modify `DiveTrips.jsx` to pass the dynamic `totalCount` to `PageHeader`**
  Locate `PageHeader` in `DiveTrips.jsx` (around line 662-665) and add:
  `badge={isLoading ? null : totalCount}`

- [ ] **Step 2: Commit changes to DiveTrips**
  ```bash
  git commit -m "feat: show matching totalCount badge on Dive Trips page"
  ```

---

### Task 7: Integrate Badge in Dive Routes Page

**Files:**
- Modify: `frontend/src/pages/DiveRoutes.jsx`

- [ ] **Step 1: Modify `DiveRoutes.jsx` to pass the dynamic `totalCount` to `PageHeader`**
  Locate `PageHeader` in `DiveRoutes.jsx` (around line 170-173) and add:
  `badge={isLoading ? null : totalCount}`

- [ ] **Step 2: Commit changes to DiveRoutes**
  ```bash
  git commit -m "feat: show matching totalCount badge on Dive Routes page"
  ```

---

### Task 8: Verification & Quality Assurance

- [ ] **Step 1: Run Frontend Linter**
  Run: `make lint-frontend`
  Ensure no lint errors are introduced. Check `frontend-lint-errors.log` if any issues arise.

- [ ] **Step 2: Verify in Browser via MCP**
  Launch the browser session and navigate to the list pages. Verify that the badges load correctly with actual numbers, scale and wrap cleanly without vertical/horizontal overflow.
