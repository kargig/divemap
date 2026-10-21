import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

import './index.css';
import App from './App';
import { initConsentMode } from './utils/consent';

// Automatically reload if a dynamic import or chunk fails due to a new deployment
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  window.location.reload();
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
