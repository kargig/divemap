import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import MinGasCalculator from './MinGasCalculator';

describe('MinGasCalculator', () => {
  it('renders all input fields', () => {
    render(<MinGasCalculator />);

    expect(screen.getByLabelText(/Depth \(meters\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Emergency SAC/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time to Solve/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ascent Rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cylinder Size/i)).toBeInTheDocument();
  });

  it('calculates Minimum Gas correctly (Recreational)', async () => {
    render(<MinGasCalculator />);

    const depthInput = screen.getByLabelText(/Depth \(meters\)/i);
    const sacInput = screen.getByLabelText(/Emergency SAC/i);
    const tankSizeSelect = screen.getByLabelText(/Cylinder Size/i);
    const solveTimeInput = screen.getByLabelText(/Time to Solve/i);
    const safetyStopInput = screen.getByLabelText(/Safety Stop/i);

    // 30m, 60 L/min SAC, 1 min solve, 10 m/min ascent, 3 min safety stop, 24L doubles
    // 1. Solve: 4 ATA * 1 min * 60 = 240L
    // 2. Ascent to 5m: Avg 17.5m = 2.75 ATA. Time = 2.5 min. 2.75 * 2.5 * 60 = 412.5L
    // 3. Safety Stop: 1.5 ATA * 3 min * 60 = 270L
    // 4. Ascent to Surface: Avg 2.5m = 1.25 ATA. Time = 0.5 min. 1.25 * 0.5 * 60 = 37.5L
    // Total = 240 + 412.5 + 270 + 37.5 = 960 L
    // Pressure = 960 / 24 = 40 bar

    fireEvent.change(depthInput, { target: { value: '30' } });
    fireEvent.change(sacInput, { target: { value: '60' } });
    fireEvent.change(tankSizeSelect, { target: { value: '24' } });
    fireEvent.change(solveTimeInput, { target: { value: '1' } });
    fireEvent.change(safetyStopInput, { target: { value: '3' } });

    await waitFor(() => {
      expect(screen.getByText('40')).toBeInTheDocument();
    });
  });

  it('calculates Minimum Gas correctly (Gas Switch/Tech)', async () => {
    render(<MinGasCalculator />);

    const techToggle = screen.getByLabelText(/Gas Switch Mode/i);
    fireEvent.click(techToggle);

    const depthInput = screen.getByLabelText(/Depth \(meters\)/i);
    const targetDepthInput = screen.getByLabelText(/Target Depth/i);
    const sacInput = screen.getByLabelText(/Emergency SAC/i);
    const tankSizeSelect = screen.getByLabelText(/Cylinder Size/i);

    // 40m, Target 21m. 60 L/min SAC. 1 min solve. 10 m/min ascent. 24L doubles.
    // 1. Solve: 5 ATA * 1 min * 60 = 300L
    // 2. Ascent to 21m: Avg 30.5m = 4.05 ATA. Time = 1.9 min. 4.05 * 1.9 * 60 = 461.7L
    // Total = 300 + 461.7 = 761.7 L
    // Pressure = 761.7 / 24 = 31.73 bar -> Math.ceil(31.73) = 32 bar

    fireEvent.change(depthInput, { target: { value: '40' } });
    fireEvent.change(targetDepthInput, { target: { value: '21' } });
    fireEvent.change(sacInput, { target: { value: '60' } });
    fireEvent.change(tankSizeSelect, { target: { value: '24' } });

    await waitFor(() => {
      expect(screen.getByText('32')).toBeInTheDocument();
    });
  });
});
