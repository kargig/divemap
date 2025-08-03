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
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Utility function to extract error message from API responses
export const extractErrorMessage = (error) => {
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
export const getUserPublicProfile = async (username) => {
  try {
    const response = await api.get(`/api/v1/users/${username}/public`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Dive API functions
export const createDive = async (diveData) => {
  try {
    const response = await api.post('/api/v1/dives/', diveData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDives = async (params = {}) => {
  try {
    const response = await api.get('/api/v1/dives/', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDive = async (diveId) => {
  try {
    const response = await api.get(`/api/v1/dives/${diveId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateDive = async (diveId, diveData) => {
  try {
    const response = await api.put(`/api/v1/dives/${diveId}`, diveData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteDive = async (diveId) => {
  try {
    const response = await api.delete(`/api/v1/dives/${diveId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addDiveMedia = async (diveId, mediaData) => {
  try {
    const response = await api.post(`/api/v1/dives/${diveId}/media`, mediaData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDiveMedia = async (diveId) => {
  try {
    const response = await api.get(`/api/v1/dives/${diveId}/media`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteDiveMedia = async (diveId, mediaId) => {
  try {
    const response = await api.delete(`/api/v1/dives/${diveId}/media/${mediaId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addDiveTag = async (diveId, tagData) => {
  try {
    const response = await api.post(`/api/v1/dives/${diveId}/tags`, tagData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const removeDiveTag = async (diveId, tagId) => {
  try {
    const response = await api.delete(`/api/v1/dives/${diveId}/tags/${tagId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Diving Centers API functions
export const getDivingCenters = async (params = {}) => {
  try {
    const response = await api.get('/api/v1/diving-centers/', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDivingCenter = async (divingCenterId) => {
  try {
    const response = await api.get(`/api/v1/diving-centers/${divingCenterId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
// Diving Center Ownership API functions
export const claimDivingCenterOwnership = async (divingCenterId, claimData) => {
  try {
    const response = await api.post(`/api/v1/diving-centers/${divingCenterId}/claim`, claimData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const approveDivingCenterOwnership = async (divingCenterId, approvalData) => {
  try {
    const response = await api.post(`/api/v1/diving-centers/${divingCenterId}/approve-ownership`, approvalData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getOwnershipRequests = async () => {
  try {
    const response = await api.get('/api/v1/diving-centers/ownership-requests');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Dive Sites API functions
export const getDiveSites = async (params = {}) => {
  try {
    const response = await api.get('/api/v1/dive-sites/', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDiveSite = async (diveSiteId) => {
  try {
    const response = await api.get(`/api/v1/dive-sites/${diveSiteId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Tags API functions
export const getAvailableTags = async () => {
  try {
    const response = await api.get('/api/v1/tags/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createTag = async (tagData) => {
  try {
    const response = await api.post('/api/v1/tags/', tagData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateTag = async (tagId, tagData) => {
  try {
    const response = await api.put(`/api/v1/tags/${tagId}`, tagData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteTag = async (tagId) => {
  try {
    const response = await api.delete(`/api/v1/tags/${tagId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}; 
