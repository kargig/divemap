/**
 * API Error Handling Utilities
 * Provides functions to extract human-readable error messages from FastAPI/Axios error responses.
 */

/**
 * Extract field name from Pydantic error location
 * @param {Array} loc - Pydantic loc array (e.g., ["body", "username"])
 * @returns {string|null} Human-readable field name
 */
const getFieldNameFromLoc = loc => {
  if (!Array.isArray(loc) || loc.length === 0) return null;
  // Pydantic validation errors have loc like ["body", "field_name"]
  // or ["query", "field_name"] etc. We want the last element which is the field name
  const fieldName = loc[loc.length - 1];
  // Convert snake_case to human-readable format
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Utility function to extract all field errors from Pydantic validation errors
 * @param {Object} error - Axios error object
 * @returns {Object} Map of field name to error message and display name
 */
export const extractFieldErrors = error => {
  const fieldErrors = {};
  if (error.response?.data?.detail) {
    if (Array.isArray(error.response.data.detail)) {
      error.response.data.detail.forEach(err => {
        if (err.loc && Array.isArray(err.loc)) {
          const fieldName = err.loc[err.loc.length - 1];
          const fieldDisplayName = getFieldNameFromLoc(err.loc);
          fieldErrors[fieldName] = {
            message: err.msg || 'Validation error',
            displayName: fieldDisplayName || fieldName,
          };
        }
      });
    }
  }
  return fieldErrors;
};

/**
 * Helper to extract error message from FastAPI detail
 * @param {Array|string|Object} detail - FastAPI detail field
 * @returns {string|null}
 */
const extractDetailMessage = detail => {
  // Handle Pydantic validation errors (array of error objects)
  if (Array.isArray(detail)) {
    // Extract the first validation error message with field name
    const firstError = detail[0];
    if (firstError && typeof firstError === 'object') {
      if (firstError.loc && Array.isArray(firstError.loc)) {
        const fieldDisplayName = getFieldNameFromLoc(firstError.loc);
        const errorMsg = firstError.msg || 'Validation error';
        return `${fieldDisplayName}: ${errorMsg}`;
      }
      return firstError.msg || 'Validation error';
    }
    return 'Validation error';
  }
  // Handle simple string error messages
  if (typeof detail === 'string') {
    return detail;
  }
  // If detail is an object (not array, not string), try to extract message
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return null;
};

/**
 * Helper to extract message from general response data
 * @param {Object|string} data - Response data object
 * @param {string} defaultMessage
 * @returns {string|null}
 */
const extractDataMessage = (data, defaultMessage) => {
  if (typeof data === 'string') return data;
  if (data.detail) {
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      if (first?.msg) return first.msg;
      try {
        return JSON.stringify(data.detail);
      } catch {
        return defaultMessage;
      }
    }
    try {
      return JSON.stringify(data.detail);
    } catch {
      return defaultMessage;
    }
  }
  if (data.msg) return data.msg;
  if (data.message) return data.message;
  return null;
};

/**
 * Utility function to extract error message from API responses
 * Supports FastAPI/axios error payloads, Pydantic validation errors, and various error formats
 * @param {Object|string} error - Axios error or string
 * @param {string} [defaultMessage='An error occurred']
 * @returns {string} Human-readable error message
 */
export const extractErrorMessage = (error, defaultMessage = 'An error occurred') => {
  // Handle null/undefined
  if (!error) return defaultMessage;

  // Handle string errors directly
  if (typeof error === 'string') return error;

  // Handle error.response.data.detail (FastAPI standard)
  if (error.response?.data?.detail) {
    const detailMsg = extractDetailMessage(error.response.data.detail);
    if (detailMsg) return detailMsg;
  }

  // Handle error.response.data (alternative location)
  if (error.response?.data) {
    const dataMsg = extractDataMessage(error.response.data, defaultMessage);
    if (dataMsg) return dataMsg;
  }

  // Handle error.detail (direct property)
  if (error.detail) {
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail) && error.detail.length > 0) {
      const first = error.detail[0];
      if (first?.msg) return first.msg;
    }
  }

  // Fallback to error.message or generic error
  if (error.message) {
    return error.message;
  }

  return defaultMessage;
};
