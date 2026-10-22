import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import DiverCommunityGrid from './DiverCommunityGrid';

describe('DiverCommunityGrid', () => {
  it('renders visual metric tiles instead of a plain vertical list', () => {
    const mockProfile = {
      username: 'kargig',
      stats: {
        total_dives: 339,
        total_points: 4495,
        leaderboard_rank: 1,
        dives_created: 39,
        dive_sites_visited: 31,
        dive_sites_created: 153,
        dive_site_ratings: 55,
      },
      centers_owned: [{ id: 61, name: 'Amorgos Diving Center', slug: 'amorgos-diving-center' }],
    };

    render(
      <BrowserRouter>
        <DiverCommunityGrid profile={mockProfile} />
      </BrowserRouter>
    );

    expect(screen.getByText('339')).toBeInTheDocument();
    expect(screen.getByText('4,495')).toBeInTheDocument();
    expect(screen.getByText('Rank #1')).toBeInTheDocument();
    expect(screen.getByText('Sites Visited')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('Sites Contributed')).toBeInTheDocument();
    expect(screen.getByText('153')).toBeInTheDocument();
  });

  it('renders nothing when profile is null', () => {
    const { container } = render(
      <BrowserRouter>
        <DiverCommunityGrid profile={null} />
      </BrowserRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
