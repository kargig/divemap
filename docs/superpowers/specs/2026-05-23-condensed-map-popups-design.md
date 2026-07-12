# Design Spec: Condensed Map Popups

## 1. Problem Statement
Map popups in the Divemap project are currently too large (width and height). When a user clicks a marker, the popup often triggers an auto-pan that moves the map sufficiently to trigger a "popupclose" event in some browsers/scenarios, or simply obscures too much of the map context. The goal is to make these popups significantly smaller and more condensed to improve the user experience, especially on mobile devices.

## 2. Proposed Changes

### 2.1 Content Reduction
- **Remove Descriptions**: Descriptions (`site.description`, etc.) will be removed entirely from the map popups. Users can view the full description on the dedicated detail pages.
- **Condensed Metrics**: 
    - **Rating**: Moved to a badge next to the title (e.g., "Zenobia Wreck 9.8★").
    - **Difficulty & Tags**: Combined into a single metadata row below the title.
- **Optional Weather Section**:
    - Only show if weather data is available.
    - Use a more compact layout with a small "Weather" header and a suitability pill.
    - Use icons for Wind, Waves, and Temperature metrics.
- **Link Text**: Change "View Full Profile" or similar to a consistent "View Details →".

### 2.2 Styling & Layout
- **Width**: Reduce `maxWidth` from `240px` to `200px`.
- **Padding**: Reduce internal container padding from `p-3` (12px) to `p-2` (8px).
- **Typography**: Use smaller, denser font sizes (`text-[10px]` and `text-xs`) for metadata.
- **Visual Hierarchy**: Use subtle background colors for the weather section to distinguish it from the primary metadata without using heavy borders.

### 2.3 Component Updates
- **`frontend/src/components/LeafletMapView.jsx`**: Update the string-based HTML generator for markers to follow the new condensed layout.
- **`frontend/src/components/DiveSitesMap.jsx`**: Update the JSX-based `StablePopup` content.
- **`frontend/src/components/DivesMap.jsx`** & **`frontend/src/components/DivingCentersMap.jsx`**: Ensure consistency with the new design.

## 3. Success Criteria
- [ ] Popups are visually narrower (200px).
- [ ] Popups are significantly shorter (no descriptions).
- [ ] All map types (Sites, Centers, Dives) use a consistent condensed style.
- [ ] Auto-pan behavior is less disruptive due to smaller popup size.
- [ ] No regression in weather suitability visualization (colors/labels).

## 4. Implementation Strategy
1.  **Refactor Utility Functions**: Update color/label helpers if needed for more compact outputs.
2.  **Update `LeafletMapView`**: Modify the string-based HTML template used for lazy-loaded popups.
3.  **Update `DiveSitesMap`**: Modify the JSX implementation of `StablePopup`.
4.  **Verify & Test**: Check all map types on various screen sizes using browser tools.
