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

// User search API function for buddy selection and filtering
export const searchUsers = async (query, limit = 25, includeSelf = false) => {
  const response = await api.get('/api/v1/users/search', {
    params: { query, limit, include_self: includeSelf },
  });
  return response.data;
};

// Chat API
export const sendChatMessage = async (message, history = [], context = {}) => {
  try {
    const response = await api.post('/api/v1/chat/message', {
      message,
      history,
      ...context,
    });
    return response.data;
  } catch (error) {
    throw extractErrorMessage(error);
  }
};

export const submitChatFeedback = async (
  message_id,
  rating,
  category = null,
  comments = null,
  query = null,
  response = null,
  debug_data = null
) => {
  try {
    const apiResponse = await api.post('/api/v1/chat/feedback', {
      message_id,
      rating,
      category,
      comments,
      query,
      response,
      debug_data,
    });
    return apiResponse.data;
  } catch (error) {
    throw extractErrorMessage(error);
  }
};

// Admin Chat Feedback APIs
export const getAdminChatFeedback = async (params = {}) => {
  const response = await api.get('/api/v1/admin/chat/feedback', { params });
  return response.data;
};

export const getAdminChatFeedbackStats = async () => {
  const response = await api.get('/api/v1/admin/chat/feedback/stats');
  return response.data;
};

export const getAdminChatFeedbackDetail = async id => {
  const response = await api.get(`/api/v1/admin/chat/feedback/${id}`);
  return response.data;
};

export const getAdminChatSessions = async (params = {}) => {
  // params can include: username, limit, offset
  const response = await api.get('/api/v1/admin/chat/sessions', { params });
  return response.data;
};

export const getAdminChatSessionDetail = async sessionId => {
  const response = await api.get(`/api/v1/admin/chat/sessions/${sessionId}`);
  return response.data;
};

export const deleteAdminChatSession = async sessionId => {
  const response = await api.delete(`/api/v1/admin/chat/sessions/${sessionId}`);
  return response.data;
};

export const deleteAdminChatFeedback = async feedbackId => {
  const response = await api.delete(`/api/v1/admin/chat/feedback/${feedbackId}`);
  return response.data;
};

// User Chat APIs
export const getChatRooms = async () => {
  const response = await api.get('/api/v1/user-chat/rooms');
  return response.data;
};

export const getTotalUnreadChatMessages = async () => {
  const response = await api.get('/api/v1/user-chat/unread-count');
  return response.data;
};

export const createChatRoom = async (participantIds, isGroup = false, name = null) => {
  const payload = {
    participant_ids: participantIds,
    is_group: isGroup,
  };
  if (name) {
    payload.name = name;
  }
  const response = await api.post('/api/v1/user-chat/rooms', payload);
  return response.data;
};

export const getChatMessages = async (roomId, afterUpdatedAt = null) => {
  const params = {};
  if (afterUpdatedAt) {
    params.after_updated_at = afterUpdatedAt;
  }
  const response = await api.get(`/api/v1/user-chat/rooms/${roomId}/messages`, { params });
  return response.data;
};

export const sendUserChatMessage = async (roomId, content) => {
  const response = await api.post(`/api/v1/user-chat/rooms/${roomId}/messages`, {
    content,
  });
  return response.data;
};

export const editUserChatMessage = async (messageId, content) => {
  const response = await api.put(`/api/v1/user-chat/messages/${messageId}`, {
    content,
  });
  return response.data;
};

export const markChatRoomRead = async roomId => {
  const response = await api.put(`/api/v1/user-chat/rooms/${roomId}/read`);
  return response.data;
};

// User Friendships (Mutual Buddy) APIs
export const getUserFriendships = async (statusFilter = 'ACCEPTED') => {
  const response = await api.get('/api/v1/user-friendships', {
    params: { status_filter: statusFilter },
  });
  return response.data;
};

export const sendFriendRequest = async friendId => {
  const response = await api.post('/api/v1/user-friendships/requests', {
    friend_id: friendId,
  });
  return response.data;
};

export const acceptFriendRequest = async friendshipId => {
  const response = await api.put(`/api/v1/user-friendships/requests/${friendshipId}/accept`);
  return response.data;
};

export const rejectFriendRequest = async friendshipId => {
  const response = await api.put(`/api/v1/user-friendships/requests/${friendshipId}/reject`);
  return response.data;
};

export const removeFriendship = async friendshipId => {
  const response = await api.delete(`/api/v1/user-friendships/${friendshipId}`);
  return response.data;
};
