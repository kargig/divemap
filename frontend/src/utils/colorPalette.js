/**
 * Colorblind-Safe Color Palette for Divemap Frontend
 *
 * This module provides a centralized color palette based on the Okabe-Ito
 * colorblind-safe palette, specifically designed for data visualization
 * and tested for accessibility across all types of color vision deficiencies.
 *
 * @see https://jfly.uni-koeln.de/color/ - Original Okabe-Ito research
 * @see frontend/.cursor/rules/colorblind-safe-colors.md - Full documentation
 */

/**
 * Chart-specific colors for data visualization
 * These colors are optimized for charts, graphs, and data overlays
 */
export const CHART_COLORS = {
  /** Main depth line - Okabe-Ito Blue */
  depth: '#0072B2',

  /** Average depth line - Okabe-Ito Orange */
  averageDepth: '#E69F00',

  /** Temperature data - Okabe-Ito Bluish Green */
  temperature: '#009E73',

  /** NDL zones and warnings - Okabe-Ito Vermillion */
  ndl: '#D55E00',

  /** CNS oxygen toxicity - Okabe-Ito Reddish Purple */
  cns: '#CC79A7',

  /** General events and markers - Okabe-Ito Yellow */
  events: '#F0E442',

  /** Gas change events - Okabe-Ito Sky Blue */
  gasChangeEvents: '#56B4E9',

  /** Grid lines and borders - Light Gray */
  grid: '#E5E7EB',

  /** Text labels and captions - Dark Gray */
  text: '#374151',
};

/**
 * UI component colors for buttons, alerts, and interface elements
 * These colors follow semantic meaning and accessibility guidelines
 */
export const UI_COLORS = {
  /** Primary actions and main elements - Okabe-Ito Blue */
  primary: '#0072B2',

  /** Secondary actions and highlights - Okabe-Ito Orange */
  secondary: '#E69F00',

  /** Success states and positive feedback - Okabe-Ito Bluish Green */
  success: '#009E73',

  /** Warning states and alerts - Okabe-Ito Vermillion */
  warning: '#D55E00',

  /** Information and neutral highlights - Okabe-Ito Sky Blue */
  info: '#56B4E9',

  /** Special highlights and attention - Okabe-Ito Yellow */
  highlight: '#F0E442',

  /** Neutral text and labels - Dark Gray */
  neutral: '#374151',

  /** Light backgrounds and borders - Light Gray */
  light: '#E5E7EB',
};

/**
 * Human-readable color names for documentation and debugging
 */
export const COLOR_NAMES = {
  '#0072B2': 'Okabe-Ito Blue',
  '#E69F00': 'Okabe-Ito Orange',
  '#009E73': 'Okabe-Ito Bluish Green',
  '#D55E00': 'Okabe-Ito Vermillion',
  '#CC79A7': 'Okabe-Ito Reddish Purple',
  '#F0E442': 'Okabe-Ito Yellow',
  '#56B4E9': 'Okabe-Ito Sky Blue',
  '#E5E7EB': 'Light Gray',
  '#374151': 'Dark Gray',
};

/**
 * Color accessibility information
 * Provides contrast ratios and accessibility notes for each color
 */
