import { Bell } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { getNotifications } from '../api';
import { useNotificationContext } from '../contexts/NotificationContext';

const NotificationBell = () => {
  const { unreadCount } = useNotificationContext();
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
        <div className='absolute right-0 top-full mt-2 w-80 bg-white rounded-md shadow-xl z-[9999] border-2 border-gray-300 max-h-96 overflow-y-auto'>
          <div className='p-4 border-b border-gray-200'>
            <div className='flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-gray-900'>Notifications</h3>
              {unreadCount > 0 && (
                <span className='text-sm text-gray-500'>{unreadCount} unread</span>
              )}
            </div>
          </div>

          <div className='divide-y divide-gray-200'>
            {recentNotifications.length > 0 ? (
              recentNotifications.map(notification => (
                <Link
                  key={notification.id}
                  to={notification.link_url || '/notifications'}
                  onClick={() => setShowDropdown(false)}
                  className={`block p-4 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <h4 className='text-sm font-medium text-gray-900'>{notification.title}</h4>
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
