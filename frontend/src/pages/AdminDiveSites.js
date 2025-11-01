import {
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  getDifficultyLabel,
  getDifficultyColorClasses,
  getDifficultyOptions,
  getDifficultyOrder,
} from '../utils/difficultyHelpers';

const AdminDiveSites = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Dive Sites');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({
    name: '',
    difficulty_code: '',
    country: '',
    region: '',
    min_rating: '',
    max_rating: '',
  });

  // Get initial pagination from URL parameters
  const getInitialPagination = () => {
    return {
      page: parseInt(searchParams.get('page')) || 1,
      page_size: parseInt(searchParams.get('page_size')) || 25,
    };
  };

  const [pagination, setPagination] = useState(getInitialPagination);

  // Debounced search handler
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId;
      return searchTerm => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setFilters(prev => ({ ...prev, name: searchTerm }));
          setPagination(prev => ({ ...prev, page: 1 }));
        }, 500); // 500ms debounce delay
      };
    })(),
    []
  );

  // Update URL when pagination changes
  const updateURL = newPagination => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', newPagination.page.toString());
    newSearchParams.set('page_size', newPagination.page_size.toString());
    setSearchParams(newSearchParams);
  };

  // Fetch dive sites data with pagination
  const { data: diveSites, isLoading } = useQuery(
    ['admin-dive-sites', pagination, filters],
    () => {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());

      // Add filters
      if (filters.name) params.append('name', filters.name);
      if (filters.difficulty_code) params.append('difficulty_code', filters.difficulty_code);
      if (filters.country) params.append('country', filters.country);
      if (filters.region) params.append('region', filters.region);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);

      return api.get(`/api/v1/dive-sites/?${params.toString()}`);
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
        queryClient.setQueryData(['admin-dive-sites-pagination', pagination], paginationInfo);
        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Get pagination info from cached data
  const paginationInfo = queryClient.getQueryData(['admin-dive-sites-pagination', pagination]) || {
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

  // Filter handlers
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      difficulty_code: '',
      country: '',
      region: '',
      min_rating: '',
      max_rating: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Delete mutation
  const deleteDiveSiteMutation = useMutation(id => api.delete(`/api/v1/dive-sites/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dive-sites']);
      toast.success('Dive site deleted successfully!');
    },
    onError: () => {
      toast.error('Failed to delete dive site');
    },
  });

  // Mass delete mutation
  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/dive-sites/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        setSelectedItems(new Set());
        toast.success(`${selectedItems.size} dive site(s) deleted successfully!`);
      },
      onError: () => {
        toast.error('Failed to delete some dive sites');
      },
    }
  );

  // Selection handlers
  const handleSelectAll = checked => {
    if (checked) {
      setSelectedItems(new Set(sortedDiveSites?.map(site => site.id) || []));
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
      .map(id => diveSites?.find(site => site.id === id)?.name)
      .filter(Boolean);

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedItems.size} dive site(s)?\n\n${itemNames.join('\n')}`
      )
    ) {
      massDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  // Edit handlers
  const handleEditDiveSite = diveSite => {
    navigate(`/dive-sites/${diveSite.id}/edit`);
  };

  const handleViewDiveSite = diveSite => {
    navigate(`/dive-sites/${diveSite.id}`);
  };

  const handleDeleteDiveSite = diveSite => {
    if (window.confirm(`Are you sure you want to delete the dive site "${diveSite.name}"?`)) {
      deleteDiveSiteMutation.mutate(diveSite.id);
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

  // Sort dive sites
  const sortedDiveSites = useMemo(() => {
    if (!diveSites) return [];

    // Sort the results
    const sorted = [...diveSites].sort((a, b) => {
      if (!sortConfig.key) return 0;

      // Special handling for difficulty_code sorting (use order_index)
      if (sortConfig.key === 'difficulty_code') {
        const aOrder = getDifficultyOrder(a.difficulty_code);
        const bOrder = getDifficultyOrder(b.difficulty_code);
        return sortConfig.direction === 'asc' ? aOrder - bOrder : bOrder - aOrder;
      }

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
  }, [diveSites, sortConfig]);

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
          <h1 className='text-3xl font-bold text-gray-900'>Dive Sites Management</h1>
          <p className='text-gray-600 mt-2'>Manage all dive sites in the system</p>
          {paginationInfo.totalCount !== undefined && (
            <p className='text-sm text-gray-500 mt-1'>
              Total dive sites: {paginationInfo.totalCount}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/dive-sites/create')}
          className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
        >
          <Plus className='h-4 w-4 mr-2' />
          Add Dive Site
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

      {/* Filters */}
      <div className='mb-6 bg-gray-50 p-4 rounded-lg'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold'>Filters</h3>
          <button onClick={clearFilters} className='text-sm text-gray-600 hover:text-gray-800'>
            Clear Filters
          </button>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
          <div>
            <label
              htmlFor='difficulty-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Difficulty
            </label>
            <select
              id='difficulty-filter'
              value={filters.difficulty_code || ''}
              onChange={e => handleFilterChange('difficulty_code', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Difficulties</option>
              {getDifficultyOptions()
                .filter(option => option.value !== null)
                .map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label
              htmlFor='country-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Country
            </label>
            <input
              id='country-filter'
              type='text'
              placeholder='Search by country...'
              value={filters.country}
              onChange={e => handleFilterChange('country', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label htmlFor='region-filter' className='block text-sm font-medium text-gray-700 mb-1'>
              Region
            </label>
            <input
              id='region-filter'
              type='text'
              placeholder='Search by region...'
              value={filters.region}
              onChange={e => handleFilterChange('region', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label
              htmlFor='min-rating-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Min Rating
            </label>
            <input
              id='min-rating-filter'
              type='number'
              min='0'
              max='10'
              step='0.1'
              placeholder='0.0'
              value={filters.min_rating}
              onChange={e => handleFilterChange('min_rating', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label
              htmlFor='max-rating-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Max Rating
            </label>
            <input
              id='max-rating-filter'
              type='number'
              min='0'
              max='10'
              step='0.1'
              placeholder='10.0'
              value={filters.max_rating}
              onChange={e => handleFilterChange('max_rating', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className='mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
          <input
            type='text'
            placeholder='Search dive sites by name...'
            value={filters.name}
            onChange={e => debouncedSearch(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {filters.name && (
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, name: '' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>
      </div>

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
            {paginationInfo.totalCount} dive sites
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

      {/* Dive Sites List */}
      <div className='bg-white rounded-lg shadow-md'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th
                  className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                  onClick={() => handleSort('id')}
                >
                  <div className='flex items-center'>
                    ID
                    {getSortIcon('id')}
                  </div>
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  <input
                    type='checkbox'
                    checked={
                      selectedItems.size === sortedDiveSites?.length && sortedDiveSites?.length > 0
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
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Creator
                </th>
                <th
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100'
                  onClick={() => handleSort('difficulty_code')}
                >
                  <div className='flex items-center'>
                    Difficulty
                    {getSortIcon('difficulty_code')}
                  </div>
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
                  Tags
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Aliases
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {sortedDiveSites?.map(site => (
                <tr key={site.id} className='hover:bg-gray-50'>
                  <td className='px-4 py-4 whitespace-nowrap text-sm text-gray-900'>{site.id}</td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <input
                      type='checkbox'
                      checked={selectedItems.has(site.id)}
                      onChange={e => handleSelectItem(site.id, e.target.checked)}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                  </td>
                  <td className='px-6 py-4'>
                    <div className='text-sm font-medium text-gray-900'>{site.name}</div>
                    <div className='text-sm text-gray-500 break-words max-w-xs'>
                      {site.description}
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {site.created_by_username ? (
                      <span className='font-medium text-blue-600'>{site.created_by_username}</span>
                    ) : site.created_by ? (
                      <span className='text-gray-500' title={`User ID: ${site.created_by}`}>
                        ID: {site.created_by}
                      </span>
                    ) : (
                      <span className='text-gray-400 italic'>Unknown</span>
                    )}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(site.difficulty_code)}`}
                    >
                      {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {site.average_rating ? `${site.average_rating.toFixed(1)}/10` : 'No ratings'}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                    {site.view_count !== undefined ? site.view_count.toLocaleString() : 'N/A'}
                  </td>
                  <td className='px-6 py-4'>
                    <div className='flex flex-wrap gap-1'>
                      {site.tags?.map(tag => (
                        <span
                          key={tag.id}
                          className='px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full'
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='flex flex-wrap gap-1'>
                      {site.aliases?.map(alias => (
                        <span
                          key={alias.id}
                          className='px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full'
                        >
                          {alias.alias}
                          {alias.language && (
                            <span className='ml-1 text-xs text-purple-600'>({alias.language})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    <div className='flex space-x-2'>
                      <button
                        onClick={() => handleViewDiveSite(site)}
                        className='text-green-600 hover:text-green-900'
                        title='View dive site'
                      >
                        <Eye className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => handleEditDiveSite(site)}
                        className='text-blue-600 hover:text-blue-900'
                        title='Edit dive site'
                      >
                        <Edit className='h-4 w-4' />
                      </button>

                      <button
                        onClick={() => handleDeleteDiveSite(site)}
                        className='text-red-600 hover:text-red-900'
                        title='Delete dive site'
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

      {sortedDiveSites?.length === 0 && (
        <div className='text-center py-12'>
          <p className='text-gray-500'>No dive sites found.</p>
        </div>
      )}
    </div>
  );
};

export default AdminDiveSites;
