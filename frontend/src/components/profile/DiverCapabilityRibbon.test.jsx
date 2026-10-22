import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import DiverCapabilityRibbon from './DiverCapabilityRibbon';

describe('DiverCapabilityRibbon', () => {
  it('renders all capability indicators clearly without artificial diver titles', () => {
    const mockProfile = {
      certification_stats: {
        max_depth_str: '45m',
        best_gases: ['EAN100'],
        largest_tanks: ['Doubles'],
        max_stages: 1,
        max_deco_time: '25 min',
      },
      diving_stats: {
        max_depth: 62.0,
        gear_preferences: { suits: { Drysuit: 5, Wetsuit: 5 } },
      },
      stats: { total_dives: 120 },
      member_since: '2024-01-01',
    };

    render(<DiverCapabilityRibbon profile={mockProfile} />);
    expect(screen.getByText('Max Cert Depth')).toBeInTheDocument();
    expect(screen.getByText('45m')).toBeInTheDocument();
    expect(screen.getByText('62.0m')).toBeInTheDocument();
    expect(screen.getByText('Deco: 25 min')).toBeInTheDocument();
    expect(screen.getByText('Doubles + 1 Stg')).toBeInTheDocument();
    expect(screen.getByText(/Drysuit & Wetsuit/i)).toBeInTheDocument();
  });

  it('renders nothing when profile is null', () => {
    const { container } = render(<DiverCapabilityRibbon profile={null} />);
    expect(container.firstChild).toBeNull();
  });
});
