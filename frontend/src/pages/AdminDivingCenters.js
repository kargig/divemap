import {
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const AdminDivingCenters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Get initial pagination from URL parameters
  const getInitialPagination = () => {
    return {
      page: parseInt(searchParams.get('page')) || 1,
      page_size: parseInt(searchParams.get('page_size')) || 25,
    };
  };

  const [pagination, setPagination] = useState(getInitialPagination);

  // Update URL when pagination changes
  const updateURL = newPagination => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', newPagination.page.toString());
    newSearchParams.set('page_size', newPagination.page_size.toString());
    setSearchParams(newSearchParams);
  };

  // Fetch diving centers data with pagination
  const { data: divingCenters, isLoading } = useQuery(
    ['admin-diving-centers', pagination],
    () => {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());
      return api.get(`/api/v1/diving-centers/?${params.toString()}`);
    },
    {
      select: response => {
        // Try both lowercase and original case for headers
        const getHeader = name => {
          return (
            response.headers[name] ||
            response.headers[name.toLowerCase()] ||
            response.headers[name.toUpperCase()] ||
            '0'
          );
        };

        // Store pagination info from headers
        const paginationInfo = {
          totalCount: parseInt(getHeader('x-total-count')),
          totalPages: parseInt(getHeader('x-total-pages')),
          currentPage: parseInt(getHeader('x-current-page')),
          pageSize: parseInt(getHeader('x-page-size')),
          hasNextPage: getHeader('x-has-next-page') === 'true',
          hasPrevPage: getHeader('x-has-prev-page') === 'true',
        };

        // Fallback: if headers are not available, use response data length
        if (paginationInfo.totalCount === 0 && response.data) {
          paginationInfo.totalCount = response.data.length;
          paginationInfo.totalPages = Math.ceil(response.data.length / pagination.page_size);
          paginationInfo.currentPage = pagination.page;
          paginationInfo.pageSize = pagination.page_size;
          paginationInfo.hasNextPage = pagination.page < paginationInfo.totalPages;
          paginationInfo.hasPrevPage = pagination.page > 1;
        }

        // Store pagination info in the query cache
        queryClient.setQueryData(['admin-diving-centers-pagination', pagination], paginationInfo);
        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Get pagination info from cached data
  const paginationInfo = queryClient.getQueryData([
    'admin-diving-centers-pagination',
    pagination,
  ]) || {
    totalCount: 0,
    totalPages: 0,
    currentPage: pagination.page,
    pageSize: pagination.page_size,
    hasNextPage: false,
    hasPrevPage: pagination.page > 1,
  };

  // Pagination handlers
  const handlePageChange = newPage => {
    const newPagination = { ...pagination, page: newPage };
    setPagination(newPagination);
    updateURL(newPagination);
  };

  const handlePageSizeChange = newPageSize => {
    const newPagination = { page: 1, page_size: newPageSize };
    setPagination(newPagination);
    updateURL(newPagination);
  };

  // Delete mutation
  const deleteDivingCenterMutation = useMutation(id => api.delete(`/api/v1/diving-centers/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-diving-centers']);
      toast.success('Diving center deleted successfully!');
    },
    onError: () => {
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
      onError: () => {
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
          {paginationInfo.totalCount !== undefined && (
            <p className='text-sm text-gray-500 mt-1'>
              Total diving centers: {paginationInfo.totalCount}
            </p>
          )}
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

      {/* Pagination Controls */}
      <div className='mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8'>
        {/* Page Size Selection */}
        <div className='flex items-center gap-2'>
          <label htmlFor='page-size-select' className='text-sm font-medium text-gray-700'>
            Show:
          </label>
          <select
            id='page-size-select'
            value={pagination.page_size}
            onChange={e => handlePageSizeChange(parseInt(e.target.value))}
            className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className='text-sm text-gray-600'>per page</span>
        </div>

        {/* Pagination Info */}
        {paginationInfo.totalCount !== undefined && (
          <div className='text-sm text-gray-600'>
            Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
            {Math.min(pagination.page * pagination.page_size, paginationInfo.totalCount)} of{' '}
            {paginationInfo.totalCount} diving centers
          </div>
        )}

        {/* Pagination Navigation */}
        {paginationInfo.totalCount !== undefined && (
          <div className='flex items-center gap-2'>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>

            <span className='text-sm text-gray-700'>
              Page {pagination.page} of{' '}
              {Math.ceil(paginationInfo.totalCount / pagination.page_size)}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={
                pagination.page >= Math.ceil(paginationInfo.totalCount / pagination.page_size)
              }
              className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        )}
      </div>

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

      {/* Bottom Pagination Controls */}
      <div className='mt-8 flex flex-col sm:flex-row justify-between items-center gap-4'>
        {/* Page Size Selection */}
        <div className='flex items-center gap-2'>
          <label htmlFor='page-size-select-bottom' className='text-sm font-medium text-gray-700'>
            Show:
          </label>
          <select
            id='page-size-select-bottom'
            value={pagination.page_size}
            onChange={e => handlePageSizeChange(parseInt(e.target.value))}
            className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className='text-sm text-gray-600'>per page</span>
        </div>

        {/* Pagination Info */}
        {paginationInfo.totalCount !== undefined && (
          <div className='text-sm text-gray-600'>
            Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
            {Math.min(pagination.page * pagination.page_size, paginationInfo.totalCount)} of{' '}
            {paginationInfo.totalCount} diving centers
          </div>
        )}

        {/* Pagination Navigation */}
        {paginationInfo.totalCount !== undefined && (
          <div className='flex items-center gap-2'>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>

            <span className='text-sm text-gray-700'>
              Page {pagination.page} of{' '}
              {Math.ceil(paginationInfo.totalCount / pagination.page_size)}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={
                pagination.page >= Math.ceil(paginationInfo.totalCount / pagination.page_size)
              }
              className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDivingCenters;
