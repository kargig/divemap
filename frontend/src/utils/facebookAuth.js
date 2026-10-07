class FacebookAuth {
  constructor() {
    this.appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    this.isInitialized = false;
  }

  setAppId(appId) {
    if (appId && appId !== 'undefined') {
      this.appId = appId;
    }
  }

  async initialize(customAppId) {
    if (customAppId && customAppId !== 'undefined') {
      this.appId = customAppId;
    }
    if (this.isInitialized || typeof window === 'undefined') return;

    return new Promise(resolve => {
      if (window.FB) {
        this.isInitialized = true;
        resolve();
        return;
      }

      window.fbAsyncInit = () => {
        window.FB.init({
          appId: this.appId,
          cookie: true,
          xfbml: true,
          version: 'v18.0',
        });
        this.isInitialized = true;
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    });
  }

  async signIn(customAppId) {
    if (customAppId && customAppId !== 'undefined') {
      this.appId = customAppId;
    }
    if (!this.appId || this.appId === 'undefined') {
      throw new Error('Facebook App ID not configured.');
    }
    await this.initialize();

    return new Promise((resolve, reject) => {
      window.FB.login(
        response => {
          if (response.authResponse && response.authResponse.accessToken) {
            resolve(response.authResponse.accessToken);
          } else {
            reject(new Error('Facebook sign in was cancelled or failed.'));
          }
        },
        { scope: 'public_profile' }
      );
    });
  }
}

export const facebookAuth = new FacebookAuth();
