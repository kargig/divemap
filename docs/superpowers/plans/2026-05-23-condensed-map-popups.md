# Condensed Map Popups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign map popups to be significantly smaller and more condensed by removing descriptions and consolidating metrics.

**Architecture:** Surgical updates to string-based HTML templates in `LeafletMapView.jsx` and JSX components in `DiveSitesMap.jsx`. Standardize CSS classes for compact layouts.

**Tech Stack:** React, Tailwind CSS, OpenLayers, Leaflet.

---

### Task 1: Update LeafletMapView String Templates

**Files:**
- Modify: `frontend/src/components/LeafletMapView.jsx`

- [ ] **Step 1: Modify `headerAndDescriptionHtml` generation**
Remove the description part of the template.

- [ ] **Step 2: Condense Dive Site Rating and Difficulty**
Move the rating to a badge next to the title and consolidate difficulty/tags into a single compact row.

- [ ] **Step 3: Refine Weather Section**
Update icons and layout to be more compact, matching the approved design.

- [ ] **Step 4: Update Footer Link**
Change text to "View Details →".

- [ ] **Step 5: Verify via Browser**
Run: `navigate_page http://localhost` (assuming local dev server is up) and click a marker.
Expected: Popup is narrower and has no description.

---

### Task 2: Update DiveSitesMap JSX Template

**Files:**
- Modify: `frontend/src/components/DiveSitesMap.jsx`

- [ ] **Step 1: Update `StablePopup` content**
Remove `site.description` block.

- [ ] **Step 2: Apply Condensed Styles**
Reduce padding (`p-2`) and apply the new metric layout.

- [ ] **Step 3: Update Footer Link**
Ensure consistent "View Details" labeling.

- [ ] **Step 4: Verify via Browser**
Check individual markers on the Dive Sites page.

---

### Task 3: Global Styling Adjustments

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Adjust Leaflet Popup Constraints**
Update the mobile media query for `.leaflet-popup-content-wrapper` to reflect the narrower width (200px max).

- [ ] **Step 2: Verify consistency across all maps**
Check Dives and Diving Centers maps.
