/**
 * Utility to get the full URL for a user avatar.
 * Favor the 'avatar_full_url' provided by the backend, which is already resolved.
 *
 * @param {Object} user - The user object containing avatar information
 * @returns {string} - The full URL to the avatar image
 */
export const getFullAvatarUrl = user => {
  if (!user) return null;

  // Use pre-resolved URL from backend if available
  if (user.avatar_full_url) return user.avatar_full_url;

  // Fallback for cases where full_url isn't yet populated or for legacy objects
  const path = user.avatar_url;
  if (!path) return null;
  if (path.startsWith('http')) return path;

  // If it's a relative path, it's likely from our storage
  return `/${path}`;
};

/**
 * Resolve a raw avatar path or URL string to a full URL.
 *
 * @param {string} src - The avatar path or URL string
 * @returns {string} - The resolved full URL
 */
export const resolveAvatarUrl = src => {
  if (!src) return null;
  if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/')) return src;
  return `/${src}`;
};
