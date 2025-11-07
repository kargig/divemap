# Search Bar and Filter Bar Behavior Comparison

**Date:** November 7, 2025  
**Last Updated:** November 7, 2025  
**Purpose:** Compare search bar and filter bar behavior, position, height, and width across all pages in mobile and desktop views

## Test Results Summary

**Note:** Tests use gradual scrolling (50px increments) to properly trigger scroll events.  
**View:** Mobile view (375x667px) unless otherwise specified.

### Mobile View - Scroll Down (scrollY=600)

| Page | Search Bar | Quick Filters | Sticky Container | Attached | Width | Notes |
|------|------------|---------------|-----------------|----------|-------|-------|
| `/dives` | ✅ VISIBLE | ✅ VISIBLE | ❌ NOT VISIBLE | ✅ YES (0px gap) | 375px | Fixed position, full width, properly attached |
| `/dive-sites` | ✅ VISIBLE | ✅ VISIBLE | ❌ NOT VISIBLE | ✅ YES (0px gap) | 375px | Fixed position, full width, properly attached ✅ |
| `/diving-centers` | ✅ VISIBLE | ❌ NOT VISIBLE | ✅ VISIBLE | N/A | 375px | Search bar visible, full width, but no quick filters ✅ |
| `/dive-trips` | ✅ VISIBLE | ❌ NOT VISIBLE | ❌ NOT VISIBLE | N/A | 375px | Full width, hides on scroll up ✅ (Fixed) |

### Mobile View - Scroll Up (scrollY=100)

| Page | Search Bar | Quick Filters | Sticky Container | Notes |
|------|------------|---------------|-----------------|-------|
| `/dives` | ❌ NOT VISIBLE | ❌ NOT VISIBLE | ❌ NOT VISIBLE | Correctly hidden when scrolling up ✅ |
| `/dive-sites` | ❌ NOT VISIBLE | ❌ NOT VISIBLE | ❌ NOT VISIBLE | Correctly hidden when scrolling up ✅ (Fixed) |
| `/diving-centers` | ❌ NOT VISIBLE | ❌ NOT VISIBLE | ❌ NOT VISIBLE | Correctly hidden when scrolling up ✅ |
| `/dive-trips` | ❌ NOT VISIBLE | ❌ NOT VISIBLE | ❌ NOT VISIBLE | Correctly hidden when scrolling up ✅ (Fixed) |

## Detailed Measurements

### `/dive-sites` (Updated to Match `/dives`)

**Scroll Down (scrollY=600):**

- **Search Bar:**
  - Position: `fixed`
  - Top: `0px`
  - Size: `375x63px` (full viewport width) ✅
  - Z-Index: `100`
  - Display: `block`
- **Quick Filters:**
  - Position: `fixed`
  - Top: `63px` (dynamically calculated from search bar height)
  - Size: `375x69px` (full viewport width) ✅
  - Z-Index: `99`
  - Display: `block`
  - Gap from Search Bar: `0px` ✅ ATTACHED
- **Sticky Container:** NOT VISIBLE (moved outside max-w-6xl container)

**Scroll Up (scrollY=100):**

- **Search Bar:** NOT VISIBLE ✅ (Fixed - now matches `/dives` behavior)
- **Quick Filters:** NOT VISIBLE ✅ (Fixed - now matches `/dives` behavior)
- **Sticky Container:** NOT VISIBLE ✅

**Recent Fixes (November 2025):**

- ✅ Search bar and filter bar now hide when scrolling up (matches `/dives`)
- ✅ Full viewport width (375px) achieved by moving container outside `max-w-6xl` and using negative margins
- ✅ Filter overlay now renders via React portal at document body level (fixed 24px height issue)
- ✅ Form fields in mobile filter overlay reduced from 48px to 34px height

### `/diving-centers`

**Scroll Down (scrollY=600):**

