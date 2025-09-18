# Modify Page Titles to be More Descriptive and Interesting

**Status:** In Progress
**Created:** 2025-09-18-23-52-41
**Agent PID:** 6352

## Original Todo

Modify the title in the various pages so that it becomes more interesting. For example:
- http://localhost/dives/42 should be "Divemap - Dive - Fleves South Wall - 2025/08/31"
- http://localhost/dive-sites/146 should be "Divemap - Dive Site - Fleves South Wall"
- http://localhost/diving-centers/56 should be "Divemap - Diving Centers - ACHILLEON DIVING CENTER"

## Description

Currently, all pages use a static title "Divemap - Scuba Diving Community" from the HTML template. This task will implement dynamic page titles that include specific information about the content being viewed, making the browser tabs more informative and improving SEO.

**Current State:**
- All pages show static title: "Divemap - Scuba Diving Community"
- No dynamic title updates based on page content
- Missing contextual information in browser tabs

**Target State:**
- Dynamic titles based on page content and data
- Format: "Divemap - [Page Type] - [Content Name] - [Additional Info]"
- Improved user experience and SEO

## Success Criteria

- [ ] **Functional**: Dive detail pages show "Divemap - Dive - [Dive Site Name] - [Date]"
- [ ] **Functional**: Dive site detail pages show "Divemap - Dive Site - [Site Name]"
- [ ] **Functional**: Diving center detail pages show "Divemap - Diving Centers - [Center Name]"
- [ ] **Functional**: Other pages maintain appropriate titles
- [ ] **Quality**: All existing tests continue to pass
- [ ] **Quality**: ESLint passes with 0 errors
- [ ] **User validation**: Manual testing confirms titles update correctly
- [ ] **Performance**: No performance impact from title updates

## Implementation Plan

### Phase 1: Analyze Current Implementation

- [ ] **Code change**: Examine current title implementation in HTML template
- [ ] **Code change**: Identify pages that need dynamic titles
- [ ] **Code change**: Check if react-helmet or similar library is available
- [ ] **Code change**: Plan title update strategy

### Phase 2: Implement Dynamic Titles

- [ ] **Code change**: Install react-helmet-async if not available
- [ ] **Code change**: Create usePageTitle hook for title management
- [ ] **Code change**: Update DiveDetail.js to use dynamic titles
- [ ] **Code change**: Update DiveSiteDetail.js to use dynamic titles
- [ ] **Code change**: Update DivingCenterDetail.js to use dynamic titles
- [ ] **Code change**: Update other relevant pages with appropriate titles

### Phase 3: Testing and Validation

- [ ] **Automated test**: Run existing test suite to ensure no regressions
- [ ] **User test**: Test title updates on dive detail pages
- [ ] **User test**: Test title updates on dive site detail pages
- [ ] **User test**: Test title updates on diving center detail pages
- [ ] **User test**: Verify titles update correctly when navigating between pages

## Review

- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes

**Key Benefits:**
- Better user experience with informative browser tabs
- Improved SEO with descriptive page titles
- Consistent title format across the application
- Easy to maintain and extend

**Technical Considerations:**
- Use react-helmet-async for title management
- Ensure titles update when data loads
- Handle loading states appropriately
- Maintain fallback titles for error states
