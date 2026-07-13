# Anonymous User Promos & PWA/TWA Targeting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a non-intrusive, platform-aware banner and in-feed promotional card system that nudges anonymous visitors to register or install the PWA after visiting at least 3 pages, following a progressive dismissal fallback strategy.

**Architecture:** 
A client-side layout manager (`PromoBannerManager.jsx`) listens to React Router location changes, tracks current-session views via `sessionStorage`, lifetime views via `localStorage`, and intercepts browser installation requests (`beforeinstallprompt`). Segment-tailored components render sticky bottom banners (Desktop/Android) or floating share tooltips (iOS). High-traffic feed layouts dynamically inject in-feed promo cards (`InFeedPromoCard.jsx`) inside lists for anonymous users.

**Tech Stack:** React (TypeScript/JSX), Tailwind CSS, Lucide React (Icons), Vitest (Testing), React Router DOM (v7).

## Global Constraints
- **Suppression:** Suppress all promos/cards if `user` from `useAuth()` is non-null or if `isStandalone` is true.
- **Mobile Width Gutters:** Banners/cards must stretch full-width on mobile viewports (`px-0` wrapper layout, `rounded-none sm:rounded-2xl` borders) to maximize lateral reading space without causing horizontal overflows.
- **Git Commit Rules:** NEVER execute `git add` or `git commit`. All commit steps require writing the draft message to `commit-message.txt` for manual execution by the user.

---

### Task 1: Setup Storage Tracking & Utility State Helpers

**Files:**
- Create: `frontend/src/utils/promoStorage.js`
- Test: `frontend/src/utils/promoStorage.test.js`

**Interfaces:**
- Produces: 
  - `incrementSessionPageViews()`: returns `number` (current session count)
  - `incrementCumulativePageViews()`: returns `number` (current lifetime count)
  - `getPromoEligibility()`: returns `{ isEligible: boolean, activePlatform: string }`
  - `dismissPromo()`: returns `void` (calculates progressive page offset gaps)

- [ ] **Step 1: Write the failing tests**
  Create `frontend/src/utils/promoStorage.test.js`:
  ```javascript
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { 
    incrementSessionPageViews, 
    incrementCumulativePageViews, 
    getPromoEligibility, 
    dismissPromo 
  } from './promoStorage';

  describe('promoStorage', () => {
    beforeEach(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });

    it('should increment session views', () => {
      expect(incrementSessionPageViews()).toBe(1);
      expect(incrementSessionPageViews()).toBe(2);
    });

    it('should not be eligible initially', () => {
      const eligibility = getPromoEligibility();
      expect(eligibility.isEligible).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run tests and verify they fail**
  Run: `npm run test -- src/utils/promoStorage.test.js`
  Expected: FAIL with "functions not defined" or similar import errors.

- [ ] **Step 3: Write the minimal implementation**
  Create `frontend/src/utils/promoStorage.js`:
  ```javascript
  const SESSION_KEY = 'divemap_session_page_views';
  const CUMULATIVE_KEY = 'divemap_lifetime_page_views';
  const DISMISSAL_COUNT_KEY = 'divemap_promo_dismissals';
  const NEXT_ELIGIBLE_VIEW_KEY = 'divemap_next_eligible_view';

  export const incrementSessionPageViews = () => {
    const current = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10);
    const updated = current + 1;
    sessionStorage.setItem(SESSION_KEY, updated.toString());
    return updated;
  };

  export const incrementCumulativePageViews = () => {
    const current = parseInt(localStorage.getItem(CUMULATIVE_KEY) || '0', 10);
    const updated = current + 1;
    localStorage.setItem(CUMULATIVE_KEY, updated.toString());
    return updated;
  };

  export const dismissPromo = () => {
    const dismissals = parseInt(localStorage.getItem(DISMISSAL_COUNT_KEY) || '0', 10) + 1;
    localStorage.setItem(DISMISSAL_COUNT_KEY, dismissals.toString());

    const cumulative = parseInt(localStorage.getItem(CUMULATIVE_KEY) || '0', 10);
    let offset = 0;

    if (dismissals === 1) offset = 10;
    else if (dismissals === 2) offset = 20;
    else if (dismissals === 3) offset = 30;
    else offset = 9999999; // Permanent suppression

    localStorage.setItem(NEXT_ELIGIBLE_VIEW_KEY, (cumulative + offset).toString());
  };

  export const getPromoEligibility = () => {
    const sessionCount = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10);
    const cumulativeCount = parseInt(localStorage.getItem(CUMULATIVE_KEY) || '0', 10);
    const dismissals = parseInt(localStorage.getItem(DISMISSAL_COUNT_KEY) || '0', 10);
    const nextEligible = parseInt(localStorage.getItem(NEXT_ELIGIBLE_VIEW_KEY) || '0', 10);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone || dismissals >= 4) {
      return { isEligible: false, platform: 'standalone' };
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'desktop';

    const isEligible = sessionCount >= 3 && cumulativeCount >= nextEligible;

    return { isEligible, platform };
  };
  ```

- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm run test -- src/utils/promoStorage.test.js`
  Expected: PASS

