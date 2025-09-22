# Dive Profile Visualization Troubleshooting Guide

## Common Issues and Solutions

### Chart Not Displaying

#### Issue: Blank chart area

**Symptoms:**

- Chart container is visible but no data is shown
- Loading spinner continues indefinitely
- Error messages in browser console

**Causes & Solutions:**

1. **Missing Profile Data**

   ```javascript
   // Check if profileData exists and has samples
   console.log('Profile data:', profileData);
   console.log('Samples count:', profileData?.samples?.length);
   ```

   - **Solution**: Ensure profile data is loaded before rendering chart
   - **Fix**: Add loading state and data validation

2. **Invalid Data Format**

   ```javascript
   // Validate data structure
   if (!profileData?.samples || !Array.isArray(profileData.samples)) {
     console.error('Invalid profile data structure');
   }
   ```

   - **Solution**: Validate data format before passing to component
   - **Fix**: Add data validation and error handling

3. **Missing Dependencies**

   ```javascript
   // Check if Recharts is loaded
   console.log('Recharts available:', typeof Recharts !== 'undefined');
   ```

   - **Solution**: Ensure Recharts is properly installed
   - **Fix**: `npm install recharts`

#### Issue: Chart renders but shows no lines

**Symptoms:**

- Chart axes are visible but no data lines
- Empty chart with only grid lines

**Causes & Solutions:**

1. **Invalid Sample Data**

   ```javascript
   // Check sample data validity
   profileData.samples.forEach((sample, index) => {
     if (!sample.time_minutes || !sample.depth) {
       console.error(`Invalid sample at index ${index}:`, sample);
     }
   });
   ```

   - **Solution**: Validate all samples have required fields
   - **Fix**: Filter out invalid samples

2. **Data Range Issues**

   ```javascript
   // Check data ranges
   const depths = profileData.samples.map(s => s.depth);
   console.log('Depth range:', Math.min(...depths), 'to', Math.max(...depths));
   ```

   - **Solution**: Ensure data has valid ranges
   - **Fix**: Add data validation and normalization

### Mobile Touch Issues

#### Issue: Touch interactions not working

**Symptoms:**

- Touch gestures don't respond
- Pan and zoom don't work on mobile
- Touch events not detected

**Causes & Solutions:**

1. **Missing Touch Event Handlers**

   ```javascript
   // Check if touch handlers are bound
   const chartElement = document.querySelector('[role="application"]').parentElement;
   console.log('Touch handlers:', chartElement.ontouchstart, chartElement.ontouchmove);
   ```

   - **Solution**: Ensure touch event handlers are properly bound
   - **Fix**: Check component mounting and event binding

2. **Screen Size Detection**

   ```javascript
   // Verify screen size detection
   console.log('Screen size prop:', screenSize);
   console.log('Window width:', window.innerWidth);
   ```

   - **Solution**: Ensure screenSize prop is correctly set to 'mobile'
   - **Fix**: Implement proper screen size detection

3. **Touch Event Prevention**

   ```javascript
   // Check if touch events are being prevented
   chartElement.addEventListener('touchstart', (e) => {
     console.log('Touch start event fired');
   });
   ```

   - **Solution**: Ensure touch events are not prevented by other elements
   - **Fix**: Check CSS touch-action and event propagation

#### Issue: Reset button not appearing

**Symptoms:**

- Chart can be transformed but no reset button
- Mobile controls not visible

**Causes & Solutions:**

1. **Transform State Not Detected**

   ```javascript
   // Check transform state
   console.log('Chart scale:', chartScale);
   console.log('Chart offset:', chartOffset);
   ```

   - **Solution**: Ensure transform state is properly tracked
   - **Fix**: Check state management and update logic

2. **Screen Size Mismatch**

   ```javascript
   // Verify mobile detection
   const isMobile = screenSize === 'mobile';
   const shouldShowReset = isMobile && (chartScale !== 1 || chartOffset.x !== 0 || chartOffset.y !== 0);
   console.log('Should show reset:', shouldShowReset);
   ```

   - **Solution**: Ensure proper mobile detection
   - **Fix**: Implement consistent screen size detection

