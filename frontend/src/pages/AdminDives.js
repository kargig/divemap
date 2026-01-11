import {
  Dropdown,
  Menu,
  Checkbox,
  Button as AntdButton,
  Select as AntdSelect,
  ConfigProvider,
} from 'antd';
import {
  Trash2,
  Edit,
  Search,
  X,
  Loader,
  Anchor,
  Calendar,
  User,
  MapPin,
  Download,
  Columns,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';

import api from '../api';
import AdminDivesTable from '../components/tables/AdminDivesTable';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getDifficultyOptions } from '../utils/difficultyHelpers';

const AdminDives = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Set page title
  usePageTitle('Divemap - Admin - Dives');
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [diveSiteSearchTerm, setDiveSiteSearchTerm] = useState('');
  const [diveSiteSearchResults, setDiveSiteSearchResults] = useState([]);
  const [isDiveSiteLoading, setIsDiveSiteLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    user_id: '',
    dive_site_ids: [],
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
        if (key === 'dive_site_ids') {
          if (value && value.length > 0) {
            params.append('dive_site_ids', value.join(','));
          }
        } else if (value) {
          params.append(key, value);
        }
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
      dive: 'name',
      name: 'name',
      user: 'user_username',
      user_username: 'user_username',
      dive_site: 'dive_site_name',
      'dive_site.name': 'dive_site_name',
      date: 'dive_date',
      dive_date: 'dive_date',
      max_depth: 'max_depth',
      duration: 'duration',
      rating: 'user_rating',
      user_rating: 'user_rating',
      visibility_rating: 'visibility_rating',
      views: 'view_count',
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
        if (key === 'dive_site_ids') {
          if (value && value.length > 0) {
            params.append('dive_site_ids', value.join(','));
          }
        } else if (value) {
          params.append(key, value);
        }
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

  // Fetch dive sites for combobox (async)
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Always fetch something initially or when term changes
      // If term is empty, maybe fetch recent? For now, we rely on user typing.
      // Antd select needs options.
      if (diveSiteSearchTerm.trim().length >= 2) {
        setIsDiveSiteLoading(true);
        try {
          const response = await api.get('/api/v1/dive-sites/', {
            params: { search: diveSiteSearchTerm, limit: 20 },
          });
          setDiveSiteSearchResults(response.data);
        } catch (error) {
          console.error('Failed to search dive sites:', error);
        } finally {
          setIsDiveSiteLoading(false);
        }
      } else if (diveSiteSearchTerm.length === 0 && filters.dive_site_ids.length === 0) {
        setDiveSiteSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [diveSiteSearchTerm, filters.dive_site_ids.length]);

  // Fetch users for dropdown
  const { data: users } = useQuery(['admin-users'], () => api.get('/api/v1/users/admin/users'), {
    select: response => response.data,
  });

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
    navigate(`/dives/${dive.id}/edit`);
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
      dive_site_ids: [],
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
    setDiveSiteSearchTerm('');
    setDiveSiteSearchResults([]);
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
        enableSorting: true,
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
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${dive.is_private ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
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
    [rowSelection, dives, navigate]
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

  // Close custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      const container = document.getElementById('dive-site-filter-container');
      if (container && !container.contains(event.target)) {
        setDiveSiteSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const diveSiteOptions = useMemo(() => {
    return diveSiteSearchResults.map(s => ({
      value: s.id.toString(),
      label: s.name,
    }));
  }, [diveSiteSearchResults]);

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
          <div className='flex flex-col gap-1'>
            <label htmlFor='user-filter-select' className='text-sm font-medium text-gray-700'>
              User
            </label>
            <AntdSelect
              id='user-filter-select'
              showSearch
              placeholder='All Users'
              value={filters.user_id || undefined}
              onChange={value => handleFilterChange('user_id', value || '')}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={[
                { value: '', label: 'All Users' },
                ...(users?.map(u => ({ value: u.id.toString(), label: u.username })) || []),
              ]}
              allowClear
              className='w-full'
              style={{ height: '40px' }}
            />
          </div>

          <div className='flex flex-col gap-1 relative' id='dive-site-filter-container'>
            <label htmlFor='dive-site-input' className='text-sm font-medium text-gray-700'>
              Dive Site
            </label>
            <div className='relative'>
              <div
                className='flex flex-wrap gap-1 p-1 border border-gray-300 rounded-md bg-white min-h-[40px] items-center cursor-text'
                onClick={() => document.getElementById('dive-site-input')?.focus()}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    document.getElementById('dive-site-input')?.focus();
                  }
                }}
                role='button'
                tabIndex={0}
              >
                {filters.dive_site_ids &&
                  filters.dive_site_ids.length > 0 &&
                  filters.dive_site_ids.map(id => {
                    // Find label in options or results (best effort)
                    const option = diveSiteOptions.find(o => o.value === id) || { label: id };
                    return (
                      <span
                        key={id}
                        className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center'
                      >
                        {option.label}
                        <X
                          className='h-3 w-3 ml-1 cursor-pointer hover:text-blue-900'
                          onClick={e => {
                            e.stopPropagation();
                            handleFilterChange(
                              'dive_site_ids',
                              filters.dive_site_ids.filter(sid => sid !== id)
                            );
                          }}
                        />
                      </span>
                    );
                  })}
                <input
                  id='dive-site-input'
                  type='text'
                  className='flex-1 min-w-[120px] outline-none text-sm px-2 py-1'
                  placeholder={filters.dive_site_ids?.length > 0 ? '' : 'Search dive sites...'}
                  value={diveSiteSearchTerm}
                  onChange={e => {
                    setDiveSiteSearchTerm(e.target.value);
                  }}
                  autoComplete='off'
                />
                {isDiveSiteLoading && (
                  <Loader className='h-4 w-4 animate-spin text-gray-400 mr-2' />
                )}
              </div>

              {/* Custom Dropdown */}
              {(diveSiteSearchResults.length > 0 || isDiveSiteLoading) &&
                diveSiteSearchTerm.length > 0 && (
                  <div className='absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto'>
                    {diveSiteSearchResults.map(site => {
                      const isSelected = filters.dive_site_ids?.includes(site.id.toString());
                      return (
                        <div
                          key={site.id}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center justify-between ${isSelected ? 'bg-blue-50' : ''}`}
                          onClick={() => {
                            const currentIds = filters.dive_site_ids || [];
                            const newIds = isSelected
                              ? currentIds.filter(id => id !== site.id.toString())
                              : [...currentIds, site.id.toString()];
                            handleFilterChange('dive_site_ids', newIds);
                            setDiveSiteSearchTerm(''); // Clear search on select
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              const currentIds = filters.dive_site_ids || [];
                              const newIds = isSelected
                                ? currentIds.filter(id => id !== site.id.toString())
                                : [...currentIds, site.id.toString()];
                              handleFilterChange('dive_site_ids', newIds);
                              setDiveSiteSearchTerm('');
                            }
                          }}
                          role='button'
                          tabIndex={0}
                        >
                          <span>{site.name}</span>
                          {isSelected && <Checkbox checked />}
                        </div>
                      );
                    })}
                    {!isDiveSiteLoading && diveSiteSearchResults.length === 0 && (
                      <div className='px-4 py-2 text-sm text-gray-500'>No results found</div>
                    )}
                  </div>
                )}
            </div>
          </div>

          <div className='flex flex-col gap-1'>
            <label htmlFor='difficulty-filter-select' className='text-sm font-medium text-gray-700'>
              Difficulty
            </label>
            <AntdSelect
              id='difficulty-filter-select'
              placeholder='All Difficulties'
              value={filters.difficulty_code || undefined}
              onChange={value => handleFilterChange('difficulty_code', value || '')}
              options={[
                { value: '', label: 'All Difficulties' },
                ...getDifficultyOptions()
                  .filter(option => option.value !== null)
                  .map(opt => ({ value: opt.value, label: opt.label })),
              ]}
              allowClear
              className='w-full'
              style={{ height: '40px' }}
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label htmlFor='suit-type-filter-select' className='text-sm font-medium text-gray-700'>
              Suit Type
            </label>
            <AntdSelect
              id='suit-type-filter-select'
              placeholder='All Suit Types'
              value={filters.suit_type || undefined}
              onChange={value => handleFilterChange('suit_type', value || '')}
              options={[
                { value: '', label: 'All Suit Types' },
                { value: 'wet_suit', label: 'Wet Suit' },
                { value: 'dry_suit', label: 'Dry Suit' },
                { value: 'shortie', label: 'Shortie' },
              ]}
              allowClear
              className='w-full'
              style={{ height: '40px' }}
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
              step='1'
              placeholder='0'
              value={filters.min_rating}
              onChange={e => handleFilterChange('min_rating', e.target.value)}
              onKeyDown={e => {
                if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === ',') {
                  e.preventDefault();
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                filters.min_rating && (filters.min_rating < 0 || filters.min_rating > 10)
                  ? 'border-red-500 ring-1 ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {filters.min_rating && (filters.min_rating < 0 || filters.min_rating > 10) && (
              <p className='text-red-500 text-xs mt-1'>Rating must be 0-10</p>
            )}
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
              step='1'
              placeholder='10'
              value={filters.max_rating}
              onChange={e => handleFilterChange('max_rating', e.target.value)}
              onKeyDown={e => {
                if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === ',') {
                  e.preventDefault();
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                filters.max_rating && (filters.max_rating < 0 || filters.max_rating > 10)
                  ? 'border-red-500 ring-1 ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {filters.max_rating && (filters.max_rating < 0 || filters.max_rating > 10) && (
              <p className='text-red-500 text-xs mt-1'>Rating must be 0-10</p>
            )}
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
        {/* Column Visibility Toggle (Ant Design) */}
        <Dropdown
          trigger={['click']}
          menu={{
            items: columns
              .filter(col => {
                const colId = col.id || col.accessorKey;
                return colId !== 'select' && colId !== 'actions';
              })
              .map(column => {
                const columnId = column.id || column.accessorKey;
                const isVisible = columnVisibility[columnId] !== false;
                return {
                  key: columnId,
                  label: (
                    <Checkbox
                      checked={isVisible}
                      onClick={e => e.stopPropagation()} // Prevent menu close on click
                      onChange={e => {
                        setColumnVisibility(prev => ({
                          ...prev,
                          [columnId]: e.target.checked,
                        }));
                      }}
                    >
                      {typeof column.header === 'string'
                        ? column.header
                        : columnId.charAt(0).toUpperCase() + columnId.slice(1).replace(/_/g, ' ')}
                    </Checkbox>
                  ),
                };
              }),
          }}
        >
          <AntdButton icon={<Columns className='h-4 w-4' />} className='flex items-center gap-2'>
            Columns
          </AntdButton>
        </Dropdown>

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
    </div>
  );
};

export default AdminDives;
