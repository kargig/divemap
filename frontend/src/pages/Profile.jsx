/* global Notification */
import { Modal } from 'antd';
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
  Camera,
  Building2,
  Key,
  Users,
  Bell,
  Settings,
  ExternalLink,
  Smartphone,
  Link as LinkIcon,
  MessageSquare,
  TrendingUp,
  Wind,
  Droplets,
  Notebook,
  MapPin,
  Star,
  Gauge,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import api, { getUserPublicProfile } from '../api';
import AvatarEditor from '../components/AvatarEditor';
import { FormField } from '../components/forms/FormField';
import MaskedEmail from '../components/MaskedEmail';
import OrganizationLogo from '../components/OrganizationLogo';
import { getSocialMediaIcon } from '../components/SocialMediaIcons';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getDivingCenters } from '../services/divingCenters';
import { getFullAvatarUrl } from '../utils/avatarHelpers';
import {
  profileSchema,
  certificationSchema,
  changePasswordSchema,
  socialLinkSchema,
  createResolver,
  getErrorMessage,
} from '../utils/formHelpers';
import { slugify } from '../utils/slugify';
import { formatGases } from '../utils/textHelpers';

const Profile = () => {
  // Set page title
  usePageTitle('Divemap - Profile');
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
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
    onSuccess: (response, variables) => {
      // If the username was explicitly updated and changed, we must force a logout
      // because the JWT token's 'sub' claim contains the old username.
      if (variables.username && variables.username !== user.username) {
        logout();
        toast.success('Username successfully updated! Please log in again.');
        navigate('/login');
      } else {
        updateUser(response.data);
        toast.success('Profile updated successfully!');
        setIsEditing(false);
      }
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

  const deleteAccountMutation = useMutation(() => api.delete('/api/v1/users/me'), {
    onSuccess: () => {
      toast.success('Your account has been successfully archived.');
      logout(); // Logs the user out and redirects to home
    },
    onError: error => {
      toast.error(error.response?.data?.detail || 'Failed to archive account');
    },
  });

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        'DANGER: Are you sure you want to archive your account?\n\nThis will hide your profile and log you out immediately. To restore your account in the future, you will need to contact an administrator.'
      )
    ) {
      deleteAccountMutation.mutate();
    }
  };

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
      const centersRes = await getDivingCenters({ page_size: 1000 });
      const centers = centersRes.items || [];
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
    // Exclude email as it cannot be changed
    // eslint-disable-next-line no-unused-vars
    const { email, ...rest } = data;

    // Check if username has changed
    if (data.username && data.username !== user.username) {
      if (
        !window.confirm(
          'Changing your username will log you out and require you to log back in. Any links to your current public profile will break. Are you sure you want to proceed?'
        )
      ) {
        return;
      }
    } else {
      // Don't send username if it hasn't changed to save processing
      delete rest.username;
    }

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

  const renderCertificationFeatures = cert => {
    if (!cert.certification_level_link) return null;

    const features = [];
    const { max_depth, gases, equipment, tanks, deco_time_limit } = cert.certification_level_link;

    if (max_depth) {
      // If it's just numbers, add 'm'. If it already has units, use as is.
      // But for label, try to keep it short (e.g. "18m (60ft)" -> "18m")
      let shortDepth = max_depth;
      const depthMatch = max_depth.match(/^(\d+)\s*m/i);
      if (depthMatch) {
        shortDepth = `${depthMatch[1]}m`;
      } else if (/^\d+$/.test(max_depth)) {
        shortDepth = `${max_depth}m`;
      }

      features.push({
        icon: <TrendingUp className='h-3 w-3' />,
        label: shortDepth,
        title: `Max Depth: ${max_depth}`,
        color: 'bg-blue-50 text-blue-700 border-blue-100',
      });
    }

    if (gases) {
      features.push({
        icon: <Wind className='h-3 w-3' />,
        label: formatGases(gases),
        title: `Gases: ${gases}`,
        color: 'bg-green-50 text-green-700 border-green-100',
      });
    }

    const tankInfo = tanks || equipment;
    if (tankInfo) {
      const isDoubles =
        tankInfo.toLowerCase().includes('double') || tankInfo.toLowerCase().includes('twin');
      features.push({
        icon: (
          <img
            src={isDoubles ? '/doubles.png' : '/single.png'}
            alt='tank'
            className='h-3.5 w-3.5 object-contain'
          />
        ),
        label: tankInfo,
        title: `Tanks/Equip: ${tankInfo}`,
        color: 'bg-purple-50 text-purple-700 border-purple-100',
      });
    }

    if (deco_time_limit) {
      features.push({
        icon: <Droplets className='h-3 w-3' />,
        label: `Deco: ${deco_time_limit}`,
        title: `Deco Limit: ${deco_time_limit}`,
        color: 'bg-red-50 text-red-700 border-red-100',
      });
    }

    if (features.length === 0) return null;

    return (
      <div className='flex flex-wrap gap-1.5 mt-2'>
        {features.map((f, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold ${f.color}`}
            title={f.title}
          >
            {f.icon}
            <span className='whitespace-nowrap'>{f.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const startEditCertification = certification => {
    setEditingCertification(certification);
    setValueCert('diving_organization_id', certification.diving_organization.id);
    setValueCert('is_active', certification.is_active);

    // We need to wait for availableLevels to be fetched before we can set certification_level_id
    // But since it is fetched via useEffect on diving_organization_id change, we can't do it here easily
    // unless we use a temporary variable or another useEffect.
    // Let's set it here, and also add a useEffect to catch it when levels load.
  };

  // Effect to sync certification level when levels are loaded during edit
  useEffect(() => {
    if (editingCertification && availableLevels.length > 0) {
      if (editingCertification.certification_level_link) {
        const found = availableLevels.find(
          l => l.id === editingCertification.certification_level_link.id
        );
        if (found) {
          setValueCert('certification_level_id', found.id);
        }
      }
    }
  }, [availableLevels, editingCertification, setValueCert]);

  const cancelCertificationEdit = () => {
    setEditingCertification(null);
    resetCert();
  };

  const startEditSocialLink = link => {
    setIsAddingSocialLink(true);
    resetSocialLink({
      platform: link.platform,
      url: link.url,
    });
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

  // --- Push Notification Logic ---
  const [pushStatus, setPushStatus] = useState('loading'); // 'loading', 'supported', 'unsupported', 'denied', 'granted'

  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setPushStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      return;
    }

    if (Notification.permission === 'granted') {
      setPushStatus('granted');
      return;
    }

    setPushStatus('supported');
  }, []);

  const urlBase64ToUint8Array = base64String => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleEnablePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        toast.error('Permission for notifications was denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        console.error('VITE_VAPID_PUBLIC_KEY is not set');
        toast.error('Push notification configuration is missing');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send to backend
      const { endpoint, keys } = subscription.toJSON();
      await api.post('/api/v1/notifications/push/subscribe', {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      setPushStatus('granted');
      toast.success('Push notifications enabled for this device!');
    } catch (error) {
      console.error('Failed to subscribe to push notifications', error);
      toast.error('Failed to enable push notifications');
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
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
      <div className='mb-6 sm:mb-8'>
        <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2'>Profile</h1>
        <p className='text-sm sm:text-base text-gray-600'>
          Manage your account settings and diving information
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8'>
        {/* Profile Information */}
        <div className='lg:col-span-2'>
          <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
            {/* Avatar Section */}
            <div className='flex flex-col sm:flex-row items-center gap-6 pb-6 mb-6 border-b border-gray-100'>
              <div className='relative group'>
                <div className='h-24 w-24 sm:h-32 sm:w-32 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-50'>
                  <img
                    src={getFullAvatarUrl(user)}
                    alt={user.username}
                    className='h-full w-full object-cover'
                  />
                </div>
                <button
                  onClick={() => setIsAvatarModalOpen(true)}
                  className='absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <Camera className='h-6 w-6' />
                </button>
              </div>
              <div className='text-center sm:text-left flex-1'>
                <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2'>
                  <h1 className='text-2xl font-bold text-gray-900'>{user.username}</h1>
                  <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                    {user.is_admin ? 'Administrator' : user.is_moderator ? 'Moderator' : 'Diver'}
                  </span>
                </div>
                <p className='text-gray-500 text-sm mb-4'>
                  Member since {new Date(user.created_at).toLocaleDateString()}
                </p>
                <div className='flex flex-wrap justify-center sm:justify-start gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setIsAvatarModalOpen(true)}
                    className='flex items-center'
                  >
                    <Camera className='h-4 w-4 mr-2' />
                    Change Photo
                  </Button>
                </div>
              </div>
            </div>

            <div className='flex items-center justify-between mb-4 sm:mb-6'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 uppercase tracking-tight'>
                Account Information
              </h2>
              <button
                onClick={() => {
                  if (isEditing) {
                    resetProfile();
                  }
                  setIsEditing(!isEditing);
                }}
                className='px-3 py-1.5 sm:px-4 sm:py-2 text-blue-600 hover:text-blue-700 font-medium text-sm sm:text-base transition-colors duration-200'
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <FormProvider {...profileMethods}>
                <form onSubmit={handleSubmitProfile(onProfileSubmit)} className='space-y-4'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <FormField name='username' label='Username'>
                      {({ register, name }) => (
                        <input
                          id='username'
                          type='text'
                          {...register(name)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                            profileErrors.username ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                    </FormField>

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
                          <p className='mt-1 text-[10px] text-gray-500'>Email cannot be changed</p>
                        </>
                      )}
                    </FormField>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <FormField name='name' label='Full Name'>
                      {({ register, name }) => (
                        <input
                          id='name'
                          type='text'
                          {...register(name)}
                          placeholder='Enter your full name'
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-shadow focus:ring-1'
                        />
                      )}
                    </FormField>

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

                  <FormField name='buddy_visibility' label='Buddy Visibility'>
                    {({ register, name }) => (
                      <>
                        <select
                          {...register(name)}
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                        >
                          <option value='public'>Public - Others can add me as a dive buddy</option>
                          <option value='private'>Private - Hide me from buddy search</option>
                        </select>
                        <p className='mt-1 text-xs text-gray-500'>
                          Control whether other users can find and add you as a dive buddy
                        </p>
                      </>
                    )}
                  </FormField>

                  <div className='flex justify-end gap-3 pt-2'>
                    <button
                      type='button'
                      onClick={() => {
                        resetProfile();
                        setIsEditing(false);
                      }}
                      className='px-4 py-2 text-gray-600 hover:text-gray-700 font-medium'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={updateProfileMutation.isLoading}
                      className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-all duration-200'
                    >
                      {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </FormProvider>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6'>
                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <User className='h-5 w-5 text-blue-600' />
                  </div>
                  <div className='min-w-0'>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Username
                    </span>
                    <p className='text-gray-900 font-semibold truncate'>{user.username}</p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <User className='h-5 w-5 text-blue-600' />
                  </div>
                  <div className='min-w-0'>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Full Name
                    </span>
                    <p className='text-gray-900 font-semibold truncate'>{user.name || 'Not set'}</p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <Mail className='h-5 w-5 text-blue-600' />
                  </div>
                  <div className='min-w-0'>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Email
                    </span>
                    <p className='text-gray-900 font-semibold truncate'>
                      <MaskedEmail email={user.email} />
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <Activity className='h-5 w-5 text-blue-600' />
                  </div>
                  <div className='min-w-0'>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Total Dives
                    </span>
                    <div className='flex items-baseline gap-2'>
                      <p className='text-gray-900 font-bold text-lg'>
                        {(user?.number_of_dives || 0) +
                          (userStats?.dives_created || 0) +
                          (userStats?.buddy_dives_count || 0)}
                      </p>
                    </div>
                    <p className='text-[9px] leading-tight text-gray-400 mt-0.5'>
                      {user?.number_of_dives || 0} prof. + {userStats?.dives_created || 0} built +{' '}
                      {userStats?.buddy_dives_count || 0} buddy
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <Shield className='h-5 w-5 text-blue-600' />
                  </div>
                  <div>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Buddy Visibility
                    </span>
                    <p className='text-gray-900'>
                      {(user.buddy_visibility || 'public') === 'public' ? (
                        <span className='text-green-600 font-bold text-sm'>Public</span>
                      ) : (
                        <span className='text-gray-600 font-bold text-sm'>Private</span>
                      )}
                    </p>
                  </div>
                </div>

                {ownedDivingCenters && ownedDivingCenters.length > 0 && (
                  <div className='flex items-start'>
                    <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                      <Building2 className='h-5 w-5 text-blue-600' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                        Owned Centers
                      </span>
                      <div className='flex flex-wrap gap-1.5 mt-1'>
                        {ownedDivingCenters.map(center => (
                          <Link
                            key={center.id}
                            to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                            className='inline-block px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium transition-colors border border-blue-100'
                          >
                            {center.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <Calendar className='h-5 w-5 text-blue-600' />
                  </div>
                  <div>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Member Since
                    </span>
                    <p className='text-gray-900 font-semibold text-sm'>
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className='flex items-start'>
                  <div className='bg-gray-100 p-2 rounded-lg mr-3 shrink-0'>
                    <Shield className='h-5 w-5 text-blue-600' />
                  </div>
                  <div>
                    <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5'>
                      Role
                    </span>
                    <p className='text-gray-900 font-semibold text-sm'>
                      {user.is_admin ? 'Administrator' : user.is_moderator ? 'Moderator' : 'User'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Social Media Links Section */}
          <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md mt-6'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
              <h2 className='text-lg sm:text-xl font-bold text-gray-900 uppercase tracking-tight'>
                Social Media Links
              </h2>
              <button
                onClick={() => {
                  if (isAddingSocialLink) {
                    resetSocialLink();
                  }
                  setIsAddingSocialLink(!isAddingSocialLink);
                }}
                className='flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm transition-all w-full sm:w-auto'
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
                <p className='text-[10px] text-gray-400'>
                  Connect your social profiles to your dive profile.
                </p>
              </div>
            ) : (
              <div className='flex flex-wrap gap-3'>
                {user.social_links.map(link => (
                  <div
                    key={link.platform}
                    className='group relative flex items-center bg-gray-50 hover:bg-white border border-gray-200 rounded-full pl-1.5 pr-2 py-1.5 transition-all shadow-sm hover:shadow-md'
                  >
                    <a
                      href={link.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center space-x-2'
                      title={link.url}
                    >
                      <div className='bg-white p-1.5 rounded-full shadow-sm border border-gray-100 group-hover:scale-110 transition-transform'>
                        {getSocialMediaIcon(link.platform, {
                          color: '000000',
                          className: 'w-4 h-4',
                        })}
                      </div>
                      <span className='font-bold text-xs text-gray-700 capitalize pr-1'>
                        {link.platform}
                      </span>
                    </a>
                    <div className='flex items-center border-l border-gray-200 ml-2 pl-2 space-x-1'>
                      <button
                        onClick={() => startEditSocialLink(link)}
                        className='p-1 text-gray-400 hover:text-blue-600 transition-colors'
                        title='Edit link'
                      >
                        <Edit className='h-3.5 w-3.5' />
                      </button>
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
                        className='p-1 text-gray-400 hover:text-red-600 transition-colors'
                        title='Remove link'
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Certifications Section */}
          <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md mt-6'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
              <h2 className='text-lg sm:text-xl font-bold text-gray-900 uppercase tracking-tight'>
                Diving Certifications
              </h2>
              <button
                onClick={() => {
                  if (isAddingCertification) {
                    resetCert();
                  }
                  setIsAddingCertification(!isAddingCertification);
                }}
                className='flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm transition-all w-full sm:w-auto'
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
                            id='add_diving_organization_id'
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
                              id='add_certification_level_id'
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

                  <div className='mt-2'>
                    <FormField name='is_active'>
                      {({ register, name }) => (
                        <div className='flex items-center'>
                          <input
                            id='add_is_active'
                            type='checkbox'
                            {...register(name)}
                            className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                          />
                          <label
                            htmlFor='add_is_active'
                            className='ml-2 block text-sm text-gray-900 font-medium'
                          >
                            Active Certification
                          </label>
                        </div>
                      )}
                    </FormField>
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
                            id='edit_diving_organization_id'
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
                              id='edit_certification_level_id'
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

                  <div className='mt-2'>
                    <FormField name='is_active'>
                      {({ register, name }) => (
                        <div className='flex items-center'>
                          <input
                            id='edit_is_active'
                            type='checkbox'
                            {...register(name)}
                            className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                          />
                          <label
                            htmlFor='edit_is_active'
                            className='ml-2 block text-sm text-gray-900 font-medium'
                          >
                            Active Certification
                          </label>
                        </div>
                      )}
                    </FormField>
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
                    <div className='flex items-start gap-4'>
                      {/* Left side: Logo + Actions */}
                      <div className='flex flex-col items-center space-y-2 shrink-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='transition-transform hover:scale-105'
                          title={`View ${cert.diving_organization.acronym} details`}
                        >
                          <OrganizationLogo
                            org={cert.diving_organization}
                            size='h-12 w-12'
                            textSize='text-sm'
                          />
                        </Link>
                        <div className='flex flex-col items-center space-y-0'>
                          <button
                            onClick={() => startEditCertification(cert)}
                            className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors'
                            title='Edit'
                          >
                            <Edit className='h-4 w-4' />
                          </button>
                          <button
                            onClick={() => handleDeleteCertification(cert.id)}
                            className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors'
                            title='Delete'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      </div>

                      {/* Right side: Info */}
                      <div className='flex-1 min-w-0'>
                        <Link
                          to={`/resources/diving-organizations?org=${encodeURIComponent(cert.diving_organization.acronym || cert.diving_organization.name)}&course=${encodeURIComponent(cert.certification_level)}`}
                          className='block group'
                        >
                          <div className='flex items-center space-x-2 mb-2'>
                            <div
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                cert.is_active
                                  ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'
                                  : 'bg-gray-400'
                              }`}
                              title={cert.is_active ? 'Active' : 'Inactive'}
                            />
                            <span className='font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors'>
                              {cert.diving_organization.acronym} - {cert.certification_level}
                            </span>
                          </div>
                        </Link>

                        <div className='text-sm text-gray-600 space-y-1'>
                          <p className='hidden md:block text-xs uppercase tracking-tighter opacity-70'>
                            Organization: {cert.diving_organization.name}
                          </p>
                          {renderCertificationFeatures(cert)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Account Stats */}
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-lg font-bold text-gray-900 mb-4 border-b pb-2 uppercase tracking-tight flex items-center gap-2'>
              <Gauge className='h-5 w-5 text-gray-400' />
              Account Stats
            </h3>
            <div className='space-y-3'>
              <div className='flex justify-between items-center font-bold pb-1'>
                <div className='flex items-center gap-2'>
                  <Notebook size={16} className='text-blue-600' />
                  <span className='text-gray-900'>Total Dives</span>
                </div>
                <span className='text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-4'>
                  {(user?.number_of_dives || 0) +
                    (userStats?.dives_created || 0) +
                    (userStats?.buddy_dives_count || 0)}
                </span>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <User size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dives from Profile</span>
                </div>
                <span className='font-semibold text-gray-900 flex-1 text-right'>
                  {user?.number_of_dives || 0}
                </span>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <Activity size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dives Created</span>
                </div>
                <div className='flex-1 text-right'>
                  <Link
                    to='/dives?my_dives=true'
                    className='font-semibold text-blue-600 hover:text-blue-800 underline decoration-blue-200 underline-offset-4'
                  >
                    {userStats?.dives_created || 0}
                  </Link>
                </div>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <Users size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dives Participated</span>
                </div>
                <span className='font-semibold text-gray-900 flex-1 text-right'>
                  {userStats?.buddy_dives_count || 0}
                </span>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <MapPin size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dive Sites Created</span>
                </div>
                <div className='flex-1 text-right'>
                  <Link
                    to='/dive-sites?my_dive_sites=true'
                    className='font-semibold text-blue-600 hover:text-blue-800 underline decoration-blue-200 underline-offset-4'
                  >
                    {userStats?.dive_sites_created || 0}
                  </Link>
                </div>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <Star size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Dive Site Rated</span>
                </div>
                <span className='font-semibold text-gray-900 flex-1 text-right'>
                  {userStats?.dive_sites_rated || 0}
                </span>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <MessageSquare size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Comments Posted</span>
                </div>
                <span className='font-semibold text-gray-900 flex-1 text-right'>
                  {userStats?.comments_posted || 0}
                </span>
              </div>
              <div className='flex justify-between items-center text-sm'>
                <div className='flex items-center gap-2'>
                  <Award size={16} className='text-gray-400' />
                  <span className='text-gray-600'>Certifications</span>
                </div>
                <span className='font-semibold text-gray-900 flex-1 text-right'>
                  {certifications.filter(c => c.is_active).length}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Actions */}
          <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
            <h3 className='text-md font-bold text-gray-900 mb-4 border-b pb-1 uppercase tracking-wider'>
              Account
            </h3>
            <div className='space-y-1'>
              <Link
                to={`/users/${user.username}`}
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <ExternalLink size={18} className='mr-3 text-gray-400' />
                Public Profile
              </Link>
              <Link
                to='/buddies'
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <Users size={18} className='mr-3 text-gray-400' />
                My Buddies
              </Link>
              <Link
                to='/ai-chat-history'
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <MessageSquare size={18} className='mr-3 text-gray-400' />
                Chat History
              </Link>
              <button
                onClick={() => setIsChangingPassword(true)}
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <Lock size={18} className='mr-3 text-gray-400' />
                Password
              </button>
            </div>

            <h3 className='text-md font-bold text-gray-900 mb-4 mt-6 border-b pb-1 uppercase tracking-wider'>
              Privacy & API
            </h3>
            <div className='space-y-1'>
              <Link
                to='/notifications'
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <Bell size={18} className='mr-3 text-gray-400' />
                Notifications
              </Link>
              <Link
                to='/notifications/preferences'
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <Settings size={18} className='mr-3 text-gray-400' />
                Preferences
              </Link>

              {/* Push Notifications Toggle/Status */}
              {pushStatus === 'supported' && (
                <button
                  onClick={handleEnablePush}
                  className='flex items-center w-full px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium border border-blue-100'
                >
                  <Smartphone size={18} className='mr-3' />
                  Enable Device Notifications
                </button>
              )}

              {pushStatus === 'granted' && (
                <div className='flex items-center w-full px-3 py-2 text-green-600 bg-green-50 rounded-md border border-green-100'>
                  <Smartphone size={18} className='mr-3' />
                  <span className='font-medium'>Device Notifications Active</span>
                </div>
              )}

              {pushStatus === 'denied' && (
                <div className='flex items-center w-full px-3 py-2 text-red-600 bg-red-50 rounded-md border border-red-100'>
                  <Smartphone size={18} className='mr-3' />
                  <span className='font-medium'>Notifications Blocked</span>
                </div>
              )}

              {pushStatus === 'unsupported' && (
                <div className='flex items-center w-full px-3 py-2 text-gray-500 bg-gray-50 rounded-md border border-gray-100'>
                  <Smartphone size={18} className='mr-3' />
                  <span className='text-xs italic'>
                    Notifications not supported (Requires HTTPS)
                  </span>
                </div>
              )}

              <Link
                to='/profile/pats'
                className='flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-sm font-medium'
              >
                <Key size={18} className='mr-3 text-gray-400' />
                API Tokens
              </Link>
            </div>

            <div className='mt-8 pt-4 border-t'>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountMutation.isLoading}
                className='flex items-center w-full px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 text-sm font-bold uppercase tracking-tight'
              >
                <Trash2 size={18} className='mr-3' />
                {deleteAccountMutation.isLoading ? 'Archiving...' : 'Archive Account'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        title='Change Your Password'
        open={isChangingPassword}
        onCancel={() => {
          setIsChangingPassword(false);
          resetPassword();
        }}
        footer={null}
        destroyOnHidden
      >
        <FormProvider {...passwordMethods}>
          <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className='space-y-4 mt-4'>
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

            <div className='flex justify-end space-x-3 pt-4 border-t mt-6'>
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
      </Modal>

      <AvatarEditor
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={user.avatar_url}
        currentAvatarFullUrl={user.avatar_full_url}
        currentType={user.avatar_type}
        googleAvatarUrl={user.google_avatar_url}
        onAvatarUpdated={updatedUser => updateUser(updatedUser)}
      />
    </div>
  );
};

export default Profile;
