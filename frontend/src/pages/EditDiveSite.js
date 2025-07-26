import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash2, Upload, X } from 'lucide-react';

const EditDiveSite = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    address: '',
    access_instructions: '',
    dive_plans: '',
    gas_tanks_necessary: '',
    difficulty_level: '',
    marine_life: '',
    safety_information: ''
  });

  const [newMedia, setNewMedia] = useState({
    url: '',
    description: '',
    media_type: 'photo'
  });

  const [isAddingMedia, setIsAddingMedia] = useState(false);

  // Check if user has edit privileges
  const canEdit = user && (user.is_admin || user.is_moderator);

  // Fetch dive site data
  const { data: diveSite, isLoading, error } = useQuery(
    ['dive-site', id],
    () => api.get(`/api/v1/dive-sites/${id}`).then(res => res.data),
    {
      enabled: !!id && canEdit,
      onSuccess: (data) => {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || '',
          address: data.address || '',
          access_instructions: data.access_instructions || '',
          dive_plans: data.dive_plans || '',
          gas_tanks_necessary: data.gas_tanks_necessary || '',
          difficulty_level: data.difficulty_level || '',
          marine_life: data.marine_life || '',
          safety_information: data.safety_information || ''
        });
      }
    }
  );

  // Fetch media
  const { data: media = [], isLoading: mediaLoading, error: mediaError } = useQuery(
    ['dive-site-media', id],
    () => api.get(`/api/v1/dive-sites/${id}/media`).then(res => {
      console.log('Media API response:', res);
      return res.data || [];
    }),
    {
      enabled: !!id && canEdit,
      onError: (error) => {
        console.error('Failed to fetch media:', error);
        toast.error('Failed to load media');
      }
    }
  );

  // Update mutation
  const updateMutation = useMutation(
    (data) => api.put(`/api/v1/dive-sites/${id}`, data),
    {
      onSuccess: async () => {
        toast.success('Dive site updated successfully');
        // Invalidate and refetch the dive site data before navigation
        await queryClient.invalidateQueries(['dive-site', id]);
        await queryClient.invalidateQueries(['admin-dive-sites']);
        // Refetch the dive site data to ensure it's updated
        await queryClient.refetchQueries(['dive-site', id]);
        navigate(`/dive-sites/${id}`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update dive site');
      }
    }
  );

  // Add media mutation
  const addMediaMutation = useMutation(
    (mediaData) => api.post(`/api/v1/dive-sites/${id}/media`, mediaData),
    {
      onSuccess: () => {
        toast.success('Media added successfully');
        queryClient.invalidateQueries(['dive-site-media', id]);
        setNewMedia({ url: '', description: '', media_type: 'photo' });
        setIsAddingMedia(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to add media');
      }
    }
  );

  // Delete media mutation
  const deleteMediaMutation = useMutation(
    (mediaId) => api.delete(`/api/v1/dive-sites/${id}/media/${mediaId}`),
    {
      onSuccess: () => {
        toast.success('Media deleted successfully');
        queryClient.invalidateQueries(['dive-site-media', id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete media');
      }
    }
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      latitude: parseFloat(formData.latitude) || null,
      longitude: parseFloat(formData.longitude) || null
    };

    updateMutation.mutate(submitData);
  };

  const handleAddMedia = (e) => {
    e.preventDefault();
    if (!newMedia.url.trim()) {
      toast.error('Please enter a media URL');
      return;
    }
    addMediaMutation.mutate(newMedia);
  };

  const handleDeleteMedia = (mediaId) => {
    if (window.confirm('Are you sure you want to delete this media?')) {
      deleteMediaMutation.mutate(mediaId);
    }
  };

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to edit dive sites.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-600">Failed to load dive site: {error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/dive-sites/${id}`)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dive Site
              </button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Dive Site</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty Level
                </label>
                <select
                  name="difficulty_level"
                  value={formData.difficulty_level}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select difficulty</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Instructions
                </label>
                <textarea
                  name="access_instructions"
                  value={formData.access_instructions}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gas Tanks Necessary
                </label>
                <input
                  type="text"
                  name="gas_tanks_necessary"
                  value={formData.gas_tanks_necessary}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dive Plans
              </label>
              <textarea
                name="dive_plans"
                value={formData.dive_plans}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marine Life
              </label>
              <textarea
                name="marine_life"
                value={formData.marine_life}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the marine life you might encounter..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Safety Information
              </label>
              <textarea
                name="safety_information"
                value={formData.safety_information}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Important safety considerations..."
              />
            </div>

            {/* Media Management */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Media</h3>
                <button
                  type="button"
                  onClick={() => setIsAddingMedia(!isAddingMedia)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Media
                </button>
              </div>

              {/* Add Media Form */}
              {isAddingMedia && (
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <form onSubmit={handleAddMedia} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Media Type
                        </label>
                        <select
                          value={newMedia.media_type}
                          onChange={(e) => setNewMedia(prev => ({ ...prev, media_type: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="photo">Photo</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          URL *
                        </label>
                        <input
                          type="url"
                          value={newMedia.url}
                          onChange={(e) => setNewMedia(prev => ({ ...prev, url: e.target.value }))}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newMedia.description}
                        onChange={(e) => setNewMedia(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={addMediaMutation.isLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {addMediaMutation.isLoading ? 'Adding...' : 'Add Media'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingMedia(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Media List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaLoading && (
                  <div className="col-span-full text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading media...</p>
                  </div>
                )}
                {mediaError && (
                  <div className="col-span-full text-center py-4">
                    <p className="text-red-600">Failed to load media</p>
                  </div>
                )}
                {!mediaLoading && !mediaError && Array.isArray(media) && media.length === 0 && (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-500">No media added yet.</p>
                  </div>
                )}
                {!mediaLoading && !mediaError && Array.isArray(media) && media.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {item.media_type}
                      </span>
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete media"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm break-all"
                      >
                        {item.url}
                      </a>
                      {item.description && (
                        <p className="text-sm text-gray-600">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate(`/dive-sites/${id}`)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isLoading}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditDiveSite; 