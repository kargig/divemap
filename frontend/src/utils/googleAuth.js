// Google OAuth utility using Google Identity Services
class GoogleAuth {
  constructor() {
    this.google = null;
    this.isInitialized = false;
    this.clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  }

  // Initialize Google Identity Services
  async initialize() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Load Google Identity Services script
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
    // Check if client ID is configured
    if (!this.clientId || this.clientId === 'undefined') {
      throw new Error('Google OAuth client ID not configured');
    }

    await this.initialize();

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

  // Sign in with Google
  async signIn() {
    // Check if client ID is configured
    if (!this.clientId || this.clientId === 'undefined') {
      throw new Error('Google OAuth client ID not configured');
    }

    await this.initialize();

    if (!this.google) {
      throw new Error('Google Identity Services not loaded');
    }

    return new Promise((resolve, reject) => {
      this.google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          reject(new Error('Google Sign-In prompt not displayed'));
        } else {
          // The prompt is displayed, user will interact with it
          // The callback will be called when user completes sign-in
        }
      });
    });
  }

  // Sign out
  async signOut() {
    if (this.google && this.isInitialized) {
      this.google.accounts.id.disableAutoSelect();
    }
  }

  // Check if user is signed in
  async isSignedIn() {
    // Check if client ID is configured
    if (!this.clientId || this.clientId === 'undefined') {
      return false;
    }

    await this.initialize();

    if (!this.google) {
      return false;
    }

    return new Promise(resolve => {
      this.google.accounts.id
        .getTokenSilently({
          client_id: this.clientId,
        })
        .then(() => {
          resolve(true);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  // Get current user info
  async getCurrentUser() {
    // Check if client ID is configured
    if (!this.clientId || this.clientId === 'undefined') {
      throw new Error('Google OAuth client ID not configured');
    }

    await this.initialize();

    if (!this.google) {
      throw new Error('Google Identity Services not loaded');
    }

    return new Promise((resolve, reject) => {
      this.google.accounts.id
        .getTokenSilently({
          client_id: this.clientId,
        })
        .then(token => {
          // Decode the JWT token to get user info
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

// Create singleton instance
const googleAuth = new GoogleAuth();

export default googleAuth;
