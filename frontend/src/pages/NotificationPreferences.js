import { Mail, Globe, MapPin, Trash2, ArrowLeft } from 'lucide-react';
import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getNotificationPreferences } from '../api';
import { useNotifications } from '../contexts/NotificationContext';
import usePageTitle from '../hooks/usePageTitle';

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
      <div className='max-w-4xl mx-auto'>
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
    <div className='max-w-4xl mx-auto'>
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

      <div className='bg-white rounded-lg shadow-md p-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {categories.map(category => {
            const preference = getPreference(category.value);
            // Only use preference values if preference exists, otherwise show as not configured
            const enableWebsite = preference?.enable_website ?? false;
            const enableEmail = preference?.enable_email ?? false;
            const frequency = preference?.frequency ?? 'immediate';

            return (
              <div
                key={category.value}
                className={`border rounded-lg p-4 ${
                  preference ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
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
