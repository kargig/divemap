# Priority 2: Modal/Dialog System Migration Plan

## Objective
Replace custom modal implementations with **Radix UI Dialog** (@radix-ui/react-dialog) to improve accessibility, standardize behavior, and reduce maintenance burden.

**Status**: ✅ **PHASE 2 COMPLETED** (Migration Finalized)
**Last Updated**: December 28, 2025

## Phase 1: Core Components (Completed)
The following key components containing custom modal logic have been successfully migrated:
1. `frontend/src/components/DiveProfileModal.js` ✅
2. `frontend/src/components/ShareModal.js` ✅
3. `frontend/src/components/TripFormModal.js` ✅
4. `frontend/src/components/ImportDivesModal.js` ✅
5. `frontend/src/pages/Help.js` (Image modal viewer) ✅

## Phase 2: Remaining Migrations (Completed)
All identified custom modal implementations have been migrated to the standard `Modal` component.

### Admin Interface
- `frontend/src/pages/AdminDives.js` ✅ (Refactored to standard Edit page)
- `frontend/src/pages/AdminUsers.js` ✅
- `frontend/src/pages/AdminOwnershipRequests.js` ✅
- `frontend/src/pages/AdminTags.js` ✅
- `frontend/src/pages/AdminNewsletters.js` ✅
- `frontend/src/pages/AdminNotificationPreferences.js` ✅
- `frontend/src/pages/AdminDivingOrganizations.js` ✅

### Public Pages
- `frontend/src/pages/RouteDetail.js` ✅
- `frontend/src/pages/DiveSiteMap.js` ✅ (Maintained as route-based full-screen view)
- `frontend/src/pages/DivingCenterDetail.js` ✅
- `frontend/src/pages/DiveDetail.js` ✅
- `frontend/src/pages/IndependentMapView.js` ✅

### Components
- `frontend/src/components/DiveSitesFilterBar.js` ✅
- `frontend/src/components/MiniMap.js` ✅
- `frontend/src/components/DivingCentersResponsiveFilterBar.js` ✅
- `frontend/src/components/ResponsiveFilterBar.js` ✅
- `frontend/src/components/DiveProfileUpload.js` ✅
- `frontend/src/components/YouTubePreview.js` ✅
- `frontend/src/components/RoutePreview.js` ✅
- `frontend/src/components/MobileMapControls.js` ✅

## Implementation Details

### Reusable Modal Component
Created `frontend/src/components/ui/Modal.js` that wraps Radix UI Dialog primitives.
- **Props**: `isOpen`, `onClose`, `title`, `description`, `children`, `className`, `trigger`, `overlayClassName`, `showCloseButton`, `preventOutsideClick`.
- **Features**:
  - Backdrop (Overlay) with consistent styling (`fixed inset-0 bg-black bg-opacity-50`).
  - Content container with animation and responsive layout.
  - Built-in Close button (customizable).
  - Accessibility attributes (`Dialog.Title`, `Dialog.Description`).
  - Matches current design (Tailwind classes).

### Verification & Testing
- [x] **Accessibility**: Focus is trapped within modal. ESC key closes modal. Screen reader announces title.
- [x] **Scroll Locking**: Background body does not scroll when modal is open (handled by Radix UI).
- [x] **Responsiveness**: Modals look good on mobile and desktop. Full-screen mobile overlays correctly converted.
- [x] **Functionality**: All specific modal features (charts, forms, sharing, filters) work as before.
- [x] **Z-Index**: Modals appear above other content consistently.

## Future Improvements
- Consider adding animation variants (fade-in, slide-up).
- Standardize modal sizes (sm, md, lg, xl) via props instead of arbitrary tailwind classes in `className`.
- Evaluate if "Filter Drawers" (ResponsiveFilterBar) should use `Dialog` or a specialized "Sheet/Drawer" component (though `Dialog` can be styled as a drawer).