export const COLOR_ACCESSIBILITY = {
  '#0072B2': {
    name: 'Okabe-Ito Blue',
    contrast: 'High',
    colorblindSafe: true,
    notes: 'Primary color, high contrast, distinguishable by all colorblind types',
  },
  '#E69F00': {
    name: 'Okabe-Ito Orange',
    contrast: 'High',
    colorblindSafe: true,
    notes: 'Secondary color, high visibility, distinct from blue',
  },
  '#009E73': {
    name: 'Okabe-Ito Bluish Green',
    contrast: 'High',
    colorblindSafe: true,
    notes: 'Environmental data, distinct from blue, avoids red-green issues',
  },
  '#D55E00': {
    name: 'Okabe-Ito Vermillion',
    contrast: 'High',
    colorblindSafe: true,
    notes: 'Warning color, warm tone, high visibility',
  },
  '#CC79A7': {
    name: 'Okabe-Ito Reddish Purple',
    contrast: 'Medium',
    colorblindSafe: true,
    notes: 'Specialized data, distinct purple, not problematic blue-purple',
  },
  '#F0E442': {
    name: 'Okabe-Ito Yellow',
    contrast: 'Medium',
    colorblindSafe: true,
    notes: 'Highlights, high visibility, use on dark backgrounds',
  },
  '#56B4E9': {
    name: 'Okabe-Ito Sky Blue',
    contrast: 'Medium',
    colorblindSafe: true,
    notes: 'Events, light blue, distinct from main depth line',
  },
  '#E5E7EB': {
    name: 'Light Gray',
    contrast: 'Low',
    colorblindSafe: true,
    notes: 'Grid lines, borders, neutral background',
  },
  '#374151': {
    name: 'Dark Gray',
    contrast: 'High',
    colorblindSafe: true,
    notes: 'Text, labels, high contrast for readability',
  },
};

/**
 * Prohibited color combinations that should never be used together
 * These combinations are problematic for colorblind users
 */
export const PROHIBITED_COMBINATIONS = [
  ['#dc2626', '#059669'], // Red + Green (affects ~8% of men, 0.5% of women)
  ['#dc2626', '#2563eb'], // Red + Blue (confusing for colorblind users)
  ['#059669', '#2563eb'], // Green + Blue (difficult to distinguish)
  ['#ef4444', '#10b981'], // Red + Green (alternative hex codes)
  ['#f59e0b', '#059669'], // Amber + Green (problematic combination)
];

/**
 * Get color name by hex code
 * @param {string} hex - Hex color code (e.g., '#0072B2')
 * @returns {string} Human-readable color name
 */
export const getColorName = hex => {
  return COLOR_NAMES[hex] || 'Unknown Color';
};

/**
 * Get accessibility information for a color
 * @param {string} hex - Hex color code (e.g., '#0072B2')
 * @returns {Object} Accessibility information object
 */
export const getColorAccessibility = hex => {
  return (
    COLOR_ACCESSIBILITY[hex] || {
      name: 'Unknown Color',
      contrast: 'Unknown',
      colorblindSafe: false,
      notes: 'Color not in approved palette',
    }
  );
};

/**
 * Check if a color combination is prohibited
 * @param {string} color1 - First hex color code
 * @param {string} color2 - Second hex color code
 * @returns {boolean} True if combination is prohibited
 */
export const isProhibitedCombination = (color1, color2) => {
  return PROHIBITED_COMBINATIONS.some(
    combination =>
      (combination[0] === color1 && combination[1] === color2) ||
      (combination[0] === color2 && combination[1] === color1)
  );
};

/**
 * Validate that a color is in the approved palette
 * @param {string} hex - Hex color code to validate
 * @returns {boolean} True if color is approved
 */
export const isValidColor = hex => {
  return Object.keys(COLOR_NAMES).includes(hex);
};

/**
 * Get all approved colors as an array
 * @returns {Array<string>} Array of approved hex color codes
 */
export const getAllColors = () => {
  return Object.keys(COLOR_NAMES);
};

/**
 * Get colors by category
 * @param {string} category - 'chart' or 'ui'
 * @returns {Object} Color object for the specified category
 */
export const getColorsByCategory = category => {
  switch (category.toLowerCase()) {
    case 'chart':
      return CHART_COLORS;
    case 'ui':
      return UI_COLORS;
    default:
      throw new Error('Invalid category. Use "chart" or "ui".');
  }
};

export default {
  CHART_COLORS,
  UI_COLORS,
  COLOR_NAMES,
  COLOR_ACCESSIBILITY,
  PROHIBITED_COMBINATIONS,
  getColorName,
  getColorAccessibility,
  isProhibitedCombination,
  isValidColor,
  getAllColors,
  getColorsByCategory,
};
