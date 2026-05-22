import { Capacitor } from '@capacitor/core';
import { GoogleAuth as CapacitorGoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Google OAuth utility using Google Identity Services (Web) and Capacitor Google Auth (Native)
class GoogleAuth {
  constructor() {
    this.google = null;
    this.isInitialized = false;
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    this.isCapacitor = Capacitor.isNativePlatform();
  }

  // Initialize Google Identity Services (for Web)
  async initialize() {
    if (this.isInitialized) return;

    if (this.isCapacitor) {
      // Capacitor plugin handles its own initialization via capacitor.config.ts
      CapacitorGoogleAuth.initialize({
        clientId: this.clientId,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
      this.isInitialized = true;
      return;
    }

    return new Promise((resolve, reject) => {
      // Load Google Identity Services script for Web
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        this.google = window.google;
        this.isInitialized = true;
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services'));
      };

      document.head.appendChild(script);
    });
  }

  // Initialize Google Sign-In button
  async initializeSignInButton(buttonId, onSuccess, onError) {
    if (!this.clientId || this.clientId === 'undefined') {
      throw new Error('Google OAuth client ID not configured');
    }

    await this.initialize();

    if (this.isCapacitor) {
      // In native mode, the web SDK doesn't render the button iframe.
      // We must manually create a styled button and attach the click listener.
      const container = document.getElementById(buttonId);
      if (container) {
        // Clear any existing content
        container.innerHTML = '';

        // Create custom button styled to look somewhat like the Google button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'flex items-center justify-center gap-3 w-full border border-gray-300 dark:border-gray-600 rounded-md py-2 px-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm font-medium';

        // Add Google SVG icon
        const svg = document.createElement('div');
        svg.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>';

        const text = document.createElement('span');
        text.innerText = 'Sign in with Google';

        btn.appendChild(svg.firstChild);
        btn.appendChild(text);

        container.appendChild(btn);

        btn.onclick = async () => {
          try {
            const result = await CapacitorGoogleAuth.signIn();
            // The native plugin returns an idToken (equivalent to Web credential)
            if (result && result.authentication && result.authentication.idToken) {
              onSuccess(result.authentication.idToken);
            } else {
              onError(new Error('No credential received from native plugin'));
            }
          } catch (error) {
            console.error('Native Google Auth Error:', JSON.stringify(error));
            onError(error);
          }
        };
      }
      return;
    }

    if (!this.google) {
      throw new Error('Google Identity Services not loaded');
    }

    this.google.accounts.id.initialize({
      client_id: this.clientId,
      callback: response => {
        if (response.credential) {
          onSuccess(response.credential);
        } else {
          onError(new Error('No credential received'));
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup', // Web ALWAYS uses popup
    });

    this.google.accounts.id.renderButton(document.getElementById(buttonId), {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
    });
  }

  // Sign in with Google (Fallback/Manual)
  async signIn() {
    if (!this.clientId || this.clientId === 'undefined') {
      throw new Error('Google OAuth client ID not configured');
    }

    await this.initialize();

    if (this.isCapacitor) {
      return CapacitorGoogleAuth.signIn();
    }

    if (!this.google) {
      throw new Error('Google Identity Services not loaded');
    }

    return new Promise((resolve, reject) => {
      this.google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          reject(new Error('Google Sign-In prompt not displayed'));
        }
      });
    });
  }

  // Sign out
  async signOut() {
    if (this.isCapacitor) {
      try {
        await CapacitorGoogleAuth.signOut();
      } catch (e) {
        console.error('Error signing out of native Google Auth', e);
      }
      return;
    }

    if (this.google && this.isInitialized) {
      this.google.accounts.id.disableAutoSelect();
    }
  }

  // Check if user is signed in
  async isSignedIn() {
    if (!this.clientId || this.clientId === 'undefined') {
      return false;
    }

    await this.initialize();

    if (this.isCapacitor) {
      // Native plugin doesn't have a silent getToken check, we assume false
      // and rely on backend JWT for actual session state
      return false;
    }

    if (!this.google) {
      return false;
    }

    return new Promise(resolve => {
      this.google.accounts.id
        .getTokenSilently({
          client_id: this.clientId,
        })
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  }

  // Get current user info
  async getCurrentUser() {
    if (!this.clientId || this.clientId === 'undefined') {
      throw new Error('Google OAuth client ID not configured');
    }

    await this.initialize();

    if (this.isCapacitor) {
      // Native fallback, but generally the app uses backend JWT
      throw new Error('Not implemented for native plugin');
    }

    if (!this.google) {
      throw new Error('Google Identity Services not loaded');
    }

    return new Promise((resolve, reject) => {
      this.google.accounts.id
        .getTokenSilently({
          client_id: this.clientId,
        })
        .then(token => {
          const payload = JSON.parse(atob(token.split('.')[1]));
          resolve({
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            token: token,
          });
        })
        .catch(reject);
    });
  }
}

const googleAuth = new GoogleAuth();
export default googleAuth;