- **Search Bar:**
  - Position: `sticky`
  - Top: `0px`
  - Size: `375x~25px` (full viewport width) ✅
  - Z-Index: `100`
  - Display: `block`
- **Quick Filters:** NOT VISIBLE (not implemented for this page)
- **Sticky Container:**
  - Position: `sticky`
  - Top: `0px`
  - Size: `375x~25px` (full viewport width) ✅
  - Z-Index: `100`
  - Display: `block`

**Scroll Up (scrollY=100):**

- All elements: NOT VISIBLE ✅ (Correctly hidden when scrolling up)

### `/dives` (Reference Implementation)

**Scroll Down (scrollY=600):**

- **Search Bar:**
  - Position: `fixed`
  - Top: `0px`
  - Size: `375x63px` (full viewport width)
  - Z-Index: `100`
  - Display: `block`
- **Quick Filters:**
  - Position: `fixed`
  - Top: `63px` (dynamically calculated from search bar height)
  - Size: `375x69px` (full viewport width)
  - Z-Index: `99`
  - Display: `block`
  - Gap from Search Bar: `0px` ✅ ATTACHED
- **Sticky Container:** NOT VISIBLE

**Scroll Up (scrollY=100):**

- All elements: NOT VISIBLE ✅ (Correctly hidden when scrolling up)

### `/dive-trips` (Updated to Match `/dives`)

**Mobile View:**

**Scroll Down (scrollY=600):**

- **Search Bar:**
  - Position: `sticky`
  - Top: `0px`
  - Size: `375px` (full viewport width) ✅
  - Z-Index: `100`
  - Display: `block`
- **Quick Filters:** NOT VISIBLE (not implemented for this page)
- **Sticky Container:** NOT VISIBLE

**Scroll Up (scrollY=100):**

- **Search Bar:** NOT VISIBLE ✅ (Fixed - now matches `/dives` behavior)

**Desktop View:**

- **Desktop Search Bar:**
  - Position: After HeroSection (matches `/dives` positioning)
  - Visible: Only on desktop/tablet (`!isMobile`)
  - Component: `DesktopSearchBar` with `FuzzySearchInput`
  - Styling: Clean, no rounded corners, matches `/dives` theme
- **Mobile Search Bar:** Hidden on desktop (only shows on mobile when scrolling down)

**Recent Fixes (November 2025):**

- ✅ Search bar now hides when scrolling up (matches `/dives`)
- ✅ Full viewport width (375px) achieved by moving container outside `max-w-6xl` and using negative margins
- ✅ Uses `useResponsiveScroll` hook for scroll-based visibility
- ✅ Desktop search bar added (positioned after HeroSection, like `/dives`)
- ✅ Fixed duplicate search bars issue (mobile search bar was showing on desktop)
- ✅ Removed "Show Filters" button (no filters available for dive trips)
- ✅ Removed "Search" label text above input
- ✅ Updated styling to match `/dives` (border-b, shadow-sm, no rounded corners)
- ✅ Removed mobile view mode controls (List/Grid/Map buttons)
- ✅ Removed "Mobile Tips" section

## Implementation Details

### `/dives` Page

**File:** `frontend/src/pages/Dives.js`

**Current Implementation:**

```javascript
const { isMobile } = useResponsive();
const { searchBarVisible } = useResponsiveScroll();

{(!isMobile || searchBarVisible) && (
  <ResponsiveFilterBar
    // ... props ...
  />
)}
```

**Issue:** The entire `ResponsiveFilterBar` component is conditionally rendered, which means:

- When scrolling up on mobile: Component not rendered at all
- When scrolling down on mobile: Component should be rendered, but test shows it's not appearing

**ResponsiveFilterBar Internal Behavior:**

- Uses `searchBarVisible` from `useResponsiveScroll()` internally
- Conditionally renders mobile search bar: `{searchBarVisible && (...)}`
- Conditionally renders quick filters: `{quickFiltersVisible && (...)}`