### Export Functionality Issues

#### Issue: Export buttons not working

**Symptoms:**

- Export dropdown doesn't appear
- Clicking export buttons does nothing
- No files downloaded

**Causes & Solutions:**

1. **Missing Dependencies**

   ```javascript
   // Check if export libraries are available
   console.log('html2canvas available:', typeof html2canvas !== 'undefined');
   console.log('jsPDF available:', typeof jsPDF !== 'undefined');
   ```

   - **Solution**: Install required dependencies
   - **Fix**: `npm install html2canvas jspdf`

2. **Canvas Rendering Issues**

   ```javascript
   // Check canvas rendering
   const canvas = document.createElement('canvas');
   console.log('Canvas supported:', !!canvas.getContext);
   ```

   - **Solution**: Ensure browser supports canvas rendering
   - **Fix**: Check browser compatibility

3. **File Download Blocked**

   ```javascript
   // Check if downloads are blocked
   console.log('Download blocked:', navigator.userAgent.includes('Chrome'));
   ```

   - **Solution**: Check browser download settings
   - **Fix**: Ensure downloads are allowed for the domain

#### Issue: Export files are corrupted

**Symptoms:**

- Files download but won't open
- Empty or corrupted files
- Wrong file format

**Causes & Solutions:**

1. **Canvas Data Issues**

   ```javascript
   // Check canvas data
   const canvas = document.querySelector('canvas');
   const dataURL = canvas.toDataURL('image/png');
   console.log('Data URL length:', dataURL.length);
   ```

   - **Solution**: Ensure canvas has valid data
   - **Fix**: Check chart rendering and data validity

2. **PDF Generation Issues**

   ```javascript
   // Check PDF generation
   const pdf = new jsPDF();
   console.log('PDF created:', !!pdf);
   ```

   - **Solution**: Ensure jsPDF is properly initialized
   - **Fix**: Check jsPDF version compatibility

### Performance Issues

#### Issue: Slow rendering with large datasets

**Symptoms:**

- Chart takes long time to load
- Browser becomes unresponsive
- Memory usage high

**Causes & Solutions:**

1. **Large Dataset Without Sampling**

   ```javascript
   // Check dataset size
   console.log('Sample count:', profileData.samples.length);
   console.log('Smart sampling enabled:', profileData.samples.length > 1000);
   ```

   - **Solution**: Enable smart sampling for large datasets
   - **Fix**: Implement automatic sampling for datasets >1000 samples

2. **Inefficient Re-renders**

   ```javascript
   // Check component re-renders
   console.log('Component rendered at:', new Date().toISOString());
   ```

   - **Solution**: Optimize component with React.memo and useMemo
   - **Fix**: Add proper memoization and dependency arrays

3. **Memory Leaks**

   ```javascript
   // Check for memory leaks
   console.log('Memory usage:', performance.memory?.usedJSHeapSize);
   ```

   - **Solution**: Clean up event listeners and timers
   - **Fix**: Implement proper cleanup in useEffect

### Data Import Issues

#### Issue: XML import fails

**Symptoms:**

- Import process starts but fails
- Error messages during import
- No profile data saved

**Causes & Solutions:**

1. **Invalid XML Format**

   ```javascript
   // Check XML parsing
   try {
     const parser = new DOMParser();
     const doc = parser.parseFromString(xmlContent, 'text/xml');
     console.log('XML valid:', !doc.querySelector('parsererror'));
   } catch (error) {
     console.error('XML parsing error:', error);
   }
   ```

   - **Solution**: Validate XML format before processing
   - **Fix**: Add XML validation and error handling

