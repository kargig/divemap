import { useQuery } from 'react-query';

import { getAuthConfig } from '../services/auth';

/**
 * Hook to fetch authentication providers configuration from backend
 * @param {object} options - React Query options
 * @returns {object} Query result with data, isLoading, error, etc.
 */
export const useAuthConfig = (options = {}) => {
  return useQuery('authConfig', getAuthConfig, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000,
    retry: 1,
    ...options,
  });
};
