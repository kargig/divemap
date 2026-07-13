import { X, Share, Plus, HelpCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import {
  incrementSessionPageViews,
  incrementCumulativePageViews,
  getPromoEligibility,
  dismissPromo,
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
    const handleInstallPrompt = e => {
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

  const handleDismiss = e => {
    e.stopPropagation();
    dismissPromo();
    setPromoState({ isEligible: false, platform: 'desktop' });
  };

  const handleAndroidInstall = () => {
    dismissPromo();
    setPromoState({ isEligible: false, platform: 'android' });
    window.open(
      'https://play.google.com/store/apps/details?id=gr.divemap.twa',
      '_blank',
      'noopener,noreferrer'
    );
  };

  // Rendering segmented layouts
  if (promoState.platform === 'android') {
    return (
      <div className='fixed bottom-0 left-0 right-0 z-[999] bg-gradient-to-r from-divemap-surface to-white border-t-4 border-divemap-blue p-4 shadow-xl flex items-center justify-between sm:left-6 sm:bottom-6 sm:right-auto sm:max-w-[400px] sm:rounded-2xl sm:border'>
        <div className='flex-1 min-w-0 pr-3'>
          <h4 className='font-display font-bold text-gray-900 text-sm'>Install Divemap App</h4>
          <p className='text-xs text-gray-600 mt-1'>
            Get the native experience with offline support and fast load times!
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={handleAndroidInstall}
            className='bg-divemap-blue hover:bg-divemap-deep text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shadow-sm'
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className='p-1 hover:bg-black/5 rounded-full transition-colors'
            aria-label='Dismiss app install promotion'
          >
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
          <div className='flex-1 min-w-0 text-xs'>
            <strong>Add Divemap to iPhone:</strong> Tap Safari's Share button{' '}
            <Share size={12} className='inline mx-0.5' /> and select{' '}
            <strong>'Add to Home Screen'</strong> <Plus size={12} className='inline mx-0.5' />.
          </div>
          <div className='flex flex-shrink-0 items-center gap-1.5'>
            <button
              onClick={() => setShowIOSModal(true)}
              className='p-0.5 hover:bg-white/10 rounded-full'
              aria-label='Show iOS installation instructions'
            >
              <HelpCircle size={14} />
            </button>
            <button
              onClick={handleDismiss}
              className='p-0.5 hover:bg-white/10 rounded-full'
              aria-label='Dismiss installation promotion'
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {showIOSModal && (
          <div className='fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4'>
            <div className='bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative'>
              <button
                onClick={() => setShowIOSModal(false)}
                className='absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full text-gray-500'
                aria-label='Close installation instructions'
              >
                <X size={18} />
              </button>
              <h3 className='font-display font-bold text-lg text-gray-900 mb-4'>
                How to install on iOS
              </h3>
              <ol className='space-y-4 text-sm text-gray-600'>
                <li className='flex gap-3'>
                  <span className='w-6 h-6 rounded-full bg-blue-50 text-divemap-blue flex items-center justify-center font-bold text-xs'>
                    1
                  </span>
                  <div>
                    Tap the <strong>Share</strong> button{' '}
                    <Share size={16} className='inline text-gray-700' /> at the bottom of Safari.
                  </div>
                </li>
                <li className='flex gap-3'>
                  <span className='w-6 h-6 rounded-full bg-blue-50 text-divemap-blue flex items-center justify-center font-bold text-xs'>
                    2
                  </span>
                  <div>
                    Scroll down and select <strong>"Add to Home Screen"</strong>{' '}
                    <Plus size={16} className='inline text-gray-700' />.
                  </div>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSModal(false)}
                className='mt-6 w-full py-2.5 bg-divemap-blue text-white rounded-xl text-sm font-medium hover:bg-divemap-deep transition-colors'
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className='fixed bottom-0 left-0 right-0 z-[999] bg-gradient-to-r from-divemap-surface to-white border-t-4 border-divemap-blue p-4 shadow-xl flex items-center justify-between sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-[420px] sm:rounded-2xl sm:border'>
      <div className='flex-1 min-w-0 pr-4'>
        <h4 className='font-display font-bold text-gray-900 text-sm'>
          Join the Divemap Community!
        </h4>
        <p className='text-xs text-gray-600 mt-0.5'>
          Register a free account to log your own dives, save favorite sites, and find buddies.
        </p>
      </div>
      <div className='flex items-center gap-2 flex-shrink-0'>
        <button
          onClick={() => navigate('/register')}
          className='bg-divemap-blue hover:bg-divemap-deep text-white text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors shadow-sm'
        >
          Sign Up
        </button>
        <button
          onClick={handleDismiss}
          className='p-1 hover:bg-black/5 rounded-full transition-colors'
          aria-label='Dismiss community promotion'
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PromoBannerManager;
