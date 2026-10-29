/* global Notification */
import { Mail, Globe, MapPin, Trash2, ArrowLeft, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { getNotificationPreferences } from '../services/notifications';

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

const NotificationPreferencesPage = () => {
  const { user } = useAuth();
  const isSyntheticEmail = Boolean(user?.email?.endsWith('.invalid'));
  const { createPreference, updatePreference, deletePreference } = useNotifications();
  const { data: preferences = [], isLoading } = useQuery(
    ['notifications', 'preferences'],
    getNotificationPreferences,
    {
      enabled: true,
    }
  );

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

  const categories = [
    {
      value: 'new_dive_sites',
      label: 'New Dive Sites',
      description: 'New dive sites added to the platform',
    },
    { value: 'new_dives', label: 'New Dives', description: 'New dives logged by other users' },
    {
      value: 'new_diving_centers',
      label: 'New Diving Centers',
      description: 'New diving centers added',
    },
    {
      value: 'new_dive_trips',
      label: 'New Dive Trips',
      description: 'New dive trips/newsletters parsed',
    },
    {
      value: 'admin_alerts',
      label: 'Admin Alerts',
      description: 'Admin-only notifications (user registrations, claims)',
    },
    {
      value: 'system',
      label: 'System & Social',
      description: 'Buddy requests, chat messages, and system announcements',
    },
    {
      value: 'moderation',
      label: 'Moderation',
      description: 'Pending dive site edits, tags, and media awaiting review',
      requiresAdmin: true,
    },
  ];

  const frequencies = [
    { value: 'immediate', label: 'Immediate' },
    { value: 'daily_digest', label: 'Daily Digest' },
    { value: 'weekly_digest', label: 'Weekly Digest' },
  ];

  const getPreference = category => {
    return preferences.find(p => p.category === category);
  };

  const handleToggle = (category, field, value) => {
    if (field === 'enable_email' && value && isSyntheticEmail) {
      toast.error('To enable email notifications, please add a valid email to your profile first.');
      return;
    }

    const preference = getPreference(category);
    if (preference) {
      // Update existing preference
      updatePreference({
        category,
        data: { [field]: value },
      });
    } else {
      // Create new preference
      const isDefaultEnabled = [
        'system',
        'moderation',
        'new_dive_sites',
        'new_dive_trips',
        'admin_alerts',
      ].includes(category);

      const defaultData = {
        category,
        enable_website: isDefaultEnabled,
        enable_push: isDefaultEnabled,
        enable_email: false,
        frequency: 'immediate',
      };
      createPreference({ ...defaultData, [field]: value });
    }
  };

  const handleFrequencyChange = (category, frequency) => {
    const preference = getPreference(category);
    if (preference) {
      updatePreference({
        category,
        data: { frequency },
      });
    } else {
      const isDefaultEnabled = [
        'system',
        'moderation',
        'new_dive_sites',
        'new_dive_trips',
        'admin_alerts',
      ].includes(category);

      createPreference({
        category,
        enable_website: true,
        enable_push: isDefaultEnabled,
        enable_email: false,
        frequency,
      });
    }
  };

  const handleDeletePreference = category => {
    if (window.confirm('Are you sure you want to reset this preference to defaults?')) {
      deletePreference(category);
    }
  };

  const isDefEnabled = catValue =>
    ['system', 'new_dive_sites', 'new_dive_trips', 'admin_alerts'].includes(catValue);
  // 'moderation' handles its own admin check later

  const handleBulkUpdate = (field, value) => {
    if (field === 'enable_email' && value && isSyntheticEmail) {
      toast.error('To enable email notifications, please add a valid email to your profile first.');
      return;
    }

    categories.forEach(category => {
      const catValue = category.value;
      const preference = getPreference(catValue);
      if (preference) {
        updatePreference({
          category: catValue,
          data: { [field]: value },
        });
      } else {
        const isDef = isDefEnabled(catValue);
        const defaultData = {
          category: catValue,
          enable_website: isDef,
          enable_push: isDef,
          enable_email: false,
          frequency: 'immediate',
        };
        createPreference({ ...defaultData, [field]: value });
      }
    });
  };

  const handleDisableAll = () => {
    if (
      window.confirm('Are you sure you want to disable all notifications across all categories?')
    ) {
      categories.forEach(category => {
        const catValue = category.value;
        const preference = getPreference(catValue);
        if (preference) {
          updatePreference({
            category: catValue,
            data: { enable_website: false, enable_push: false, enable_email: false },
          });
        } else {
          createPreference({
            category: catValue,
            enable_website: false,
            enable_push: false,
            enable_email: false,
            frequency: 'immediate',
          });
        }
      });
    }
  };

  const isAllWebsiteEnabled = categories.every(c => {
    const pref = getPreference(c.value);
    const isDef = isDefEnabled(c.value);
    return pref ? pref.enable_website : isDef;
  });

  const isAllPushEnabled = categories.every(c => {
    const pref = getPreference(c.value);
    const isDef = isDefEnabled(c.value);
    return pref ? pref.enable_push : isDef;
  });

  const isAllEmailEnabled = categories.every(c => {
    const pref = getPreference(c.value);
    return pref ? pref.enable_email : false;
  });

  if (isLoading) {
    return (
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
        <div className='mb-6'>
          <Link
            to='/profile'
            className='inline-flex items-center text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Profile
          </Link>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2'>
            Notification Preferences
          </h1>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-6 text-gray-700 dark:text-slate-300'>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title='Notification Preferences | Divemap'
        description='Manage your email and push notification settings.'
      />
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
        <div className='mb-6'>
          <Link
            to='/profile'
            className='inline-flex items-center text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Profile
          </Link>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2'>
            Notification Preferences
          </h1>
          <p className='text-gray-600 dark:text-slate-400'>
            Configure how you want to receive notifications for different types of updates.
          </p>
        </div>

        <div className='bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-6 mb-8 border-l-4 border-l-blue-600'>
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <div className='flex items-center space-x-2 mb-2'>
                <Smartphone className='h-6 w-6 text-blue-600 dark:text-sky-400' />
                <h2 className='text-xl font-bold text-gray-900 dark:text-slate-100'>
                  Device Push Notifications
                </h2>
              </div>
              <p className='text-gray-600 dark:text-slate-400 max-w-2xl'>
                Receive instant alerts on your Android phone or desktop browser even when Divemap is
                closed. Perfect for chat replies and important site updates.
              </p>
            </div>

            <div className='ml-4'>
              {pushStatus === 'supported' && (
                <button
                  onClick={handleEnablePush}
                  className='px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                >
                  Enable for this Device
                </button>
              )}

              {pushStatus === 'granted' && (
                <div className='flex items-center space-x-2 px-4 py-2 bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-300 rounded-full border border-green-200 dark:border-emerald-800 font-medium'>
                  <div className='h-2 w-2 bg-green-500 rounded-full animate-pulse'></div>
                  <span>Active on this Device</span>
                </div>
              )}

              {pushStatus === 'denied' && (
                <div className='px-4 py-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800'>
                  <div className='font-bold mb-1'>Notifications Blocked in Browser</div>
                  <div className='text-sm'>
                    To enable push notifications, click the info/preferences icon in your browser's
                    address bar, change the Notifications setting to "Allow", and then refresh this
                    page.
                  </div>
                </div>
              )}

              {pushStatus === 'unsupported' && (
                <div className='text-sm text-gray-400 dark:text-slate-500 italic'>
                  Not supported by this browser or device
                </div>
              )}
            </div>
          </div>
        </div>

        {isSyntheticEmail && (
          <div className='mb-6 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-sm text-blue-800 dark:text-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
            <div className='flex items-center space-x-2'>
              <Mail className='h-5 w-5 text-blue-600 dark:text-sky-400 shrink-0' />
              <span>
                You are currently signed in with a social account without an email. To enable email
                notifications, please add a valid email address to your profile.
              </span>
            </div>
            <Link
              to='/profile'
              className='px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors shrink-0'
            >
              Add Email
            </Link>
          </div>
        )}

        <div className='bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-6 mb-8'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-bold text-gray-900 dark:text-slate-100'>Bulk Actions</h2>
            <button
              onClick={handleDisableAll}
              className='flex items-center px-4 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition-colors font-medium text-sm border border-red-200 dark:border-red-800'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Disable All Notifications
            </button>
          </div>
          <p className='text-sm text-gray-600 dark:text-slate-400 mb-6'>
            Quickly enable or disable specific notification methods across all categories.
          </p>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {/* All Website */}
            <label className='flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900/60 cursor-pointer group'>
              <div className='flex items-center space-x-2'>
                <Globe className='h-5 w-5 text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors' />
                <span className='text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100 transition-colors'>
                  All Website
                </span>
              </div>
              <div className='relative inline-flex items-center'>
                <input
                  type='checkbox'
                  checked={isAllWebsiteEnabled}
                  onChange={e => handleBulkUpdate('enable_website', e.target.checked)}
                  className='sr-only peer'
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
            </label>

            {/* All Push */}
            <label
              className={`flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg ${pushStatus === 'denied' || pushStatus === 'unsupported' ? 'bg-gray-100 dark:bg-slate-900/40 opacity-75 cursor-not-allowed' : 'bg-gray-50 dark:bg-slate-900/60 cursor-pointer group'}`}
            >
              <div className='flex items-center space-x-2'>
                <Smartphone
                  className={`h-5 w-5 ${pushStatus === 'denied' || pushStatus === 'unsupported' ? 'text-gray-400 dark:text-slate-500' : 'text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors'}`}
                />
                <span
                  className={`text-sm font-medium ${pushStatus === 'denied' || pushStatus === 'unsupported' ? 'text-gray-500 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100 transition-colors'}`}
                >
                  All Push
                </span>
              </div>
              <div className='relative inline-flex items-center'>
                <input
                  type='checkbox'
                  checked={isAllPushEnabled}
                  disabled={pushStatus === 'denied' || pushStatus === 'unsupported'}
                  onChange={e => {
                    const isTurningOn = e.target.checked;
                    if (isTurningOn && pushStatus !== 'granted') {
                      handleEnablePush().then(() => {
                        if (Notification.permission === 'granted') {
                          handleBulkUpdate('enable_push', true);
                        }
                      });
                    } else {
                      handleBulkUpdate('enable_push', isTurningOn);
                    }
                  }}
                  className='sr-only peer'
                />
                <div
                  className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${pushStatus === 'denied' || pushStatus === 'unsupported' ? 'opacity-50 cursor-not-allowed' : ''}`}
                ></div>
              </div>
            </label>
            {/* All Email */}
            <label
              className={`flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg ${
                isSyntheticEmail
                  ? 'bg-gray-100 dark:bg-slate-900/40 opacity-75 cursor-not-allowed'
                  : 'bg-gray-50 dark:bg-slate-900/60 cursor-pointer group'
              }`}
            >
              <div className='flex items-center space-x-2'>
                <Mail
                  className={`h-5 w-5 ${
                    isSyntheticEmail
                      ? 'text-gray-400 dark:text-slate-500'
                      : 'text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    isSyntheticEmail
                      ? 'text-gray-500 dark:text-slate-500'
                      : 'text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100 transition-colors'
                  }`}
                >
                  All Email
                </span>
              </div>
              <div className='relative inline-flex items-center'>
                <input
                  type='checkbox'
                  checked={!isSyntheticEmail && isAllEmailEnabled}
                  disabled={isSyntheticEmail}
                  onChange={e => handleBulkUpdate('enable_email', e.target.checked)}
                  className='sr-only peer'
                />
                <div
                  className={`w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                    isSyntheticEmail ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                ></div>
              </div>
            </label>
          </div>
        </div>

        <div className='bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {categories.map(category => {
              if (category.requiresAdmin && !(user?.is_admin || user?.is_moderator)) {
                return null;
              }
              const preference = getPreference(category.value);
              // Default website notification should be true for 'system', 'new_dive_sites', 'new_dive_trips', 'admin_alerts'
              const isDefaultEnabled = [
                'system',
                'moderation',
                'new_dive_sites',
                'new_dive_trips',
                'admin_alerts',
              ].includes(category.value);

              // Only use preference values if preference exists, otherwise show as not configured (or default)
              const enableWebsite = preference?.enable_website ?? isDefaultEnabled;
              const enablePush = preference?.enable_push ?? isDefaultEnabled;
              const enableEmail = preference?.enable_email ?? false;
              const frequency = preference?.frequency ?? 'immediate';

              return (
                <div
                  key={category.value}
                  className='border rounded-lg p-4 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                >
                  <div className='flex items-start justify-between mb-4'>
                    <div className='flex-1'>
                      <h3 className='text-lg font-semibold text-gray-900 dark:text-slate-100'>
                        {category.label}
                      </h3>
                      <p className='text-sm text-gray-600 dark:text-slate-400 mt-1'>
                        {category.description}
                      </p>
                    </div>
                    {preference && (
                      <button
                        onClick={() => handleDeletePreference(category.value)}
                        className='p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors'
                        title='Reset to defaults'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    )}
                  </div>

                  <div className='space-y-4'>
                    {/* Website Notifications */}
                    <label className='flex items-center justify-between cursor-pointer group'>
                      <div className='flex items-center space-x-2'>
                        <Globe className='h-5 w-5 text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors' />
                        <span className='text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100 transition-colors'>
                          Website Notifications
                        </span>
                      </div>
                      <div className='relative inline-flex items-center'>
                        <input
                          type='checkbox'
                          checked={enableWebsite}
                          onChange={e =>
                            handleToggle(category.value, 'enable_website', e.target.checked)
                          }
                          className='sr-only peer'
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>

                    {/* Push Notifications */}
                    <label
                      className={`flex items-center justify-between ${
                        pushStatus === 'denied' || pushStatus === 'unsupported'
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer group'
                      }`}
                    >
                      <div className='flex items-center space-x-2'>
                        <Smartphone
                          className={`h-5 w-5 ${
                            pushStatus === 'denied' || pushStatus === 'unsupported'
                              ? 'text-gray-300 dark:text-slate-600'
                              : 'text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400'
                          } transition-colors`}
                        />
                        <span
                          className={`text-sm font-medium ${
                            pushStatus === 'denied' || pushStatus === 'unsupported'
                              ? 'text-gray-400 dark:text-slate-500'
                              : 'text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100'
                          } transition-colors`}
                        >
                          Push Notifications
                        </span>
                      </div>
                      <div className='relative inline-flex items-center'>
                        <input
                          type='checkbox'
                          checked={enablePush}
                          disabled={pushStatus === 'denied' || pushStatus === 'unsupported'}
                          onChange={e => {
                            const isTurningOn = e.target.checked;
                            if (isTurningOn && pushStatus !== 'granted') {
                              // If they try to turn it on but browser hasn't granted permission, prompt them
                              handleEnablePush().then(() => {
                                // We check the global Notification.permission after the prompt resolves
                                if (Notification.permission === 'granted') {
                                  handleToggle(category.value, 'enable_push', true);
                                }
                              });
                            } else {
                              handleToggle(category.value, 'enable_push', isTurningOn);
                            }
                          }}
                          className='sr-only peer'
                        />
                        <div
                          className={`w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                            pushStatus === 'denied' || pushStatus === 'unsupported'
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        ></div>
                      </div>
                    </label>

                    {/* Email Notifications */}
                    <label
                      className={`flex items-center justify-between ${
                        enableWebsite && !isSyntheticEmail
                          ? 'cursor-pointer group'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div className='flex items-center space-x-2'>
                        <Mail
                          className={`h-5 w-5 ${
                            enableWebsite && !isSyntheticEmail
                              ? 'text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400'
                              : 'text-gray-300 dark:text-slate-600'
                          } transition-colors`}
                        />
                        <span
                          className={`text-sm font-medium ${
                            enableWebsite && !isSyntheticEmail
                              ? 'text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100'
                              : 'text-gray-400 dark:text-slate-500'
                          } transition-colors`}
                        >
                          Email Notifications
                        </span>
                      </div>
                      <div className='relative inline-flex items-center'>
                        <input
                          type='checkbox'
                          checked={!isSyntheticEmail && enableEmail}
                          onChange={e =>
                            handleToggle(category.value, 'enable_email', e.target.checked)
                          }
                          className='sr-only peer'
                          disabled={!enableWebsite || isSyntheticEmail}
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>

                    {/* Frequency (only if email is enabled) */}
                    {enableEmail && (
                      <div className='flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700'>
                        <span className='text-sm font-medium text-gray-700 dark:text-slate-300'>
                          Frequency
                        </span>
                        <select
                          value={frequency}
                          onChange={e => handleFrequencyChange(category.value, e.target.value)}
                          className='border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-md px-3 py-1 text-sm'
                        >
                          {frequencies.map(freq => (
                            <option key={freq.value} value={freq.value}>
                              {freq.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Area Filter (future enhancement - placeholder) */}
                    {enableWebsite && category.value !== 'admin_alerts' && (
                      <div className='pt-2 border-t border-gray-200 dark:border-slate-700'>
                        <div className='flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400'>
                          <MapPin className='h-4 w-4' />
                          <span>Area filtering coming soon</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg'>
            <p className='text-sm text-blue-800 dark:text-blue-200'>
              <strong>Note:</strong> Email notifications require email configuration by an
              administrator. Website notifications appear in the notification bell and on the
              notifications page.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationPreferencesPage;
