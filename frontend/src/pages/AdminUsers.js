import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Save, Loader, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const AdminUsers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // User management state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    is_admin: false,
    is_moderator: false,
    enabled: true
  });

  // Fetch users data
  const { data: users, isLoading } = useQuery(
    ['admin-users'],
    () => api.get('/api/v1/users/admin/users'),
    {
      select: (response) => response.data,
    }
  );

  // User mutations
  const createUserMutation = useMutation(
    (userData) => api.post('/api/v1/users/admin/users', userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User created successfully!');
        setShowCreateUserModal(false);
        setUserForm({
          username: '',
          email: '',
          password: '',
          is_admin: false,
          is_moderator: false,
          enabled: true
        });
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to create user');
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
          password: '',
          is_admin: false,
          is_moderator: false,
          enabled: true
        });
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update user');
      },
    }
  );

  const deleteUserMutation = useMutation(
    (id) => api.delete(`/api/v1/users/admin/users/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete user');
      },
    }
  );

  // User handlers
  const handleCreateUser = () => {
    if (!userForm.username.trim() || !userForm.email.trim() || !userForm.password.trim()) {
      toast.error('Username, email, and password are required');
      return;
    }
    createUserMutation.mutate(userForm);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      password: '', // Don't pre-fill password for security
      is_admin: user.is_admin,
      is_moderator: user.is_moderator,
      enabled: user.enabled
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
      data: updateData
    });
  };

  const handleDeleteUser = (user) => {
    if (user.id === user?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the user "${user.username}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      email: '',
      password: '',
      is_admin: false,
      is_moderator: false,
      enabled: true
    });
    setEditingUser(null);
  };

  if (!user?.is_admin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage all users in the system</p>
        </div>
        <button
          onClick={() => setShowCreateUserModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((userItem) => (
                <tr key={userItem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{userItem.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{userItem.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      userItem.is_admin ? 'bg-red-100 text-red-800' :
                      userItem.is_moderator ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {userItem.is_admin ? 'Admin' : userItem.is_moderator ? 'Moderator' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      userItem.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {userItem.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(userItem.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(userItem)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {userItem.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(userItem)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No users found.</p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New User</h3>
              <button
                onClick={() => {
                  setShowCreateUserModal(false);
                  resetUserForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userForm.is_admin}
                    onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Admin privileges</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userForm.is_moderator}
                    onChange={(e) => setUserForm({ ...userForm, is_moderator: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Moderator privileges</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userForm.enabled}
                    onChange={(e) => setUserForm({ ...userForm, enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Account enabled</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateUserModal(false);
                  resetUserForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createUserMutation.isLoading ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  resetUserForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password (optional)"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userForm.is_admin}
                    onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Admin privileges</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userForm.is_moderator}
                    onChange={(e) => setUserForm({ ...userForm, is_moderator: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Moderator privileges</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userForm.enabled}
                    onChange={(e) => setUserForm({ ...userForm, enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Account enabled</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  resetUserForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updateUserMutation.isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updateUserMutation.isLoading ? (
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Update User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers; 