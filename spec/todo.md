# Divemap Development Todos

## Active Development Tasks

### Backend Refactoring

- [ ] **Refactor dives.py router into multiple focused modules**
  - Split oversized dives.py file (130KB, 3,400+ lines) into focused modules
  - Create dives_crud.py for core CRUD operations
  - Create dives_admin.py for admin operations  
  - Create dives_media.py for media and tag operations
  - Create dives_search.py for search functionality
  - Create dives_import.py for Subsurface XML import
  - Create dives_profiles.py for dive profile management
  - Create dives_utils.py for utility functions
  - Maintain all existing API endpoints and functionality
  - Update tests and dependencies to reference new modules

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

*Tasks will be moved here as they are completed*