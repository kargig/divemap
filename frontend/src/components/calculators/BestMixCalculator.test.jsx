import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import BestMixCalculator from './BestMixCalculator';

describe('BestMixCalculator', () => {
  it('renders all input fields', () => {
    render(<BestMixCalculator />);

    expect(screen.getByLabelText(/Planned Depth/i)).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        const hasText = node => node.textContent === 'Max pO2 (bar)';
        const nodeHasText = hasText(element);
        const childrenDontHaveText = Array.from(element.children).every(child => !hasText(child));
        return nodeHasText && childrenDontHaveText;
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Enable Trimix/i)).toBeInTheDocument();
  });

  it('calculates best Nitrox mix correctly', async () => {
    render(<BestMixCalculator />);

    const depthInput = screen.getByLabelText(/Planned Depth/i);
    // Default pO2 is 1.4
    // At 30m (4 ATA), Best Mix = 1.4 / 4 = 0.35 (EAN35)

    fireEvent.change(depthInput, { target: { value: '30' } });

    await waitFor(() => {
      expect(screen.getByText('EAN34')).toBeInTheDocument();
    });
  });

  it('calculates best Trimix mix correctly', async () => {
    render(<BestMixCalculator />);

    const trimixToggle = screen.getByLabelText(/Enable Trimix/i);
    fireEvent.click(trimixToggle);

    const depthInput = screen.getByLabelText(/Planned Depth/i);
    const targetEADInput = screen.getByLabelText(/Target EAD/i);

    // 50m = 6.01325 ATA. pO2 1.4 -> fO2 = 1.4 / 6.01325 = 0.2328 (~23%)
    // Target EAD 30m = 4.01325 ATA. pN2 max = 0.79 * 4.01325 = 3.17 bar.
    // max FN2 at 50m = 3.17 / 6.01325 = 0.527 (~53%)
    // fHe = 1 - 0.233 - 0.527 = 0.24 (~24%)
    // Result acronym Tx 23/23, detail 23% O2 / 24% He

    fireEvent.change(depthInput, { target: { value: '50' } });
    fireEvent.change(targetEADInput, { target: { value: '30' } });

    await waitFor(() => {
      expect(screen.getByText('Tx 23/23')).toBeInTheDocument();
    });
  });
});
