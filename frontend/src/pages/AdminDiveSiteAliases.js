import { Plus, Edit, Trash2, ArrowLeft, Save, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const AdminDiveSiteAliases = () => {
  const { diveSiteId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [editingAlias, setEditingAlias] = useState(null);
  const [newAlias, setNewAlias] = useState({ alias: '' });
  const [isAdding, setIsAdding] = useState(false);

  // Fetch dive site details
  const { data: diveSite, isLoading: diveSiteLoading } = useQuery(
    ['dive-site', diveSiteId],
    () => api.get(`/api/v1/dive-sites/${diveSiteId}`),
    {
      select: response => response.data,
    }
  );

  // Fetch aliases
  const { data: aliases, isLoading: aliasesLoading } = useQuery(
    ['dive-site-aliases', diveSiteId],
    () => api.get(`/api/v1/dive-sites/${diveSiteId}/aliases`),
    {
      select: response => response.data,
    }
  );

  // Add alias mutation
  const addAliasMutation = useMutation(
    aliasData => api.post(`/api/v1/dive-sites/${diveSiteId}/aliases`, aliasData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-aliases', diveSiteId]);
        setNewAlias({ alias: '' });
        setIsAdding(false);
        toast.success('Alias added successfully');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to add alias');
      },
    }
  );

  // Update alias mutation
  const updateAliasMutation = useMutation(
    ({ aliasId, aliasData }) =>
      api.put(`/api/v1/dive-sites/${diveSiteId}/aliases/${aliasId}`, aliasData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-aliases', diveSiteId]);
        setEditingAlias(null);
        toast.success('Alias updated successfully');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to update alias');
      },
    }
  );

  // Delete alias mutation
  const deleteAliasMutation = useMutation(
    aliasId => api.delete(`/api/v1/dive-sites/${diveSiteId}/aliases/${aliasId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-aliases', diveSiteId]);
        toast.success('Alias deleted successfully');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to delete alias');
      },
    }
  );

  const handleAddAlias = () => {
    if (!newAlias.alias.trim()) {
      toast.error('Alias name is required');
      return;
    }
    addAliasMutation.mutate(newAlias);
  };

  const handleUpdateAlias = (aliasId, aliasData) => {
    if (!aliasData.alias.trim()) {
      toast.error('Alias name is required');
      return;
    }
    updateAliasMutation.mutate({ aliasId, aliasData });
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
    });
  };

  const handleCancelEdit = () => {
    setEditingAlias(null);
  };

  if (diveSiteLoading || aliasesLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!diveSite) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-500'>Dive site not found.</p>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-6'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center gap-4 mb-4'>
          <button
            onClick={() => navigate('/admin/dive-sites')}
            className='flex items-center gap-2 text-gray-600 hover:text-gray-800'
          >
            <ArrowLeft className='h-4 w-4' />
            Back to Dive Sites
          </button>
        </div>
        <h1 className='text-3xl font-bold text-gray-900'>Manage Aliases for "{diveSite.name}"</h1>
        <p className='text-gray-600 mt-2'>
          Add, edit, or remove aliases for this dive site. Aliases help with newsletter parsing and
          multilingual support.
        </p>
      </div>

      {/* Add New Alias */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Add New Alias</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label htmlFor='alias-name' className='block text-sm font-medium text-gray-700 mb-1'>
              Alias Name *
            </label>
            <input
              id='alias-name'
              type='text'
              value={newAlias.alias}
              onChange={e => setNewAlias({ ...newAlias, alias: e.target.value })}
              placeholder='Enter alias name'
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div className='flex items-end'>
            <button
              onClick={handleAddAlias}
              disabled={addAliasMutation.isLoading}
              className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              <Plus className='h-4 w-4' />
              {addAliasMutation.isLoading ? 'Adding...' : 'Add Alias'}
            </button>
          </div>
        </div>
      </div>

      {/* Aliases Table */}
      <div className='bg-white rounded-lg shadow-md'>
        <div className='px-6 py-4 border-b border-gray-200'>
          <h2 className='text-xl font-semibold text-gray-900'>Existing Aliases</h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Alias Name
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Created
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {aliases && aliases.length > 0 ? (
                aliases.map(alias => (
                  <tr key={alias.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4'>
                      {editingAlias?.id === alias.id ? (
                        <input
                          type='text'
                          value={editingAlias.alias}
                          onChange={e =>
                            setEditingAlias({ ...editingAlias, alias: e.target.value })
                          }
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                      ) : (
                        <span className='text-sm font-medium text-gray-900'>{alias.alias}</span>
                      )}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                      {new Date(alias.created_at).toLocaleDateString()}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                      {editingAlias?.id === alias.id ? (
                        <div className='flex space-x-2'>
                          <button
                            onClick={() =>
                              handleUpdateAlias(alias.id, {
                                alias: editingAlias.alias,
                              })
                            }
                            disabled={updateAliasMutation.isLoading}
                            className='text-green-600 hover:text-green-900 disabled:opacity-50'
                            title='Save changes'
                          >
                            <Save className='h-4 w-4' />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className='text-gray-600 hover:text-gray-900'
                            title='Cancel edit'
                          >
                            <X className='h-4 w-4' />
                          </button>
                        </div>
                      ) : (
                        <div className='flex space-x-2'>
                          <button
                            onClick={() => handleEditAlias(alias)}
                            className='text-blue-600 hover:text-blue-900'
                            title='Edit alias'
                          >
                            <Edit className='h-4 w-4' />
                          </button>
                          <button
                            onClick={() => handleDeleteAlias(alias)}
                            className='text-red-600 hover:text-red-900'
                            title='Delete alias'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className='px-6 py-4 text-center text-sm text-gray-500'>
                    No aliases found for this dive site.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDiveSiteAliases;
