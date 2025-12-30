import { Trash2, Edit, Plus, Search, Loader, Save, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const AdminDivingOrganizationCertifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { identifier } = useParams();
  const navigate = useNavigate();

  // Set page title
  usePageTitle('Divemap - Admin - Organization Certifications');

  // Certification management state
  const [showCreateCertModal, setShowCreateCertModal] = useState(false);
  const [showEditCertModal, setShowEditCertModal] = useState(false);
  const [editingCert, setEditingCert] = useState(null);
  const [certForm, setCertForm] = useState({
    name: '',
    category: '',
    max_depth: '',
    gases: '',
    tanks: '',
    deco_time_limit: '',
    prerequisites: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch organization data to verify it exists and get ID/Details
  const { data: organization, isLoading: isOrgLoading } = useQuery(
    ['admin-diving-organization', identifier],
    () => api.get(`/api/v1/diving-organizations/${identifier}`),
    {
      select: response => response.data,
      onError: () => {
        toast.error('Organization not found');
        navigate('/admin/diving-organizations');
      },
    }
  );

  // Fetch certifications data
  const { data: certifications, isLoading: isCertsLoading } = useQuery(
    ['admin-organization-certifications', identifier],
    () => api.get(`/api/v1/diving-organizations/${identifier}/levels`),
    {
      select: response => response.data,
      enabled: !!organization,
    }
  );

  // Certification mutations
  const createCertMutation = useMutation(
    certData =>
      api.post(`/api/v1/diving-organizations/${identifier}/levels`, {
        ...certData,
        diving_organization_id: organization?.id,
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-organization-certifications', identifier]);
        toast.success('Certification created successfully!');
        setShowCreateCertModal(false);
        resetCertForm();
      },
      onError: _error => {
        toast.error('Failed to create certification');
      },
    }
  );

  const updateCertMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/diving-organizations/${identifier}/levels/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-organization-certifications', identifier]);
        toast.success('Certification updated successfully!');
        setShowEditCertModal(false);
        setEditingCert(null);
        resetCertForm();
      },
      onError: _error => {
        toast.error('Failed to update certification');
      },
    }
  );

  const deleteCertMutation = useMutation(
    id => api.delete(`/api/v1/diving-organizations/${identifier}/levels/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-organization-certifications', identifier]);
        toast.success('Certification deleted successfully!');
      },
      onError: _error => {
        toast.error('Failed to delete certification');
      },
    }
  );

  // Form handlers
  const handleCreateCert = () => {
    createCertMutation.mutate(certForm);
  };

  const handleEditCert = cert => {
    setEditingCert(cert);
    setCertForm({
      name: cert.name,
      category: cert.category || '',
      max_depth: cert.max_depth || '',
      gases: cert.gases || '',
      tanks: cert.tanks || '',
      deco_time_limit: cert.deco_time_limit || '',
      prerequisites: cert.prerequisites || '',
    });
    setShowEditCertModal(true);
  };

  const handleUpdateCert = () => {
    updateCertMutation.mutate({ id: editingCert.id, data: certForm });
  };

  const handleDeleteCert = cert => {
    if (window.confirm(`Are you sure you want to delete certification "${cert.name}"?`)) {
      deleteCertMutation.mutate(cert.id);
    }
  };

  const resetCertForm = () => {
    setCertForm({
      name: '',
      category: '',
      max_depth: '',
      gases: '',
      tanks: '',
      deco_time_limit: '',
      prerequisites: '',
    });
  };

  // Filter certifications based on search term
  const filteredCertifications =
    certifications?.filter(
      cert =>
        cert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cert.category && cert.category.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (isOrgLoading) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <Loader className='h-8 w-8 animate-spin text-blue-600' />
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <div className='mb-8'>
        <button
          onClick={() => navigate('/admin/diving-organizations')}
          className='flex items-center text-gray-600 hover:text-gray-900 mb-4'
        >
          <ArrowLeft className='h-4 w-4 mr-1' />
          Back to Organizations
        </button>
        <div className='flex items-center gap-6'>
          {organization?.logo_url && (
            <div className='flex-shrink-0 h-16 w-32 flex items-center justify-center bg-white rounded-md border border-gray-200 overflow-hidden p-2 shadow-sm'>
              <img
                src={organization.logo_url}
                alt={organization.name}
                className='max-h-full max-w-full object-contain'
              />
            </div>
          )}
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>
              {organization?.name} Certifications
            </h1>
            <p className='text-gray-600 mt-2'>
              Manage certification levels for {organization?.name} ({organization?.acronym})
            </p>
          </div>
        </div>
      </div>

      {/* Search and Actions Bar */}
      <div className='flex flex-col sm:flex-row gap-4 mb-6'>
        <div className='flex-1 relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <input
            type='text'
            placeholder='Search certifications...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => setShowCreateCertModal(true)}
            className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            <Plus className='h-4 w-4' />
            Add Certification
          </button>
        </div>
      </div>

      {/* Certifications Table */}
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Name
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Category
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Max Depth
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Gases
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Tanks
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Deco Limit
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Prerequisites
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {isCertsLoading ? (
                <tr>
                  <td colSpan='7' className='px-6 py-4 text-center'>
                    <Loader className='h-6 w-6 animate-spin mx-auto text-gray-400' />
                  </td>
                </tr>
              ) : filteredCertifications.length === 0 ? (
                <tr>
                  <td colSpan='7' className='px-6 py-4 text-center text-gray-500'>
                    No certifications found
                  </td>
                </tr>
              ) : (
                filteredCertifications.map(cert => (
                  <tr key={cert.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm font-medium text-gray-900'>{cert.name}</div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {cert.category || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {cert.max_depth || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {cert.gases || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {cert.tanks || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                      {cert.deco_time_limit || '-'}
                    </td>
                    <td
                      className='px-6 py-4 text-sm text-gray-900 max-w-xs truncate'
                      title={cert.prerequisites}
                    >
                      {cert.prerequisites || '-'}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={() => handleEditCert(cert)}
                          className='text-blue-600 hover:text-blue-900 p-1 rounded'
                        >
                          <Edit className='h-4 w-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteCert(cert)}
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

      {/* Create Certification Modal */}
      <Modal
        isOpen={showCreateCertModal}
        onClose={() => {
          setShowCreateCertModal(false);
          resetCertForm();
        }}
        title='Create New Certification'
        className='max-w-2xl max-h-[90vh] overflow-y-auto'
      >
        <div className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label htmlFor='cert-name' className='block text-sm font-medium text-gray-700 mb-1'>
                Name *
              </label>
              <input
                id='cert-name'
                type='text'
                value={certForm.name}
                onChange={e => setCertForm({ ...certForm, name: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Open Water Diver'
              />
            </div>
            <div>
              <label
                htmlFor='cert-category'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Category
              </label>
              <input
                id='cert-category'
                type='text'
                value={certForm.category}
                onChange={e => setCertForm({ ...certForm, category: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Recreational, Technical, etc.'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='cert-max-depth'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Max Depth
              </label>
              <input
                id='cert-max-depth'
                type='text'
                value={certForm.max_depth}
                onChange={e => setCertForm({ ...certForm, max_depth: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='18m (60ft)'
              />
            </div>
            <div>
              <label htmlFor='cert-gases' className='block text-sm font-medium text-gray-700 mb-1'>
                Gases
              </label>
              <input
                id='cert-gases'
                type='text'
                value={certForm.gases}
                onChange={e => setCertForm({ ...certForm, gases: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Air, Nitrox, Trimix'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label htmlFor='cert-tanks' className='block text-sm font-medium text-gray-700 mb-1'>
                Tanks
              </label>
              <input
                id='cert-tanks'
                type='text'
                value={certForm.tanks}
                onChange={e => setCertForm({ ...certForm, tanks: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Single, Double, Sidemount'
              />
            </div>
            <div>
              <label
                htmlFor='cert-deco-time-limit'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Deco Time Limit
              </label>
              <input
                id='cert-deco-time-limit'
                type='text'
                value={certForm.deco_time_limit}
                onChange={e => setCertForm({ ...certForm, deco_time_limit: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='15 minutes, Unlimited'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='cert-prerequisites'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Prerequisites
            </label>
            <textarea
              id='cert-prerequisites'
              value={certForm.prerequisites}
              onChange={e => setCertForm({ ...certForm, prerequisites: e.target.value })}
              rows='3'
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
              placeholder='Prerequisites for this certification...'
            />
          </div>
        </div>

        <div className='flex justify-end gap-3 mt-6'>
          <button
            onClick={() => {
              setShowCreateCertModal(false);
              resetCertForm();
            }}
            className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
          >
            Cancel
          </button>
          <button
            onClick={handleCreateCert}
            disabled={!certForm.name || createCertMutation.isLoading}
            className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
          >
            {createCertMutation.isLoading ? (
              <Loader className='h-4 w-4 animate-spin' />
            ) : (
              <Save className='h-4 w-4' />
            )}
            Create Certification
          </button>
        </div>
      </Modal>

      {/* Edit Certification Modal */}
      <Modal
        isOpen={showEditCertModal && !!editingCert}
        onClose={() => setShowEditCertModal(false)}
        title='Edit Certification'
        className='max-w-2xl max-h-[90vh] overflow-y-auto'
      >
        <div className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='edit-cert-name'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Name *
              </label>
              <input
                id='edit-cert-name'
                type='text'
                value={certForm.name}
                onChange={e => setCertForm({ ...certForm, name: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Open Water Diver'
              />
            </div>
            <div>
              <label
                htmlFor='edit-cert-category'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Category
              </label>
              <input
                id='edit-cert-category'
                type='text'
                value={certForm.category}
                onChange={e => setCertForm({ ...certForm, category: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Recreational, Technical, etc.'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='edit-cert-max-depth'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Max Depth
              </label>
              <input
                id='edit-cert-max-depth'
                type='text'
                value={certForm.max_depth}
                onChange={e => setCertForm({ ...certForm, max_depth: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='18m (60ft)'
              />
            </div>
            <div>
              <label
                htmlFor='edit-cert-gases'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Gases
              </label>
              <input
                id='edit-cert-gases'
                type='text'
                value={certForm.gases}
                onChange={e => setCertForm({ ...certForm, gases: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Air, Nitrox, Trimix'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='edit-cert-tanks'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Tanks
              </label>
              <input
                id='edit-cert-tanks'
                type='text'
                value={certForm.tanks}
                onChange={e => setCertForm({ ...certForm, tanks: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='Single, Double, Sidemount'
              />
            </div>
            <div>
              <label
                htmlFor='edit-cert-deco-time-limit'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Deco Time Limit
              </label>
              <input
                id='edit-cert-deco-time-limit'
                type='text'
                value={certForm.deco_time_limit}
                onChange={e => setCertForm({ ...certForm, deco_time_limit: e.target.value })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
                placeholder='15 minutes, Unlimited'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='edit-cert-prerequisites'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Prerequisites
            </label>
            <textarea
              id='edit-cert-prerequisites'
              value={certForm.prerequisites}
              onChange={e => setCertForm({ ...certForm, prerequisites: e.target.value })}
              rows='3'
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
              placeholder='Prerequisites for this certification...'
            />
          </div>
        </div>

        <div className='flex justify-end gap-3 mt-6'>
          <button
            onClick={() => {
              setShowEditCertModal(false);
              resetCertForm();
            }}
            className='px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300'
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateCert}
            disabled={!certForm.name || updateCertMutation.isLoading}
            className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
          >
            {updateCertMutation.isLoading ? (
              <Loader className='h-4 w-4 animate-spin' />
            ) : (
              <Save className='h-4 w-4' />
            )}
            Update Certification
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDivingOrganizationCertifications;
