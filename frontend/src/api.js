import axios from 'axios';

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

// Response interceptor for successful responses
api.interceptors.response.use(
  response => {
    if (response.config.url?.includes('/auth/login') && response.status === 200) {
    }

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

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
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
    } else if (error.response?.status === 429) {
      // Rate limiting - extract retry after information if available
      const retryAfter =
        error.response.headers['retry-after'] || error.response.data?.retry_after || 30;
      error.retryAfter = retryAfter;
      error.isRateLimited = true;
    } else if (isRetryableError(error) && !originalRequest._gatewayRetry && !isAuthEndpoint) {
      // Handle gateway timeouts (504) and server errors (5xx)
      // These often happen when backend is cold-starting on Fly.io
      const requestKey = `${originalRequest.method}:${originalRequest.url}`;
      const attempt = retryAttempts.get(requestKey) || 0;
      const maxRetries = 3;

      if (attempt < maxRetries) {
        // Mark as gateway retry to prevent infinite loops
        originalRequest._gatewayRetry = true;
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
      }
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
      timeout: 5000, // 5 second timeout
    });
    return response.data;
  } catch (error) {
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

// Utility function to extract field name from Pydantic error location
const getFieldNameFromLoc = loc => {
  if (!Array.isArray(loc) || loc.length === 0) return null;
  // Pydantic validation errors have loc like ["body", "field_name"]
  // or ["query", "field_name"] etc. We want the last element which is the field name
  const fieldName = loc[loc.length - 1];
  // Convert snake_case to human-readable format
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Utility function to extract all field errors from Pydantic validation errors
export const extractFieldErrors = error => {
  const fieldErrors = {};
  if (error.response?.data?.detail) {
    if (Array.isArray(error.response.data.detail)) {
      error.response.data.detail.forEach(err => {
        if (err.loc && Array.isArray(err.loc)) {
          const fieldName = err.loc[err.loc.length - 1];
          const fieldDisplayName = getFieldNameFromLoc(err.loc);
          fieldErrors[fieldName] = {
            message: err.msg || 'Validation error',
            displayName: fieldDisplayName || fieldName,
          };
        }
      });
    }
  }
  return fieldErrors;
};

// Utility function to extract error message from API responses
// Supports FastAPI/axios error payloads, Pydantic validation errors, and various error formats
export const extractErrorMessage = (error, defaultMessage = 'An error occurred') => {
  // Handle null/undefined
  if (!error) return defaultMessage;

  // Handle string errors directly
  if (typeof error === 'string') return error;

  // Handle error.response.data.detail (FastAPI standard)
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    // Handle Pydantic validation errors (array of error objects)
    if (Array.isArray(detail)) {
      // Extract the first validation error message with field name
      const firstError = detail[0];
      if (firstError && typeof firstError === 'object') {
        if (firstError.loc && Array.isArray(firstError.loc)) {
          const fieldDisplayName = getFieldNameFromLoc(firstError.loc);
          const errorMsg = firstError.msg || 'Validation error';
          return `${fieldDisplayName}: ${errorMsg}`;
        }
        return firstError.msg || 'Validation error';
      }
      return 'Validation error';
    }
    // Handle simple string error messages
    if (typeof detail === 'string') {
      return detail;
    }
    // If detail is an object (not array, not string), try to extract message
    if (typeof detail === 'object' && detail !== null) {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
  }

  // Handle error.response.data (alternative location)
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const first = data.detail[0];
        if (first?.msg) return first.msg;
        try {
          return JSON.stringify(data.detail);
        } catch {
          return defaultMessage;
        }
      }
      try {
        return JSON.stringify(data.detail);
      } catch {
        return defaultMessage;
      }
    }
    if (data.msg) return data.msg;
    if (data.message) return data.message;
  }

  // Handle error.detail (direct property)
  if (error.detail) {
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail) && error.detail.length > 0) {
      const first = error.detail[0];
      if (first?.msg) return first.msg;
    }
  }

  // Fallback to error.message or generic error
  if (error.message) {
    return error.message;
  }

  return defaultMessage;
};

