# React Libraries Migration Plan

## Overview

This document outlines a prioritized plan for replacing custom-built React components with well-maintained, accessible, and feature-rich libraries. The plan is ordered by priority and impact on code quality, maintainability, and user experience.

## Priority Ranking Criteria

1. **High Priority**: Components used frequently across the app, complex custom logic, accessibility issues, or maintenance burden
2. **Medium Priority**: Components with moderate usage, some custom logic, or potential for improvement
3. **Low Priority**: Components that work well but could benefit from library features

---

## Priority 1: Form Management & Validation (HIGHEST IMPACT)

### **Library: React Hook Form + Zod**

**Current State:**
- Manual form state management with `useState` in multiple components
- Custom validation logic scattered across components (Register.js, CreateDive.js, EditDive.js, DivingCenterForm.js, etc.)
- Manual error handling and field-level error states
- No type-safe validation

**Why This First:**
- Forms are everywhere (dives, dive sites, diving centers, trips, user registration)
- Reduces code by ~60-70% per form
- Built-in validation with excellent TypeScript support
- Better performance (uncontrolled components)
- Automatic error handling and display

**Impact:**
- **Files Affected**: ~15-20 form components
- **Code Reduction**: ~2000-3000 lines
- **UX Improvement**: Consistent validation, better error messages
- **Maintainability**: Single source of truth for validation rules

**Migration Effort**: Medium (2-3 weeks)

---

## Priority 2: Modal/Dialog System (HIGH IMPACT)

### **Library: Radix UI Dialog (@radix-ui/react-dialog)**

**Current State:**
- Custom modal implementations in:
  - `DiveProfileModal.js` - manual ESC handling, backdrop click, body scroll lock
  - `TripFormModal.js` - inline modal rendering
  - `ShareModal.js` - custom modal
  - `ImportDivesModal.js` - complex modal with file upload
  - `Help.js` - image modal viewer
- Manual focus trap, accessibility, and keyboard handling
- Inconsistent modal patterns across components

**Why This Second:**
- Accessibility is critical (WCAG compliance)
- Focus management is complex and error-prone
- Consistent modal UX across the app
- Built-in animations and transitions

**Impact:**
- **Files Affected**: ~8-10 modal components
- **Code Reduction**: ~800-1000 lines
- **UX Improvement**: Better keyboard navigation, screen reader support
- **Accessibility**: WCAG 2.1 AA compliant out of the box

**Migration Effort**: Low-Medium (1-2 weeks)

**Alternative Consideration**: Headless UI Dialog (similar features, different API)

---

## Priority 3: Dropdown/Select Components (HIGH IMPACT)

### **Library: Radix UI Select (@radix-ui/react-select)**

**Current State:**
- Custom dropdown implementations in:
  - `RouteSelection.js` - custom dropdown with click-outside handling
  - `UserSearchInput.js` - autocomplete dropdown
  - `FuzzySearchInput.js` - complex search dropdown
  - `GlobalSearchBar.js` - search results dropdown
  - `ResponsiveFilterBar.js` - multiple custom dropdowns
  - `Navbar.js` - Info and Admin dropdowns
- Manual click-outside detection, keyboard navigation, focus management
- Inconsistent dropdown behavior

**Why This Third:**
- Dropdowns are used extensively (filters, selects, search)
- Complex keyboard navigation logic
- Accessibility requirements (ARIA)
- Consistent UX across dropdowns

**Impact:**
- **Files Affected**: ~10-12 components
- **Code Reduction**: ~1200-1500 lines
- **UX Improvement**: Better keyboard navigation, consistent behavior
- **Accessibility**: Full ARIA support

**Migration Effort**: Medium (2 weeks)

**Alternative Consideration**: Headless UI Listbox (for simpler selects)

---

## Priority 4: Date & Time Pickers (MEDIUM-HIGH IMPACT)

### **Library: React DatePicker (react-datepicker) or @radix-ui/react-calendar**

**Current State:**
- Custom `WindDateTimePicker.js` - slider-based time picker (good for this use case)
- Native HTML5 date/time inputs in forms (TripFormModal, CreateDive, etc.)
- No date range selection
- Limited date formatting and validation

**Why This Fourth:**
- Native date inputs have poor UX (especially mobile)
- Need for date ranges (filtering dives by date range)
- Better mobile support
- Consistent date formatting

**Impact:**
- **Files Affected**: ~8-10 components with date inputs
- **Code Reduction**: ~400-600 lines
- **UX Improvement**: Better mobile experience, date range selection
- **Internationalization**: Built-in locale support

**Migration Effort**: Low-Medium (1-2 weeks)

**Note**: Keep `WindDateTimePicker` as-is (custom slider is appropriate for that use case)

---

## Priority 5: Tooltip & Popover System (MEDIUM IMPACT)

### **Library: Radix UI Tooltip & Popover (@radix-ui/react-tooltip, @radix-ui/react-popover)**

**Current State:**
- Custom tooltips in:
  - `WindOverlayToggle.js` - custom hover tooltip
  - `AdvancedDiveProfileChart.js` - custom chart tooltip (keep this, Recharts handles it)
  - Various inline tooltips using title attributes