- [ ] **Step 5: Prepare Commit**
  Write the following to `/home/kargig/src/divemap/commit-message.txt`:
  ```
  feat: Add state tracking utility for anonymous user promos

  Implement client-side session and cumulative view tracking with progressive
  dismissal offsets (10, 20, 30, and permanent suppression on 4th dismissal).
  ```

---

### Task 2: Create `<PromoBannerManager />` Component & Layouts

**Files:**
- Create: `frontend/src/components/PromoBannerManager.jsx`
- Test: `frontend/src/components/PromoBannerManager.test.jsx`

**Interfaces:**
- Consumes: 
  - `useAuth()` from `contexts/AuthContext`
  - `incrementSessionPageViews`, `incrementCumulativePageViews`, `getPromoEligibility`, `dismissPromo` from `utils/promoStorage`
- Produces: 
  - `<PromoBannerManager />` (silent wrapper mounting visual banners or iOS tooltip)

- [ ] **Step 1: Write mock tests**
  Create `frontend/src/components/PromoBannerManager.test.jsx` focusing on verifying state integration and suppressing renders for logged-in users.
  ```javascript
  import { render, screen } from '@testing-library/react';
  import { describe, it, expect, vi } from 'vitest';
  import PromoBannerManager from './PromoBannerManager';
  import { AuthProvider } from '../contexts/AuthContext';
  import { BrowserRouter as Router } from 'react-router-dom';

  vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1 }, loading: false }),
  }));

  describe('PromoBannerManager', () => {
    it('suppresses render if logged in', () => {
      const { container } = render(
        <Router>
          <PromoBannerManager />
        </Router>
      );
      expect(container.firstChild).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run tests to ensure failure**
  Run: `npm run test -- src/components/PromoBannerManager.test.jsx`
  Expected: FAIL with component missing.

- [ ] **Step 3: Write Component Implementation**
  Create `frontend/src/components/PromoBannerManager.jsx`. Implement standard styling matching the Okabe-Ito brand colors (`bg-divemap-surface`, `text-divemap-trench`, `border-divemap-blue`). Include step-by-step guides inside modals for iOS and custom event handling for `beforeinstallprompt`.
  ```jsx
  import React, { useState, useEffect } from 'react';
  import { useLocation, useNavigate } from 'react-router-dom';
  import { X, Share, Plus, HelpCircle } from 'lucide-react';
  import { useAuth } from '../contexts/AuthContext';
  import { 
    incrementSessionPageViews, 
    incrementCumulativePageViews, 
    getPromoEligibility, 
    dismissPromo 
  } from '../utils/promoStorage';

  const PromoBannerManager = () => {
    const { user, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [promoState, setPromoState] = useState({ isEligible: false, platform: 'desktop' });
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showIOSModal, setShowIOSModal] = useState(false);

    // Capture install prompt for Android
    useEffect(() => {
      const handleInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    }, []);

    // Monitor navigation to increment and update eligibility
    useEffect(() => {
      if (user || loading) return;

      incrementSessionPageViews();
      incrementCumulativePageViews();
      
      const eligibility = getPromoEligibility();
      setPromoState(eligibility);
    }, [location.pathname, user, loading]);

    if (user || loading || !promoState.isEligible) return null;

    const handleDismiss = (e) => {
      e.stopPropagation();
      dismissPromo();
      setPromoState({ isEligible: false, platform: 'desktop' });
    };

    const handleAndroidInstall = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        dismissPromo();
        setPromoState({ isEligible: false, platform: 'android' });
      }
      setDeferredPrompt(null);
    };

    // Rendering segmented layouts
    if (promoState.platform === 'android') {
      return (
        <div className="fixed bottom-0 left-0 right-0 z-[999] bg-gradient-to-r from-divemap-surface to-white border-t-4 border-divemap-blue p-4 shadow-xl flex items-center justify-between sm:left-6 sm:bottom-6 sm:right-auto sm:max-w-[400px] sm:rounded-2xl sm:border">
          <div className="flex-1 min-w-0 pr-3">
            <h4 className="font-display font-bold text-gray-900 text-sm">Install Divemap App</h4>
            <p className="text-xs text-gray-600 mt-1">Get the native experience with offline support and fast load times!</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAndroidInstall} className="bg-divemap-blue hover:bg-divemap-deep text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shadow-sm">
              Install
            </button>
            <button onClick={handleDismiss} className="p-1 hover:bg-black/5 rounded-full transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (promoState.platform === 'ios') {
      return (
        <>
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-[90vw] w-[350px] z-[999] bg-divemap-blue text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-2.5 animate-bounce-gentle after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-divemap-blue">
            <div className="flex-1 min-w-0 text-xs">
              <strong>Add Divemap to iPhone:</strong> Tap Safari's Share button <Share size={12} className="inline mx-0.5" /> and select <strong>'Add to Home Screen'</strong> <Plus size={12} className="inline mx-0.5" />.
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button onClick={() => setShowIOSModal(true)} className="p-0.5 hover:bg-white/10 rounded-full">
                <HelpCircle size={14} />
              </button>
              <button onClick={handleDismiss} className="p-0.5 hover:bg-white/10 rounded-full">
                <X size={14} />
              </button>
            </div>
          </div>

          {showIOSModal && (
            <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
                <button onClick={() => setShowIOSModal(false)} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full text-gray-500">
                  <X size={18} />
                </button>
                <h3 className="font-display font-bold text-lg text-gray-900 mb-4">How to install on iOS</h3>
                <ol className="space-y-4 text-sm text-gray-600">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-divemap-blue flex items-center justify-center font-bold text-xs">1</span>
                    <div>Tap the <strong>Share</strong> button <Share size={16} className="inline text-gray-700" /> at the bottom of Safari.</div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-divemap-blue flex items-center justify-center font-bold text-xs">2</span>
                    <div>Scroll down and select <strong>"Add to Home Screen"</strong> <Plus size={16} className="inline text-gray-700" />.</div>
                  </li>
                </ol>
                <button onClick={() => setShowIOSModal(false)} className="mt-6 w-full py-2.5 bg-divemap-blue text-white rounded-xl text-sm font-medium hover:bg-divemap-deep transition-colors">
                  Got it
                </button>
              </div>
            </div>
          )}
        </>
      );
    }

    return (
      <div className="fixed bottom-0 left-0 right-0 z-[999] bg-gradient-to-r from-divemap-surface to-white border-t-4 border-divemap-blue p-4 shadow-xl flex items-center justify-between sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-[420px] sm:rounded-2xl sm:border">
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="font-display font-bold text-gray-900 text-sm">Join the Divemap Community!</h4>
          <p className="text-xs text-gray-600 mt-0.5">Register a free account to log your own dives, save favorite sites, and find buddies.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => navigate('/register')} className="bg-divemap-blue hover:bg-divemap-deep text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors shadow-sm">
            Sign Up
          </button>
          <button onClick={handleDismiss} className="p-1 hover:bg-black/5 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  };

  export default PromoBannerManager;
  ```

- [ ] **Step 4: Verify test suite passes**
  Change the `useAuth` mock inside `PromoBannerManager.test.jsx` to return `user: null`, verifying the element renders correctly when conditions match.
  Run: `npm run test -- src/components/PromoBannerManager.test.jsx`
  Expected: PASS

- [ ] **Step 5: Prepare Commit**
  Write to `/home/kargig/src/divemap/commit-message.txt`:
  ```
  feat: Implement responsive global PromoBannerManager component

  Build platform-aware bottom sticky promo bars for Desktop and Android (utilizing PWA install prompt hooks) alongside floating tooltip guidance overlays for iOS devices.
  ```

---

### Task 3: Mount `PromoBannerManager` into Router Layout

**Files:**
- Modify: `frontend/src/App.jsx:500-519`

**Interfaces:**
- Consumes: `<PromoBannerManager />`

- [ ] **Step 1: Check imports**
  Import `PromoBannerManager` directly at the top of `frontend/src/App.jsx`.

- [ ] **Step 2: Mount the component**
  Insert the `<PromoBannerManager />` component right inside the `<main>` wrapper, alongside `<EmailVerificationBanner />`.

  ```jsx
  // Add import:
  import PromoBannerManager from './components/PromoBannerManager';

  // Mount in AppContent():
  return (
    <div className='min-h-screen bg-gray-50'>
      <CapacitorBackButtonHandler />
      <PWAUpdater />
      <Navbar />
      <SessionManager />
      <main
        className={`${isAdminPath ? 'w-full max-w-none px-0' : 'container mx-auto px-4 sm:px-6 lg:px-8'} py-4 sm:py-8 pt-16`}
      >
        <EmailVerificationBanner />
        <PromoBannerManager /> {/* Injected Manager */}
        <Suspense fallback={<LoadingFallback />}>
  ```

- [ ] **Step 3: Verify the application builds and bundles successfully**
  Run: `npm run build`
  Expected: Build finishes successfully without diagnostic or Rollup errors.

- [ ] **Step 4: Prepare Commit**
  Write to `/home/kargig/src/divemap/commit-message.txt`:
  ```
  feat: Mount PromoBannerManager into core application layout

  Integrate the promotion and PWA installation manager directly into the global App layout to track page navigation triggers and render banners globally.
  ```

---

### Task 4: Add PWA & TWA Manifest Launches Disambiguation

**Files:**
- Modify: `frontend/vite.config.mjs`
- Modify: `divemap-android/twa-manifest.json`

- [ ] **Step 1: Update Vite PWA configurations**
  Open `frontend/vite.config.mjs`. Locate the `VitePWA` plugin definition. Replace `start_url: '/'` with `start_url: '/?utm_source=pwa'`.

- [ ] **Step 2: Update Android TWA configurations**
  Open `divemap-android/twa-manifest.json`. Replace `"startUrl": "/"` with `"startUrl": "/?utm_source=android-twa"`.

- [ ] **Step 3: Prepare Commit**
  Write to `/home/kargig/src/divemap/commit-message.txt`:
  ```
  config: Configure discrete launcher UTM tracking parameter in manifests

  Set start_url to include utm_source=pwa for the Web PWA and utm_source=android-twa for the Android TWA, supporting precise client-side platform tracking and banner suppression.
  ```

---

### Task 5: Create Native `<InFeedPromoCard />` Component

**Files:**
- Create: `frontend/src/components/ui/InFeedPromoCard.jsx`
- Test: `frontend/src/components/ui/InFeedPromoCard.test.jsx`

**Interfaces:**
- Consumes: OS/platform detections.
- Produces: `<InFeedPromoCard platform={activePlatform} />`

- [ ] **Step 1: Implement Card Component**
  Create `frontend/src/components/ui/InFeedPromoCard.jsx` styling it with full-width responsive mobile metrics (`rounded-none sm:rounded-2xl border-y sm:border` and `p-4 sm:p-6` card padding) to blend flawlessly with nearby site detail cards.
  ```jsx
  import React, { useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { Shield, Smartphone, Plus, Share, X } from 'lucide-react';

  const InFeedPromoCard = ({ platform }) => {
    const navigate = useNavigate();
    const [showIOSModal, setShowIOSModal] = useState(false);

    if (platform === 'standalone') return null;

    const renderCardContent = () => {
      if (platform === 'android') {
        return (
          <div className="flex flex-col h-full justify-between items-center text-center">
            <div className="w-12 h-12 rounded-full bg-divemap-surface text-divemap-blue flex items-center justify-center mb-3 animate-pulse">
              <Smartphone size={24} />
            </div>
            <h4 className="font-display font-bold text-gray-900 text-sm">Install Divemap App</h4>
            <p className="text-xs text-gray-500 mt-1.5 max-w-[260px]">Install our app on your device for fast access, offline logs, and push updates!</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-divemap-blue hover:bg-divemap-deep text-white text-xs font-semibold rounded-xl transition-colors shadow-sm">
              Install Now
            </button>
          </div>
        );
      }

      if (platform === 'ios') {
        return (
          <div className="flex flex-col h-full justify-between items-center text-center">
            <div className="w-12 h-12 rounded-full bg-divemap-surface text-divemap-blue flex items-center justify-center mb-3 animate-pulse">
              <Smartphone size={24} />
            </div>
            <h4 className="font-display font-bold text-gray-900 text-sm">Add to Home Screen</h4>
            <p className="text-xs text-gray-500 mt-1.5 max-w-[260px]">Add Divemap directly to your iPhone for the ultimate mobile-first experience.</p>
            <button onClick={() => setShowIOSModal(true)} className="mt-4 px-4 py-2 bg-divemap-blue hover:bg-divemap-deep text-white text-xs font-semibold rounded-xl transition-colors shadow-sm">
              Show Instructions
            </button>

            {showIOSModal && (
              <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-left">
                  <button onClick={() => setShowIOSModal(false)} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full text-gray-500">
                    <X size={18} />
                  </button>
                  <h3 className="font-display font-bold text-lg text-gray-900 mb-4">Install on iPhone</h3>
                  <ol className="space-y-4 text-sm text-gray-600">
                    <li className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-divemap-surface text-divemap-blue flex items-center justify-center font-bold text-xs">1</span>
                      <div>Tap Safari's <strong>Share</strong> button <Share size={16} className="inline text-gray-700" />.</div>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-divemap-surface text-divemap-blue flex items-center justify-center font-bold text-xs">2</span>
                      <div>Scroll down and select <strong>"Add to Home Screen"</strong> <Plus size={16} className="inline text-gray-700" />.</div>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        );
      }

      // Default Desktop
      return (
        <div className="flex flex-col h-full justify-between items-center text-center">
          <div className="w-12 h-12 rounded-full bg-divemap-surface text-divemap-blue flex items-center justify-center mb-3">
            <Shield size={24} />
          </div>
          <h4 className="font-display font-bold text-gray-900 text-sm">Track Your Adventures</h4>
          <p className="text-xs text-gray-500 mt-1.5 max-w-[260px]">Log your scuba dives, map your certs, and connect with other buddies worldwide!</p>
          <button onClick={() => navigate('/register')} className="mt-4 px-4 py-2 bg-divemap-blue hover:bg-divemap-deep text-white text-xs font-semibold rounded-xl transition-colors shadow-sm">
            Register Free
          </button>
        </div>
      );
    };

    return (
      <div className="bg-white p-5 sm:p-6 rounded-none sm:rounded-2xl border-y sm:border border-gray-100 border-l-4 border-l-divemap-blue hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[220px]">
        {renderCardContent()}
      </div>
    );
  };

  export default InFeedPromoCard;
  ```

- [ ] **Step 2: Write tests for InFeedPromoCard**
  Create `frontend/src/components/ui/InFeedPromoCard.test.jsx`. Ensure proper routing contexts.
  Run: `npm run test -- src/components/ui/InFeedPromoCard.test.jsx`
  Expected: PASS

- [ ] **Step 3: Prepare Commit**
  Write to `/home/kargig/src/divemap/commit-message.txt`:
  ```
  feat: Create native InFeedPromoCard promotional layout

  Implement customized inline card promos following responsive edge-to-edge layout constraints for seamless feed embedding.
  ```

---

### Task 6: Embed `InFeedPromoCard` into Dive Sites List Feed

**Files:**
- Modify: `frontend/src/pages/DiveSites.jsx`

**Interfaces:**
- Consumes: `<InFeedPromoCard />`

- [ ] **Step 1: Check existing page structure**
  Open `frontend/src/pages/DiveSites.jsx`. Locate the list render loops containing `sites.map((site) => ...)` and `<DiveSiteCard />`.

- [ ] **Step 2: Add dynamic injection**
  Import `InFeedPromoCard` and inspect user state. If user is null, pageViewCount triggers are eligible, and `index === 2` (after the third card), insert the `<InFeedPromoCard />` dynamically.

  ```jsx
  // Add import:
  import InFeedPromoCard from '../components/ui/InFeedPromoCard';
  import { getPromoEligibility } from '../utils/promoStorage';

  // Inside list render loops, inject:
  const eligibility = getPromoEligibility();
  const shouldShowFeedPromo = !user && eligibility.isEligible;

  // Render fragment mapping:
  {sites.map((site, index) => (
    <React.Fragment key={site.id}>
      <DiveSiteCard site={site} />
      {shouldShowFeedPromo && index === 2 && (
        <InFeedPromoCard platform={eligibility.platform} />
      )}
    </React.Fragment>
  ))}
  ```

- [ ] **Step 3: Run comprehensive frontend linter & compilation**
  Run: `make lint-frontend`
  Expected: Success without any linter violations or typescript diagnostics errors.

- [ ] **Step 4: Prepare Commit**
  Write to `/home/kargig/src/divemap/commit-message.txt`:
  ```
  feat: Inject InFeedPromoCard into DiveSites explorer feed

  Insert in-feed cards dynamically after the third card for eligible anonymous users to promote account registration or application installation.
  ```
