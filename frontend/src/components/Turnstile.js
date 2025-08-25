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
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Default handlers to prevent errors if callbacks are not provided
  const handleVerify = useCallback(
    token => {
      setToken(token);
      setIsExpired(false);
      onVerify?.(token);
    },
    [onVerify]
  );

  const handleExpire = useCallback(() => {
    setToken(null);
    setIsExpired(true);
    onExpire?.();
  }, [onExpire]);

  const handleError = useCallback(() => {
    setToken(null);
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
      window.turnstile.reset(widgetIdRef.current);
      setToken(null);
      setIsExpired(false);
    }
  }, []);

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
