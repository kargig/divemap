import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Dives from './Dives';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'tester', is_admin: false },
    isAuthenticated: true,
  }),
}));

vi.mock('../services/dives', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    getUserDives: vi.fn(),
    deleteDive: vi.fn(),
  };
});

vi.mock('../services/diveSites', () => ({
  getUniqueCountries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../components/SEO', () => ({
  default: () => null,
}));

describe('Dives - Unlinked Site Indicator (3A)', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dives />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders unlinked site badge and link button when dive_site_id is null and unlinked_site_name is present', async () => {
    const apiModule = (await import('../api')).default;
    apiModule.get.mockImplementation(url => {
      if (url.includes('/api/v1/dives/')) {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 101,
                user_id: 1,
                name: 'Dive #101',
                dive_date: '2026-10-12',
                duration: 45,
                max_depth: 22.0,
                dive_site_id: null,
                dive_site: null,
                unlinked_site_name: 'Cathedral Rock',
                is_private: false,
              },
            ],
            total: 1,
            page: 1,
            size: 50,
            has_next_page: false,
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderComponent();

    // Site name from unlinked_site_name
    expect(await screen.findByText(/@ Cathedral Rock/i)).toBeInTheDocument();

    // Option 3A badge
    expect(screen.getByText('Unlinked Site')).toBeInTheDocument();

    // One-click Link Site button
    const linkBtn = screen.getByRole('button', { name: /link site/i });
    expect(linkBtn).toBeInTheDocument();
  });
});
