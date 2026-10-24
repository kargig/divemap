import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAnalyticsCookies, getConsentStatus, initConsentMode, setConsent } from './consent';

describe('Cookie Consent Utility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    delete window.gtag;
    delete window.dataLayer;
  });

  describe('getConsentStatus', () => {
    it('returns default unresponded state when localStorage is empty', () => {
      const status = getConsentStatus();
      expect(status).toEqual({
        hasResponded: false,
        analytics: false,
        preferences: false,
        necessary: true,
      });
    });

    it('returns stored consent state when valid data is in localStorage', () => {
      localStorage.setItem(
        'divemap_cookie_consent',
        JSON.stringify({ analytics: true, timestamp: Date.now() })
      );
      const status = getConsentStatus();
      expect(status).toEqual({
        hasResponded: true,
        analytics: true,
        preferences: false,
        necessary: true,
      });
    });

    it('handles corrupted JSON in localStorage gracefully', () => {
      localStorage.setItem('divemap_cookie_consent', 'invalid-json{');
      const status = getConsentStatus();
      expect(status).toEqual({
        hasResponded: false,
        analytics: false,
        preferences: false,
        necessary: true,
      });
    });
  });

  describe('setConsent', () => {
    it('stores user preferences and updates gtag consent when accepted', () => {
      window.dataLayer = [];
      window.gtag = vi.fn();

      setConsent({ analytics: true });

      const stored = JSON.parse(localStorage.getItem('divemap_cookie_consent'));
      expect(stored.analytics).toBe(true);
      expect(stored.timestamp).toBeDefined();

      expect(window.gtag).toHaveBeenCalledWith('consent', 'update', {
        analytics_storage: 'granted',
      });
    });

    it('denies gtag consent and dispatches custom event when rejected', () => {
      window.dataLayer = [];
      window.gtag = vi.fn();
      const eventSpy = vi.fn();
      window.addEventListener('divemap-consent-updated', eventSpy);

      setConsent({ analytics: false });

      const stored = JSON.parse(localStorage.getItem('divemap_cookie_consent'));
      expect(stored.analytics).toBe(false);

      expect(window.gtag).toHaveBeenCalledWith('consent', 'update', {
        analytics_storage: 'denied',
      });
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('clearAnalyticsCookies', () => {
    it('removes _ga cookies', () => {
      document.cookie = '_ga=GA1.1.12345; path=/';
      document.cookie = '_ga_TEST=GS1.1.12345; path=/';
      document.cookie = 'other_cookie=value; path=/';

      clearAnalyticsCookies();

      expect(document.cookie).not.toContain('_ga=');
      expect(document.cookie).not.toContain('_ga_TEST=');
      expect(document.cookie).toContain('other_cookie=value');
    });
  });

  describe('initConsentMode', () => {
    it('configures default gtag consent as denied when user has not responded', () => {
      initConsentMode();

      expect(window.dataLayer).toBeDefined();
      expect(typeof window.gtag).toBe('function');

      const consentCalls = window.dataLayer.filter(
        args => args[0] === 'consent' && args[1] === 'default'
      );
      expect(consentCalls.length).toBe(1);
      expect(consentCalls[0][2]).toMatchObject({
        analytics_storage: 'denied',
      });
    });

    it('configures default gtag consent as granted if user previously accepted', () => {
      localStorage.setItem(
        'divemap_cookie_consent',
        JSON.stringify({ analytics: true, timestamp: Date.now() })
      );

      initConsentMode();

      const consentCalls = window.dataLayer.filter(
        args => args[0] === 'consent' && args[1] === 'default'
      );
      expect(consentCalls.length).toBe(1);
      expect(consentCalls[0][2]).toMatchObject({
        analytics_storage: 'granted',
      });
    });
  });
});
