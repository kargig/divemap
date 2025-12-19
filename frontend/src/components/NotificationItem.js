import { X, Check } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { useNotifications } from '../contexts/NotificationContext';

const NotificationItem = ({ notification, onDelete }) => {
  const { markRead, deleteNotification: deleteNotif } = useNotifications();
  const isUnread = !notification.is_read;

  const handleMarkRead = e => {
    e.preventDefault();
    e.stopPropagation();
    if (isUnread) {
      markRead(notification.id);
    }
  };

  const handleDelete = e => {
    e.preventDefault();
    e.stopPropagation();
    deleteNotif(notification.id);
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
        isUnread ? 'bg-blue-50' : 'bg-white'
      }`}
    >
      <div className='flex items-start justify-between'>
        <Link
          to={notification.link_url || '/notifications'}
          className='flex-1'
          onClick={handleMarkRead}
        >
          <div className='flex items-start'>
            {isUnread && (
              <div className='h-2 w-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0' />
            )}
            <div className='flex-1'>
              <h4 className='text-sm font-medium text-gray-900'>{notification.title}</h4>
              <p className='text-sm text-gray-600 mt-1'>{notification.message}</p>
              <div className='flex items-center mt-2 space-x-4'>
                <span className='text-xs text-gray-400'>{formatDate(notification.created_at)}</span>
                {notification.category && (
                  <span className='text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded'>
                    {notification.category.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>

        <div className='flex items-center space-x-2 ml-4'>
          {isUnread && (
            <button
              onClick={handleMarkRead}
              className='p-1 text-gray-400 hover:text-green-600 transition-colors'
              aria-label='Mark as read'
              title='Mark as read'
            >
              <Check className='h-4 w-4' />
            </button>
          )}
          <button
            onClick={handleDelete}
            className='p-1 text-gray-400 hover:text-red-600 transition-colors'
            aria-label='Delete notification'
            title='Delete notification'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
