/**
 * Difficulty level conversion utilities
 * Converts integer difficulty levels to human-readable strings and vice versa
 */

// Difficulty level mapping (integer to string)
export const DIFFICULTY_LEVELS = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
  4: 'expert',
};

// Difficulty level mapping (string to integer)
export const DIFFICULTY_VALUES = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

/**
 * Convert integer difficulty level to human-readable string
 * @param {number} level - Integer difficulty level (1-4)
 * @returns {string} Human-readable difficulty level
 */
export const getDifficultyLabel = level => {
  if (typeof level === 'string') {
    // If it's already a string, return as is (for backward compatibility)
    return level;
  }

  if (typeof level === 'number' && DIFFICULTY_LEVELS[level]) {
    return DIFFICULTY_LEVELS[level];
  }

  // Default to intermediate if invalid value
  return 'intermediate';
};

/**
 * Convert human-readable difficulty level to integer
 * @param {string} label - Human-readable difficulty level
 * @returns {number} Integer difficulty level (1-4)
 */
export const getDifficultyValue = label => {
  if (typeof label === 'number') {
    // If it's already a number, return as is (for backward compatibility)
    return label;
  }

  if (typeof label === 'string' && DIFFICULTY_VALUES[label.toLowerCase()]) {
    return DIFFICULTY_VALUES[label.toLowerCase()];
  }

  // Default to intermediate (2) if invalid value
  return 2;
};

/**
 * Get difficulty level color classes for styling
 * @param {number|string} level - Difficulty level (integer or string)
 * @returns {string} Tailwind CSS color classes
 */
export const getDifficultyColorClasses = level => {
  const label = getDifficultyLabel(level);

  switch (label) {
    case 'beginner':
      return 'bg-green-100 text-green-800';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800';
    case 'advanced':
      return 'bg-orange-100 text-orange-800';
    case 'expert':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Get all available difficulty levels as options for forms
 * @returns {Array} Array of difficulty level objects with value and label
 */
export const getDifficultyOptions = () => {
  return Object.entries(DIFFICULTY_LEVELS).map(([value, label]) => ({
    value: parseInt(value),
    label: label.charAt(0).toUpperCase() + label.slice(1), // Capitalize first letter
  }));
};
