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
  Building2,
  Link as LinkIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from 'react-query';
import { Link } from 'react-router-dom';

import api, { getDivingCenters, getUserPublicProfile } from '../api';
import { FormField } from '../components/forms/FormField';
import MaskedEmail from '../components/MaskedEmail';
import OrganizationLogo from '../components/OrganizationLogo';
import { getSocialMediaIcon } from '../components/SocialMediaIcons';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  profileSchema,
  certificationSchema,
  changePasswordSchema,
  socialLinkSchema,
  createResolver,
  getErrorMessage,
} from '../utils/formHelpers';

const Profile = () => {
  // Set page title
  usePageTitle('Divemap - Profile');
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingCertification, setIsAddingCertification] = useState(false);
  const [editingCertification, setEditingCertification] = useState(null);
  const [availableLevels, setAvailableLevels] = useState([]);
  const [isAddingSocialLink, setIsAddingSocialLink] = useState(false);

  // Profile Form
  const profileMethods = useForm({
    resolver: createResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      username: user?.username || '',
      name: user?.name || '',
      email: user?.email || '',
      number_of_dives: user?.number_of_dives || 0,
      buddy_visibility: user?.buddy_visibility || 'public',
    },
  });

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = profileMethods;

  // Sync profile form when user data loads/changes
  useEffect(() => {
    if (user) {
      resetProfile({
        username: user.username || '',
        name: user.name || '',
        email: user.email || '',
        number_of_dives: user.number_of_dives || 0,
        buddy_visibility: user.buddy_visibility || 'public',
      });
    }
  }, [user, resetProfile]);

  // Social Link Form
  const socialLinkMethods = useForm({
    resolver: createResolver(socialLinkSchema),
    mode: 'onChange',
    defaultValues: {
      platform: '',
      url: '',
    },
  });

  const {
    register: registerSocialLink,
    handleSubmit: handleSubmitSocialLink,
    reset: resetSocialLink,
    formState: { errors: socialLinkErrors },
  } = socialLinkMethods;

  // Certification Form
  const certMethods = useForm({
    resolver: createResolver(certificationSchema),
    mode: 'onChange',
  });

  const {
    register: registerCert,
    handleSubmit: handleSubmitCert,
    formState: { errors: certErrors },
    reset: resetCert,
    setValue: setValueCert,
    watch: watchCert,
  } = certMethods;

  const selectedOrgId = watchCert('diving_organization_id');

  useEffect(() => {
    if (selectedOrgId) {
      api
        .get(`/api/v1/diving-organizations/${selectedOrgId}/levels`)
        .then(res => setAvailableLevels(res.data))
        .catch(err => {
          console.error('Failed to fetch levels', err);
          setAvailableLevels([]);
        });
    } else {
      setAvailableLevels([]);
    }
  }, [selectedOrgId]);

  // Password Form
  const passwordMethods = useForm({
    resolver: createResolver(changePasswordSchema),
    mode: 'onChange',
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = passwordMethods;

  // Mutations
  const updateProfileMutation = useMutation(data => api.put('/api/v1/users/me', data), {
    onSuccess: response => {
      updateUser(response.data);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    },
    onError: error => {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    },
  });

  const addSocialLinkMutation = useMutation(
    data => api.post('/api/v1/users/me/social-links', data),
    {
      onSuccess: response => {
        // Optimistically update local user state or re-fetch user
        const updatedUser = { ...user };
        // Check if updating existing or adding new
        const existingIndex = updatedUser.social_links.findIndex(
          l => l.platform === response.data.platform
        );
        if (existingIndex >= 0) {
          updatedUser.social_links[existingIndex] = response.data;
        } else {
          updatedUser.social_links.push(response.data);
        }
        updateUser(updatedUser);
        toast.success('Social link saved!');
        setIsAddingSocialLink(false);
        resetSocialLink();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to save social link');
      },
    }
  );

  const removeSocialLinkMutation = useMutation(
    platform => api.delete(`/api/v1/users/me/social-links/${platform}`),
    {
      onSuccess: (_, platform) => {
        const updatedUser = { ...user };
        updatedUser.social_links = updatedUser.social_links.filter(l => l.platform !== platform);
        updateUser(updatedUser);
        toast.success('Social link removed!');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to remove social link');
      },
    }
  );

  const addCertMutation = useMutation(
    data => api.post('/api/v1/user-certifications/my-certifications', data),
    {
      onSuccess: () => {
        toast.success('Certification added successfully!');
        setIsAddingCertification(false);
        resetCert();
        refetchCertifications();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to add certification');
      },
    }
  );

  const updateCertMutation = useMutation(
    ({ id, data }) => api.put(`/api/v1/user-certifications/my-certifications/${id}`, data),
    {
      onSuccess: () => {
        toast.success('Certification updated successfully!');
        setEditingCertification(null);
        resetCert();
        refetchCertifications();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to update certification');
      },
    }
  );

  const changePasswordMutation = useMutation(
    data => api.post('/api/v1/users/me/change-password', data),
    {
      onSuccess: () => {
        toast.success('Password changed successfully!');
        setIsChangingPassword(false);
        resetPassword();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to change password');
      },
    }
  );

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
    }
  );

  // Fetch user statistics
  const { data: userStats } = useQuery(
    ['user-stats', user?.username],
    async () => {
      if (!user?.username) return null;
      const profile = await getUserPublicProfile(user.username);
      return profile.stats;
    },
    {
      enabled: !!user?.username,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const onProfileSubmit = data => {
    // Exclude username and email from update data as they cannot be changed
    // eslint-disable-next-line no-unused-vars
    const { username, email, ...rest } = data;
    updateProfileMutation.mutate(rest);
  };

  const onCertSubmit = data => {
    if (editingCertification) {
      updateCertMutation.mutate({ id: editingCertification.id, data });
    } else {
      addCertMutation.mutate(data);
    }
  };

  const onSocialLinkSubmit = data => {
    addSocialLinkMutation.mutate(data);
  };

  const onPasswordSubmit = data => {
    const { current_password, new_password } = data;
    changePasswordMutation.mutate({ current_password, new_password });
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
    setValueCert('diving_organization_id', certification.diving_organization.id);
    // Determine if we have a linked level ID or just text
    if (certification.certification_level_link) {
      setValueCert('certification_level_id', certification.certification_level_link.id);
    } else {
      // Fallback or handle appropriately if we want to allow editing text-only legacy certs
      // ideally we push them to select a new one
      setValueCert('certification_level_id', '');
    }
  };

  const cancelCertificationEdit = () => {
    setEditingCertification(null);
    resetCert();
  };

  const supportedPlatforms = [
    'Instagram',
    'TikTok',
    'Facebook',
    'X',
    'LinkedIn',
    'YouTube',
    'WhatsApp',
    'Telegram',
    'BlueSky',
    'Mastodon',
    'Discord',
    'Threads',
    'Signal',
  ];

  if (!user) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-600'>Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
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
                onClick={() => {
                  if (isEditing) {
                    resetProfile();
                  }
                  setIsEditing(!isEditing);
                }}
                className='px-4 py-2 text-blue-600 hover:text-blue-700 font-medium'
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <FormProvider {...profileMethods}>
                <form onSubmit={handleSubmitProfile(onProfileSubmit)} className='space-y-4'>
                  <div>
                    <FormField name='username' label='Username'>
                      {({ register, name }) => (
                        <>
                          <input
                            id='username'
                            type='text'
                            {...register(name)}
                            disabled
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-100 text-gray-500 cursor-not-allowed ${
                              profileErrors.username ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                          <p className='mt-1 text-xs text-gray-500'>Username cannot be changed</p>
                        </>
                      )}
                    </FormField>
                  </div>

                  <div>
                    <FormField name='name' label='Full Name'>
                      {({ register, name }) => (
                        <input
                          id='name'
                          type='text'
                          {...register(name)}
                          placeholder='Enter your full name'
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                        />
                      )}
                    </FormField>
                  </div>

                  <div>
                    <FormField name='email' label='Email'>
                      {({ register, name }) => (
                        <>
                          <input
                            id='email'
                            type='email'
                            {...register(name)}
                            disabled
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-100 text-gray-500 cursor-not-allowed ${
                              profileErrors.email ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                          <p className='mt-1 text-xs text-gray-500'>Email cannot be changed</p>
                        </>
                      )}
                    </FormField>
                  </div>

                  <div>
                    <FormField name='number_of_dives' label='Number of Dives'>
                      {({ register, name }) => (
                        <input
                          type='number'
                          {...register(name)}
                          min='0'
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            profileErrors.number_of_dives ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                    </FormField>
                  </div>

                  <div>
                    <FormField name='buddy_visibility' label='Buddy Visibility'>
                      {({ register, name }) => (
                        <>
                          <select
                            {...register(name)}
                            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                          >
                            <option value='public'>
                              Public - Others can add me as a dive buddy
                            </option>
                            <option value='private'>Private - Hide me from buddy search</option>
                          </select>
                          <p className='mt-1 text-xs text-gray-500'>
                            Control whether other users can find and add you as a dive buddy
                          </p>
                        </>
                      )}
                    </FormField>
                  </div>

                  <div className='flex justify-end space-x-3'>
                    <button
                      type='button'
                      onClick={() => {
                        resetProfile();
                        setIsEditing(false);
                      }}
                      className='px-4 py-2 text-gray-600 hover:text-gray-700'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={updateProfileMutation.isLoading}
                      className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
                    >
                      {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </FormProvider>
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
                    <p className='text-gray-900 font-medium'>
                      Total:{' '}
                      {(user?.number_of_dives || 0) +
                        (userStats?.dives_created || 0) +
                        (userStats?.buddy_dives_count || 0)}
                    </p>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      [{user?.number_of_dives || 0} (From Profile) + {userStats?.dives_created || 0}{' '}
                      (Created) + {userStats?.buddy_dives_count || 0} (Participated)]
                    </p>
                  </div>
                </div>

                <div className='flex items-center'>
                  <Shield className='h-5 w-5 text-gray-400 mr-3' />
                  <div>
                    <span className='text-sm text-gray-500'>Buddy Visibility</span>
                    <p className='text-gray-900'>
                      {(user.buddy_visibility || 'public') === 'public' ? (
                        <span className='text-green-600 font-medium'>Public</span>
                      ) : (
                        <span className='text-gray-600 font-medium'>Private</span>
                      )}
                    </p>
                    <p className='text-xs text-gray-500 mt-1'>
                      {(user.buddy_visibility || 'public') === 'public'
                        ? 'Others can add you as a dive buddy'
                        : 'You are hidden from buddy search'}
                    </p>
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

          {/* Social Media Links Section */}
          <div className='bg-white p-6 rounded-lg shadow-md mt-6'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-gray-900'>Social Media Links</h2>
              <button
                onClick={() => {
                  if (isAddingSocialLink) {
                    resetSocialLink();
                  }
                  setIsAddingSocialLink(!isAddingSocialLink);
                }}
                className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Link
              </button>
            </div>

            {isAddingSocialLink && (
              <FormProvider {...socialLinkMethods}>
                <form
                  onSubmit={handleSubmitSocialLink(onSocialLinkSubmit)}
                  className='mb-6 p-4 border border-gray-200 rounded-lg'
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <FormField name='platform' label='Platform'>
                        {({ register, name }) => (
                          <select
                            {...register(name)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              socialLinkErrors.platform ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value=''>Select Platform</option>
                            {supportedPlatforms.map(p => (
                              <option key={p} value={p.toLowerCase()}>
                                {p}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    </div>

                    <div>
                      <FormField name='url' label='Profile URL'>
                        {({ register, name }) => (
                          <input
                            type='url'
                            {...register(name)}
                            placeholder='https://...'
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              socialLinkErrors.url ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                        )}
                      </FormField>
                    </div>
                  </div>

                  <div className='flex justify-end space-x-3 mt-4'>
                    <button
                      type='button'
                      onClick={() => {
                        setIsAddingSocialLink(false);
                        resetSocialLink();
                      }}
                      className='px-4 py-2 text-gray-600 hover:text-gray-700'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={addSocialLinkMutation.isLoading}
                      className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
                    >
                      {addSocialLinkMutation.isLoading ? 'Saving...' : 'Save Link'}
                    </button>
                  </div>
                </form>
              </FormProvider>
            )}

            {!user.social_links || user.social_links.length === 0 ? (
              <div className='text-center py-8'>
                <LinkIcon className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                <p className='text-gray-500'>No social media links added yet.</p>
                <p className='text-sm text-gray-400'>
                  Add links to your social profiles so others can connect with you.
                </p>
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {user.social_links.map(link => (
                  <div
                    key={link.platform}
                    className='flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50'
                  >
                    <a
                      href={link.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center space-x-3 flex-1 min-w-0'
                    >
                      <div className='bg-gray-100 p-2 rounded-full'>
                        {getSocialMediaIcon(link.platform, {
                          color: '000000',
                          className: 'w-5 h-5',
                        })}
                      </div>
                      <div className='truncate'>
                        <span className='font-medium text-gray-900 capitalize block'>
                          {link.platform}
                        </span>
                        <span className='text-xs text-gray-500 truncate block'>{link.url}</span>
                      </div>
                    </a>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to remove your ${link.platform} link?`
                          )
                        ) {
                          removeSocialLinkMutation.mutate(link.platform);
                        }
                      }}
                      className='ml-2 p-1 text-gray-400 hover:text-red-600'
                      title='Remove link'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Certifications Section */}
          <div className='bg-white p-6 rounded-lg shadow-md mt-6'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold text-gray-900'>Diving Certifications</h2>
              <button
                onClick={() => {
                  if (isAddingCertification) {
                    resetCert();
                  }
                  setIsAddingCertification(!isAddingCertification);
                }}
                className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
              >
                <Plus className='h-4 w-4 mr-2' />
                Add Certification
              </button>
            </div>

            {isAddingCertification && (
              <FormProvider {...certMethods}>
                <form
                  onSubmit={handleSubmitCert(onCertSubmit)}
                  className='mb-6 p-4 border border-gray-200 rounded-lg'
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <FormField name='diving_organization_id' label='Diving Organization'>
                        {({ register, name }) => (
                          <select
                            {...register(name)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              certErrors.diving_organization_id
                                ? 'border-red-500'
                                : 'border-gray-300'
                            }`}
                          >
                            <option value=''>Select Organization</option>
                            {organizations.map(org => (
                              <option key={org.id} value={org.id}>
                                {org.acronym} - {org.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    </div>

                    <div>
                      <FormField name='certification_level_id' label='Certification Level'>
                        {({ register, name }) => {
                          // Group levels by category
                          const groupedLevels = availableLevels.reduce((acc, level) => {
                            const category = level.category || 'General';
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(level);
                            return acc;
                          }, {});

                          return (
                            <select
                              {...register(name)}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                certErrors.certification_level_id
                                  ? 'border-red-500'
                                  : 'border-gray-300'
                              }`}
                              disabled={!selectedOrgId}
                            >
                              <option value=''>Select Level</option>
                              {Object.entries(groupedLevels).map(([category, levels]) => (
                                <optgroup key={category} label={category}>
                                  {levels.map(level => (
                                    <option key={level.id} value={level.id}>
                                      {level.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          );
                        }}
                      </FormField>
                    </div>
                  </div>

                  <div className='flex justify-end space-x-3 mt-4'>
                    <button
                      type='button'
                      onClick={() => {
                        setIsAddingCertification(false);
                        resetCert();
                      }}
                      className='px-4 py-2 text-gray-600 hover:text-gray-700'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={addCertMutation.isLoading}
                      className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
                    >
                      {addCertMutation.isLoading ? 'Adding...' : 'Add Certification'}
                    </button>
                  </div>
                </form>
              </FormProvider>
            )}

            {editingCertification && (
              <FormProvider {...certMethods}>
                <form
                  onSubmit={handleSubmitCert(onCertSubmit)}
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
                      <FormField name='diving_organization_id' label='Diving Organization'>
                        {({ register, name }) => (
                          <select
                            {...register(name)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                              certErrors.diving_organization_id
                                ? 'border-red-500'
                                : 'border-gray-300'
                            }`}
                          >
                            <option value=''>Select Organization</option>
                            {organizations.map(org => (
                              <option key={org.id} value={org.id}>
                                {org.acronym} - {org.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    </div>

                    <div>
                      <FormField name='certification_level_id' label='Certification Level'>
                        {({ register, name }) => {
                          // Group levels by category
                          const groupedLevels = availableLevels.reduce((acc, level) => {
                            const category = level.category || 'General';
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(level);
                            return acc;
                          }, {});

                          return (
                            <select
                              {...register(name)}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                certErrors.certification_level_id
                                  ? 'border-red-500'
                                  : 'border-gray-300'
                              }`}
                              disabled={!selectedOrgId}
                            >
                              <option value=''>Select Level</option>
                              {Object.entries(groupedLevels).map(([category, levels]) => (
                                <optgroup key={category} label={category}>
                                  {levels.map(level => (
                                    <option key={level.id} value={level.id}>
                                      {level.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          );
                        }}
                      </FormField>
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
                      disabled={updateCertMutation.isLoading}
                      className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
                    >
                      {updateCertMutation.isLoading ? 'Updating...' : 'Update Certification'}
                    </button>
                  </div>
                </form>
              </FormProvider>
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
                      <div className='flex items-start gap-3'>
                        <OrganizationLogo org={cert.diving_organization} />
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
                            {cert.certification_level_link && (
                              <div className='mt-1 flex flex-wrap gap-2 text-xs'>
                                {cert.certification_level_link.max_depth && (
                                  <span className='bg-blue-100 text-blue-800 px-2 py-0.5 rounded'>
                                    Depth: {cert.certification_level_link.max_depth}
                                  </span>
                                )}
                                {cert.certification_level_link.gases && (
                                  <span className='bg-purple-100 text-purple-800 px-2 py-0.5 rounded'>
                                    Gases: {cert.certification_level_link.gases}
                                  </span>
                                )}
                                {cert.certification_level_link.tanks && (
                                  <span className='bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-300'>
                                    Tanks: {cert.certification_level_link.tanks}
                                  </span>
                                )}
                                {cert.certification_level_link.deco_time_limit && (
                                  <span className='bg-red-100 text-red-800 px-2 py-0.5 rounded'>
                                    Deco: {cert.certification_level_link.deco_time_limit}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
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
                onClick={() => {
                  if (isChangingPassword) {
                    resetPassword();
                  }
                  setIsChangingPassword(!isChangingPassword);
                }}
                className='px-4 py-2 text-blue-600 hover:text-blue-700 font-medium'
              >
                {isChangingPassword ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            {isChangingPassword ? (
              <FormProvider {...passwordMethods}>
                <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className='space-y-4'>
                  <div>
                    <FormField name='current_password' label='Current Password'>
                      {({ register, name }) => (
                        <input
                          type='password'
                          {...register(name)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            passwordErrors.current_password ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                    </FormField>
                  </div>

                  <div>
                    <FormField name='new_password' label='New Password'>
                      {({ register, name }) => (
                        <input
                          type='password'
                          {...register(name)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            passwordErrors.new_password ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                    </FormField>
                  </div>

                  <div>
                    <FormField name='confirm_password' label='Confirm New Password'>
                      {({ register, name }) => (
                        <input
                          type='password'
                          {...register(name)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            passwordErrors.confirm_password ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                    </FormField>
                  </div>

                  <div className='flex justify-end space-x-3'>
                    <button
                      type='button'
                      onClick={() => {
                        setIsChangingPassword(false);
                        resetPassword();
                      }}
                      className='px-4 py-2 text-gray-600 hover:text-gray-700'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={changePasswordMutation.isLoading}
                      className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
                    >
                      {changePasswordMutation.isLoading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </FormProvider>
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
              <div className='flex justify-between items-center font-bold border-b pb-2 mb-2'>
                <span className='text-gray-900'>Total Dives</span>
                <span className='text-gray-900'>
                  {(user?.number_of_dives || 0) +
                    (userStats?.dives_created || 0) +
                    (userStats?.buddy_dives_count || 0)}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-600'>Dives from Profile</span>
                <span className='font-medium'>{user?.number_of_dives || 0}</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-600'>Dives Created</span>
                <Link
                  to='/dives?my_dives=true'
                  className='font-medium text-blue-600 hover:text-blue-800'
                >
                  {userStats?.dives_created || 0}
                </Link>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-600'>Dives Participated</span>
                <span className='font-medium'>{userStats?.buddy_dives_count || 0}</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-600'>Dive Sites Created</span>
                <Link
                  to='/dive-sites?my_dive_sites=true'
                  className='font-medium text-blue-600 hover:text-blue-800'
                >
                  {userStats?.dive_sites_created || 0}
                </Link>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Sites Rated</span>
                <span className='font-medium'>{userStats?.dive_sites_rated || 0}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Comments Posted</span>
                <span className='font-medium'>{userStats?.comments_posted || 0}</span>
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
              <Link
                to={`/users/${user.username}`}
                className='block w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
              >
                View Public Profile
              </Link>
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
              <Link
                to='/notifications'
                className='block w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
              >
                View Notifications
              </Link>
              <Link
                to='/notifications/preferences'
                className='block w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
              >
                Notification Preferences
              </Link>
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
