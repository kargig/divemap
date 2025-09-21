/**
 * Dive Profile Data Processing Utilities
 *
 * This module provides utility functions for processing dive profile data
 * from the backend API and preparing it for visualization with Recharts.
 */

/**
 * Process raw dive profile data for chart visualization
 * @param {Object} profileData - Raw profile data from API
 * @returns {Object} Processed data ready for charting
 */
export const processDiveProfileData = profileData => {
  if (!profileData || !profileData.samples) {
    return {
      chartData: [],
      averageDepth: 0,
      maxDepth: 0,
      duration: 0,
      temperatureRange: { min: null, max: null },
      events: [],
    };
  }

  const samples = profileData.samples;
  const events = profileData.events || [];

  // Process samples for chart data with running average depth
  let runningDepthSum = 0;
  const chartData = samples.map((sample, index) => {
    const depth = sample.depth || 0;
    runningDepthSum += depth;
    const averageDepth = runningDepthSum / (index + 1);

    return {
      time: sample.time_minutes || 0,
      depth: depth, // Keep original depth values
      averageDepth: Math.round(averageDepth * 100) / 100, // Round to 2 decimal places
      temperature: sample.temperature || null,
      ndl: sample.ndl_minutes || null,
      cns: sample.cns_percent || null,
      in_deco: sample.in_deco || false,
    };
  });

  // Calculate average depth
  const depths = samples.map(s => s.depth).filter(d => d !== null && d !== undefined);
  const averageDepth =
    depths.length > 0 ? depths.reduce((sum, depth) => sum + depth, 0) / depths.length : 0;

  // Get max depth
  const maxDepth = Math.max(...depths, 0);

  // Get duration (last sample time)
  const duration = samples.length > 0 ? samples[samples.length - 1].time_minutes || 0 : 0;

  // Get temperature range
  const temperatures = samples.map(s => s.temperature).filter(t => t !== null && t !== undefined);
  const temperatureRange = {
    min: temperatures.length > 0 ? Math.min(...temperatures) : null,
    max: temperatures.length > 0 ? Math.max(...temperatures) : null,
  };

  // Process events
  const processedEvents = events.map(event => ({
    time: event.time_minutes || 0,
    type: event.type,
    name: event.name,
    description: getEventDescription(event),
  }));

  return {
    chartData,
    averageDepth: Math.round(averageDepth * 100) / 100, // Round to 2 decimal places
    maxDepth: Math.round(maxDepth * 100) / 100,
    duration: Math.round(duration * 100) / 100,
    temperatureRange,
    events: processedEvents,
    sampleCount: samples.length,
  };
};

/**
 * Get human-readable description for dive events
 * @param {Object} event - Event object from API
 * @returns {String} Human-readable description
 */
const getEventDescription = event => {
  switch (event.name) {
    case 'gaschange':
      return `Gas change to ${event.o2 || 'unknown'}% O2`;
    case 'deco':
      return 'Decompression stop';
    case 'ascent':
      return 'Ascent';
    case 'descent':
      return 'Descent';
    default:
      return event.name || 'Unknown event';
  }
};

/**
 * Calculate average depth line data for chart overlay
 * @param {Array} chartData - Processed chart data
 * @param {Number} averageDepth - Average depth value
 * @returns {Array} Average depth line data
 */
export const calculateAverageDepthLine = (chartData, averageDepth) => {
  if (!chartData || chartData.length === 0) return [];

  return chartData.map(point => ({
    time: point.time,
    depth: averageDepth,
  }));
};

/**
 * Generate NDL (No Decompression Limit) zones for chart
 * @param {Array} chartData - Processed chart data
 * @returns {Array} NDL zone data
 */
