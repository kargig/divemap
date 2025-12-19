import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import { getUnreadCount, getNewSinceLastCheck, updateLastCheck } from '../api';

import { useAuth } from './AuthContext';

// Re-export useNotifications hook for convenience
export { useNotifications } from '../hooks/useNotifications';

const NotificationContext = createContext();

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [newNotifications, setNewNotifications] = useState([]);
  const [hasCheckedOnLogin, setHasCheckedOnLogin] = useState(false);

  // Fetch unread count with polling
  const { data: unreadCountData } = useQuery(['notifications', 'unread-count'], getUnreadCount, {
    enabled: !!user,
    refetchInterval: 300000, // Poll every 5 minutes
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const unreadCount = unreadCountData?.unread_count || 0;

  // Fetch new notifications on login
  useEffect(() => {
    if (user && !hasCheckedOnLogin) {
      const fetchNewNotifications = async () => {
        try {
          const notifications = await getNewSinceLastCheck();
          if (notifications && notifications.length > 0) {
            setNewNotifications(notifications);
            // Show toast notification
            toast.success(
              `You have ${notifications.length} new notification${notifications.length > 1 ? 's' : ''}`,
              {
                duration: 5000,
              }
            );
          }
          setHasCheckedOnLogin(true);
        } catch (error) {
          console.error('Error fetching new notifications:', error);
          setHasCheckedOnLogin(true);
        }
      };

      fetchNewNotifications();
    } else if (!user) {
      // Reset when user logs out
      setHasCheckedOnLogin(false);
      setNewNotifications([]);
    }
  }, [user, hasCheckedOnLogin]);

  // Update last check when user views notifications page
  const handleNotificationsViewed = useCallback(async () => {
    if (user) {
      try {
        await updateLastCheck();
        setNewNotifications([]);
      } catch (error) {
        console.error('Error updating last check:', error);
      }
    }
  }, [user]);

  const value = {
    unreadCount,
    newNotifications,
    hasCheckedOnLogin,
    handleNotificationsViewed,
    clearNewNotifications: () => setNewNotifications([]),
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
