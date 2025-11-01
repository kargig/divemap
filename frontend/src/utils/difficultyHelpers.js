/**
 * Difficulty level conversion utilities
 * Works with difficulty codes (OPEN_WATER, ADVANCED_OPEN_WATER, etc.) and labels
 */

// Difficulty code to label mapping
export const DIFFICULTY_CODES = {
  OPEN_WATER: 'Open Water',
  ADVANCED_OPEN_WATER: 'Advanced Open Water',
  DEEP_NITROX: 'Deep/Nitrox',
  TECHNICAL_DIVING: 'Technical Diving',
};

// Difficulty code to order index (for sorting)
export const DIFFICULTY_ORDER = {
  OPEN_WATER: 1,
  ADVANCED_OPEN_WATER: 2,
  DEEP_NITROX: 3,
  TECHNICAL_DIVING: 4,
};

/**
 * Get human-readable label from difficulty code
 * @param {string|null} code - Difficulty code (OPEN_WATER, ADVANCED_OPEN_WATER, etc.) or null
 * @returns {string} Human-readable difficulty label or 'Unspecified'
 */
export const getDifficultyLabel = code => {
  if (!code || code === null || code === undefined) {
    return 'Unspecified';
  }

  if (typeof code === 'string' && DIFFICULTY_CODES[code]) {
    return DIFFICULTY_CODES[code];
  }

  // If it's already a label (from API response), return as is
  if (typeof code === 'string') {
    return code;
  }

  return 'Unspecified';
};

/**
 * Get difficulty code from label (backward compatibility helper)
 * Note: Prefer using difficulty_code directly from API responses
 * @param {string} label - Human-readable difficulty label
 * @returns {string|null} Difficulty code or null
 */
export const getDifficultyCodeFromLabel = label => {
  if (!label || label === 'Unspecified') {
    return null;
  }

  for (const [code, labelValue] of Object.entries(DIFFICULTY_CODES)) {
    if (labelValue.toLowerCase() === label.toLowerCase()) {
      return code;
    }
  }

  return null;
};

/**
 * Get difficulty level color classes for styling
 * @param {string|null} code - Difficulty code or null
 * @returns {string} Tailwind CSS color classes
 */
export const getDifficultyColorClasses = code => {
  if (!code || code === null || code === undefined) {
    return 'bg-gray-100 text-gray-800';
  }

  switch (code) {
    case 'OPEN_WATER':
      return 'bg-green-100 text-green-800';
    case 'ADVANCED_OPEN_WATER':
      return 'bg-yellow-100 text-yellow-800';
    case 'DEEP_NITROX':
      return 'bg-orange-100 text-orange-800';
    case 'TECHNICAL_DIVING':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Get all available difficulty levels as options for forms
 * Includes "Unspecified" option with value null
 * @returns {Array} Array of difficulty level objects with value (code) and label
 */
export const getDifficultyOptions = () => {
  const options = Object.entries(DIFFICULTY_CODES).map(([code, label]) => ({
    value: code,
    label: label,
  }));

  // Add "Unspecified" option at the beginning
  return [
    {
      value: null,
      label: 'Unspecified',
    },
    ...options,
  ];
};

/**
 * Get difficulty order index for sorting
 * @param {string|null} code - Difficulty code or null
 * @returns {number} Order index (null/unspecified returns 999 for sorting last)
 */
export const getDifficultyOrder = code => {
  if (!code || code === null || code === undefined) {
    return 999; // Sort unspecified last
  }

  return DIFFICULTY_ORDER[code] || 999;
};
