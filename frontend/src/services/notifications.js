import api from '../api';

/**
 * Notifications Service
 * Handles all notification-related API calls
 */

// User Notifications
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

// User Notification Preferences
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

// Admin Notification Functions
export const getNotificationStats = async () => {
  const response = await api.get('/api/v1/notifications/admin/stats');
  return response.data;
};

export const getNotificationAnalytics = async () => {
  const response = await api.get('/api/v1/admin/system/notifications/analytics');
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

// Admin User Notification Preferences
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
