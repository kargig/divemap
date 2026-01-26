import axios from 'axios';

import { extractErrorMessage } from './utils/apiErrors';

// Create axios instance with relative URLs
// Using relative URLs (empty baseURL) ensures the browser automatically uses
// the same protocol as the page (HTTPS in production, HTTP in development)
const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: include cookies with all requests
});

// Override baseURL for localhost development only
// In production, baseURL stays empty = relative URLs = automatic HTTPS
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.');

  if (isLocalhost) {
    // Development: backend on different port
    const envUrl = import.meta.env.VITE_API_URL;
    api.defaults.baseURL =
      envUrl && envUrl.trim() && envUrl.startsWith('http://localhost')
        ? envUrl
        : 'http://localhost:8000';
  }
}

// Request interceptor to add auth token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add a flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue = [];

// Track retry attempts for gateway timeouts
const retryAttempts = new Map();

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

// Helper to check if error is a gateway/server error that should be retried
const isRetryableError = error => {
  if (!error.response) {
    // Network error or timeout - retry
    return true;
  }
  const status = error.response.status;
  // Retry on 5xx errors (server errors) and 504 (gateway timeout)
  return status >= 500 || status === 504;
};

// Helper to get retry delay with exponential backoff
const getRetryDelay = attempt => {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
  return Math.min(1000 * Math.pow(2, attempt), 10000);
};

// Helper to handle 401 unauthorized errors and token refresh
const handle401Error = async (error, originalRequest) => {
  if (isRefreshing) {
    // If already refreshing, queue this request
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    })
      .then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      })
      .catch(err => {
        return Promise.reject(err);
      });
  }

  originalRequest._retry = true;
  isRefreshing = true;

  try {
    // Attempt to renew token using refresh token from cookies
    const response = await api.post(
      '/api/v1/auth/refresh',
      {},
      {
        withCredentials: true, // Important: include cookies
      }
    );
    const { access_token } = response.data;

    // Update localStorage with new token
    localStorage.setItem('access_token', access_token);

    // Dispatch custom event to notify AuthContext of token refresh
    window.dispatchEvent(
      new window.CustomEvent('tokenRefreshed', {
        detail: { access_token },
      })
    );

    // Process queued requests
    processQueue(null, access_token);

    // Retry original request with new token
    originalRequest.headers.Authorization = `Bearer ${access_token}`;
    return api(originalRequest);
  } catch (refreshError) {
    // Process queued requests with error
    processQueue(refreshError, null);

    // Refresh failed, redirect to login
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Helper to handle retryable errors (gateway timeouts, server errors)
const handleRetryableError = async (error, originalRequest) => {
  const requestKey = `${originalRequest.method}:${originalRequest.url}`;
  const attempt = retryAttempts.get(requestKey) || 0;
  const maxRetries = 3;

  if (attempt < maxRetries) {
    // Mark as gateway retry to prevent infinite loops
    retryAttempts.set(requestKey, attempt + 1);

    const delay = getRetryDelay(attempt);

    // Wait before retrying (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry the request (don't clear _gatewayRetry, it prevents infinite loops)
    return api(originalRequest);
  } else {
    // Max retries reached, clear tracking and reject
    retryAttempts.delete(requestKey);
    error.isGatewayTimeout = true;
    error.isServerError = true;
    return Promise.reject(error);
  }
};

// Response interceptor for successful responses
api.interceptors.response.use(
  response => {
    // If we get a successful response after backend was down, notify AuthContext
    // This helps recover user session when backend comes back
    if (response.status >= 200 && response.status < 300) {
      // Dispatch event to notify that backend is back online
      // AuthContext can use this to retry fetching user if needed
      window.dispatchEvent(
        new window.CustomEvent('backendOnline', {
          detail: { url: response.config.url },
        })
      );
    }

    return response;
  },
  async error => {
    const originalRequest = error.config || {};

    // Do NOT try to refresh token for auth endpoints like login/register/google-login
    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/google-login');

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      return handle401Error(error, originalRequest);
    }

    // Handle 429 Rate Limiting
    if (error.response?.status === 429) {
      const retryAfter =
        error.response.headers['retry-after'] || error.response.data?.retry_after || 30;
      error.retryAfter = retryAfter;
      error.isRateLimited = true;
    }

    // Handle Retryable Errors (5xx, timeouts)
    if (isRetryableError(error) && !originalRequest._gatewayRetry) {
      return handleRetryableError(error, originalRequest);
    }

    // Clear retry tracking on final failure (if not already cleared)
    if (originalRequest.url && !error.isGatewayTimeout) {
      const requestKey = `${originalRequest.method}:${originalRequest.url}`;
      retryAttempts.delete(requestKey);
    }

    return Promise.reject(error);
  }
);

