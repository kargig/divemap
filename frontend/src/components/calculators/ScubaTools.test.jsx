import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import ScubaTools from './ScubaTools';

describe('ScubaTools', () => {
  it('renders all tabs and initial MOD state correctly', () => {
    render(
      <BrowserRouter>
        <ScubaTools />
      </BrowserRouter>
    );

    // Verify title and subtitle
    expect(screen.getByText('Scuba Tools')).toBeInTheDocument();
    expect(screen.getByText('Instant, interactive dive planning calculators')).toBeInTheDocument();

    // Verify tabs
    expect(screen.getByRole('button', { name: 'Max Depth (MOD)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nitrox Best Mix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buoyancy Weight' })).toBeInTheDocument();

    // Verify default MOD state elements (flexible matching for nested spans)
    expect(screen.getByText(/Oxygen Percentage:/i)).toBeInTheDocument();
    expect(screen.getByText('32%')).toBeInTheDocument();
    expect(screen.getByText(/Max ppO2 Limit/i)).toBeInTheDocument();
    expect(screen.getByText('1.4 bar')).toBeInTheDocument();
    expect(screen.getByText('33.6 m')).toBeInTheDocument(); // exact value for EAN32 @ 1.4 ppO2 reusing physics.js
  });

  it('can switch tabs and perform other planning calculations', () => {
    render(
      <BrowserRouter>
        <ScubaTools />
      </BrowserRouter>
    );

    // Switch to Nitrox Best Mix tab
    const mixTabButton = screen.getByRole('button', { name: 'Nitrox Best Mix' });
    fireEvent.click(mixTabButton);

    expect(screen.getByText(/Target Max Depth:/i)).toBeInTheDocument();
    expect(screen.getByText('30 meters')).toBeInTheDocument();
    expect(screen.getByText('Recommended Nitrox Blend')).toBeInTheDocument();
    expect(screen.getByText('EAN35')).toBeInTheDocument(); // EAN35 is the ideal blend for 30m with 1.4 ppO2 (1.4 / 4.0 = 0.35)

    // Switch to Buoyancy Weight tab
    const weightTabButton = screen.getByRole('button', { name: 'Buoyancy Weight' });
    fireEvent.click(weightTabButton);

    expect(screen.getByText(/Your Weight:/i)).toBeInTheDocument();
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    // Default 80kg, 5mm (8%), salt water (+2.5%) -> 80 * 0.08 + 80 * 0.025 = 6.4 + 2 = 8.4 kg -> lead range 7 - 9 kg
    expect(screen.getByText('7 - 9 kg')).toBeInTheDocument();
  });
});
