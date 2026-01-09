import { Bell, Check } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { getNotifications } from '../api';
import { useNotificationContext, useNotifications } from '../contexts/NotificationContext';

const NotificationBell = () => {
  const { unreadCount } = useNotificationContext();
  const { markRead } = useNotifications();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch recent notifications for dropdown
  const { data: recentNotifications = [] } = useQuery(
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
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          setShowDropdown(false);
        }
      });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

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
      >
        <Bell className='h-5 w-5' />
        {unreadCount > 0 && (
          <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[1.25rem]'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className='fixed left-2 right-2 top-16 mt-2 w-auto sm:absolute sm:right-0 sm:top-full sm:left-auto sm:w-80 bg-white rounded-md shadow-xl z-[9999] border-2 border-gray-300 max-h-[70vh] sm:max-h-96 overflow-y-auto'>
          <div className='p-4 border-b border-gray-200'>
            <div className='flex items-center justify-between'>
              <Link
                to='/notifications'
                onClick={() => setShowDropdown(false)}
                className='text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer underline-offset-2 hover:underline'
              >
                Notifications
              </Link>
              {unreadCount > 0 && (
                <span className='text-sm text-gray-500'>{unreadCount} unread</span>
              )}
            </div>
          </div>

          <div className='divide-y divide-gray-200'>
            {recentNotifications.length > 0 ? (
              recentNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`group relative p-4 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <Link
                      to={notification.link_url || '/notifications'}
                      onClick={() => setShowDropdown(false)}
                      className='flex-1'
                    >
                      <div className='flex items-start'>
                        <div className='flex-1'>
                          <h4 className='text-sm font-medium text-gray-900'>
                            {notification.title}
                          </h4>
                          <p className='text-sm text-gray-600 mt-1 line-clamp-2'>
                            {notification.message}
                          </p>
                          <p className='text-xs text-gray-400 mt-2'>
                            {new Date(notification.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className='ml-2 h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1' />
                        )}
                      </div>
                    </Link>
                    {!notification.is_read && (
                      <button
                        onClick={e => handleMarkRead(e, notification.id)}
                        className='ml-2 p-1.5 text-gray-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0'
                        aria-label='Mark as read'
                        title='Mark as read'
                      >
                        <Check className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className='p-8 text-center text-gray-500'>
                <Bell className='h-12 w-12 mx-auto mb-2 text-gray-300' />
                <p>No notifications</p>
              </div>
            )}
          </div>

          {recentNotifications.length > 0 && (
            <div className='p-4 border-t border-gray-200'>
              <button
                onClick={handleViewAll}
                className='w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium'
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
