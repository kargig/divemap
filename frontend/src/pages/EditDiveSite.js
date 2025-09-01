import { ArrowLeft, Save, Trash2, Upload, X, Tag, Building, Plus, Edit } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { getCurrencyOptions, DEFAULT_CURRENCY, formatCost } from '../utils/currency';
import { getDifficultyValue } from '../utils/difficultyHelpers';

// Helper function to safely extract error message
const getErrorMessage = error => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

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
    country: '',
    region: '',
    access_instructions: '',
    difficulty_level: '',
    marine_life: '',
    safety_information: '',
    max_depth: '',
  });

  const [newMedia, setNewMedia] = useState({
    url: '',
    description: '',
    media_type: 'photo',
  });

  const [isAddingMedia, setIsAddingMedia] = useState(false);

  // Tag management state
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);

  // Diving center management state
  const [newDivingCenterId, setNewDivingCenterId] = useState('');
  const [newDiveCost, setNewDiveCost] = useState('');
  const [newDiveCurrency, setNewDiveCurrency] = useState(DEFAULT_CURRENCY);
  const [showDivingCenterForm, setShowDivingCenterForm] = useState(false);

  // Aliases management state
  const [newAlias, setNewAlias] = useState({ alias: '', language: '' });
  const [editingAlias, setEditingAlias] = useState(null);
  const [showAliasForm, setShowAliasForm] = useState(false);

  // Check if user has edit privileges
  const canEdit = user && (user.is_admin || user.is_moderator);

  // Fetch dive site data
  const {
    data: diveSite,
    isLoading,
    error,
  } = useQuery(['dive-site', id], () => api.get(`/api/v1/dive-sites/${id}`).then(res => res.data), {
    enabled: !!id && canEdit,
    onSuccess: data => {
      setFormData({
        name: data.name || '',
        description: data.description || '',
        latitude: data.latitude?.toString() || '',
        longitude: data.longitude?.toString() || '',
        address: data.address || '',
        country: data.country || '',
        region: data.region || '',
        access_instructions: data.access_instructions || '',

        difficulty_level: data.difficulty_level || '',
        marine_life: data.marine_life || '',
        safety_information: data.safety_information || '',
        max_depth: data.max_depth?.toString() || '',
      });
      // Set selected tags
      if (data.tags) {
        setSelectedTags(data.tags.map(tag => tag.id));
      }
    },
  });

  // Fetch all available tags
  const { data: availableTags = [] } = useQuery(
    ['available-tags'],
    () => api.get('/api/v1/tags/').then(res => res.data),
    {
      enabled: canEdit,
    }
  );

  // Fetch all diving centers
  const { data: allDivingCenters = [], error: _allDivingCentersError } = useQuery(
    ['all-diving-centers'],
    () => api.get('/api/v1/diving-centers/').then(res => res.data || []),
    {
      enabled: canEdit,
      onError: error => {
        console.error('Failed to fetch diving centers:', error);
        toast.error('Failed to load diving centers');
      },
    }
  );

  // Fetch associated diving centers
  const { data: associatedDivingCenters = [], error: _associatedDivingCentersError } = useQuery(
    ['dive-site-diving-centers', id],
    () => api.get(`/api/v1/dive-sites/${id}/diving-centers`).then(res => res.data || []),
    {
      enabled: !!id && canEdit,
      onError: error => {
        console.error('Failed to fetch diving centers:', error);
        toast.error('Failed to load diving centers');
      },
    }
  );

  // Fetch aliases
  const { data: aliases = [], error: _aliasesError } = useQuery(
    ['dive-site-aliases', id],
    () => api.get(`/api/v1/dive-sites/${id}/aliases`).then(res => res.data || []),
    {
      enabled: !!id && canEdit,
      onError: error => {
        console.error('Failed to fetch aliases:', error);
        toast.error('Failed to load aliases');
      },
    }
  );

  // Fetch media
  const {
    data: media = [],
    isLoading: mediaLoading,
    error: mediaError,
  } = useQuery(
    ['dive-site-media', id],
    () =>
      api.get(`/api/v1/dive-sites/${id}/media`).then(res => {
        return res.data || [];
      }),
    {
      enabled: !!id && canEdit,
      onError: _error => {
        toast.error('Failed to load media');
      },
    }
  );

  // Tag mutations
  const createTagMutation = useMutation(tagData => api.post('/api/v1/tags/', tagData), {
    onSuccess: newTag => {
      queryClient.invalidateQueries(['available-tags']);
      setSelectedTags(prev => [...prev, newTag.id]);
      setNewTagName('');
      setNewTagDescription('');
      setShowTagForm(false);
      toast.success('Tag created and selected successfully');
    },
    onError: error => {
      toast.error(getErrorMessage(error));
    },
  });

  // Diving center mutations
  const addDivingCenterMutation = useMutation(
    centerData => api.post(`/api/v1/dive-sites/${id}/diving-centers`, centerData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-diving-centers', id]);
        setNewDivingCenterId('');
        setNewDiveCost('');
        setNewDiveCurrency(DEFAULT_CURRENCY);
        setShowDivingCenterForm(false);
        toast.success('Diving center added successfully');
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  const removeDivingCenterMutation = useMutation(
    centerId => api.delete(`/api/v1/dive-sites/${id}/diving-centers/${centerId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-diving-centers', id]);
        toast.success('Diving center removed successfully');
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  // Aliases mutations
  const addAliasMutation = useMutation(
    aliasData => api.post(`/api/v1/dive-sites/${id}/aliases`, aliasData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-aliases', id]);
        setNewAlias({ alias: '', language: '' });
        setShowAliasForm(false);
        toast.success('Alias added successfully');
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  const updateAliasMutation = useMutation(
    ({ aliasId, aliasData }) => api.put(`/api/v1/dive-sites/${id}/aliases/${aliasId}`, aliasData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-aliases', id]);
        setEditingAlias(null);
        toast.success('Alias updated successfully');
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  const deleteAliasMutation = useMutation(
    aliasId => api.delete(`/api/v1/dive-sites/${id}/aliases/${aliasId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-aliases', id]);
        toast.success('Alias deleted successfully');
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  // Update mutation
  const updateMutation = useMutation(data => api.put(`/api/v1/dive-sites/${id}`, data), {
    onError: error => {
      toast.error(getErrorMessage(error));
    },
  });

  // Add media mutation
  const addMediaMutation = useMutation(
    mediaData => api.post(`/api/v1/dive-sites/${id}/media`, mediaData),
    {
      onSuccess: () => {
        toast.success('Media added successfully');
        queryClient.invalidateQueries(['dive-site-media', id]);
        setNewMedia({ url: '', description: '', media_type: 'photo' });
        setIsAddingMedia(false);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to add media');
      },
    }
  );

  // Delete media mutation
  const deleteMediaMutation = useMutation(
    mediaId => api.delete(`/api/v1/dive-sites/${id}/media/${mediaId}`),
    {
      onSuccess: () => {
        toast.success('Media deleted successfully');
        queryClient.invalidateQueries(['dive-site-media', id]);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to delete media');
      },
    }
  );

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Aliases handlers
  const handleAddAlias = e => {
    e.preventDefault();
    if (!newAlias.alias.trim()) {
      toast.error('Alias name is required');
      return;
    }
    addAliasMutation.mutate(newAlias);
  };

  const handleUpdateAlias = e => {
    e.preventDefault();
    if (!editingAlias.alias.trim()) {
      toast.error('Alias name is required');
      return;
    }
    updateAliasMutation.mutate({ aliasId: editingAlias.id, aliasData: editingAlias });
  };

  const handleDeleteAlias = alias => {
    if (window.confirm(`Are you sure you want to delete the alias "${alias.alias}"?`)) {
      deleteAliasMutation.mutate(alias.id);
    }
  };

  const handleEditAlias = alias => {
    setEditingAlias({
      id: alias.id,
      alias: alias.alias,
      language: alias.language || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingAlias(null);
  };

  const suggestLocation = async () => {
    if (!formData.latitude || !formData.longitude) {
      toast.error('Please enter latitude and longitude first');
      return;
    }

    try {
      const response = await api.get('/api/v1/dive-sites/reverse-geocode', {
        params: {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        },
        timeout: 30000, // 30 second timeout
      });

      const { country, region } = response.data;

      setFormData(prev => ({
        ...prev,
        country: country || '',
        region: region || '',
      }));

      if (country || region) {
        toast.success('Location suggestions applied!');
      } else {
        toast.info('No location data found for these coordinates');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      console.error('Error response:', error.response);

      let errorMessage = 'Failed to get location suggestions';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();

    // Prepare the update data
    const updateData = {
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };

    // Ensure latitude and longitude are not empty
    if (!formData.latitude || formData.latitude.trim() === '') {
      toast.error('Latitude is required');
      return;
    }
    if (!formData.longitude || formData.longitude.trim() === '') {
      toast.error('Longitude is required');
      return;
    }

    // Convert max_depth to number if provided, or set to null if empty
    if (formData.max_depth && formData.max_depth.trim() !== '') {
      updateData.max_depth = parseFloat(formData.max_depth);
    } else {
      updateData.max_depth = null;
    }

    // Convert difficulty_level to integer if provided, or set to null if empty
    if (formData.difficulty_level && formData.difficulty_level.trim() !== '') {
      updateData.difficulty_level = getDifficultyValue(formData.difficulty_level);
    } else {
      updateData.difficulty_level = null;
    }

    // Update the dive site first
    updateMutation.mutate(updateData, {
      onSuccess: async updatedDiveSite => {
        // Handle tag changes
        const currentTagIds = diveSite?.tags?.map(tag => tag.id) || [];
        const newTagIds = selectedTags;

        // Add new tags
        for (const tagId of newTagIds) {
          if (!currentTagIds.includes(tagId)) {
            try {
              await api.post(`/api/v1/tags/dive-sites/${id}/tags`, { tag_id: tagId });
            } catch (error) {
              console.error('Failed to add tag:', error);
            }
          }
        }

        // Remove tags that are no longer selected
        for (const tagId of currentTagIds) {
          if (!newTagIds.includes(tagId)) {
            try {
              await api.delete(`/api/v1/tags/dive-sites/${id}/tags/${tagId}`);
            } catch (error) {
              console.error('Failed to remove tag:', error);
            }
          }
        }

        // Update the cache with the new data immediately
        queryClient.setQueryData(['dive-site', id], updatedDiveSite);

        // Invalidate related queries
        await queryClient.invalidateQueries(['admin-dive-sites']);
        await queryClient.invalidateQueries(['dive-sites']);
        await queryClient.invalidateQueries(['available-tags']);

        // Wait a moment for cache updates to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Show success message
        toast.success('Dive site updated successfully');

        // Navigate to the dive site detail page
        navigate(`/dive-sites/${id}`);
      },
    });
  };

  const handleAddMedia = e => {
    e.preventDefault();
    if (!newMedia.url.trim()) {
      toast.error('Please enter a media URL');
      return;
    }
    addMediaMutation.mutate(newMedia);
  };

  const handleDeleteMedia = mediaId => {
    if (window.confirm('Are you sure you want to delete this media?')) {
      deleteMediaMutation.mutate(mediaId);
    }
  };

  if (!canEdit) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-gray-900 mb-4'>Access Denied</h1>
            <p className='text-gray-600'>You don&apos;t have permission to edit dive sites.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='animate-pulse'>
              <div className='h-8 bg-gray-200 rounded w-1/4 mb-4'></div>
              <div className='space-y-3'>
                <div className='h-4 bg-gray-200 rounded'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
                <div className='h-4 bg-gray-200 rounded w-4/6'></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
            <p className='text-gray-600'>Failed to load dive site: {getErrorMessage(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-4xl mx-auto px-4'>
        <div className='bg-white rounded-lg shadow-md p-6'>
          {/* Header */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center space-x-4'>
              <button
                onClick={() => navigate(`/dive-sites/${id}`)}
                className='flex items-center text-gray-600 hover:text-gray-900'
              >
                <ArrowLeft className='w-5 h-5 mr-2' />
                Back to Dive Site
              </button>
            </div>
            <h1 className='text-3xl font-bold text-gray-900'>Edit Dive Site</h1>
          </div>

          {/* Main Dive Site Form */}
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Basic Information */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label
                  htmlFor='dive-site-name'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Name *
                </label>
                <input
                  id='dive-site-name'
                  type='text'
                  name='name'
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label
                  htmlFor='difficulty-level'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Difficulty Level
                </label>
                <select
                  id='difficulty-level'
                  name='difficulty_level'
                  value={formData.difficulty_level}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Select difficulty</option>
                  <option value='beginner'>Beginner</option>
                  <option value='intermediate'>Intermediate</option>
                  <option value='advanced'>Advanced</option>
                  <option value='expert'>Expert</option>
                </select>
              </div>
            </div>

            {/* Add Alias Section */}
            <div className='border-t pt-6 mb-6'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-gray-900'>Aliases</h3>
                <button
                  type='button'
                  onClick={() => setShowAliasForm(!showAliasForm)}
                  className='flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700'
                >
                  <Plus className='w-4 h-4 mr-2' />
                  Add Alias
                </button>
              </div>

              {/* Add Alias Form */}
              {showAliasForm && (
                <div className='bg-gray-50 p-4 rounded-md mb-4'>
                  <div className='space-y-4'>
                    <div>
                      <label
                        htmlFor='new_alias_name'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Alias Name *
                      </label>
                      <input
                        id='new_alias_name'
                        type='text'
                        value={newAlias.alias}
                        onChange={e => setNewAlias({ ...newAlias, alias: e.target.value })}
                        required
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      />
                    </div>
                    <div className='flex space-x-2'>
                      <button
                        type='button'
                        onClick={handleAddAlias}
                        disabled={addAliasMutation.isLoading}
                        className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                      >
                        {addAliasMutation.isLoading ? 'Adding...' : 'Add Alias'}
                      </button>
                      <button
                        type='button'
                        onClick={() => setShowAliasForm(false)}
                        className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Aliases List */}
              <div className='space-y-2'>
                {Array.isArray(aliases) && aliases.length > 0 ? (
                  aliases.map(alias => (
                    <div
                      key={alias.id}
                      className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
                    >
                      {editingAlias?.id === alias.id ? (
                        <div className='flex-1 flex items-center space-x-2'>
                          <input
                            type='text'
                            value={editingAlias.alias}
                            onChange={e =>
                              setEditingAlias({ ...editingAlias, alias: e.target.value })
                            }
                            className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          />
                          <button
                            type='button'
                            onClick={handleUpdateAlias}
                            disabled={updateAliasMutation.isLoading}
                            className='text-green-600 hover:text-green-800 disabled:opacity-50'
                            title='Save changes'
                          >
                            <Save className='w-4 h-4' />
                          </button>
                          <button
                            type='button'
                            onClick={handleCancelEdit}
                            className='text-gray-600 hover:text-gray-800'
                            title='Cancel edit'
                          >
                            <X className='w-4 h-4' />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className='flex items-center space-x-2'>
                            <span className='font-medium'>{alias.alias}</span>
                          </div>
                          <div className='flex space-x-2'>
                            <button
                              onClick={() => handleEditAlias(alias)}
                              className='text-blue-600 hover:text-blue-800'
                              title='Edit alias'
                            >
                              <Edit className='w-4 h-4' />
                            </button>
                            <button
                              onClick={() => handleDeleteAlias(alias)}
                              className='text-red-600 hover:text-red-800'
                              title='Delete alias'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <p className='text-gray-500 text-sm'>No aliases found for this dive site.</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor='dive-site-description'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Description *
              </label>
              <textarea
                id='dive-site-description'
                name='description'
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* Location */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div>
                <label htmlFor='latitude' className='block text-sm font-medium text-gray-700 mb-2'>
                  Latitude *
                </label>
                <input
                  id='latitude'
                  type='number'
                  step='any'
                  name='latitude'
                  value={formData.latitude}
                  onChange={handleInputChange}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label htmlFor='longitude' className='block text-sm font-medium text-gray-700 mb-2'>
                  Longitude *
                </label>
                <input
                  id='longitude'
                  type='number'
                  step='any'
                  name='longitude'
                  value={formData.longitude}
                  onChange={handleInputChange}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label htmlFor='address' className='block text-sm font-medium text-gray-700 mb-2'>
                  Address
                </label>
                <input
                  id='address'
                  type='text'
                  name='address'
                  value={formData.address}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            {/* Country and Region Information */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label htmlFor='country' className='block text-sm font-medium text-gray-700 mb-2'>
                  Country
                </label>
                <input
                  id='country'
                  type='text'
                  name='country'
                  value={formData.country}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., Australia'
                />
              </div>

              <div>
                <label htmlFor='region' className='block text-sm font-medium text-gray-700 mb-2'>
                  Region
                </label>
                <input
                  id='region'
                  type='text'
                  name='region'
                  value={formData.region}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., Queensland'
                />
              </div>
            </div>

            {/* Location Suggestion Button */}
            <div className='flex justify-center'>
              <button
                type='button'
                onClick={suggestLocation}
                disabled={!formData.latitude || !formData.longitude}
                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                🗺️ Suggest Country & Region from Coordinates
              </button>
            </div>

            {/* Additional Information */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'></div>

            <div>
              <label htmlFor='max_depth' className='block text-sm font-medium text-gray-700 mb-2'>
                Maximum Depth (meters)
              </label>
              <input
                id='max_depth'
                type='number'
                min='0'
                max='1000'
                step='any'
                name='max_depth'
                value={formData.max_depth}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., 25.5'
              />
            </div>

            <div>
              <label
                htmlFor='access_instructions'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Access Instructions
              </label>
              <textarea
                id='access_instructions'
                name='access_instructions'
                value={formData.access_instructions}
                onChange={handleInputChange}
                rows={3}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <div>
              <label htmlFor='marine_life' className='block text-sm font-medium text-gray-700 mb-2'>
                Marine Life
              </label>
              <textarea
                id='marine_life'
                name='marine_life'
                value={formData.marine_life}
                onChange={handleInputChange}
                rows={3}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='Describe the marine life you might encounter...'
              />
            </div>

            <div>
              <label
                htmlFor='safety_information'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Safety Information
              </label>
              <textarea
                id='safety_information'
                name='safety_information'
                value={formData.safety_information}
                onChange={handleInputChange}
                rows={3}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='Important safety considerations...'
              />
            </div>

            {/* Media Management */}
            <div className='border-t pt-6'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-gray-900'>Media</h3>
                <button
                  type='button'
                  onClick={() => setIsAddingMedia(!isAddingMedia)}
                  className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                >
                  <Upload className='w-4 h-4 mr-2' />
                  Add Media
                </button>
              </div>

              {/* Add Media Form */}
              {isAddingMedia && (
                <div className='bg-gray-50 p-4 rounded-md mb-4'>
                  <div className='space-y-4'>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                      <div>
                        <label
                          htmlFor='media_type'
                          className='block text-sm font-medium text-gray-700 mb-1'
                        >
                          Media Type
                        </label>
                        <select
                          id='media_type'
                          value={newMedia.media_type}
                          onChange={e =>
                            setNewMedia(prev => ({ ...prev, media_type: e.target.value }))
                          }
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          <option value='photo'>Photo</option>
                          <option value='video'>Video</option>
                        </select>
                      </div>
                      <div className='md:col-span-2'>
                        <label
                          htmlFor='media_url'
                          className='block text-sm font-medium text-gray-700 mb-1'
                        >
                          URL *
                        </label>
                        <input
                          id='media_url'
                          type='url'
                          value={newMedia.url}
                          onChange={e => setNewMedia(prev => ({ ...prev, url: e.target.value }))}
                          required
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          placeholder='https://example.com/image.jpg'
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor='media_description'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Description
                      </label>
                      <input
                        id='media_description'
                        type='text'
                        value={newMedia.description}
                        onChange={e =>
                          setNewMedia(prev => ({ ...prev, description: e.target.value }))
                        }
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      />
                    </div>
                    <div className='flex space-x-2'>
                      <button
                        type='button'
                        onClick={handleAddMedia}
                        disabled={addMediaMutation.isLoading}
                        className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                      >
                        {addMediaMutation.isLoading ? 'Adding...' : 'Add Media'}
                      </button>
                      <button
                        type='button'
                        onClick={() => setIsAddingMedia(false)}
                        className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Media List */}
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {mediaLoading && (
                  <div className='col-span-full text-center py-4'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                    <p className='text-gray-600 mt-2'>Loading media...</p>
                  </div>
                )}
                {mediaError && (
                  <div className='col-span-full text-center py-4'>
                    <p className='text-red-600'>Failed to load media</p>
                  </div>
                )}
                {!mediaLoading && !mediaError && Array.isArray(media) && media.length === 0 && (
                  <div className='col-span-full text-center py-4'>
                    <p className='text-gray-500'>No media added yet.</p>
                  </div>
                )}
                {!mediaLoading &&
                  !mediaError &&
                  Array.isArray(media) &&
                  media.map(item => (
                    <div key={item.id} className='border rounded-lg p-4'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-sm font-medium text-gray-700 capitalize'>
                          {item.media_type}
                        </span>
                        <button
                          onClick={() => handleDeleteMedia(item.id)}
                          className='text-red-600 hover:text-red-800'
                          title='Delete media'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                      <div className='space-y-2'>
                        <a
                          href={item.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:text-blue-800 text-sm break-all'
                        >
                          {item.url}
                        </a>
                        {item.description && (
                          <p className='text-sm text-gray-600'>{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Tags Management */}
            <div className='border-t pt-6'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-gray-900'>Tags</h3>
                <button
                  type='button'
                  onClick={() => setShowTagForm(!showTagForm)}
                  className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                >
                  <Tag className='w-4 h-4 mr-2' />
                  Add Tag
                </button>
              </div>

              {/* Add Tag Form */}
              {showTagForm && (
                <div className='bg-gray-50 p-4 rounded-md mb-4'>
                  <div className='space-y-4'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div>
                        <label
                          htmlFor='new_tag_name'
                          className='block text-sm font-medium text-gray-700 mb-1'
                        >
                          Tag Name *
                        </label>
                        <input
                          id='new_tag_name'
                          type='text'
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          required
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='new_tag_description'
                          className='block text-sm font-medium text-gray-700 mb-1'
                        >
                          Description
                        </label>
                        <input
                          id='new_tag_description'
                          type='text'
                          value={newTagDescription}
                          onChange={e => setNewTagDescription(e.target.value)}
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                      </div>
                    </div>
                    <div className='flex space-x-2'>
                      <button
                        type='button'
                        onClick={() => {
                          createTagMutation.mutate({
                            name: newTagName,
                            description: newTagDescription,
                          });
                        }}
                        disabled={createTagMutation.isLoading}
                        className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                      >
                        {createTagMutation.isLoading ? 'Adding...' : 'Add Tag'}
                      </button>
                      <button
                        type='button'
                        onClick={() => setShowTagForm(false)}
                        className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700'
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Available Tags */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <h4 className='text-md font-semibold text-gray-800'>Select Tags</h4>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                  {Array.isArray(availableTags) &&
                    availableTags.map(tag => (
                      <label key={tag.id} className='flex items-center space-x-2 cursor-pointer'>
                        <input
                          type='checkbox'
                          checked={selectedTags.includes(tag.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedTags(prev => [...prev, tag.id]);
                            } else {
                              setSelectedTags(prev => prev.filter(id => id !== tag.id));
                            }
                          }}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        />
                        <span className='text-sm font-medium text-gray-700'>{tag.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Selected Tags Summary */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <h4 className='text-md font-semibold text-gray-800'>
                  Selected Tags ({selectedTags.length})
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                  {selectedTags.length > 0 ? (
                    selectedTags.map(tagId => {
                      const tag = availableTags.find(t => t.id === tagId);
                      return tag ? (
                        <span
                          key={tagId}
                          className='px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium'
                        >
                          {tag.name}
                        </span>
                      ) : null;
                    })
                  ) : (
                    <p className='text-gray-500 text-sm'>No tags selected</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className='flex justify-end space-x-4 pt-6 border-t'>
              <button
                type='button'
                onClick={() => navigate(`/dive-sites/${id}`)}
                className='px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={updateMutation.isLoading}
                className='flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
              >
                <Save className='w-4 h-4 mr-2' />
                {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Diving Centers Management - Outside Main Form */}
          <div className='border-t pt-6 mt-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>Diving Centers</h3>
              <button
                type='button'
                onClick={() => setShowDivingCenterForm(!showDivingCenterForm)}
                className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
              >
                <Building className='w-4 h-4 mr-2' />
                Add Diving Center
              </button>
            </div>

            {/* Add Diving Center Form */}
            {showDivingCenterForm && (
              <div className='bg-gray-50 p-4 rounded-md mb-4'>
                <div className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <div>
                      <label
                        htmlFor='diving_center_id'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Diving Center *
                      </label>
                      <select
                        id='diving_center_id'
                        value={newDivingCenterId}
                        onChange={e => setNewDivingCenterId(e.target.value)}
                        required
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        <option value=''>Select a diving center</option>
                        {Array.isArray(allDivingCenters) &&
                          allDivingCenters
                            .filter(
                              center =>
                                !Array.isArray(associatedDivingCenters) ||
                                !associatedDivingCenters.some(
                                  associated => associated.id === center.id
                                )
                            )
                            .map(center => (
                              <option key={center.id} value={center.id}>
                                {center.name}
                              </option>
                            ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor='new_dive_cost'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Dive Cost
                      </label>
                      <input
                        id='new_dive_cost'
                        type='number'
                        value={newDiveCost}
                        onChange={e => setNewDiveCost(e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      />
                    </div>
                    <div>
                      <label
                        htmlFor='new_dive_currency'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Currency
                      </label>
                      <select
                        id='new_dive_currency'
                        value={newDiveCurrency}
                        onChange={e => setNewDiveCurrency(e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        {getCurrencyOptions().map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className='flex space-x-2'>
                    <button
                      type='button'
                      onClick={() => {
                        if (!newDivingCenterId) {
                          toast.error('Please select a diving center');
                          return;
                        }
                        addDivingCenterMutation.mutate({
                          diving_center_id: parseInt(newDivingCenterId),
                          dive_cost: newDiveCost ? parseFloat(newDiveCost) : null,
                          currency: newDiveCurrency,
                        });
                      }}
                      disabled={addDivingCenterMutation.isLoading}
                      className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                    >
                      {addDivingCenterMutation.isLoading ? 'Adding...' : 'Add Diving Center'}
                    </button>
                    <button
                      type='button'
                      onClick={() => setShowDivingCenterForm(false)}
                      className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Associated Diving Centers */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <h4 className='text-md font-semibold text-gray-800'>Associated Diving Centers</h4>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                {Array.isArray(associatedDivingCenters) &&
                  associatedDivingCenters.map(center => (
                    <span
                      key={center.id}
                      className='px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium flex items-center justify-between'
                    >
                      {center.name}
                      {center.dive_cost &&
                        ` (${formatCost(center.dive_cost, center.currency || DEFAULT_CURRENCY)})`}
                      <button
                        onClick={() => removeDivingCenterMutation.mutate(center.id)}
                        className='ml-2 text-purple-600 hover:text-purple-800'
                        title='Remove diving center'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </span>
                  ))}
                {(!Array.isArray(associatedDivingCenters) ||
                  associatedDivingCenters.length === 0) && (
                  <p className='text-gray-500 text-sm'>No diving centers associated</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditDiveSite;