// User public profile API functions
export const getUserPublicProfile = async username => {
  const response = await api.get(`/api/v1/users/${username}/public`);
  return response.data;
};

// Dive API functions
export const createDive = async diveData => {
  const response = await api.post('/api/v1/dives/', diveData);
  return response.data;
};

export const getDives = async (params = {}) => {
  const response = await api.get('/api/v1/dives/', { params });
  return response.data;
};

export const getDive = async diveId => {
  const response = await api.get(`/api/v1/dives/${diveId}`);
  return response.data;
};

export const updateDive = async (diveId, diveData) => {
  const response = await api.put(`/api/v1/dives/${diveId}`, diveData);
  return response.data;
};

export const deleteDive = async diveId => {
  const response = await api.delete(`/api/v1/dives/${diveId}`);
  return response.data;
};

export const addDiveMedia = async (diveId, mediaData) => {
  const response = await api.post(`/api/v1/dives/${diveId}/media`, mediaData);
  return response.data;
};

export const uploadDivePhoto = async (diveId, file, description = '', isPublic = true) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', description);
  formData.append('is_public', isPublic);
  const response = await api.post(`/api/v1/dives/${diveId}/media/upload-photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Upload photo to R2 only (without creating database record)
// Returns: { r2_path: string, url: string } - the R2 path and presigned URL for preview
export const uploadPhotoToR2Only = async (diveId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/v1/dives/${diveId}/media/upload-photo-r2-only`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Delete photo from R2 only (without deleting database record)
export const deletePhotoFromR2 = async (diveId, r2Path) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/media/delete-r2-photo`, {
    data: { r2_path: r2Path },
  });
  return response.data;
};

export const getDiveMedia = async diveId => {
  const response = await api.get(`/api/v1/dives/${diveId}/media`);
  return response.data;
};

export const deleteDiveMedia = async (diveId, mediaId) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/media/${mediaId}`);
  return response.data;
};

export const getFlickrOembed = async flickrUrl => {
  const response = await api.get('/api/v1/dives/media/flickr-oembed', {
    params: { url: flickrUrl },
  });
  return response.data;
};

// Remove buddy from dive
export const removeBuddy = async (diveId, userId) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/buddies/${userId}`);
  return response.data;
};

export const addDiveTag = async (diveId, tagData) => {
  const response = await api.post(`/api/v1/dives/${diveId}/tags`, tagData);
  return response.data;
};

export const removeDiveTag = async (diveId, tagId) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/tags/${tagId}`);
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

// Subsurface XML Import API functions
export const importSubsurfaceXML = async file => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/v1/dives/import/subsurface-xml', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const confirmImportDives = async divesData => {
  const response = await api.post('/api/v1/dives/import/confirm', divesData);
  return response.data;
};

// System Overview API functions
export const getSystemHealth = async () => {
  const response = await api.get('/api/v1/admin/system/health');
  return response.data;
};

export const getStorageHealth = async () => {
  const response = await api.get('/api/v1/admin/system/storage/health');
  return response.data;
};

export const getSystemMetrics = async () => {
  const response = await api.get('/api/v1/admin/system/metrics');
  return response.data;
};

export const getGeneralStatistics = async () => {
  const response = await api.get('/api/v1/admin/system/statistics');
  return response.data;
};

export const getNotificationAnalytics = async () => {
  const response = await api.get('/api/v1/admin/system/notifications/analytics');
  return response.data;
};

export const getGrowthData = async (period = 'month') => {
  const response = await api.get(`/api/v1/admin/system/growth?period=${period}`);
  return response.data;
};

export const getPlatformStats = async () => {
  const response = await api.get('/api/v1/admin/system/stats');
  return response.data;
};

export const getRecentActivity = async (hours = 24, limit = 100) => {
  const response = await api.get(`/api/v1/admin/system/activity?hours=${hours}&limit=${limit}`);
  return response.data;
};

