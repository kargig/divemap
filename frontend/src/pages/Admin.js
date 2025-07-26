import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Eye, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dive-sites');
  const [showDiveSiteForm, setShowDiveSiteForm] = useState(false);
  const [editingDiveSite, setEditingDiveSite] = useState(null);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [selectedDiveSite, setSelectedDiveSite] = useState(null);

  // Form states
  const [diveSiteForm, setDiveSiteForm] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    address: '',
    access_instructions: '',
    dive_plans: '',
    gas_tanks_necessary: '',
    difficulty_level: 'intermediate',
    marine_life: '',
    safety_information: ''
  });

  const [mediaForm, setMediaForm] = useState({
    media_type: 'photo',
    url: '',
    description: ''
  });

  // Fetch data
  const { data: diveSites } = useQuery(
    ['admin-dive-sites'],
    () => api.get('/api/v1/dive-sites'),
    {
      select: (response) => response.data,
      enabled: activeTab === 'dive-sites'
    }
  );

  const { data: divingCenters } = useQuery(
    ['admin-diving-centers'],
    () => api.get('/api/v1/diving-centers'),
    {
      select: (response) => response.data,
      enabled: activeTab === 'diving-centers'
    }
  );

  // Mutations
  const createDiveSiteMutation = useMutation(
    (data) => api.post('/api/v1/dive-sites', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        toast.success('Dive site created successfully!');
        setShowDiveSiteForm(false);
        resetDiveSiteForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to create dive site');
      },
    }
  );

  const updateDiveSiteMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/dive-sites/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        toast.success('Dive site updated successfully!');
        setShowDiveSiteForm(false);
        setEditingDiveSite(null);
        resetDiveSiteForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update dive site');
      },
    }
  );

  const deleteDiveSiteMutation = useMutation(
    (id) => api.delete(`/api/v1/dive-sites/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        toast.success('Dive site deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete dive site');
      },
    }
  );

  const addMediaMutation = useMutation(
    ({ diveSiteId, data }) => api.post(`/api/v1/dive-sites/${diveSiteId}/media`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        toast.success('Media added successfully!');
        setShowMediaForm(false);
        setSelectedDiveSite(null);
        resetMediaForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to add media');
      },
    }
  );

  const deleteMediaMutation = useMutation(
    ({ diveSiteId, mediaId }) => api.delete(`/api/v1/dive-sites/${diveSiteId}/media/${mediaId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        toast.success('Media deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete media');
      },
    }
  );

  // Helper functions
  const resetDiveSiteForm = () => {
    setDiveSiteForm({
      name: '',
      description: '',
      latitude: '',
      longitude: '',
      address: '',
      access_instructions: '',
      dive_plans: '',
      gas_tanks_necessary: '',
      difficulty_level: 'intermediate',
      marine_life: '',
      safety_information: ''
    });
  };

  const resetMediaForm = () => {
    setMediaForm({
      media_type: 'photo',
      url: '',
      description: ''
    });
  };

  const handleDiveSiteSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...diveSiteForm,
      latitude: diveSiteForm.latitude ? parseFloat(diveSiteForm.latitude) : null,
      longitude: diveSiteForm.longitude ? parseFloat(diveSiteForm.longitude) : null
    };

    if (editingDiveSite) {
      updateDiveSiteMutation.mutate({ id: editingDiveSite.id, data });
    } else {
      createDiveSiteMutation.mutate(data);
    }
  };

  const handleMediaSubmit = (e) => {
    e.preventDefault();
    addMediaMutation.mutate({ diveSiteId: selectedDiveSite.id, data: mediaForm });
  };

  const handleEditDiveSite = (diveSite) => {
    setEditingDiveSite(diveSite);
    setDiveSiteForm({
      name: diveSite.name,
      description: diveSite.description || '',
      latitude: diveSite.latitude || '',
      longitude: diveSite.longitude || '',
      address: diveSite.address || '',
      access_instructions: diveSite.access_instructions || '',
      dive_plans: diveSite.dive_plans || '',
      gas_tanks_necessary: diveSite.gas_tanks_necessary || '',
      difficulty_level: diveSite.difficulty_level,
      marine_life: diveSite.marine_life || '',
      safety_information: diveSite.safety_information || ''
    });
    setShowDiveSiteForm(true);
  };

  const handleAddMedia = (diveSite) => {
    setSelectedDiveSite(diveSite);
    setShowMediaForm(true);
  };

  if (!user?.is_admin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('dive-sites')}
          className={`px-4 py-2 rounded-md ${
            activeTab === 'dive-sites'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Dive Sites
        </button>
        <button
          onClick={() => setActiveTab('diving-centers')}
          className={`px-4 py-2 rounded-md ${
            activeTab === 'diving-centers'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Diving Centers
        </button>
      </div>

      {/* Dive Sites Management */}
      {activeTab === 'dive-sites' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Dive Sites Management</h2>
            <button
              onClick={() => {
                setShowDiveSiteForm(true);
                setEditingDiveSite(null);
                resetDiveSiteForm();
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Dive Site
            </button>
          </div>

          {/* Dive Sites List */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Difficulty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {diveSites?.map((site) => (
                    <tr key={site.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{site.name}</div>
                        <div className="text-sm text-gray-500">{site.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          site.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                          site.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                          site.difficulty_level === 'advanced' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {site.difficulty_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {site.average_rating ? `${site.average_rating.toFixed(1)}/10` : 'No ratings'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditDiveSite(site)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAddMedia(site)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteDiveSiteMutation.mutate(site.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dive Site Form Modal */}
      {showDiveSiteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingDiveSite ? 'Edit Dive Site' : 'Add New Dive Site'}
              </h3>
              <button
                onClick={() => setShowDiveSiteForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleDiveSiteSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    value={diveSiteForm.name}
                    onChange={(e) => setDiveSiteForm({...diveSiteForm, name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Difficulty Level</label>
                  <select
                    value={diveSiteForm.difficulty_level}
                    onChange={(e) => setDiveSiteForm({...diveSiteForm, difficulty_level: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={diveSiteForm.latitude}
                    onChange={(e) => setDiveSiteForm({...diveSiteForm, latitude: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={diveSiteForm.longitude}
                    onChange={(e) => setDiveSiteForm({...diveSiteForm, longitude: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={diveSiteForm.address}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, address: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={diveSiteForm.description}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, description: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Access Instructions</label>
                <textarea
                  value={diveSiteForm.access_instructions}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, access_instructions: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Safety Information</label>
                <textarea
                  value={diveSiteForm.safety_information}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, safety_information: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Marine Life</label>
                <textarea
                  value={diveSiteForm.marine_life}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, marine_life: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Dive Plans</label>
                <textarea
                  value={diveSiteForm.dive_plans}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, dive_plans: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Required Gas Tanks</label>
                <textarea
                  value={diveSiteForm.gas_tanks_necessary}
                  onChange={(e) => setDiveSiteForm({...diveSiteForm, gas_tanks_necessary: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDiveSiteForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDiveSiteMutation.isLoading || updateDiveSiteMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createDiveSiteMutation.isLoading || updateDiveSiteMutation.isLoading
                    ? 'Saving...'
                    : editingDiveSite ? 'Update Dive Site' : 'Create Dive Site'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Form Modal */}
      {showMediaForm && selectedDiveSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Media to {selectedDiveSite.name}</h3>
              <button
                onClick={() => setShowMediaForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleMediaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Media Type</label>
                <select
                  value={mediaForm.media_type}
                  onChange={(e) => setMediaForm({...mediaForm, media_type: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">URL *</label>
                <input
                  type="url"
                  value={mediaForm.url}
                  onChange={(e) => setMediaForm({...mediaForm, url: e.target.value})}
                  placeholder="https://example.com/image.jpg or YouTube/Vimeo URL"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={mediaForm.description}
                  onChange={(e) => setMediaForm({...mediaForm, description: e.target.value})}
                  rows="3"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowMediaForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMediaMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {addMediaMutation.isLoading ? 'Adding...' : 'Add Media'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diving Centers Management */}
      {activeTab === 'diving-centers' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Diving Centers Management</h2>
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Diving Center
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {divingCenters?.map((center) => (
                    <tr key={center.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{center.name}</div>
                        <div className="text-sm text-gray-500">{center.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {center.latitude && center.longitude ? `${center.latitude}, ${center.longitude}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {center.average_rating ? `${center.average_rating.toFixed(1)}/10` : 'No ratings'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin; 