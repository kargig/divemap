import PropTypes from 'prop-types';
import { useEffect, useRef, useState, useCallback } from 'react';

const Turnstile = ({
  onVerify,
  onExpire,
  onError,
  siteKey,
  theme = 'light',
  size = 'normal',
  className = '',
  disabled = false,
  enabled = true,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [_token, setToken] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Default handlers to prevent errors if callbacks are not provided
  const handleVerify = useCallback(
    token => {
      setToken(token);
      setIsExpired(false);
      setIsVerified(true);
      onVerify?.(token);

      // ✅ Hide the widget after successful verification
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    },
    [onVerify]
  );

  const handleExpire = useCallback(() => {
    setToken(null);
    setIsExpired(true);
    setIsVerified(false);
    onExpire?.();
  }, [onExpire]);

  const handleError = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    onError?.();
  }, [onError]);

  // Define renderWidget first using useCallback
  const renderWidget = useCallback(() => {
    if (!window.turnstile || !turnstileRef.current) {
      return;
    }

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }

    try {
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        theme: theme,
        size: size,
        callback: handleVerify,
        'expired-callback': handleExpire,
        'error-callback': handleError,
      });
    } catch (error) {
      console.error('Error rendering Turnstile widget:', error);
      onError?.();
    }
  }, [siteKey, theme, size, handleVerify, handleExpire, handleError, onError]);

  const reset = useCallback(() => {
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    setToken(null);
    setIsExpired(false);
    setIsVerified(false);
  }, []);

  // Expose reset method to parent components
  useEffect(() => {
    if (window.turnstile && turnstileRef.current) {
      // Store reset method on the ref so parent can access it
      turnstileRef.current.resetTurnstile = reset;
    }
  }, [reset]);

  useEffect(() => {
    // Only load Turnstile script if the component is enabled and has a site key
    // Use a global flag to prevent multiple script loads
    if (enabled && siteKey && !window.turnstile && !window.turnstileScriptLoading) {
      window.turnstileScriptLoading = true;

      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsLoaded(true);
        window.turnstileScriptLoading = false;
      };
      script.onerror = () => {
        setIsLoaded(false);
        window.turnstileScriptLoading = false;
        console.error('Failed to load Turnstile script');
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      setIsLoaded(true);
    }
  }, [enabled, siteKey]);

  useEffect(() => {
    if (isLoaded && !disabled && siteKey && window.turnstile) {
      try {
        renderWidget();
      } catch (error) {
        console.error('Error rendering Turnstile widget:', error);
        onError?.();
      }
    }
  }, [isLoaded, disabled, siteKey, renderWidget, onError]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  // Show loading state while script is loading
  if (!isLoaded) {
    return (
      <div className='turnstile-loading'>
        <div className='turnstile-loading-text'>Loading verification...</div>
      </div>
    );
  }

  // Early return if not enabled or no site key - prevents any rendering
  if (!enabled || !siteKey) {
    return null;
  }

  // Show success message when verification is complete
  if (isVerified) {
    return (
      <div className={`turnstile-container ${className}`}>
        <div className='flex items-center justify-center p-3 bg-green-50 border border-green-200 rounded-md'>
          <svg className='w-5 h-5 text-green-500 mr-2' fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
              clipRule='evenodd'
            />
          </svg>
          <span className='text-sm text-green-700 font-medium'>Verification complete</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`turnstile-container ${className}`}>
      <div ref={turnstileRef} className='turnstile-widget' />
      {isExpired && (
        <button
          type='button'
          onClick={reset}
          className='mt-2 text-sm text-blue-600 hover:text-blue-500 underline'
        >
          Refresh verification
        </button>
      )}
    </div>
  );
};

Turnstile.propTypes = {
  onVerify: PropTypes.func.isRequired,
  onExpire: PropTypes.func,
  onError: PropTypes.func,
  siteKey: PropTypes.string.isRequired,
  theme: PropTypes.oneOf(['light', 'dark']),
  size: PropTypes.oneOf(['normal', 'compact', 'invisible']),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  enabled: PropTypes.bool,
};

export default Turnstile;
