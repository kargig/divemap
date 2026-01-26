import api from '../api';

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

export const updateDiveMedia = async (diveId, mediaId, description = null, isPublic = null) => {
  const data = {};
  if (description !== null) data.description = description;
  if (isPublic !== null) data.is_public = isPublic;
  const response = await api.patch(`/api/v1/dives/${diveId}/media/${mediaId}`, data);
  return response.data;
};

export const uploadDiveProfile = async (diveId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/v1/dives/${diveId}/profile`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadDivePhoto = async (diveId, file, description = '', isPublic = true) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', description);
  formData.append('is_public', isPublic);
  const response = await api.post(`/api/v1/dives/${diveId}/media/upload-photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Upload photo to R2 only (without creating database record)
// Returns: { r2_path: string, url: string } - the R2 path and presigned URL for preview
export const uploadPhotoToR2Only = async (diveId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/v1/dives/${diveId}/media/upload-photo-r2-only`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Delete photo from R2 only (without deleting database record)
export const deletePhotoFromR2 = async (diveId, r2Path) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/media/delete-r2-photo`, {
    data: { r2_path: r2Path },
  });
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

export const getFlickrOembed = async flickrUrl => {
  const response = await api.get('/api/v1/dives/media/flickr-oembed', {
    params: { url: flickrUrl },
  });
  return response.data;
};

// Remove buddy from dive
export const removeBuddy = async (diveId, userId) => {
  const response = await api.delete(`/api/v1/dives/${diveId}/buddies/${userId}`);
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
