import { Bell, Check, Filter, Settings } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getNotifications } from '../api';
import LoadingSkeleton from '../components/LoadingSkeleton';
import NotificationItem from '../components/NotificationItem';
import { useNotificationContext, useNotifications } from '../contexts/NotificationContext';
import usePageTitle from '../hooks/usePageTitle';

const Notifications = () => {
  usePageTitle('Divemap - Notifications');
  const { handleNotificationsViewed } = useNotificationContext();
  const { markAllRead } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Build query params
  const queryParams = {
    page,
    page_size: pageSize,
    ...(filter === 'unread' && { is_read: false }),
    ...(filter === 'read' && { is_read: true }),
    ...(categoryFilter && { category: categoryFilter }),
  };

  const {
    data: notifications = [],
    isLoading,
    error,
    refetch,
  } = useQuery(['notifications', 'list', queryParams], () => getNotifications(queryParams), {
    keepPreviousData: true,
    refetchOnMount: true, // Always fetch fresh data when page is visited
    staleTime: 0, // Always consider stale to ensure fresh data
  });

  // Update last check and refetch notifications when page is viewed
  useEffect(() => {
    handleNotificationsViewed();
    refetch(); // Ensure fresh data when visiting the page
  }, [handleNotificationsViewed, refetch]);

  // Get pagination info from headers (if available)
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Note: We'd need to modify the API to return pagination in response body
    // For now, we'll use a simple approach
    if (notifications.length < pageSize) {
      setTotalPages(page);
    } else {
      setTotalPages(page + 1); // Estimate
    }
  }, [notifications, pageSize]);

  const handleMarkAllRead = async () => {
    try {
      markAllRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'new_dive_sites', label: 'New Dive Sites' },
    { value: 'new_dives', label: 'New Dives' },
    { value: 'new_diving_centers', label: 'New Diving Centers' },
    { value: 'new_dive_trips', label: 'New Dive Trips' },
    { value: 'admin_alerts', label: 'Admin Alerts' },
  ];

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
            <p className='text-red-800'>Error loading notifications. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-4xl mx-auto px-4'>
        {/* Header */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center space-x-3'>
              <Bell className='h-6 w-6 text-blue-600' />
              <h1 className='text-2xl font-bold text-gray-900'>Notifications</h1>
            </div>
            <div className='flex items-center space-x-3'>
              <Link
                to='/notifications/preferences'
                className='flex items-center space-x-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors'
              >
                <Settings className='h-4 w-4' />
                <span>Preferences</span>
              </Link>
              <button
                onClick={handleMarkAllRead}
                className='flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              >
                <Check className='h-4 w-4' />
                <span>Mark All Read</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className='flex flex-wrap gap-4'>
            <div className='flex items-center space-x-2'>
              <Filter className='h-4 w-4 text-gray-500' />
              <select
                value={filter}
                onChange={e => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                className='border border-gray-300 rounded-md px-3 py-2 text-sm'
              >
                <option value='all'>All</option>
                <option value='unread'>Unread</option>
                <option value='read'>Read</option>
              </select>
            </div>

            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className='border border-gray-300 rounded-md px-3 py-2 text-sm'
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notifications List */}
        <div className='bg-white rounded-lg shadow-md overflow-hidden'>
          {isLoading ? (
            <div className='p-4'>
              <LoadingSkeleton count={5} />
            </div>
          ) : notifications.length > 0 ? (
            <>
              <div className='divide-y divide-gray-200'>
                {notifications.map(notification => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>

              {/* Pagination */}
              <div className='px-4 py-4 border-t border-gray-200 flex items-center justify-between'>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className='px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                >
                  Previous
                </button>
                <span className='text-sm text-gray-600'>
                  Page {page} {totalPages > 1 && `of ${totalPages}`}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={notifications.length < pageSize}
                  className='px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className='p-12 text-center'>
              <Bell className='h-16 w-16 mx-auto mb-4 text-gray-300' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>No notifications</h3>
              <p className='text-gray-500'>
                {filter === 'unread'
                  ? "You're all caught up! No unread notifications."
                  : 'You have no notifications yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
