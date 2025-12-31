import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import GasPlanningCalculator from './GasPlanningCalculator';

describe('GasPlanningCalculator', () => {
  it('renders all input fields', () => {
    render(<GasPlanningCalculator />);

    expect(screen.getByLabelText(/Average Depth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Dive Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/SAC Rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cylinder Size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Pressure/i)).toBeInTheDocument();
  });

  it('calculates gas consumption correctly (Simple Mode)', async () => {
    render(<GasPlanningCalculator />);

    const depthInput = screen.getByLabelText(/Average Depth/i);
    const timeInput = screen.getByLabelText(/Total Dive Time/i);
    const sacInput = screen.getByLabelText(/SAC Rate/i);
    const tankSizeSelect = screen.getByLabelText(/Cylinder Size/i);

    // 20m = 3 ATA. 30 min. 15 L/min SAC. 12L tank.
    // Gas = 15 * 3 * 30 = 1350 L
    // Pressure = 1350 / 12 = 112.5 bar -> ~113 or 112 depending on rounding

    fireEvent.change(depthInput, { target: { value: '20' } });
    fireEvent.change(timeInput, { target: { value: '30' } });
    fireEvent.change(sacInput, { target: { value: '15' } });
    fireEvent.change(tankSizeSelect, { target: { value: '12' } });

    await waitFor(() => {
      // Result is displayed as rounded pressure
      expect(screen.getByText('113')).toBeInTheDocument();
      expect(screen.getByText(/1350 Liters total/i)).toBeInTheDocument();
    });
  });

  it('calculates gas consumption correctly (Advanced Mode - Rule of Thirds)', async () => {
    render(<GasPlanningCalculator />);

    const advancedToggle = screen.getByLabelText(/Advanced\/Tech Mode/i);
    fireEvent.click(advancedToggle);

    const depthInput = screen.getByLabelText(/Average Depth/i);
    const timeInput = screen.getByLabelText(/Total Dive Time/i);
    const sacInput = screen.getByLabelText(/SAC Rate/i);
    const tankSizeSelect = screen.getByLabelText(/Cylinder Size/i);

    // 20m = 3 ATA. 30 min. 15 L/min SAC. 12L tank.
    // Dive Gas = 1350 L
    // Total (x1.5) = 2025 L
    // Pressure = 2025 / 12 = 168.75 bar -> ~169

    fireEvent.change(depthInput, { target: { value: '20' } });
    fireEvent.change(timeInput, { target: { value: '30' } });
    fireEvent.change(sacInput, { target: { value: '15' } });
    fireEvent.change(tankSizeSelect, { target: { value: '12' } });

    await waitFor(() => {
      expect(screen.getByText('169')).toBeInTheDocument();
      expect(screen.getByText(/2025 Liters total/i)).toBeInTheDocument();
    });
  });
});
