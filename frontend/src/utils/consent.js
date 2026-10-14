import { clearBookingPreferencesCookie } from './bookingCookies';

export const CONSENT_STORAGE_KEY = 'divemap_cookie_consent';
export const CONSENT_UPDATED_EVENT = 'divemap-consent-updated';

/**
 * Retrieve current cookie consent status from localStorage.
 * @returns {{ hasResponded: boolean, analytics: boolean, preferences: boolean, necessary: true }}
 */
export function getConsentStatus() {
  if (typeof window === 'undefined') {
    return { hasResponded: false, analytics: false, preferences: false, necessary: true };
  }

  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      return { hasResponded: false, analytics: false, preferences: false, necessary: true };
    }
    const parsed = JSON.parse(raw);
    return {
      hasResponded: true,
      analytics: Boolean(parsed.analytics),
      preferences: Boolean(parsed.preferences),
      necessary: true,
    };
  } catch (_e) {
    return { hasResponded: false, analytics: false, preferences: false, necessary: true };
  }
}

/**
 * Update Google Tag Manager / Google Analytics consent mode settings.
 * @param {boolean} granted
 */
export function updateGtagConsent(granted) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
    });
  }
}

/**
 * Clear analytics cookies (_ga and _ga_*) from document.cookie across path and subdomains.
 */
export function clearAnalyticsCookies() {
  if (typeof document === 'undefined') return;

  const cookies = document.cookie.split(';');
  const hostname = window.location.hostname;
  const domainParts = hostname.split('.');

  // Build domain options to try removing cookies (e.g. .divemap.blue, divemap.blue, localhost)
  const domainsToTry = [
    '',
    hostname,
    `.${hostname}`,
    domainParts.length > 1 ? `.${domainParts.slice(-2).join('.')}` : '',
  ].filter(Boolean);

  for (const c of cookies) {
    const name = c.split('=')[0].trim();
    if (name.startsWith('_ga') || name === '_gid' || name === '_gat') {
      // Remove without domain
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
      // Remove with explicit domains
      for (const d of domainsToTry) {
        document.cookie = `${name}=; path=/; domain=${d}; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
      }
    }
  }
}

/**
 * Save user cookie preferences, update Google Consent Mode, and broadcast event.
 * @param {{ analytics?: boolean, preferences?: boolean }} options
 */
export function setConsent({ analytics, preferences }) {
  const isAnalyticsGranted = Boolean(analytics);
  const isPreferencesGranted = Boolean(preferences);

  if (typeof window !== 'undefined') {
    const payload = {
      analytics: isAnalyticsGranted,
      preferences: isPreferencesGranted,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch (_e) {
      // Ignore quota/private browsing errors
    }

    updateGtagConsent(isAnalyticsGranted);

    if (!isAnalyticsGranted) {
      clearAnalyticsCookies();
    }
    if (!isPreferencesGranted) {
      clearBookingPreferencesCookie();
    }

    window.dispatchEvent(
      new window.CustomEvent(CONSENT_UPDATED_EVENT, {
        detail: {
          hasResponded: true,
          analytics: isAnalyticsGranted,
          preferences: isPreferencesGranted,
          necessary: true,
        },
      })
    );
  }
}

/**
 * Initialize Google Consent Mode default state (denied until explicit consent).
 */
export function initConsentMode() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  const current = getConsentStatus();
  const analyticsGranted = current.hasResponded && current.analytics;

  window.gtag('consent', 'default', {
    analytics_storage: analyticsGranted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}
