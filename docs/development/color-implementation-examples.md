# Color Implementation Examples for Divemap Frontend

## Quick Reference

### Import Color Constants
```javascript
// ✅ RECOMMENDED - Import from centralized location
import { CHART_COLORS, UI_COLORS } from '../utils/colorPalette';

// Usage
const depthColor = CHART_COLORS.depth; // #0072B2
const warningColor = UI_COLORS.warning; // #D55E00
```

### Direct Color Usage
```javascript
// ✅ ACCEPTABLE - Direct hex codes for approved colors
const depthColor = '#0072B2';  // Okabe-Ito Blue
const avgDepthColor = '#E69F00'; // Okabe-Ito Orange
const tempColor = '#009E73';   // Okabe-Ito Bluish Green
```

## React Component Examples

### Chart Components
```jsx
// ✅ CORRECT - Chart line colors
<Line
  dataKey="depth"
  stroke="#0072B2"  // Okabe-Ito Blue
  strokeWidth={3}
  name="Depth"
/>

<Line
  dataKey="averageDepth"
  stroke="#E69F00"  // Okabe-Ito Orange
  strokeDasharray="5 5"
  name="Average Depth"
/>
```

### Tooltip Colors
```jsx
// ✅ CORRECT - Tooltip text colors
<div className="flex justify-between">
  <span style={{ color: '#0072B2' }}>Depth:</span>
  <span className="font-medium">{data.depth?.toFixed(1)}m</span>
</div>

<div className="flex justify-between">
  <span style={{ color: '#E69F00' }}>Avg Depth:</span>
  <span className="font-medium">{data.averageDepth?.toFixed(1)}m</span>
</div>
```

### Legend Colors
```jsx
// ✅ CORRECT - Legend indicator colors
<div className="flex items-center space-x-2">
  <div 
    className="w-4 h-0.5" 
    style={{ backgroundColor: '#0072B2' }}
  ></div>
  <span className="text-gray-700">Depth</span>
</div>

<div className="flex items-center space-x-2">
  <div
    className="w-4 h-0.5 border-dashed border-t-2"
    style={{ borderColor: '#E69F00' }}
  ></div>
  <span className="text-gray-700">Average Depth</span>
</div>
```

### Button and UI Colors
```jsx
// ✅ CORRECT - Button colors
<button 
  className="px-4 py-2 rounded"
  style={{ backgroundColor: '#0072B2', color: 'white' }}
>
  Primary Action
</button>

<button 
  className="px-4 py-2 rounded border-2"
  style={{ borderColor: '#D55E00', color: '#D55E00' }}
>
  Warning Action
</button>
```

## CSS Implementation

### Utility Classes
```css
/* ✅ RECOMMENDED - Define utility classes */
.depth-color { color: #0072B2; }
.avg-depth-color { color: #E69F00; }
.temperature-color { color: #009E73; }
.ndl-color { color: #D55E00; }
.cns-color { color: #CC79A7; }
.event-color { color: #F0E442; }
.gas-change-color { color: #56B4E9; }

/* Background variants */
.bg-depth { background-color: #0072B2; }
.bg-avg-depth { background-color: #E69F00; }
.bg-temperature { background-color: #009E73; }
.bg-ndl { background-color: #D55E00; }
.bg-cns { background-color: #CC79A7; }
.bg-event { background-color: #F0E442; }
.bg-gas-change { background-color: #56B4E9; }
```

### Chart Styling
```css
/* ✅ CORRECT - Chart-specific styles */
.chart-depth-line {
  stroke: #0072B2;
  stroke-width: 3;
}

.chart-avg-depth-line {
  stroke: #E69F00;
  stroke-width: 2;
  stroke-dasharray: 5 5;
}

.chart-temperature-line {
  stroke: #009E73;
  stroke-width: 2;
  stroke-dasharray: 5 5;
}
```

## Tailwind CSS Integration

### Custom Color Extensions
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Colorblind-safe palette
        'okabe-blue': '#0072B2',
        'okabe-orange': '#E69F00',
        'okabe-green': '#009E73',
        'okabe-vermillion': '#D55E00',
        'okabe-purple': '#CC79A7',
        'okabe-yellow': '#F0E442',
        'okabe-sky': '#56B4E9',
      }
    }
  }
}
```

### Usage with Tailwind
```jsx
// ✅ CORRECT - Using custom Tailwind colors
<div className="text-okabe-blue">Depth: 25m</div>
<button className="bg-okabe-orange text-white">Action</button>
<span className="text-okabe-vermillion">Warning</span>
```

## Common Mistakes to Avoid

### ❌ Don't Use These Colors
```javascript
// WRONG - Prohibited colors
const badColors = {
  red: '#dc2626',      // Old red
  green: '#059669',    // Old green
  blue: '#2563eb',     // Old blue
  purple: '#7c3aed',   // Old purple
  amber: '#f59e0b'     // Old amber
};
```

### ❌ Don't Mix Old and New Colors
```jsx
// WRONG - Inconsistent color usage
<div style={{ color: '#0072B2' }}>Depth</div>      // New color
<span className="text-red-600">Average</span>      // Old color
```

### ❌ Don't Use Red-Green Combinations
```jsx
// WRONG - Colorblind problematic
<div className="text-red-600">Error</div>
<div className="text-green-600">Success</div>
```

## Testing Examples

### Color Contrast Testing
```javascript
// ✅ RECOMMENDED - Test color combinations
const testColorContrast = (foreground, background) => {
  // Use WebAIM contrast checker or similar tool
  // Ensure 4.5:1 ratio for normal text, 3:1 for large text
  console.log(`Testing ${foreground} on ${background}`);
};
```

### Colorblind Simulation
```javascript
// ✅ RECOMMENDED - Test with colorblind simulation
// Use Color Oracle or similar tool to verify:
// - Protanopia (red-blind)
// - Deuteranopia (green-blind) 
// - Tritanopia (blue-blind)
```

## Migration Examples

### Updating Existing Components
```jsx
// BEFORE - Old colors
<div className="text-blue-600">Depth</div>
<span className="text-red-600">Average</span>

// AFTER - New colors
<div style={{ color: '#0072B2' }}>Depth</div>
<span style={{ color: '#E69F00' }}>Average</span>
```

### Updating Chart Configurations
```javascript
// BEFORE - Old chart colors
const oldColors = {
  depth: '#2563eb',
  avgDepth: '#dc2626',
  temperature: '#059669'
};

// AFTER - New chart colors
const newColors = {
  depth: '#0072B2',      // Okabe-Ito Blue
  avgDepth: '#E69F00',   // Okabe-Ito Orange
  temperature: '#009E73' // Okabe-Ito Bluish Green
};
```

---

**Last Updated**: December 27, 2024  
**Version**: 1.0  
**Maintained by**: Divemap Development Team
