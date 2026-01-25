/**
 * Wind Suitability Helpers
 * Utilities for working with wind suitability data and color coding
 */

import { CHART_COLORS, UI_COLORS } from './colorPalette';

/**
 * Wind suitability color mapping using colorblind-safe palette
 * Based on Okabe-Ito colorblind-safe colors
 */
export const SUITABILITY_COLORS = {
  /** Good conditions - Okabe-Ito Bluish Green (safe, environmental) */
  good: '#009E73', // CHART_COLORS.temperature

  /** Caution conditions - Okabe-Ito Yellow (warning, high visibility) */
  caution: '#F0E442', // CHART_COLORS.events

  /** Difficult conditions - Okabe-Ito Orange (caution, experienced divers) */
  difficult: '#E69F00', // CHART_COLORS.averageDepth

  /** Avoid conditions - Okabe-Ito Vermillion (danger, warning) */
  avoid: '#D55E00', // CHART_COLORS.ndl

  /** Unknown suitability - Light Gray (neutral, no data) */
  unknown: '#E5E7EB', // CHART_COLORS.grid
};

/**
 * Get color for a suitability level
 * @param {string} suitability - Suitability level: 'good', 'caution', 'difficult', 'avoid', 'unknown'
 * @returns {string} Hex color code
 */
export const getSuitabilityColor = suitability => {
  return SUITABILITY_COLORS[suitability] || SUITABILITY_COLORS.unknown;
};

/**
 * Get suitability label
 * @param {string} suitability - Suitability level
 * @returns {string} Human-readable label
 */
export const getSuitabilityLabel = suitability => {
  const labels = {
    good: 'Good Conditions',
    caution: 'Caution',
    difficult: 'Difficult',
    avoid: 'Avoid',
    unknown: 'Unknown',
  };
  return labels[suitability] || 'Unknown';
};

/**
 * Get suitability description
 * @param {string} suitability - Suitability level
 * @returns {string} Detailed description
 */
export const getSuitabilityDescription = suitability => {
  const descriptions = {
    good: 'Safe conditions, ideal for diving',
    caution: 'Moderate conditions, experienced divers OK',
    difficult: 'Challenging conditions, experienced divers only',
    avoid: 'Dangerous conditions, not recommended',
    unknown: 'Cannot determine suitability (no shore direction data)',
  };
  return descriptions[suitability] || 'Unknown suitability';
};

/**
 * Format wind speed in multiple units
 * @param {number} speedMs - Wind speed in m/s
 * @returns {Object} Object with speed in different units
 */
export const formatWindSpeed = speedMs => {
  return {
    ms: speedMs.toFixed(1),
    knots: (speedMs * 1.94384).toFixed(1),
    kmh: (speedMs * 3.6).toFixed(1),
  };
};

/**
 * Format wind direction
 * @param {number} direction - Wind direction in degrees (0-360)
 * @returns {Object} Object with direction in degrees and cardinal
 */
export const formatWindDirection = direction => {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round(direction / 22.5) % 16;
  return {
    degrees: Math.round(direction),
    cardinal: directions[index],
    full: `${directions[index]} (${Math.round(direction)}°)`,
  };
};

/**
 * Format wave height
 * @param {number} height - Wave height in meters
 * @returns {string} Formatted string
 */
export const formatWaveHeight = height => {
  if (height === null || height === undefined) return 'N/A';
  return `${height.toFixed(1)} m`;
};

/**
 * Check if suitability should be shown
 * @param {boolean} windOverlayEnabled - Whether wind overlay is enabled
 * @param {Object} recommendation - Recommendation object for the dive site
 * @returns {boolean} Whether to show suitability indicators
 */
export const shouldShowSuitability = (windOverlayEnabled, recommendation) => {
  return windOverlayEnabled && recommendation && recommendation.suitability;
};
