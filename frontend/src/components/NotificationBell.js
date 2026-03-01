import { Bell, Check, ExternalLink, Loader2 } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import useClickOutside from '../hooks/useClickOutside';
import { useNotifications } from '../hooks/useNotifications';
import { getNotifications } from '../services/notifications';

const NotificationBell = () => {
  const { unreadCount, markRead } = useNotifications();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch recent notifications for dropdown
  const { data: recentNotifications = [], isLoading } = useQuery(
    ['notifications', 'recent'],
    () => getNotifications({ page: 1, page_size: 5 }),
    {
      enabled: showDropdown,
      staleTime: 0,
    }
  );

  const handleMarkRead = (e, notificationId) => {
    e.preventDefault();
    e.stopPropagation();
    markRead(notificationId);
    // Invalidate recent notifications query to refresh the dropdown
    queryClient.invalidateQueries(['notifications', 'recent']);
  };

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => setShowDropdown(false), showDropdown);

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleViewAll = () => {
    setShowDropdown(false);
    navigate('/notifications');
  };

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className='relative flex items-center justify-center p-2 text-white hover:text-blue-200 transition-colors'
        aria-label='Notifications'
        title='Notifications'
      >
        <Bell className='h-5 w-5' />
        {unreadCount > 0 && (
          <span className='absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center min-w-[1rem] border-2 border-blue-800 translate-x-1/4 -translate-y-1/4'>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className='fixed left-2 right-2 top-16 mt-2 w-auto sm:absolute sm:right-0 sm:top-full sm:left-auto sm:w-80 bg-white rounded-xl shadow-2xl z-[9999] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 max-h-[70vh] sm:max-h-96 flex flex-col overflow-hidden'>
          {/* Header */}
          <div className='p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'>
            <div className='flex items-center justify-between'>
              <h3
                className='text-lg font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors'
                onClick={handleViewAll}
              >
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className='px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full uppercase tracking-wider'>
                  {unreadCount} New
                </span>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className='flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50'>
            {isLoading ? (
              <div className='p-8 flex justify-center'>
                <Loader2 className='h-6 w-6 text-blue-500 animate-spin' />
              </div>
            ) : recentNotifications.length > 0 ? (
              recentNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`group relative p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <Link
                      to={notification.link_url || '/notifications'}
                      onClick={() => setShowDropdown(false)}
                      className='flex-1 min-w-0'
                    >
                      <div className='flex items-start'>
                        <div className='flex-1 min-w-0'>
                          <h4
                            className={`text-sm truncate ${!notification.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}
                          >
                            {notification.title}
                          </h4>
                          <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2'>
                            {notification.message}
                          </p>
                          <p className='text-[10px] text-gray-400 mt-1 uppercase tracking-tight'>
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className='ml-2 h-2.5 w-2.5 bg-blue-600 rounded-full border-2 border-white dark:border-gray-800 flex-shrink-0 mt-1' />
                        )}
                      </div>
                    </Link>
                    {!notification.is_read && (
                      <button
                        onClick={e => handleMarkRead(e, notification.id)}
                        className='ml-2 p-1.5 text-gray-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600'
                        aria-label='Mark as read'
                        title='Mark as read'
                      >
                        <Check className='h-3.5 w-3.5' />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className='p-8 text-center text-gray-400'>
                <Bell className='h-10 w-10 mx-auto mb-2 opacity-20' />
                <p className='text-sm italic'>No new notifications</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className='p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700'>
            <button
              onClick={handleViewAll}
              className='w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors'
            >
              View All Notifications
              <ExternalLink className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
