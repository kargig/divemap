import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * WindDataError Component
 * Displays user-friendly error messages for wind data fetching failures
 * Shows retry button and indicates when cached data is being used
 */
const WindDataError = ({ error, onRetry, isUsingCachedData = false, onDismiss }) => {
  const getErrorMessage = () => {
    if (!error) return 'Unknown error occurred';

    // Network errors
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
      return 'Network connection failed. Please check your internet connection.';
    }

    // HTTP errors
    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        return 'Too many requests. Please wait a moment and try again.';
      }
      if (status >= 500) {
        return 'Server error. The weather service is temporarily unavailable.';
      }
      if (status === 404) {
        return 'Wind data not available for this area.';
      }
      if (error.response.data?.detail) {
        return error.response.data.detail;
      }
      return `Error ${status}: ${error.response.statusText || 'Request failed'}`;
    }

    // Generic error message
    if (error.message) {
      return error.message;
    }

    return 'Failed to load wind data. Please try again.';
  };

  return (
    <div className='absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-lg shadow-lg border border-red-200 max-w-md px-4 py-3'>
      <div className='flex items-start gap-3'>
        <div className='flex-shrink-0 mt-0.5'>
          <AlertTriangle className='w-5 h-5 text-red-600' />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1'>
              <h3 className='text-sm font-semibold text-gray-900 mb-1'>Wind Data Error</h3>
              <p className='text-xs text-gray-700 mb-2'>{getErrorMessage()}</p>
              {isUsingCachedData && (
                <p className='text-xs text-blue-600 mb-2 font-medium'>
                  ℹ️ Using cached wind data (may be outdated)
                </p>
              )}
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className='flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors'
                aria-label='Dismiss error'
              >
                <X className='w-4 h-4' />
              </button>
            )}
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className='mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors'
              aria-label='Retry loading wind data'
            >
              <RefreshCw className='w-3.5 h-3.5' />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

WindDataError.propTypes = {
  error: PropTypes.object,
  onRetry: PropTypes.func,
  isUsingCachedData: PropTypes.bool,
  onDismiss: PropTypes.func,
};

WindDataError.defaultProps = {
  error: null,
  onRetry: null,
  isUsingCachedData: false,
  onDismiss: null,
};

export default WindDataError;

