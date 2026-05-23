import { Capacitor } from '@capacitor/core';

/**
 * Get Turnstile configuration and check if it's enabled
 * @returns {Object} Object containing isEnabled boolean and siteKey string
 */
export const getTurnstileConfig = () => {
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Disable Turnstile completely when running natively inside Capacitor (Android/iOS)
  // because WebView's CSP and User-Agent restrictions break the challenge scripts.
  const isCapacitor = Capacitor.isNativePlatform();

  const isEnabled =
    !isCapacitor &&
    Boolean(turnstileSiteKey && turnstileSiteKey.trim() && turnstileSiteKey !== 'undefined');

  return {
    isEnabled,
    siteKey: isEnabled ? turnstileSiteKey : null,
  };
};

/**
 * Check if Cloudflare Turnstile is enabled and properly configured
 * @returns {boolean} True if Turnstile is enabled, false otherwise
 */
export const isTurnstileEnabled = () => {
  return getTurnstileConfig().isEnabled;
};

/**
 * Get the Turnstile site key from environment variables
 * @returns {string|null} The site key if available, null otherwise
 */
export const getTurnstileSiteKey = () => {
  return getTurnstileConfig().siteKey;
};