**Problem:** Double conditional rendering may cause timing issues or prevent the component from appearing when expected.

### `/diving-centers` Page

**File:** `frontend/src/pages/DivingCenters.js`

**Current Implementation:**

```javascript
const { isMobile } = useResponsive();
const { searchBarVisible } = useResponsiveScroll();

{(!isMobile || searchBarVisible) && (
  <div className='sticky-below-navbar bg-white shadow-lg border border-gray-200 rounded-lg mx-3 sm:mx-4 lg:mx-6 xl:mx-8 mb-6'>
    {/* Search and filter bar content */}
  </div>
)}
```

**Status:**

- Search bar appears when scrolling down ✅
- Quick filters are not visible (not implemented for this page - intentional design difference)
- Correctly hides when scrolling up ✅

### `/dive-sites` Page

**File:** `frontend/src/pages/DiveSites.js`

**Current Implementation (Updated November 2025):**

```javascript
const { isMobile } = useResponsive();
const { searchBarVisible } = useResponsiveScroll();

{(!isMobile || searchBarVisible) && (
  <div className='sticky-below-navbar bg-white shadow-sm border-b border-gray-200 rounded-t-lg py-3 sm:py-4 -mx-4 sm:mx-0'>
    {/* Desktop Search Bar */}
    {!isMobile && (
      <div className='max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8'>
        <DesktopSearchBar ... />
      </div>
    )}
    
    {/* Responsive Filter Bar */}
    <ResponsiveFilterBar
      variant='sticky'
      // ... props ...
    />
  </div>
)}
```

**Key Changes:**

- ✅ Added conditional rendering wrapper: `{(!isMobile || searchBarVisible) && (...)}`
- ✅ Moved `sticky-below-navbar` container outside `max-w-6xl` to span full width
- ✅ Added negative margins (`-mx-4 sm:mx-0`) to counteract main element padding
- ✅ Changed `ResponsiveFilterBar` variant to `'sticky'` for proper attachment
- ✅ Filter overlay now renders via React portal (fixed 24px height issue)

**Status:** ✅ Now matches `/dives` behavior - hides on scroll up, full width, properly attached

## Findings

### ✅ Working Correctly

1. **`/dives` Page:**
   - Search bar and quick filters appear when scrolling down ✅
   - Both are properly attached (0px gap) ✅
   - Both correctly hide when scrolling up ✅
   - Uses fixed positioning for mobile search bar and quick filters ✅
   - Full viewport width (375px) ✅

2. **`/dive-sites` Page (Updated November 2025):**
   - Search bar and quick filters appear when scrolling down ✅
   - Both are properly attached (0px gap) ✅
   - Both correctly hide when scrolling up ✅ (Fixed)
   - Uses fixed positioning for mobile search bar and quick filters ✅
   - Full viewport width (375px) ✅ (Fixed)
   - Filter overlay renders correctly via React portal ✅ (Fixed)
   - Form fields use 34px height (reduced from 48px) ✅

3. **`/diving-centers` Page:**
   - Search bar appears when scrolling down ✅
   - Correctly hides when scrolling up ✅
   - Uses sticky positioning ✅
   - Full viewport width (375px) ✅ (Fixed November 2025)
   - Quick filters not implemented (intentional design difference)

### 📊 Comparison Summary

#### Mobile View

| Behavior | `/dives` | `/dive-sites` | `/diving-centers` | `/dive-trips` |
|----------|----------|---------------|-------------------|---------------|
| **Scroll Down:** Search Bar Visible | ✅ | ✅ | ✅ | ✅ |
| **Scroll Down:** Quick Filters Visible | ✅ | ✅ | ❌ (N/A) | ❌ (N/A) |
| **Scroll Down:** Attached (0px gap) | ✅ | ✅ | N/A | N/A |
| **Scroll Up:** Search Bar Hidden | ✅ | ✅ | ✅ | ✅ |
| **Scroll Up:** Quick Filters Hidden | ✅ | ✅ | ✅ | ✅ |
| **Full Width (375px)** | ✅ | ✅ | ✅ | ✅ |
| **Position Type** | Fixed | Fixed | Sticky | Sticky |
| **Filter Overlay Portal** | ✅ | ✅ | N/A | N/A |
| **Form Field Height** | 34px | 34px | N/A | N/A |
| **Scroll Up Hidden** | ✅ | ✅ | ✅ | ✅ |

