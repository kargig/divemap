import { Cookie, Shield, BarChart3, X, Check, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getConsentStatus, setConsent, CONSENT_UPDATED_EVENT } from '../utils/consent';

export const OPEN_COOKIE_SETTINGS_EVENT = 'divemap-open-cookie-settings';

/**
 * Open the cookie preferences modal from anywhere in the app.
 */
export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new window.CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
  }
}

export default function CookieConsentBanner() {
  const [consentStatus, setConsentStatus] = useState(getConsentStatus);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [preferencesEnabled, setPreferencesEnabled] = useState(false);

  // Sync state when preferences are updated
  useEffect(() => {
    const handleUpdate = () => {
      const status = getConsentStatus();
      setConsentStatus(status);
      setAnalyticsEnabled(status.analytics);
      setPreferencesEnabled(status.preferences);
    };

    const handleOpenSettings = () => {
      const status = getConsentStatus();
      setAnalyticsEnabled(status.analytics);
      setPreferencesEnabled(status.preferences);
      setIsModalOpen(true);
    };

    window.addEventListener(CONSENT_UPDATED_EVENT, handleUpdate);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);

    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenSettings);
    };
  }, []);

  const handleAcceptAll = useCallback(() => {
    setConsent({ analytics: true, preferences: true });
    setIsModalOpen(false);
  }, []);

  const handleRejectOptional = useCallback(() => {
    setConsent({ analytics: false, preferences: false });
    setIsModalOpen(false);
  }, []);

  const handleSavePreferences = useCallback(() => {
    setConsent({ analytics: analyticsEnabled, preferences: preferencesEnabled });
    setIsModalOpen(false);
  }, [analyticsEnabled, preferencesEnabled]);

  const handleOpenCustomize = useCallback(() => {
    setAnalyticsEnabled(consentStatus.analytics);
    setPreferencesEnabled(consentStatus.preferences);
    setIsModalOpen(true);
  }, [consentStatus.analytics, consentStatus.preferences]);

  const showBanner = !consentStatus.hasResponded;

  if (!showBanner && !isModalOpen) {
    return null;
  }

  return (
    <>
      {/* Fixed bottom consent banner */}
      {showBanner && !isModalOpen && (
        <aside
          role='region'
          aria-label='Cookie Consent Banner'
          className='fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-2xl transition-all animate-fade-in'
        >
          <div className='max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
            <div className='flex items-start gap-3.5 flex-1'>
              <div className='p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 shrink-0 mt-0.5'>
                <Cookie className='w-5 h-5' />
              </div>
              <div className='text-sm text-gray-700 dark:text-gray-300'>
                <p className='font-semibold text-gray-900 dark:text-white mb-1'>
                  We value your privacy
                </p>
                <p className='leading-relaxed'>
                  Divemap uses essential cookies to keep you logged in and protect against bots.
                  With your consent, we also use optional analytics cookies to help us improve the
                  platform, and preference cookies to remember your diver info for faster booking
                  checkout. Learn more in our{' '}
                  <Link
                    to='/privacy'
                    className='text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-800 dark:hover:text-blue-300'
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0 justify-end'>
              <button
                type='button'
                onClick={handleRejectOptional}
                className='px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                Reject Optional
              </button>
              <button
                type='button'
                onClick={handleOpenCustomize}
                className='px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                Customize
              </button>
              <button
                type='button'
                onClick={handleAcceptAll}
                className='px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Customize Preferences Modal */}
      {isModalOpen && (
        <div
          role='dialog'
          aria-modal='true'
          aria-labelledby='cookie-modal-title'
          className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
        >
          <div className='bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto'>
            <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
              <div className='flex items-center gap-2.5'>
                <div className='p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400'>
                  <Cookie className='w-5 h-5' />
                </div>
                <h3
                  id='cookie-modal-title'
                  className='text-lg font-bold text-gray-900 dark:text-white'
                >
                  Cookie Preferences
                </h3>
              </div>
              <button
                type='button'
                onClick={() => setIsModalOpen(false)}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg'
                aria-label='Close cookie settings'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <p className='text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed'>
              Choose which categories of cookies you wish to allow. Essential cookies are required
              for the website to function properly. You can change these preferences at any time.
            </p>

            <div className='space-y-4'>
              {/* Essential Cookies */}
              <div className='p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750/50'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2.5'>
                    <Shield className='w-4 h-4 text-green-600 dark:text-green-400' />
                    <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                      Strictly Necessary
                    </span>
                  </div>
                  <span className='text-xs font-semibold px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'>
                    Always Active
                  </span>
                </div>
                <p className='mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed'>
                  Required for core authentication, session refresh tokens, security challenge
                  verification (Cloudflare Turnstile), and basic site navigation.
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className='p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2.5'>
                    <BarChart3 className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                    <label
                      htmlFor='analytics-cookies-toggle'
                      className='text-sm font-semibold text-gray-900 dark:text-white cursor-pointer'
                    >
                      Analytics Cookies
                    </label>
                  </div>
                  <input
                    id='analytics-cookies-toggle'
                    type='checkbox'
                    role='checkbox'
                    aria-label='Analytics Cookies'
                    checked={analyticsEnabled}
                    onChange={e => setAnalyticsEnabled(e.target.checked)}
                    className='w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer'
                  />
                </div>
                <p className='mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed'>
                  Allows Google Analytics to aggregate anonymous metrics on dive site visits,
                  popular routes, and page loading speeds to help us improve the platform.
                </p>
              </div>

              {/* Booking Preferences & Fast Checkout Cookies */}
              <div className='p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2.5'>
                    <Sparkles className='w-4 h-4 text-amber-500' />
                    <label
                      htmlFor='preferences-cookies-toggle'
                      className='text-sm font-semibold text-gray-900 dark:text-white cursor-pointer'
                    >
                      Booking Preferences & Fast Checkout
                    </label>
                  </div>
                  <input
                    id='preferences-cookies-toggle'
                    type='checkbox'
                    role='checkbox'
                    aria-label='Booking Preferences Cookies'
                    checked={preferencesEnabled}
                    onChange={e => setPreferencesEnabled(e.target.checked)}
                    className='w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 cursor-pointer'
                  />
                </div>
                <p className='mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed'>
                  Remembers your personal details, equipment sizing, emergency contacts, and
                  insurance locally in browser cookies so you don't have to re-enter them on every
                  dive booking. Always optional.
                </p>
              </div>
            </div>

            <div className='pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-end gap-2.5'>
              <button
                type='button'
                onClick={handleRejectOptional}
                className='px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors'
              >
                Reject All
              </button>
              <button
                type='button'
                onClick={handleSavePreferences}
                className='flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors'
              >
                <Check className='w-4 h-4' />
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
