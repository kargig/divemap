import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

import api from '../api';
import googleAuth from '../utils/googleAuth';
import { isTurnstileEnabled } from '../utils/turnstileConfig';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [tokenExpiry, setTokenExpiry] = useState(null);
  // const [refreshTimer, setRefreshTimer] = useState(null); // No longer needed

  // Token renewal logic - DISABLED to prevent conflicts with API interceptor
  // The API interceptor handles token renewal automatically on 401 errors
  const scheduleTokenRenewal = useCallback(expiresIn => {
    // DISABLED: Proactive token renewal conflicts with API interceptor
    // The API interceptor will handle token renewal automatically
  }, []);

  const renewToken = async () => {
    // DISABLED: This function is no longer needed
    // The API interceptor handles token renewal automatically
  };

  // Add token to requests if it exists
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Retry fetching user when backend comes back after being down
  // Listen for successful API calls after gateway timeouts
  useEffect(() => {
    if (!token) return;

    const handleBackendOnline = () => {
      // If we have a token but no user data, try to fetch user
      // This handles the case where backend was down and came back
      if (token && !user) {
        console.log('Backend recovered, fetching user data...');
        fetchUser();
      }
    };

    // Listen for successful API responses indicating backend is back online
    window.addEventListener('backendOnline', handleBackendOnline);

    // Also set up a periodic check when user is null but token exists
    // This is a fallback in case the event doesn't fire
    let retryInterval = null;
    if (token && !user) {
      // Retry fetching user every 10 seconds if we have token but no user
      // This will keep trying until we get user data or token becomes invalid
      retryInterval = window.setInterval(() => {
        fetchUser();
      }, 10000); // 10 seconds
    }

    return () => {
      window.removeEventListener('backendOnline', handleBackendOnline);
      if (retryInterval) {
        window.clearInterval(retryInterval);
      }
    };
  }, [token, user, loading]);

  // Listen for token refresh events from API interceptor
  useEffect(() => {
    const handleTokenRefresh = event => {
      const { access_token } = event.detail;
      setToken(access_token);
    };

    window.addEventListener('tokenRefreshed', handleTokenRefresh);

    return () => {
      window.removeEventListener('tokenRefreshed', handleTokenRefresh);
    };
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/v1/auth/me');
      setUser(response.data);
      setLoading(false); // Successfully loaded user data
    } catch (error) {
      // Don't log out on gateway timeouts (504) or server errors (5xx)
      // These often happen when backend is cold-starting
      // The API interceptor will retry automatically
      if (
        error.response?.status >= 500 ||
        error.response?.status === 504 ||
        error.isGatewayTimeout
      ) {
        // Server error or gateway timeout - don't log out, preserve session
        // If we have a token, keep user state as-is (don't clear it)
        // User will remain logged in (token still valid) and can retry later
        console.warn(
          'Backend unavailable, keeping user session:',
          error.response?.status || 'gateway timeout'
        );
        // Don't set user to null - preserve existing state if token exists
        // This allows user to stay "logged in" even if we can't verify right now
        // When backend comes back, any API call will trigger a retry and fetchUser will succeed
        if (token) {
          // We have a token, so user should be considered logged in
          // Don't clear user state - keep it as-is (might be null on first load, that's okay)
          // Keep loading as true so app shows loading state instead of "logged out"
          // User data will be fetched when backend comes back (via periodic retry or backendOnline event)
          setLoading(true); // Keep loading true so we keep retrying
        } else {
          // No token, so user is not logged in
          setUser(null);
          setLoading(false);
        }
      } else if (error.response?.status === 401) {
        // Unauthorized - token is invalid, log out
        logout();
        setLoading(false);
      } else {
        // Other errors - log out to be safe
        logout();
        setLoading(false);
      }
    }
  };

  const login = async (username, password, turnstileToken) => {
    try {
      const requestData = {
        username,
        password,
      };

      // Only include Turnstile token if it's enabled and provided
      if (isTurnstileEnabled() && turnstileToken) {
        requestData.turnstile_token = turnstileToken;
      }

      const response = await api.post('/api/v1/auth/login', requestData);

      const { access_token, expires_in } = response.data;

      // Store access token
      localStorage.setItem('access_token', access_token);

      // Update token state
      setToken(access_token);

      // Calculate expiry time
      const expiryTime = Date.now() + expires_in * 1000;
      localStorage.setItem('tokenExpiry', expiryTime.toString());

      // Schedule token renewal - DISABLED (using API interceptor instead)
      // scheduleTokenRenewal(expiryTime);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error?.response?.data?.detail || error?.message || 'Invalid username or password',
      };
    }
  };

  const loginWithGoogle = async googleToken => {
    try {
      const response = await api.post('/api/v1/auth/google-login', {
        token: googleToken,
      });

      const { access_token, expires_in } = response.data;

      localStorage.setItem('access_token', access_token);
      // Note: refresh_token is now set as an HTTP-only cookie by the backend

      setToken(access_token);
      // Note: refreshToken state is no longer needed since it's in cookies

      // Schedule token renewal - DISABLED (using API interceptor instead)
      // scheduleTokenRenewal(expires_in);

      await fetchUser();
      toast.success('Google login successful!');
      return true;
    } catch (error) {
      console.error('Google login error:', error);
      const message = error.response?.data?.detail || 'Google login failed';
      toast.error(message);
      return false;
    }
  };

  const register = async (username, email, password, turnstileToken) => {
    try {
      const requestData = {
        username,
        email,
        password,
      };

      // Only include Turnstile token if it's enabled and provided
      if (isTurnstileEnabled() && turnstileToken) {
        requestData.turnstile_token = turnstileToken;
      }

      const response = await api.post('/api/v1/auth/register', requestData);

      const { access_token, expires_in } = response.data;

      localStorage.setItem('access_token', access_token);
      // Note: refresh_token is now set as an HTTP-only cookie by the backend

      setToken(access_token);
      // Note: refreshToken state is no longer needed since it's in cookies

      // Schedule token renewal - DISABLED (using API interceptor instead)
      // scheduleTokenRenewal(expires_in);

      await fetchUser();
      toast.success('Registration successful!');
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      const message = error.response?.data?.detail || 'Registration failed';
      toast.error(message);
      return false;
    }
  };

  const registerWithGoogle = async googleToken => {
    try {
      const response = await api.post('/api/v1/auth/google-login', {
        token: googleToken,
      });

      const { access_token, expires_in } = response.data;

      localStorage.setItem('access_token', access_token);
      // Note: refresh_token is now set as an HTTP-only cookie by the backend

      setToken(access_token);
      // Note: refreshToken state is no longer needed since it's in cookies

      // Schedule token renewal - DISABLED (using API interceptor instead)
      // scheduleTokenRenewal(expires_in);

      await fetchUser();
      toast.success('Google registration successful!');
      return true;
    } catch (error) {
      console.error('Google registration error:', error);
      const message = error.response?.data?.detail || 'Google registration failed';
      toast.error(message);
      return false;
    }
  };

  const logout = () => {
    // Clear timers - no longer needed since proactive renewal is disabled
    // if (refreshTimer) {
    //   clearTimeout(refreshTimer);
    //   setRefreshTimer(null);
    // }

    // Revoke refresh token on backend
    api.post('/api/v1/auth/logout').catch(console.error);

    localStorage.removeItem('access_token');
    // Note: refresh_token cookie will be cleared by the backend logout endpoint
    setToken(null);
    setUser(null);
    setTokenExpiry(null);

    googleAuth.signOut();
    toast.success('Logged out successfully');
  };

  const updateUser = userData => {
    setUser(userData);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // No cleanup needed since proactive renewal is disabled
      // if (refreshTimer) {
      //   clearTimeout(refreshTimer);
      // }
    };
  }, []);

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    registerWithGoogle,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
