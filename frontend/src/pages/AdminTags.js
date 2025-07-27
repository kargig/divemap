import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Edit, Plus, Search, X, Loader, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const AdminTags = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tag management state
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagForm, setTagForm] = useState({
    name: '',
    description: ''
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch tags data
  const { data: tags, isLoading } = useQuery(
    ['admin-tags'],
    () => api.get('/api/v1/tags/with-counts'),
    {
      select: (response) => response.data,
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

  // Mass delete mutation
  const massDeleteMutation = useMutation(
    (ids) => Promise.all(ids.map(id => api.delete(`/api/v1/tags/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-tags']);
        setSelectedItems(new Set());
        toast.success(`${selectedItems.size} tag(s) deleted successfully!`);
      },
      onError: (error) => {
        toast.error('Failed to delete some tags');
      },
    }
  );

  // Selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      // Only select tags that can be deleted (no dive sites associated)
      const deletableTags = tags?.filter(tag => tag.dive_site_count === 0) || [];
      setSelectedItems(new Set(deletableTags.map(tag => tag.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id, checked) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleMassDelete = () => {
    if (selectedItems.size === 0) return;
    
    const itemNames = Array.from(selectedItems)
      .map(id => tags?.find(tag => tag.id === id)?.name)
      .filter(Boolean);
    
    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} tag(s)?\n\n${itemNames.join('\n')}`)) {
      massDeleteMutation.mutate(Array.from(selectedItems));
    }
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tag Management</h1>
          <p className="text-gray-600 mt-2">Manage all tags in the system</p>
        </div>
        <button
          onClick={() => setShowCreateTagModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Tag
        </button>
      </div>

      {/* Mass Delete Button */}
      {selectedItems.size > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-red-800 font-medium">
                {selectedItems.size} item(s) selected
              </span>
            </div>
            <button
              onClick={handleMassDelete}
              disabled={massDeleteMutation.isLoading}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedItems.size})
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === (tags?.filter(tag => tag.dive_site_count === 0).length || 0) && (tags?.filter(tag => tag.dive_site_count === 0).length || 0) > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
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
                <tr key={tag.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(tag.id)}
                      onChange={(e) => handleSelectItem(tag.id, e.target.checked)}
                      disabled={tag.dive_site_count > 0}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
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
                        title="Edit tag"
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

      {tags?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No tags found.</p>
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

export default AdminTags; 