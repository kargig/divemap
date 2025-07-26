import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const AdminDivingCenters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch diving centers data
  const { data: divingCenters, isLoading } = useQuery(
    ['admin-diving-centers'],
    () => api.get('/api/v1/diving-centers'),
    {
      select: (response) => response.data,
    }
  );

  // Delete mutation
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

  // Edit handlers
  const handleEditDivingCenter = (divingCenter) => {
    navigate(`/diving-centers/${divingCenter.id}/edit`);
  };

  const handleViewDivingCenter = (divingCenter) => {
    navigate(`/diving-centers/${divingCenter.id}`);
  };

  const handleDeleteDivingCenter = (divingCenter) => {
    if (window.confirm(`Are you sure you want to delete the diving center "${divingCenter.name}"?`)) {
      deleteDivingCenterMutation.mutate(divingCenter.id);
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
          <h1 className="text-3xl font-bold text-gray-900">Diving Centers Management</h1>
          <p className="text-gray-600 mt-2">Manage all diving centers in the system</p>
        </div>
        <button
          onClick={() => navigate('/admin/diving-centers/create')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Diving Center
        </button>
      </div>

      {/* Diving Centers List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
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
                <tr key={center.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{center.name}</div>
                    <div className="text-sm text-gray-500">{center.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{center.email}</div>
                    <div className="text-sm text-gray-500">{center.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {center.latitude && center.longitude ? (
                      <div>
                        <div>{center.latitude}, {center.longitude}</div>
                        {center.website && (
                          <a 
                            href={center.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {center.website}
                          </a>
                        )}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {center.average_rating ? `${center.average_rating.toFixed(1)}/10` : 'No ratings'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDivingCenter(center)}
                        className="text-green-600 hover:text-green-900"
                        title="View diving center"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditDivingCenter(center)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit diving center"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDivingCenter(center)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete diving center"
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

      {divingCenters?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No diving centers found.</p>
        </div>
      )}
    </div>
  );
};

export default AdminDivingCenters; 