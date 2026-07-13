import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  incrementSessionPageViews,
  incrementCumulativePageViews,
  getPromoEligibility,
  dismissPromo,
} from './promoStorage';

describe('promoStorage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.restoreAllMocks();

    // Default mock for matchMedia (not standalone)
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    // Reset navigator.standalone in case it was modified
    if (window.navigator) {
      Object.defineProperty(window.navigator, 'standalone', {
        value: undefined,
        configurable: true,
      });
    }
  });

  describe('incrementSessionPageViews', () => {
    it('should increment session views correctly', () => {
      expect(incrementSessionPageViews()).toBe(1);
      expect(incrementSessionPageViews()).toBe(2);
      expect(incrementSessionPageViews()).toBe(3);
    });
  });

  describe('incrementCumulativePageViews', () => {
    it('should increment cumulative views correctly', () => {
      expect(incrementCumulativePageViews()).toBe(1);
      expect(incrementCumulativePageViews()).toBe(2);
      expect(incrementCumulativePageViews()).toBe(3);
    });
  });

  describe('getPromoEligibility', () => {
    it('should not be eligible initially when session views is 0', () => {
      const eligibility = getPromoEligibility();
      expect(eligibility.isEligible).toBe(false);
    });

    it('should not be eligible if session views is less than 3', () => {
      incrementSessionPageViews();
      incrementSessionPageViews();
      expect(getPromoEligibility().isEligible).toBe(false);
    });

    it('should be eligible if session views >= 3 and cumulative >= nextEligible (default 3)', () => {
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementSessionPageViews();
      // Increments cumulative to 3 as well
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      expect(getPromoEligibility().isEligible).toBe(true);
    });

    it('should identify Android platform correctly', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Linux; Android 10; SM-G975F)'
      );
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();

      const eligibility = getPromoEligibility();
      expect(eligibility.platform).toBe('android');
      expect(eligibility.activePlatform).toBe('android');
    });

    it('should identify iOS platform correctly', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)'
      );
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();

      const eligibility = getPromoEligibility();
      expect(eligibility.platform).toBe('ios');
      expect(eligibility.activePlatform).toBe('ios');
    });

    it('should identify desktop platform as fallback', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();

      const eligibility = getPromoEligibility();
      expect(eligibility.platform).toBe('desktop');
      expect(eligibility.activePlatform).toBe('desktop');
    });

    it('should not be eligible if running in standalone display mode (matchMedia)', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query.includes('standalone'),
      }));
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();

      const eligibility = getPromoEligibility();
      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.platform).toBe('standalone');
      expect(eligibility.activePlatform).toBe('standalone');
    });

    it('should not be eligible if running in standalone mode (navigator.standalone)', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        configurable: true,
      });
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementSessionPageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();
      incrementCumulativePageViews();

      const eligibility = getPromoEligibility();
      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.platform).toBe('standalone');
      expect(eligibility.activePlatform).toBe('standalone');
    });
  });

  describe('dismissPromo', () => {
    it('should delay eligibility progressively on dismissal following sequence 3 -> 7 -> 12 -> 18 -> 25', () => {
      // 1. Get eligible initially (views >= 3)
      for (let i = 0; i < 3; i++) {
        incrementSessionPageViews();
        incrementCumulativePageViews();
      }
      expect(getPromoEligibility().isEligible).toBe(true);

      // 2. Dismiss 1st time on cumulative 3 -> next eligible target is 7.
      dismissPromo();
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment cumulative up to 6 -> still ineligible
      for (let i = 0; i < 3; i++) {
        incrementCumulativePageViews();
      }
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment cumulative to 7 -> now eligible again
      incrementCumulativePageViews();
      expect(getPromoEligibility().isEligible).toBe(true);

      // 3. Dismiss 2nd time on cumulative 7 -> next eligible target is 12.
      dismissPromo();
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment cumulative to 11 -> still ineligible
      for (let i = 0; i < 4; i++) {
        incrementCumulativePageViews();
      }
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment to 12 -> now eligible again
      incrementCumulativePageViews();
      expect(getPromoEligibility().isEligible).toBe(true);

      // 4. Dismiss 3rd time on cumulative 12 -> next eligible target is 18.
      dismissPromo();
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment to 17 -> still ineligible
      for (let i = 0; i < 5; i++) {
        incrementCumulativePageViews();
      }
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment to 18 -> now eligible again
      incrementCumulativePageViews();
      expect(getPromoEligibility().isEligible).toBe(true);

      // 5. Dismiss 4th time on cumulative 18 -> next eligible target is 25.
      dismissPromo();
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment to 24 -> still ineligible
      for (let i = 0; i < 6; i++) {
        incrementCumulativePageViews();
      }
      expect(getPromoEligibility().isEligible).toBe(false);

      // Increment to 25 -> now eligible again
      incrementCumulativePageViews();
      expect(getPromoEligibility().isEligible).toBe(true);

      // 6. Dismiss 5th time -> permanent suppression
      dismissPromo();
      expect(getPromoEligibility().isEligible).toBe(false);

      // Even with massive page views, should remain permanently ineligible
      for (let i = 0; i < 100; i++) {
        incrementCumulativePageViews();
      }
      expect(getPromoEligibility().isEligible).toBe(false);
      expect(getPromoEligibility().platform).toBe('standalone');
      expect(getPromoEligibility().activePlatform).toBe('standalone');
    });
  });
});
