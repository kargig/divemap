import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const AdminDiveSites = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch dive sites data
  const { data: diveSites, isLoading } = useQuery(
    ['admin-dive-sites'],
    () => api.get('/api/v1/dive-sites'),
    {
      select: (response) => response.data,
    }
  );

  // Delete mutation
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

  // Edit handlers
  const handleEditDiveSite = (diveSite) => {
    navigate(`/dive-sites/${diveSite.id}/edit`);
  };

  const handleViewDiveSite = (diveSite) => {
    navigate(`/dive-sites/${diveSite.id}`);
  };

  const handleDeleteDiveSite = (diveSite) => {
    if (window.confirm(`Are you sure you want to delete the dive site "${diveSite.name}"?`)) {
      deleteDiveSiteMutation.mutate(diveSite.id);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Dive Sites Management</h1>
          <p className="text-gray-600 mt-2">Manage all dive sites in the system</p>
        </div>
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
                  Tags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {diveSites?.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {site.tags?.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDiveSite(site)}
                        className="text-green-600 hover:text-green-900"
                        title="View dive site"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditDiveSite(site)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit dive site"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDiveSite(site)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete dive site"
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

      {diveSites?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No dive sites found.</p>
        </div>
      )}
    </div>
  );
};

export default AdminDiveSites; 