import api from '../api';

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
