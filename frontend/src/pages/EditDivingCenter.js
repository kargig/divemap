import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import api, { extractErrorMessage } from '../api';
import DivingCenterForm from '../components/DivingCenterForm';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { UI_COLORS } from '../utils/colorPalette';
import { getCurrencyOptions, DEFAULT_CURRENCY, formatCost } from '../utils/currency';

// Use extractErrorMessage from api.js
const getErrorMessage = error => extractErrorMessage(error, 'An error occurred');

const EditDivingCenter = () => {
  // Set page title
  usePageTitle('Divemap - Edit Diving Center');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({});

  const [newGearItem, setNewGearItem] = useState({
    item_name: '',
    cost: '',
    currency: DEFAULT_CURRENCY,
  });

  const [isAddingGear, setIsAddingGear] = useState(false);

  const [newOrganization, setNewOrganization] = useState({
    diving_organization_id: '',
    is_primary: false,
  });

  // Fetch diving center data
  const {
    data: divingCenter,
    isLoading,
    error,
  } = useQuery(
    ['diving-center', id],
    () => api.get(`/api/v1/diving-centers/${id}`).then(res => res.data),
    {
      enabled: !!id,
      onSuccess: data => {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          latitude: data.latitude ?? '',
          longitude: data.longitude ?? '',
          country: data.country || '',
          region: data.region || '',
          city: data.city || '',
          address: data.address || '',
        });
      },
    }
  );

  // Check if user has edit privileges
  const canEdit =
    user &&
    divingCenter &&
    (user.is_admin ||
      user.is_moderator ||
      (divingCenter.owner_username === user.username &&
        divingCenter.ownership_status === 'approved'));

  // Fetch gear rental costs
  const { data: gearRentalData = [], isLoading: gearLoading } = useQuery(
    ['diving-center-gear', id],
    () =>
      api.get(`/api/v1/diving-centers/${id}/gear-rental`).then(res => {
        return res.data || [];
      }),
    {
      enabled: !!id,
      onError: () => {
        toast.error('Failed to load gear rental data');
      },
    }
  );

  // Fetch diving organizations
  const { data: organizations = [] } = useQuery(['diving-organizations'], () =>
    api.get('/api/v1/diving-organizations/').then(res => res.data)
  );

  // Fetch center organizations
  const { data: centerOrganizations = [], isLoading: orgLoading } = useQuery(
    ['diving-center-organizations', id],
    () => api.get(`/api/v1/diving-centers/${id}/organizations`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Update mutation - return response data (not Axios response)
  const updateMutation = useMutation(
    data => api.put(`/api/v1/diving-centers/${id}`, data).then(res => res.data),
    {
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to update diving center');
      },
    }
  );

  // Add gear rental mutation
  const addGearMutation = useMutation(
    gearData => api.post(`/api/v1/diving-centers/${id}/gear-rental`, gearData),
    {
      onSuccess: () => {
        toast.success('Gear rental added successfully');
        queryClient.invalidateQueries(['diving-center-gear', id]);
        setNewGearItem({ item_name: '', cost: '', currency: DEFAULT_CURRENCY });
        setIsAddingGear(false);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to add gear rental');
      },
    }
  );

  // Delete gear rental mutation
  const deleteGearMutation = useMutation(
    gearId => api.delete(`/api/v1/diving-centers/${id}/gear-rental/${gearId}`),
    {
      onSuccess: () => {
        toast.success('Gear rental deleted successfully');
        queryClient.invalidateQueries(['diving-center-gear', id]);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to delete gear rental');
      },
    }
  );

  // Add organization mutation
  const addOrganizationMutation = useMutation(
    orgData => api.post(`/api/v1/diving-centers/${id}/organizations`, orgData),
    {
      onSuccess: () => {
        toast.success('Organization added successfully');
        queryClient.invalidateQueries(['diving-center-organizations', id]);
        setNewOrganization({
          diving_organization_id: '',
          is_primary: false,
        });
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to add organization');
      },
    }
  );

  // Update organization mutation
  const updateOrganizationMutation = useMutation(
    ({ orgId, data }) => api.put(`/api/v1/diving-centers/${id}/organizations/${orgId}`, data),
    {
      onSuccess: () => {
        toast.success('Organization updated successfully');
        queryClient.invalidateQueries(['diving-center-organizations', id]);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to update organization');
      },
    }
  );

  // Delete organization mutation
  const deleteOrganizationMutation = useMutation(
    orgId => api.delete(`/api/v1/diving-centers/${id}/organizations/${orgId}`),
    {
      onSuccess: () => {
        toast.success('Organization removed successfully');
        queryClient.invalidateQueries(['diving-center-organizations', id]);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to remove organization');
      },
    }
  );

  // Handled inside DivingCenterForm

  const handleSubmit = values => {
    // values come validated from DivingCenterForm and include numeric lat/lng
    const submitData = {
      ...values,
    };

    updateMutation.mutate(submitData, {
      onSuccess: async updatedDivingCenter => {
        // Ensure detail view refreshes with fresh data
        queryClient.setQueryData(['diving-center', id], updatedDivingCenter);
        await queryClient.invalidateQueries(['diving-center', id]);
        await queryClient.invalidateQueries(['diving-centers']);
        await queryClient.invalidateQueries(['admin-diving-centers']);
        await new Promise(resolve => setTimeout(resolve, 100));
        toast.success('Diving center updated successfully');
        navigate(`/diving-centers/${id}`);
      },
    });
  };

  const handleAddGear = () => {
    if (!newGearItem.item_name.trim() || !newGearItem.cost.trim()) {
      toast.error('Please enter both item name and cost');
      return;
    }
    addGearMutation.mutate({
      item_name: newGearItem.item_name,
      cost: parseFloat(newGearItem.cost),
      currency: newGearItem.currency,
    });
  };

  const handleDeleteGear = gearId => {
    if (window.confirm('Are you sure you want to delete this gear rental item?')) {
      deleteGearMutation.mutate(gearId);
    }
  };

  // Organization management functions
  const handleOrganizationChange = e => {
    const { name, value, type, checked } = e.target;
    setNewOrganization(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddOrganization = () => {
    if (!newOrganization.diving_organization_id) {
      toast.error('Please select an organization');
      return;
    }

    const org = organizations.find(o => o.id == newOrganization.diving_organization_id);
    if (!org) {
      toast.error('Invalid organization selected');
      return;
    }

    // Check if organization is already added
    if (
      centerOrganizations.some(
        co => co.diving_organization.id == newOrganization.diving_organization_id
      )
    ) {
      toast.error('This organization is already associated with this diving center');
      return;
    }

    addOrganizationMutation.mutate({
      diving_organization_id: newOrganization.diving_organization_id,
      is_primary: newOrganization.is_primary,
    });
  };

  const handleRemoveOrganization = orgId => {
    if (window.confirm('Are you sure you want to remove this organization?')) {
      deleteOrganizationMutation.mutate(orgId);
    }
  };

  const handleTogglePrimary = (orgId, currentPrimary) => {
    updateOrganizationMutation.mutate({
      orgId,
      data: { is_primary: !currentPrimary },
    });
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='animate-pulse'>
              <div className='h-8 bg-gray-200 rounded w-1/4 mb-4'></div>
              <div className='space-y-3'>
                <div className='h-4 bg-gray-200 rounded'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
                <div className='h-4 bg-gray-200 rounded w-4/6'></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-gray-900 mb-4'>Access Denied</h1>
            <p className='text-gray-600'>You don&apos;t have permission to edit diving centers.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
            <p className='text-gray-600'>Failed to load diving center: {getErrorMessage(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-4xl mx-auto px-4'>
        <div className='bg-white rounded-lg shadow-md p-6'>
          {/* Header */}
          <div className='flex items-center justify-between mb-6'>
            <h1 className='text-3xl font-bold text-gray-900'>Edit Diving Center</h1>
          </div>

          <DivingCenterForm
            mode='edit'
            initialValues={formData}
            onCancel={() => navigate(`/diving-centers/${id}`)}
            onSubmit={handleSubmit}
          />

          {/* Diving Organizations */}
          <div className='border-t pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>Diving Organizations</h3>
            </div>

            {/* Add Organization Form */}
            <div className='bg-gray-50 p-4 rounded-lg mb-4'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div>
                  <label
                    htmlFor='diving-organization-select'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Organization
                  </label>
                  <select
                    id='diving-organization-select'
                    name='diving_organization_id'
                    value={newOrganization.diving_organization_id}
                    onChange={handleOrganizationChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>Select Organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.acronym} - {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex items-end'>
                  <label htmlFor='primary-organization' className='flex items-center'>
                    <input
                      id='primary-organization'
                      type='checkbox'
                      name='is_primary'
                      checked={newOrganization.is_primary}
                      onChange={handleOrganizationChange}
                      className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                    />
                    <span className='ml-2 text-sm text-gray-700'>Primary Organization</span>
                  </label>
                </div>

                <div className='flex items-end'>
                  <button
                    type='button'
                    onClick={handleAddOrganization}
                    disabled={addOrganizationMutation.isLoading}
                    className='flex items-center px-4 py-2 text-white rounded-md disabled:opacity-50'
                    style={{ backgroundColor: UI_COLORS.success }}
                    onMouseEnter={e =>
                      !e.currentTarget.disabled &&
                      (e.currentTarget.style.backgroundColor = '#007a5c')
                    }
                    onMouseLeave={e =>
                      !e.currentTarget.disabled &&
                      (e.currentTarget.style.backgroundColor = UI_COLORS.success)
                    }
                  >
                    <Plus className='h-4 w-4 mr-2' />
                    {addOrganizationMutation.isLoading ? 'Adding...' : 'Add Organization'}
                  </button>
                </div>
              </div>
            </div>

            {/* Organization List */}
            <div className='space-y-3'>
              {orgLoading && (
                <div className='text-center py-4'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                  <p className='text-gray-600 mt-2'>Loading organizations...</p>
                </div>
              )}
              {!orgLoading && centerOrganizations.length === 0 && (
                <p className='text-gray-500 text-center py-4'>No organizations associated yet.</p>
              )}
              {!orgLoading &&
                centerOrganizations.map(org => (
                  <div
                    key={org.id}
                    className='flex items-center justify-between p-4 border rounded-lg'
                  >
                    <div className='flex items-center space-x-3'>
                      <span className='font-medium'>
                        {org.diving_organization.acronym} - {org.diving_organization.name}
                      </span>
                      {org.is_primary && (
                        <span className='px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full'>
                          Primary
                        </span>
                      )}
                    </div>
                    <div className='flex items-center space-x-2'>
                      <button
                        type='button'
                        onClick={() => handleTogglePrimary(org.id, org.is_primary)}
                        disabled={updateOrganizationMutation.isLoading}
                        className={`px-2 py-1 text-xs rounded ${
                          org.is_primary
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {org.is_primary ? 'Primary' : 'Set Primary'}
                      </button>
                      <button
                        type='button'
                        onClick={() => handleRemoveOrganization(org.id)}
                        disabled={deleteOrganizationMutation.isLoading}
                        className='p-1 text-red-500 hover:text-red-700 disabled:opacity-50'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Gear Rental Management */}
          <div className='border-t pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>Gear Rental Costs</h3>
              <button
                type='button'
                onClick={() => setIsAddingGear(!isAddingGear)}
                className='flex items-center px-4 py-2 text-white rounded-md'
                style={{ backgroundColor: UI_COLORS.success }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#007a5c')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
              >
                <Plus className='w-4 h-4 mr-2' />
                Add Gear Rental
              </button>
            </div>

            {/* Add Gear Rental Form */}
            {isAddingGear && (
              <div className='bg-gray-50 p-4 rounded-md mb-4'>
                <div className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <div>
                      <label
                        htmlFor='gear-item-name'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Item Name *
                      </label>
                      <input
                        id='gear-item-name'
                        type='text'
                        value={newGearItem.item_name}
                        onChange={e =>
                          setNewGearItem(prev => ({ ...prev, item_name: e.target.value }))
                        }
                        required
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='e.g., Full Set, BCD, Regulator'
                      />
                    </div>
                    <div>
                      <label
                        htmlFor='gear-cost'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Cost *
                      </label>
                      <input
                        id='gear-cost'
                        type='number'
                        step='0.01'
                        value={newGearItem.cost}
                        onChange={e => setNewGearItem(prev => ({ ...prev, cost: e.target.value }))}
                        required
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='0.00'
                      />
                    </div>
                    <div>
                      <label
                        htmlFor='gear-currency'
                        className='block text-sm font-medium text-gray-700 mb-1'
                      >
                        Currency
                      </label>
                      <select
                        id='gear-currency'
                        value={newGearItem.currency}
                        onChange={e =>
                          setNewGearItem(prev => ({ ...prev, currency: e.target.value }))
                        }
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        {getCurrencyOptions().map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className='flex space-x-2'>
                    <button
                      type='button'
                      onClick={handleAddGear}
                      disabled={addGearMutation.isLoading}
                      className='px-4 py-2 text-white rounded-md disabled:opacity-50'
                      style={{ backgroundColor: UI_COLORS.success }}
                      onMouseEnter={e =>
                        !e.currentTarget.disabled &&
                        (e.currentTarget.style.backgroundColor = '#007a5c')
                      }
                      onMouseLeave={e =>
                        !e.currentTarget.disabled &&
                        (e.currentTarget.style.backgroundColor = UI_COLORS.success)
                      }
                    >
                      {addGearMutation.isLoading ? 'Adding...' : 'Add Gear Rental'}
                    </button>
                    <button
                      type='button'
                      onClick={() => setIsAddingGear(false)}
                      className='px-4 py-2 text-white rounded-md'
                      style={{ backgroundColor: UI_COLORS.neutral }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1f2937')}
                      onMouseLeave={e =>
                        (e.currentTarget.style.backgroundColor = UI_COLORS.neutral)
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Gear Rental List */}
            <div className='space-y-3'>
              {gearLoading && (
                <div className='text-center py-4'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                  <p className='text-gray-600 mt-2'>Loading gear rental...</p>
                </div>
              )}
              {!gearLoading && Array.isArray(gearRentalData) && gearRentalData.length === 0 && (
                <p className='text-gray-500 text-center py-4'>No gear rental items added yet.</p>
              )}
              {!gearLoading &&
                Array.isArray(gearRentalData) &&
                gearRentalData.map(item => (
                  <div
                    key={item.id}
                    className='flex items-center justify-between p-4 border rounded-lg'
                  >
                    <div>
                      <h4 className='font-medium text-gray-900'>{item.item_name}</h4>
                      <p className='text-sm text-gray-600'>
                        {formatCost(item.cost, item.currency || DEFAULT_CURRENCY)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteGear(item.id)}
                      className='text-red-600 hover:text-red-800'
                      title='Delete gear rental'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditDivingCenter;
