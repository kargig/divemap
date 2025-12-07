# Divemap Development Todos

## Active Development Tasks

### UI/UX Enhancements

- [x] **Improve dive profile visualization colorblind accessibility**
  - Replace current colors with Okabe-Ito colorblind-safe palette
  - Update depth line from blue (#2563eb) to Okabe-Ito blue (#0072B2)
  - Update average depth from red (#dc2626) to Okabe-Ito orange (#E69F00)
  - Update temperature from green (#059669) to Okabe-Ito bluish green (#009E73)
  - Update NDL zones from amber (#f59e0b) to Okabe-Ito vermillion (#D55E00)
  - Update CNS from purple (#7c3aed) to Okabe-Ito reddish purple (#CC79A7)
  - Update gas change events from amber (#f59e0b) to Okabe-Ito yellow (#F0E442)
  - Update other events from red (#ef4444) to Okabe-Ito sky blue (#56B4E9)
  - Test color contrast and accessibility with colorblind simulation tools
  - Update getChartColors() function in diveProfileHelpers.js
  - Update hardcoded colors in AdvancedDiveProfileChart.js

## Completed Tasks

- [x] **Fix dives.py refactoring issues** ✅ COMPLETED 2025-09-27
  - ✅ Restored missing API endpoints (import_subsurface_xml, confirm_import_dives, upload_dive_profile)
  - ✅ Fixed malformed route definitions in dives_import.py
  - ✅ Removed duplicate function definitions (get_or_create_deco_tag)
  - ✅ Restored correct function signatures (convert_to_divemap_format, search_dives_with_fuzzy)
  - ✅ Fixed import conflicts and circular dependencies
  - ✅ Ensured all 42 original functions are present and working
  - ✅ Verified all 24 API endpoints respond correctly
  - ✅ Comprehensive testing and validation (715/715 tests passing)
  - **Result**: All critical refactoring issues resolved, full test coverage achieved
  - **Files**: Moved to `docs/development/done/2025-09-27-21-10-28-fix-dives-refactoring-issues.md`