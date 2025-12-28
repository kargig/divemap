import { Trash2, Edit, Plus, X, Loader, Save, Download, Columns, Search } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';

import api from '../api';
import AdminUsersTable from '../components/tables/AdminUsersTable';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const AdminUsers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Users');
  const [searchParams, setSearchParams] = useSearchParams();

  // TanStack Table state (server-side pagination and sorting)
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: parseInt(searchParams.get('page')) - 1 || 0,
    pageSize: parseInt(searchParams.get('page_size')) || 25,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({
    select: true,
    username: true,
    email: true,
    role: true,
    status: true,
    email_verified: true,
    created_at: true,
    actions: true,
  });

  // Search and filter state
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    is_admin: '',
    is_moderator: '',
    enabled: '',
    email_verified: '',
  });

  // User management state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    full_name: '',
    is_admin: false,
    is_active: true,
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

  // Map frontend column IDs to backend API sort field names
  const mapColumnIdToSortField = columnId => {
    const fieldMapping = {
      id: 'id',
      username: 'username',
      email: 'email',
      role: 'is_admin', // Sort by is_admin (admin first/last)
      status: 'enabled',
      email_verified: 'email_verified',
      created_at: 'created_at',
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
        return searchTerm => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchTerm }));
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

  // Fetch users data with server-side pagination, sorting, search, and filters
  const { data: users, isLoading } = useQuery(
    ['admin-users', pagination, sorting, filters],
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

      // Add search
      if (filters.search) params.append('search', filters.search);

      // Add filters
      if (filters.is_admin !== '') {
        params.append('is_admin', filters.is_admin === 'true' ? 'true' : 'false');
      }
      if (filters.is_moderator !== '') {
        params.append('is_moderator', filters.is_moderator === 'true' ? 'true' : 'false');
      }
      if (filters.enabled !== '') {
        params.append('enabled', filters.enabled === 'true' ? 'true' : 'false');
      }
      if (filters.email_verified !== '') {
        params.append('email_verified', filters.email_verified === 'true' ? 'true' : 'false');
      }

      return api.get(`/api/v1/users/admin/users?${params.toString()}`);
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
        queryClient.setQueryData(['admin-users-pagination'], {
          totalCount,
          totalPages,
        });

        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Get pagination info
  const paginationInfo = queryClient.getQueryData(['admin-users-pagination']) || {
    totalCount: 0,
    totalPages: 0,
  };

  // User mutations
  const createUserMutation = useMutation(
    userData => api.post('/api/v1/users/admin/users', userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User created successfully!');
        setShowCreateUserModal(false);
        setUserForm({
          username: '',
          email: '',
          full_name: '',
          is_admin: false,
          is_active: true,
        });
      },
      onError: _error => {
        toast.error('Failed to create user');
      },
    }
  );

  const updateUserMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/users/admin/users/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User updated successfully!');
        setShowEditUserModal(false);
        setEditingUser(null);
        setUserForm({
          username: '',
          email: '',
          full_name: '',
          is_admin: false,
          is_active: true,
        });
      },
      onError: _error => {
        toast.error('Failed to update user');
      },
    }
  );

  const deleteUserMutation = useMutation(id => api.delete(`/api/v1/users/admin/users/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User deleted successfully!');
    },
    onError: _error => {
      toast.error('Failed to delete user');
    },
  });

  // Mass delete mutation
  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/users/admin/users/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        setRowSelection({});
        const selectedCount = Object.keys(rowSelection).length;
        toast.success(`${selectedCount} user(s) deleted successfully!`);
      },
      onError: _error => {
        toast.error('Failed to delete some users');
      },
    }
  );

  // Handle mass delete
  const handleMassDelete = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    const itemNames = selectedIds
      .map(id => users?.find(userItem => userItem.id === parseInt(id))?.username)
      .filter(Boolean);

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedIds.length} user(s)?\n\n${itemNames.join('\n')}`
      )
    ) {
      massDeleteMutation.mutate(selectedIds.map(id => parseInt(id)));
    }
  };

  // User handlers
  const handleCreateUser = () => {
    if (!userForm.username.trim() || !userForm.email.trim() || !userForm.password.trim()) {
      toast.error('Username, email, and password are required');
      return;
    }
    createUserMutation.mutate(userForm);
  };

  const handleEditUser = userItem => {
    setEditingUser(userItem);
    setUserForm({
      username: userItem.username,
      email: userItem.email,
      password: '', // Don't pre-fill password for security
      is_admin: userItem.is_admin,
      is_moderator: userItem.is_moderator,
      enabled: userItem.enabled,
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = () => {
    if (!userForm.username.trim() || !userForm.email.trim()) {
      toast.error('Username and email are required');
      return;
    }

    // Only include password if it's been changed
    const updateData = { ...userForm };
    if (!updateData.password) {
      delete updateData.password;
    }

    updateUserMutation.mutate({
      id: editingUser.id,
      data: updateData,
    });
  };

  const handleDeleteUser = userItem => {
    if (userItem.id === user?.id) {
      toast.error('You cannot delete your own account');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the user "${userItem.username}"?`)) {
      deleteUserMutation.mutate(userItem.id);
    }
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      email: '',
      password: '',
      is_admin: false,
      is_moderator: false,
      enabled: true,
    });
    setEditingUser(null);
  };

  // Define columns
  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type='checkbox'
            checked={
              table.getIsAllRowsSelected() ||
              (table.getIsSomeRowsSelected() &&
                users?.filter(userItem => userItem.id !== user?.id).length > 0)
            }
            onChange={e => {
              if (e.target.checked) {
                const deletableUsers = users?.filter(userItem => userItem.id !== user?.id) || [];
                const newSelection = {};
                deletableUsers.forEach(userItem => {
                  newSelection[userItem.id] = true;
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
          const userItem = row.original;
          const isCurrentUser = userItem.id === user?.id;
          return (
            <input
              type='checkbox'
              checked={rowSelection[userItem.id] || false}
              onChange={e => {
                setRowSelection(prev => ({
                  ...prev,
                  [userItem.id]: e.target.checked,
                }));
              }}
              disabled={isCurrentUser}
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50'
            />
          );
        },
        enableSorting: false,
        size: 50,
      },
      {
        id: 'username',
        accessorKey: 'username',
        header: 'Username',
        enableSorting: true,
        size: 150,
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        enableSorting: true,
        size: 200,
      },
      {
        id: 'role',
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const userItem = row.original;
          return (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                userItem.is_admin
                  ? 'bg-red-100 text-red-800'
                  : userItem.is_moderator
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
              }`}
            >
              {userItem.is_admin ? 'Admin' : userItem.is_moderator ? 'Moderator' : 'User'}
            </span>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original;
          const b = rowB.original;
          const aRole = a.is_admin ? 2 : a.is_moderator ? 1 : 0;
          const bRole = b.is_admin ? 2 : b.is_moderator ? 1 : 0;
          return aRole - bRole;
        },
        size: 120,
      },
      {
        id: 'status',
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }) => {
          const userItem = row.original;
          return (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                userItem.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {userItem.enabled ? 'Enabled' : 'Disabled'}
            </span>
          );
        },
        enableSorting: true,
        size: 100,
      },
      {
        id: 'email_verified',
        accessorKey: 'email_verified',
        header: 'Email Verified',
        cell: ({ row }) => {
          const userItem = row.original;
          return (
            <div className='flex items-center space-x-2'>
              {userItem.email_verified ? (
                <>
                  <div className='flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-green-100'>
                    <svg
                      className='w-4 h-4 text-green-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2.5}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </div>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium text-green-700'>Verified</span>
                    {userItem.email_verified_at && (
                      <span className='text-xs text-gray-500'>
                        {new Date(userItem.email_verified_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className='flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-amber-100'>
                    <svg
                      className='w-4 h-4 text-amber-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2.5}
                        d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                      />
                    </svg>
                  </div>
                  <span className='text-sm font-medium text-amber-700'>Unverified</span>
                </>
              )}
            </div>
          );
        },
        enableSorting: true,
        size: 180,
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => {
          const userItem = row.original;
          return (
            <span className='text-sm text-gray-500'>
              {new Date(userItem.created_at).toLocaleDateString()}
            </span>
          );
        },
        enableSorting: true,
        size: 120,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const userItem = row.original;
          const isCurrentUser = userItem.id === user?.id;
          return (
            <div className='flex space-x-2'>
              <button
                onClick={() => handleEditUser(userItem)}
                className='text-blue-600 hover:text-blue-900'
                title='Edit user'
              >
                <Edit className='h-4 w-4' />
              </button>
              {!isCurrentUser && (
                <button
                  onClick={() => handleDeleteUser(userItem)}
                  className='text-red-600 hover:text-red-900'
                  title='Delete user'
                >
                  <Trash2 className='h-4 w-4' />
                </button>
              )}
            </div>
          );
        },
        enableSorting: false,
        size: 100,
      },
    ],
    [rowSelection, user, users]
  );

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
    const newPagination = { ...pagination, pageIndex: 0 };
    updateURL(newPagination);
    setPagination(newPagination);
  };

  const clearFilters = () => {
    setSearchInput(''); // Clear search input immediately
    setFilters({
      search: '',
      is_admin: '',
      is_moderator: '',
      enabled: '',
      email_verified: '',
    });
    const newPagination = { ...pagination, pageIndex: 0 };
    updateURL(newPagination);
    setPagination(newPagination);
  };

  // Update pagination with pageCount
  const paginationWithCount = useMemo(
    () => ({
      ...pagination,
      pageCount: paginationInfo.totalPages || 0,
      totalCount: paginationInfo.totalCount || 0,
    }),
    [pagination, paginationInfo]
  );

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

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>User Management</h1>
          <p className='text-gray-600 mt-2'>Manage all users in the system</p>
        </div>
        <button
          onClick={() => setShowCreateUserModal(true)}
          className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full sm:w-auto justify-center'
        >
          <Plus className='h-4 w-4 mr-2' />
          Create User
        </button>
      </div>

      {/* Filters */}
      <div className='mb-4 sm:mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200'>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-sm font-semibold text-gray-700'>Filters</h2>
          <button
            onClick={clearFilters}
            className='text-xs text-blue-600 hover:text-blue-800 font-medium'
          >
            Clear All
          </button>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
          <Select
            id='role-filter'
            label='Admin Role'
            value={filters.is_admin || 'all'}
            onValueChange={value => handleFilterChange('is_admin', value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: 'Any' },
              { value: 'true', label: 'Admin' },
              { value: 'false', label: 'Non-Admin' },
            ]}
          />
          <Select
            id='moderator-filter'
            label='Moderator Role'
            value={filters.is_moderator || 'all'}
            onValueChange={value =>
              handleFilterChange('is_moderator', value === 'all' ? '' : value)
            }
            options={[
              { value: 'all', label: 'Any' },
              { value: 'true', label: 'Moderator' },
              { value: 'false', label: 'Non-Moderator' },
            ]}
          />
          <Select
            id='status-filter'
            label='Status'
            value={filters.enabled || 'all'}
            onValueChange={value => handleFilterChange('enabled', value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: 'Any' },
              { value: 'true', label: 'Enabled' },
              { value: 'false', label: 'Disabled' },
            ]}
          />
          <Select
            id='email-verified-filter'
            label='Email Verified'
            value={filters.email_verified || 'all'}
            onValueChange={value =>
              handleFilterChange('email_verified', value === 'all' ? '' : value)
            }
            options={[
              { value: 'all', label: 'Any' },
              { value: 'true', label: 'Verified' },
              { value: 'false', label: 'Not Verified' },
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
            placeholder='Search users by username or email...'
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
                  'Username',
                  'Email',
                  'Role',
                  'Status',
                  'Email Verified',
                  'Created',
                ];
                const rows = (users || []).map(user => [
                  user.id,
                  user.username || '',
                  user.email || '',
                  user.is_admin ? 'Admin' : user.is_moderator ? 'Moderator' : 'User',
                  user.enabled ? 'Enabled' : 'Disabled',
                  user.email_verified ? 'Yes' : 'No',
                  new Date(user.created_at).toLocaleDateString(),
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
                  `users-page-${pagination.pageIndex + 1}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${rows.length} users to CSV`, { id: 'export-toast' });
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
                const count = paginationInfo.totalCount || 0;
                if (count === 0) {
                  toast.error('No users to export');
                  return;
                }

                const hasFilters =
                  filters.search ||
                  filters.is_admin !== '' ||
                  filters.is_moderator !== '' ||
                  filters.enabled !== '' ||
                  filters.email_verified !== '';
                if (
                  !window.confirm(
                    `This will export all ${count.toLocaleString()} users${hasFilters ? ' (with current filters applied)' : ''}. This may take a moment. Continue?`
                  )
                ) {
                  return;
                }

                toast.loading(`Exporting all ${count.toLocaleString()} users...`, {
                  id: 'export-all-toast',
                });

                // Fetch all users
                const allUsers = [];
                let currentPage = 1;
                let hasMore = true;

                while (hasMore) {
                  const params = new URLSearchParams();
                  params.append('page', currentPage.toString());
                  params.append('page_size', '1000'); // Max page size

                  // Add sorting if any
                  const sortParams = getSortParams();
                  if (sortParams.sort_by) {
                    params.append('sort_by', sortParams.sort_by);
                    params.append('sort_order', sortParams.sort_order);
                  }

                  // Add search
                  if (filters.search) params.append('search', filters.search);

                  // Add filters
                  if (filters.is_admin !== '') {
                    params.append('is_admin', filters.is_admin === 'true' ? 'true' : 'false');
                  }
                  if (filters.is_moderator !== '') {
                    params.append(
                      'is_moderator',
                      filters.is_moderator === 'true' ? 'true' : 'false'
                    );
                  }
                  if (filters.enabled !== '') {
                    params.append('enabled', filters.enabled === 'true' ? 'true' : 'false');
                  }
                  if (filters.email_verified !== '') {
                    params.append(
                      'email_verified',
                      filters.email_verified === 'true' ? 'true' : 'false'
                    );
                  }

                  const response = await api.get(`/api/v1/users/admin/users?${params.toString()}`);
                  const pageData = response.data;

                  if (pageData && pageData.length > 0) {
                    allUsers.push(...pageData);
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
                  'Username',
                  'Email',
                  'Role',
                  'Status',
                  'Email Verified',
                  'Created',
                ];
                const rows = allUsers.map(user => [
                  user.id,
                  user.username || '',
                  user.email || '',
                  user.is_admin ? 'Admin' : user.is_moderator ? 'Moderator' : 'User',
                  user.enabled ? 'Enabled' : 'Disabled',
                  user.email_verified ? 'Yes' : 'No',
                  new Date(user.created_at).toLocaleDateString(),
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
                  `users-all-${count}-${new Date().toISOString().split('T')[0]}.csv`
                );
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported all ${allUsers.length.toLocaleString()} users to CSV`, {
                  id: 'export-all-toast',
                });
              } catch (error) {
                console.error('Export error:', error);
                toast.error('Failed to export all users. Please try again.', {
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

      {/* Users Table */}
      <AdminUsersTable
        data={users || []}
        columns={columns}
        pagination={paginationWithCount}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
        isLoading={isLoading}
        currentUserId={user?.id}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateUserModal}
        onClose={() => {
          setShowCreateUserModal(false);
          resetUserForm();
        }}
        title='Create New User'
        className='max-w-md'
      >
        <div className='space-y-4'>
          <div>
            <label
              htmlFor='create-user-username'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Username *
            </label>
            <input
              id='create-user-username'
              type='text'
              value={userForm.username}
              onChange={e => setUserForm({ ...userForm, username: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter username'
              maxLength={50}
            />
          </div>
          <div>
            <label
              htmlFor='create-user-email'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Email *
            </label>
            <input
              id='create-user-email'
              type='email'
              value={userForm.email}
              onChange={e => setUserForm({ ...userForm, email: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter email'
            />
          </div>
          <div>
            <label
              htmlFor='create-user-password'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Password *
            </label>
            <input
              id='create-user-password'
              type='password'
              value={userForm.password}
              onChange={e => setUserForm({ ...userForm, password: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter password'
              minLength={6}
            />
          </div>
          <div className='space-y-2'>
            <label htmlFor='create-user-admin' className='flex items-center'>
              <input
                id='create-user-admin'
                type='checkbox'
                checked={userForm.is_admin}
                onChange={e => setUserForm({ ...userForm, is_admin: e.target.checked })}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>Admin privileges</span>
            </label>
            <label htmlFor='create-user-moderator' className='flex items-center'>
              <input
                id='create-user-moderator'
                type='checkbox'
                checked={userForm.is_moderator}
                onChange={e => setUserForm({ ...userForm, is_moderator: e.target.checked })}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>Moderator privileges</span>
            </label>
            <label htmlFor='create-user-enabled' className='flex items-center'>
              <input
                id='create-user-enabled'
                type='checkbox'
                checked={userForm.enabled}
                onChange={e => setUserForm({ ...userForm, enabled: e.target.checked })}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>Account enabled</span>
            </label>
          </div>
        </div>
        <div className='flex justify-end space-x-3 mt-6'>
          <button
            onClick={() => {
              setShowCreateUserModal(false);
              resetUserForm();
            }}
            className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
          >
            Cancel
          </button>
          <button
            onClick={handleCreateUser}
            disabled={createUserMutation.isLoading}
            className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
          >
            {createUserMutation.isLoading ? (
              <Loader className='h-4 w-4 mr-2 animate-spin' />
            ) : (
              <Save className='h-4 w-4 mr-2' />
            )}
            Create User
          </button>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditUserModal && !!editingUser}
        onClose={() => {
          setShowEditUserModal(false);
          resetUserForm();
        }}
        title='Edit User'
        className='max-w-md'
      >
        <div className='space-y-4'>
          <div>
            <label
              htmlFor='edit-user-username'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Username *
            </label>
            <input
              id='edit-user-username'
              type='text'
              value={userForm.username}
              onChange={e => setUserForm({ ...userForm, username: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter username'
              maxLength={50}
            />
          </div>
          <div>
            <label
              htmlFor='edit-user-email'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Email *
            </label>
            <input
              id='edit-user-email'
              type='email'
              value={userForm.email}
              onChange={e => setUserForm({ ...userForm, email: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter email'
            />
          </div>
          <div>
            <label
              htmlFor='edit-user-password'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Password (leave blank to keep current)
            </label>
            <input
              id='edit-user-password'
              type='password'
              value={userForm.password}
              onChange={e => setUserForm({ ...userForm, password: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter new password (optional)'
              minLength={6}
            />
          </div>
          <div className='space-y-2'>
            <label htmlFor='edit-user-admin' className='flex items-center'>
              <input
                id='edit-user-admin'
                type='checkbox'
                checked={userForm.is_admin}
                onChange={e => setUserForm({ ...userForm, is_admin: e.target.checked })}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>Admin privileges</span>
            </label>
            <label htmlFor='edit-user-moderator' className='flex items-center'>
              <input
                id='edit-user-moderator'
                type='checkbox'
                checked={userForm.is_moderator}
                onChange={e => setUserForm({ ...userForm, is_moderator: e.target.checked })}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>Moderator privileges</span>
            </label>
            <label htmlFor='edit-user-enabled' className='flex items-center'>
              <input
                id='edit-user-enabled'
                type='checkbox'
                checked={userForm.enabled}
                onChange={e => setUserForm({ ...userForm, enabled: e.target.checked })}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>Account enabled</span>
            </label>
          </div>
        </div>
        <div className='flex justify-end space-x-3 mt-6'>
          <button
            onClick={() => {
              setShowEditUserModal(false);
              resetUserForm();
            }}
            className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateUser}
            disabled={updateUserMutation.isLoading}
            className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
          >
            {updateUserMutation.isLoading ? (
              <Loader className='h-4 w-4 mr-2 animate-spin' />
            ) : (
              <Save className='h-4 w-4 mr-2' />
            )}
            Update User
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsers;
