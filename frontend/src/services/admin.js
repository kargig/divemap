import api from '../api';

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
