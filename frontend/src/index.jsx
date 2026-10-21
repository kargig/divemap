import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

import './index.css';
import App from './App';
import { initConsentMode } from './utils/consent';

// Automatically reload if a dynamic import or chunk fails due to a new deployment,
// guarded by a timestamp in sessionStorage to prevent infinite reload loops if an asset is persistently broken.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  const lastReload = Number(window.sessionStorage.getItem('divemap_chunk_reload') || 0);
  const now = Date.now();
  if (now - lastReload > 10000) {
    window.sessionStorage.setItem('divemap_chunk_reload', String(now));
    window.location.reload();
  } else {
    console.error('Dynamic chunk failed to load after reload retry:', event);
  }
});

// Initialize Google Consent Mode defaults
initConsentMode();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
