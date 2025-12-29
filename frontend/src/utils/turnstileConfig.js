/**
 * Get Turnstile configuration and check if it's enabled
 * @returns {Object} Object containing isEnabled boolean and siteKey string
 */
export const getTurnstileConfig = () => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const isEnabled = Boolean(siteKey && siteKey.trim() && siteKey !== 'undefined');

  return {
    isEnabled,
    siteKey: isEnabled ? siteKey : null,
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
