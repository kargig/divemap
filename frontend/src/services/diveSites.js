import api from '../api';

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

export const getDiveSite = async diveSiteId => {
  const response = await api.get(`/api/v1/dive-sites/${diveSiteId}`);
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

// Dive Routes API functions
export const getDiveRoutes = async (params = {}) => {
  const response = await api.get('/api/v1/dive-routes/', { params });
  return response.data;
};