// Health check API (for keepalive to prevent backend cold starts)
export const healthCheck = async () => {
  try {
    const response = await api.get('/health', {
      params: { frontend: 'true' },
      timeout: 5000, // 5 second timeout
    });
    return response.data;
  } catch {
    // Silently fail - this is just a keepalive
    return null;
  }
};

// Global Search API
export const searchGlobal = async (query, limit = 8) => {
  try {
    const response = await api.get('/api/v1/search/', {
      params: {
        q: query,
        limit: limit,
      },
    });
    return response.data;
  } catch (error) {
    throw extractErrorMessage(error);
  }
};

export default api;

// User public profile API functions
export const getUserPublicProfile = async username => {
  const response = await api.get(`/api/v1/users/${username}/public`);
  return response.data;
};

// Diving Centers API functions
export const getDivingCenters = async (params = {}) => {
  const response = await api.get('/api/v1/diving-centers/', { params });
  return response.data;
};

export const getDivingCenter = async divingCenterId => {
  const response = await api.get(`/api/v1/diving-centers/${divingCenterId}`);
  return response.data;
};

// Nearby diving centers (pre-populate by coordinates)
export const getNearbyDivingCenters = async ({ lat, lng, radius_km = 100, limit = 25 }) => {
  const params = new URLSearchParams();
  params.append('lat', lat);
  params.append('lng', lng);
  params.append('radius_km', radius_km);
  params.append('limit', limit);
  const response = await api.get(`/api/v1/diving-centers/nearby?${params.toString()}`);
  return response.data;
};

// Search diving centers globally by name, optionally ranking with distance
export const searchDivingCenters = async ({ q, limit = 20, lat, lng }) => {
  const params = new URLSearchParams();
  params.append('q', q);
  params.append('limit', limit);
  if (typeof lat === 'number' && typeof lng === 'number') {
    params.append('lat', lat);
    params.append('lng', lng);
  }
  const response = await api.get(`/api/v1/diving-centers/search?${params.toString()}`);
  return response.data;
};

// Diving Center Ownership API functions
export const claimDivingCenterOwnership = async (divingCenterId, claimData) => {
  const response = await api.post(`/api/v1/diving-centers/${divingCenterId}/claim`, claimData);
  return response.data;
};

export const approveDivingCenterOwnership = async (divingCenterId, approvalData) => {
  const response = await api.post(
    `/api/v1/diving-centers/${divingCenterId}/approve-ownership`,
    approvalData
  );
  return response.data;
};

export const getOwnershipRequests = async () => {
  const response = await api.get('/api/v1/diving-centers/ownership-requests');
  return response.data;
};

export const revokeDivingCenterOwnership = async (divingCenterId, revocationData) => {
  const response = await api.post(
    `/api/v1/diving-centers/${divingCenterId}/revoke-ownership`,
    revocationData
  );
  return response.data;
};

export const getOwnershipRequestHistory = async () => {
  const response = await api.get('/api/v1/diving-centers/ownership-requests/history');
  return response.data;
};

// Dive Sites API functions
export const getDiveSites = async (params = {}) => {
  const response = await api.get('/api/v1/dive-sites/', { params });
  return response.data;
};

export const getUniqueCountries = async (search = '') => {
  const params = search ? { search } : {};
  const response = await api.get('/api/v1/dive-sites/countries', { params });
  return response.data;
};

export const getUniqueRegions = async (country = '', search = '') => {
  const params = {};
  if (country) params.country = country;
  if (search) params.search = search;
  const response = await api.get('/api/v1/dive-sites/regions', { params });
  return response.data;
};

// User search API function for buddy selection and filtering
export const searchUsers = async (query, limit = 25, includeSelf = false) => {
  const response = await api.get('/api/v1/users/search', {
    params: { query, limit, include_self: includeSelf },
  });
  return response.data;
};

export const getDiveSite = async diveSiteId => {
  const response = await api.get(`/api/v1/dive-sites/${diveSiteId}`);
  return response.data;
};

// Tags API functions
export const getAvailableTags = async () => {
  const response = await api.get('/api/v1/tags/');
  return response.data;
};

export const getTagsWithCounts = async () => {
  const response = await api.get('/api/v1/tags/with-counts');
  return response.data;
};

