/**
 * Video URL helper functions for extracting video IDs and generating embed URLs
 * Supports YouTube and Vimeo with secure URL parsing.
 */

/**
 * Extract YouTube video ID from various YouTube URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null if not a valid YouTube URL
 */
export const extractYouTubeVideoId = url => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    // If it fails, try prepending https:// for cases like 'youtube.com/watch?v=...'
    try {
      urlObj = new URL(`https://${url}`);
    } catch (e2) {
      return null;
    }
  }

  const host = urlObj.hostname.replace(/^www\./, '');
  let videoId = null;

  if (host === 'youtu.be') {
    videoId = urlObj.pathname.substring(1);
  } else if (host === 'youtube.com') {
    if (urlObj.pathname === '/watch') {
      videoId = urlObj.searchParams.get('v');
    } else if (urlObj.pathname.startsWith('/embed/')) {
      videoId = urlObj.pathname.split('/')[2];
    } else if (urlObj.pathname.startsWith('/v/')) {
      videoId = urlObj.pathname.split('/')[2];
    }
  }

  // Sanitize videoId to prevent XSS (YouTube IDs are usually 11 chars, alphanumeric, plus - and _)
  if (videoId && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
    return videoId;
  }

  return null;
};

/**
 * Generate YouTube embed URL from video ID
 * @param {string} videoId - YouTube video ID
 * @param {Object} options - Embed options (e.g., autoplay)
 * @returns {string} - YouTube embed URL
 */
export const getYouTubeEmbedUrl = (videoId, options = {}) => {
  if (!videoId) {
    return null;
  }
  const url = `https://www.youtube.com/embed/${videoId}`;
  const params = new URLSearchParams();

  if (options.autoplay) {
    params.set('autoplay', '1');
    // For autoplay to work in many browsers, you also need to mute it
    params.set('mute', '1');
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
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
export const isYouTubeUrl = url => {
  if (!url || typeof url !== 'string') return false;

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    try {
      urlObj = new URL(`https://${url}`);
    } catch (e2) {
      return false;
    }
  }

  const host = urlObj.hostname.replace(/^www\./, '');
  return host === 'youtube.com' || host === 'youtu.be';
};

/**
 * Check if URL is a valid Vimeo URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if valid Vimeo URL
 */
export const isVimeoUrl = url => {
  if (!url || typeof url !== 'string') return false;

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    try {
      urlObj = new URL(`https://${url}`);
    } catch (e2) {
      return false;
    }
  }

  const host = urlObj.hostname.replace(/^www\./, '');
  return host === 'vimeo.com' || host === 'player.vimeo.com';
};

/**
 * Generate YouTube watch URL from video ID
 * @param {string} videoId - YouTube video ID
 * @returns {string} - YouTube watch URL
 */
export const getYouTubeWatchUrl = videoId => {
  if (!videoId) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
};
