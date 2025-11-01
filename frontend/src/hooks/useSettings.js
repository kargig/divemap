import { useQuery, useMutation, useQueryClient } from 'react-query';

import { getSetting, updateSetting } from '../api';

/**
 * Hook to fetch a setting value by key
 * @param {string} key - Setting key (e.g., 'disable_diving_center_reviews')
 * @param {object} options - React Query options
 * @returns {object} Query result with data, isLoading, error, etc.
 */
export const useSetting = (key, options = {}) => {
  return useQuery(['setting', key], () => getSetting(key), {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (settings don't change often)
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook to update a setting value (admin-only)
 * @returns {object} Mutation object with mutate function, isLoading, error, etc.
 */
export const useUpdateSetting = () => {
  const queryClient = useQueryClient();

  return useMutation(({ key, value }) => updateSetting(key, value), {
    onSuccess: (data, variables) => {
      // Invalidate and update the specific setting query
      queryClient.invalidateQueries(['setting', variables.key]);

      // Also invalidate all settings list if it exists
      queryClient.invalidateQueries(['settings']);
    },
    onError: error => {
      console.error('Failed to update setting:', error);
    },
  });
};
