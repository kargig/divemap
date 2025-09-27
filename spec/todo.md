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

*Tasks will be moved here as they are completed*