export const createTag = async tagData => {
  const response = await api.post('/api/v1/tags/', tagData);
  return response.data;
};

export const updateTag = async (tagId, tagData) => {
  const response = await api.put(`/api/v1/tags/${tagId}`, tagData);
  return response.data;
};

export const deleteTag = async tagId => {
  const response = await api.delete(`/api/v1/tags/${tagId}`);
  return response.data;
};

// Diving Organizations API functions
export const getDivingOrganizations = async (params = {}) => {
  const response = await api.get('/api/v1/diving-organizations/', { params });
  return response.data;
};

export const getDivingOrganization = async identifier => {
  const response = await api.get(`/api/v1/diving-organizations/${identifier}`);
  return response.data;
};

export const getDivingOrganizationLevels = async identifier => {
  const response = await api.get(`/api/v1/diving-organizations/${identifier}/levels`);
  return response.data;
};

// Newsletter API functions
export const uploadNewsletter = async (file, useOpenai = true) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('use_openai', useOpenai.toString());

  const response = await api.post('/api/v1/newsletters/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const parseNewsletterText = async (content, divingCenterId = null, useOpenai = true) => {
  const response = await api.post('/api/v1/newsletters/parse-text', {
    content,
    diving_center_id: divingCenterId,
    use_openai: useOpenai,
  });
  return response.data;
};

// Dive Trip API functions
export const getParsedTrips = async (params = {}) => {
  // Only include parameters that have values
  const validParams = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.toString().trim() !== '') {
      validParams[key] = value;
    }
  });

  const response = await api.get('/api/v1/newsletters/trips', { params: validParams });
  return response.data;
};

export const deleteParsedTrip = async tripId => {
  const response = await api.delete(`/api/v1/newsletters/trips/${tripId}`);
  return response.data;
};

// Newsletter Management API functions
export const getNewsletters = async (params = {}) => {
  const response = await api.get('/api/v1/newsletters/', { params });
  return response.data;
};

export const getNewsletter = async newsletterId => {
  const response = await api.get(`/api/v1/newsletters/${newsletterId}`);
  return response.data;
};

export const updateNewsletter = async (newsletterId, newsletterData) => {
  const response = await api.put(`/api/v1/newsletters/${newsletterId}`, newsletterData);
  return response.data;
};

export const deleteNewsletter = async newsletterId => {
  const response = await api.delete(`/api/v1/newsletters/${newsletterId}`);
  return response.data;
};

export const deleteNewsletters = async newsletterIds => {
  const response = await api.delete('/api/v1/newsletters/', {
    data: { newsletter_ids: newsletterIds },
  });
  return response.data;
};

// Re-parse newsletter
export const reparseNewsletter = async (newsletterId, useOpenai = true) => {
  const formData = new FormData();
  formData.append('use_openai', useOpenai.toString());

  const response = await api.post(`/api/v1/newsletters/${newsletterId}/reparse`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// ParsedDiveTrip CRUD operations
export const createParsedTrip = async tripData => {
  const response = await api.post('/api/v1/newsletters/trips', tripData);
  return response.data;
};

export const getParsedTrip = async tripId => {
  const response = await api.get(`/api/v1/newsletters/trips/${tripId}`);
  return response.data;
};

export const updateParsedTrip = async (tripId, tripData) => {
  const response = await api.put(`/api/v1/newsletters/trips/${tripId}`, tripData);
  return response.data;
};

// Dive Routes API functions
export const getDiveRoutes = async (params = {}) => {
  const response = await api.get('/api/v1/dive-routes/', { params });
  return response.data;
};

export const updateDiveSiteMedia = async (diveSiteId, mediaId, description = null) => {
  const data = {};
  if (description !== null) data.description = description;
  const response = await api.patch(`/api/v1/dive-sites/${diveSiteId}/media/${mediaId}`, data);
  return response.data;
};

// Upload photo to R2 only for dive sites (without creating database record)
export const uploadDiveSitePhotoToR2Only = async (diveSiteId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(
    `/api/v1/dive-sites/${diveSiteId}/media/upload-photo-r2-only`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// Add dive site media
export const addDiveSiteMedia = async (diveSiteId, mediaData) => {
  const response = await api.post(`/api/v1/dive-sites/${diveSiteId}/media`, mediaData);
  return response.data;
};

// Update media order
export const updateMediaOrder = async (diveSiteId, order) => {
  const response = await api.put(`/api/v1/dive-sites/${diveSiteId}/media/order`, { order });
  return response.data;
};
