/**
 * YouTube URL helper functions for extracting video IDs and generating embed URLs
 */

/**
 * Extract YouTube video ID from various YouTube URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null if not a valid YouTube URL
 */
export const extractYouTubeVideoId = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Regular YouTube URLs: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (watchMatch) {
    return watchMatch[1];
  }

  // Embed URLs: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([^&\n?#]+)/);
  if (embedMatch) {
    return embedMatch[1];
  }

  // Short URLs: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^&\n?#]+)/);
  if (shortMatch) {
    return shortMatch[1];
  }

  return null;
};

/**
 * Generate YouTube embed URL from video ID
 * @param {string} videoId - YouTube video ID
 * @returns {string} - YouTube embed URL
 */
export const getYouTubeEmbedUrl = (videoId) => {
  if (!videoId) {
    return null;
  }
  return `https://www.youtube.com/embed/${videoId}`;
};

/**
 * Generate YouTube thumbnail URL from video ID
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality: 'default', 'medium', 'high', 'standard', 'maxres'
 * @returns {string} - YouTube thumbnail URL
 */
export const getYouTubeThumbnailUrl = (videoId, quality = 'maxres') => {
  if (!videoId) {
    return null;
  }
  return `https://img.youtube.com/vi/${videoId}/${quality}default.jpg`;
};

/**
 * Check if URL is a valid YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if valid YouTube URL
 */
export const isYouTubeUrl = (url) => {
  return extractYouTubeVideoId(url) !== null;
};

/**
 * Generate YouTube watch URL from video ID
 * @param {string} videoId - YouTube video ID
 * @returns {string} - YouTube watch URL
 */
export const getYouTubeWatchUrl = (videoId) => {
  if (!videoId) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
};
