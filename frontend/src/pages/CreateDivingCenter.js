import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import DivingCenterForm from '../components/DivingCenterForm';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

// Extract a readable message from FastAPI/axios error payloads
const getErrorMessage = error => {
  if (!error) return 'Failed to create diving center';
  if (typeof error === 'string') return error;
  const detail = error?.response?.data?.detail ?? error?.response?.data ?? error?.message;
  if (!detail) return 'Failed to create diving center';
  if (typeof detail === 'string') return detail;
  try {
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first?.msg) return first.msg;
      return JSON.stringify(detail);
    }
    return JSON.stringify(detail);
  } catch {
    return 'Failed to create diving center';
  }
};

const CreateDivingCenter = () => {
  // Set page title
  usePageTitle('Divemap - Create Diving Center');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedOrganizations, setSelectedOrganizations] = useState([]);
  const [newOrganization, setNewOrganization] = useState({
    diving_organization_id: '',
    is_primary: false,
  });

  // Important: keep a stable reference so the child form doesn't reset on parent re-renders
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    latitude: '',
    longitude: '',
    country: '',
    region: '',
    city: '',
    address: '',
  });

  const resetCreateForm = () => {
    setCreateFormData({
      name: '',
      description: '',
      email: '',
      phone: '',
      website: '',
      latitude: '',
      longitude: '',
      country: '',
      region: '',
      city: '',
      address: '',
    });
  };

  // Persist create form state to survive unexpected remounts
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('create-diving-center-form');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setCreateFormData(prev => ({ ...prev, ...parsed }));
        }
      }
    } catch {}
    // run once on mount
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('create-diving-center-form', JSON.stringify(createFormData));
    } catch {}
  }, [createFormData]);

  // Fetch diving organizations
  const { data: organizations = [] } = useQuery(['diving-organizations'], () =>
    api.get('/api/v1/diving-organizations/').then(res => res.data)
  );

  const createDivingCenterMutation = useMutation(
    async data => {
      // First create the diving center
      const centerResponse = await api.post('/api/v1/diving-centers/', data);
      const centerId = centerResponse.data.id;

      // Then add organization associations
      for (const org of selectedOrganizations) {
        await api.post(`/api/v1/diving-centers/${centerId}/organizations`, {
          diving_organization_id: org.diving_organization_id,
          is_primary: org.is_primary,
        });
      }

      return centerResponse;
    },
    {
      onSuccess: () => {
        // Clear persisted draft and reset local state for future creations
        try {
          sessionStorage.removeItem('create-diving-center-form');
        } catch {}
        resetCreateForm();

        // Invalidate both admin and regular diving centers queries
        queryClient.invalidateQueries(['admin-diving-centers']);
        queryClient.invalidateQueries(['diving-centers']);
        toast.success('Diving center created successfully!');

        // Navigate based on user role
        if (user?.is_admin) {
          navigate('/admin/diving-centers');
        } else {
          navigate('/diving-centers');
        }
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  const handleOrganizationChange = e => {
    const { name, value, type, checked } = e.target;
    setNewOrganization(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addOrganization = () => {
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
      selectedOrganizations.some(
        so => so.diving_organization_id == newOrganization.diving_organization_id
      )
    ) {
      toast.error('This organization is already added');
      return;
    }

    // If this is marked as primary, unmark others
    if (newOrganization.is_primary) {
      setSelectedOrganizations(prev => prev.map(org => ({ ...org, is_primary: false })));
    }

    setSelectedOrganizations(prev => [
      ...prev,
      {
        ...newOrganization,
        organization_name: org.name,
        organization_acronym: org.acronym,
      },
    ]);

    setNewOrganization({
      diving_organization_id: '',
      is_primary: false,
    });
  };

  const removeOrganization = index => {
    setSelectedOrganizations(prev => prev.filter((_, i) => i !== index));
  };

  const togglePrimary = index => {
    setSelectedOrganizations(prev =>
      prev.map((org, i) => ({
        ...org,
        is_primary: i === index,
      }))
    );
  };

  const handleCancel = () => {
    // Always send users back to the public listing
    navigate('/diving-centers');
  };

  return (
    <div className='max-w-4xl mx-auto p-6'>
      {/* Back navigation is provided by DivingCenterForm; remove duplicate here */}

      <div className='bg-white rounded-lg shadow-md p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>Create New Diving Center</h1>
        </div>

        <DivingCenterForm
          mode='create'
          initialValues={{}}
          externalFormData={createFormData}
          onExternalChange={setCreateFormData}
          onCancel={handleCancel}
          onSubmit={values => {
            createDivingCenterMutation.mutate(values);
          }}
        />

        {/* Diving Organizations */}
        <div className='border-t pt-6'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>Diving Organizations</h3>

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
                  onClick={addOrganization}
                  className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Organization
                </button>
              </div>
            </div>
          </div>

          {/* Selected Organizations */}
          {selectedOrganizations.length > 0 && (
            <div className='space-y-2'>
              <h4 className='text-sm font-medium text-gray-700'>Selected Organizations:</h4>
              {selectedOrganizations.map((org, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg'
                >
                  <div className='flex items-center space-x-3'>
                    <span className='font-medium'>
                      {org.organization_acronym} - {org.organization_name}
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
                      onClick={() => togglePrimary(index)}
                      className={`px-2 py-1 text-xs rounded ${
                        org.is_primary
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {org.is_primary ? 'Primary' : 'Set Primary'}
                    </button>
                    <button
                      type='button'
                      onClick={() => removeOrganization(index)}
                      className='p-1 text-red-500 hover:text-red-700'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateDivingCenter;
