const SESSION_KEY = 'divemap_session_page_views';
const CUMULATIVE_KEY = 'divemap_lifetime_page_views';
const DISMISSAL_COUNT_KEY = 'divemap_promo_dismissals';
const NEXT_ELIGIBLE_VIEW_KEY = 'divemap_next_eligible_view';

export const incrementSessionPageViews = () => {
  const current = parseInt(window.sessionStorage.getItem(SESSION_KEY), 10) || 0;
  const updated = current + 1;
  window.sessionStorage.setItem(SESSION_KEY, updated.toString());
  return updated;
};

export const incrementCumulativePageViews = () => {
  const current = parseInt(window.localStorage.getItem(CUMULATIVE_KEY), 10) || 0;
  const updated = current + 1;
  window.localStorage.setItem(CUMULATIVE_KEY, updated.toString());
  return updated;
};

export const dismissPromo = () => {
  const dismissals = (parseInt(window.localStorage.getItem(DISMISSAL_COUNT_KEY), 10) || 0) + 1;
  window.localStorage.setItem(DISMISSAL_COUNT_KEY, dismissals.toString());

  const cumulative = parseInt(window.localStorage.getItem(CUMULATIVE_KEY), 10) || 0;
  let target = 9999999;

  // Progressive targets: 3 -> 7 -> 12 -> 18 -> 25 -> Permanent Suppression
  if (dismissals === 1) target = Math.max(7, cumulative + 4);
  else if (dismissals === 2) target = Math.max(12, cumulative + 5);
  else if (dismissals === 3) target = Math.max(18, cumulative + 6);
  else if (dismissals === 4) target = Math.max(25, cumulative + 7);
  else target = 9999999; // Permanent suppression (dismissed 5+ times)

  window.localStorage.setItem(NEXT_ELIGIBLE_VIEW_KEY, target.toString());
};

export const getPromoEligibility = () => {
  const sessionCount = parseInt(window.sessionStorage.getItem(SESSION_KEY), 10) || 0;
  const cumulativeCount = parseInt(window.localStorage.getItem(CUMULATIVE_KEY), 10) || 0;
  const dismissals = parseInt(window.localStorage.getItem(DISMISSAL_COUNT_KEY), 10) || 0;

  // Default to cumulative 3 for first appearance if no target is stored
  const storedNextEligible = parseInt(window.localStorage.getItem(NEXT_ELIGIBLE_VIEW_KEY), 10) || 0;
  const nextEligible = storedNextEligible || 3;

  const isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  if (isStandalone || dismissals >= 5) {
    return { isEligible: false, platform: 'standalone', activePlatform: 'standalone' };
  }

  const userAgentString = window.navigator.userAgent || '';
  const isAndroid = /Android/i.test(userAgentString);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgentString);
  const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'desktop';

  // Requirements: Current session views must be >= 3 AND total views must meet or exceed target
  const isEligible = sessionCount >= 3 && cumulativeCount >= nextEligible;

  return { isEligible, platform, activePlatform: platform };
};
