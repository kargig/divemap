import { Edit, Trash2, Eye, Search, X, Download, Columns } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import AdminDiveRoutesTable from '../components/tables/AdminDiveRoutesTable';
import Select from '../components/ui/Select';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getRouteTypeLabel } from '../utils/routeUtils';
import { slugify } from '../utils/slugify';

const AdminDiveRoutes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Dive Routes');
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
    dive_site_name: true,
    created_by_username: true,
    route_type: true,
    created_at: true,
    actions: true,
  });

  // Filters
  const [filters, setFilters] = useState({
    name: '',
    route_type: '',
    dive_site_id: '',
    created_by: '',
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

  // Debounced search handler
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

  // Sync searchInput with filters.name
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
      id: null,
      name: 'name',
      route_type: 'route_type',
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
    if (!sortField) return {};
    return {
      sort_by: sortField,
      sort_order: sort.desc ? 'desc' : 'asc',
    };
  };

  // Fetch dive routes data
  const { data: diveRoutes, isLoading } = useQuery(
    ['admin-dive-routes', pagination, filters, sorting],
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
      if (filters.name) params.append('search', filters.name);
      if (filters.route_type) params.append('route_type', filters.route_type);
      if (filters.dive_site_id) params.append('dive_site_id', filters.dive_site_id);
      if (filters.created_by) params.append('created_by', filters.created_by);

      return api.get(`/api/v1/dive-routes/?${params.toString()}`);
    },
    {
      select: response => {
        // The API returns { routes: [], total: 0, page: 1, ... } directly
        return response.data; // response.data contains { routes, total, page, ... }
      },
      keepPreviousData: true,
    }
  );

  // Parse pagination info from data
  const paginationInfo = useMemo(() => {
    if (!diveRoutes) return { totalCount: 0, totalPages: 0 };
    return {
      totalCount: diveRoutes.total || 0,
      totalPages: diveRoutes.total_pages || 0,
    };
  }, [diveRoutes]);

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
    setSearchInput('');
    setFilters({
      name: '',
      route_type: '',
      dive_site_id: '',
      created_by: '',
    });
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  };

  // Delete mutations
  const deleteDiveRouteMutation = useMutation(id => api.delete(`/api/v1/dive-routes/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dive-routes']);
      toast.success('Dive route deleted successfully!');
    },
    onError: error => {
      toast.error(error.response?.data?.detail || 'Failed to delete dive route');
    },
  });

  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/dive-routes/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dive-routes']);
        setRowSelection({});
        toast.success(`${Object.keys(rowSelection).length} dive route(s) deleted successfully!`);
      },
      onError: () => {
        toast.error('Failed to delete some dive routes');
      },
    }
  );

  // Action handlers
  const handleViewDiveRoute = useCallback(
    route => {
      navigate(`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`);
    },
    [navigate]
  );

  const handleEditDiveRoute = useCallback(
    route => {
      navigate(`/dive-sites/${route.dive_site_id}/route/${route.id}/edit`);
    },
    [navigate]
  );

  const handleDeleteDiveRoute = useCallback(
    route => {
      if (window.confirm(`Are you sure you want to delete the dive route "${route.name}"?`)) {
        deleteDiveRouteMutation.mutate(route.id);
      }
    },
    [deleteDiveRouteMutation]
  );

  const handleMassDelete = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} dive route(s)?`)) {
      massDeleteMutation.mutate(selectedIds.map(id => parseInt(id)));
    }
  };

  // Column definitions
  const columns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        enableSorting: false,
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
        accessorKey: 'dive_site_name', // Derived column
        header: 'Dive Site',
        size: 200,
        cell: ({ row }) => {
          const site = row.original.dive_site;
          return site ? (
            <span className='text-sm text-gray-900'>{site.name}</span>
          ) : (
            <span className='text-gray-400 italic text-sm'>Unknown</span>
          );
        },
      },
      {
        accessorKey: 'created_by_username', // Derived
        header: 'Creator',
        size: 120,
        cell: ({ row }) => {
          const creator = row.original.creator;
          return creator ? (
            <span className='font-medium text-blue-600 text-sm'>{creator.username}</span>
          ) : (
            <span className='text-gray-400 italic text-sm'>Unknown</span>
          );
        },
      },
      {
        accessorKey: 'route_type',
        header: 'Type',
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const type = row.original.route_type;
          return (
            <span className='px-2 py-1 text-xs font-medium bg-gray-100 rounded-full text-gray-700'>
              {getRouteTypeLabel(type)}
            </span>
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
          const route = row.original;
          return (
            <div className='flex space-x-2'>
              <button
                onClick={() => handleViewDiveRoute(route)}
                className='text-green-600 hover:text-green-900'
                title='View route'
              >
                <Eye className='h-4 w-4' />
              </button>
              <button
                onClick={() => handleEditDiveRoute(route)}
                className='text-blue-600 hover:text-blue-900'
                title='Edit route'
              >
                <Edit className='h-4 w-4' />
              </button>
              <button
                onClick={() => handleDeleteDiveRoute(route)}
                className='text-red-600 hover:text-red-900'
                title='Delete route'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          );
        },
      },
    ],
    [handleViewDiveRoute, handleEditDiveRoute, handleDeleteDiveRoute]
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
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>Dive Routes Management</h1>
          <p className='text-sm sm:text-base text-gray-600 mt-1 sm:mt-2'>
            Manage all dive routes in the system
          </p>
          {paginationInfo.totalCount !== undefined && (
            <p className='text-xs sm:text-sm text-gray-500 mt-1'>
              Total dive routes: {paginationInfo.totalCount}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/admin/dive-sites')}
          className='flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto'
        >
          <Search className='h-4 w-4 mr-2' />
          <span className='hidden sm:inline'>Find Site to Add Route</span>
          <span className='sm:hidden'>Find Site</span>
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
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
          <Select
            id='route-type-filter'
            label='Route Type'
            value={filters.route_type || 'all'}
            onValueChange={value => handleFilterChange('route_type', value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'scuba', label: 'Scuba' },
              { value: 'swim', label: 'Snorkel / Swim' },
              { value: 'walk', label: 'Walk' },
            ]}
          />
        </div>
      </div>

      {/* Search */}
      <div className='mb-4 sm:mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
          <input
            type='text'
            placeholder='Search dive routes by name or description...'
            value={searchInput}
            onChange={e => {
              const value = e.target.value;
              setSearchInput(value);
              debouncedSearch(value);
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
                  'Dive Site',
                  'Creator',
                  'Type',
                  'Created At',
                ];
                const rows = (diveRoutes?.routes || []).map(route => [
                  route.id,
                  route.name || '',
                  route.description || '',
                  route.dive_site?.name || 'Unknown',
                  route.creator?.username || 'Unknown',
                  getRouteTypeLabel(route.route_type),
                  route.created_at ? new Date(route.created_at).toLocaleDateString() : '',
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map(row =>
                    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                  ),
                ].join('\n');

                const blob = new window.Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = window.URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute(
                  'download',
                  `dive-routes-page-${pagination.pageIndex + 1}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${rows.length} dive routes to CSV`, { id: 'export-toast' });
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
        </div>
      </div>

      {/* TanStack Table */}
      <AdminDiveRoutesTable
        data={diveRoutes?.routes || []}
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
        onView={handleViewDiveRoute}
        onEdit={handleEditDiveRoute}
        onDelete={handleDeleteDiveRoute}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AdminDiveRoutes;
