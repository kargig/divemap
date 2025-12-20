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
    if (!dateString) return 'Unknown';

    // JavaScript Date automatically parses UTC ISO strings (e.g., "2025-12-20T10:44:09.373Z")
    // and converts them to the browser's local timezone for display
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date string:', dateString);
      return 'Invalid date';
    }

    // Get current time and calculate difference in milliseconds
    // Both dates are converted to milliseconds since epoch, which is timezone-independent
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle edge case: if date is in the future (shouldn't happen)
    if (diffMs < 0) return 'Just now';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // For longer periods, show localized date (browser's timezone)
    return date.toLocaleDateString();
  };

  const formatExactDateTime = dateString => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Format as: "December 20, 2025 at 10:44:09" (24-hour format, in browser's local timezone)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
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
                <span
                  className='text-xs text-gray-400 cursor-help'
                  title={formatExactDateTime(notification.created_at)}
                >
                  {formatDate(notification.created_at)}
                </span>
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
