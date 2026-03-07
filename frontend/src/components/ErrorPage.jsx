import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * ErrorPage Component
 *
 * Provides a user-friendly error page with appropriate actions
 * for different types of errors (502, 500, network, etc.)
 */
const ErrorPage = ({
  error,
  title = 'Something went wrong',
  message = 'We encountered an unexpected error',
  showRetry = true,
  showHome = true,
  showBack = true,
  onRetry = () => window.location.reload(),
  onBack = () => window.history.back(),
  className = '',
  autoRetryDelay = 7000, // 7 seconds default
}) => {
  const [countdown, setCountdown] = useState(Math.ceil(autoRetryDelay / 1000));
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-retry countdown effect
  useEffect(() => {
    if (countdown <= 0) {
      setIsRetrying(true);
      onRetry();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onRetry]);

  // Reset countdown if component unmounts or error changes
  useEffect(() => {
    setCountdown(Math.ceil(autoRetryDelay / 1000));
    setIsRetrying(false);
  }, [error, autoRetryDelay]);
  const getErrorIcon = () => {
    if (error?.response?.status === 502) {
      return <AlertTriangle className='w-16 h-16 text-orange-500' />;
    }
    if (error?.response?.status >= 500) {
      return <AlertTriangle className='w-16 h-16 text-red-500' />;
    }
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
      return <AlertTriangle className='w-16 h-16 text-yellow-500' />;
    }
    return <AlertTriangle className='w-16 h-16 text-gray-500' />;
  };

  const getErrorTitle = () => {
    if (error?.response?.status === 502) {
      return 'Service Temporarily Unavailable';
    }
    if (error?.response?.status >= 500) {
      return 'Server Error';
    }
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
      return 'Connection Problem';
    }
    return title;
  };

  const getErrorMessage = () => {
    if (error?.response?.status === 502) {
      return 'Our servers are temporarily unavailable. Please try again in a few moments.';
    }
    if (error?.response?.status >= 500) {
      return "We're experiencing technical difficulties. Our team has been notified.";
    }
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
      return 'Please check your internet connection and try again.';
    }
    return message;
  };

  const getErrorDetails = () => {
    if (error?.response?.status === 502) {
      return 'Error 502: Bad Gateway - The server is temporarily unavailable';
    }
    if (error?.response?.status >= 500) {
      return `Error ${error.response.status}: Server Error`;
    }
    if (error?.message) {
      return error.message;
    }
    return null;
  };

  return (
    <div className={`min-h-[400px] flex items-center justify-center py-12 ${className}`}>
      <div className='max-w-md mx-auto text-center px-4'>
        <div className='mb-6'>{getErrorIcon()}</div>

        <h1 className='text-2xl font-bold text-gray-900 mb-2'>{getErrorTitle()}</h1>

        <p className='text-gray-600 mb-6'>{getErrorMessage()}</p>

        {getErrorDetails() && (
          <div className='bg-gray-50 rounded-lg p-3 mb-6'>
            <p className='text-sm text-gray-500 font-mono'>{getErrorDetails()}</p>
          </div>
        )}

        <div className='flex flex-col sm:flex-row gap-3 justify-center'>
          {showRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isRetrying
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : `Try Again${countdown > 0 ? ` (${countdown}s)` : ''}`}
            </button>
          )}

          {showBack && (
            <button
              onClick={onBack}
              disabled={isRetrying}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isRetrying
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ArrowLeft className='w-4 h-4' />
              Go Back
            </button>
          )}

          {showHome && (
            <Link
              to='/'
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isRetrying
                  ? 'bg-gray-400 text-gray-200 pointer-events-none'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Home className='w-4 h-4' />
              Go Home
            </Link>
          )}
        </div>

        {/* Auto-retry countdown message */}
        {countdown > 0 && !isRetrying && (
          <div className='mt-4 text-center'>
            <p className='text-sm text-gray-500'>
              Automatically retrying in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

ErrorPage.propTypes = {
  error: PropTypes.object,
  title: PropTypes.string,
  message: PropTypes.string,
  showRetry: PropTypes.bool,
  showHome: PropTypes.bool,
  showBack: PropTypes.bool,
  onRetry: PropTypes.func,
  onBack: PropTypes.func,
  className: PropTypes.string,
  autoRetryDelay: PropTypes.number,
};

export default ErrorPage;
