import api from '../api';

// Diving Centers API functions
export const getDivingCenters = async (params = {}) => {
  const response = await api.get('/api/v1/diving-centers/', { params });
  // If it's the new standardized response structure { items, total, ... }, return just the items array
  // for backward compatibility with existing service consumers.
  // The DivingCenters.jsx page calls api.get directly to get pagination info.
  if (response.data && response.data.items && Array.isArray(response.data.items)) {
    return response.data.items;
  }
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

// Follow Endpoints
export const followDivingCenter = async id => {
  const response = await api.post(`/api/v1/diving-centers/${id}/follow`);
  return response.data;
};

export const unfollowDivingCenter = async id => {
  const response = await api.delete(`/api/v1/diving-centers/${id}/follow`);
  return response.data;
};

export const getFollowStatus = async id => {
  const response = await api.get(`/api/v1/diving-centers/${id}/follow-status`);
  return response.data;
};

export const broadcastTrip = async (id, tripId, extraData = {}) => {
  const response = await api.post(`/api/v1/diving-centers/${id}/broadcast`, {
    trip_id: tripId,
    ...extraData,
  });
  return response.data;
};

export const broadcastTextMessage = async (id, message) => {
  const response = await api.post(`/api/v1/diving-centers/${id}/broadcast/text`, { message });
  return response.data;
};
