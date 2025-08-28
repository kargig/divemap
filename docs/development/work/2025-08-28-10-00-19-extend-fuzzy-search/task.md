# Extend Fuzzy Search Coverage

**Status:** Refining
**Created:** $(date -Iseconds)
**Agent PID:** $(echo $PPID)

## Original Todo
See `plan.md` for current status and technical details.

## Description
Extend unified/fuzzy search to remaining sections (Dives, Diving Organizations, Newsletters) ensuring consistent scoring, triggers, and frontend components.

## Success Criteria
- [ ] Functional: Dives supports unified + fuzzy search with ranking
- [ ] Functional: Diving Organizations supports unified + fuzzy search
- [ ] Functional: Newsletters supports unified + fuzzy search
- [ ] Quality: Performance acceptable (no timeouts; pagination works)
- [ ] Quality: Lint/tests pass; no regressions in existing search pages
- [ ] Documentation: Update docs for endpoints and UI behavior

## Implementation Plan
- [ ] Backend: Add unified search endpoints/params for missing entities
- [ ] Backend: Reuse `calculate_unified_phrase_aware_score` where applicable
- [ ] Backend: Add indexes if needed for queried fields
- [ ] Frontend: Integrate `FuzzySearchInput` and badges in pages
- [ ] Frontend: Wire search state, debouncing, and highlights
- [ ] Validate relevance with sample queries; tune weights

## Automated test
- [ ] Backend tests for endpoints and ranking stability

## User test
- [ ] Cross-entity manual queries verify expected ordering and badges

## Review
- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes
- Trigger fuzzy when results < threshold or multi-word queries
