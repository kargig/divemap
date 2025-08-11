import { toast } from 'react-hot-toast';

/**
 * Handle rate limiting errors consistently across the application
 * @param {Error} error - The error object from API calls
 * @param {string} context - Context for the error (e.g., "dive trips", "diving centers")
 * @param {Function} onRetry - Optional callback function to execute when retrying
 */
export const handleRateLimitError = (error, context = 'data', onRetry = null) => {
  if (error?.isRateLimited) {
    const retryAfter = error.retryAfter || 30;

    // Show toast notification
    toast.error(
      `Rate limiting in effect for ${context}. Please wait ${retryAfter} seconds before trying again.`,
      {
        duration: 5000,
        position: 'top-center',
        id: `rate-limit-${context}`, // Prevent duplicate toasts
      }
    );

    // Return error info for component handling
    return {
      isRateLimited: true,
      retryAfter,
      onRetry,
      context,
    };
  }

  // Return null if not a rate limiting error
  return null;
};

/**
 * Check if an error is a rate limiting error
 * @param {Error} error - The error object to check
 * @returns {boolean} - True if the error is a rate limiting error
 */
export const isRateLimitError = error => {
  return error?.isRateLimited === true;
};

/**
 * Get the retry after time from a rate limiting error
 * @param {Error} error - The error object to extract retry time from
 * @returns {number} - The retry after time in seconds, defaults to 30
 */
export const getRetryAfterTime = error => {
  return error?.retryAfter || 30;
};
