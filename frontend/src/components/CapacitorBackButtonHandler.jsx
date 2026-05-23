import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

/**
 * CapacitorBackButtonHandler Component
 * 
 * Specifically designed for Capacitor/WebView environments to handle the 
 * physical hardware back button on Android.
 * 
 * This version is more robust:
 * 1. It registers the listener only ONCE to avoid race conditions.
 * 2. It uses window.history.back() for maximum compatibility with WebViews.
 * 3. It includes a fallback mechanism if navigation seems stuck.
 * 4. It uses React Router's internal history state (idx) for better accuracy.
 */
const CapacitorBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastTimeRef = useRef(0);
  
  // Store refs to avoid re-registering the listener when state changes
  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    locationRef.current = location;
    navigateRef.current = navigate;
  }, [location, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    console.log('[BackButton] Initializing robust listener');

    const handleBackButton = async (data) => {
      const pathname = locationRef.current.pathname;
      const historyState = window.history.state;
      
      // React Router v6/v7 adds an 'idx' to history.state to track position.
      // idx === 0 usually means we are at the entry point of the app.
      const isAtStart = !historyState || historyState.idx === 0;
      const isHome = pathname === '/' || pathname === '/index.html' || pathname === '';

      console.log(`[BackButton] Event: path=${pathname}, idx=${historyState?.idx}, canGoBack=${data.canGoBack}`);

      if (isHome || isAtStart) {
        // App exit logic for Home or start of history
        const currentTime = Date.now();
        if (currentTime - lastTimeRef.current < 2000) {
          console.log('[BackButton] Calling exitApp');
          App.exitApp();
        } else {
          lastTimeRef.current = currentTime;
          toast('Press back again to exit', {
            duration: 2000,
            position: 'bottom-center',
            icon: '👋',
          });
        }
      } else {
        // Subpage navigation
        console.log('[BackButton] Attempting history.back()');
        window.history.back();

        // Fallback: If we are still on the same page after a short delay, 
        // it means history.back() failed or the WebView history is out of sync.
        setTimeout(() => {
          if (locationRef.current.pathname === pathname) {
            console.log('[BackButton] Fallback: history.back() failed, forcing navigation to Home');
            navigateRef.current('/', { replace: false });
          }
        }, 250);
      }
    };

    const listenerPromise = App.addListener('backButton', handleBackButton);

    return () => {
      console.log('[BackButton] Cleaning up listener');
      listenerPromise.then(l => l.remove());
    };
  }, []); // Singleton listener

  return null;
};

export default CapacitorBackButtonHandler;
