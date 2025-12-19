import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import {
  getNotifications,
  getUnreadCount,
  getNewSinceLastCheck,
  markNotificationRead,
  markAllRead,
  updateLastCheck,
  deleteNotification,
  getNotificationPreferences,
  createNotificationPreference,
  updateNotificationPreference,
  deleteNotificationPreference,
} from '../api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing notifications with polling
 * Polls unread count every 5 minutes when user is logged in
 */
export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef(null);

  // Fetch unread count with polling
  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery(
    ['notifications', 'unread-count'],
    getUnreadCount,
    {
      enabled: !!user, // Only fetch when user is logged in
      refetchInterval: 300000, // Poll every 5 minutes
      refetchIntervalInBackground: true, // Continue polling when tab is in background
      staleTime: 0, // Always consider stale to ensure fresh data
    }
  );

  const unreadCount = unreadCountData?.unread_count || 0;

  // Mark notification as read
  const markReadMutation = useMutation(markNotificationRead, {
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['notifications', 'unread-count']);
      queryClient.invalidateQueries(['notifications', 'list']);
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation(markAllRead, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', 'unread-count']);
      queryClient.invalidateQueries(['notifications', 'list']);
      queryClient.invalidateQueries(['notifications', 'new-since-last-check']);
    },
  });

  // Update last check timestamp
  const updateLastCheckMutation = useMutation(updateLastCheck, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', 'new-since-last-check']);
    },
  });

  // Delete notification
  const deleteMutation = useMutation(deleteNotification, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', 'unread-count']);
      queryClient.invalidateQueries(['notifications', 'list']);
    },
  });

  // Create notification preference
  const createPreferenceMutation = useMutation(createNotificationPreference, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', 'preferences']);
    },
  });

  // Update notification preference
  const updatePreferenceMutation = useMutation(
    ({ category, data }) => updateNotificationPreference(category, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['notifications', 'preferences']);
      },
    }
  );

  // Delete notification preference
  const deletePreferenceMutation = useMutation(deleteNotificationPreference, {
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', 'preferences']);
    },
  });

  // Stop polling when user logs out
  useEffect(() => {
    if (!user && pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [user]);

  return {
    unreadCount,
    refetchUnreadCount,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    updateLastCheck: updateLastCheckMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    createPreference: createPreferenceMutation.mutate,
    updatePreference: updatePreferenceMutation.mutate,
    deletePreference: deletePreferenceMutation.mutate,
    isLoadingMarkRead: markReadMutation.isLoading,
    isLoadingMarkAllRead: markAllReadMutation.isLoading,
    isLoadingDelete: deleteMutation.isLoading,
    isLoadingPreference:
      createPreferenceMutation.isLoading ||
      updatePreferenceMutation.isLoading ||
      deletePreferenceMutation.isLoading,
  };
};
