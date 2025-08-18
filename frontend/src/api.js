import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor for token renewal
api.interceptors.response.use(
  response => {
    // Debug logging for successful responses
    if (response.config.url && response.config.url.includes('/auth/login')) {
      console.log('=== FRONTEND LOGIN RESPONSE DEBUG ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data keys:', Object.keys(response.data));
      console.log('Cookies in response:', response.headers['set-cookie']);
      console.log('=== END LOGIN RESPONSE DEBUG ===');
    }
    return response;
  },
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to renew token using refresh token from cookies
        console.log('=== FRONTEND TOKEN REFRESH DEBUG ===');
        console.log('Attempting token refresh...');
        console.log('Current cookies:', document.cookie);

        const response = await api.post(
          '/api/v1/auth/refresh',
          {},
          {
            withCredentials: true, // Important: include cookies
          }
        );
        const { access_token } = response.data;

        console.log('Token refresh successful, new access token received');
        console.log('New access token length:', access_token ? access_token.length : 0);

        // Update localStorage with new token
        localStorage.setItem('access_token', access_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        console.log('=== END TOKEN REFRESH DEBUG ===');
        return api(originalRequest);
      } catch (refreshError) {
        console.log('Token refresh failed:', refreshError);
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    } else if (error.response?.status === 429) {
      // Rate limiting - extract retry after information if available
      const retryAfter =
        error.response.headers['retry-after'] || error.response.data?.retry_after || 30;
      error.retryAfter = retryAfter;
      error.isRateLimited = true;
    }

    return Promise.reject(error);
  }
);

export default api;

// Utility function to extract error message from API responses
export const extractErrorMessage = error => {
  if (error.response?.data?.detail) {
    // Handle Pydantic validation errors
    if (Array.isArray(error.response.data.detail)) {
      // Extract the first validation error message
      const firstError = error.response.data.detail[0];
      return firstError.msg || 'Validation error';
    } else {
      // Handle simple string error messages
      return error.response.data.detail;
    }
  }
  return 'An error occurred';
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

export const getDiveMedia = async diveId => {
  const response = await api.get(`/api/v1/dives/${diveId}/media`);
  return response.data;
};

export const deleteDiveMedia = async (diveId, mediaId) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/media/${mediaId}`);
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

export const getDiveSite = async diveSiteId => {
  const response = await api.get(`/api/v1/dive-sites/${diveSiteId}`);
  return response.data;
};

// Tags API functions
export const getAvailableTags = async () => {
  const response = await api.get('/api/v1/tags/');
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
export const getSystemOverview = async () => {
  const response = await api.get('/api/v1/admin/system/overview');
  return response.data;
};

export const getSystemHealth = async () => {
  const response = await api.get('/api/v1/admin/system/health');
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
