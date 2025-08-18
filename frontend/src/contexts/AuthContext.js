import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

import api from '../api';
import googleAuth from '../utils/googleAuth';

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
  const [refreshTimer, setRefreshTimer] = useState(null);

  // Token renewal logic
  const scheduleTokenRenewal = useCallback(
    expiresIn => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      // Renew token 2 minutes before expiration
      const renewalTime = (expiresIn - 120) * 1000;
      const timer = setTimeout(() => {
        renewToken();
      }, renewalTime);

      setRefreshTimer(timer);
    },
    [refreshTimer]
  );

  const renewToken = async () => {
    try {
      const response = await api.post('/api/v1/auth/refresh');
      const { access_token, expires_in } = response.data;

      localStorage.setItem('access_token', access_token);
      setToken(access_token);

      // Schedule next renewal
      scheduleTokenRenewal(expires_in);

      console.log('Token renewed successfully');
    } catch (error) {
      console.error('Token renewal failed:', error);
      // Fallback to logout
      logout();
    }
  };

  // Add token to requests if it exists
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

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

  const login = async (username, password) => {
    try {
      console.log('=== FRONTEND LOGIN FUNCTION DEBUG ===');
      console.log('Login attempt for username:', username);
      console.log('Current cookies before login:', document.cookie);
      console.log('Current localStorage before login:', {
        access_token: localStorage.getItem('access_token'),
        user: localStorage.getItem('user'),
      });

      const response = await api.post('/api/v1/auth/login', {
        username,
        password,
      });

      console.log('Login response received:', response);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data:', response.data);

      const { access_token, expires_in } = response.data;

      // Store access token
      localStorage.setItem('access_token', access_token);

      // Calculate expiry time
      const expiryTime = Date.now() + expires_in * 1000;
      localStorage.setItem('tokenExpiry', expiryTime.toString());

      console.log('Access token stored in localStorage');
      console.log('Token expiry calculated:', new Date(expiryTime));

      // Check cookies after login
      console.log('Cookies after login:', document.cookie);
      console.log('localStorage after login:', {
        access_token: localStorage.getItem('access_token'),
        tokenExpiry: localStorage.getItem('tokenExpiry'),
      });

      // Schedule token renewal
      scheduleTokenRenewal(expiryTime);

      console.log('Token renewal scheduled');
      console.log('=== END LOGIN FUNCTION DEBUG ===');

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
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

      // Schedule token renewal
      scheduleTokenRenewal(expires_in);

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

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/api/v1/auth/register', {
        username,
        email,
        password,
      });

      const { access_token, expires_in } = response.data;

      localStorage.setItem('access_token', access_token);
      // Note: refresh_token is now set as an HTTP-only cookie by the backend

      setToken(access_token);
      // Note: refreshToken state is no longer needed since it's in cookies

      // Schedule token renewal
      scheduleTokenRenewal(expires_in);

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

      // Schedule token renewal
      scheduleTokenRenewal(expires_in);

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
    // Clear timers
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      setRefreshTimer(null);
    }

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
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [refreshTimer]);

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
