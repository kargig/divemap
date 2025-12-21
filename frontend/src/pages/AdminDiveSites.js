import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
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
  Download,
  Columns,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import AdminDiveSitesTable from '../components/tables/AdminDiveSitesTable';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  getDifficultyLabel,
  getDifficultyColorClasses,
  getDifficultyOptions,
} from '../utils/difficultyHelpers';

const AdminDiveSites = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Dive Sites');
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
    created_by_username: true,
    difficulty_code: true,
    average_rating: true,
    view_count: true,
    tags: true,
    aliases: true,
    country: false, // Hidden by default
    region: false, // Hidden by default
    created_at: false, // Hidden by default
    actions: true,
  });

  // Filters (keep existing filter logic)
  const [filters, setFilters] = useState({
    name: '',
    difficulty_code: '',
    country: '',
    region: '',
    min_rating: '',
    max_rating: '',
  });

  // Local search input state for immediate visual feedback
  const [searchInput, setSearchInput] = useState(filters.name || '');

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

  // Sync searchInput with filters.name when filters change externally (e.g., clear filters)
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
      difficulty_code: 'difficulty_level', // Backend uses 'difficulty_level' not 'difficulty_code'
      average_rating: 'average_rating',
      view_count: 'view_count',
      created_at: 'created_at',
      updated_at: 'updated_at',
      country: 'country',
      region: 'region',
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

  // Fetch dive sites data
  const { data: diveSites, isLoading } = useQuery(
    ['admin-dive-sites', pagination, filters, sorting],
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
      if (filters.difficulty_code) params.append('difficulty_code', filters.difficulty_code);
      if (filters.country) params.append('country', filters.country);
      if (filters.region) params.append('region', filters.region);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);

      return api.get(`/api/v1/dive-sites/?${params.toString()}`);
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
        queryClient.setQueryData(['admin-dive-sites-pagination'], {
          totalCount,
          totalPages,
        });

        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Get pagination info
  const paginationInfo = queryClient.getQueryData(['admin-dive-sites-pagination']) || {
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

  // Filter handlers
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  };

  const clearFilters = () => {
    setSearchInput(''); // Clear search input immediately
    setFilters({
      name: '',
      difficulty_code: '',
      country: '',
      region: '',
      min_rating: '',
      max_rating: '',
    });
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  };

  // Delete mutations
  const deleteDiveSiteMutation = useMutation(id => api.delete(`/api/v1/dive-sites/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dive-sites']);
      toast.success('Dive site deleted successfully!');
    },
    onError: () => {
      toast.error('Failed to delete dive site');
    },
  });

  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/dive-sites/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-sites']);
        setRowSelection({});
        toast.success(`${Object.keys(rowSelection).length} dive site(s) deleted successfully!`);
      },
      onError: () => {
        toast.error('Failed to delete some dive sites');
      },
    }
  );

  // Action handlers
  const handleViewDiveSite = diveSite => {
    navigate(`/dive-sites/${diveSite.id}`);
  };

  const handleEditDiveSite = diveSite => {
    navigate(`/dive-sites/${diveSite.id}/edit`);
  };

  const handleDeleteDiveSite = diveSite => {
    if (window.confirm(`Are you sure you want to delete the dive site "${diveSite.name}"?`)) {
      deleteDiveSiteMutation.mutate(diveSite.id);
    }
  };

  const handleMassDelete = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    const itemNames = selectedIds
      .map(id => diveSites?.find(site => site.id === parseInt(id))?.name)
      .filter(Boolean);

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedIds.length} dive site(s)?\n\n${itemNames.join('\n')}`
      )
    ) {
      massDeleteMutation.mutate(selectedIds.map(id => parseInt(id)));
    }
  };

  // Column definitions with visibility support
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
        accessorKey: 'created_by_username',
        header: 'Creator',
        size: 120,
        cell: ({ row }) => {
          const site = row.original;
          return site.created_by_username ? (
            <span className='font-medium text-blue-600 text-sm'>{site.created_by_username}</span>
          ) : site.created_by ? (
            <span className='text-gray-500 text-sm' title={`User ID: ${site.created_by}`}>
              ID: {site.created_by}
            </span>
          ) : (
            <span className='text-gray-400 italic text-sm'>Unknown</span>
          );
        },
      },
      {
        accessorKey: 'difficulty_code',
        header: 'Difficulty',
        enableSorting: true,
        size: 140,
        cell: ({ row }) => {
          const site = row.original;
          return (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(site.difficulty_code)}`}
            >
              {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
            </span>
          );
        },
      },
      {
        accessorKey: 'average_rating',
        header: 'Rating',
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const rating = row.original.average_rating;
          return (
            <span className='text-sm'>{rating ? `${rating.toFixed(1)}/10` : 'No ratings'}</span>
          );
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
        id: 'tags',
        header: 'Tags',
        size: 150,
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-1 max-w-[150px]'>
            {row.original.tags?.slice(0, 2).map(tag => (
              <span
                key={tag.id}
                className='px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full'
              >
                {tag.name}
              </span>
            ))}
            {row.original.tags?.length > 2 && (
              <span className='px-1.5 py-0.5 text-xs text-gray-500'>
                +{row.original.tags.length - 2}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'aliases',
        header: 'Aliases',
        size: 150,
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-1 max-w-[150px]'>
            {row.original.aliases?.slice(0, 2).map(alias => (
              <span
                key={alias.id}
                className='px-1.5 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full'
              >
                {alias.alias}
                {alias.language && (
                  <span className='ml-1 text-xs text-purple-600'>({alias.language})</span>
                )}
              </span>
            ))}
            {row.original.aliases?.length > 2 && (
              <span className='px-1.5 py-0.5 text-xs text-gray-500'>
                +{row.original.aliases.length - 2}
              </span>
            )}
          </div>
        ),
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
          const site = row.original;
          return (
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
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>Dive Sites Management</h1>
          <p className='text-sm sm:text-base text-gray-600 mt-1 sm:mt-2'>
            Manage all dive sites in the system
          </p>
          {paginationInfo.totalCount !== undefined && (
            <p className='text-xs sm:text-sm text-gray-500 mt-1'>
              Total dive sites: {paginationInfo.totalCount}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/dive-sites/create')}
          className='flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 mr-2' />
          <span className='hidden sm:inline'>Add Dive Site</span>
          <span className='sm:hidden'>Add Site</span>
        </button>
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

      {/* Filters */}
      <div className='mb-4 sm:mb-6 bg-gray-50 p-3 sm:p-4 rounded-lg'>
        <div className='flex items-center justify-between mb-3 sm:mb-4'>
          <h3 className='text-base sm:text-lg font-semibold'>Filters</h3>
          <button
            onClick={clearFilters}
            className='text-xs sm:text-sm text-gray-600 hover:text-gray-800'
          >
            Clear Filters
          </button>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4'>
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
      <div className='mb-4 sm:mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
          <input
            type='text'
            placeholder='Search dive sites by name...'
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
                // Export current page to CSV
                const headers = [
                  'ID',
                  'Name',
                  'Description',
                  'Creator',
                  'Difficulty',
                  'Rating',
                  'Views',
                  'Country',
                  'Region',
                ];
                const rows = (diveSites || []).map(site => [
                  site.id,
                  site.name || '',
                  site.description || '',
                  site.created_by_username || 'Unknown',
                  site.difficulty_label || getDifficultyLabel(site.difficulty_code) || '',
                  site.average_rating ? site.average_rating.toFixed(1) : 'No ratings',
                  site.view_count || 0,
                  site.country || '',
                  site.region || '',
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map(row =>
                    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                  ),
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute(
                  'download',
                  `dive-sites-page-${pagination.pageIndex + 1}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${rows.length} dive sites to CSV`, { id: 'export-toast' });
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
                  toast.error('No dive sites to export');
                  return;
                }

                if (
                  !window.confirm(
                    `This will export all ${totalCount.toLocaleString()} dive sites. This may take a moment. Continue?`
                  )
                ) {
                  return;
                }

                toast.loading(`Exporting all ${totalCount.toLocaleString()} dive sites...`, {
                  id: 'export-all-toast',
                });

                // Fetch all dive sites using page_size=1000 (max allowed)
                const allDiveSites = [];
                let currentPage = 1;
                let hasMore = true;

                while (hasMore) {
                  const params = new URLSearchParams();
                  params.append('page', currentPage.toString());
                  params.append('page_size', '1000'); // Max page size

                  // Add filters
                  if (filters.name) params.append('name', filters.name);
                  if (filters.difficulty_code)
                    params.append('difficulty_code', filters.difficulty_code);
                  if (filters.country) params.append('country', filters.country);
                  if (filters.region) params.append('region', filters.region);
                  if (filters.min_rating) params.append('min_rating', filters.min_rating);
                  if (filters.max_rating) params.append('max_rating', filters.max_rating);

                  // Add sorting if any
                  const sortParams = getSortParams();
                  if (sortParams.sort_by) {
                    params.append('sort_by', sortParams.sort_by);
                    params.append('sort_order', sortParams.sort_order);
                  }

                  const response = await api.get(`/api/v1/dive-sites/?${params.toString()}`);
                  const pageData = response.data;

                  if (pageData && pageData.length > 0) {
                    allDiveSites.push(...pageData);
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
                  'Creator',
                  'Difficulty',
                  'Rating',
                  'Views',
                  'Country',
                  'Region',
                ];
                const rows = allDiveSites.map(site => [
                  site.id,
                  site.name || '',
                  site.description || '',
                  site.created_by_username || 'Unknown',
                  site.difficulty_label || getDifficultyLabel(site.difficulty_code) || '',
                  site.average_rating ? site.average_rating.toFixed(1) : 'No ratings',
                  site.view_count || 0,
                  site.country || '',
                  site.region || '',
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map(row =>
                    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                  ),
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute(
                  'download',
                  `dive-sites-all-${totalCount}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(
                  `Exported all ${allDiveSites.length.toLocaleString()} dive sites to CSV`,
                  { id: 'export-all-toast' }
                );
              } catch (error) {
                console.error('Export error:', error);
                toast.error('Failed to export all dive sites. Please try again.', {
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
      <AdminDiveSitesTable
        data={diveSites || []}
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
        onView={handleViewDiveSite}
        onEdit={handleEditDiveSite}
        onDelete={handleDeleteDiveSite}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AdminDiveSites;
