import {
  Bell,
  Search,
  User,
  Mail,
  Globe,
  MapPin,
  Trash2,
  Plus,
  Edit,
  X,
  Users,
  CheckSquare,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../api';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  getUserNotificationPreferences,
  createUserNotificationPreference,
  updateUserNotificationPreference,
  deleteUserNotificationPreference,
} from '../services/notifications';

const AdminNotificationPreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Notification Preferences');

  // State
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [preferenceForm, setPreferenceForm] = useState({
    category: '',
    enable_website: true,
    enable_email: false,
    frequency: 'immediate',
    area_filter: null,
  });
  const [batchForm, setBatchForm] = useState({
    category: '',
    enable_website: null,
    enable_email: null,
    frequency: null,
    operation: 'update', // 'update' or 'create'
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery(
    ['admin-users'],
    () => api.get('/api/v1/users/admin/users'),
    {
      select: response => response.data,
    }
  );

  // Fetch selected user's preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery(
    ['admin-user-preferences', selectedUserId],
    () => getUserNotificationPreferences(selectedUserId),
    {
      enabled: !!selectedUserId,
    }
  );

  // Mutations
  const createPreferenceMutation = useMutation(
    data => createUserNotificationPreference(selectedUserId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-preferences', selectedUserId]);
        toast.success('Preference created successfully!');
        setShowCreateModal(false);
        setEditingCategory(null);
        resetForm();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to create preference');
      },
    }
  );

  const updatePreferenceMutation = useMutation(
    ({ category, data }) => updateUserNotificationPreference(selectedUserId, category, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-preferences', selectedUserId]);
        toast.success('Preference updated successfully!');
        setEditingCategory(null);
        resetForm();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to update preference');
      },
    }
  );

  const deletePreferenceMutation = useMutation(
    category => deleteUserNotificationPreference(selectedUserId, category),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-preferences', selectedUserId]);
        toast.success('Preference deleted successfully!');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to delete preference');
      },
    }
  );

  // Batch operations mutation
  const batchUpdateMutation = useMutation(
    async ({ userIds, category, data, operation }) => {
      const results = [];
      const errors = [];

      for (const userId of userIds) {
        try {
          if (operation === 'create') {
            // Try to create, if it exists, update instead
            try {
              await createUserNotificationPreference(userId, { category, ...data });
              results.push({ userId, success: true, action: 'created' });
            } catch (createError) {
              // If preference exists, update it
              if (createError.response?.status === 400) {
                await updateUserNotificationPreference(userId, category, data);
                results.push({ userId, success: true, action: 'updated' });
              } else {
                throw createError;
              }
            }
          } else {
            // Update existing preference
            await updateUserNotificationPreference(userId, category, data);
            results.push({ userId, success: true, action: 'updated' });
          }
        } catch (error) {
          errors.push({ userId, error: error.response?.data?.detail || 'Failed' });
        }
      }

      return { results, errors };
    },
    {
      onSuccess: ({ results, errors }) => {
        // Invalidate all user preference queries
        selectedUserIds.forEach(userId => {
          queryClient.invalidateQueries(['admin-user-preferences', userId]);
        });

        const successCount = results.length;
        const errorCount = errors.length;

        if (errorCount === 0) {
          toast.success(`Successfully updated ${successCount} user(s)!`);
        } else {
          toast.success(`Updated ${successCount} user(s), ${errorCount} failed`);
        }

        setShowBatchModal(false);
        setSelectedUserIds(new Set());
        setBatchForm({
          category: '',
          enable_website: null,
          enable_email: null,
          frequency: null,
          operation: 'update',
        });
      },
      onError: error => {
        toast.error(error.message || 'Failed to apply batch changes');
      },
    }
  );

  // Filter users by search query
  const filteredUsers =
    users?.filter(
      u =>
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const selectedUser = users?.find(u => u.id === selectedUserId);

  const resetForm = () => {
    setPreferenceForm({
      category: '',
      enable_website: true,
      enable_email: false,
      frequency: 'immediate',
      area_filter: null,
    });
  };

  const handleCreatePreference = () => {
    if (!preferenceForm.category) {
      toast.error('Please select a category');
      return;
    }
    createPreferenceMutation.mutate(preferenceForm);
  };

  const handleUpdatePreference = category => {
    updatePreferenceMutation.mutate({ category, data: preferenceForm });
  };

  const handleEditPreference = preference => {
    setEditingCategory(preference.category);
    setPreferenceForm({
      category: preference.category,
      enable_website: preference.enable_website,
      enable_email: preference.enable_email,
      frequency: preference.frequency,
      area_filter: preference.area_filter,
    });
  };

  const handleDeletePreference = category => {
    if (
      window.confirm(`Are you sure you want to delete the preference for category "${category}"?`)
    ) {
      deletePreferenceMutation.mutate(category);
    }
  };

  // Batch operations handlers
  const handleSelectAll = checked => {
    if (checked) {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleSelectUser = (userId, checked) => {
    const newSelected = new Set(selectedUserIds);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleBatchUpdate = () => {
    if (selectedUserIds.size === 0) {
      toast.error('Please select at least one user');
      return;
    }

    if (!batchForm.category) {
      toast.error('Please select a category');
      return;
    }

    // Build update data - only include fields that are set
    const updateData = {};
    if (batchForm.enable_website !== null) {
      updateData.enable_website = batchForm.enable_website;
    }
    if (batchForm.enable_email !== null) {
      updateData.enable_email = batchForm.enable_email;
    }
    if (batchForm.frequency !== null) {
      updateData.frequency = batchForm.frequency;
    }

    if (Object.keys(updateData).length === 0 && batchForm.operation === 'update') {
      toast.error('Please specify at least one field to update');
      return;
    }

    const userCount = selectedUserIds.size;
    const categoryLabel =
      notificationCategories.find(c => c.value === batchForm.category)?.label || batchForm.category;

    if (
      window.confirm(
        `Are you sure you want to ${batchForm.operation === 'create' ? 'create' : 'update'} notification preferences for ${userCount} user(s)?\n\nCategory: ${categoryLabel}\n\nThis will apply to all selected users.`
      )
    ) {
      batchUpdateMutation.mutate({
        userIds: Array.from(selectedUserIds),
        category: batchForm.category,
        data: updateData,
        operation: batchForm.operation,
      });
    }
  };

  const notificationCategories = [
    { value: 'new_dive_sites', label: 'New Dive Sites' },
    { value: 'new_dives', label: 'New Dives' },
    { value: 'new_diving_centers', label: 'New Diving Centers' },
    { value: 'new_dive_trips', label: 'New Dive Trips' },
    { value: 'admin_alerts', label: 'Admin Alerts' },
    { value: 'system', label: 'System & Social' },
  ];

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>Manage User Notification Preferences</h1>
        <p className='text-gray-600 mt-2'>View and modify notification preferences for any user</p>
      </div>

      {/* Batch Operations Bar */}
      {selectedUserIds.size > 0 && (
        <div className='mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <CheckSquare className='h-5 w-5 text-blue-600 mr-2' />
              <span className='font-medium text-gray-900'>
                {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className='flex items-center space-x-3'>
              <button
                onClick={() => setShowBatchModal(true)}
                className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
              >
                <Users className='h-4 w-4 mr-2' />
                Batch Update
              </button>
              <button
                onClick={() => setSelectedUserIds(new Set())}
                className='px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* User Selection Panel */}
        <div className='lg:col-span-1'>
          <div className='bg-white rounded-lg shadow p-4'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='relative flex-1 mr-2'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5' />
                <input
                  type='text'
                  placeholder='Search users...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  checked={
                    filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))
                  }
                  onChange={e => handleSelectAll(e.target.checked)}
                  className='h-5 w-5 text-blue-600 rounded focus:ring-blue-500'
                  title='Select all'
                />
              </div>
            </div>

            <div className='space-y-2 max-h-96 overflow-y-auto'>
              {usersLoading ? (
                <div className='text-center py-8 text-gray-500'>Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className='text-center py-8 text-gray-500'>No users found</div>
              ) : (
                filteredUsers.map(u => (
                  <div
                    key={u.id}
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      selectedUserId === u.id
                        ? 'bg-blue-50 border-blue-500'
                        : selectedUserIds.has(u.id)
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className='flex items-center'>
                      <input
                        type='checkbox'
                        checked={selectedUserIds.has(u.id)}
                        onChange={e => {
                          e.stopPropagation();
                          handleSelectUser(u.id, e.target.checked);
                        }}
                        onClick={e => e.stopPropagation()}
                        className='h-5 w-5 text-blue-600 rounded focus:ring-blue-500 mr-2 flex-shrink-0'
                      />
                      <button
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setEditingCategory(null);
                          resetForm();
                        }}
                        className='flex-1 text-left flex items-center min-w-0'
                      >
                        <User className='h-5 w-5 text-gray-400 mr-2 flex-shrink-0' />
                        <div className='flex-1 min-w-0'>
                          <p className='font-medium text-gray-900 truncate'>{u.username}</p>
                          <p className='text-sm text-gray-500 truncate'>{u.email}</p>
                        </div>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Preferences Panel */}
        <div className='lg:col-span-2'>
          {!selectedUserId ? (
            <div className='bg-white rounded-lg shadow p-12 text-center'>
              <Bell className='h-16 w-16 text-gray-300 mx-auto mb-4' />
              <p className='text-gray-600'>Select a user to view their notification preferences</p>
            </div>
          ) : (
            <div className='bg-white rounded-lg shadow'>
              <div className='p-6 border-b border-gray-200'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h2 className='text-xl font-semibold text-gray-900'>
                      {selectedUser?.username}'s Preferences
                    </h2>
                    <p className='text-sm text-gray-500 mt-1'>{selectedUser?.email}</p>
                  </div>
                </div>
              </div>

              <div className='p-6'>
                {preferencesLoading ? (
                  <div className='text-center py-8 text-gray-500'>Loading preferences...</div>
                ) : (
                  <div className='space-y-4'>
                    {notificationCategories.map(category => {
                      const pref = preferences?.find(p => p.category === category.value);
                      const isEditing = editingCategory === category.value;

                      return (
                        <div
                          key={category.value}
                          className={`border rounded-lg p-4 transition-colors ${
                            pref
                              ? 'border-gray-200 hover:border-gray-300 bg-white'
                              : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          {isEditing ? (
                            <div className='space-y-4'>
                              <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>
                                  Category
                                </label>
                                <input
                                  type='text'
                                  value={category.value}
                                  disabled
                                  className='w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50'
                                />
                              </div>
                              <div className='flex items-center space-x-6'>
                                <label className='flex items-center'>
                                  <input
                                    type='checkbox'
                                    checked={preferenceForm.enable_website}
                                    onChange={e =>
                                      setPreferenceForm({
                                        ...preferenceForm,
                                        enable_website: e.target.checked,
                                      })
                                    }
                                    className='mr-2'
                                  />
                                  <Globe className='h-4 w-4 text-gray-400 mr-1' />
                                  <span className='text-sm text-gray-700'>Website</span>
                                </label>
                                <label className='flex items-center'>
                                  <input
                                    type='checkbox'
                                    checked={preferenceForm.enable_email}
                                    onChange={e =>
                                      setPreferenceForm({
                                        ...preferenceForm,
                                        enable_email: e.target.checked,
                                      })
                                    }
                                    className='mr-2'
                                  />
                                  <Mail className='h-4 w-4 text-gray-400 mr-1' />
                                  <span className='text-sm text-gray-700'>Email</span>
                                </label>
                              </div>
                              <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>
                                  Frequency
                                </label>
                                <select
                                  value={preferenceForm.frequency}
                                  onChange={e =>
                                    setPreferenceForm({
                                      ...preferenceForm,
                                      frequency: e.target.value,
                                    })
                                  }
                                  className='w-full px-3 py-2 border border-gray-300 rounded-lg'
                                >
                                  <option value='immediate'>Immediate</option>
                                  <option value='daily_digest'>Daily Digest</option>
                                  <option value='weekly_digest'>Weekly Digest</option>
                                </select>
                              </div>
                              <div className='flex items-center space-x-2'>
                                <button
                                  onClick={() => {
                                    if (pref) {
                                      handleUpdatePreference(category.value);
                                    } else {
                                      handleCreatePreference();
                                    }
                                  }}
                                  disabled={
                                    updatePreferenceMutation.isLoading ||
                                    createPreferenceMutation.isLoading
                                  }
                                  className='flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
                                >
                                  <Edit className='h-4 w-4 mr-2' />
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCategory(null);
                                    resetForm();
                                  }}
                                  className='flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
                                >
                                  <X className='h-4 w-4 mr-2' />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className='flex items-center justify-between mb-3'>
                                <h3 className='text-lg font-semibold text-gray-900'>
                                  {category.label}
                                </h3>
                                <div className='flex items-center space-x-2'>
                                  {pref ? (
                                    <>
                                      <button
                                        onClick={() => handleEditPreference(pref)}
                                        className='p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
                                        title='Edit'
                                      >
                                        <Edit className='h-4 w-4' />
                                      </button>
                                      <button
                                        onClick={() => handleDeletePreference(pref.category)}
                                        className='p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                                        title='Delete'
                                      >
                                        <Trash2 className='h-4 w-4' />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingCategory(category.value);
                                        setPreferenceForm({
                                          category: category.value,
                                          enable_website: [
                                            'system',
                                            'new_dive_sites',
                                            'new_dive_trips',
                                            'admin_alerts',
                                          ].includes(category.value),
                                          enable_email: false,
                                          frequency: 'immediate',
                                          area_filter: null,
                                        });
                                      }}
                                      className='flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                                      title='Create preference'
                                    >
                                      <Plus className='h-4 w-4 mr-1' />
                                      Create
                                    </button>
                                  )}
                                </div>
                              </div>
                              {pref ? (
                                <>
                                  <div className='flex items-center space-x-6 text-sm'>
                                    <div className='flex items-center'>
                                      <Globe
                                        className={`h-4 w-4 mr-1 ${
                                          pref.enable_website ? 'text-green-600' : 'text-gray-300'
                                        }`}
                                      />
                                      <span
                                        className={
                                          pref.enable_website ? 'text-gray-900' : 'text-gray-400'
                                        }
                                      >
                                        Website {pref.enable_website ? 'Enabled' : 'Disabled'}
                                      </span>
                                    </div>
                                    <div className='flex items-center'>
                                      <Mail
                                        className={`h-4 w-4 mr-1 ${
                                          pref.enable_email ? 'text-green-600' : 'text-gray-300'
                                        }`}
                                      />
                                      <span
                                        className={
                                          pref.enable_email ? 'text-gray-900' : 'text-gray-400'
                                        }
                                      >
                                        Email {pref.enable_email ? 'Enabled' : 'Disabled'}
                                      </span>
                                    </div>
                                    <div className='flex items-center'>
                                      <span className='text-gray-600'>
                                        Frequency:{' '}
                                        <span className='font-medium'>{pref.frequency}</span>
                                      </span>
                                    </div>
                                  </div>
                                  {pref.area_filter && (
                                    <div className='mt-3 flex items-center text-sm text-gray-600'>
                                      <MapPin className='h-4 w-4 mr-1' />
                                      <span>Area filter configured</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className='text-sm text-gray-500 italic'>
                                  No preference configured
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Preference Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title='Create Notification Preference'
        className='max-w-md w-full mx-4'
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Category</label>
            <select
              value={preferenceForm.category}
              onChange={e => setPreferenceForm({ ...preferenceForm, category: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              <option value=''>Select category...</option>
              {notificationCategories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className='flex items-center space-x-6'>
            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={preferenceForm.enable_website}
                onChange={e =>
                  setPreferenceForm({ ...preferenceForm, enable_website: e.target.checked })
                }
                className='mr-2'
              />
              <Globe className='h-4 w-4 text-gray-400 mr-1' />
              <span className='text-sm text-gray-700'>Website</span>
            </label>
            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={preferenceForm.enable_email}
                onChange={e =>
                  setPreferenceForm({ ...preferenceForm, enable_email: e.target.checked })
                }
                className='mr-2'
              />
              <Mail className='h-4 w-4 text-gray-400 mr-1' />
              <span className='text-sm text-gray-700'>Email</span>
            </label>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Frequency</label>
            <select
              value={preferenceForm.frequency}
              onChange={e => setPreferenceForm({ ...preferenceForm, frequency: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              <option value='immediate'>Immediate</option>
              <option value='daily_digest'>Daily Digest</option>
              <option value='weekly_digest'>Weekly Digest</option>
            </select>
          </div>
        </div>
        <div className='flex items-center justify-end space-x-3 mt-6'>
          <button
            onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            className='px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePreference}
            disabled={!preferenceForm.category || createPreferenceMutation.isLoading}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50'
          >
            {createPreferenceMutation.isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </Modal>

      {/* Batch Update Modal */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => {
          setShowBatchModal(false);
          setBatchForm({
            category: '',
            enable_website: null,
            enable_email: null,
            frequency: null,
            operation: 'update',
          });
        }}
        title='Batch Update Notification Preferences'
        description={`Apply changes to ${selectedUserIds.size} selected user${selectedUserIds.size !== 1 ? 's' : ''}`}
        className='max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto'
      >
        <div className='space-y-6'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-3'>Operation</label>
            <div className='flex space-x-2'>
              <button
                type='button'
                onClick={() => setBatchForm({ ...batchForm, operation: 'update' })}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  batchForm.operation === 'update'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Update Existing
              </button>
              <button
                type='button'
                onClick={() => setBatchForm({ ...batchForm, operation: 'create' })}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  batchForm.operation === 'create'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Create New
              </button>
            </div>
            <p className='text-xs text-gray-500 mt-2'>
              {batchForm.operation === 'update'
                ? 'Updates existing preferences. Only specified fields will be changed.'
                : 'Creates new preferences. If preference exists, it will be updated instead.'}
            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-3'>
              Category <span className='text-red-500'>*</span>
            </label>
            <div className='grid grid-cols-2 gap-2'>
              {notificationCategories.map(cat => (
                <button
                  key={cat.value}
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, category: cat.value })}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm ${
                    batchForm.category === cat.value
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-3'>
                Enable Website Notifications
              </label>
              <div className='flex space-x-2'>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, enable_website: null })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.enable_website === null
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  No change
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, enable_website: true })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.enable_website === true
                      ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Enable
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, enable_website: false })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.enable_website === false
                      ? 'bg-red-50 border-red-500 text-red-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Disable
                </button>
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-3'>
                Enable Email Notifications
              </label>
              <div className='flex space-x-2'>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, enable_email: null })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.enable_email === null
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  No change
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, enable_email: true })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.enable_email === true
                      ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Enable
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, enable_email: false })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.enable_email === false
                      ? 'bg-red-50 border-red-500 text-red-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Disable
                </button>
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-3'>Frequency</label>
              <div className='flex space-x-2'>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, frequency: null })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.frequency === null
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  No change
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, frequency: 'immediate' })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.frequency === 'immediate'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Immediate
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, frequency: 'daily_digest' })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.frequency === 'daily_digest'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Daily Digest
                </button>
                <button
                  type='button'
                  onClick={() => setBatchForm({ ...batchForm, frequency: 'weekly_digest' })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    batchForm.frequency === 'weekly_digest'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Weekly Digest
                </button>
              </div>
            </div>
          </div>

          {batchForm.operation === 'create' && (
            <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-3'>
              <p className='text-sm text-yellow-800'>
                <strong>Note:</strong> If a preference already exists for a user, it will be updated
                instead of creating a duplicate.
              </p>
            </div>
          )}
        </div>
        <div className='flex items-center justify-end space-x-3 mt-6'>
          <button
            onClick={() => {
              setShowBatchModal(false);
              setBatchForm({
                category: '',
                enable_website: null,
                enable_email: null,
                frequency: null,
                operation: 'update',
              });
            }}
            className='px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleBatchUpdate}
            disabled={
              !batchForm.category ||
              batchUpdateMutation.isLoading ||
              (batchForm.operation === 'update' &&
                batchForm.enable_website === null &&
                batchForm.enable_email === null &&
                batchForm.frequency === null)
            }
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {batchUpdateMutation.isLoading
              ? `Updating ${selectedUserIds.size} users...`
              : `Apply to ${selectedUserIds.size} user${selectedUserIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminNotificationPreferences;
