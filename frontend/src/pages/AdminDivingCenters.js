import { Plus, Edit, Trash2, Eye, Search, X, Download, Columns } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import AdminDivingCentersTable from '../components/tables/AdminDivingCentersTable';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { useSetting, useUpdateSetting } from '../hooks/useSettings';
import { slugify } from '../utils/slugify';

const AdminDivingCenters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Diving Centers');
  const [searchParams, setSearchParams] = useSearchParams();

  // TanStack Table state
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: parseInt(searchParams.get('page')) - 1 || 0,
    pageSize: parseInt(searchParams.get('page_size')) || 25,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({
    id: true,
    select: true,
    name: true,
    owner_username: true, // Enabled by default
    country: true, // Enabled by default
    region: true, // Enabled by default
    city: true, // Enabled by default
    view_count: true,
    contact: false, // Hidden by default
    location: false, // Hidden by default
    average_rating: false, // Hidden by default
    created_at: false, // Hidden by default
    actions: true,
  });

  // Filters
  const [filters, setFilters] = useState({
    name: '',
  });

  // Local search input state for immediate visual feedback
  const [searchInput, setSearchInput] = useState(filters.name || '');

  // Settings hooks
  const { data: reviewsDisabledSetting, isLoading: isLoadingSetting } = useSetting(
    'disable_diving_center_reviews'
  );
  const updateSettingMutation = useUpdateSetting();

  // Calculate if reviews are enabled (inverted logic: setting value true = disabled)
  const reviewsEnabled = reviewsDisabledSetting?.value === false;
  const isUpdatingSetting = updateSettingMutation.isLoading;

  // Handle setting toggle
  const handleToggleReviews = () => {
    const currentSettingValue = reviewsDisabledSetting?.value ?? false;
    const newValue = !currentSettingValue;
    updateSettingMutation.mutate(
      { key: 'disable_diving_center_reviews', value: newValue },
      {
        onSuccess: () => {
          toast.success(
            newValue
              ? 'Diving center reviews have been disabled'
              : 'Diving center reviews have been enabled'
          );
        },
        onError: error => {
          toast.error(
            `Failed to update setting: ${error.response?.data?.detail || 'Unknown error'}`
          );
        },
      }
    );
  };

  // Close column visibility menu when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      const menu = document.getElementById('column-visibility-menu');
      const button = event.target.closest('button');
      if (menu && !menu.contains(event.target) && button?.textContent !== 'Columns') {
        menu.classList.add('hidden');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search handler - updates filters after user stops typing
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId;
      return searchTerm => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setFilters(prev => ({ ...prev, name: searchTerm }));
          setPagination(prev => ({ ...prev, pageIndex: 0 }));
        }, 500);
      };
    })(),
    []
  );

  // Sync searchInput with filters.name when filters change externally
  useEffect(() => {
    setSearchInput(filters.name);
  }, [filters.name]);

  // Update URL when pagination changes
  const updateURL = newPagination => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', (newPagination.pageIndex + 1).toString());
    newSearchParams.set('page_size', newPagination.pageSize.toString());
    setSearchParams(newSearchParams);
  };

  // Map frontend column IDs to backend API sort field names
  const mapColumnIdToSortField = columnId => {
    const fieldMapping = {
      id: null, // ID sorting not supported by backend
      name: 'name',
      view_count: 'view_count',
      country: 'country',
      region: 'region',
      city: 'city',
      created_at: 'created_at',
      updated_at: 'updated_at',
      average_rating: null, // Average rating sorting not supported by backend
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

  // Fetch diving centers data
  const { data: divingCenters, isLoading } = useQuery(
    ['admin-diving-centers', pagination, filters, sorting],
    () => {
      const params = new URLSearchParams();
      params.append('page', (pagination.pageIndex + 1).toString());
      params.append('page_size', pagination.pageSize.toString());

      // Add sorting
      const sortParams = getSortParams();
      if (sortParams.sort_by) {
        params.append('sort_by', sortParams.sort_by);
        params.append('sort_order', sortParams.sort_order);
      }

      // Add filters
      if (filters.name) params.append('name', filters.name);

      return api.get(`/api/v1/diving-centers/?${params.toString()}`);
    },
    {
      select: response => {
        // Get pagination info from headers
        const getHeader = name => {
          return (
            response.headers[name] ||
            response.headers[name.toLowerCase()] ||
            response.headers[name.toUpperCase()] ||
            '0'
          );
        };

        const totalCount = parseInt(getHeader('x-total-count'));
        const totalPages = parseInt(getHeader('x-total-pages'));

        // Store pagination info
        queryClient.setQueryData(['admin-diving-centers-pagination'], {
          totalCount,
          totalPages,
        });

        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Get pagination info
  const paginationInfo = queryClient.getQueryData(['admin-diving-centers-pagination']) || {
    totalCount: 0,
    totalPages: 0,
  };

  // Handle pagination change
  const handlePaginationChange = updater => {
    setPagination(prev => {
      const newPagination = typeof updater === 'function' ? updater(prev) : updater;
      updateURL(newPagination);
      return newPagination;
    });
  };

  // Delete mutations
  const deleteDivingCenterMutation = useMutation(id => api.delete(`/api/v1/diving-centers/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-diving-centers']);
      toast.success('Diving center deleted successfully!');
    },
    onError: () => {
      toast.error('Failed to delete diving center');
    },
  });

  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/diving-centers/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-diving-centers']);
        setRowSelection({});
        toast.success(`${Object.keys(rowSelection).length} diving center(s) deleted successfully!`);
      },
      onError: () => {
        toast.error('Failed to delete some diving centers');
      },
    }
  );

  // Action handlers
  const handleViewDivingCenter = divingCenter => {
    navigate(`/diving-centers/${divingCenter.id}/${slugify(divingCenter.name)}`);
  };

  const handleEditDivingCenter = divingCenter => {
    navigate(`/diving-centers/${divingCenter.id}/edit`);
  };

  const handleDeleteDivingCenter = divingCenter => {
    if (
      window.confirm(`Are you sure you want to delete the diving center "${divingCenter.name}"?`)
    ) {
      deleteDivingCenterMutation.mutate(divingCenter.id);
    }
  };

  const handleMassDelete = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    const itemNames = selectedIds
      .map(id => divingCenters?.find(center => center.id === parseInt(id))?.name)
      .filter(Boolean);

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedIds.length} diving center(s)?\n\n${itemNames.join('\n')}`
      )
    ) {
      massDeleteMutation.mutate(selectedIds.map(id => parseInt(id)));
    }
  };

  // Column definitions
  const columns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        enableSorting: false, // Backend doesn't support sorting by ID
        size: 60,
      },
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type='checkbox'
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
          />
        ),
        cell: ({ row }) => (
          <input
            type='checkbox'
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
          />
        ),
        size: 40,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        size: 250,
        cell: ({ row }) => (
          <div className='max-w-[250px]'>
            <div className='text-sm font-medium text-gray-900 break-words'>{row.original.name}</div>
            {row.original.description && (
              <div className='text-xs text-gray-500 break-words line-clamp-2 mt-1'>
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'owner_username',
        header: 'Owner',
        enableSorting: false, // Backend doesn't support sorting by owner_username
        size: 120,
        cell: ({ row }) => {
          const owner = row.original.owner_username;
          return owner ? (
            <span className='font-medium text-blue-600 text-sm'>{owner}</span>
          ) : (
            <span className='text-gray-400 italic text-sm'>Unclaimed</span>
          );
        },
      },
      {
        accessorKey: 'country',
        header: 'Country',
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const country = row.original.country;
          return <span className='text-sm whitespace-nowrap'>{country || 'N/A'}</span>;
        },
      },
      {
        accessorKey: 'region',
        header: 'Region',
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const region = row.original.region;
          return <span className='text-sm whitespace-nowrap'>{region || 'N/A'}</span>;
        },
      },
      {
        accessorKey: 'city',
        header: 'City',
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const city = row.original.city;
          return <span className='text-sm whitespace-nowrap'>{city || 'N/A'}</span>;
        },
      },
      {
        accessorKey: 'view_count',
        header: 'Views',
        enableSorting: true,
        size: 80,
        cell: ({ row }) => {
          const count = row.original.view_count;
          return (
            <span className='text-sm'>{count !== undefined ? count.toLocaleString() : 'N/A'}</span>
          );
        },
      },
      {
        id: 'contact',
        header: 'Contact',
        enableSorting: false,
        size: 180,
        cell: ({ row }) => (
          <div>
            <div className='text-sm text-gray-900'>{row.original.email || 'N/A'}</div>
            {row.original.phone && (
              <div className='text-xs text-gray-500'>{row.original.phone}</div>
            )}
          </div>
        ),
      },
      {
        id: 'location',
        header: 'Location',
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const center = row.original;
          if (center.latitude && center.longitude) {
            return (
              <div>
                <div className='text-sm text-gray-900'>
                  {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
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
            );
          }
          return <span className='text-sm text-gray-500'>N/A</span>;
        },
      },
      {
        accessorKey: 'average_rating',
        header: 'Rating',
        enableSorting: false, // Backend doesn't support sorting by average_rating
        size: 100,
        cell: ({ row }) => {
          const rating = row.original.average_rating;
          return (
            <span className='text-sm'>{rating ? `${rating.toFixed(1)}/10` : 'No ratings'}</span>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created At',
        enableSorting: true,
        size: 140,
        cell: ({ row }) => {
          const createdAt = row.original.created_at;
          if (!createdAt) return <span className='text-sm text-gray-400'>N/A</span>;
          try {
            const date = new Date(createdAt);
            return (
              <span className='text-sm whitespace-nowrap' title={date.toLocaleString()}>
                {date.toLocaleDateString()}
              </span>
            );
          } catch {
            return <span className='text-sm text-gray-400'>Invalid</span>;
          }
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 100,
        cell: ({ row }) => {
          const center = row.original;
          return (
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
          );
        },
      },
    ],
    []
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
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6'>
        <div className='flex-1 min-w-0'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>
            Diving Centers Management
          </h1>
          <p className='text-sm sm:text-base text-gray-600 mt-1 sm:mt-2'>
            Manage all diving centers in the system
          </p>
          {paginationInfo.totalCount !== undefined && (
            <p className='text-xs sm:text-sm text-gray-500 mt-1'>
              Total diving centers: {paginationInfo.totalCount}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/diving-centers/create')}
          className='flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 mr-2' />
          <span className='hidden sm:inline'>Add Diving Center</span>
          <span className='sm:hidden'>Add Center</span>
        </button>
      </div>

      {/* Settings Section */}
      <div className='mb-4 sm:mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <div className='flex items-center'>
              <input
                type='checkbox'
                id='reviews-toggle'
                checked={!reviewsEnabled}
                onChange={handleToggleReviews}
                disabled={isLoadingSetting || isUpdatingSetting}
                className='w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
              />
              <label
                htmlFor='reviews-toggle'
                className='ml-3 text-sm font-medium text-gray-900 cursor-pointer'
              >
                Disable Diving Center Reviews
              </label>
            </div>
            {(isLoadingSetting || isUpdatingSetting) && (
              <div className='flex items-center text-sm text-gray-500'>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2'></div>
                {isUpdatingSetting ? 'Updating...' : 'Loading...'}
              </div>
            )}
          </div>
          <div className='text-sm text-gray-600'>
            {reviewsEnabled
              ? 'Reviews and ratings are currently enabled'
              : 'Reviews and ratings are currently disabled'}
          </div>
        </div>
        <p className='mt-2 text-xs text-gray-500'>
          When disabled, users will not be able to submit or view ratings and comments for diving
          centers.
        </p>
      </div>

      {/* Mass Delete Button */}
      {Object.keys(rowSelection).length > 0 && (
        <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <span className='text-red-800 font-medium'>
                {Object.keys(rowSelection).length} item(s) selected
              </span>
            </div>
            <button
              onClick={handleMassDelete}
              disabled={massDeleteMutation.isLoading}
              className='flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Delete Selected ({Object.keys(rowSelection).length})
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className='mb-4 sm:mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
          <input
            type='text'
            placeholder='Search diving centers by name...'
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
                setFilters(prev => ({ ...prev, name: '' }));
                setPagination(prev => ({ ...prev, pageIndex: 0 }));
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
                  'Description',
                  'Email',
                  'Phone',
                  'Website',
                  'Location',
                  'Rating',
                  'Views',
                  'Country',
                  'Region',
                  'City',
                ];
                const rows = (divingCenters || []).map(center => [
                  center.id,
                  center.name || '',
                  center.description || '',
                  center.email || '',
                  center.phone || '',
                  center.website || '',
                  center.latitude && center.longitude
                    ? `${center.latitude}, ${center.longitude}`
                    : '',
                  center.average_rating ? center.average_rating.toFixed(1) : 'No ratings',
                  center.view_count || 0,
                  center.country || '',
                  center.region || '',
                  center.city || '',
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
                  `diving-centers-page-${pagination.pageIndex + 1}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${rows.length} diving centers to CSV`, {
                  id: 'export-toast',
                });
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
                const totalCount = paginationInfo.totalCount || 0;
                if (totalCount === 0) {
                  toast.error('No diving centers to export');
                  return;
                }

                if (
                  !window.confirm(
                    `This will export all ${totalCount.toLocaleString()} diving centers. This may take a moment. Continue?`
                  )
                ) {
                  return;
                }

                toast.loading(`Exporting all ${totalCount.toLocaleString()} diving centers...`, {
                  id: 'export-all-toast',
                });

                // Fetch all diving centers using page_size=1000 (max allowed)
                const allDivingCenters = [];
                let currentPage = 1;
                let hasMore = true;

                while (hasMore) {
                  const params = new URLSearchParams();
                  params.append('page', currentPage.toString());
                  params.append('page_size', '1000'); // Max page size

                  // Add filters
                  if (filters.name) params.append('name', filters.name);

                  // Add sorting if any
                  const sortParams = getSortParams();
                  if (sortParams.sort_by) {
                    params.append('sort_by', sortParams.sort_by);
                    params.append('sort_order', sortParams.sort_order);
                  }

                  const response = await api.get(`/api/v1/diving-centers/?${params.toString()}`);
                  const pageData = response.data;

                  if (pageData && pageData.length > 0) {
                    allDivingCenters.push(...pageData);
                    currentPage++;

                    // Check if there's more data
                    const totalPages = parseInt(
                      response.headers['x-total-pages'] || response.headers['X-Total-Pages'] || '1'
                    );
                    hasMore = currentPage <= totalPages;
                  } else {
                    hasMore = false;
                  }
                }

                // Export to CSV
                const headers = [
                  'ID',
                  'Name',
                  'Description',
                  'Email',
                  'Phone',
                  'Website',
                  'Location',
                  'Rating',
                  'Views',
                  'Country',
                  'Region',
                  'City',
                ];
                const rows = allDivingCenters.map(center => [
                  center.id,
                  center.name || '',
                  center.description || '',
                  center.email || '',
                  center.phone || '',
                  center.website || '',
                  center.latitude && center.longitude
                    ? `${center.latitude}, ${center.longitude}`
                    : '',
                  center.average_rating ? center.average_rating.toFixed(1) : 'No ratings',
                  center.view_count || 0,
                  center.country || '',
                  center.region || '',
                  center.city || '',
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
                  `diving-centers-all-${totalCount}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(
                  `Exported all ${allDivingCenters.length.toLocaleString()} diving centers to CSV`,
                  { id: 'export-all-toast' }
                );
              } catch (error) {
                console.error('Export error:', error);
                toast.error('Failed to export all diving centers. Please try again.', {
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

      {/* TanStack Table */}
      <AdminDivingCentersTable
        data={divingCenters || []}
        columns={columns}
        pagination={{
          ...pagination,
          pageCount: paginationInfo.totalPages || 0,
          totalCount: paginationInfo.totalCount || 0,
        }}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        onView={handleViewDivingCenter}
        onEdit={handleEditDivingCenter}
        onDelete={handleDeleteDivingCenter}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AdminDivingCenters;
