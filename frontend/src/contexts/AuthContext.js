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
    } catch (error) {
      // Error fetching user, logging out
      logout();
    } finally {
      setLoading(false);
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