- Manual positioning, hover state management
- No consistent tooltip styling

**Why This Fifth:**
- Tooltips improve UX for icon-only buttons
- Consistent positioning and animations
- Accessibility (keyboard support, screen readers)
- Better mobile support (touch interactions)

**Impact:**
- **Files Affected**: ~15-20 components
- **Code Reduction**: ~300-400 lines
- **UX Improvement**: Consistent tooltip behavior
- **Accessibility**: Proper ARIA attributes

**Migration Effort**: Low (1 week)

---

## Priority 6: Data Tables & Grids (MEDIUM IMPACT) ✅ COMPLETED

### **Library: TanStack Table (React Table v8)**

**Status**: ✅ **COMPLETED** - All main admin tables successfully migrated

**Implementation Date**: December 22, 2025

**Current State:**

- ✅ `AdminDiveSites.js` - **MIGRATED** to TanStack Table
- ✅ `AdminDivingCenters.js` - **MIGRATED** to TanStack Table
- ✅ `AdminUsers.js` - **MIGRATED** to TanStack Table
- ✅ `AdminDives.js` - **MIGRATED** to TanStack Table
- ⏳ Other admin tables (pending)

**Why This Sixth:**

- Admin tables are complex (sorting, filtering, pagination)
- Better performance for large datasets
- Built-in virtualization for large tables
- Consistent table UX

**Impact:**

- **Files Affected**: ~6-8 admin table components
- **Code Complexity Reduction**: Removed 50+ instances of imperative code per table
- **Maintainability**: Declarative code vs imperative code (easier to modify)
- **UX Improvement**: Better performance (server-side sorting), consistent sorting/filtering
- **Features**: Column visibility, export options, mobile card view
- **Note**: Lines of code may increase initially due to new features, but complexity decreases significantly. See `docs/development/tanstack-table-migration-analysis.md` for detailed metrics.

**Migration Effort**: Medium-High (2-3 weeks per table)

**Recommendation**: TanStack Table for headless approach (more flexible), AG Grid for feature-rich out-of-the-box solution

### ✅ AdminDiveSites Migration Results

**Files Created:**
- `frontend/src/components/tables/AdminDiveSitesTable.js` - Reusable table component
- Updated `frontend/src/pages/AdminDiveSites.js` - Migrated to TanStack Table

**Features Implemented:**

- ✅ Server-side sorting (with backend API field mapping)
- ✅ Server-side pagination
- ✅ Column visibility toggle (with optional hidden columns)
- ✅ Row selection (checkbox-based)
- ✅ Mass delete functionality
- ✅ Export Page (CSV export of current page)
- ✅ Export All (CSV export of all filtered results)
- ✅ Mobile-responsive card view
- ✅ Debounced search with immediate visual feedback
- ✅ URL parameter synchronization
- ✅ Loading and empty states

**Code Improvements:**

- **Reusability**: Created `AdminDiveSitesTable` component for reuse
- **Maintainability**: Easier to add/modify columns
- **Performance**: Better handling of large datasets
- **UX**: Mobile card view, column visibility, export features

**Lessons Learned:**

1. **Backend API Mapping**: Frontend column IDs may differ from backend sort fields (e.g., `difficulty_code` → `difficulty_level`)
2. **Debouncing**: Use separate state for input value vs. filter value for immediate visual feedback
3. **Column Visibility**: Hidden columns should be configurable per table
4. **Mobile Responsiveness**: Card-based layout essential for mobile UX
5. **Export Functionality**: Both page-level and full dataset exports are valuable

**Migration Summary:**

All four main admin tables have been successfully migrated:
- ✅ AdminDiveSites (December 22, 2025)
- ✅ AdminDivingCenters (December 22, 2025)
- ✅ AdminUsers (December 22, 2025)
- ✅ AdminDives (December 22, 2025)

**Key Achievements:**
- 100% consistency across all admin tables
- Server-side pagination, sorting, and search implemented
- Mobile-responsive card views
- Column visibility and CSV export on all pages
- URL parameter synchronization
- Comprehensive test coverage (20 tests for AdminDives search)

**Next Steps:**

- Migrate remaining admin tables using the same pattern
- See `docs/development/react-libraries-migration-plan-priority6-tables-testing.md` for migration guide
- See `docs/development/admin-tables-comparison.md` for feature comparison

---

## Priority 7: Autocomplete/Search Components (MEDIUM IMPACT)

### **Library: Downshift or Combobox from Radix UI**

**Current State:**
- Custom autocomplete in:
  - `UserSearchInput.js` - manual debouncing, keyboard navigation
  - `FuzzySearchInput.js` - complex fuzzy search with highlighting
  - `GlobalSearchBar.js` - search with results dropdown
  - `DiveSitesFilterBar.js` - dive site autocomplete

**Why This Seventh:**
- Complex keyboard navigation logic
- Accessibility requirements
- Consistent search UX
- Better mobile support

**Impact:**
- **Files Affected**: ~4-5 search components
- **Code Reduction**: ~600-800 lines
- **UX Improvement**: Better keyboard navigation, consistent behavior
- **Accessibility**: Full ARIA support

