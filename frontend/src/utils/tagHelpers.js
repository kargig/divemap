/**
 * Tag Color Utility Functions
 *
 * Provides consistent tag color mapping across the application
 * using colorblind-safe Okabe-Ito palette for accessibility.
 */

/**
 * Get color classes for a tag based on its name
 * @param {string} tagName - The name of the tag
 * @returns {string} CSS classes with colorblind-safe colors
 */
export const getTagColor = tagName => {
  // Colorblind-safe color mapping using Okabe-Ito palette
  const colorMap = {
    // Difficulty levels - sequential progression
    beginner: 'tag-color-okabe-green',
    intermediate: 'tag-color-okabe-yellow',
    advanced: 'tag-color-okabe-orange',
    expert: 'tag-color-okabe-vermillion',

    // Depth categories
    deep: 'tag-color-okabe-blue',
    shallow: 'tag-color-okabe-sky',

    // Site types
    wreck: 'tag-color-okabe-purple',
    reef: 'tag-color-okabe-green',
    cave: 'tag-color-okabe-purple',
    wall: 'tag-color-okabe-sky',

    // Dive conditions
    drift: 'tag-color-okabe-sky',
    night: 'tag-color-okabe-purple',
    photography: 'tag-color-okabe-yellow',
    marine: 'tag-color-okabe-green',

    // Training and technical
    training: 'tag-color-okabe-orange',
    tech: 'tag-color-okabe-vermillion',

    // Access methods
    boat: 'tag-color-okabe-blue',
    shore: 'tag-color-okabe-green',
  };

  // Try exact match first
  const lowerTagName = tagName.toLowerCase();
  if (colorMap[lowerTagName]) {
    return colorMap[lowerTagName];
  }

  // Try partial matches
  for (const [key, color] of Object.entries(colorMap)) {
    if (lowerTagName.includes(key) || key.includes(lowerTagName)) {
      return color;
    }
  }

  // Default colorblind-safe colors for unknown tags
  const colors = [
    'tag-color-okabe-blue',
    'tag-color-okabe-orange',
    'tag-color-okabe-green',
    'tag-color-okabe-vermillion',
    'tag-color-okabe-purple',
    'tag-color-okabe-yellow',
    'tag-color-okabe-sky',
  ];

  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = (hash << 5) - hash + tagName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return colors[Math.abs(hash) % colors.length];
};
