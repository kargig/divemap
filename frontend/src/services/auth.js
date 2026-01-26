import api from '../api';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

/**
 * Log in a user
 * @param {string} username
 * @param {string} password
 * @param {string} [turnstileToken] - Optional Turnstile token
 * @returns {Promise<Object>} Response data containing access_token
 */
export const login = async (username, password, turnstileToken) => {
  const requestData = {
    username,
    password,
  };

  if (turnstileToken) {
    requestData.turnstile_token = turnstileToken;
  }

  const response = await api.post('/api/v1/auth/login', requestData);
  return response.data;
};

/**
 * Register a new user
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @param {string} [turnstileToken] - Optional Turnstile token
 * @returns {Promise<Object>} Response data
 */
export const register = async (username, email, password, turnstileToken) => {
  const requestData = {
    username,
    email,
    password,
  };

  if (turnstileToken) {
    requestData.turnstile_token = turnstileToken;
  }

  const response = await api.post('/api/v1/auth/register', requestData);
  return response.data;
};

/**
 * Log in or register with Google
 * @param {string} token - Google ID token
 * @returns {Promise<Object>} Response data containing access_token
 */
export const googleLogin = async token => {
  const response = await api.post('/api/v1/auth/google-login', {
    token,
  });
  return response.data;
};

/**
 * Log out the current user
 * @returns {Promise<Object>} Response data
 */
export const logout = async () => {
  const response = await api.post('/api/v1/auth/logout');
  return response.data;
};

/**
 * Get the current user's profile
 * @returns {Promise<Object>} Response data containing user profile
 */
export const getCurrentUser = async () => {
  const response = await api.get('/api/v1/auth/me');
  return response.data;
};

/**
 * Refresh the access token
 * Note: This endpoint expects the refresh token to be in an HTTP-only cookie
 * @returns {Promise<Object>} Response data containing new access_token
 */
export const refreshAccessToken = async () => {
  const response = await api.post(
    '/api/v1/auth/refresh',
    {},
    {
      withCredentials: true,
    }
  );
  return response.data;
};