2. **Missing Required Fields**

   ```javascript
   // Check for required fields in XML
   const samples = doc.querySelectorAll('sample');
   samples.forEach((sample, index) => {
     if (!sample.getAttribute('time') || !sample.getAttribute('depth')) {
       console.error(`Missing required fields in sample ${index}`);
     }
   });
   ```

   - **Solution**: Validate XML structure before processing
   - **Fix**: Add field validation and error reporting

3. **Time Format Issues**

   ```javascript
   // Check time format parsing
   const timeStr = sample.getAttribute('time');
   const timeMinutes = parseTimeToMinutes(timeStr);
   console.log('Time parsed:', timeStr, '->', timeMinutes);
   ```

   - **Solution**: Ensure time format is supported
   - **Fix**: Add time format validation and conversion

### Accessibility Issues

#### Issue: High contrast mode not working

**Symptoms:**

- High contrast toggle doesn't change appearance
- Colors remain the same when enabled
- Toggle button state doesn't update

**Causes & Solutions:**

1. **CSS Not Applied**

   ```javascript
   // Check if high contrast class is applied
   const chartElement = document.querySelector('.dive-profile-chart');
   console.log('High contrast class:', chartElement.classList.contains('high-contrast'));
   ```

   - **Solution**: Ensure CSS classes are properly applied
   - **Fix**: Check CSS implementation and class toggling

2. **State Management Issues**

   ```javascript
   // Check high contrast state
   console.log('High contrast enabled:', highContrastMode);
   ```

   - **Solution**: Ensure state is properly managed
   - **Fix**: Check state updates and component re-rendering

#### Issue: Screen reader not announcing changes

**Symptoms:**

- Screen reader doesn't announce chart updates
- ARIA labels not working
- Keyboard navigation issues

**Causes & Solutions:**

1. **Missing ARIA Labels**

   ```javascript
   // Check ARIA labels
   const chartElement = document.querySelector('[role="application"]');
   console.log('ARIA label:', chartElement.getAttribute('aria-label'));
   ```

   - **Solution**: Ensure proper ARIA labels are set
   - **Fix**: Add comprehensive ARIA labeling

2. **Live Region Not Updated**

   ```javascript
   // Check live region updates
   const liveRegion = document.querySelector('[aria-live]');
   console.log('Live region content:', liveRegion?.textContent);
   ```

   - **Solution**: Ensure live regions are updated with changes
   - **Fix**: Implement proper live region updates

## Debug Tools

### Browser Developer Tools

1. **Console Logging**

   ```javascript
   // Enable debug logging
   const DEBUG = true;
   if (DEBUG) {
     console.log('Profile data:', profileData);
     console.log('Chart state:', { screenSize, highContrastMode });
   }
   ```

2. **Performance Monitoring**

   ```javascript
   // Monitor performance
   const startTime = performance.now();
   // ... chart rendering code ...
   const endTime = performance.now();
   console.log('Rendering time:', endTime - startTime, 'ms');
   ```

3. **Memory Usage**

   ```javascript
   // Check memory usage
   if (performance.memory) {
     console.log('Memory usage:', {
       used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
       total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB'
     });
   }
   ```

### Component Debug Mode

```javascript
// Enable debug mode
<AdvancedDiveProfileChart
  profileData={profileData}
  debug={true}
  onDebug={(info) => console.log('Debug info:', info)}
/>
```

## Getting Help

### Log Collection

When reporting issues, collect the following information:

1. **Browser Information**
   - Browser name and version
   - Operating system
   - Screen resolution

2. **Error Messages**
   - Console errors
   - Network errors
   - Component errors

3. **Data Information**
   - Sample count
   - Data format
   - Import method

4. **Steps to Reproduce**

   - Detailed steps
   - Expected behavior
   - Actual behavior

### Contact Information

- **GitHub Issues**: [Repository Issues](https://github.com/divemap/divemap/issues)
- **Documentation**: [Component API Docs](./AdvancedDiveProfileChart-API.md)
- **Data Format**: [Data Format Docs](./DiveProfileDataFormat.md)
