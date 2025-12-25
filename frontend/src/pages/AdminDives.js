import {
  Trash2,
  Edit,
  Search,
  X,
  Loader,
  Save,
  Anchor,
  Calendar,
  User,
  MapPin,
  Download,
  Columns,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';

import api from '../api';
import AdminDivesTable from '../components/tables/AdminDivesTable';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { createDiveSchema, createResolver, getErrorMessage } from '../utils/formHelpers';

const AdminDives = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Dives');
  const [searchParams, setSearchParams] = useSearchParams();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: createResolver(createDiveSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      dive_information: '',
      max_depth: '',
      average_depth: '',
      gas_bottles_used: '',
      suit_type: '',
      difficulty_code: '',
      visibility_rating: '',
      user_rating: '',
      dive_date: '',
      dive_time: '',
      duration: '',
      is_private: false,
      dive_site_id: '',
      diving_center_id: '', // Added to match schema
      selected_route_id: '', // Added to match schema
    },
  });

  // Update URL when pagination changes
  const updateURL = useCallback(
    newPagination => {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('page', (newPagination.pageIndex + 1).toString());
      newSearchParams.set('page_size', newPagination.pageSize.toString());
      setSearchParams(newSearchParams);
    },
    [searchParams, setSearchParams]
  );

  // Dive management state
  const [showEditDiveModal, setShowEditDiveModal] = useState(false);
  const [editingDive, setEditingDive] = useState(null);

  // TanStack Table state
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: parseInt(searchParams.get('page')) - 1 || 0,
    pageSize: parseInt(searchParams.get('page_size')) || 50,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({
    id: true,
    select: true,
    dive: true,
    user: true,
    dive_site: true,
    date: true,
    rating: true,
    privacy: true,
    views: true,
    actions: true,
  });
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    user_id: '',
    dive_site_id: '',
    dive_site_name: '',
    difficulty_code: '',
    suit_type: '',
    min_depth: '',
    max_depth: '',
    min_visibility: '',
    max_visibility: '',
    min_rating: '',
    max_rating: '',
    start_date: '',
    end_date: '',
  });

  // Fetch total count
  const { data: totalCount } = useQuery(
    ['admin-dives-count', filters],
    () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return api.get(`/api/v1/dives/admin/dives/count?${params.toString()}`);
    },
    {
      select: response => response.data.total,
    }
  );

  // Map frontend column IDs to backend API sort field names
  const mapColumnIdToSortField = columnId => {
    const fieldMapping = {
      id: 'id',
      dive_date: 'dive_date',
      max_depth: 'max_depth',
      duration: 'duration',
      user_rating: 'user_rating',
      visibility_rating: 'visibility_rating',
      view_count: 'view_count',
      created_at: 'created_at',
      updated_at: 'updated_at',
    };
    return fieldMapping[columnId] || null;
  };

  // Get sort parameters for API
  const getSortParams = () => {
    if (sorting.length === 0) return {};
    const sort = sorting[0];
    const sortField = mapColumnIdToSortField(sort.id);
    if (!sortField) return {}; // Skip sorting if field not supported
    return {
      sort_by: sortField,
      sort_order: sort.desc ? 'desc' : 'asc',
    };
  };

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      (() => {
        let timeoutId;
        return searchValue => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchValue }));
            setPagination(prev => {
              const newPagination = { ...prev, pageIndex: 0 };
              updateURL(newPagination);
              return newPagination;
            });
          }, 500);
        };
      })(),
    [updateURL]
  );

  // Sync searchInput with filters.search when filters change externally (e.g., clear filters)
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Fetch dives data with pagination and sorting
  const { data: dives, isLoading } = useQuery(
    ['admin-dives', filters, pagination, sorting],
    () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      // Add sorting
      const sortParams = getSortParams();
      if (sortParams.sort_by) {
        params.append('sort_by', sortParams.sort_by);
        params.append('sort_order', sortParams.sort_order);
      }
      // Add pagination
      params.append('limit', pagination.pageSize.toString());
      params.append('offset', (pagination.pageIndex * pagination.pageSize).toString());
      return api.get(`/api/v1/dives/admin/dives?${params.toString()}`);
    },
    {
      select: response => response.data,
      keepPreviousData: true,
    }
  );

  // Fetch dive sites for dropdown
  const { data: diveSites } = useQuery(
    ['dive-sites'],
    () => api.get('/api/v1/dive-sites/?limit=100'),
    {
      select: response => response.data,
    }
  );

  // Fetch users for dropdown
  const { data: users } = useQuery(['admin-users'], () => api.get('/api/v1/users/admin/users'), {
    select: response => response.data,
  });

  // Dive mutations
  const updateDiveMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/dives/admin/dives/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dives']);
        toast.success('Dive updated successfully!');
        setShowEditDiveModal(false);
        setEditingDive(null);
        reset();
      },
      onError: _error => {
        toast.error('Failed to update dive');
      },
    }
  );

  const deleteDiveMutation = useMutation(id => api.delete(`/api/v1/dives/admin/dives/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dives']);
      toast.success('Dive deleted successfully!');
    },
    onError: _error => {
      toast.error('Failed to delete dive');
    },
  });

  // Mass delete mutation
  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/dives/admin/dives/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dives']);
        toast.success('Selected dives deleted successfully!');
        setRowSelection({});
      },
      onError: _error => {
        toast.error('Failed to delete some dives');
      },
    }
  );

  const handleMassDelete = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) {
      toast.error('Please select dives to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} dive(s)?`)) {
      massDeleteMutation.mutate(selectedIds.map(id => parseInt(id)));
    }
  };

  const handleEditDive = dive => {
    setEditingDive(dive);
    reset({
      name: dive.name || '',
      dive_information: dive.dive_information || '',
      max_depth: dive.max_depth ? dive.max_depth.toString() : '',
      average_depth: dive.average_depth ? dive.average_depth.toString() : '',
      gas_bottles_used: dive.gas_bottles_used || '',
      suit_type: dive.suit_type || '',
      difficulty_code: dive.difficulty_code || '',
      visibility_rating: dive.visibility_rating ? dive.visibility_rating.toString() : '',
      user_rating: dive.user_rating ? dive.user_rating.toString() : '',
      dive_date: dive.dive_date || '',
      dive_time: dive.dive_time ? dive.dive_time.substring(0, 5) : '', // HH:MM
      duration: dive.duration ? dive.duration.toString() : '',
      is_private: dive.is_private || false,
      dive_site_id: dive.dive_site_id ? dive.dive_site_id.toString() : '',
      diving_center_id: dive.diving_center_id ? dive.diving_center_id.toString() : '',
      selected_route_id: dive.selected_route_id ? dive.selected_route_id.toString() : '',
    });
    setShowEditDiveModal(true);
  };

  const onUpdateSubmit = data => {
    const updateData = {
      ...data,
      dive_time: data.dive_time && data.dive_time !== '' ? `${data.dive_time}:00` : null,
      // Zod schema handles number conversions and nulls
    };

    updateDiveMutation.mutate({
      id: editingDive.id,
      data: updateData,
    });
  };

  const handleDeleteDive = dive => {
    if (window.confirm(`Are you sure you want to delete dive "${dive.name}"?`)) {
      deleteDiveMutation.mutate(dive.id);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    const newPagination = { ...pagination, pageIndex: 0 };
    updateURL(newPagination);
    setPagination(newPagination);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      user_id: '',
      dive_site_id: '',
      dive_site_name: '',
      difficulty_code: '',
      suit_type: '',
      min_depth: '',
      max_depth: '',
      min_visibility: '',
      max_visibility: '',
      min_rating: '',
      max_rating: '',
      start_date: '',
      end_date: '',
    });
    setSearchInput('');
    const newPagination = { ...pagination, pageIndex: 0 };
    updateURL(newPagination);
    setPagination(newPagination);
  };

  // Define columns
  const columns = useMemo(
    () => [
      {
        id: 'id',
        accessorKey: 'id',
        header: 'ID',
        enableSorting: true,
        size: 80,
      },
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type='checkbox'
            checked={table.getIsAllRowsSelected()}
            onChange={e => {
              if (e.target.checked) {
                const newSelection = {};
                dives?.forEach(dive => {
                  newSelection[dive.id] = true;
                });
                setRowSelection(newSelection);
              } else {
                setRowSelection({});
              }
            }}
            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
          />
        ),
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <input
              type='checkbox'
              checked={rowSelection[dive.id] || false}
              onChange={e => {
                setRowSelection(prev => ({
                  ...prev,
                  [dive.id]: e.target.checked,
                }));
              }}
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
            />
          );
        },
        enableSorting: false,
        size: 50,
      },
      {
        id: 'dive',
        accessorKey: 'name',
        header: 'Dive',
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <div className='flex items-center'>
              <Anchor className='h-5 w-5 text-blue-600 mr-2' />
              <div>
                <div className='text-sm font-medium text-gray-900'>{dive.name}</div>
                <div className='text-sm text-gray-500'>
                  {dive.max_depth && `${dive.max_depth}m`}
                  {dive.duration && ` • ${dive.duration}min`}
                </div>
              </div>
            </div>
          );
        },
        enableSorting: true,
        size: 200,
      },
      {
        id: 'user',
        accessorKey: 'user_username',
        header: 'User',
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <div className='flex items-center'>
              <User className='h-4 w-4 text-gray-400 mr-2' />
              <span className='text-sm text-gray-900'>{dive.user_username}</span>
            </div>
          );
        },
        enableSorting: true,
        size: 150,
      },
      {
        id: 'dive_site',
        accessorKey: 'dive_site.name',
        header: 'Dive Site',
        cell: ({ row }) => {
          const dive = row.original;
          return dive.dive_site ? (
            <div className='flex items-center'>
              <MapPin className='h-4 w-4 text-gray-400 mr-2' />
              <span className='text-sm text-gray-900'>{dive.dive_site.name}</span>
            </div>
          ) : (
            <span className='text-sm text-gray-500'>No dive site</span>
          );
        },
        enableSorting: false,
        size: 180,
      },
      {
        id: 'date',
        accessorKey: 'dive_date',
        header: 'Date',
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <div className='flex items-center'>
              <Calendar className='h-4 w-4 text-gray-400 mr-2' />
              <span className='text-sm text-gray-900'>{dive.dive_date}</span>
            </div>
          );
        },
        enableSorting: true,
        size: 120,
      },
      {
        id: 'rating',
        accessorKey: 'user_rating',
        header: 'Rating',
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <span className='text-sm text-gray-900'>
              {dive.user_rating ? `${dive.user_rating}/10` : 'N/A'}
            </span>
          );
        },
        enableSorting: true,
        size: 100,
      },
      {
        id: 'privacy',
        accessorKey: 'is_private',
        header: 'Privacy',
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                dive.is_private ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {dive.is_private ? 'Private' : 'Public'}
            </span>
          );
        },
        enableSorting: true,
        size: 100,
      },
      {
        id: 'views',
        accessorKey: 'view_count',
        header: 'Views',
        cell: ({ row }) => {
          const dive = row.original;
          return <span className='text-sm text-gray-900'>{dive.view_count || 0}</span>;
        },
        enableSorting: true,
        size: 80,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const dive = row.original;
          return (
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => handleEditDive(dive)}
                className='text-blue-600 hover:text-blue-900'
              >
                <Edit className='h-4 w-4' />
              </button>
              <button
                onClick={() => handleDeleteDive(dive)}
                className='text-red-600 hover:text-red-900'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          );
        },
        enableSorting: false,
        size: 100,
      },
    ],
    [rowSelection, dives]
  );

  // Handle pagination change
  const handlePaginationChange = updater => {
    setPagination(prev => {
      const newPagination = typeof updater === 'function' ? updater(prev) : updater;
      updateURL(newPagination);
      return newPagination;
    });
  };

  // Calculate pagination info
  const paginationInfo = useMemo(() => {
    const count = totalCount || 0;
    const pageCount = Math.ceil(count / pagination.pageSize);
    return { pageCount, totalCount: count };
  }, [totalCount, pagination.pageSize]);

  // Update pagination with pageCount
  const paginationWithCount = useMemo(
    () => ({
      ...pagination,
      pageCount: paginationInfo.pageCount,
      totalCount: paginationInfo.totalCount,
    }),
    [pagination, paginationInfo]
  );

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Dive Management</h1>
            <p className='text-gray-600 mt-2'>Manage all dives in the system</p>
            {totalCount !== undefined && (
              <p className='text-sm text-gray-500 mt-1'>Total dives: {totalCount}</p>
            )}
          </div>
          <div className='flex items-center space-x-4'>
            {Object.keys(rowSelection).length > 0 && (
              <button
                onClick={handleMassDelete}
                disabled={massDeleteMutation.isLoading}
                className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2'
              >
                {massDeleteMutation.isLoading ? (
                  <Loader className='h-4 w-4 animate-spin' />
                ) : (
                  <Trash2 className='h-4 w-4' />
                )}
                <span>Delete Selected ({Object.keys(rowSelection).length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className='mb-4 sm:mb-6 bg-gray-50 p-3 sm:p-4 rounded-lg'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold'>Filters</h3>
          <button onClick={clearFilters} className='text-sm text-gray-600 hover:text-gray-800'>
            Clear Filters
          </button>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <div>
            <label htmlFor='user-filter' className='block text-sm font-medium text-gray-700 mb-1'>
              User
            </label>
            <select
              id='user-filter'
              value={filters.user_id}
              onChange={e => handleFilterChange('user_id', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Users</option>
              {users?.map(user => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor='dive-site-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Dive Site
            </label>
            <select
              id='dive-site-filter'
              value={filters.dive_site_id}
              onChange={e => handleFilterChange('dive_site_id', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Dive Sites</option>
              {diveSites?.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor='dive-site-name-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Dive Site Name (Search)
            </label>
            <input
              id='dive-site-name-filter'
              type='text'
              placeholder='Search dive site names...'
              value={filters.dive_site_name}
              onChange={e => handleFilterChange('dive_site_name', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
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
              htmlFor='suit-type-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Suit Type
            </label>
            <select
              id='suit-type-filter'
              value={filters.suit_type}
              onChange={e => handleFilterChange('suit_type', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Suit Types</option>
              <option value='wet_suit'>Wet Suit</option>
              <option value='dry_suit'>Dry Suit</option>
              <option value='shortie'>Shortie</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className='mb-4 sm:mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
          <input
            type='text'
            placeholder='Search dives by name, user, dive site, or notes...'
            value={searchInput}
            onChange={e => {
              const value = e.target.value;
              setSearchInput(value); // Update input immediately for visual feedback
              debouncedSearch(value); // Debounce the filter update
            }}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setFilters(prev => ({ ...prev, search: '' }));
                const newPagination = { ...pagination, pageIndex: 0 };
                updateURL(newPagination);
                setPagination(newPagination);
              }}
              className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>
      </div>

      {/* Table Toolbar */}
      <div className='mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
        {/* Column Visibility Toggle */}
        <div className='relative'>
          <button
            className='flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700 w-full sm:w-auto'
            onClick={e => {
              e.stopPropagation();
              const menu = document.getElementById('column-visibility-menu');
              if (menu) {
                menu.classList.toggle('hidden');
              }
            }}
          >
            <Columns className='h-4 w-4' />
            Columns
          </button>
          <div
            id='column-visibility-menu'
            className='hidden absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50'
            onClick={e => e.stopPropagation()}
          >
            <div className='p-2'>
              <div className='text-xs font-semibold text-gray-500 uppercase mb-2 px-2'>
                Toggle Columns
              </div>
              {columns
                .filter(col => {
                  const colId = col.id || col.accessorKey;
                  return colId !== 'select' && colId !== 'actions';
                })
                .map(column => {
                  const columnId = column.id || column.accessorKey;
                  const isVisible = columnVisibility[columnId] !== false;
                  return (
                    <label
                      key={columnId}
                      className='flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded'
                    >
                      <input
                        type='checkbox'
                        checked={isVisible}
                        onChange={e => {
                          setColumnVisibility(prev => ({
                            ...prev,
                            [columnId]: e.target.checked,
                          }));
                        }}
                        className='mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                      />
                      <span className='text-sm text-gray-700'>
                        {typeof column.header === 'string'
                          ? column.header
                          : columnId.charAt(0).toUpperCase() + columnId.slice(1).replace(/_/g, ' ')}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto'>
          <button
            onClick={async () => {
              try {
                toast.loading('Exporting current page...', { id: 'export-toast' });
                const headers = [
                  'ID',
                  'Name',
                  'User',
                  'Dive Site',
                  'Date',
                  'Rating',
                  'Privacy',
                  'Views',
                ];
                // Use dives from API (already filtered and sorted server-side)
                const rows = (dives || []).map(dive => [
                  dive.id,
                  dive.name || '',
                  dive.user_username || '',
                  dive.dive_site?.name || 'No dive site',
                  dive.dive_date || '',
                  dive.user_rating ? `${dive.user_rating}/10` : 'N/A',
                  dive.is_private ? 'Private' : 'Public',
                  dive.view_count || 0,
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map(row =>
                    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                  ),
                ].join('\n');

                // eslint-disable-next-line no-undef
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                // eslint-disable-next-line no-undef
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute(
                  'download',
                  `dives-page-${pagination.pageIndex + 1}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${rows.length} dives to CSV`, { id: 'export-toast' });
              } catch (error) {
                toast.error('Failed to export CSV', { id: 'export-toast' });
              }
            }}
            className='flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium w-full sm:w-auto'
          >
            <Download className='h-4 w-4' />
            <span className='hidden sm:inline'>Export Page</span>
            <span className='sm:hidden'>Export Page</span>
          </button>
          <button
            onClick={async () => {
              try {
                const count = totalCount || 0;
                if (count === 0) {
                  toast.error('No dives to export');
                  return;
                }

                if (
                  !window.confirm(
                    `This will export all ${count.toLocaleString()} dives. This may take a moment. Continue?`
                  )
                ) {
                  return;
                }

                toast.loading(`Exporting all ${count.toLocaleString()} dives...`, {
                  id: 'export-all-toast',
                });

                // Fetch all dives using limit=1000 (max allowed)
                const allDives = [];
                let offset = 0;
                const limit = 1000;
                let hasMore = true;

                // Get sort parameters
                const sortParams = getSortParams();

                while (hasMore) {
                  const params = new URLSearchParams();
                  params.append('limit', limit.toString());
                  params.append('offset', offset.toString());

                  // Add filters
                  Object.entries(filters).forEach(([key, value]) => {
                    if (value) params.append(key, value);
                  });

                  // Add sorting
                  if (sortParams.sort_by) {
                    params.append('sort_by', sortParams.sort_by);
                    params.append('sort_order', sortParams.sort_order);
                  }

                  const response = await api.get(`/api/v1/dives/admin/dives?${params.toString()}`);
                  const pageData = response.data;

                  if (pageData && pageData.length > 0) {
                    allDives.push(...pageData);
                    offset += limit;
                    hasMore = pageData.length === limit;
                  } else {
                    hasMore = false;
                  }
                }

                // Export to CSV
                const headers = [
                  'ID',
                  'Name',
                  'User',
                  'Dive Site',
                  'Date',
                  'Rating',
                  'Privacy',
                  'Views',
                ];
                const rows = allDives.map(dive => [
                  dive.id,
                  dive.name || '',
                  dive.user_username || '',
                  dive.dive_site?.name || 'No dive site',
                  dive.dive_date || '',
                  dive.user_rating ? `${dive.user_rating}/10` : 'N/A',
                  dive.is_private ? 'Private' : 'Public',
                  dive.view_count || 0,
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map(row =>
                    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                  ),
                ].join('\n');

                // eslint-disable-next-line no-undef
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                // eslint-disable-next-line no-undef
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute(
                  'download',
                  `dives-all-${count}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported all ${allDives.length.toLocaleString()} dives to CSV`, {
                  id: 'export-all-toast',
                });
              } catch (error) {
                console.error('Export error:', error);
                toast.error('Failed to export all dives. Please try again.', {
                  id: 'export-all-toast',
                });
              }
            }}
            className='flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium w-full sm:w-auto'
          >
            <Download className='h-4 w-4' />
            <span>Export All</span>
          </button>
        </div>
      </div>

      {/* Dives Table */}
      <AdminDivesTable
        data={dives || []}
        columns={columns}
        pagination={paginationWithCount}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        onEdit={handleEditDive}
        onDelete={handleDeleteDive}
        isLoading={isLoading}
      />

      {/* Edit Dive Modal */}
      {showEditDiveModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-xl font-semibold'>Edit Dive</h2>
              <button
                onClick={() => setShowEditDiveModal(false)}
                className='text-gray-400 hover:text-gray-600'
              >
                <X className='h-6 w-6' />
              </button>
            </div>

            <form onSubmit={handleSubmit(onUpdateSubmit)}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='edit-dive-name'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Name
                  </label>
                  <input
                    id='edit-dive-name'
                    type='text'
                    {...register('name')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && (
                    <p className='mt-1 text-xs text-red-500'>{getErrorMessage(errors.name)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='edit-dive-site'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Dive Site
                  </label>
                  <select
                    id='edit-dive-site'
                    {...register('dive_site_id')}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>No dive site</option>
                    {diveSites?.map(site => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='edit-dive-date'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Date
                  </label>
                  <input
                    id='edit-dive-date'
                    type='date'
                    {...register('dive_date')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.dive_date ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.dive_date && (
                    <p className='mt-1 text-xs text-red-500'>{getErrorMessage(errors.dive_date)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='edit-dive-time'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Time
                  </label>
                  <input
                    id='edit-dive-time'
                    type='time'
                    {...register('dive_time')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.dive_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.dive_time && (
                    <p className='mt-1 text-xs text-red-500'>{getErrorMessage(errors.dive_time)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='edit-max-depth'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Max Depth (m)
                  </label>
                  <input
                    id='edit-max-depth'
                    type='number'
                    step='any'
                    {...register('max_depth')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.max_depth ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.max_depth && (
                    <p className='mt-1 text-xs text-red-500'>{getErrorMessage(errors.max_depth)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='edit-duration'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Duration (min)
                  </label>
                  <input
                    id='edit-duration'
                    type='number'
                    {...register('duration')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.duration ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.duration && (
                    <p className='mt-1 text-xs text-red-500'>{getErrorMessage(errors.duration)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='edit-difficulty'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Difficulty
                  </label>
                  <select
                    id='edit-difficulty'
                    {...register('difficulty_code')}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select difficulty</option>
                    {getDifficultyOptions().map(option => (
                      <option key={option.value} value={option.value || ''}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='edit-suit-type'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Suit Type
                  </label>
                  <select
                    id='edit-suit-type'
                    {...register('suit_type')}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select suit type</option>
                    <option value='wet_suit'>Wet Suit</option>
                    <option value='dry_suit'>Dry Suit</option>
                    <option value='shortie'>Shortie</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='edit-user-rating'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    User Rating (1-10)
                  </label>
                  <input
                    id='edit-user-rating'
                    type='number'
                    min='1'
                    max='10'
                    {...register('user_rating')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.user_rating ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.user_rating && (
                    <p className='mt-1 text-xs text-red-500'>
                      {getErrorMessage(errors.user_rating)}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='edit-visibility-rating'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Visibility Rating (1-10)
                  </label>
                  <input
                    id='edit-visibility-rating'
                    type='number'
                    min='1'
                    max='10'
                    {...register('visibility_rating')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.visibility_rating ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.visibility_rating && (
                    <p className='mt-1 text-xs text-red-500'>
                      {getErrorMessage(errors.visibility_rating)}
                    </p>
                  )}
                </div>

                <div className='md:col-span-2'>
                  <label
                    htmlFor='edit-dive-info'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Dive Information
                  </label>
                  <textarea
                    id='edit-dive-info'
                    {...register('dive_information')}
                    rows='3'
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>

                <div className='md:col-span-2'>
                  <label htmlFor='edit-is-private' className='flex items-center'>
                    <input
                      id='edit-is-private'
                      type='checkbox'
                      {...register('is_private')}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2'
                    />
                    <span className='text-sm font-medium text-gray-700'>Private dive</span>
                  </label>
                </div>
              </div>

              <div className='flex justify-end space-x-3 mt-6'>
                <button
                  type='button'
                  onClick={() => setShowEditDiveModal(false)}
                  className='px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={updateDiveMutation.isLoading}
                  className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2'
                >
                  {updateDiveMutation.isLoading ? (
                    <Loader className='h-4 w-4 animate-spin' />
                  ) : (
                    <Save className='h-4 w-4' />
                  )}
                  <span>Update Dive</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDives;