export const getTurnstileStats = async (timeWindow = 24) => {
  const response = await api.get(`/api/v1/admin/system/turnstile-stats?time_window=${timeWindow}`);
  return response.data;
};

// Settings API functions
export const getSetting = async key => {
  const response = await api.get(`/api/v1/settings/${key}`);
  return response.data;
};

export const updateSetting = async (key, value) => {
  const response = await api.put(`/api/v1/settings/${key}`, { value });
  return response.data;
};

export const getAllSettings = async () => {
  const response = await api.get('/api/v1/settings');
  return response.data;
};

// Notification API functions
export const getNotifications = async (params = {}) => {
  const response = await api.get('/api/v1/notifications', { params });
  return response.data;
};

export const getUnreadCount = async () => {
  const response = await api.get('/api/v1/notifications/unread-count');
  return response.data;
};

export const getNewSinceLastCheck = async () => {
  const response = await api.get('/api/v1/notifications/new-since-last-check');
  return response.data;
};

export const markNotificationRead = async id => {
  const response = await api.put(`/api/v1/notifications/${id}/read`);
  return response.data;
};

export const markAllRead = async () => {
  const response = await api.put('/api/v1/notifications/read-all');
  return response.data;
};

export const updateLastCheck = async () => {
  const response = await api.put('/api/v1/notifications/update-last-check');
  return response.data;
};

export const deleteNotification = async id => {
  const response = await api.delete(`/api/v1/notifications/${id}`);
  return response.data;
};

export const getNotificationPreferences = async () => {
  const response = await api.get('/api/v1/notifications/preferences');
  return response.data;
};

export const createNotificationPreference = async preferenceData => {
  const response = await api.post('/api/v1/notifications/preferences', preferenceData);
  return response.data;
};

export const updateNotificationPreference = async (category, preferenceData) => {
  const response = await api.put(`/api/v1/notifications/preferences/${category}`, preferenceData);
  return response.data;
};

export const deleteNotificationPreference = async category => {
  const response = await api.delete(`/api/v1/notifications/preferences/${category}`);
  return response.data;
};

// Admin notification API functions
export const getNotificationStats = async () => {
  const response = await api.get('/api/v1/notifications/admin/stats');
  return response.data;
};

export const getEmailConfig = async () => {
  const response = await api.get('/api/v1/notifications/admin/email-config');
  return response.data;
};

export const updateEmailConfig = async configData => {
  const response = await api.put('/api/v1/notifications/admin/email-config', configData);
  return response.data;
};

export const createEmailConfig = async configData => {
  const response = await api.post('/api/v1/notifications/admin/email-config', configData);
  return response.data;
};

export const testEmailConfig = async () => {
  const response = await api.post('/api/v1/notifications/admin/test-email');
  return response.data;
};

// Admin user notification preferences API functions
export const getUserNotificationPreferences = async userId => {
  const response = await api.get(`/api/v1/notifications/admin/users/${userId}/preferences`);
  return response.data;
};

export const createUserNotificationPreference = async (userId, preferenceData) => {
  const response = await api.post(
    `/api/v1/notifications/admin/users/${userId}/preferences`,
    preferenceData
  );
  return response.data;
};

export const updateUserNotificationPreference = async (userId, category, preferenceData) => {
  const response = await api.put(
    `/api/v1/notifications/admin/users/${userId}/preferences/${category}`,
    preferenceData
  );
  return response.data;
};

export const deleteUserNotificationPreference = async (userId, category) => {
  const response = await api.delete(
    `/api/v1/notifications/admin/users/${userId}/preferences/${category}`
  );
  return response.data;
};

export const updateDiveMedia = async (diveId, mediaId, description = null, isPublic = null) => {
  const data = {};
  if (description !== null) data.description = description;
  if (isPublic !== null) data.is_public = isPublic;
  const response = await api.patch(`/api/v1/dives/${diveId}/media/${mediaId}`, data);
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
