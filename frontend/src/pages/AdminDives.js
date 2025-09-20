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
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const AdminDives = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Dives');

  // Dive management state
  const [showEditDiveModal, setShowEditDiveModal] = useState(false);
  const [editingDive, setEditingDive] = useState(null);
  const [diveForm, setDiveForm] = useState({
    name: '',
    dive_information: '',
    max_depth: '',
    average_depth: '',
    gas_bottles_used: '',
    suit_type: '',
    difficulty_level: '',
    visibility_rating: '',
    user_rating: '',
    dive_date: '',
    dive_time: '',
    duration: '',
    is_private: false,
    dive_site_id: '',
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    user_id: '',
    dive_site_id: '',
    dive_site_name: '',
    difficulty_level: '',
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

  // Fetch dives data
  const { data: dives, isLoading } = useQuery(
    ['admin-dives', filters],
    () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return api.get(`/api/v1/dives/admin/dives?${params.toString()}`);
    },
    {
      select: response => response.data,
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
        resetDiveForm();
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
        setSelectedItems(new Set());
      },
      onError: _error => {
        toast.error('Failed to delete some dives');
      },
    }
  );

  const handleSelectAll = checked => {
    if (checked) {
      setSelectedItems(new Set(dives?.map(dive => dive.id) || []));
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
    if (selectedItems.size === 0) {
      toast.error('Please select dives to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} dive(s)?`)) {
      massDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  const handleEditDive = dive => {
    setEditingDive(dive);
    setDiveForm({
      name: dive.name || '',
      dive_information: dive.dive_information || '',
      max_depth: dive.max_depth?.toString() || '',
      average_depth: dive.average_depth?.toString() || '',
      gas_bottles_used: dive.gas_bottles_used || '',
      suit_type: dive.suit_type || '',
      difficulty_level: dive.difficulty_level || '',
      visibility_rating: dive.visibility_rating?.toString() || '',
      user_rating: dive.user_rating?.toString() || '',
      dive_date: dive.dive_date || '',
      dive_time: dive.dive_time || '',
      duration: dive.duration?.toString() || '',
      is_private: dive.is_private || false,
      dive_site_id: dive.dive_site_id?.toString() || '',
    });
    setShowEditDiveModal(true);
  };

  const handleUpdateDive = () => {
    const updateData = {
      ...diveForm,
      max_depth: diveForm.max_depth ? parseFloat(diveForm.max_depth) : null,
      average_depth: diveForm.average_depth ? parseFloat(diveForm.average_depth) : null,
      visibility_rating: diveForm.visibility_rating ? parseInt(diveForm.visibility_rating) : null,
      user_rating: diveForm.user_rating ? parseInt(diveForm.user_rating) : null,
      duration: diveForm.duration ? parseInt(diveForm.duration) : null,
      dive_site_id: diveForm.dive_site_id ? parseInt(diveForm.dive_site_id) : null,
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

  const resetDiveForm = () => {
    setDiveForm({
      name: '',
      dive_information: '',
      max_depth: '',
      average_depth: '',
      gas_bottles_used: '',
      suit_type: '',
      difficulty_level: '',
      visibility_rating: '',
      user_rating: '',
      dive_date: '',
      dive_time: '',
      duration: '',
      is_private: false,
      dive_site_id: '',
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      dive_site_id: '',
      dive_site_name: '',
      difficulty_level: '',
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
  };

  const filteredDives =
    dives?.filter(dive => {
      // Apply search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          dive.name?.toLowerCase().includes(searchLower) ||
          dive.user_username?.toLowerCase().includes(searchLower) ||
          dive.dive_site?.name?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Apply dive site name filter
      if (filters.dive_site_name) {
        const diveSiteNameLower = filters.dive_site_name.toLowerCase();
        if (!dive.dive_site?.name?.toLowerCase().includes(diveSiteNameLower)) {
          return false;
        }
      }

      return true;
    }) || [];

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto p-6'>
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
            {selectedItems.size > 0 && (
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
                <span>Delete Selected ({selectedItems.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className='mb-6 bg-gray-50 p-4 rounded-lg'>
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
              value={filters.difficulty_level}
              onChange={e => handleFilterChange('difficulty_level', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Difficulties</option>
              <option value='beginner'>Beginner</option>
              <option value='intermediate'>Intermediate</option>
              <option value='advanced'>Advanced</option>
              <option value='expert'>Expert</option>
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
      <div className='mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
          <input
            type='text'
            placeholder='Search dives by name, user, or dive site...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      {/* Dives Table */}
      <div className='bg-white shadow-md rounded-lg overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  <input
                    type='checkbox'
                    checked={selectedItems.size === (dives?.length || 0) && selectedItems.size > 0}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Dive
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  User
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Dive Site
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Date
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Rating
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Privacy
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Views
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {isLoading ? (
                <tr>
                  <td colSpan='9' className='px-6 py-4 text-center'>
                    <Loader className='h-6 w-6 animate-spin mx-auto' />
                  </td>
                </tr>
              ) : filteredDives.length === 0 ? (
                <tr>
                  <td colSpan='9' className='px-6 py-4 text-center text-gray-500'>
                    No dives found
                  </td>
                </tr>
              ) : (
                filteredDives.map(dive => (
                  <tr key={dive.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <input
                        type='checkbox'
                        checked={selectedItems.has(dive.id)}
                        onChange={e => handleSelectItem(dive.id, e.target.checked)}
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                      />
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
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
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <User className='h-4 w-4 text-gray-400 mr-2' />
                        <span className='text-sm text-gray-900'>{dive.user_username}</span>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      {dive.dive_site ? (
                        <div className='flex items-center'>
                          <MapPin className='h-4 w-4 text-gray-400 mr-2' />
                          <span className='text-sm text-gray-900'>{dive.dive_site.name}</span>
                        </div>
                      ) : (
                        <span className='text-sm text-gray-500'>No dive site</span>
                      )}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <Calendar className='h-4 w-4 text-gray-400 mr-2' />
                        <span className='text-sm text-gray-900'>{dive.dive_date}</span>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <span className='text-sm text-gray-900'>
                          {dive.user_rating ? `${dive.user_rating}/10` : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          dive.is_private
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {dive.is_private ? 'Private' : 'Public'}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <span className='text-sm text-gray-900'>{dive.view_count || 0}</span>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  value={diveForm.name}
                  onChange={e => setDiveForm({ ...diveForm, name: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.dive_site_id}
                  onChange={e => setDiveForm({ ...diveForm, dive_site_id: e.target.value })}
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
                  value={diveForm.dive_date}
                  onChange={e => setDiveForm({ ...diveForm, dive_date: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.dive_time}
                  onChange={e => setDiveForm({ ...diveForm, dive_time: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.max_depth}
                  onChange={e => setDiveForm({ ...diveForm, max_depth: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.duration}
                  onChange={e => setDiveForm({ ...diveForm, duration: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.difficulty_level}
                  onChange={e => setDiveForm({ ...diveForm, difficulty_level: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Select difficulty</option>
                  <option value='beginner'>Beginner</option>
                  <option value='intermediate'>Intermediate</option>
                  <option value='advanced'>Advanced</option>
                  <option value='expert'>Expert</option>
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
                  value={diveForm.suit_type}
                  onChange={e => setDiveForm({ ...diveForm, suit_type: e.target.value })}
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
                  value={diveForm.user_rating}
                  onChange={e => setDiveForm({ ...diveForm, user_rating: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.visibility_rating}
                  onChange={e => setDiveForm({ ...diveForm, visibility_rating: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
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
                  value={diveForm.dive_information}
                  onChange={e => setDiveForm({ ...diveForm, dive_information: e.target.value })}
                  rows='3'
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div className='md:col-span-2'>
                <label htmlFor='edit-is-private' className='flex items-center'>
                  <input
                    id='edit-is-private'
                    type='checkbox'
                    checked={diveForm.is_private}
                    onChange={e => setDiveForm({ ...diveForm, is_private: e.target.checked })}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2'
                  />
                  <span className='text-sm font-medium text-gray-700'>Private dive</span>
                </label>
              </div>
            </div>

            <div className='flex justify-end space-x-3 mt-6'>
              <button
                onClick={() => setShowEditDiveModal(false)}
                className='px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDive}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDives;
