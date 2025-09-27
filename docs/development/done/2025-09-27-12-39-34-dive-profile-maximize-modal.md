# Add maximize icon to dive profile visualization

**Status:** Done
**Started:** 2025-09-27T12:45:00Z
**Created:** 2025-09-27-12-39-34
**Agent PID:** 498724
**Branch:** feature/dive-profile-maximize-modal

## Original Todo

Add an icon to maximize the dive profile visualization in a modal overlay so that user can interact with it in a larger view. The modal should maintain all existing information and buttons that the current content page shows (e.g. time, depth, temperature toggle, contrast toggle)

## Description

Enhance the dive profile visualization on the dive detail page by adding a maximize icon that opens the chart in a full-screen modal overlay. The current dive profile chart (`AdvancedDiveProfileChart`) is displayed within the profile tab of the dive detail page, but users need a larger view to better interact with the detailed dive data.

**Current State:**

- Dive profile chart is displayed in a constrained container within the dive detail page
- Chart includes comprehensive controls: temperature toggle, high contrast mode, all samples toggle, export functionality
- Chart supports mobile touch interactions with pan and zoom
- Chart displays depth vs time with temperature overlay, gas change markers, and decompression indicators

**Target State:**

- Add a maximize icon (using `Maximize` from lucide-react) to the chart controls area
- Clicking the icon opens a modal overlay with the full chart
- Modal maintains all existing chart functionality and controls
- Modal provides larger viewing area for better data interaction
- Modal follows existing modal patterns in the codebase for consistency
- Modal supports mobile responsive design and accessibility

**Technical Requirements:**

- Create reusable `DiveProfileModal` component following existing modal patterns
- Add maximize icon to `AdvancedDiveProfileChart` component controls
- Integrate modal state management in `DiveDetail` component
- Maintain all existing chart props and functionality in modal
- Ensure proper accessibility with ARIA labels and keyboard navigation
- Support mobile touch interactions in modal view

## Success Criteria

- [x] **Functional**: Maximize icon appears in dive profile chart controls area
- [x] **Functional**: Clicking maximize icon opens modal with full chart
- [x] **Functional**: Modal displays complete dive profile with all data visualizations
- [x] **Functional**: All existing chart controls work in modal (temperature, contrast, sampling toggles)
- [x] **Functional**: Export functionality works in modal view
- [x] **Functional**: Modal can be closed via ESC key or close button
- [x] **Quality**: Modal follows existing codebase modal patterns and styling
- [x] **Quality**: No performance degradation or duplicate chart rendering
- [x] **User validation**: Modal provides significantly larger viewing area than original chart
- [x] **User validation**: All chart interactions work smoothly in modal (pan, zoom, touch)
- [x] **Documentation**: Modal component is properly documented and reusable

## Implementation Plan

- [x] Create `DiveProfileModal` component (src/components/DiveProfileModal.js)
- [x] Add maximize icon to `AdvancedDiveProfileChart` controls (src/components/AdvancedDiveProfileChart.js:588-650)
- [x] Add modal state management to `DiveDetail` component (src/pages/DiveDetail.js:564-585)
- [x] Import `Maximize` icon from lucide-react in chart component
- [x] Implement modal with proper accessibility and keyboard navigation
- [x] Ensure modal maintains all chart props and functionality
- [x] Test modal responsiveness on mobile devices
- [x] Test all chart controls work correctly in modal view
- [x] Test export functionality in modal
- [x] Verify no performance issues with modal implementation

## Review

- [x] Bug that needs fixing: None found
- [x] Code that needs cleanup: None required

## Notes

**Implementation Summary:**

- Successfully created a reusable `DiveProfileModal` component following existing modal patterns
- Added maximize icon to chart controls with proper accessibility labels
- Modal maintains all existing chart functionality including temperature toggle, high contrast mode, and export features
- Implemented proper keyboard navigation (ESC key) and backdrop click to close
- Modal provides significantly larger viewing area (max-w-7xl) compared to original chart
- All chart interactions work smoothly in modal view
- No performance issues detected - modal reuses the same chart component
- Code follows project linting standards and compiles without errors

**Key Features Implemented:**

- Maximize icon with proper hover states and accessibility
- Full-screen modal with responsive design
- ESC key and close button functionality
- All chart controls preserved in modal
- Proper focus management and body scroll prevention
- Consistent styling with existing modal patterns