#### Desktop View

| Behavior | `/dives` | `/dive-sites` | `/diving-centers` | `/dive-trips` |
|----------|----------|---------------|-------------------|---------------|
| **Desktop Search Bar** | ✅ | ✅ | ✅ | ✅ |
| **Position** | After HeroSection | After HeroSection | After HeroSection | After HeroSection |
| **Mobile Search Bar Hidden** | ✅ | ✅ | ✅ | ✅ |
| **No Duplicate Search Bars** | ✅ | ✅ | ✅ | ✅ (Fixed) |
| **UI Theme Consistency** | ✅ | ✅ | ✅ | ✅ (Fixed) |

## Recent Fixes (November 2025)

### 1. `/dive-sites` Scroll-Up Behavior ✅

**Fixed:** Search bar and filter bar now hide when scrolling up, matching `/dives` behavior.

**Implementation:**

- Added conditional rendering wrapper: `{(!isMobile || searchBarVisible) && (...)}`
- Uses `useResponsiveScroll()` hook to track scroll direction
- Component hides when `searchBarVisible` is `false` on mobile

### 2. `/dive-sites` Full Width ✅

**Fixed:** Search and filter bar now span full viewport width (375px), matching `/dives`.

**Implementation:**

- Moved `sticky-below-navbar` container outside `max-w-6xl` container
- Added negative horizontal margins (`-mx-4 sm:mx-0`) to counteract main element padding
- Container now spans full width on mobile

### 3. Filter Overlay Rendering ✅

**Fixed:** Mobile filter overlay now renders correctly at full viewport height (667px) instead of 24px.

**Implementation:**

- Updated `ResponsiveFilterBar.js` to use React `createPortal`
- Overlay now renders at `document.body` level, escaping parent container constraints
- Prevents height constraint issues from parent containers

### 4. Form Field Height Reduction ✅

**Fixed:** Form fields in mobile filter overlay reduced from 48px to 34px height.

**Implementation:**

- Changed `min-h-[48px]` to `min-h-[34px]` for all form fields
- Reduced padding from `py-3` to `py-2`
- Applied to: select dropdowns, text inputs, tag buttons, sort buttons, view mode buttons, action buttons

### 5. `/diving-centers` Full Width ✅

**Fixed:** Search and filter bar now spans full viewport width (375px), matching `/dives` and `/dive-sites`.

**Implementation:**

- Added CSS rule in `index.css` to make `.sticky-below-navbar` span full viewport width on mobile
- Uses `width: 100vw` with negative margins (`-16px`) to counteract main element padding
- Applied to all pages using `.sticky-below-navbar` class

### 6. `/dive-trips` Search Bar Behavior ✅

**Fixed:** Search bar now matches `/dives` behavior - hides on scroll up and spans full viewport width (375px).

**Implementation:**

- Imported `useResponsive` and `useResponsiveScroll` hooks
- Replaced custom `isMobile` state with `useResponsive` hook
- Removed old mobile detection `useEffect`
- Moved search bar outside `max-w-6xl` container to span full width
- Added conditional rendering: `{(!isMobile || searchBarVisible) && (...)}`
- Added negative margins (`-mx-4 sm:mx-0`) to counteract main element padding
- Search bar now hides when scrolling up on mobile, matching `/dives` behavior

### 7. `/dive-trips` Desktop Search Bar ✅

**Fixed:** Added desktop search bar positioned after HeroSection, matching `/dives` page layout.

**Implementation:**

