import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import DiveSiteSpecsCard from '../DiveSiteSpecsCard';

describe('DiveSiteSpecsCard', () => {
  const mockDiveSite = {
    id: 158,
    name: 'Agios Onoufrios Tunnel',
    max_depth: 22,
    difficulty: 2,
    latitude: 35.5505634,
    longitude: 24.0695514,
    created_at: '2025-10-26T06:41:20',
    tags: [
      { id: 4, name: 'Boat Dive' },
      { id: 19, name: 'Cavern' },
    ],
  };

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it('renders technical specifications properly', () => {
    render(<DiveSiteSpecsCard diveSite={mockDiveSite} />);

    expect(screen.getByText('Dive Site Specs')).toBeInTheDocument();
    expect(screen.getByText('22m')).toBeInTheDocument();
    expect(screen.getByText('Boat Dive')).toBeInTheDocument();
    expect(screen.getByText(/35\.5506° N/i)).toBeInTheDocument();
  });

  it('copies coordinates when copy button is clicked', async () => {
    render(<DiveSiteSpecsCard diveSite={mockDiveSite} />);

    const copyBtn = screen.getByRole('button', { name: /copy coordinates/i });
    expect(copyBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('35.550563, 24.069551');
  });
});
