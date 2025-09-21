# AdvancedDiveProfileChart Component API Documentation

## Overview

The `AdvancedDiveProfileChart` component is a comprehensive React component for visualizing dive profile data with interactive features, mobile support, and accessibility options.

## Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `profileData` | `Object` | Dive profile data object containing samples, events, and metadata |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `screenSize` | `'mobile' \| 'desktop'` | `'desktop'` | Screen size for responsive behavior |
| `onDecoStatusChange` | `(hasDeco: boolean) => void` | `undefined` | Callback when decompression status changes |

## Profile Data Format

### ProfileData Object Structure

```typescript
interface ProfileData {
  samples: Sample[];
  events: Event[];
  sample_count: number;
  calculated_max_depth: number;
  calculated_avg_depth: number;
  calculated_duration_minutes: number;
  temperature_range: {
    min: number | null;
    max: number | null;
  };
}
```

### Sample Object Structure

```typescript
interface Sample {
  time: string;                    // Original time string (e.g., "10:30 min")
  time_minutes: number;            // Time in minutes (float)
  depth: number;                   // Depth in meters
  temperature?: number;            // Temperature in Celsius
  ndl_minutes?: number;           // No Decompression Limit in minutes
  in_deco?: boolean;              // Decompression status
  cns_percent?: number;           // CNS percentage
  averageDepth: number;           // Calculated running average depth
}
```

### Event Object Structure

```typescript
interface Event {
  time: string;                    // Original time string
  time_minutes: number;            // Time in minutes (float)
  type: string;                    // Event type (e.g., "25" for gas change)
  flags: string;                   // Event flags
  name: string;                    // Event name (e.g., "gaschange")
  cylinder: string;                // Cylinder number
  o2: string;                      // O2 percentage (e.g., "49.0%")
}
```

## Features

### Chart Visualization
- **Depth Profile**: Primary line showing depth over time
- **Average Depth**: Dotted line showing running average depth
- **Temperature**: Stepped, dotted, intermittent line on secondary Y-axis
- **Gas Change Markers**: Vertical lines indicating gas changes
- **Y-Axis Orientation**: Depth increases downward (0m at top)

### Interactive Features
- **Hover Tooltips**: Rich tooltips showing time, depth, average depth, NDL/CNS
- **Data Toggles**: Temperature visibility toggle
- **Smart Sampling**: Automatic sampling for dives with 1000+ samples
- **All Samples Toggle**: Switch between sampled and full dataset views

### Mobile Support
- **Touch Pan**: Single finger pan to navigate chart
- **Pinch-to-Zoom**: Two-finger pinch gesture for zooming
- **Reset Button**: Reset chart view to original state
- **Responsive Design**: Adapts to mobile viewport sizes

### Accessibility
- **High Contrast Mode**: Enhanced visibility for accessibility
- **Keyboard Navigation**: Full keyboard support
- **ARIA Labels**: Proper accessibility labels
- **Screen Reader Support**: Compatible with screen readers

### Export Functionality
- **PNG Export**: Export chart as PNG image
- **PDF Export**: Export chart as PDF document
- **Automatic Download**: Files are automatically downloaded

## Usage Examples

### Basic Usage

```jsx
import AdvancedDiveProfileChart from './AdvancedDiveProfileChart';

const DiveProfilePage = ({ diveId }) => {
  const [profileData, setProfileData] = useState(null);
  const [hasDeco, setHasDeco] = useState(false);

  return (
    <div>
      <h2>Dive Profile {hasDeco && '⚠️ Deco'}</h2>
      <AdvancedDiveProfileChart
        profileData={profileData}
        onDecoStatusChange={setHasDeco}
      />
    </div>
  );
};
```

### Mobile Usage

```jsx
import AdvancedDiveProfileChart from './AdvancedDiveProfileChart';

const MobileDiveProfile = ({ profileData }) => {
  return (
    <AdvancedDiveProfileChart
      profileData={profileData}
      screenSize="mobile"
    />
  );
};
```

### With Custom Callbacks

```jsx
import AdvancedDiveProfileChart from './AdvancedDiveProfileChart';

const DiveProfileWithCallbacks = ({ profileData }) => {
  const handleDecoStatusChange = (hasDeco) => {
    console.log('Decompression status:', hasDeco ? 'In Deco' : 'No Deco');
    // Update UI or analytics
  };

  return (
    <AdvancedDiveProfileChart
      profileData={profileData}
      onDecoStatusChange={handleDecoStatusChange}
    />
  );
};
```

## Best Practices

### Performance Optimization
- Use smart sampling for large datasets (>1000 samples)
- Implement proper memoization for expensive calculations
- Consider using `React.memo` for the component if re-rendering frequently

### Data Preparation
- Ensure all time values are properly converted to minutes
- Validate that depth values are in meters
- Check that temperature values are in Celsius
- Verify event data includes proper time_minutes values

### Mobile Considerations
- Test on actual mobile devices for touch interactions
- Ensure chart is readable on small screens
- Consider providing alternative views for very small screens

### Accessibility
- Always provide proper ARIA labels
- Test with screen readers
- Ensure high contrast mode works correctly
- Provide keyboard alternatives for touch interactions

## Troubleshooting

### Common Issues

#### Chart Not Rendering
- **Cause**: Missing or invalid profileData
- **Solution**: Check that profileData contains valid samples array
- **Debug**: Console.log profileData to verify structure

#### Mobile Touch Not Working
- **Cause**: Touch events not properly bound
- **Solution**: Ensure component is mounted and screenSize is set to 'mobile'
- **Debug**: Check browser developer tools for touch event errors

#### Export Not Working
- **Cause**: Missing html2canvas or jsPDF dependencies
- **Solution**: Ensure dependencies are installed: `npm install html2canvas jspdf`
- **Debug**: Check browser console for missing dependency errors

#### Performance Issues
- **Cause**: Large dataset without smart sampling
- **Solution**: Enable smart sampling for datasets >1000 samples
- **Debug**: Check sample count in profileData

#### Tooltips Not Showing
- **Cause**: Invalid sample data or missing time_minutes
- **Solution**: Verify all samples have valid time_minutes values
- **Debug**: Check sample data structure and validation

### Debug Mode

Enable debug logging by setting the component in debug mode:

```jsx
<AdvancedDiveProfileChart
  profileData={profileData}
  debug={true} // Add this prop for debug logging
/>
```

## Dependencies

### Required
- `react` (^18.0.0)
- `recharts` (^2.8.0)
- `lucide-react` (^0.263.0)

### Optional (for export functionality)
- `html2canvas` (^1.4.0)
- `jspdf` (^2.5.0)

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Touch Support**: iOS 14+, Android 10+

## Version History

- **v1.0.0**: Initial implementation with basic chart functionality
- **v1.1.0**: Added mobile touch interactions and export functionality
- **v1.2.0**: Added smart sampling and accessibility features
- **v1.3.0**: Added gas change markers and decompression status visualization