- Added `DesktopSearchBar` component import
- Positioned desktop search bar after `HeroSection` (inside `max-w-6xl` container)
- Desktop search bar only visible on desktop/tablet: `{!isMobile && (...)}`
- Mobile search bar condition fixed: `{isMobile && searchBarVisible && (...)}`
- Removed duplicate search bar issue (mobile search bar was incorrectly showing on desktop)

**UI Improvements:**

- Removed "Show Filters" button (no filters available for dive trips)
- Removed "Search" label text above input field
- Updated styling to match `/dives`: `border-b border-gray-200 shadow-sm` (removed rounded corners and extra padding)
- Removed mobile view mode controls (List/Grid/Map buttons)
- Removed "Mobile Tips" section

## Recommendations

### 1. Standardize Width Across All Pages ✅

- All pages now use full viewport width (375px) on mobile
- CSS rule in `index.css` ensures `.sticky-below-navbar` spans full width
- Consistent behavior across `/dives`, `/dive-sites`, and `/diving-centers`

### 2. Add Quick Filters to `/diving-centers` (Optional)

- If quick filters should be present on diving centers page, implement them
- Ensure they attach properly to the search bar (0px gap)
- Follow same pattern as `/dives` and `/dive-sites`

## Test Script

The comparison was performed using:

- **File:** `frontend/tests/compare_search_filter_bars.js`
- **Browser:** Firefox (headless)
- **Viewport:** 375x667 (mobile)
- **Test Conditions:**
  - Scroll Down: Gradual scroll from 0 to 600px (50px increments)
  - Scroll Up: Gradual scroll from 600px to 100px (50px increments)
  - Wait time: 1.5 seconds after each scroll

## Implementation Notes

### Filter Overlay Portal Implementation

The mobile filter overlay in `ResponsiveFilterBar.js` now uses React portals to render at the document body level:

```javascript
import { createPortal } from 'react-dom';

{isFilterOverlayOpen &&
  createPortal(
    <div
      data-testid='mobile-filter-overlay'
      className='fixed inset-0 z-[200] bg-black bg-opacity-50 flex flex-col'
    >
      {/* Overlay content */}
    </div>,
    document.body
  )}
```

This ensures the overlay:

- Renders at full viewport size (375x667px)
- Escapes parent container constraints
- Appears above all other content (z-index: 200)
- Works consistently across all pages using `ResponsiveFilterBar`

### Form Field Height Standardization

All form fields in the mobile filter overlay now use:

- `min-h-[34px]` instead of `min-h-[48px]`
- `py-2` instead of `py-3` for reduced padding
- Consistent sizing across all input types (select, text, number, buttons)

This provides:

- More compact mobile interface
- Better use of screen space
- Consistent touch target sizing (34px minimum)

## Status Summary

| Page | Status | Notes |
|------|--------|-------|
| `/dives` | ✅ Complete | Reference implementation, all features working |
| `/dive-sites` | ✅ Complete | Matches `/dives` behavior after November 2025 fixes |
| `/diving-centers` | ✅ Complete | Full width (375px) achieved, consistent behavior (no quick filters by design) |
| `/dive-trips` | ✅ Complete | Full width (375px) achieved, hides on scroll up, desktop search bar added, matches `/dives` behavior |

## Next Steps

1. ✅ Standardize scroll-up behavior across all pages (Completed)
2. ✅ Fix filter overlay rendering issue (Completed)
3. ✅ Reduce form field heights for mobile (Completed)
4. ✅ Standardize width to full viewport (375px) across all pages (Completed)
5. ✅ Update `/dive-trips` to match `/dives` behavior (Completed)
6. ✅ Add desktop search bar to `/dive-trips` (Completed)
7. ✅ Fix duplicate search bars issue on `/dive-trips` desktop (Completed)
8. ✅ Remove unnecessary UI elements from `/dive-trips` (Completed)
9. Optional: Consider adding quick filters to `/diving-centers` if needed