export const generateNDLZones = chartData => {
  if (!chartData || chartData.length === 0) return [];

  const zones = [];
  let currentZone = null;

  chartData.forEach((point, index) => {
    if (point.ndl !== null && point.ndl !== undefined) {
      if (!currentZone) {
        currentZone = {
          startTime: point.time,
          endTime: point.time,
          ndl: point.ndl,
          depth: point.depth,
        };
      } else if (currentZone.ndl === point.ndl) {
        currentZone.endTime = point.time;
      } else {
        // Zone changed, finalize current zone and start new one
        zones.push({ ...currentZone });
        currentZone = {
          startTime: point.time,
          endTime: point.time,
          ndl: point.ndl,
          depth: point.depth,
        };
      }
    } else if (currentZone) {
      // No NDL data, finalize current zone
      zones.push({ ...currentZone });
      currentZone = null;
    }
  });

  // Finalize last zone if exists
  if (currentZone) {
    zones.push(currentZone);
  }

  return zones;
};

/**
 * Validate dive profile data
 * @param {Object} profileData - Raw profile data from API
 * @returns {Object} Validation result with isValid and errors
 */
export const validateDiveProfileData = profileData => {
  const errors = [];

  if (!profileData) {
    errors.push('No profile data provided');
    return { isValid: false, errors };
  }

  if (!profileData.samples || !Array.isArray(profileData.samples)) {
    errors.push('No sample data found');
    return { isValid: false, errors };
  }

  if (profileData.samples.length === 0) {
    errors.push('No sample points found');
    return { isValid: false, errors };
  }

  // Check for required sample data
  const hasDepth = profileData.samples.some(s => s.depth !== null && s.depth !== undefined);
  if (!hasDepth) {
    errors.push('No depth data found in samples');
  }

  const hasTime = profileData.samples.some(
    s => s.time_minutes !== null && s.time_minutes !== undefined
  );
  if (!hasTime) {
    errors.push('No time data found in samples');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Format time for display
 * @param {Number} timeMinutes - Time in minutes
 * @returns {String} Formatted time string
 */
export const formatTime = timeMinutes => {
  if (timeMinutes < 60) {
    return `${Math.round(timeMinutes)}m`;
  }

  const hours = Math.floor(timeMinutes / 60);
  const minutes = Math.round(timeMinutes % 60);
  return `${hours}h ${minutes}m`;
};

/**
 * Format depth for display
 * @param {Number} depth - Depth in meters
 * @returns {String} Formatted depth string
 */
export const formatDepth = depth => {
  return `${Math.round(depth * 10) / 10}m`;
};

/**
 * Format temperature for display
 * @param {Number} temperature - Temperature in Celsius
 * @returns {String} Formatted temperature string
 */
export const formatTemperature = temperature => {
  return `${Math.round(temperature * 10) / 10}°C`;
};

/**
 * Get chart configuration for different screen sizes
 * @param {String} screenSize - Screen size ('mobile', 'tablet', 'desktop')
 * @returns {Object} Chart configuration
 */
export const getChartConfig = (screenSize = 'desktop') => {
  const configs = {
    mobile: {
      height: 300,
      margin: { top: 20, right: 20, bottom: 40, left: 40 },
      fontSize: 12,
      strokeWidth: 2,
    },
    tablet: {
      height: 400,
      margin: { top: 30, right: 30, bottom: 50, left: 50 },
      fontSize: 14,
      strokeWidth: 2.5,
    },
    desktop: {
      height: 500,
      margin: { top: 40, right: 40, bottom: 60, left: 60 },
      fontSize: 16,
      strokeWidth: 3,
    },
  };

  return configs[screenSize] || configs.desktop;
};

/**
 * Generate color scheme for chart elements
 * @returns {Object} Color scheme
 */
export const getChartColors = () => {
  return {
    depth: '#2563eb', // Blue for depth line
    averageDepth: '#dc2626', // Red for average depth line
    temperature: '#059669', // Green for temperature
    ndl: '#f59e0b', // Amber for NDL zones
    cns: '#7c3aed', // Purple for CNS
    events: '#ef4444', // Red for events
    grid: '#e5e7eb', // Light gray for grid
    text: '#374151', // Dark gray for text
  };
};
