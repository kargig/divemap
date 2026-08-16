import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID || 'gr.divemap.twa',
  appName: 'Divemap',
  webDir: 'dist',
  server: {
    url: 'https://divemap.blue',
    hostname: 'divemap.blue',
    androidScheme: 'https',
    allowNavigation: [
      'divemap.blue',
      'accounts.google.com',
      'challenges.cloudflare.com'
    ],
    cleartext: true
  },
  plugins: {
    Geolocation: {
      permissions: ['location']
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '13107819361-hoa5601v8kj69uh2l29rd7b49eqsq9qs.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
