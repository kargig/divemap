# Refactor Map Components for Code Reuse

**Status:** Refining
**Created:** 2025-09-18-08-23-13
**Agent PID:** 6352

## Original Todo

Refactor DiveSitesMap.js, DivingCentersMap.js, and DivesMap.js to eliminate code duplication and improve maintainability through shared components and custom hooks.

## Description

The three map components (DiveSitesMap, DivingCentersMap, DivesMap) currently contain significant code duplication (~60% of 1,224 total lines). This refactoring will extract common functionality into reusable components and hooks, reducing code duplication by 67% while maintaining the same functionality and improving maintainability.

**Current State:**

- 1,224 lines across 3 files
- ~549 lines of identical duplication (45%)
- ~180 lines of similar patterns (15%)
- ~495 lines of unique code (40%)

**Target State:**

- ~400 lines total (67% reduction)
- Shared BaseMap component with configurable behavior
- Custom hooks for common map logic
- Simplified individual components focused on data processing and popup rendering

## Success Criteria

- [ ] **Functional**: All three map components work identically to current implementation
- [ ] **Functional**: Clustering, zoom controls, popups, and bounds fitting work correctly
- [ ] **Functional**: Custom icons and styling preserved for each map type
- [ ] **Quality**: Code duplication reduced by at least 60%
- [ ] **Quality**: All existing tests continue to pass
- [ ] **Quality**: ESLint passes with 0 errors
- [ ] **User validation**: Manual testing confirms all map functionality works
- [ ] **Documentation**: New architecture documented with usage examples
- [ ] **Performance**: No performance regressions detected
- [ ] **Maintainability**: New map types can be added with minimal code

## Implementation Plan

### Phase 1: Extract Common Components (High Impact)

- [ ] **Code change**: Create `components/maps/MapInfrastructure.js` with shared components
  - [ ] Extract `MapZoomTracker` component (37 lines × 3 = 111 lines saved)
  - [ ] Extract `FitBounds` component (8 lines × 3 = 24 lines saved)
  - [ ] Extract `MarkerClusterGroup` component (90 lines × 3 = 270 lines saved)
  - [ ] Extract `MapInfoOverlay` component (6 lines × 3 = 18 lines saved)
- [ ] **Code change**: Create `hooks/useMapLogic.js` for state management
  - [ ] Extract common state (currentZoom, maxZoom, useClustering, mapCenter)
  - [ ] Extract bounds calculation logic
  - [ ] Extract center calculation logic
- [ ] **Code change**: Create `hooks/useMapHandlers.js` for event handlers
  - [ ] Extract zoom change handler
  - [ ] Extract clustering change handler
  - [ ] Extract cluster click handler
  - [ ] Extract viewport change handler
- [ ] **Automated test**: Verify extracted components work in isolation
- [ ] **User test**: Test each map component still works after extraction

### Phase 2: Create Base Map Component (Medium Impact)

- [ ] **Code change**: Create `components/maps/BaseMap.js` with generic map container
  - [ ] Implement configurable container height
  - [ ] Implement configurable cluster colors
  - [ ] Implement configurable item type labels
  - [ ] Integrate all extracted components and hooks
- [ ] **Code change**: Create `components/maps/MapTypes.js` with icon factories
  - [ ] Extract `createDiveSiteIcon` function
  - [ ] Extract `createDivingCenterIcon` function
  - [ ] Extract `createDiveIcon` function
- [ ] **Code change**: Create `components/maps/PopupComponents.js` with popup renderers
  - [ ] Extract `DiveSitePopup` component
  - [ ] Extract `DivingCenterPopup` component
  - [ ] Extract `DivePopup` component
- [ ] **Automated test**: Test BaseMap with different configurations
- [ ] **User test**: Verify BaseMap works with all three data types

### Phase 3: Refactor Individual Components (Low Impact)

- [ ] **Code change**: Refactor `DiveSitesMap.js` to use BaseMap
  - [ ] Reduce from 348 lines to ~80 lines
  - [ ] Implement data processing function
  - [ ] Implement popup rendering function
  - [ ] Configure BaseMap with dive site specific settings
- [ ] **Code change**: Refactor `DivingCentersMap.js` to use BaseMap
  - [ ] Reduce from 366 lines to ~80 lines
  - [ ] Implement data processing function
  - [ ] Implement popup rendering function
  - [ ] Configure BaseMap with diving center specific settings
- [ ] **Code change**: Refactor `DivesMap.js` to use BaseMap
  - [ ] Reduce from 510 lines to ~80 lines
  - [ ] Implement data processing function
  - [ ] Implement popup rendering function
  - [ ] Configure BaseMap with dive specific settings
- [ ] **Automated test**: Run full test suite to ensure no regressions
- [ ] **User test**: Comprehensive testing of all map functionality

### Phase 4: Documentation and Cleanup

- [ ] **Code change**: Create `docs/development/map-components-architecture.md`
  - [ ] Document BaseMap component API
  - [ ] Document custom hooks usage
  - [ ] Provide examples for adding new map types
  - [ ] Document migration guide from old components
- [ ] **Code change**: Update PropTypes and TypeScript definitions
  - [ ] Ensure all components have proper prop validation
  - [ ] Add JSDoc comments for all public APIs
- [ ] **Automated test**: Run ESLint and fix any issues
- [ ] **User test**: Final verification of all functionality

## Review

- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes

**Key Benefits:**

- 67% code reduction (1,224 → 400 lines)
- Single source of truth for map logic
- Easier bug fixes and feature additions
- Consistent behavior across all maps
- Better testability and maintainability

**Risk Mitigation:**

- Phased approach to minimize risk
- Keep original components as backup during development
- Comprehensive testing at each phase
- Gradual migration to new architecture

**Technical Considerations:**

- Maintain backward compatibility during transition
- Ensure performance is not impacted
- Preserve all existing functionality
- Make new architecture extensible for future map types
