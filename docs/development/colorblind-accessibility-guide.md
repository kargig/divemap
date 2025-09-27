# Colorblind Accessibility Guide for Divemap Frontend

## Overview

This guide provides comprehensive information about colorblind accessibility in the Divemap frontend application. It covers the colorblind-safe color palette, implementation guidelines, testing procedures, and best practices for creating accessible user interfaces.

## Colorblind Statistics

- **8% of men** and **0.5% of women** worldwide experience some form of color blindness
- **Red-green color blindness** (protanopia/deuteranopia) is the most common type
- **Blue-yellow color blindness** (tritanopia) affects a smaller percentage
- **Complete color blindness** (monochromacy) is rare but should be considered

## Colorblind-Safe Color Palette

### Primary Data Colors (Most Important)

| Color Name | Hex Code | Usage | Accessibility Notes |
|------------|----------|-------|-------------------|
| **Okabe-Ito Blue** | `#0072B2` | Main data lines, primary actions | High contrast, distinguishable by all colorblind types |
| **Okabe-Ito Orange** | `#E69F00` | Secondary data, average values | High visibility, distinct from blue |

### Secondary Data Colors (Important Overlays)

| Color Name | Hex Code | Usage | Accessibility Notes |
|------------|----------|-------|-------------------|
| **Okabe-Ito Bluish Green** | `#009E73` | Temperature, environmental data | Distinct from blue, avoids red-green issues |
| **Okabe-Ito Vermillion** | `#D55E00` | NDL zones, warnings, alerts | Warm color, high visibility |
| **Okabe-Ito Reddish Purple** | `#CC79A7` | CNS, specialized data | Distinct purple, not problematic blue-purple |

### Event and Marker Colors

| Color Name | Hex Code | Usage | Accessibility Notes |
|------------|----------|-------|-------------------|
| **Okabe-Ito Yellow** | `#F0E442` | Gas change events, highlights | High visibility, distinct |
| **Okabe-Ito Sky Blue** | `#56B4E9` | Other events, secondary markers | Light blue, distinct from main depth line |

### Supporting Colors (Neutral)

| Color Name | Hex Code | Usage | Accessibility Notes |
|------------|----------|-------|-------------------|
| **Light Gray** | `#E5E7EB` | Grid lines, borders | Neutral, good contrast |
| **Dark Gray** | `#374151` | Text, labels | High contrast for readability |

## Implementation Guidelines

### 1. Chart Visualizations
- **Depth lines**: Use `#0072B2` (Okabe-Ito Blue)
- **Average depth**: Use `#E69F00` (Okabe-Ito Orange)
- **Temperature**: Use `#009E73` (Okabe-Ito Bluish Green)
- **NDL zones**: Use `#D55E00` (Okabe-Ito Vermillion)
- **CNS data**: Use `#CC79A7` (Okabe-Ito Reddish Purple)
- **Events**: Use `#F0E442` (Okabe-Ito Yellow) or `#56B4E9` (Okabe-Ito Sky Blue)

### 2. UI Components
- **Primary buttons**: Use `#0072B2` (Okabe-Ito Blue)
- **Warning/Alert elements**: Use `#D55E00` (Okabe-Ito Vermillion)
- **Success/Positive elements**: Use `#009E73` (Okabe-Ito Bluish Green)
- **Highlighted elements**: Use `#F0E442` (Okabe-Ito Yellow)

### 3. Text and Labels
- **Primary text**: Use `#374151` (Dark Gray)
- **Secondary text**: Use `#6B7280` (Medium Gray)
- **Data labels**: Use corresponding data color from palette

## Accessibility Benefits

- **Eliminates red-green combinations** that affect ~8% of men and 0.5% of women
- **High contrast ratios** for better readability
- **Distinguishable across all colorblind types** (protanopia, deuteranopia, tritanopia)
- **Perceptually uniform** progression for sequential data
- **Tested and validated** by color vision deficiency research

## Testing and Validation

