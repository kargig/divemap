import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as authService from '../services/auth';

import { useAuthConfig } from './useAuthConfig';

vi.mock('../services/auth', () => ({
  getAuthConfig: vi.fn(),
}));

describe('useAuthConfig', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches and returns auth config successfully', async () => {
    const mockConfig = {
      google: { enabled: true, client_id: 'mock-google-id' },
      facebook: { enabled: false, app_id: null },
    };
    authService.getAuthConfig.mockResolvedValueOnce(mockConfig);

    const { result } = renderHook(() => useAuthConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockConfig);
    expect(authService.getAuthConfig).toHaveBeenCalledTimes(1);
  });
});
