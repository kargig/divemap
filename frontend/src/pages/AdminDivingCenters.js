import { Plus, Edit, Trash2, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const AdminDivingCenters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Fetch diving centers data
  const { data: divingCenters, isLoading } = useQuery(
    ['admin-diving-centers'],
    () => api.get('/api/v1/diving-centers/'),
    {
      select: response => response.data,
    }
  );

  // Delete mutation
  const deleteDivingCenterMutation = useMutation(id => api.delete(`/api/v1/diving-centers/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-diving-centers']);
      toast.success('Diving center deleted successfully!');
    },
    onError: _error => {
      toast.error('Failed to delete diving center');
    },
  });

  // Mass delete mutation
  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/diving-centers/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-diving-centers']);
        setSelectedItems(new Set());
        toast.success(`${selectedItems.size} diving center(s) deleted successfully!`);
      },
      onError: _error => {
        toast.error('Failed to delete some diving centers');
      },
    }
  );

  // Selection handlers
  const handleSelectAll = checked => {
    if (checked) {
      setSelectedItems(new Set(sortedDivingCenters?.map(center => center.id) || []));
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
      .map(id => divingCenters?.find(center => center.id === id)?.name)
      .filter(Boolean);

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedItems.size} diving center(s)?\n\n${itemNames.join('\n')}`
      )
    ) {
      massDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  // Edit handlers
  const handleEditDivingCenter = divingCenter => {
    navigate(`/diving-centers/${divingCenter.id}/edit`);
  };

  const handleViewDivingCenter = divingCenter => {
    navigate(`/diving-centers/${divingCenter.id}`);
  };

  const handleDeleteDivingCenter = divingCenter => {
    if (
      window.confirm(`Are you sure you want to delete the diving center "${divingCenter.name}"?`)
    ) {
      deleteDivingCenterMutation.mutate(divingCenter.id);
    }
  };

  // Sorting functions
  const handleSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = key => {
    if (sortConfig.key !== key) {
      return <ChevronUp className='h-4 w-4 text-gray-400' />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className='h-4 w-4 text-blue-600' />
    ) : (
      <ChevronDown className='h-4 w-4 text-blue-600' />
    );
  };

  // Sort diving centers
  const sortedDivingCenters = useMemo(() => {
    if (!divingCenters) return [];

    const sorted = [...divingCenters].sort((a, b) => {
      if (!sortConfig.key) return 0;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string values
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [divingCenters, sortConfig]);

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto p-6'>
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Diving Centers Management</h1>
          <p className='text-gray-600 mt-2'>Manage all diving centers in the system</p>
        </div>
        <button
          onClick={() => navigate('/admin/diving-centers/create')}
          className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
        >
          <Plus className='h-4 w-4 mr-2' />
          Add Diving Center
        </button>
      </div>

      {/* Mass Delete Button */}
      {selectedItems.size > 0 && (
        <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <span className='text-red-800 font-medium'>
                {selectedItems.size} item(s) selected
              </span>
            </div>
            <button
              onClick={handleMassDelete}
              disabled={massDeleteMutation.isLoading}
              className='flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Delete Selected ({selectedItems.size})
            </button>
          </div>
        </div>
      )}

      {/* Diving Centers List */}
      <div className='bg-white rounded-lg shadow-md'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  <input
                    type='checkbox'
                    checked={
                      selectedItems.size === sortedDivingCenters?.length &&
                      sortedDivingCenters?.length > 0
                    }
                    onChange={e => handleSelectAll(e.target.checked)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                </th>
                <th
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                  onClick={() => handleSort('name')}
                >
                  <div className='flex items-center'>
                    Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                  onClick={() => handleSort('email')}
                >
                  <div className='flex items-center'>
                    Contact
                    {getSortIcon('email')}
                  </div>
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Location
                </th>
                <th
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                  onClick={() => handleSort('average_rating')}
                >
                  <div className='flex items-center'>
                    Rating
                    {getSortIcon('average_rating')}
                  </div>
                </th>
                <th
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                  onClick={() => handleSort('view_count')}
                >
                  <div className='flex items-center'>
                    Views
                    {getSortIcon('view_count')}
                  </div>
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {sortedDivingCenters?.map(center => (
                <tr key={center.id} className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <input
                      type='checkbox'
                      checked={selectedItems.has(center.id)}
                      onChange={e => handleSelectItem(center.id, e.target.checked)}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                  </td>
                  <td className='px-6 py-4'>
                    <div className='text-sm font-medium text-gray-900'>{center.name}</div>
                    <div className='text-sm text-gray-500 break-words max-w-xs'>
                      {center.description}
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm text-gray-900'>{center.email}</div>
                    <div className='text-sm text-gray-500'>{center.phone}</div>
                  </td>
                  <td className='px-6 py-4'>
                    {center.latitude && center.longitude ? (
                      <div>
                        <div className='text-sm text-gray-900'>
                          {center.latitude}, {center.longitude}
                        </div>
                        {center.website && (
                          <a
                            href={center.website}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-600 hover:text-blue-800 text-xs break-all'
                          >
                            {center.website}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className='text-sm text-gray-500'>N/A</span>
                    )}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {center.average_rating
                      ? `${center.average_rating.toFixed(1)}/10`
                      : 'No ratings'}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {center.view_count !== undefined ? center.view_count.toLocaleString() : 'N/A'}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    <div className='flex space-x-2'>
                      <button
                        onClick={() => handleViewDivingCenter(center)}
                        className='text-green-600 hover:text-green-900'
                        title='View diving center'
                      >
                        <Eye className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => handleEditDivingCenter(center)}
                        className='text-blue-600 hover:text-blue-900'
                        title='Edit diving center'
                      >
                        <Edit className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => handleDeleteDivingCenter(center)}
                        className='text-red-600 hover:text-red-900'
                        title='Delete diving center'
                      >
                        <Trash2 className='h-4 w-4' />
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
        <div className='text-center py-12'>
          <p className='text-gray-500'>No diving centers found.</p>
        </div>
      )}
    </div>
  );
};

export default AdminDivingCenters;
