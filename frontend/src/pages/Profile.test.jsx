import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import * as api from '../api';
import * as AuthContext from '../contexts/AuthContext';
import * as useAuthConfigModule from '../hooks/useAuthConfig';

import Profile from './Profile';

vi.mock('../contexts/AuthContext');
vi.mock('../hooks/useAuthConfig');
vi.mock('../api');

describe('Profile Account Hub', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const mockUser = {
    id: 6,
    username: 'kargig',
    email: 'kargig@example.com',
    is_admin: true,
    created_at: '2025-08-06T22:13:49',
    social_links: [],
    buddy_visibility: 'public',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    AuthContext.useAuth.mockReturnValue({
      user: mockUser,
      updateUser: vi.fn(),
      logout: vi.fn(),
    });
    useAuthConfigModule.useAuthConfig.mockReturnValue({
      data: { facebook: { enabled: false } },
    });
    api.getMyLists.mockResolvedValue([]);
    api.getUserPublicProfile.mockResolvedValue({
      id: 6,
      username: 'kargig',
      stats: { total_dives: 339 },
      diving_stats: { favorite_sites: [] },
      certifications: [],
    });
  });

  it('renders View Public Profile button and 4 Account Hub tabs', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter initialEntries={['/profile/account']}>
            <Routes>
              <Route path='/profile' element={<Profile />} />
              <Route path='/profile/:tab' element={<Profile />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('View Public Profile')).toBeInTheDocument();
    expect(screen.getByText('Account & Security')).toBeInTheDocument();
    expect(screen.getByText('Certifications & Lists')).toBeInTheDocument();
    expect(screen.getByText('Gear, Bookings & Medical')).toBeInTheDocument();
    expect(screen.getByText('Preferences & API')).toBeInTheDocument();
  });

  it('renders operations launcher cards when /profile/operations is active', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter initialEntries={['/profile/operations']}>
            <Routes>
              <Route path='/profile' element={<Profile />} />
              <Route path='/profile/:tab' element={<Profile />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Diving Gear Configurations')).toBeInTheDocument();
    expect(screen.getByText('My Dive Bookings')).toBeInTheDocument();
    expect(screen.getByText('Medical Self-Declaration (DMSC 2020)')).toBeInTheDocument();
  });

  it('renders Card ID and Issue Date inputs when Add Certification is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter initialEntries={['/profile/credentials']}>
            <Routes>
              <Route path='/profile' element={<Profile />} />
              <Route path='/profile/:tab' element={<Profile />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );

    const addBtn = await screen.findByRole('button', { name: /Add Certification/i });
    fireEvent.click(addBtn);

    expect(await screen.findByLabelText(/Card ID \/ Certification Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Certification \/ Issue Date/i)).toBeInTheDocument();
  });
});
