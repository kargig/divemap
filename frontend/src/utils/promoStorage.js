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

  // Absolute target thresholds sequence: 3 -> 7 -> 12 -> 18 -> 25
  const TARGETS = [3, 7, 12, 18, 25];

  let target = 9999999;

  if (dismissals < 5) {
    // Find the very next absolute threshold in our sequence that is strictly in the future.
    // This handles both perfect path dismissals and late dismissals gracefully.
    const nextAbsoluteTarget = TARGETS.find(t => t > cumulative);

    // Fall back to current cumulative + 5 if they have scrolled past all spec targets
    target = nextAbsoluteTarget || cumulative + 5;
  }

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
