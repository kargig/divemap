import { render, screen } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import * as api from '../api';
import * as AuthContext from '../contexts/AuthContext';

import UserProfile from './UserProfile';

vi.mock('../contexts/AuthContext');
vi.mock('../api');

describe('UserProfile Component', () => {
  const mockProfile = {
    id: 6,
    username: 'kargig',
    is_admin: true,
    number_of_dives: 300,
    member_since: '2025-08-06T22:13:49',
    certifications: [
      {
        id: 1,
        certification_level: 'Extended Range',
        is_active: true,
        diving_organization: { name: 'SSI', acronym: 'SSI' },
        certification_level_link: { max_depth: '45m' },
      },
    ],
    stats: {
      total_dives: 339,
      total_points: 4495,
      leaderboard_rank: 1,
      dives_created: 39,
      dive_sites_visited: 31,
      dive_sites_created: 153,
      dive_site_ratings: 55,
      unique_dive_sites_logged: 31,
      countries_visited_count: 3,
    },
    certification_stats: {
      max_depth_str: '45m',
      best_gases: ['Nitrox 100%'],
      largest_tanks: ['Double + 1 Stg'],
      max_deco_time: '25 min',
    },
    diving_stats: {
      max_depth: 62.0,
      longest_dive_minutes: 105,
      total_bottom_time_minutes: 2313,
      suit_preferences: { dry_suit: 9, wet_suit: 8 },
      favorite_sites: [],
    },
    centers_owned: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    AuthContext.useAuth.mockReturnValue({ user: null });
    api.getUserPublicProfile.mockResolvedValue(mockProfile);
    api.getUserPublicLists.mockResolvedValue([]);
  });

  it('renders the Capability Ribbon and Disambiguated metrics', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/users/kargig']}>
          <Routes>
            <Route path='/users/:username' element={<UserProfile />} />
            <Route path='/users/:username/:tab' element={<UserProfile />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(await screen.findByText('kargig')).toBeInTheDocument();
    expect(screen.getByText('Max Cert Depth')).toBeInTheDocument();
    expect(screen.getByText('Deepest Logged Dive')).toBeInTheDocument();
    expect(screen.getAllByText('45m').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('62.0m').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile tabs and supports direct deep-linked tabs', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/users/kargig/certifications']}>
          <Routes>
            <Route path='/users/:username' element={<UserProfile />} />
            <Route path='/users/:username/:tab' element={<UserProfile />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(await screen.findByText('kargig')).toBeInTheDocument();
    // In certifications tab, cert items are rendered
    expect(screen.getByText(/SSI - Extended Range/i)).toBeInTheDocument();
  });
});
