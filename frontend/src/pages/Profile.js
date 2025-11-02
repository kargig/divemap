import {
  User,
  Mail,
  Calendar,
  Shield,
  Award,
  Activity,
  Lock,
  Plus,
  Edit,
  Trash2,
  X,
  Anchor,
  Building2,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api, { getDivingCenters } from '../api';
import MaskedEmail from '../components/MaskedEmail';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const Profile = () => {
  // Set page title
  usePageTitle('Divemap - Profile');
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingCertification, setIsAddingCertification] = useState(false);
  const [editingCertification, setEditingCertification] = useState(null);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    name: user?.name || '',
    email: user?.email || '',
    number_of_dives: user?.number_of_dives || 0,
  });
  const [certificationForm, setCertificationForm] = useState({
    diving_organization_id: '',
    certification_level: '',
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Fetch certifications and organizations using react-query
  const { data: certifications = [], refetch: refetchCertifications } = useQuery(
    ['user-certifications'],
    () => api.get('/api/v1/user-certifications/my-certifications').then(res => res.data),
    {
      enabled: !!user,
    }
  );

  const { data: organizations = [] } = useQuery(
    ['diving-organizations'],
    () => api.get('/api/v1/diving-organizations/').then(res => res.data),
    {
      enabled: !!user,
    }
  );

  // Fetch user's owned diving centers (only approved owners)
  const { data: ownedDivingCenters = [] } = useQuery(
    ['user-owned-diving-centers', user?.id, user?.username],
    async () => {
      if (!user) return [];
      // Fetch all diving centers and filter by approved owner
      const centers = await getDivingCenters({ page_size: 1000 });
      // Filter centers where the user is an approved owner
      // Check both owner_id and owner_username for matching
      return centers.filter(
        center =>
          center.ownership_status === 'approved' &&
          ((center.owner_id && parseInt(center.owner_id) === parseInt(user.id)) ||
            (center.owner_username && center.owner_username === user.username))
      );
    },
    {
      enabled: !!user,
      refetchInterval: 30000,
    }
  );

  // Fetch user statistics
  const { data: userStats } = useQuery(
    ['user-stats'],
    async () => {
      const [divesResponse, diveSitesResponse] = await Promise.all([
        api.get('/api/v1/dives/count?my_dives=true'),
        api.get('/api/v1/dive-sites/count?my_dive_sites=true'),
      ]);
      return {
        divesCreated: divesResponse.data.total,
        diveSitesCreated: diveSitesResponse.data.total,
      };
    },
    {
      enabled: !!user,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'number_of_dives' ? parseInt(value) || 0 : value,
    });
  };

  const handleCertificationChange = e => {
    const { name, value } = e.target;
    setCertificationForm({
      ...certificationForm,
      [name]: value,
    });
  };

  const handlePasswordChange = e => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const response = await api.put('/api/v1/users/me', formData);
      updateUser(response.data);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handleAddCertification = async e => {
    e.preventDefault();
    try {
      await api.post('/api/v1/user-certifications/my-certifications', certificationForm);
      toast.success('Certification added successfully!');
      setIsAddingCertification(false);
      setCertificationForm({
        diving_organization_id: '',
        certification_level: '',
      });
      refetchCertifications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add certification');
    }
  };

  const handleUpdateCertification = async e => {
    e.preventDefault();
    try {
      await api.put(
        `/api/v1/user-certifications/my-certifications/${editingCertification.id}`,
        certificationForm
      );
      toast.success('Certification updated successfully!');
      setEditingCertification(null);
      setCertificationForm({
        diving_organization_id: '',
        certification_level: '',
      });
      refetchCertifications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update certification');
    }
  };

  const handleDeleteCertification = async certificationId => {
    if (!window.confirm('Are you sure you want to delete this certification?')) {
      return;
    }
    try {
      await api.delete(`/api/v1/user-certifications/my-certifications/${certificationId}`);
      toast.success('Certification deleted successfully!');
      refetchCertifications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete certification');
    }
  };

  const handleToggleCertification = async certificationId => {
    try {
      await api.patch(`/api/v1/user-certifications/my-certifications/${certificationId}/toggle`);
      toast.success('Certification status updated!');
      refetchCertifications();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update certification status');
    }
  };

  const startEditCertification = certification => {
    setEditingCertification(certification);
    setCertificationForm({
      diving_organization_id: certification.diving_organization.id,
      certification_level: certification.certification_level || '',
    });
  };

  const cancelCertificationEdit = () => {
    setEditingCertification(null);
    setCertificationForm({
      diving_organization_id: '',
      certification_level: '',
    });
  };

  const handlePasswordSubmit = async e => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }

    try {
      await api.post('/api/v1/users/me/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      toast.success('Password changed successfully!');
      setIsChangingPassword(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  if (!user) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-600'>Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Profile</h1>
        <p className='text-gray-600'>Manage your account settings and diving information</p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Profile Information */}
        <div className='lg:col-span-2'>
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-gray-900'>Account Information</h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className='px-4 py-2 text-blue-600 hover:text-blue-700 font-medium'
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div>
                  <label
                    htmlFor='username'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Username
                  </label>
                  <input
                    id='username'
                    type='text'
                    name='username'
                    value={formData.username}
                    onChange={handleChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div>
                  <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-2'>
                    Full Name
                  </label>
                  <input
                    id='name'
                    type='text'
                    name='name'
                    value={formData.name}
                    onChange={handleChange}
                    placeholder='Enter your full name'
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div>
                  <label htmlFor='email' className='block text-sm font-medium text-gray-700 mb-2'>
                    Email
                  </label>
                  <input
                    id='email'
                    type='email'
                    name='email'
                    value={formData.email}
                    onChange={handleChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Number of Dives
                  </label>
                  <input
                    type='number'
                    name='number_of_dives'
                    value={formData.number_of_dives}
                    onChange={handleChange}
                    min='0'
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div className='flex justify-end space-x-3'>
                  <button
                    type='button'
                    onClick={() => setIsEditing(false)}
                    className='px-4 py-2 text-gray-600 hover:text-gray-700'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className='space-y-4'>
                <div className='flex items-center'>
                  <User className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Username</span>
                    <p className='text-gray-900'>{user.username}</p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <User className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Full Name</span>
                    <p className='text-gray-900'>{user.name || 'Not set'}</p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <Mail className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Email</span>
                    <p className='text-gray-900'>
                      <MaskedEmail email={user.email} />
                    </p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <Activity className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Number of Dives</span>
                    <p className='text-gray-900'>{user.number_of_dives || 0}</p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <Anchor className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Dives Created</span>
                    <div className='mt-1'>
                      <Link
                        to='/dives'
                        className='text-blue-600 hover:text-blue-800 font-medium text-lg'
                      >
                        {userStats?.divesCreated || 0}
                      </Link>
                    </div>
                  </div>
                </div>

                <div className='flex items-center'>
                  <Anchor className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Dive Sites Created</span>
                    <div className='mt-1'>
                      <Link
                        to='/dive-sites?my_dive_sites=true'
                        className='text-blue-600 hover:text-blue-800 font-medium text-lg'
                      >
                        {userStats?.diveSitesCreated || 0}
                      </Link>
                    </div>
                  </div>
                </div>

                {ownedDivingCenters && ownedDivingCenters.length > 0 && (
                  <div className='flex items-start'>
                    <Building2 className='h-5 w-5 text-gray-400 mr-3 mt-1' />
                    <div className='flex-1'>
                      <span className='text-sm text-gray-500'>Owned Diving Centers</span>
                      <div className='mt-1 space-y-1'>
                        {ownedDivingCenters.map(center => (
                          <Link
                            key={center.id}
                            to={`/diving-centers/${center.id}`}
                            className='block text-blue-600 hover:text-blue-800 font-medium text-sm'
                          >
                            {center.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className='flex items-center'>
                  <Calendar className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Member Since</span>
                    <p className='text-gray-900'>
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <Shield className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Role</span>
                    <p className='text-gray-900'>
                      {user.is_admin ? 'Administrator' : user.is_moderator ? 'Moderator' : 'User'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Certifications Section */}
          <div className='bg-white p-6 rounded-lg shadow-md mt-6'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-gray-900'>Diving Certifications</h2>
              <button
                onClick={() => setIsAddingCertification(!isAddingCertification)}
                className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Certification
              </button>
            </div>

            {isAddingCertification && (
              <form
                onSubmit={handleAddCertification}
                className='mb-6 p-4 border border-gray-200 rounded-lg'
              >
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Diving Organization
                    </label>
                    <select
                      name='diving_organization_id'
                      value={certificationForm.diving_organization_id}
                      onChange={handleCertificationChange}
                      required
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                    >
                      <option value=''>Select Organization</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.acronym} - {org.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Certification Level
                    </label>
                    <input
                      type='text'
                      name='certification_level'
                      value={certificationForm.certification_level}
                      onChange={handleCertificationChange}
                      required
                      placeholder='e.g., Open Water Diver, Advanced, Divemaster'
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>
                </div>

                <div className='flex justify-end space-x-3 mt-4'>
                  <button
                    type='button'
                    onClick={() => setIsAddingCertification(false)}
                    className='px-4 py-2 text-gray-600 hover:text-gray-700'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                  >
                    Add Certification
                  </button>
                </div>
              </form>
            )}

            {editingCertification && (
              <form
                onSubmit={handleUpdateCertification}
                className='mb-6 p-4 border border-gray-200 rounded-lg'
              >
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-lg font-medium'>Edit Certification</h3>
                  <button
                    type='button'
                    onClick={cancelCertificationEdit}
                    className='text-gray-500 hover:text-gray-700'
                  >
                    <X className='h-5 w-5' />
                  </button>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Diving Organization
                    </label>
                    <select
                      name='diving_organization_id'
                      value={certificationForm.diving_organization_id}
                      onChange={handleCertificationChange}
                      required
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                    >
                      <option value=''>Select Organization</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.acronym} - {org.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Certification Level
                    </label>
                    <input
                      type='text'
                      name='certification_level'
                      value={certificationForm.certification_level}
                      onChange={handleCertificationChange}
                      required
                      placeholder='e.g., Open Water Diver, Advanced, Divemaster'
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                    />
                  </div>
                </div>

                <div className='flex justify-end space-x-3 mt-4'>
                  <button
                    type='button'
                    onClick={cancelCertificationEdit}
                    className='px-4 py-2 text-gray-600 hover:text-gray-700'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                  >
                    Update Certification
                  </button>
                </div>
              </form>
            )}

            {certifications.length === 0 ? (
              <div className='text-center py-8'>
                <Award className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                <p className='text-gray-500'>No certifications added yet.</p>
                <p className='text-sm text-gray-400'>
                  Add your first diving certification to get started.
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {certifications.map(cert => (
                  <div
                    key={cert.id}
                    className={`p-4 border rounded-lg ${
                      cert.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center space-x-2 mb-2'>
                          <span className='font-medium text-gray-900'>
                            {cert.diving_organization.acronym} - {cert.certification_level}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              cert.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {cert.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className='text-sm text-gray-600 space-y-1'>
                          <p>Organization: {cert.diving_organization.name}</p>
                        </div>
                      </div>

                      <div className='flex items-center space-x-2 ml-4'>
                        <button
                          onClick={() => handleToggleCertification(cert.id)}
                          className={`px-2 py-1 text-xs rounded ${
                            cert.is_active
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {cert.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => startEditCertification(cert)}
                          className='p-1 text-gray-500 hover:text-blue-600'
                        >
                          <Edit className='h-4 w-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteCertification(cert.id)}
                          className='p-1 text-gray-500 hover:text-red-600'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Password Change Section */}
          <div className='bg-white p-6 rounded-lg shadow-md mt-6'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-gray-900'>Change Password</h2>
              <button
                onClick={() => setIsChangingPassword(!isChangingPassword)}
                className='px-4 py-2 text-blue-600 hover:text-blue-700 font-medium'
              >
                {isChangingPassword ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            {isChangingPassword ? (
              <form onSubmit={handlePasswordSubmit} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Current Password
                  </label>
                  <input
                    type='password'
                    name='current_password'
                    value={passwordData.current_password}
                    onChange={handlePasswordChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    New Password
                  </label>
                  <input
                    type='password'
                    name='new_password'
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    required
                    minLength='8'
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Confirm New Password
                  </label>
                  <input
                    type='password'
                    name='confirm_password'
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div className='flex justify-end space-x-3'>
                  <button
                    type='button'
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordData({
                        current_password: '',
                        new_password: '',
                        confirm_password: '',
                      });
                    }}
                    className='px-4 py-2 text-gray-600 hover:text-gray-700'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                  >
                    Change Password
                  </button>
                </div>
              </form>
            ) : (
              <div className='flex items-center'>
                <Lock className='h-5 w-5 text-gray-400 mr-3' />
                <div>
                  <span className='text-sm text-gray-500'>Password</span>
                  <p className='text-gray-900'>••••••••</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Account Stats */}
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Account Stats</h3>
            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <span className='text-gray-600'>Dives Created</span>
                <Link to='/dives' className='font-medium text-blue-600 hover:text-blue-800'>
                  {userStats?.divesCreated || 0}
                </Link>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-600'>Dive Sites Created</span>
                <Link
                  to='/dive-sites?my_dive_sites=true'
                  className='font-medium text-blue-600 hover:text-blue-800'
                >
                  {userStats?.diveSitesCreated || 0}
                </Link>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Sites Rated</span>
                <span className='font-medium'>0</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Comments Posted</span>
                <span className='font-medium'>0</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Certifications</span>
                <span className='font-medium'>
                  {certifications.filter(c => c.is_active).length}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Member Since</span>
                <span className='font-medium'>
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Quick Actions</h3>
            <div className='space-y-3'>
              <button
                onClick={() => setIsChangingPassword(true)}
                className='w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
              >
                Change Password
              </button>
              <button
                onClick={() => setIsAddingCertification(true)}
                className='w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
              >
                Add Certification
              </button>
              <button className='w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'>
                Notification Settings
              </button>
              <button className='w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors'>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
