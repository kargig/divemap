import { X, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useNotifications } from '../hooks/useNotifications';
import { formatTimeAgo } from '../utils/dateHelpers';

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
      className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-interactive-hover dark:hover:bg-interactive-hover-dark transition-colors ${
        isUnread ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-900'
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
              <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
                {notification.title}
              </h4>
              <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                {notification.message}
              </p>
              <div className='flex items-center mt-2 space-x-4'>
                <span
                  className='text-xs text-gray-400 dark:text-gray-500 cursor-help'
                  title={formatExactDateTime(notification.created_at)}
                >
                  {formatTimeAgo(notification.created_at)}
                </span>
                {notification.category && (
                  <span className='text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded'>
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
              className='p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors'
              aria-label='Mark as read'
              title='Mark as read'
            >
              <Check className='h-4 w-4' />
            </button>
          )}
          <button
            onClick={handleDelete}
            className='p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors'
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
