import {
  Key,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit2,
  Ban,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Calendar,
  Shield,
  User,
  Loader2,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import { getAdminApiKeys, createAdminApiKey, updateAdminApiKey, deleteAdminApiKey } from '../api';
import SEO from '../components/SEO';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateHelpers';

const AdminApiKeys = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | revoked | expired

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);

  // Active target for edit/delete/revoke
  const [selectedKey, setSelectedKey] = useState(null);

  // Created key result (only visible once)
  const [createdSecretKey, setCreatedSecretKey] = useState(null);
  const [copied, setCopied] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    expiryPreset: 'never',
    customExpiryDate: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    is_active: true,
    expires_at: '',
  });

  // Query API keys
  const {
    data: apiKeys,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery(['admin-api-keys'], getAdminApiKeys, {
    enabled: !!user?.is_admin,
    onError: err => {
      toast.error('Failed to load API keys');
      console.error(err);
    },
  });

  // Mutations
  const createMutation = useMutation(createAdminApiKey, {
    onSuccess: data => {
      queryClient.invalidateQueries(['admin-api-keys']);
      setCreatedSecretKey(data);
      setIsCreateOpen(false);
      setIsSuccessOpen(true);
      setCreateForm({
        name: '',
        description: '',
        expiryPreset: 'never',
        customExpiryDate: '',
      });
      toast.success('API key generated successfully!');
    },
    onError: err => {
      const msg = err.response?.data?.detail || 'Failed to generate API key';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation(({ id, data }) => updateAdminApiKey(id, data), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-api-keys']);
      setIsEditOpen(false);
      setSelectedKey(null);
      toast.success('API key updated successfully!');
    },
    onError: err => {
      const msg = err.response?.data?.detail || 'Failed to update API key';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation(deleteAdminApiKey, {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-api-keys']);
      setIsDeleteOpen(false);
      setSelectedKey(null);
      toast.success('API key deleted successfully!');
    },
    onError: err => {
      const msg = err.response?.data?.detail || 'Failed to delete API key';
      toast.error(msg);
    },
  });

  const toggleStatusMutation = useMutation(
    ({ id, is_active }) => updateAdminApiKey(id, { is_active }),
    {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries(['admin-api-keys']);
        setIsRevokeOpen(false);
        setSelectedKey(null);
        toast.success(
          vars.is_active ? 'API key activated successfully!' : 'API key revoked successfully!'
        );
      },
      onError: err => {
        const msg = err.response?.data?.detail || 'Failed to update API key status';
        toast.error(msg);
      },
    }
  );

  // Form submit handlers
  const handleCreateSubmit = e => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error('Key name is required');
      return;
    }

    let expiresAt = null;
    const now = new Date();
    if (createForm.expiryPreset === '30d') {
      expiresAt = new Date(now.setDate(now.getDate() + 30)).toISOString();
    } else if (createForm.expiryPreset === '60d') {
      expiresAt = new Date(now.setDate(now.getDate() + 60)).toISOString();
    } else if (createForm.expiryPreset === '90d') {
      expiresAt = new Date(now.setDate(now.getDate() + 90)).toISOString();
    } else if (createForm.expiryPreset === '1y') {
      expiresAt = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
    } else if (createForm.expiryPreset === 'custom' && createForm.customExpiryDate) {
      expiresAt = new Date(createForm.customExpiryDate).toISOString();
    }

    createMutation.mutate({
      name: createForm.name.trim(),
      description: createForm.description.trim() || null,
      expires_at: expiresAt,
    });
  };

  const handleEditSubmit = e => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Key name is required');
      return;
    }

    updateMutation.mutate({
      id: selectedKey.id,
      data: {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        is_active: editForm.is_active,
        expires_at: editForm.expires_at ? new Date(editForm.expires_at).toISOString() : null,
      },
    });
  };

  const openEditModal = key => {
    setSelectedKey(key);
    setEditForm({
      name: key.name || '',
      description: key.description || '',
      is_active: key.is_active,
      expires_at: key.expires_at ? key.expires_at.slice(0, 10) : '',
    });
    setIsEditOpen(true);
  };

  const openDeleteModal = key => {
    setSelectedKey(key);
    setIsDeleteOpen(true);
  };

  const openRevokeModal = key => {
    setSelectedKey(key);
    setIsRevokeOpen(true);
  };

  const copyToClipboard = text => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtered keys
  const filteredKeys = useMemo(() => {
    if (!apiKeys) return [];
    const now = new Date();

    return apiKeys.filter(k => {
      // Search text
      const matchesSearch =
        k.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.created_by_username?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      const isExpired = k.expires_at && new Date(k.expires_at) < now;
      if (statusFilter === 'active') {
        return k.is_active && !isExpired;
      }
      if (statusFilter === 'revoked') {
        return !k.is_active;
      }
      if (statusFilter === 'expired') {
        return isExpired;
      }

      return true;
    });
  }, [apiKeys, searchTerm, statusFilter]);

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <SEO
        title='API Keys Management - Admin Dashboard'
        description='Manage internal service credentials and API keys on Divemap'
      />

      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8'>
        <div>
          <div className='flex items-center gap-2.5'>
            <div className='p-2 bg-indigo-50 text-indigo-700 rounded-lg'>
              <Key className='h-6 w-6' />
            </div>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>API Keys</h1>
              <p className='text-sm text-gray-500'>
                Manage service tokens and backend API credentials.
              </p>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className='inline-flex items-center px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50'
            title='Refresh'
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm'
          >
            <Plus className='h-4 w-4 mr-1.5' />
            Generate New Key
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className='bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
          <input
            type='text'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder='Search keys by name, description, creator...'
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          />
        </div>

        <div className='flex items-center gap-2 self-start sm:self-auto'>
          <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className='px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='all'>All Keys</option>
            <option value='active'>Active Only</option>
            <option value='revoked'>Revoked</option>
            <option value='expired'>Expired</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
        {isLoading ? (
          <div className='flex flex-col items-center justify-center py-16 text-gray-500'>
            <Loader2 className='h-8 w-8 animate-spin text-blue-600 mb-2' />
            <p className='text-sm font-medium'>Loading API keys...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className='text-center py-16 px-4'>
            <Shield className='h-12 w-12 text-gray-300 mx-auto mb-3' />
            <h3 className='text-base font-semibold text-gray-900'>No API Keys Found</h3>
            <p className='text-sm text-gray-500 max-w-sm mx-auto mt-1 mb-4'>
              {searchTerm || statusFilter !== 'all'
                ? 'No keys match your current filter criteria.'
                : 'No API keys have been created yet. Generate your first key to allow internal services to authenticate.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors'
              >
                <Plus className='h-4 w-4 mr-1.5' />
                Generate Key
              </button>
            )}
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200 text-sm'>
              <thead className='bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider text-left'>
                <tr>
                  <th className='px-6 py-3.5'>Name & Details</th>
                  <th className='px-6 py-3.5'>Status</th>
                  <th className='px-6 py-3.5'>Created By</th>
                  <th className='px-6 py-3.5'>Created</th>
                  <th className='px-6 py-3.5'>Expires</th>
                  <th className='px-6 py-3.5'>Last Used</th>
                  <th className='px-6 py-3.5 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 text-gray-800 font-medium'>
                {filteredKeys.map(key => {
                  const isExpired = key.expires_at && new Date(key.expires_at) < new Date();

                  return (
                    <tr key={key.id} className='hover:bg-blue-50/20 transition-colors'>
                      {/* Name & Description */}
                      <td className='px-6 py-4'>
                        <div className='flex items-start gap-3'>
                          <div
                            className={`p-2 rounded-lg mt-0.5 ${
                              !key.is_active
                                ? 'bg-gray-100 text-gray-400'
                                : isExpired
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            <Key className='h-4 w-4' />
                          </div>
                          <div>
                            <div className='font-bold text-gray-900'>{key.name}</div>
                            {key.description && (
                              <div className='text-xs text-gray-500 mt-0.5 line-clamp-1'>
                                {key.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className='px-6 py-4'>
                        {!key.is_active ? (
                          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 gap-1'>
                            <Ban className='h-3 w-3' /> Revoked
                          </span>
                        ) : isExpired ? (
                          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 gap-1'>
                            <Clock className='h-3 w-3' /> Expired
                          </span>
                        ) : (
                          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 gap-1'>
                            <CheckCircle2 className='h-3 w-3' /> Active
                          </span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className='px-6 py-4 text-gray-600'>
                        <div className='flex items-center gap-1.5'>
                          <User className='h-3.5 w-3.5 text-gray-400' />
                          <span>{key.created_by_username || 'System'}</span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className='px-6 py-4 text-gray-500 whitespace-nowrap text-xs'>
                        {formatDate(key.created_at)}
                      </td>

                      {/* Expires */}
                      <td className='px-6 py-4 whitespace-nowrap text-xs'>
                        {key.expires_at ? (
                          <span
                            className={isExpired ? 'text-amber-600 font-bold' : 'text-gray-500'}
                          >
                            {formatDate(key.expires_at)}
                          </span>
                        ) : (
                          <span className='text-gray-400 italic'>Never</span>
                        )}
                      </td>

                      {/* Last Used */}
                      <td className='px-6 py-4 whitespace-nowrap text-xs'>
                        {key.last_used_at ? (
                          <span className='text-gray-700 font-medium'>
                            {formatDate(key.last_used_at)}
                          </span>
                        ) : (
                          <span className='text-gray-400 italic'>Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className='px-6 py-4 text-right whitespace-nowrap'>
                        <div className='flex items-center justify-end gap-1.5'>
                          {/* Toggle Active / Revoked */}
                          {key.is_active ? (
                            <button
                              onClick={() => openRevokeModal(key)}
                              className='p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors'
                              title='Revoke Key'
                            >
                              <Ban className='h-4 w-4' />
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: key.id,
                                  is_active: true,
                                })
                              }
                              className='p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors'
                              title='Activate Key'
                            >
                              <CheckCircle2 className='h-4 w-4' />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(key)}
                            className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                            title='Edit Key'
                          >
                            <Edit2 className='h-4 w-4' />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => openDeleteModal(key)}
                            className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors'
                            title='Delete Key'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE API KEY MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title='Generate API Key'
        description='Create a new secure credentials token for external or internal services.'
        className='max-w-md w-full'
      >
        <form onSubmit={handleCreateSubmit} className='mt-4 space-y-4'>
          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>
              Name <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              required
              value={createForm.name}
              onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder='e.g., AWS Lambda Notification Worker'
              className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>Description</label>
            <textarea
              rows={2}
              value={createForm.description}
              onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder='Optional details on where this token is stored or what it accesses...'
              className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>Expiration</label>
            <select
              value={createForm.expiryPreset}
              onChange={e => setCreateForm(prev => ({ ...prev, expiryPreset: e.target.value }))}
              className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='never'>No expiration (Recommended for services)</option>
              <option value='30d'>30 days</option>
              <option value='60d'>60 days</option>
              <option value='90d'>90 days</option>
              <option value='1y'>1 year</option>
              <option value='custom'>Custom date</option>
            </select>
          </div>

          {createForm.expiryPreset === 'custom' && (
            <div>
              <label className='block text-xs font-semibold text-gray-600 mb-1'>
                Custom Expiry Date
              </label>
              <input
                type='date'
                required
                min={new Date().toISOString().slice(0, 10)}
                value={createForm.customExpiryDate}
                onChange={e =>
                  setCreateForm(prev => ({ ...prev, customExpiryDate: e.target.value }))
                }
                className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          )}

          <div className='flex items-center justify-end gap-2 pt-3 border-t border-gray-100'>
            <button
              type='button'
              onClick={() => setIsCreateOpen(false)}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={createMutation.isLoading}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50'
            >
              {createMutation.isLoading && <Loader2 className='h-4 w-4 animate-spin mr-1.5' />}
              Generate Key
            </button>
          </div>
        </form>
      </Modal>

      {/* ONE-TIME SECRET DISPLAY MODAL */}
      <Modal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        title='API Key Generated'
        showCloseButton={false}
        preventOutsideClick={true}
        className='max-w-lg w-full'
      >
        <div className='mt-2 space-y-4'>
          <div className='p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3'>
            <AlertTriangle className='h-5 w-5 text-amber-600 shrink-0 mt-0.5' />
            <div className='text-xs text-amber-900'>
              <p className='font-bold mb-0.5'>Important Security Notice</p>
              <p>
                Store this API key in a secure location (e.g. AWS Parameter Store, Secrets Manager,
                or .env). It will <strong>never</strong> be displayed again.
              </p>
            </div>
          </div>

          <div>
            <label className='block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1'>
              Generated Key: {createdSecretKey?.name}
            </label>
            <div className='flex items-center gap-2'>
              <input
                type='text'
                readOnly
                value={createdSecretKey?.api_key || ''}
                className='font-mono text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg flex-1 select-all text-gray-900 font-semibold'
              />
              <button
                type='button'
                onClick={() => copyToClipboard(createdSecretKey?.api_key)}
                className={`inline-flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors border shadow-sm ${
                  copied
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {copied ? (
                  <>
                    <Check className='h-4 w-4 mr-1 text-green-600' />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className='h-4 w-4 mr-1 text-gray-500' />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className='flex justify-end pt-3 border-t border-gray-100'>
            <button
              type='button'
              onClick={() => {
                setIsSuccessOpen(false);
                setCreatedSecretKey(null);
              }}
              className='px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm'
            >
              I have saved my key
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT API KEY MODAL */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedKey(null);
        }}
        title={`Edit API Key: ${selectedKey?.name || ''}`}
        className='max-w-md w-full'
      >
        <form onSubmit={handleEditSubmit} className='mt-4 space-y-4'>
          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>
              Name <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              required
              value={editForm.name}
              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>Description</label>
            <textarea
              rows={2}
              value={editForm.description}
              onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200'>
            <div>
              <div className='text-sm font-semibold text-gray-900'>Active Status</div>
              <div className='text-xs text-gray-500'>
                {editForm.is_active ? 'Key is currently active' : 'Key is revoked/disabled'}
              </div>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={editForm.is_active}
                onChange={e => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>
              Expiration Date
            </label>
            <div className='flex items-center gap-2'>
              <input
                type='date'
                value={editForm.expires_at}
                onChange={e => setEditForm(prev => ({ ...prev, expires_at: e.target.value }))}
                className='w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
              {editForm.expires_at && (
                <button
                  type='button'
                  onClick={() => setEditForm(prev => ({ ...prev, expires_at: '' }))}
                  className='text-xs text-gray-500 hover:text-red-600 px-2 py-1'
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className='flex items-center justify-end gap-2 pt-3 border-t border-gray-100'>
            <button
              type='button'
              onClick={() => {
                setIsEditOpen(false);
                setSelectedKey(null);
              }}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={updateMutation.isLoading}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50'
            >
              {updateMutation.isLoading && <Loader2 className='h-4 w-4 animate-spin mr-1.5' />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* REVOKE CONFIRMATION MODAL */}
      <Modal
        isOpen={isRevokeOpen}
        onClose={() => {
          setIsRevokeOpen(false);
          setSelectedKey(null);
        }}
        title='Revoke API Key'
        className='max-w-md w-full'
      >
        <div className='mt-2 space-y-4'>
          <p className='text-sm text-gray-600'>
            Are you sure you want to revoke <strong>{selectedKey?.name}</strong>? Any external
            service or worker using this token will immediately be denied access.
          </p>

          <div className='flex items-center justify-end gap-2 pt-3 border-t border-gray-100'>
            <button
              type='button'
              onClick={() => {
                setIsRevokeOpen(false);
                setSelectedKey(null);
              }}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={() =>
                toggleStatusMutation.mutate({
                  id: selectedKey.id,
                  is_active: false,
                })
              }
              disabled={toggleStatusMutation.isLoading}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm disabled:opacity-50'
            >
              {toggleStatusMutation.isLoading && (
                <Loader2 className='h-4 w-4 animate-spin mr-1.5' />
              )}
              Yes, Revoke Key
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedKey(null);
        }}
        title='Delete API Key'
        className='max-w-md w-full'
      >
        <div className='mt-2 space-y-4'>
          <p className='text-sm text-gray-600'>
            Are you sure you want to permanently delete <strong>{selectedKey?.name}</strong>? This
            action cannot be undone.
          </p>

          <div className='flex items-center justify-end gap-2 pt-3 border-t border-gray-100'>
            <button
              type='button'
              onClick={() => {
                setIsDeleteOpen(false);
                setSelectedKey(null);
              }}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={() => deleteMutation.mutate(selectedKey.id)}
              disabled={deleteMutation.isLoading}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50'
            >
              {deleteMutation.isLoading && <Loader2 className='h-4 w-4 animate-spin mr-1.5' />}
              Permanently Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminApiKeys;
