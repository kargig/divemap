import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import { getUnreadCount, getNewSinceLastCheck, updateLastCheck } from '../services/notifications';

import { useAuth } from './AuthContext';

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
  // Use sessionStorage to persist across page refreshes in the same session
  const [hasCheckedOnLogin, setHasCheckedOnLogin] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('notifications_checked') === 'true';
    }
    return false;
  });
  // Use ref to prevent multiple toasts even if effect runs multiple times (React StrictMode)
  const toastShownRef = useRef(false);

  // Fetch unread count with polling
  const { data: unreadCountData } = useQuery(['notifications', 'unread-count'], getUnreadCount, {
    enabled: !!user,
    refetchInterval: 300000, // Poll every 5 minutes
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const unreadCount = unreadCountData?.unread_count || 0;

  // Fetch new notifications on login (only once per session)
  useEffect(() => {
    let isMounted = true;

    if (user && !hasCheckedOnLogin && !toastShownRef.current) {
      const fetchNewNotifications = async () => {
        try {
          const notifications = await getNewSinceLastCheck();
          if (isMounted && notifications && notifications.length > 0) {
            setNewNotifications(notifications);
            // Show toast notification only once (use ref to prevent duplicates)
            if (!toastShownRef.current) {
              toastShownRef.current = true;
              toast.success(
                `You have ${notifications.length} new notification${notifications.length > 1 ? 's' : ''}`,
                {
                  duration: 5000,
                }
              );
              // Update last check immediately to prevent showing toast again on refresh
              try {
                await updateLastCheck();
              } catch (updateError) {
                console.error('Error updating last check:', updateError);
              }
            }
          }
          if (isMounted) {
            setHasCheckedOnLogin(true);
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem('notifications_checked', 'true');
            }
          }
        } catch (error) {
          console.error('Error fetching new notifications:', error);
          if (isMounted) {
            setHasCheckedOnLogin(true);
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem('notifications_checked', 'true');
            }
          }
        }
      };

      fetchNewNotifications();
    } else if (!user) {
      // Reset when user logs out
      setHasCheckedOnLogin(false);
      setNewNotifications([]);
      toastShownRef.current = false;
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('notifications_checked');
      }
    }

    return () => {
      isMounted = false;
    };
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
