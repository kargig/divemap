import { Trash2, Edit, Plus, Search, X, Loader, Save, Globe } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const AdminDivingOrganizations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Admin - Diving Organizations');

  // Organization management state
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    acronym: '',
    website: '',
    logo_url: '',
    description: '',
    country: '',
    founded_year: '',
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch organizations data
  const { data: organizations, isLoading } = useQuery(
    ['admin-diving-organizations'],
    () => api.get('/api/v1/diving-organizations/'),
    {
      select: response => response.data,
    }
  );

  // Organization mutations
  const createOrgMutation = useMutation(
    orgData => api.post('/api/v1/diving-organizations/', orgData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-diving-organizations']);
        toast.success('Organization created successfully!');
        setShowCreateOrgModal(false);
        setOrgForm({
          name: '',
          acronym: '',
          website: '',
          logo_url: '',
          description: '',
          country: '',
          founded_year: '',
        });
      },
      onError: _error => {
        toast.error('Failed to create organization');
      },
    }
  );

  const updateOrgMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/diving-organizations/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-diving-organizations']);
        toast.success('Organization updated successfully!');
        setShowEditOrgModal(false);
        setEditingOrg(null);
        setOrgForm({
          name: '',
          acronym: '',
          website: '',
          logo_url: '',
          description: '',
          country: '',
          founded_year: '',
        });
      },
      onError: _error => {
        toast.error('Failed to update organization');
      },
    }
  );

  const deleteOrgMutation = useMutation(id => api.delete(`/api/v1/diving-organizations/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-diving-organizations']);
      toast.success('Organization deleted successfully!');
    },
    onError: _error => {
      toast.error('Failed to delete organization');
    },
  });

  // Mass delete mutation
  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/diving-organizations/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-diving-organizations']);
        setSelectedItems(new Set());
        toast.success(`${selectedItems.size} organization(s) deleted successfully!`);
      },
      onError: _error => {
        toast.error('Failed to delete some organizations');
      },
    }
  );

  // Selection handlers
  const handleSelectAll = checked => {
    if (checked) {
      setSelectedItems(new Set(organizations?.map(org => org.id) || []));
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
    if (selectedItems.size === 0) return;

    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} organization(s)?`)) {
      massDeleteMutation.mutate(Array.from(selectedItems));
    }
  };

  // Form handlers
  const handleCreateOrg = () => {
    const data = {
      ...orgForm,
      founded_year: orgForm.founded_year ? parseInt(orgForm.founded_year) : null,
    };
    createOrgMutation.mutate(data);
  };

  const handleEditOrg = org => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      acronym: org.acronym,
      website: org.website || '',
      logo_url: org.logo_url || '',
      description: org.description || '',
      country: org.country || '',
      founded_year: org.founded_year ? org.founded_year.toString() : '',
    });
    setShowEditOrgModal(true);
  };

  const handleUpdateOrg = () => {
    const data = {
      ...orgForm,
      founded_year: orgForm.founded_year ? parseInt(orgForm.founded_year) : null,
    };
    updateOrgMutation.mutate({ id: editingOrg.id, data });
  };

  const handleDeleteOrg = org => {
    if (window.confirm(`Are you sure you want to delete "${org.name}"?`)) {
      deleteOrgMutation.mutate(org.id);
    }
  };

  const resetOrgForm = () => {
    setOrgForm({
      name: '',
      acronym: '',
      website: '',
      logo_url: '',
      description: '',
      country: '',
      founded_year: '',
    });
  };

  // Filter organizations based on search term
  const filteredOrganizations =
    organizations?.filter(
      org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.acronym.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.country && org.country.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Diving Organizations Management</h1>
        <p className='text-gray-600 mt-2'>
          Manage diving certification organizations and their details
        </p>
      </div>

      {/* Search and Actions Bar */}
      <div className='flex flex-col sm:flex-row gap-4 mb-6'>
        <div className='flex-1 relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <input
            type='text'
            placeholder='Search organizations...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => setShowCreateOrgModal(true)}
            className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            <Plus className='h-4 w-4' />
            Add Organization
          </button>
          {selectedItems.size > 0 && (
            <button
              onClick={handleMassDelete}
              className='flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors'
            >
              <Trash2 className='h-4 w-4' />
              Delete Selected ({selectedItems.size})
            </button>
          )}
        </div>
      </div>

      {/* Organizations Table */}
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left'>
                  <input
                    type='checkbox'
                    checked={
                      selectedItems.size === (organizations?.length || 0) &&
                      organizations?.length > 0
                    }
                    onChange={e => handleSelectAll(e.target.checked)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Organization
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Acronym
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Country
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Founded
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Website
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {isLoading ? (
                <tr>
                  <td colSpan='7' className='px-6 py-4 text-center'>
                    <Loader className='h-6 w-6 animate-spin mx-auto text-gray-400' />
                  </td>
                </tr>
              ) : filteredOrganizations.length === 0 ? (
                <tr>
                  <td colSpan='7' className='px-6 py-4 text-center text-gray-500'>
                    No organizations found
                  </td>
                </tr>
              ) : (
                filteredOrganizations.map(org => (
                  <tr key={org.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <input
                        type='checkbox'
                        checked={selectedItems.has(org.id)}
                        onChange={e => handleSelectItem(org.id, e.target.checked)}
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                      />
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <div className='flex-shrink-0 h-10 w-10'>
                          {org.logo_url ? (
                            <img
                              className='h-10 w-10 rounded-full object-cover'
                              src={org.logo_url}
                              alt={org.name}
                            />
                          ) : (
                            <div className='h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center'>
                              <span className='text-gray-500 font-medium'>{org.acronym}</span>
                            </div>
                          )}
                        </div>
                        <div className='ml-4'>
                          <div className='text-sm font-medium text-gray-900'>{org.name}</div>
                          {org.description && (
                            <div className='text-sm text-gray-500 truncate max-w-xs'>
                              {org.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                        {org.acronym}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {org.country || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {org.founded_year || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {org.website ? (
                        <a
                          href={org.website}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:text-blue-800 flex items-center gap-1'
                        >
                          <Globe className='h-4 w-4' />
                          Visit
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={() => handleEditOrg(org)}
                          className='text-blue-600 hover:text-blue-900 p-1 rounded'
                        >
                          <Edit className='h-4 w-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(org)}
                          className='text-red-600 hover:text-red-900 p-1 rounded'
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

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold'>Create New Organization</h3>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                className='text-gray-400 hover:text-gray-600'
              >
                <X className='h-6 w-6' />
              </button>
            </div>

            <div className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='org-name'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Name *
                  </label>
                  <input
                    id='org-name'
                    type='text'
                    value={orgForm.name}
                    onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='Organization name'
                  />
                </div>
                <div>
                  <label
                    htmlFor='org-acronym'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Acronym *
                  </label>
                  <input
                    id='org-acronym'
                    type='text'
                    value={orgForm.acronym}
                    onChange={e =>
                      setOrgForm({ ...orgForm, acronym: e.target.value.toUpperCase() })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='PADI, SSI, etc.'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='org-country'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Country
                  </label>
                  <input
                    id='org-country'
                    type='text'
                    value={orgForm.country}
                    onChange={e => setOrgForm({ ...orgForm, country: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='United States'
                  />
                </div>
                <div>
                  <label
                    htmlFor='org-founded-year'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Founded Year
                  </label>
                  <input
                    id='org-founded-year'
                    type='number'
                    value={orgForm.founded_year}
                    onChange={e => setOrgForm({ ...orgForm, founded_year: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='1966'
                    min='1800'
                    max='2100'
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor='org-website'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Website
                </label>
                <input
                  id='org-website'
                  type='url'
                  value={orgForm.website}
                  onChange={e => setOrgForm({ ...orgForm, website: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                  placeholder='https://www.example.com'
                />
              </div>

              <div>
                <label
                  htmlFor='org-logo-url'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Logo URL
                </label>
                <input
                  id='org-logo-url'
                  type='url'
                  value={orgForm.logo_url}
                  onChange={e => setOrgForm({ ...orgForm, logo_url: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                  placeholder='https://example.com/logo.png'
                />
              </div>

              <div>
                <label
                  htmlFor='org-description'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Description
                </label>
                <textarea
                  id='org-description'
                  value={orgForm.description}
                  onChange={e => setOrgForm({ ...orgForm, description: e.target.value })}
                  rows='3'
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Brief description of the organization...'
                />
              </div>
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => {
                  setShowCreateOrgModal(false);
                  resetOrgForm();
                }}
                className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={!orgForm.name || !orgForm.acronym || createOrgMutation.isLoading}
                className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
              >
                {createOrgMutation.isLoading ? (
                  <Loader className='h-4 w-4 animate-spin' />
                ) : (
                  <Save className='h-4 w-4' />
                )}
                Create Organization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {showEditOrgModal && editingOrg && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold'>Edit Organization</h3>
              <button
                onClick={() => setShowEditOrgModal(false)}
                className='text-gray-400 hover:text-gray-600'
              >
                <X className='h-6 w-6' />
              </button>
            </div>

            <div className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='edit-org-name'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Name *
                  </label>
                  <input
                    id='edit-org-name'
                    type='text'
                    value={orgForm.name}
                    onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='Organization name'
                  />
                </div>
                <div>
                  <label
                    htmlFor='edit-org-acronym'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Acronym *
                  </label>
                  <input
                    id='edit-org-acronym'
                    type='text'
                    value={orgForm.acronym}
                    onChange={e =>
                      setOrgForm({ ...orgForm, acronym: e.target.value.toUpperCase() })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='PADI, SSI, etc.'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label
                    htmlFor='edit-org-country'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Country
                  </label>
                  <input
                    id='edit-org-country'
                    type='text'
                    value={orgForm.country}
                    onChange={e => setOrgForm({ ...orgForm, country: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='United States'
                  />
                </div>
                <div>
                  <label
                    htmlFor='edit-org-founded-year'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Founded Year
                  </label>
                  <input
                    id='edit-org-founded-year'
                    type='number'
                    value={orgForm.founded_year}
                    onChange={e => setOrgForm({ ...orgForm, founded_year: e.target.value })}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                    placeholder='1966'
                    min='1800'
                    max='2100'
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor='edit-org-website'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Website
                </label>
                <input
                  id='edit-org-website'
                  type='url'
                  value={orgForm.website}
                  onChange={e => setOrgForm({ ...orgForm, website: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                  placeholder='https://www.example.com'
                />
              </div>

              <div>
                <label
                  htmlFor='edit-org-logo-url'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Logo URL
                </label>
                <input
                  id='edit-org-logo-url'
                  type='url'
                  value={orgForm.logo_url}
                  onChange={e => setOrgForm({ ...orgForm, logo_url: e.target.value })}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                  placeholder='https://example.com/logo.png'
                />
              </div>

              <div>
                <label
                  htmlFor='edit-org-description'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Description
                </label>
                <textarea
                  id='edit-org-description'
                  value={orgForm.description}
                  onChange={e => setOrgForm({ ...orgForm, description: e.target.value })}
                  rows='3'
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Brief description of the organization...'
                />
              </div>
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => {
                  setShowEditOrgModal(false);
                  resetOrgForm();
                }}
                className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateOrg}
                disabled={!orgForm.name || !orgForm.acronym || updateOrgMutation.isLoading}
                className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
              >
                {updateOrgMutation.isLoading ? (
                  <Loader className='h-4 w-4 animate-spin' />
                ) : (
                  <Save className='h-4 w-4' />
                )}
                Update Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDivingOrganizations;
