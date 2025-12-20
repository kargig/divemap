/**
 * Utility functions for formatting dates in user-friendly formats.
 * Used for displaying rate limit reset times and other date information.
 */

/**
 * Format a date string or Date object into a user-friendly format.
 * 
 * @param {string|Date} dateInput - ISO date string or Date object
 * @param {Object} options - Formatting options
 * @param {string} options.month - Month format: 'short' (default) or 'long'
 * @param {boolean} options.hour12 - Use 12-hour format (default: true)
 * @returns {string} Formatted date string, or empty string if parsing fails
 * 
 * @example
 * formatRateLimitDate('2024-12-21T14:30:00Z')
 * // Returns: "Dec 21, 2:30 PM"
 */
export const formatRateLimitDate = (dateInput, options = {}) => {
  const {
    month = 'short',
    hour12 = true
  } = options;

  if (!dateInput) {
    return '';
  }

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString('en-US', {
      month,
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12
    });
  } catch (e) {
    // Return empty string if parsing fails
    return '';
  }
};

/**
 * Format a date for display in error messages.
 * 
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {string} Formatted date string for error messages
 */
export const formatDateForError = (dateInput) => {
  return formatRateLimitDate(dateInput, {
    month: 'short',
    hour12: true
  });
};

