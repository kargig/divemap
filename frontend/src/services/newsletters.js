import api from '../api';

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
