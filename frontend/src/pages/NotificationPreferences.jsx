/* global Notification */
import { Mail, Globe, MapPin, Trash2, ArrowLeft, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import { useNotifications } from '../hooks/useNotifications';
import usePageTitle from '../hooks/usePageTitle';
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
  usePageTitle('Divemap - Notification Preferences');
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
    const preference = getPreference(category);
    if (preference) {
      // Update existing preference
      updatePreference({
        category,
        data: { [field]: value },
      });
    } else {
      // Create new preference
      const defaultData = {
        category,
        enable_website: category === 'admin_alerts' ? false : true,
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
      createPreference({
        category,
        enable_website: true,
        enable_email: false,
        frequency,
      });
    }
  };

  const handleDeletePreference = category => {
    if (window.confirm('Are you sure you want to delete this preference?')) {
      deletePreference(category);
    }
  };

  if (isLoading) {
    return (
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        <div className='mb-6'>
          <Link
            to='/profile'
            className='inline-flex items-center text-blue-600 hover:text-blue-700 mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Profile
          </Link>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>Notification Preferences</h1>
        </div>
        <div className='bg-white rounded-lg shadow-md p-6'>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='mb-6'>
        <Link
          to='/profile'
          className='inline-flex items-center text-blue-600 hover:text-blue-700 mb-4'
        >
          <ArrowLeft className='h-4 w-4 mr-2' />
          Back to Profile
        </Link>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Notification Preferences</h1>
        <p className='text-gray-600'>
          Configure how you want to receive notifications for different types of updates.
        </p>
      </div>

      <div className='bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 border-blue-600'>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <div className='flex items-center space-x-2 mb-2'>
              <Smartphone className='h-6 w-6 text-blue-600' />
              <h2 className='text-xl font-bold text-gray-900'>Device Push Notifications</h2>
            </div>
            <p className='text-gray-600 max-w-2xl'>
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
              <div className='flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium'>
                <div className='h-2 w-2 bg-green-500 rounded-full animate-pulse'></div>
                <span>Active on this Device</span>
              </div>
            )}

            {pushStatus === 'denied' && (
              <div className='px-4 py-2 bg-red-50 text-red-700 rounded-full border border-red-200 font-medium'>
                Notifications Blocked in Browser
              </div>
            )}

            {pushStatus === 'unsupported' && (
              <div className='text-sm text-gray-400 italic'>
                Not supported by this browser or device
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-md p-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {categories.map(category => {
            const preference = getPreference(category.value);
            // Default website notification should be true for 'system', 'new_dive_sites', 'new_dive_trips', 'admin_alerts'
            const isDefaultEnabled = [
              'system',
              'new_dive_sites',
              'new_dive_trips',
              'admin_alerts',
            ].includes(category.value);

            // Only use preference values if preference exists, otherwise show as not configured (or default)
            const enableWebsite = preference?.enable_website ?? isDefaultEnabled;
            const enableEmail = preference?.enable_email ?? false;
            const frequency = preference?.frequency ?? 'immediate';

            return (
              <div
                key={category.value}
                className={`border rounded-lg p-4 ${
                  preference || isDefaultEnabled
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className='flex items-start justify-between mb-4'>
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-gray-900'>{category.label}</h3>
                    <p className='text-sm text-gray-600 mt-1'>{category.description}</p>
                  </div>
                  {preference && (
                    <button
                      onClick={() => handleDeletePreference(category.value)}
                      className='p-1 text-gray-400 hover:text-red-600 transition-colors'
                      title='Delete preference'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  )}
                </div>

                {preference ? (
                  <div className='space-y-4'>
                    {/* Website Notifications */}
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-2'>
                        <Globe className='h-5 w-5 text-gray-500' />
                        <span className='text-sm font-medium text-gray-700'>
                          Website Notifications
                        </span>
                      </div>
                      <label className='relative inline-flex items-center cursor-pointer'>
                        <input
                          type='checkbox'
                          checked={enableWebsite}
                          onChange={e =>
                            handleToggle(category.value, 'enable_website', e.target.checked)
                          }
                          className='sr-only peer'
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Email Notifications */}
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-2'>
                        <Mail className='h-5 w-5 text-gray-500' />
                        <span className='text-sm font-medium text-gray-700'>
                          Email Notifications
                        </span>
                      </div>
                      <label className='relative inline-flex items-center cursor-pointer'>
                        <input
                          type='checkbox'
                          checked={enableEmail}
                          onChange={e =>
                            handleToggle(category.value, 'enable_email', e.target.checked)
                          }
                          className='sr-only peer'
                          disabled={!enableWebsite}
                        />
                        <div
                          className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${!enableWebsite ? 'opacity-50 cursor-not-allowed' : ''}`}
                        ></div>
                      </label>
                    </div>

                    {/* Frequency (only if email is enabled) */}
                    {enableEmail && (
                      <div className='flex items-center justify-between pt-2 border-t border-gray-200'>
                        <span className='text-sm font-medium text-gray-700'>Frequency</span>
                        <select
                          value={frequency}
                          onChange={e => handleFrequencyChange(category.value, e.target.value)}
                          className='border border-gray-300 rounded-md px-3 py-1 text-sm'
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
                      <div className='pt-2 border-t border-gray-200'>
                        <div className='flex items-center space-x-2 text-sm text-gray-600'>
                          <MapPin className='h-4 w-4' />
                          <span>Area filtering coming soon</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='space-y-4'>
                    <p className='text-sm text-gray-500 italic mb-4'>No preference configured</p>
                    <button
                      onClick={() => {
                        // Create preference with sensible defaults
                        const defaultData = {
                          category: category.value,
                          enable_website: category.value !== 'admin_alerts',
                          enable_email: false,
                          frequency: 'immediate',
                        };
                        createPreference(defaultData);
                      }}
                      className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm'
                    >
                      <span>Create Preference</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className='mt-6 p-4 bg-blue-50 rounded-lg'>
          <p className='text-sm text-blue-800'>
            <strong>Note:</strong> Email notifications require email configuration by an
            administrator. Website notifications appear in the notification bell and on the
            notifications page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesPage;
