import api from '../api';

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
