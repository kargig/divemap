import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import ModCalculator from './ModCalculator';

// Mock GasMixInput to simplify testing
vi.mock('../forms/GasMixInput', () => ({
  default: ({ value, onChange }) => (
    <div data-testid='gas-mix-input'>
      <input
        data-testid='gas-o2'
        type='number'
        value={value?.o2 || 32}
        onChange={e => onChange({ ...value, o2: parseInt(e.target.value) })}
      />
      <input
        data-testid='gas-he'
        type='number'
        value={value?.he || 0}
        onChange={e => onChange({ ...value, he: parseInt(e.target.value) })}
      />
    </div>
  ),
}));

describe('ModCalculator', () => {
  it('renders all basic input fields', () => {
    render(<ModCalculator />);

    expect(screen.getByText(/Gas Mixture/i, { selector: 'label' })).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        const hasText = node => node.textContent === 'Max pO2 (bar)';
        const nodeHasText = hasText(element);
        const childrenDontHaveText = Array.from(element.children).every(child => !hasText(child));
        return nodeHasText && childrenDontHaveText;
      })
    ).toBeInTheDocument();
  });

  it('calculates MOD correctly for Nitrox', async () => {
    render(<ModCalculator />);

    // Default EAN32 at 1.4 pO2
    // Max ATA = 1.4 / 0.32 = 4.375 ATA
    // MOD = (4.375 - 1.01325) * 10 = 33.61... -> displayed as 33.6

    await waitFor(() => {
      expect(screen.getByText('33.6')).toBeInTheDocument();
    });

    // Change O2 to 50%
    // Max ATA = 1.4 / 0.5 = 2.8 ATA
    // MOD = (2.8 - 1.01325) * 10 = 17.86... -> displayed as 17.9
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '50' } });

    await waitFor(() => {
      expect(screen.getByText('17.9')).toBeInTheDocument();
    });
  });

  it('calculates MOD and END correctly for Trimix', async () => {
    render(<ModCalculator />);

    const advancedToggle = screen.getByLabelText(/Toggle Advanced Mode/i);
    fireEvent.click(advancedToggle);

    const o2Input = screen.getByTestId('gas-o2');
    const heInput = screen.getByTestId('gas-he');

    // Tx 18/45 at 1.4 pO2
    // Max ATA = 1.4 / 0.18 = 7.77... ATA
    // MOD = (7.77... - 1.01325) * 10 = 67.64... -> 67.6m
    // END ata = 7.77... * (1 - 0.45) = 7.77... * 0.55 = 4.277... ATA
    // END = (67.6 + 10) * (1 - 0.45) - 10 = 77.6 * 0.55 - 10 = 32.68... -> 32.7m

    fireEvent.change(o2Input, { target: { value: '18' } });
    fireEvent.change(heInput, { target: { value: '45' } });

    await waitFor(() => {
      expect(screen.getByText('67.6')).toBeInTheDocument();
      expect(screen.getByText(/END at limit: 32.7m/i)).toBeInTheDocument();
    });
  });
});
