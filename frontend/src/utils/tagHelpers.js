/**
 * Tag Color Utility Functions
 *
 * Provides consistent tag color mapping across the application
 * to ensure visual consistency between filter tags and display tags.
 */

/**
 * Get color classes for a tag based on its name
 * @param {string} tagName - The name of the tag
 * @returns {string} Tailwind CSS color classes
 */
export const getTagColor = tagName => {
  // Create a consistent color mapping based on tag name
  const colorMap = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-orange-100 text-orange-800',
    expert: 'bg-red-100 text-red-800',
    deep: 'bg-indigo-100 text-indigo-800',
    shallow: 'bg-cyan-100 text-cyan-800',
    wreck: 'bg-purple-100 text-purple-800',
    reef: 'bg-emerald-100 text-emerald-800',
    cave: 'bg-indigo-100 text-indigo-800',
    wall: 'bg-slate-100 text-slate-800',
    drift: 'bg-teal-100 text-teal-800',
    night: 'bg-violet-100 text-violet-800',
    photography: 'bg-pink-100 text-pink-800',
    marine: 'bg-cyan-100 text-cyan-800',
    training: 'bg-amber-100 text-amber-800',
    tech: 'bg-red-100 text-red-800',
    boat: 'bg-blue-100 text-blue-800',
    shore: 'bg-green-100 text-green-800',
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

  // Default color scheme based on hash of tag name
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-cyan-100 text-cyan-800',
    'bg-teal-100 text-teal-800',
    'bg-emerald-100 text-emerald-800',
    'bg-amber-100 text-amber-800',
    'bg-violet-100 text-violet-800',
    'bg-slate-100 text-slate-800',
  ];

  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = (hash << 5) - hash + tagName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return colors[Math.abs(hash) % colors.length];
};