**Migration Effort**: Medium (1-2 weeks)

**Note**: May need to keep fuzzy search logic, but use library for UI/UX

---

## Priority 8: Tabs Component (LOW-MEDIUM IMPACT)

### **Library: Radix UI Tabs (@radix-ui/react-tabs)**

**Current State:**
- Custom tab implementations (if any found)
- Manual tab state management
- Inconsistent tab styling

**Why This Eighth:**
- Tabs improve content organization
- Consistent tab UX
- Accessibility built-in

**Impact:**
- **Files Affected**: ~3-5 components (if tabs are used)
- **Code Reduction**: ~200-300 lines
- **UX Improvement**: Consistent tab behavior

**Migration Effort**: Low (3-5 days)

---

## Priority 9: Accordion/Collapsible (LOW-MEDIUM IMPACT)

### **Library: Radix UI Accordion (@radix-ui/react-accordion)**

**Current State:**
- Custom collapsible sections in:
  - `Navbar.js` - mobile Info/Admin dropdowns (already using chevron rotation)
  - Various filter panels
- Manual open/close state management

**Why This Ninth:**
- Better accessibility
- Consistent animations
- Keyboard support

**Impact:**
- **Files Affected**: ~5-7 components
- **Code Reduction**: ~200-300 lines
- **UX Improvement**: Smooth animations, keyboard support

**Migration Effort**: Low (3-5 days)

---

## Priority 10: Loading States & Skeletons (LOW IMPACT)

### **Library: React Content Loader or Skeleton from shadcn/ui**

**Current State:**
- Custom `LoadingSkeleton.js` component
- Manual loading state management
- Inconsistent loading indicators

**Why This Tenth:**
- Better skeleton animations
- Consistent loading UX
- Less code to maintain

**Impact:**
- **Files Affected**: ~10-15 components
- **Code Reduction**: ~100-200 lines
- **UX Improvement**: Better loading indicators

**Migration Effort**: Low (3-5 days)

---

## Additional Recommendations

### **State Management (Consider if needed)**
- **Zustand** or **Jotai** - If global state becomes complex
- Currently using React Context (AuthContext, NotificationContext) which is fine for current scale

### **UI Component Libraries (Alternative Approach)**
Instead of individual libraries, consider:
- **shadcn/ui** - Copy-paste components built on Radix UI + Tailwind
- **Mantine** - Full-featured component library
- **Chakra UI** - Comprehensive component system

**Pros of shadcn/ui:**
- Uses Radix UI under the hood (accessibility)
- Tailwind CSS (already using)
- Copy components into codebase (full control)
- No bundle size bloat (only what you use)

**Cons:**
- Need to maintain copied components
- Less "out of the box" than full libraries

### **Form Component Library (Alternative)**
- **React Aria Components** - Adobe's accessible component library
- **Mantine Form** - If using Mantine ecosystem

---

## Migration Strategy

### Phase 1: Foundation (Weeks 1-4)
1. **React Hook Form + Zod** - Forms are the foundation
2. **Radix UI Dialog** - Modal system
3. **Radix UI Select** - Dropdown system

### Phase 2: Enhancement (Weeks 5-8)
4. **Date Pickers** - Improve date inputs
5. **Tooltips & Popovers** - Better UX for icon buttons
6. **Autocomplete** - Improve search components

### Phase 3: Optimization (Weeks 9-12)

1. **Data Tables** - Admin table improvements
2. **Tabs & Accordion** - Content organization
3. **Loading States** - Better loading UX

### Phase 4: Polish (Ongoing)
- Monitor for new patterns
- Add libraries as needed
- Keep custom components that are domain-specific (e.g., WindDateTimePicker)

---

## Libraries to Keep (Don't Replace)

1. **react-hot-toast** - Already using, works well
2. **Recharts** - Already using, good for charts
3. **react-leaflet** - Map library, domain-specific
4. **react-slider** - Used in WindDateTimePicker, appropriate
5. **lucide-react** - Icon library, works well
6. **react-query** - Data fetching, excellent
7. **react-router-dom** - Routing, standard

---

## Estimated Total Impact

- **Code Reduction**: ~6000-8000 lines of custom code
- **Maintenance Burden**: Significantly reduced
- **Accessibility**: WCAG 2.1 AA compliance
- **Developer Experience**: Faster feature development
- **User Experience**: More consistent, polished UI
- **Bundle Size**: Minimal increase (tree-shaking, modern libraries)

---

## Notes

- All recommended libraries are actively maintained
- All have TypeScript support (if migrating to TS)
- All are accessibility-focused (WCAG compliant)
- All work well with Tailwind CSS (already using)
- All are tree-shakeable (minimal bundle impact)

---

## Decision Matrix

When choosing between libraries, consider:
1. **Bundle Size** - Impact on app size
2. **Accessibility** - WCAG compliance
3. **Maintenance** - Active development, community size
4. **API Design** - Developer experience
5. **Customization** - Ability to match design system
6. **TypeScript** - Type safety support

---

**Last Updated**: December 22, 2025

**Next Review**: After Phase 1 completion

