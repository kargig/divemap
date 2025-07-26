import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Eye, X, Save, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dive-sites');

  // Tag management state
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagForm, setTagForm] = useState({
    name: '',
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

  const { data: tags } = useQuery(
    ['admin-tags'],
    () => api.get('/api/v1/tags/with-counts'),
    {
      select: (response) => response.data,
      enabled: activeTab === 'tags'
    }
  );

  const { data: users } = useQuery(
    ['admin-users'],
    () => api.get('/api/v1/users/admin/users'),
    {
      select: (response) => response.data,
      enabled: activeTab === 'users'
    }
  );

  // Mutations
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

  const deleteDivingCenterMutation = useMutation(
    (id) => api.delete(`/api/v1/diving-centers/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-diving-centers']);
        toast.success('Diving center deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete diving center');
      },
    }
  );

  const deleteUserMutation = useMutation(
    (id) => api.delete(`/api/v1/users/admin/users/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete user');
      },
    }
  );

  const updateUserMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/users/admin/users/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User updated successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update user');
      },
    }
  );

  // Tag mutations
  const createTagMutation = useMutation(
    (tagData) => api.post('/api/v1/tags/', tagData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-tags']);
        toast.success('Tag created successfully!');
        setShowCreateTagModal(false);
        setTagForm({ name: '', description: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to create tag');
      },
    }
  );

  const updateTagMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/tags/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-tags']);
        toast.success('Tag updated successfully!');
        setShowEditTagModal(false);
        setEditingTag(null);
        setTagForm({ name: '', description: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update tag');
      },
    }
  );

  const deleteTagMutation = useMutation(
    (id) => api.delete(`/api/v1/tags/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-tags']);
        toast.success('Tag deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete tag');
      },
    }
  );

  // Edit handlers
  const handleEditDiveSite = (diveSite) => {
    navigate(`/dive-sites/${diveSite.id}/edit`);
  };

  const handleEditDivingCenter = (divingCenter) => {
    navigate(`/diving-centers/${divingCenter.id}/edit`);
  };

  const handleEditUser = (user) => {
    // For now, we'll implement inline editing
    // TODO: Create a proper user edit form
    const newEnabled = !user.enabled;
    updateUserMutation.mutate({
      id: user.id,
      data: { enabled: newEnabled }
    });
  };

  // Tag handlers
  const handleCreateTag = () => {
    if (!tagForm.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    createTagMutation.mutate(tagForm);
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setTagForm({
      name: tag.name,
      description: tag.description || ''
    });
    setShowEditTagModal(true);
  };

  const handleUpdateTag = () => {
    if (!tagForm.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    updateTagMutation.mutate({
      id: editingTag.id,
      data: tagForm
    });
  };

  const handleDeleteTag = (tag) => {
    if (window.confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      deleteTagMutation.mutate(tag.id);
    }
  };

  const resetTagForm = () => {
    setTagForm({ name: '', description: '' });
    setEditingTag(null);
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
        <button
          onClick={() => setActiveTab('tags')}
          className={`px-4 py-2 rounded-md ${
            activeTab === 'tags'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Tag Management
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-md ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          User Management
        </button>
      </div>

      {/* Dive Sites Management */}
      {activeTab === 'dive-sites' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Dive Sites Management</h2>
            <button
              onClick={() => navigate('/admin/dive-sites/create')}
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

      {/* Diving Centers Management */}
      {activeTab === 'diving-centers' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Diving Centers Management</h2>
            <button
              onClick={() => navigate('/admin/diving-centers/create')}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
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
                          <button
                            onClick={() => handleEditDivingCenter(center)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteDivingCenterMutation.mutate(center.id)}
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

      {/* Tag Management */}
      {activeTab === 'tags' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Tag Management</h2>
            <button
              onClick={() => setShowCreateTagModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tag Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dive Sites Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tags?.map((tag) => (
                    <tr key={tag.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{tag.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{tag.description || 'No description'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {tag.dive_site_count} sites
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tag.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditTag(tag)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag)}
                            className="text-red-600 hover:text-red-900"
                            disabled={tag.dive_site_count > 0}
                            title={tag.dive_site_count > 0 ? 'Cannot delete tag that is associated with dive sites' : 'Delete tag'}
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

      {/* User Management */}
      {activeTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
            <button
              onClick={() => setActiveTab('create-user')}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users?.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.is_admin ? 'bg-red-100 text-red-800' :
                          user.is_moderator ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.is_admin ? 'Admin' : user.is_moderator ? 'Moderator' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {user.id !== user?.id && (
                            <button
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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

      {/* Create Tag Modal */}
      {showCreateTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Tag</h3>
              <button
                onClick={() => {
                  setShowCreateTagModal(false);
                  resetTagForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tag name"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={tagForm.description}
                  onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tag description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTagModal(false);
                  resetTagForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={createTagMutation.isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createTagMutation.isLoading ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditTagModal && editingTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Tag</h3>
              <button
                onClick={() => {
                  setShowEditTagModal(false);
                  resetTagForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tag name"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={tagForm.description}
                  onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tag description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditTagModal(false);
                  resetTagForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTag}
                disabled={updateTagMutation.isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updateTagMutation.isLoading ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Update Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin; 