### Color Contrast Testing
- All colors meet WCAG AA standards for contrast ratios
- Tested with colorblind simulation tools (Color Oracle, Coblis)
- Validated across different screen types and lighting conditions

### Colorblind Simulation Tools
1. **Color Oracle** - Desktop application for colorblind simulation
2. **Coblis** - Online colorblind simulator
3. **WebAIM Contrast Checker** - Color contrast validation
4. **Chrome DevTools** - Built-in colorblind simulation

### Testing Checklist
- [ ] Test with protanopia simulation (red-blind)
- [ ] Test with deuteranopia simulation (green-blind)
- [ ] Test with tritanopia simulation (blue-blind)
- [ ] Verify 4.5:1 contrast ratio for normal text
- [ ] Verify 3:1 contrast ratio for large text
- [ ] Test on different screen types and lighting

## Common Mistakes to Avoid

### ❌ Problematic Color Combinations
```jsx
// WRONG - Red-green combination
<span className="text-red-600">Error</span>
<span className="text-green-600">Success</span>

// WRONG - Red-blue combination
<div style={{ color: '#dc2626' }}>Depth</div>
<div style={{ color: '#2563eb' }}>Temperature</div>
```

### ❌ Inconsistent Color Usage
```jsx
// WRONG - Mixing old and new colors
<div style={{ color: '#0072B2' }}>Depth</div>      // New color
<span className="text-red-600">Average</span>      // Old color
```

### ❌ Hardcoded Colors
```jsx
// WRONG - Hardcoded colors
<div style={{ color: '#dc2626' }}>Depth</div>

// CORRECT - Use color constants
<div style={{ color: CHART_COLORS.depth }}>Depth</div>
```

## Migration Guide

### Updating Existing Colors
1. **Identify old colors** in codebase
2. **Map to new palette** using color mapping table
3. **Update all instances** consistently
4. **Test with colorblind simulation**
5. **Update documentation**

### Color Mapping Table
| Old Color | New Color | Usage |
|-----------|-----------|-------|
| `#2563eb` | `#0072B2` | Primary blue |
| `#dc2626` | `#E69F00` | Primary red → Orange |
| `#059669` | `#009E73` | Primary green |
| `#f59e0b` | `#D55E00` | Amber → Vermillion |
| `#7c3aed` | `#CC79A7` | Purple → Reddish Purple |
| `#ef4444` | `#56B4E9` | Red → Sky Blue |

## Resources

### Research and Standards
- [Okabe-Ito Color Palette](https://jfly.uni-koeln.de/color/) - Original research and palette
- [ColorBrewer](https://colorbrewer2.org/) - Additional colorblind-safe palettes
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Web accessibility guidelines
- [Section 508 Standards](https://www.section508.gov/) - US federal accessibility requirements

### Testing Tools
- [Color Oracle](https://colororacle.org/) - Colorblind simulation tool
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Contrast validation
- [Coblis](https://www.color-blindness.com/coblis-color-blindness-simulator/) - Online simulator
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/accessibility/) - Built-in accessibility tools

### Additional Resources
- [Color Universal Design Organization](https://jfly.uni-koeln.de/color/) - Research and guidelines
- [WebAIM Color and Contrast](https://webaim.org/articles/visual/color) - Comprehensive guide
- [A11y Project Color Contrast](https://www.a11yproject.com/posts/2019-01-05-color-contrast/) - Best practices

## Maintenance

### Regular Review Process
- **Quarterly accessibility audit** of color usage
- **User feedback collection** from colorblind users
- **Color palette updates** based on new research
- **Testing with updated simulation tools**

### Adding New Colors
1. **Test for colorblind accessibility** using simulation tools
2. **Ensure high contrast** with existing palette colors
3. **Document usage** and accessibility notes
4. **Update color palette constants** in `src/utils/colorPalette.js`
5. **Update this documentation** with new color entries

---

**Last Updated**: December 27, 2024  
**Version**: 1.0  
**Maintained by**: Divemap Development Team
