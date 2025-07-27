import React, { createContext, useContext, useState, useEffect } from 'react';
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
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/v1/auth/login', {
        username,
        password,
      });
      
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
      await fetchUser();
      toast.success('Login successful!');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Login failed';
      toast.error(message);
      return false;
    }
  };

  const loginWithGoogle = async (googleToken) => {
    try {
      const response = await api.post('/api/v1/auth/google-login', {
        token: googleToken,
      });
      
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
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
      
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
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

  const registerWithGoogle = async (googleToken) => {
    try {
      const response = await api.post('/api/v1/auth/google-login', {
        token: googleToken,
      });
      
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      
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
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
    // Also sign out from Google
    googleAuth.signOut();
    toast.success('Logged out successfully');
  };

  const value = {
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    registerWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 