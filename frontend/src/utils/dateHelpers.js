/**
 * Date formatting utilities
 */

/**
 * Format a date string to a readable format
 * @param {string|Date} dateString - The date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return 'Date TBD';

  const { year = 'numeric', month = 'long', day = 'numeric', locale = 'en-US' } = options;

  return new Date(dateString).toLocaleDateString(locale, {
    year,
    month,
    day,
  });
};

/**
 * Format a date string to a short format (MM/DD/YYYY)
 * @param {string|Date} dateString - The date to format
 * @returns {string} Short formatted date string
 */
export const formatDateShort = dateString => {
  if (!dateString) return 'Date TBD';

  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * Format a date string to a relative format (e.g., "2 days ago")
 * @param {string|Date} dateString - The date to format (should be UTC ISO string)
 * @returns {string} Relative date string
 */
export const formatDateRelative = dateString => {
  if (!dateString) return 'Date TBD';

  // JavaScript Date automatically handles UTC ISO strings and converts to browser timezone
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffInDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
};

/**
 * Format a date string to a relative time format (e.g., "2h ago", "5m ago", "Just now")
 * Handles UTC timestamps and displays in browser's local timezone
 * @param {string|Date} dateString - The date to format (should be UTC ISO string)
 * @returns {string} Relative time string
 */
export const formatTimeAgo = dateString => {
  if (!dateString) return 'Unknown';

  // JavaScript Date automatically parses UTC ISO strings and converts to browser timezone
  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.error('Invalid date string:', dateString);
    return 'Invalid date';
  }

  // Get current time and calculate difference in milliseconds
  // Both dates are converted to milliseconds since epoch, which is timezone-independent
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle edge case: if date is in the future (shouldn't happen)
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // For longer periods, show localized date
  return date.toLocaleDateString();
};

/**
 * Format a time string to a readable format
 * @param {string} timeString - The time to format (HH:MM:SS or HH:MM)
 * @returns {string} Formatted time string
 */
export const formatTime = timeString => {
  if (!timeString) return '';

  // Handle both HH:MM:SS and HH:MM formats
  const time = timeString.includes(':') ? timeString : `${timeString}:00`;
  const [hours, minutes] = time.split(':');

  return new Date(`2000-01-01T${hours}:${minutes}`).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
